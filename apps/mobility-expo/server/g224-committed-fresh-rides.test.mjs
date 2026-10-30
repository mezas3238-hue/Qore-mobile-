import test from 'node:test';
import assert from 'node:assert/strict';
import {validateIndependentReceipts} from './g224-committed-fresh-rides-pg-ci.mjs';
function fixture(){
 const names=['AUTO_RIDE','MOTO_RIDE'];
 const rows=names.map((k,i)=>({
  serviceKind:k,
  originalTripId:'a2240000-0000-4224-8224-'+String(i+1).padStart(12,'0'),
  originalBookingKey:'b2240000-0000-4224-8224-'+String(i+1).padStart(12,'0'),
  originalQuoteId:'c2240000-0000-4224-8224-'+String(i+1).padStart(12,'0'),
  originalPassengerId:'d2240000-0000-4224-8224-'+String(i+1).padStart(12,'0'),
  qaDriverId:'e2240000-0000-4224-8224-'+String(i+1).padStart(12,'0'),
  acceptanceAuthority:'SYNTHETIC_QA_ONLY_NO_LEGAL_PROOF',
  productionEnabled:false
 }));
 const receipts=rows.map(s=>({
  serviceKind:s.serviceKind,serviceId:s.originalTripId,
  bookingRequestKey:s.originalBookingKey,quoteId:s.originalQuoteId,
  status:'completed',revision:5,serverPersisted:true,
  mode:'STAGING_DEMO_ONLY',productionEnabled:false,
  assignment:{state:'QA_COMPLETED',legalGate:'EXTERNAL_NOT_CERTIFIED'},
  ledger:{reconciliationStatus:'PENDING'},
  events:['searching','assigned','arriving','in_progress','completed']
   .map(status=>({status}))
 }));
 const originalSources=Array.from({length:5},
  (_,i)=>'f2240000-0000-4224-8224-'+String(i+1).padStart(12,'0'));
 const guard={db:'qore_disposable_chain',app:'qore_ci_disposable_chain',
  g38Auto:true,g38Delivery:true,autoTriggerBypass:0,
  authorizedSyntheticZones:0,municipalAuthorizedMotoZones:0,
  unauthorizedQaTableRead:false};
 return {rows,receipts,originalSources,guard};
}
test('G224 verifies both distinct original passenger IDs with five Admin events',()=>{
 const f=fixture();assert.equal(validateIndependentReceipts(
  f.rows,f.receipts,f.originalSources,f.guard),true);
});
test('G224 rejects fabricated completion, altered ID and skipped steps',()=>{
 for(const mutate of [
  f=>f.receipts[0].status='assigned',
  f=>f.receipts[0].events.splice(2,1),
  f=>f.receipts[1].revision=4,
  f=>f.receipts[1].bookingRequestKey=f.rows[0].originalBookingKey,
  f=>f.rows[1].originalTripId=f.originalSources[1],
  f=>f.rows[0].acceptanceAuthority='CERTIFIED_REAL_SERVER_AUTH_AND_GEOFENCE',
  f=>f.receipts[0].assignment.legalGate='CLEARED',
  f=>f.receipts[1].productionEnabled=true,
  f=>f.receipts[0].ledger.reconciliationStatus='SETTLED'
 ]){const f=fixture();mutate(f);
  assert.throws(()=>validateIndependentReceipts(
   f.rows,f.receipts,f.originalSources,f.guard));
 }
});
test('G224 refuses disabled G38, legal spoofing and QA table privilege',()=>{
 for(const mutate of [
  f=>f.guard.g38Auto=false,
  f=>f.guard.g38Delivery=false,
  f=>f.guard.autoTriggerBypass=1,
  f=>f.guard.authorizedSyntheticZones=1,
  f=>f.guard.municipalAuthorizedMotoZones=1,
  f=>f.guard.unauthorizedQaTableRead=true,
  f=>f.guard.db='production',
  f=>f.originalSources.pop()
 ]){const f=fixture();mutate(f);
  assert.throws(()=>validateIndependentReceipts(
   f.rows,f.receipts,f.originalSources,f.guard));
 }
});
