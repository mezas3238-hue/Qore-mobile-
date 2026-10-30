import test from 'node:test';
import assert from 'node:assert/strict';
import {validateHistoricalQaProgress} from './g226-historical-qa-progress-contract.mjs';
const UUID=i=>'a2260000-0000-4226-8226-'+String(i).padStart(12,'0');
function delivery(){
 const source={serviceKind:'DELIVERY_AUTO',originalServiceId:UUID(1),
  originalRequestKey:UUID(2),status:'requested'};
 const state={state:'delivered',revision:4};
 const steps=Object.fromEntries([
  'originalBookingPersisted','priceConsented','courierAccepted','courierPickedUp',
  'courierDelivered','independentRecipientConfirmed','originalAdminRead'
 ].map(x=>[x,true]));
 const admin={mode:'STAGING_DEMO_ONLY',serverPersisted:true,
  productionEnabled:false,serviceKind:'DELIVERY_AUTO',serviceId:source.originalServiceId,
  bookingRequestKey:source.originalRequestKey,status:'delivered',
  assignment:{state:'QA_COMPLETED',legalGate:'EXTERNAL_NOT_CERTIFIED'},
  events:['requested','accepted','picked_up','delivered'].map(status=>({status}))};
 return {source,state,steps,admin};
}
test('G226 accepts same historical cargo ID advancing from requested to delivered',()=>{
 const x=delivery();assert.equal(validateHistoricalQaProgress(...Object.values(x)),true);
});
test('G226 rejects fake recipient, booking substitution, disabled legal and missing event',()=>{
 for(const alter of [
  x=>x.state.state='accepted',
  x=>x.state.revision=3,
  x=>x.steps.independentRecipientConfirmed=false,
  x=>x.steps.courierDelivered=false,
  x=>x.admin.bookingRequestKey=UUID(77),
  x=>x.admin.productionEnabled=true,
  x=>x.admin.assignment.legalGate='CLEARED',
  x=>x.admin.events.splice(1,1)
 ]){const x=delivery();alter(x);
  assert.throws(()=>validateHistoricalQaProgress(...Object.values(x)));}
});
test('G226 leaves original non-assignable passenger sources closed to fake resurrection',()=>{
 const x=delivery();
 x.source.serviceKind='MOTO_RIDE';x.source.status='cancelled';
 x.state.state='completed';
 x.admin.serviceKind='MOTO_RIDE';x.admin.status='completed';
 x.steps.driverAccepted=true;x.steps.driverCompleted=true;
 assert.throws(()=>validateHistoricalQaProgress(...Object.values(x)));
});
test('G226 Commerce is still ready, but needs original Admin and G38 blocked',()=>{
 const x=delivery();
 x.source.serviceKind='COMMERCE';x.source.status='ready';
 x.state.state='ready';x.admin.status='ready';x.admin.serviceKind='COMMERCE';
 x.steps={courierDelivered:true,independentRecipientConfirmed:true};
 x.admin.assignment.legalGate='G38_BLOCKED';
 assert.equal(validateHistoricalQaProgress(...Object.values(x)),true);
 x.admin.assignment.legalGate='CLEARED';
 assert.throws(()=>validateHistoricalQaProgress(...Object.values(x)));
});
