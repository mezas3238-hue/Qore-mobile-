import test from 'node:test';
import assert from 'node:assert/strict';
import {createG306CommercePrepayVerifier,
 G306_LIVE_COMMERCE_ENABLED,G306_REAL_PSP_CONNECTED,G306_ORDER_RELEASE_ENABLED}
 from './g306-merchant-prepay-provider-verifier.mjs';
const orderId='11111111-1111-4111-8111-111111111111';
const buyerId='22222222-2222-4222-8222-222222222222';
const merchantId='33333333-3333-4333-8333-333333333333';
const ref='psp-paid-ref-001',time=1783000000000;
function fixture(){
 const calls=[];
 const order={orderId,buyerId,merchantId,merchantSubtotalPyg:100000,
  deliveryFeePyg:15000,totalPyg:115000,quoteVersion:'OWNER_FARE_VERSION_2',
  reservedStock:true,status:'AWAITING_PAYMENT',expiresAtMs:time+900000,
  serverPersisted:true};
 const proof={orderId,buyerId,paymentReference:ref,eventReference:'psp-event-0001',
  provider:'AUTHORIZED_PSP_QA',method:'CARD',status:'CAPTURED',
  amountPyg:115000,currency:'PYG',signedCallbackVerified:true,
  providerLookupVerified:true,refundOrChargeback:false,capturedAtMs:time-10000};
 const verify=createG306CommercePrepayVerifier({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  now:()=>time,
  getOriginalOrder:async p=>{calls.push({stage:'order',input:p});return order;},
  getTrustedProviderReceipt:async p=>{calls.push({stage:'psp',input:p});return proof;}
 });
 return {calls,order,proof,verify};
}
const go=x=>x.verify({orderId,paymentReference:ref});
test('All commerce LIVE/PSP/release flags remain OFF',()=>{
 assert.equal(G306_LIVE_COMMERCE_ENABLED,false);
 assert.equal(G306_REAL_PSP_CONNECTED,false);
 assert.equal(G306_ORDER_RELEASE_ENABLED,false);
 assert.throws(()=>createG306CommercePrepayVerifier({}),/server-only/);
});
test('Valid server order plus independent captured CARD proof yields NON-AUTHORIZING receipt',async()=>{
 const x=fixture();const r=await go(x);
 assert.equal(r.ok,true);assert.equal(r.amountPyg,115000);
 assert.equal(r.method,'CARD');assert.equal(r.status,'CAPTURED');
 assert.equal(r.needsAtomicDatabaseCommit,true);
 assert.equal(r.merchantCanPrepare,false);
 assert.equal(r.merchantCanDispatch,false);
 assert.equal(r.payoutEnabled,false);assert.equal(r.bankTransferExecuted,false);
 assert.deepEqual(x.calls[0],{stage:'order',input:{orderId}});
 assert.deepEqual(x.calls[1].input,{orderId,paymentReference:ref,
  expectedAmountPyg:115000,expectedBuyerId:buyerId});
});
test('A screenshot, bearer, price, method or asserted paid flag in client input rejected',async()=>{
 const x=fixture();
 for(const payload of [
  {orderId,paymentReference:'bad'},
  {orderId,paymentReference:ref,paid:true},
  {orderId,paymentReference:ref,totalPyg:1},
  {orderId,paymentReference:ref,method:'CASH'},
  {orderId,paymentReference:ref,token:'fake_card'}
 ]){
  const r=await x.verify(payload);
  if(payload.paymentReference==='bad')assert.equal(r.code,'INVALID_PREPAYMENT_REFERENCE');
  else assert.equal(r.ok,true,'extra phone fields are ignored, never trusted');
  assert.equal(r.merchantCanPrepare??false,false);
 }
 assert(x.calls.every(row=>!JSON.stringify(row).includes('fake_card')));
});
test('Wrong buyer/order and duplicate fabricated amounts reject provider evidence',async()=>{
 for(const fn of [
  p=>p.buyerId=merchantId,
  p=>p.orderId=buyerId,
  p=>p.amountPyg=114999,
  p=>p.currency='USD',
  p=>p.paymentReference='payment-foreign-001',
  p=>p.provider='no',
  p=>p.eventReference='no'
 ]){
  const x=fixture();fn(x.proof);
  assert.equal((await go(x)).code,'PSP_ATTESTATION_NOT_MATCHED');
 }
});
test('Cash, merely authorized card, pending bank transfer or QR never releases',async()=>{
 for(const pair of [
  ['CASH','SETTLED'],['CARD','AUTHORIZED'],['CARD','FAILED'],
  ['QR','PENDING'],['BANK_TRANSFER','AUTHORIZED']
 ]){
  const x=fixture();[x.proof.method,x.proof.status]=pair;
  assert.equal((await go(x)).code,'PSP_ATTESTATION_NOT_MATCHED');
 }
});
test('QR/Bank transfers require settled funds, not just customer indication',async()=>{
 for(const method of ['QR','BANK_TRANSFER']){
  const x=fixture();x.proof.method=method;x.proof.status='SETTLED';
  const r=await go(x);assert.equal(r.ok,true);
  assert.equal(r.merchantCanPrepare,false);
 }
});
test('Missing callback signature OR provider lookup (or refunds) fail closed',async()=>{
 for(const fn of [
  p=>p.signedCallbackVerified=false,
  p=>p.providerLookupVerified=false,
  p=>p.refundOrChargeback=true,
  p=>p.capturedAtMs=time+70000
 ]){
  const x=fixture();fn(x.proof);
  assert.equal((await go(x)).code,'PSP_ATTESTATION_NOT_MATCHED');
 }
});
test('No reserved stock, expired original order, unverified pricing or canceled order',async()=>{
 for(const fn of [
  o=>o.reservedStock=false,
  o=>o.expiresAtMs=time-1,
  o=>o.merchantSubtotalPyg=90000,
  o=>o.serverPersisted=false,
  o=>o.quoteVersion='bad',
  o=>o.status='cancelled'
 ]){
  const x=fixture();fn(x.order);
  assert.equal((await go(x)).code,'ORIGINAL_ORDER_NOT_PAYABLE');
  assert.equal(x.calls.length,1,'PSP query never runs on a bad original order');
 }
});
test('Provider connectivity errors, mismatched records, unexpected fields fail closed',async()=>{
 const x=fixture();x.proof.cardPan='4111111111111111';
 assert.equal((await go(x)).code,'PSP_ATTESTATION_NOT_MATCHED');
 const y=fixture();y.order.pan='4111111111111111';
 assert.equal((await go(y)).code,'ORIGINAL_ORDER_NOT_PAYABLE');
 const z=createG306CommercePrepayVerifier({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,now:()=>time,
  getOriginalOrder:async()=>fixture().order,
  getTrustedProviderReceipt:async()=>{throw Error('PSP offline');}
 });
 assert.equal((await z({orderId,paymentReference:ref})).code,'PSP_VERIFICATION_UNAVAILABLE');
});
test('Never claim merchant payout or bank settlement from a captured card',async()=>{
 const x=fixture(),a=await go(x),b=await go(x);
 assert.equal(a.ok,true);assert.equal(b.ok,true);
 assert.equal(a.needsAtomicDatabaseCommit,true);
 assert.equal(a.bankTransferExecuted,false);
 assert.equal(a.liveEnabled,false);
 assert.equal(JSON.stringify(a).includes('CARD_NUMBER'),false);
});
