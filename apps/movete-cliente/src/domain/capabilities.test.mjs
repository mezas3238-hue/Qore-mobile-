import test from 'node:test';
import assert from 'node:assert/strict';
import {AUDIENCE,LIVE_OPERATIONS_ENABLED,CAPABILITIES,canUseClientCapability,validateRideDraft,validateDeliveryDraft} from './capabilities.mjs';
test('Client mobile is separate and cannot approve drivers or accept dispatch',()=>{
 assert.equal(AUDIENCE,'CLIENT');assert.equal(LIVE_OPERATIONS_ENABLED,false);
 assert.ok(CAPABILITIES.length>=5);
 for(const action of ['driver.offers.accept.preview','driver.documents.status','admin.reviews.approve','payments.capture'])
  assert.equal(canUseClientCapability(action),false);
 assert.equal(canUseClientCapability('client.rides.draft'),true);
});
test('Client passenger request rejects unauthorized motorbike rides and bad coordinates',()=>{
 assert.equal(validateRideDraft({pickup:'Centro Asunción',destination:'San Lorenzo',vehicleKind:'AUTO'}).ok,true);
 assert.equal(validateRideDraft({pickup:'Centro Asunción',destination:'San Lorenzo',vehicleKind:'MOTO'}).ok,false);
 assert.equal(validateRideDraft({pickup:'Centro',destination:'Centro',vehicleKind:'AUTO'}).ok,false);
});
test('Client parcel draft keeps moto cargo limited, separated from passenger authorization',()=>{
 assert.equal(validateDeliveryDraft({pickup:'Centro',destination:'Shopping',vehicleKind:'MOTO',grams:1200}).ok,true);
 assert.equal(validateDeliveryDraft({pickup:'Centro',destination:'Shopping',vehicleKind:'MOTO',grams:12000}).ok,false);
 assert.equal(validateDeliveryDraft({pickup:'Centro',destination:'Shopping',vehicleKind:'AUTO',grams:15000}).ok,true);
});
