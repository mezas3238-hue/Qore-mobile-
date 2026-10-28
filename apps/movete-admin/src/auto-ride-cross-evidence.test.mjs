import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectAutoRideCrossEvidence as check}
 from './auto-ride-cross-evidence.mjs';
const id=n=>'d0000000-0000-4000-8000-'+String(n).padStart(12,'0');
const now=1800000000000;
const trace={serviceKind:'AUTO_RIDE',serviceId:id(1),
 bookingRequestKey:id(2),quoteId:id(3),status:'assigned',revision:2,
 observedAt:now-1000,expiresAt:now+20000,
 assignment:{state:'ASSIGNED',legalGate:'CLEARED'},
 ledger:null,qaOnly:true,productionEnabled:false,
 serverPersistedReported:true};
const f1={tripId:id(1),bookingRequestKey:id(2),quoteId:id(3),
 status:'assigned',revision:2,observedAt:now-1500,
 expiresAt:now+20000,assignmentPersisted:true,amountGs:30000,
 currency:'PYG',qaOnly:true,productionEnabled:false};
const fixture=(t=trace,f=f1)=>check({trace:t,f1:f,now});
test('D independent Admin reads linked by same F1 tripId/quote/book cannot certify settlement yet',()=>{
 const result=fixture();
 assert.deepEqual(result,{ok:true,code:'CROSS_LINKED_PENDING_SETTLEMENT',
  financiallyReconciled:false});
 assert.equal(JSON.stringify(result).includes('Bearer'),false);
});
test('D refuses cross-service spoof, wrong quote or booking ID, or different trip',()=>{
 for(const bad of [{...trace,serviceKind:'MOTO_RIDE'},
  {...trace,serviceId:id(9)},{...trace,quoteId:id(8)},
  {...trace,bookingRequestKey:id(7)}]){
  assert.equal(fixture(bad).ok,false);
 }
});
test('D invalidates divergent trip state or assignment even with matching UUID',()=>{
 for(const bad of [{...trace,status:'completed'},
  {...trace,assignment:{state:'UNASSIGNED',legalGate:'CLEARED'}},
  {...trace,assignment:{state:'ASSIGNED',legalGate:'G38_BLOCKED'}}]){
  assert.equal(fixture(bad).ok,false);
 }
 assert.equal(fixture(trace,{...f1,assignmentPersisted:false}).ok,false);
});
test('D refuses stale, future, LIVE or client-invented receipts',()=>{
 for(const bad of [{...trace,expiresAt:now-1},
  {...trace,observedAt:now+2000},{...trace,qaOnly:false},
  {...trace,productionEnabled:true},{...trace,serverPersistedReported:false}]){
  assert.equal(fixture(bad).ok,false);
 }
 assert.equal(fixture(trace,{...f1,expiresAt:now-1}).ok,false);
 assert.equal(fixture(trace,{...f1,productionEnabled:true}).ok,false);
});
test('D finished trip requires matching verified PYG amount and reconciled ledger',()=>{
 const completed={...trace,status:'completed',revision:5,
  assignment:{state:'CLOSED',legalGate:'CLEARED'},
  ledger:{serviceId:id(1),currency:'PYG',grossGs:30000,
   platformCommissionGs:4500,customerSubsidyGs:3000,
   driverPayoutGs:25500,reconciliationStatus:'RECONCILED'}};
 const final={...f1,status:'completed',revision:5};
 assert.deepEqual(fixture(completed,final),{
  ok:true,code:'CROSS_LINKED_RECONCILED_RECEIPTS',
  financiallyReconciled:true});
 assert.equal(fixture({...completed,ledger:null},final).code,
  'CROSS_LEDGER_NOT_RECONCILED');
 assert.equal(fixture({...completed,ledger:{...completed.ledger,grossGs:35000}},final).code,
  'CROSS_FARE_LEDGER_MISMATCH');
 assert.equal(fixture({...completed,ledger:{...completed.ledger,
  reconciliationStatus:'PENDING'}},final).ok,false);
});
test('D never says a searching trip or cancelled trip has financial settlement',()=>{
 assert.equal(fixture({...trace,status:'searching',assignment:{
  state:'UNASSIGNED',legalGate:'CLEARED'}},{...f1,status:'searching',
  assignmentPersisted:false}).financiallyReconciled,false);
 assert.equal(fixture({...trace,status:'cancelled',
  assignment:{state:'CLOSED',legalGate:'CLEARED'}},
  {...f1,status:'cancelled'}).financiallyReconciled,false);
});
