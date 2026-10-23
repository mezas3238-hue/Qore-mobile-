import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreOwnHistoryRepository,HISTORY_PAGE_SIZE}
 from './g26-rider-history-repository.mjs';
const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const at=Date.parse('2026-10-23T04:20:00Z');
const tableSpecs=[
 ['mobility_stage_auto_demo_trips','passenger_id','accepted',0],
 ['mobility_stage_deliveries','sender_id','delivered',10000],
 ['mobility_stage_merchant_orders','buyer_id','preparing',20000]
];
const iso=ms=>new Date(ms).toISOString();
function makeRows(count){
 return Object.fromEntries(tableSpecs.map(([table,actor,status,offset])=>[
  table,Array.from({length:count},(_,i)=>({
   id:(offset+i).toString(16).padStart(8,'0')+'-3333-4333-8333-333333333333',
   [actor]:owner,status,revision:1+i%5,
   created_at:iso(at-60000-i*60000)
  }))
 ]));
}
function fixture(rows=makeRows(1)){
 const calls=[];
 const db={
  from(table){
   let actor=null,anchor=null,position=null;
   const chain={
    select(cols){calls.push({table,cols});return this;},
    eq(k,v){actor={k,v};return this;},
    lte(k,v){assert.equal(k,'created_at');anchor=Date.parse(v);return this;},
    or(v){position=v;return this;},
    order(){return this;},
    async limit(size){
     assert.equal(size,HISTORY_PAGE_SIZE+1);
     if(!Array.isArray(rows[table]))return {data:null,error:{code:'42P01'}};
     let source=rows[table].filter(row=>row[actor.k]===actor.v&&
      Date.parse(row.created_at)<=anchor);
     if(position!==null){
      const match=/^created_at\.lt\.(.*),and\(created_at\.eq\.(.*),id\.(lt|lte)\.(.*)\)$/.exec(position);
      assert.ok(match,'Strict keyset filter');
      assert.equal(match[1],match[2]);
      const [,cutoff,,op,id]=match;
      source=source.filter(row=>Date.parse(row.created_at)<Date.parse(cutoff)||
       Date.parse(row.created_at)===Date.parse(cutoff)&&
       (op==='lte'?row.id<=id:row.id<id));
     }
     source.sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||
      b.id.localeCompare(a.id));
     return {data:source.slice(0,size),error:null};
    }
   };
   return chain;
  }
 };
 return {calls,load:createQoreOwnHistoryRepository(db)};
}
test('G26.1 first page merges own services with time+id ordering and minimal fields',async()=>{
 const {load,calls}=fixture();
 const page=await load({ownerId:owner,anchorMs:at});
 assert.equal(page.items.length,3);
 assert.deepEqual(page.items.map(x=>x.kind),['RIDE','DELIVERY','MERCHANT_ORDER']);
 assert.equal(page.nextPosition,null);
 assert.equal(calls.length,3);
 assert.ok(calls.every(x=>x.cols.includes('created_at')&&!x.cols.includes('phone')));
 assert.doesNotMatch(JSON.stringify(page),/passenger_id|sender_id|buyer_id|plate|phone/);
});
test('G26.1 histories longer than 50, 500 and 1000 never disappear or repeat',async()=>{
 const {load}=fixture(makeRows(400)); // 1,200 across three kinds
 let after=null,pages=0;const seen=new Set();const events=[];
 do{
  const result=await load({ownerId:owner,anchorMs:at,after});
  assert.ok(result.items.length<=HISTORY_PAGE_SIZE);
  for(const item of result.items){
   assert.equal(seen.has(item.serviceId),false,'No duplicate across pages');
   seen.add(item.serviceId);events.push(item);
  }
  after=result.nextPosition;
  pages++;
  assert.ok(pages<100,'cursor must make progress');
 }while(after!==null);
 assert.equal(pages,24);
 assert.equal(seen.size,1200);
 assert.equal(events.length,1200);
 for(let i=1;i<events.length;i++)
  assert.ok(events[i-1].createdAt>=events[i].createdAt);
});
test('G26.1 missing source, corrupt owner, invalid status and badly scoped requests are rejected',async()=>{
 const rows=makeRows(1);
 await assert.rejects(fixture({...rows,mobility_stage_merchant_orders:null})
  .load({ownerId:owner,anchorMs:at}));
 await assert.rejects(fixture({
  ...rows,mobility_stage_auto_demo_trips:[{
   ...rows.mobility_stage_auto_demo_trips[0],status:'not-authoritative'
  }]
 }).load({ownerId:owner,anchorMs:at}));
 await assert.rejects(fixture(rows).load({ownerId:other,anchorMs:-1}));
 await assert.rejects(fixture(rows).load({
  ownerId:owner,anchorMs:at,after:{time:'wrong',id:other,kind:'RIDE'}
 }));
});
