import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyThreeCompleted} from './g225-five-committed-qa-journeys-pg-ci.mjs';
function fixture(){
 const ids=Array.from({length:5},(_,i)=>
  'a2250000-0000-4225-8225-'+String(i+1).padStart(12,'0'));
 const keys=Array.from({length:5},(_,i)=>
  'b2250000-0000-4225-8225-'+String(i+1).padStart(12,'0'));
 const sources=['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE']
 .map((kind,i)=>({serviceKind:kind,originalServiceId:ids[i],
  originalRequestKey:keys[i],status:kind==='COMMERCE'?'ready':'requested',
  linkedCommerceDeliveryId:i===4?
   'c2250000-0000-4225-8225-000000000001':null}));
 const cargoRows=sources.slice(2,4).map(x=>({
  serviceKind:x.serviceKind,originalServiceId:x.originalServiceId,
  originalRequestKey:x.originalRequestKey,
  simulatedOfferAuthority:'SYNTHETIC_QA_ONLY_NO_LEGAL_PROOF',
  productionEnabled:false
 }));
 const cargoProofs=cargoRows.map(x=>({
  serviceKind:x.serviceKind,serviceId:x.originalServiceId,
  bookingRequestKey:x.originalRequestKey,status:'delivered',
  revision:4,serverPersisted:true,productionEnabled:false,
  assignment:{state:'QA_COMPLETED',legalGate:'EXTERNAL_NOT_CERTIFIED'},
  ledger:null,events:['requested','accepted','picked_up','delivered']
   .map(status=>({status}))
 }));
 const commerceRows=[{originalOrderId:ids[4],
  originalOrderRequestKey:keys[4],
  originalDeliveryId:sources[4].linkedCommerceDeliveryId,
  originalDeliveryRequestKey:'d2250000-0000-4225-8225-000000000001',
  simulatedOfferAuthority:'SYNTHETIC_QA_ONLY_NO_LEGAL_PROOF',
  productionEnabled:false}];
 const commerceProof={serviceId:ids[4],bookingRequestKey:keys[4],
  deliveryId:commerceRows[0].originalDeliveryId,
  status:'ready',revision:5,serverPersisted:true,productionEnabled:false,
  assignment:{state:'NOT_ASSIGNABLE',legalGate:'G38_BLOCKED'},ledger:null};
 const linkedCargoProof={serviceKind:'DELIVERY_MOTO',
  serviceId:commerceRows[0].originalDeliveryId,
  bookingRequestKey:commerceRows[0].originalDeliveryRequestKey,
  status:'delivered',revision:4,productionEnabled:false,
  assignment:{state:'QA_COMPLETED'},
  events:['requested','accepted','picked_up','delivered']
  .map(status=>({status}))};
 const guard={db:'qore_disposable_chain',app:'qore_ci_disposable_chain',
  g38Auto:true,g38Delivery:true,deliveryTriggersDisabled:0,
  authorizedSyntheticZones:0,municipalMotoAuthorized:0,
  authenticatedCanRead:false};
 const rides=[{serviceKind:'AUTO_RIDE',originalTripId:ids[0]},
  {serviceKind:'MOTO_RIDE',originalTripId:ids[1]}];
 return {sources,cargoRows,commerceRows,cargoProofs,commerceProof,
  linkedCargoProof,guard,rides};
}
test('G225 five distinct QA bookings, 3 historical cargo-commerce, 2 fresh rides',()=>{
 const x=fixture();assert.equal(verifyThreeCompleted(x),true);
});
test('G225 rejects courier proof substituted for independent recipient receipt',()=>{
 for(const modify of [
  x=>x.cargoProofs[0].status='picked_up',
  x=>x.cargoProofs[1].events.pop(),
  x=>x.cargoProofs[1].ledger={reconciliationStatus:'SETTLED'},
  x=>x.cargoRows[0].originalServiceId=x.rides[0].originalTripId,
  x=>x.commerceRows[0].originalDeliveryId=x.cargoRows[0].originalServiceId,
  x=>x.commerceProof.assignment.legalGate='CLEARED',
  x=>x.linkedCargoProof.status='accepted',
  x=>x.linkedCargoProof.events.splice(1,1),
  x=>x.cargoRows[0].simulatedOfferAuthority='REAL_MUNICIPAL_LICENSE'
 ]){const x=fixture();modify(x);assert.throws(()=>verifyThreeCompleted(x));}
});
test('G225 rejects inactive legal fences, public receipt privileges and LIVE',()=>{
 for(const modify of [
  x=>x.guard.g38Auto=false,
  x=>x.guard.g38Delivery=false,
  x=>x.guard.deliveryTriggersDisabled=1,
  x=>x.guard.authorizedSyntheticZones=1,
  x=>x.guard.municipalMotoAuthorized=1,
  x=>x.guard.authenticatedCanRead=true,
  x=>x.guard.db='live',
  x=>x.commerceRows[0].productionEnabled=true,
  x=>x.cargoRows[1].productionEnabled=true
 ]){const x=fixture();modify(x);assert.throws(()=>verifyThreeCompleted(x));}
});
