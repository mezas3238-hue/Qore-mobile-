import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createG305MerchantPrepaymentMutationFence,G305_MERCHANT_PREPAID_MUTATIONS_ENABLED}
 from './g305-merchant-prepayment-mutation-fence.mjs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
const order='11111111-1111-4111-8111-111111111111';
const delivery='22222222-2222-4222-8222-222222222222';
const event='33333333-3333-4333-8333-333333333333';
function fixture(){
 const seen=[];
 const original=async input=>{seen.push(input);return {
  status:200,body:{mode:'SYNTHETIC_QA',fakeOriginal:true}};};
 return {seen,handler:createG305MerchantPrepaymentMutationFence({merchantHandler:original})};
}
const route=(kind='transition')=>'/v1/staging/merchant/orders/'+order+'/'+kind;
test('G305 staging merchant prepaid mutation lock stays OFF until SQL/PSP certification',()=>{
 assert.equal(G305_MERCHANT_PREPAID_MUTATIONS_ENABLED,false);
 assert.throws(()=>createG305MerchantPrepaymentMutationFence({}),/original Merchant handler/);
});
test('Merchant confirm cannot run without real prepaid funds',async()=>{
 const x=fixture();
 const r=await x.handler({method:'POST',path:route(),body:{event:'confirm',eventKey:event}});
 assert.equal(r.status,409);assert.equal(r.body.paymentCaptured,false);
 assert.equal(r.body.merchantPreparationEnabled,false);assert.equal(x.seen.length,0);
});
test('No legacy Merchant preparation, ready, handoff or delivery attachment',async()=>{
 const x=fixture();
 for(const [kind,body] of [
  ['transition',{event:'start_preparing',eventKey:event}],
  ['transition',{event:'ready',eventKey:event}],
  ['transition',{event:'hand_to_courier',eventKey:event}],
  ['attach-delivery',{deliveryId:delivery,requestKey:event}]
 ]){
  const r=await x.handler({method:'POST',path:route(kind),body,
   headers:{authorization:'Bearer synthetic_test_merchant_token_00000001'}});
  assert.equal(r.status,409);
  assert.equal(r.body.code,'G305_MERCHANT_PREPAYMENT_ATOMIC_GATE_NOT_CERTIFIED');
 }
 assert.equal(x.seen.length,0);
});
test('A submitted paymentId, cash receipt or fake verified metadata cannot unlock merchant',async()=>{
 const x=fixture();
 for(const additions of [
  {paymentConfirmed:true},
  {paymentMethod:'CASH'},
  {providerSettlement:'SETTLED'},
  {webhookVerified:true},
  {paymentId:event}
 ]){
  const r=await x.handler({method:'POST',path:route(),body:{
   event:'start_preparing',eventKey:event,...additions
  }});
  assert.equal(r.status,409);
 }
 assert.equal(x.seen.length,0);
});
test('Case variants and trailing slash merchant endpoints remain blocked',async()=>{
 const x=fixture();
 for(const path of [
  route('TRANSITION'),route('transition')+'/',
  '/V1/STAGING/MERCHANT/ORDERS/'+order+'/ATTACH-DELIVERY',
  '/v1/staging/merchant/orders',
  '/v1/staging/merchant/orders/'+order+'/unexpected',
 ]){
  const r=await x.handler({method:'POST',path});
  assert.equal(r.status,409,path);
 }
 assert.equal(x.seen.length,0);
});
test('No untrusted merchant GET over same prefix is delegated',async()=>{
 const x=fixture();
 for(const path of [route('transition'),'/v1/staging/merchant/orders/'+order]){
  const r=await x.handler({method:'GET',path});
  assert.equal(r.status,409);
 }
 assert.equal(x.seen.length,0);
});
test('Buyer original G139 reservation and order-scoped read routes are unaffected',async()=>{
 const x=fixture();
 for(const input of [
  {method:'POST',path:'/v1/staging/buyer/orders/qa/reserve'},
  {method:'GET',path:'/v1/staging/orders/'+order+'/status'},
  {method:'GET',path:'/v1/staging/buyer/orders/qa/requests/'+event},
  {method:'GET',path:'/v1/staging/admin/services/COMMERCE/'+order+'/trace'},
  {method:'POST',path:'/v1/staging/payments/authorize'}
 ]){
  const r=await x.handler(input);
  assert.equal(r.status,200);
 }
 assert.equal(x.seen.length,5);
});
test('G4 Railway STAGING composition actually installs G305 fence after G175',()=>{
 const runtime=readFileSync(new URL('./g4-staging-runtime.mjs',import.meta.url),'utf8');
 assert.match(runtime,/import \{createG305MerchantPrepaymentMutationFence\}/);
 assert.match(runtime,/merchantHandler:guard\(createG305MerchantPrepaymentMutationFence\(\{/);
 assert.match(runtime,/merchantHandler:createG175SovereignBuyerCommerceFence\(\{merchantHandler:merchantMutations\}\)/);
});
test('HTTP loopback does not invoke original merchant prep without a verified payment',async()=>{
 const x=fixture();
 const noop=async()=>({status:404,body:{error:'not available'}});
 const server=createQoreRadarLoopbackTransport({
  riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
  deliveryHandler:noop,merchantHandler:x.handler,financeHandler:noop,
  safetyHandler:noop,merchantManagementHandler:noop,deliveryOfferHandler:noop
 });
 const origin=await listenQoreRadarLoopback(server);
 try{
  const response=await fetch(origin+route(),{method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({event:'ready',eventKey:event})});
  assert.equal(response.status,409);
  const body=await response.json();
  assert.equal(body.code,'G305_MERCHANT_PREPAYMENT_ATOMIC_GATE_NOT_CERTIFIED');
  assert.equal(x.seen.length,0);
 }finally{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
