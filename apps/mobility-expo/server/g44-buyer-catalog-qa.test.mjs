import test from 'node:test';
import assert from 'node:assert/strict';
import {createG44BuyerCatalogQa} from './g44-buyer-catalog-qa.mjs';
const at=Date.parse('2026-10-23T18:00:00Z');
const buyer='44440000-0000-4444-8444-000000000001';
const sessionId='44440000-0000-4444-8444-000000000002';
const branch='44440000-0000-4444-8444-000000000003';
const token='G44_privateQA_verifiedBearer01234567890';
const current='g44-qa-secret-at-least-thirty-two-private-bytes-2026';
const id=n=>'44440000-0000-4444-8444-'+String(n).padStart(12,'0');
const identity={id:buyer,sessionId,tokenIatMs:at-15000,expiresAtMs:at+900000,
 email_confirmed_at:'2026-10-23T17:00:00Z',is_anonymous:false};
const catalog=Array.from({length:13000},(_,i)=>({
 itemId:id(i+100),itemTag:'PRODUCT_'+i,itemClass:'GENERAL',active:true,
 unitPricePyg:1000+i,stockUnits:15
}));
const branches=Array.from({length:241},(_,i)=>({
 branchId:id(i+14000),branchTag:'BRANCH_'+String(i).replace(/[0-9]/g,'A'),
 merchantKind:'SUPERMARKET',municipality:'Asuncion',serviceKind:'AUTO_DELIVERY',
 eligibleByPolicy:false,orderEnabled:false
}));
function make(override={}){
 const calls=[];
 const params={
  environment:'isolated_staging',liveEnabled:false,localQaOnly:true,
  projectRef:'staging1234567890abcd',cursorSecrets:{current},
  now:()=>at,verifyAccessToken:async()=>identity,
  verifySessionNotRevoked:async()=>true,
  loadExclusiveRole:async()=> 'passenger',allowRequest:()=>true,
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==='mobility_stage_g44_buyer_catalog_page'){
    if(args._expected_revision!==null&&args._expected_revision!==7)
     return {error:{code:'G4409'}};
    const list=catalog.filter(x=>args._after===null||x.itemId>args._after);
    return {data:{branchId:branch,version:7,expiresAt:at+60000,
     items:list.slice(0,100),hasMore:list.length>100,
     orderEnabled:false,eligibleByPolicy:false}};
   }
   const list=branches.filter(x=>args._after===null||x.branchId>args._after);
   return {data:{items:list.slice(0,100),hasMore:list.length>100}};
  },
  ...override
 };
 return {api:createG44BuyerCatalogQa(params),calls};
}
const page={bearer:token,branchId:branch};
test('G44 traverses ALL 13,000 buyer products in 130 pages; pageSize never total cap',async()=>{
 const f=make();let cursor=null,pages=0,total=0,seen=new Set();
 do{
  const result=await f.api.listCatalog({...page,cursor});
  assert.equal(result.status,200,JSON.stringify(result.body));
  assert.equal(result.body.orderEnabled,false);
  assert.equal(result.body.productionEnabled,false);
  assert.equal(result.body.snapshotConsistent,false);
  assert.equal(result.body.version,7);
  for(const item of result.body.items){
   assert.equal(seen.has(item.itemId),false);
   seen.add(item.itemId);
  }
  total+=result.body.items.length;cursor=result.body.nextCursor;
  pages++;
 }while(cursor&&pages<200);
 assert.equal(total,13000);assert.equal(pages,130);
 assert.equal(seen.size,13000);
 assert.equal(f.calls.length,130);
 assert.ok(f.calls.every(x=>x.args._limit===100&&
  x.args._buyer===buyer&&x.args._session===sessionId&&
  x.args._iat_ms===at-15000));
});
test('G44 traverses 241 discovered branches, 100/page and no global cap',async()=>{
 const {api}=make();let cursor=null,total=0,pages=0;
 do{
  const r=await api.listBranches({
   bearer:token,municipality:'Asuncion',serviceKind:'AUTO_DELIVERY',cursor
  });
  assert.equal(r.status,200,JSON.stringify(r.body));
  total+=r.body.items.length;cursor=r.body.nextCursor;pages++;
 }while(cursor&&pages<10);
 assert.equal(total,241);assert.equal(pages,3);
});
test('G44 HMAC cursor cannot cross Buyer, session, branch, filter or secret',async()=>{
 const first=(await make().api.listCatalog(page)).body.nextCursor;
 assert.ok(first&&first.includes('.'));
 const altered=first.slice(0,-1)+(first.endsWith('A')?'B':'A');
 assert.equal((await make().api.listCatalog({...page,cursor:altered})).status,400);
 assert.equal((await make().api.listCatalog({...page,cursor:first,
  branchId:id(99999)})).status,400);
 assert.equal((await make({verifyAccessToken:async()=>({
  ...identity,id:id(99991)
 })}).api.listCatalog({...page,cursor:first})).status,400);
 assert.equal((await make({verifyAccessToken:async()=>({
  ...identity,sessionId:id(99992)
 })}).api.listCatalog({...page,cursor:first})).status,400);
 assert.equal((await make({cursorSecrets:{current:current+'rotated'}})
  .api.listCatalog({...page,cursor:first})).status,400);
 assert.equal((await make({cursorSecrets:{current:current+'rotated',previous:current}})
  .api.listCatalog({...page,cursor:first})).status,200);
 const br=(await make().api.listBranches({
  bearer:token,municipality:'Asuncion',serviceKind:'AUTO_DELIVERY'
 })).body.nextCursor;
 assert.equal((await make().api.listBranches({
  bearer:token,municipality:'San Lorenzo',serviceKind:'AUTO_DELIVERY',cursor:br
 })).status,400);
 assert.equal((await make().api.listBranches({
  bearer:token,municipality:'Asuncion',serviceKind:'MOTO_DELIVERY',cursor:br
 })).status,400);
});
test('G44 detects catalog revision change and instructs first-page refresh',async()=>{
 const first=(await make().api.listCatalog(page)).body.nextCursor;
 const f=make({rpc:async()=>({error:{code:'G4409'}})});
 const r=await f.api.listCatalog({...page,cursor:first});
 assert.equal(r.status,409);assert.equal(r.body.error,'CATALOG_VERSION_CHANGED_REFRESH');
});
test('G44 no SQL for fake JWT, revoked session, wrong role or failed limiter',async()=>{
 for(const [change,status] of [
  [{verifyAccessToken:async()=>{throw Error('bad jwt');}},401],
  [{verifyAccessToken:async()=>({...identity,tokenIatMs:at+1000})},401],
  [{verifyAccessToken:async()=>({...identity,is_anonymous:true})},401],
  [{verifySessionNotRevoked:async()=>false},401],
  [{verifySessionNotRevoked:async()=>{throw Error('offline')}},503],
  [{loadExclusiveRole:async()=> 'driver'},403],
  [{loadExclusiveRole:async()=> 'owner'},403],
  [{loadExclusiveRole:async()=>['passenger','driver']},403],
  [{allowRequest:()=>false},429],
  [{allowRequest:()=>{throw Error('rate unavailable')}},503],
 ]){
  const f=make(change);assert.equal((await f.api.listCatalog(page)).status,status);
  assert.equal(f.calls.length,0);
 }
});
test('G44 rejects poisoned SQL rows, leaked PII, order-enabled and stale page',async()=>{
 const good=catalog[0];
 const poison=[
  {branchId:branch,version:7,expiresAt:at+60000,hasMore:false,items:[{
   ...good,email:'leak'
  }],orderEnabled:false,eligibleByPolicy:false},
  {branchId:branch,version:7,expiresAt:at+60000,hasMore:false,items:[{
   ...good,itemClass:'PRESCRIPTION'
  }],orderEnabled:false,eligibleByPolicy:false},
  {branchId:branch,version:7,expiresAt:at+60000,hasMore:false,items:[good,good],
   orderEnabled:false,eligibleByPolicy:false},
  {branchId:branch,version:7,expiresAt:at+60000,hasMore:true,items:[good],
   orderEnabled:false,eligibleByPolicy:false},
  {branchId:branch,version:7,expiresAt:at+60000,hasMore:false,items:[good],
   orderEnabled:true,eligibleByPolicy:false},
  {branchId:branch,version:7,expiresAt:at-10,hasMore:false,items:[good],
   orderEnabled:false,eligibleByPolicy:false},
 ];
 for(const data of poison)
  assert.equal((await make({rpc:async()=>({data})}).api.listCatalog(page)).status,503);
});
test('G44 constructor cannot enable production or omit trusted sources',()=>{
 const d={environment:'isolated_staging',liveEnabled:false,localQaOnly:true,
  projectRef:'staging1234567890abcd',cursorSecrets:{current},
  verifyAccessToken:async()=>{},verifySessionNotRevoked:async()=>{},
  loadExclusiveRole:async()=>{},allowRequest:()=>{},rpc:async()=>{}};
 for(const change of [{liveEnabled:true},{environment:'production'},
  {cursorSecrets:{current:'weak'}},{rpc:null},{verifyAccessToken:null}])
  assert.throws(()=>createG44BuyerCatalogQa({...d,...change}));
});
