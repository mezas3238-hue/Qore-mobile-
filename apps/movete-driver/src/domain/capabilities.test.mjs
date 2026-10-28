import test from 'node:test';
import assert from 'node:assert/strict';
import {AUDIENCE,LIVE_OPERATIONS_ENABLED,CAPABILITIES,canUseDriverCapability,validateDriverDraft} from './capabilities.mjs';
test('Driver mobile is separate and incapable of passenger-only actions',()=>{
 assert.equal(AUDIENCE,'DRIVER');assert.equal(LIVE_OPERATIONS_ENABLED,false);
 assert.ok(CAPABILITIES.length>=6);
 for(const action of ['client.rides.draft','client.deliveries.draft','admin.reviews.approve','payments.capture'])
  assert.equal(canUseDriverCapability(action),false);
 assert.equal(canUseDriverCapability('driver.offers.preview'),true);
});
test('Driver draft validation stays local and never approves documents',()=>{
 assert.equal(validateDriverDraft({fullName:'Ana Pérez',plate:'ABC123',vehicleKind:'MOTO'}).ok,true);
 assert.equal(validateDriverDraft({fullName:'A',plate:'XX',vehicleKind:'AUTO'}).ok,false);
 assert.equal(validateDriverDraft({fullName:'Ana Pérez',plate:'ABC123',vehicleKind:'MOTO',approved:true}).ok,true);
});
