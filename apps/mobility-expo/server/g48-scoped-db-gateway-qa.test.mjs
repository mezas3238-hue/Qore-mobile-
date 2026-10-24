import test from 'node:test';
import assert from 'node:assert/strict';
import {createG48ScopedDbGatewayQa} from './g48-scoped-db-gateway-qa.mjs';
const id=n=>'48480000-0000-4848-8484-'+String(n).padStart(12,'0');
const driver=id(1),buyer=id(2),sessionId=id(101),branchId=id(30),
 itemId=id(40),leaseId=id(70),ticket=id(111);
const at=Date.parse('2026-10-23T20:00:00Z');
const bearer='g48-verifiable-synthetic-provider-bearer-local-only-001';
const identity={id:driver,sessionId,tokenIatMs:at-15000,
 expiresAtMs:at+120000,is_anonymous:false,email_confirmed_at:'synthetic'};
const mint=purpose=>({ticket,expiresAtMs:at+25000,purpose,
 delegationKind:'QA_OWNER_ONLY_NOT_JWT_BOUND',productionEnabled:false});
const status={items:[{kind:'licencia',status:'pending',
 submittedAt:'2026-10-23T17:00:00Z',reviewedAt:null}],
 source:'QA_G48_DRIVER_STATUS_ONLY',documentBytesAvailable:false,
 signedUrlAvailable:false,productionEnabled:false};
const probe={leaseActive:true,signedUrlAvailable:false,
 documentBytesAvailable:false,productionEnabled:false};
const catalog={branchId,version:3,expiresAt:at+60000,hasMore:false,
 items:[{itemId,itemTag:'QA_TEST_ITEM',itemClass:'GENERAL',active:true,
 unitPricePyg:12500,stockUnits:2}],
 orderEnabled:false,eligibleByPolicy:false,
 source:'QA_G48_SCOPED_CATALOG_ONLY',productionEnabled:false};
const operationData={DRIVER_STATUS:status,DRIVER_LEASE_PROBE:probe,
 BUYER_CATALOG_PAGE:catalog};
function fx(options={}){
 const calls=[];
 const cfg={
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  projectRef:'staging1234567890abcd',now:()=>at,
  verifyAccessToken:async()=>identity,
  verifySessionNotRevoked:async()=>true,
  resolveExclusiveRole:async()=> 'driver',
  allowRequest:()=>true,
  ownerMintTicket:async params=>{
   calls.push({type:'mint',params});
   return mint(params.purpose);
  },
  rpc:async(name,args)=>{
   calls.push({type:'rpc',name,args});
   return {data:operationData[name.includes('driver_status')?'DRIVER_STATUS':
    name.includes('driver_lease')?'DRIVER_LEASE_PROBE':'BUYER_CATALOG_PAGE']};
  },
  ...options
 };
 return {api:createG48ScopedDbGatewayQa(cfg),calls};
}
test('G48 mints owner-only ephemeral proof, delegates Driver status without actor input or PII',async()=>{
 const f=fx(),out=await f.api.handle({bearer,operation:'DRIVER_STATUS'});
 assert.equal(out.status,200,JSON.stringify(out));
 assert.deepEqual(out.body,status);
 assert.deepEqual(f.calls,[
  {type:'mint',params:{actorId:driver,sessionId,tokenIatMs:at-15000,
   purpose:'DRIVER_STATUS',resourceId:driver}},
  {type:'rpc',name:'mobility_stage_g48_driver_status_qa',args:{_ticket:ticket}}
 ]);
 assert.doesNotMatch(JSON.stringify(out),/storageBucket|objectKey|sha256Hex|https:\/\//);
});
test('G48 buyer catalog uses branch-bound ticket and server-only PYG with page version',async()=>{
 const f=fx({verifyAccessToken:async()=>({...identity,id:buyer}),
  resolveExclusiveRole:async()=> 'passenger'});
 const r=await f.api.handle({bearer,operation:'BUYER_CATALOG_PAGE',
  branchId,expectedRevision:3,after:null});
 assert.equal(r.status,200);
 assert.deepEqual(r.body,catalog);
 assert.equal(f.calls[0].params.actorId,buyer);
 assert.equal(f.calls[0].params.resourceId,branchId);
 assert.deepEqual(f.calls[1],{
  type:'rpc',name:'mobility_stage_g48_buyer_catalog_page_qa',
  args:{_ticket:ticket,_expected_revision:3,_after:null}
 });
 assert.equal(r.body.items[0].unitPricePyg,12500);
 assert.equal(r.body.orderEnabled,false);
});
test('G48 private KYC lease probe delegates only opaque lease; no Storage reads',async()=>{
 const f=fx();
 const r=await f.api.handle({bearer,operation:'DRIVER_LEASE_PROBE',leaseId});
 assert.equal(r.status,200);
 assert.deepEqual(r.body,probe);
 assert.equal(f.calls[0].params.resourceId,leaseId);
 assert.equal(f.calls[1].name,'mobility_stage_g48_driver_lease_probe_qa');
});
test('G48 invalid page/unknown lease and caller-supplied identity never mint any proof',async()=>{
 for(const args of [
  {operation:'BUYER_CATALOG_PAGE',branchId:'invalid'},
  {operation:'BUYER_CATALOG_PAGE',branchId,after:id(300),expectedRevision:null},
  {operation:'BUYER_CATALOG_PAGE',branchId,expectedRevision:0},
  {operation:'BUYER_CATALOG_PAGE',branchId,leaseId},
  {operation:'DRIVER_STATUS',branchId},
  {operation:'DRIVER_STATUS',leaseId},
  {operation:'DRIVER_LEASE_PROBE',leaseId:'invalid'},
  {operation:'DRIVER_LEASE_PROBE',leaseId,expectedRevision:3},
  {operation:'PAYMENT_CAPTURE'}
 ]){
  const f=fx();
  const r=await f.api.handle({bearer,...args});
  assert.ok([400,404].includes(r.status));
  assert.equal(f.calls.length,0);
 }
});
test('G48 forged JWT, revoked session, mixed role or limiter deny before ticket mint',async()=>{
 for(const [change,expected] of [
  [{verifyAccessToken:async()=>{throw Error('bad signature')}},401],
  [{verifyAccessToken:async()=>({...identity,sessionId:'invalid'})},401],
  [{verifyAccessToken:async()=>({...identity,tokenIatMs:at+1000})},401],
  [{verifyAccessToken:async()=>({...identity,expiresAtMs:at})},401],
  [{verifySessionNotRevoked:async()=>false},401],
  [{verifySessionNotRevoked:async()=>{throw Error('provider down')}},503],
  [{resolveExclusiveRole:async()=> ['passenger','driver']},403],
  [{resolveExclusiveRole:async()=> 'passenger'},403],
  [{allowRequest:()=>false},429]
 ]){
  const f=fx(change);
  const r=await f.api.handle({bearer,operation:'DRIVER_STATUS'});
  assert.equal(r.status,expected);
  assert.equal(f.calls.length,0);
 }
});
test('G48 never trusts a forged/expired/long-lived or over-permissive ticket',async()=>{
 for(const bad of [
  {ticket:'invalid'}, {expiresAtMs:at-100},
  {expiresAtMs:at+31000},{purpose:'BUYER_CATALOG_PAGE'},
  {delegationKind:'JWT_AUTHENTICATED_PRODUCTION'},
  {productionEnabled:true},{actorId:driver},{storageCredential:'secret'}
 ]){
  const f=fx({ownerMintTicket:async p=>({...mint(p.purpose),...bad})});
  const r=await f.api.handle({bearer,operation:'DRIVER_STATUS'});
  assert.equal(r.status,503,JSON.stringify(bad));
  assert.equal(f.calls.length,0);
 }
});
test('G48 rejects poisoned SQL projections, client prices or future LIVE flags',async()=>{
 for(const data of [
  {...status,objectKey:'driver/license.jpg'},
  {...status,signedUrlAvailable:true},
  {...status,items:[{...status.items[0],sha256Hex:'f'.repeat(64)}]},
  {...status,items:[{...status.items[0],kind:'passenger_id'}]},
  {...status,productionEnabled:true}
 ]){
  const f=fx({rpc:async()=>({data})});
  assert.equal((await f.api.handle({bearer,operation:'DRIVER_STATUS'})).status,503);
 }
 for(const data of [
  {...catalog,unitPricePyg:1},
  {...catalog,branchId:id(999)},
  {...catalog,orderEnabled:true},
  {...catalog,items:[{...catalog.items[0],unitPricePyg:-5}]},
  {...catalog,items:[{...catalog.items[0],buyerId:buyer}]},
  {...catalog,items:[catalog.items[0],catalog.items[0]]}
 ]){
  const f=fx({verifyAccessToken:async()=>({...identity,id:buyer}),
   resolveExclusiveRole:async()=> 'passenger',rpc:async()=>({data})});
  assert.equal((await f.api.handle({bearer,operation:'BUYER_CATALOG_PAGE',
   branchId,expectedRevision:3})).status,503);
 }
});
test('G48 DB tickets consumed/stale/cross-scope/revoked always fail closed',async()=>{
 for(const [code,status] of [['G4804',410],['G4803',403],
  ['G4801',403],['G4409',409],['XX001',503]]){
  const f=fx({rpc:async()=>({error:{code}})});
  assert.equal((await f.api.handle({bearer,operation:'DRIVER_STATUS'})).status,status);
 }
 const f=fx({ownerMintTicket:async()=>{throw Error('owner unavailable')}});
 assert.equal((await f.api.handle({bearer,operation:'DRIVER_STATUS'})).status,503);
});
test('G48 cannot construct production service or bypass trusted owner',()=>{
 for(const changes of [
  {environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {ownerMintTicket:null},{rpc:null},{verifyAccessToken:null}
 ])assert.throws(()=>fx(changes));
});
