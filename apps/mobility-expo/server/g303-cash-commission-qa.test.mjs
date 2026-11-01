import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareCashCommissionQA,prepareCashDebtOffsetQA,
 CASH_LIVE_OPERATIONS_ENABLED,CASH_AUTO_COLLECTION_ENABLED} from './g303-cash-commission-qa.mjs';
const booking='11111111-1111-4111-8111-111111111111';
const customer='22222222-2222-4222-8222-222222222222';
const driver='33333333-3333-4333-8333-333333333333';
const settlement='44444444-4444-4444-8444-444444444444';
const cash=()=>({
 serviceKind:'AUTO_RIDE',bookingId:booking,customerId:customer,driverId:driver,
 fare:{bookingId:booking,serviceKind:'AUTO_RIDE',subtotalPyg:50000,
  tollsPyg:0,totalPyg:50000,commissionBps:2000,commissionPyg:10000,
  driverNetPyg:40000,ruleVersion:'OWNER_VERSION_1',persistedByServer:true},
 completion:{bookingId:booking,status:'COMPLETED',verifiedByServer:true},
 collection:{bookingId:booking,method:'CASH',actualCollectedPyg:50000,
  status:'CONFIRMED',acknowledgement:'TWO_PARTY_CONFIRMED',
  verifiedByServer:true,receiptRef:'cash-ack-001'},
 disputed:false,ownerCommissionPolicyApproved:true
});
const offset=()=>({
 driverId:driver,
 receivable:{driverId:driver,outstandingPyg:10000,
  ledgerVersion:'LEDGER_VERSION_1',verifiedByServer:true,onHold:false},
 digitalEarnings:{driverId:driver,settlementId:settlement,payablePyg:40000,
  fundsAvailable:true,verifiedByServer:true,paymentMethod:'CARD',payoutPending:true},
 policy:{allowAutomaticOffset:true,approvedByOwner:true,version:'OWNER_POLICY_1',
  maxOffsetBps:5000,minimumDriverPayoutPyg:10000}
});
test('Cash Driver holds all bills, only commission owed to platform: Gs 50k / 20%',()=>{
 const r=prepareCashCommissionQA(cash());
 assert.equal(r.ok,true);assert.equal(CASH_LIVE_OPERATIONS_ENABLED,false);
 assert.equal(CASH_AUTO_COLLECTION_ENABLED,false);
 assert.equal(r.platformReceivedCashPyg,0);
 assert.equal(r.driverHoldsPhysicalCashPyg,50000);
 assert.equal(r.driverEconomicNetPyg,40000);
 assert.equal(r.commissionReceivablePyg,10000);
 assert.deepEqual(r.journal.map(x=>x.side),['debit','credit']);
 assert.equal(r.journal[0].amountPyg,r.journal[1].amountPyg);
 assert(!JSON.stringify(r).includes(customer));
});
test('All four mobility modes accept frozen commission not a client-supplied rate',()=>{
 for(const s of ['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO']){
  const x=cash();x.serviceKind=s;x.fare.serviceKind=s;
  assert.equal(prepareCashCommissionQA(x).ok,true,s);
 }
});
test('Cash not confirmed by two parties or adjudication cannot create a Driver debt',()=>{
 for(const changes of [
  {status:'PENDING'},{acknowledgement:'DRIVER_ONLY'},
  {method:'CARD'},{actualCollectedPyg:45000},
  {verifiedByServer:false},{receiptRef:'bad'}]){
  const x=cash();Object.assign(x.collection,changes);
  assert.equal(prepareCashCommissionQA(x).code,'CASH_NOT_VERIFIED_FULLY_PAID');
 }
});
test('Missing trip completion or customer nonpayment holds commission',()=>{
 for(const change of [{status:'CANCELLED'},{status:'IN_PROGRESS'},
  {verifiedByServer:false},{bookingId:customer}]){
  const x=cash();Object.assign(x.completion,change);
  assert.equal(prepareCashCommissionQA(x).code,'TRIP_NOT_COMPLETED');
 }
 const y=cash();y.disputed=true;assert.equal(prepareCashCommissionQA(y).code,'CASH_DISPUTED_HOLD');
});
test('No auto-assigned tariff; overcharging toll and illegal commission is denied',()=>{
 for(const tweak of [
  x=>x.fare.persistedByServer=false,x=>x.ownerCommissionPolicyApproved=false,
  x=>x.fare.commissionBps=2500,x=>x.fare.commissionPyg=15000,
  x=>x.fare.driverNetPyg=39999,x=>x.fare.ruleVersion='',
  x=>x.fare.totalPyg=45000]){
  const x=cash();tweak(x);
  assert.equal(prepareCashCommissionQA(x).ok,false);
 }
 const y=cash();y.fare.tollsPyg=5000;y.fare.totalPyg=55000;
 y.fare.driverNetPyg=45000;y.collection.actualCollectedPyg=55000;
 const r=prepareCashCommissionQA(y);assert.equal(r.ok,true);
 assert.equal(r.commissionReceivablePyg,10000);
});
test('Reject unexpected identity/KYC/card fields from cash receipt',()=>{
 const x=cash();x.collection.bankAccount='123-456';
 assert.equal(prepareCashCommissionQA(x).ok,false);
 const y=cash();y.jwt='secret';
 assert.equal(prepareCashCommissionQA(y).ok,false);
});
test('Digital payout can pay commission debt automatically, rest goes to Driver',()=>{
 const r=prepareCashDebtOffsetQA(offset());
 assert.equal(r.ok,true);assert.equal(r.offsetPyg,10000);
 assert.equal(r.driverPayoutPyg,30000);assert.equal(r.cashDebtRemainingPyg,0);
 assert.equal(r.transferSubmitted,false);
 assert.equal(r.debitedFromBank,false);
 assert.equal(r.journal[0].amountPyg,r.journal[1].amountPyg);
});
test('Only available digital Driver earnings can be offset: never negative payout',()=>{
 const x=offset();x.receivable.outstandingPyg=70000;
 const r=prepareCashDebtOffsetQA(x);
 assert.equal(r.ok,true);assert.equal(r.offsetPyg,20000);
 assert.equal(r.driverPayoutPyg,20000);assert.equal(r.cashDebtRemainingPyg,50000);
 const y=offset();y.receivable.outstandingPyg=0;
 const z=prepareCashDebtOffsetQA(y);
 assert.equal(z.offsetPyg,0);assert.equal(z.driverPayoutPyg,40000);
});
test('Disputed debts, not-funded payout and missing Owner policy cannot offset',()=>{
 for(const f of [
  x=>x.receivable.onHold=true,x=>x.receivable.verifiedByServer=false,
  x=>x.digitalEarnings.fundsAvailable=false,x=>x.digitalEarnings.payoutPending=false,
  x=>x.digitalEarnings.driverId=customer,x=>x.policy.allowAutomaticOffset=false,
  x=>x.policy.approvedByOwner=false,x=>x.digitalEarnings.paymentMethod='CASH',
  x=>x.policy.maxOffsetBps=20000,x=>x.policy.minimumDriverPayoutPyg=-5
 ]){
  const x=offset();f(x);
  assert.equal(prepareCashDebtOffsetQA(x).ok,false);
 }
});
test('Owner may require minimum next payout even when debt is high',()=>{
 const x=offset();x.receivable.outstandingPyg=70000;
 x.policy.minimumDriverPayoutPyg=35000;
 const r=prepareCashDebtOffsetQA(x);
 assert.equal(r.ok,true);assert.equal(r.offsetPyg,5000);
 assert.equal(r.driverPayoutPyg,35000);
 assert.equal(r.cashDebtRemainingPyg,65000);
});
test('Offset reference is bound to specific digital settlement, not a bank debit',()=>{
 const a=prepareCashDebtOffsetQA(offset()),b=prepareCashDebtOffsetQA(offset());
 assert.equal(a.idempotencyKey,'CASH_OFFSET:'+settlement);
 assert.equal(a.idempotencyKey,b.idempotencyKey);
 assert.equal(a.payoutConfirmed,false);
 assert.equal(a.liveOperationsEnabled,false);
});
