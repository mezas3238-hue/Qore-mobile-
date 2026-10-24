/**
 * G26.3: 24 real loopback HTTP GET requests across three different server-side
 * PostgreSQL-like history sources. Fully synthetic actor/session/DB adapters;
 * checks transport + gateway + repository + HMAC cursor + owner filtering.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreOwnHistoryRepository} from './g26-rider-history-repository.mjs';
import {createQoreRiderHistoryGateway} from './g26-rider-history-gateway.mjs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';

const owner='11111111-1111-4111-8111-111111111111';
const stranger='22222222-2222-4222-8222-222222222222';
const at=Date.parse('2026-10-23T04:00:00.000Z');
const ownerBearer='synthetic_owner_QoreHistory2026_bearer_123456';
const foreignBearer='synthetic_other_QoreHistory2026_bearer_123456';
const time=value=>new Date(value).toISOString();
const configs=[
 ['mobility_stage_auto_demo_trips','passenger_id','cancelled',0],
 ['mobility_stage_deliveries','sender_id','delivered',10000],
 ['mobility_stage_merchant_orders','buyer_id','delivered',20000]
];
function dataset(){
 return Object.fromEntries(configs.map(([table,actor,status,offset])=>[
  table,Array.from({length:400},(_,i)=>({
   id:(offset+i).toString(16).padStart(8,'0')+'-3333-4333-8333-333333333333',
   [actor]:owner,status,revision:1+i%6,
   created_at:time(at-60_000*(i+1))
  }))
 ]));
}
function repositoryAdapter(rows,{recordQuery}){
 return {from(table){
  let actor=null,anchor=null,filter=null;
  const query={
   select(fields){
    assert.equal(fields, 'id,'+(table==='mobility_stage_auto_demo_trips'?
     'passenger_id':table==='mobility_stage_deliveries'?'sender_id':'buyer_id')+
     ',status,revision,created_at');
    return this;
   },
   eq(k,v){actor={k,v};return this;},
   lte(k,v){assert.equal(k,'created_at');anchor=Date.parse(v);return this;},
   or(v){filter=v;return this;},
   order(){return this;},
   async limit(n){
    assert.equal(n,51);
    assert.ok(actor&&anchor!==null);
    recordQuery?.({table,ownerId:actor.v,limit:n,filter});
    let list=rows[table].filter(row=>row[actor.k]===actor.v&&
      Date.parse(row.created_at)<=anchor);
    if(filter!==null){
     const m=/^created_at\.lt\.(.*),and\(created_at\.eq\.(.*),id\.(lt|lte)\.(.*)\)$/.exec(filter);
     assert.ok(m);
     const boundary=Date.parse(m[1]),id=m[4],same=m[3]==='lte';
     list=list.filter(row=>{
      const d=Date.parse(row.created_at);
      return d<boundary||d===boundary&&(same?row.id<=id:row.id<id);
     });
    }
    list.sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||
      b.id.localeCompare(a.id));
    return {data:list.slice(0,n),error:null};
   }
  };
  return query;
 }};
}
const unavailable=async()=>({status:503,body:{error:'Synthetic adapter disabled'}});
function createServer(rows,{clock=()=>at,queries=[]}={}){
 const history=createQoreRiderHistoryGateway({
  projectRef:'staging1234567890abcd',
  cursorSecrets:{current:'synthetic-private-staging-HMAC-secret-not-used-outside-test'},
  verifyAccessToken:async bearer=>{
   const id=bearer===ownerBearer?owner:bearer===foreignBearer?stranger:null;
   if(!id)throw Error('Invalid JWT fixture');
   return {id,is_anonymous:false,email_confirmed_at:'2026-10-23T00:00:00Z'};
  },
  authorizePassenger:async id=>id===owner||id===stranger,
  allowRequest:()=>true,now:clock,
  loadOwnHistory:createQoreOwnHistoryRepository(repositoryAdapter(rows,{
   recordQuery:q=>queries.push(q)
  }))
 });
 return createQoreRadarLoopbackTransport({
  riderHandler:unavailable,riderHistoryHandler:history,
  offerHandler:unavailable,tripCommandHandler:unavailable,
  deliveryHandler:unavailable,merchantHandler:unavailable,
  financeHandler:unavailable,safetyHandler:unavailable,
  merchantManagementHandler:unavailable,deliveryOfferHandler:unavailable
 });
}
async function response(base,bearer,cursor){
 const headers={authorization:'Bearer '+bearer};
 if(cursor!==undefined)headers['x-qore-history-cursor']=cursor;
 const r=await fetch(base+'/v1/staging/rider/history',{
  method:'GET',headers,redirect:'error'});
 return {status:r.status,body:await r.json(),headers:r.headers};
}

test('G26.3 1,200 historic rows reachable through all 24 actual HTTP pages, no duplicates or foreign reads',async t=>{
 const rows=dataset(),queries=[],server=createServer(rows,{queries});
 const base=await listenQoreRadarLoopback(server);
 t.after(async()=>new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve())));
 let cursor=undefined,pages=0,seen=new Set(),previous=Infinity;
 do{
  const result=await response(base,ownerBearer,cursor);
  assert.equal(result.status,200,JSON.stringify(result.body));
  assert.equal(result.body.ownerId,owner);
  assert.equal(result.headers.get('cache-control'),'private, no-store, max-age=0');
  assert.equal(result.headers.get('access-control-allow-origin'),null);
  assert.ok(result.body.items.length<=50);
  for(const item of result.body.items){
   assert.equal(seen.has(item.serviceId),false,'duplicate across HTTP pages');
   seen.add(item.serviceId);
   assert.ok(item.createdAt<=previous);
   previous=item.createdAt;
  }
  cursor=result.body.nextCursor??undefined;
  pages++;
  assert.ok(pages<=25);
 }while(cursor!==undefined);
 assert.equal(pages,24);
 assert.equal(seen.size,1200);
 assert.equal(queries.length,24*3);
 assert.ok(queries.every(q=>q.ownerId===owner&&q.limit===51));
 const forbidden=await response(base,foreignBearer);
 assert.equal(forbidden.status,200);
 assert.deepEqual(forbidden.body.items,[]);
 assert.equal(forbidden.body.nextCursor,null);
 const access=await response(base,'tampered_token_never_issued');
 assert.equal(access.status,401);
 assert.equal(queries.length,25*3,'24 owner pages plus one foreign scoped page only');
});
test('G26.3 new operations created after first-page anchor do not alter old traversal',async t=>{
 const rows=dataset(),server=createServer(rows);
 const base=await listenQoreRadarLoopback(server);
 t.after(async()=>new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve())));
 const first=await response(base,ownerBearer);
 assert.equal(first.status,200);
 assert.ok(first.body.nextCursor);
 rows.mobility_stage_auto_demo_trips.push({
  id:'ffffffff-ffff-4fff-8fff-ffffffffffff',
  passenger_id:owner,status:'cancelled',revision:1,
  created_at:time(at+60_000)
 });
 let cursor=first.body.nextCursor,remaining=0;
 while(cursor!==null){
  const page=await response(base,ownerBearer,cursor);
  assert.equal(page.status,200);
  assert.ok(!page.body.items.some(i=>i.serviceId==='ffffffff-ffff-4fff-8fff-ffffffffffff'));
  remaining+=page.body.items.length;
  cursor=page.body.nextCursor;
 }
 assert.equal(remaining+first.body.items.length,1200);
});
test('G26.3 foreign JWT cannot reuse captured owner cursor even over real loopback HTTP',async t=>{
 const rows=dataset(),queries=[],server=createServer(rows,{queries});
 const base=await listenQoreRadarLoopback(server);
 t.after(async()=>new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve())));
 const first=await response(base,ownerBearer);
 assert.equal(first.status,200);
 const count=queries.length;
 assert.equal((await response(base,foreignBearer,first.body.nextCursor)).status,400);
 assert.equal(queries.length,count,'forbidden history cursor must be rejected before SQL');
});
