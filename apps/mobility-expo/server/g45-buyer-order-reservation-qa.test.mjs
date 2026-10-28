import test from 'node:test';
import assert from 'node:assert/strict';
import {createG45BuyerOrderReservationQa} from './g45-buyer-order-reservation-qa.mjs';

const at=Date.parse('2026-10-23T19:00:00Z');
const id=n=>'45450000-0000-4545-8545-'+String(n).padStart(12,'0');
const buyer=id(1),sessionId=id(101),branchId=id(30),itemId=id(40);
const requestKey=id(201),orderId=id(501),receiptId=id(601);
const cancelKey=id(301),cancelReceiptId=id(602),eventId=id(701);
const bearer='synthetic-signed-provider-bearer-g45-qa-01';
const identity={id:buyer,sessionId,tokenIatMs:at-20000,
 expiresAtMs:at+900000,is_anonymous:false,email_confirmed_at:'2026-10-23T18:00:00Z'};
const request={requestKey,branchId,catalogVersion:8,vehicleKind:'AUTO',
 items:[{itemId,quantity:2}]};
const order={receiptId,orderId,requestKey,branchId,catalogVersion:8,
 subtotalPyg:50000,receiptStatus:'QA_RESERVED_NO_PAYMENT',
 orderEnabled:false,productionEnabled:false};
const cancellation={orderId,receiptId:cancelReceiptId,eventId,
 receiptStatus:'QA_CANCELLED_STOCK_RESTORED',
 refundStatus:'NO_PSP_NO_FINANCIAL_REFUND',
 orderEnabled:false,productionEnabled:false};
function fixture(change={}){
 const calls=[];
 const adapters={
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  projectRef:'staging1234567890abcd',now:()=>at,
  verifyAccessToken:async()=>identity,
  verifySessionNotRevoked:async()=>true,
  loadExclusiveRole:async()=> 'passenger',
  allowRequest:()=>true,
  rpc:async(name,args)=>{calls.push({name,args});return {data:
   name==='mobility_stage_g45_reserve_order_qa'?order:cancellation};},
  ...change
 };
 return {api:createG45BuyerOrderReservationQa(adapters),calls};
}
test('G45 server-priced receipt sealed; client never supplies subtotal or permissions',async()=>{
 const f=fixture();
 const result=await f.api.reserve({bearer,body:request});
 assert.equal(result.status,201,JSON.stringify(result.body));
 assert.deepEqual(result.body,order);
 assert.equal(result.body.subtotalPyg,50000);
 assert.equal(result.body.orderEnabled,false);
 assert.deepEqual(f.calls[0],{
  name:'mobility_stage_g45_reserve_order_qa',
  args:{_buyer:buyer,_session:sessionId,_iat_ms:at-20000,
   _request_key:requestKey,_branch:branchId,_catalog_version:8,
   _vehicle_kind:'AUTO',_items:request.items}
 });
});
test('G45 exact signed actor session is required for cancellation; refund remains simulated',async()=>{
 const f=fixture();
 const result=await f.api.cancel({bearer,body:{orderId,cancelKey}});
 assert.equal(result.status,200);
 assert.deepEqual(result.body,cancellation);
 assert.deepEqual(f.calls[0],{name:'mobility_stage_g45_cancel_order_qa',
  args:{_buyer:buyer,_session:sessionId,_iat_ms:at-20000,
   _order_id:orderId,_cancel_key:cancelKey}});
});
test('G45 blocks client prices, payment, prescription, MOTO, duplicates, non-integer quantities',async()=>{
 const bad=[
  {...request,subtotalPyg:1},{...request,unitPricePyg:1},
  {...request,paymentMethod:'CREDIT_CARD'},{...request,buyerId:buyer},
  {...request,catalogVersion:0},{...request,catalogVersion:1.25},
  {...request,vehicleKind:'MOTO'},
  {...request,items:[]},
  {...request,items:[{itemId,quantity:1,unitPricePyg:1}]},
  {...request,items:[{itemId,quantity:1},{itemId,quantity:1}]},
  {...request,items:[{itemId,quantity:0}]},
  {...request,items:[{itemId,quantity:1.5}]},
  {...request,items:[{itemId,quantity:1000}]},
  {...request,items:Array.from({length:51},(_,n)=>({
    itemId:id(1000+n),quantity:1
  }))}
 ];
 for(const body of bad){
  const f=fixture();
  assert.equal((await f.api.reserve({bearer,body})).status,400);
  assert.equal(f.calls.length,0);
 }
});
test('G45 JWT, revoked provider session, cross-role, failed limiter never reach SQL',async()=>{
 const bad=[
  [{verifyAccessToken:async()=>{throw Error('tampered');}},401],
  [{verifyAccessToken:async()=>({...identity,tokenIatMs:at+2000})},401],
  [{verifyAccessToken:async()=>({...identity,expiresAtMs:at})},401],
  [{verifyAccessToken:async()=>({...identity,is_anonymous:true})},401],
  [{verifySessionNotRevoked:async()=>false},401],
  [{verifySessionNotRevoked:async()=>{throw Error('offline')}},503],
  [{loadExclusiveRole:async()=> 'driver'},403],
  [{loadExclusiveRole:async()=> ['passenger','driver']},403],
  [{allowRequest:()=>false},429]
 ];
 for(const [change,code] of bad){
  const f=fixture(change);
  assert.equal((await f.api.reserve({bearer,body:request})).status,code);
  assert.equal(f.calls.length,0);
 }
});
test('G45 handles SQL stale version, foreign order, DB outage fail-closed',async()=>{
 for(const [code,expected] of [
  ['G4509',409],['G4501',403],['G4503',403],['XX001',503]
 ]){
  const f=fixture({rpc:async()=>({error:{code}})});
  assert.equal((await f.api.reserve({bearer,body:request})).status,expected);
  assert.equal((await f.api.cancel({bearer,body:{orderId,cancelKey}})).status,expected);
 }
 const f=fixture({rpc:async()=>{throw Error('provider/db down')}});
 assert.equal((await f.api.reserve({bearer,body:request})).status,503);
 assert.equal((await f.api.cancel({bearer,body:{orderId,cancelKey}})).status,503);
});
test('G45 poisoned receipt, forged checkout or PII cannot pass response boundary',async()=>{
 for(const changed of [
  {subtotalPyg:1.1},{subtotalPyg:-100},{refundStatus:'PAID'},
  {orderEnabled:true},{productionEnabled:true},{buyerId:buyer},
  {receiptStatus:'REAL_PAYMENT_SUCCEEDED'},{receiptId:'fake'},
  {catalogVersion:9},{requestKey:id(202)}
 ]){
  const data={...order,...changed};
  const f=fixture({rpc:async()=>({data})});
  assert.equal((await f.api.reserve({bearer,body:request})).status,503);
 }
 for(const changed of [{...cancellation,paymentReceived:true},
  {...cancellation,refundStatus:'REFUND_SENT'},
  {...cancellation,orderId:id(502)}]){
  const f=fixture({rpc:async()=>({data:changed})});
  assert.equal((await f.api.cancel({bearer,body:{orderId,cancelKey}})).status,503);
 }
});
test('G45 rejects forged cancel body and production configuration',async()=>{
 const f=fixture();
 for(const body of [
  {orderId,cancelKey,buyerId:buyer},{orderId,cancelKey:'fake'},
  {orderId:id(10)},null
 ])assert.equal((await f.api.cancel({bearer,body})).status,400);
 assert.equal(f.calls.length,0);
 for(const bad of [
  {liveEnabled:true},{environment:'production'},{localQaOnly:false},
  {rpc:null},{verifyAccessToken:null}
 ])assert.throws(()=>fixture(bad));
});
