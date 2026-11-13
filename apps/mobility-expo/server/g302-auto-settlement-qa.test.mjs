import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareAutomaticPayoutLedgerQA,verifyAutomaticPayoutBalance,
 G302_LIVE_PAYMENTS_ENABLED,G302_LIVE_PAYOUTS_ENABLED}
 from './g302-auto-settlement-qa.mjs';
const id='12345678-1234-4234-8234-123456789abc';
const customer='11111111-1111-4111-8111-111111111111';
const driver='22222222-2222-4222-8222-222222222222';
function fixture(){
 return {
  serviceKind:'AUTO_RIDE',bookingId:id,customerId:customer,driverId:driver,
  quote:{bookingId:id,serviceKind:'AUTO_RIDE',totalPyg:50000,
   subtotalPyg:50000,tollsPyg:0,commissionBps:2000,commissionPyg:10000,
   providerPyg:40000,ruleVersion:'G265_OWNER_POLICY_1',serverPersisted:true},
  payment:{bookingId:id,payerId:customer,status:'SETTLED',method:'CARD',
   currency:'PYG',amountPyg:50000,provider:'STAGING_PSP_SIMULATOR',
   captureReference:'capture-test-0001',webhookEventId:'evt-test-0001',
   verifiedByTrustedServer:true,fundsAvailable:true},
  completion:{bookingId:id,serviceKind:'AUTO_RIDE',status:'COMPLETED',
   verifiedByServer:true},
  beneficiary:{driverId:driver,destinationReference:'sandbox-bank-token-001',
   verifiedByServer:true,payoutsApproved:true,documentClearanceApproved:true},
  processorFeePyg:1200,disputeHold:false
 };
}
const run=prepareAutomaticPayoutLedgerQA;
test('balanced QA split, no real charges, payout or financial credentials',()=>{
 const r=run(fixture());
 assert.equal(G302_LIVE_PAYMENTS_ENABLED,false);
 assert.equal(G302_LIVE_PAYOUTS_ENABLED,false);
 assert.equal(r.ok,true);assert.equal(r.capturedPyg,50000);
 assert.equal(r.driverNetPyg,40000);
 assert.equal(r.commissionGrossPyg,10000);
 assert.equal(r.processorFeePyg,1200);
 assert.equal(r.platformRetainsNetPyg,8800);
 assert.equal(r.payoutTransmitted,false);
 assert.equal(r.payoutConfirmed,false);
 assert.equal(verifyAutomaticPayoutBalance(r.entries),true);
 assert.equal(r.entries.reduce((a,x)=>a+(x.side==='debit'?x.amountPyg:-x.amountPyg),0),0);
 assert.equal(JSON.stringify(r).includes('sandbox-bank-token-001'),false);
 assert.equal(JSON.stringify(r).includes('customerId'),false);
});
test('four mobility services share owner-configured rates, no hardcoded defaults',()=>{
 for(const kind of ['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO']){
  const x=fixture();x.serviceKind=kind;x.quote.serviceKind=kind;
  x.completion.serviceKind=kind;
  assert.equal(run(x).ok,true,kind);
 }
});
test('tolls pass through, platform commission only on persisted subtotal',()=>{
 const x=fixture();
 x.quote.totalPyg=55000;x.quote.tollsPyg=5000;x.quote.providerPyg=45000;
 x.payment.amountPyg=55000;
 const r=run(x);assert.equal(r.ok,true);assert.equal(r.driverNetPyg,45000);
 assert.equal(r.commissionGrossPyg,10000);
});
test('authorized/captured/unsettled/simulated cash/unsigned provider cannot pay',()=>{
 for(const change of [
  {status:'AUTHORIZED'},{status:'CAPTURED'}, {fundsAvailable:false},
  {verifiedByTrustedServer:false}, {currency:'USD'},
  {method:'SIMULATED_CASH'}, {amountPyg:49999},
  {payerId:driver},{bookingId:driver}
 ]){
  const x=fixture();Object.assign(x.payment,change);
  assert.equal(run(x).code,'PROVIDER_FUNDS_NOT_CONFIRMED');
 }
});
test('trip must be completed; cancellations and disputes prevent settlement',()=>{
 for(const change of [
  {status:'IN_PROGRESS'},{status:'CANCELLED'},
  {verifiedByServer:false},{bookingId:customer}
 ]){
  const x=fixture();Object.assign(x.completion,change);
  assert.equal(run(x).code,'SERVICE_NOT_VERIFIED_COMPLETE');
 }
 const x=fixture();x.disputeHold=true;
 assert.equal(run(x).code,'DISPUTE_OR_REFUND_HOLD');
});
test('unverified driver, payout route or KYC cannot receive funds',()=>{
 for(const change of [
  {driverId:customer},{verifiedByServer:false},{payoutsApproved:false},
  {documentClearanceApproved:false},{destinationReference:'../../bad'}
 ]){
  const x=fixture();Object.assign(x.beneficiary,change);
  assert.equal(run(x).ok,false);
 }
});
test('rejects user-authored fares, invalid commission and unsupported merchants',()=>{
 for(const change of [
  x=>x.quote.serverPersisted=false,
  x=>x.quote.commissionBps=1000,
  x=>x.quote.providerPyg=49999,
  x=>x.quote.commissionPyg=9999,
  x=>x.quote.ruleVersion='',
  x=>x.quote.subtotalPyg=51000,
  x=>x.quote.serviceKind='MOTO_RIDE'
 ]){
  const x=fixture();change(x);
  assert.equal(run(x).code,'SERVER_FARE_NOT_VERIFIED');
 }
 const x=fixture();x.serviceKind='COMMERCE';
 assert.equal(run(x).code,'INVALID_ACTORS_OR_SERVICE');
});
test('processor cost never gets silently subtracted from Driver earnings',()=>{
 for(const fee of [-1,10001,0.25,Infinity]){
  const x=fixture();x.processorFeePyg=fee;
  assert.equal(run(x).code,'PROCESSING_FEE_NOT_COVERED');
 }
 const x=fixture();x.processorFeePyg=10000;
 const r=run(x);assert.equal(r.ok,true);assert.equal(r.driverNetPyg,40000);
 assert.equal(r.platformRetainsNetPyg,0);
});
test('strict receipt shape rejects appended card data or arbitrary tokens',()=>{
 const x=fixture();x.payment.cardNumber='4111111111111111';
 assert.equal(run(x).code,'PROVIDER_FUNDS_NOT_CONFIRMED');
 const y=fixture();y.accessToken='123';
 assert.equal(run(y).code,'INVALID_SETTLEMENT_CONTRACT');
});
test('idempotency binding is deterministic, never itself evidence of payout',()=>{
 const a=run(fixture()),b=run(fixture());
 assert.equal(a.ok,true);assert.equal(b.ok,true);
 assert.equal(a.idempotencyKey,'AUTO_RIDE:'+id);
 assert.equal(a.idempotencyKey,b.idempotencyKey);
 assert.equal(a.payoutConfirmed,false);
});
