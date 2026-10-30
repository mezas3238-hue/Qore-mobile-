import assert from 'node:assert/strict';

/**
 * G226: Check a POST-QA readback against the immutable G202/G223 source.
 * Only two initially-requested cargo sources may advance to delivered.
 * Cancelled/open passenger rides must never be resurrected.
 */
export function validateHistoricalQaProgress(source,state,steps,admin){
 const kind=source.serviceKind;
 assert.equal(admin?.mode,'STAGING_DEMO_ONLY');
 assert.equal(admin?.serverPersisted,true);
 assert.equal(admin?.productionEnabled,false);
 assert.equal(admin?.serviceKind,kind);
 assert.equal(admin?.serviceId,source.originalServiceId);
 assert.equal(admin?.bookingRequestKey,source.originalRequestKey);
 assert.equal(admin?.status,state.state);
 if(kind==='COMMERCE'){
  assert.equal(state.state,'ready','G226 merchant order must remain ready');
  assert.equal(source.status,'ready');
  if(steps.courierDelivered&&steps.independentRecipientConfirmed)
   assert.equal(admin?.assignment?.legalGate,'G38_BLOCKED');
  return true;
 }
 if(kind.endsWith('_RIDE')){
  assert.equal(state.state,source.status,
   'G226 cannot revive or replace original non-assignable passenger source');
  assert.equal(steps.driverAccepted,false);
  assert.equal(steps.driverCompleted,false);
  return true;
 }
 assert(kind==='DELIVERY_AUTO'||kind==='DELIVERY_MOTO');
 assert.equal(source.status,'requested');
 assert.equal(state.state,'delivered','G226 delivery must reach terminal state');
 assert.equal(state.revision,4);
 for(const key of [
  'originalBookingPersisted','priceConsented','courierAccepted',
  'courierPickedUp','courierDelivered','independentRecipientConfirmed',
  'originalAdminRead'
 ])assert.equal(steps[key],true,'G226 missing source proof '+kind+' '+key);
 assert.equal(admin?.assignment?.state,'QA_COMPLETED');
 assert.equal(admin?.assignment?.legalGate,'EXTERNAL_NOT_CERTIFIED');
 assert.deepEqual(admin?.events?.map(e=>e.status),
  ['requested','accepted','picked_up','delivered']);
 return true;
}
