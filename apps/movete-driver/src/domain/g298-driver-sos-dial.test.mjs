import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTrustedNumber,planDriverSosDial,SOS_DESTINATIONS} from './g298-driver-sos-dial.mjs';
test('G298 emergency number always goes to system dialer regardless of stored contact',()=>{
 for(const stored of [null,'','+595981123456','unsafe;tel:xyz']){
  assert.deepEqual(planDriverSosDial(SOS_DESTINATIONS.EMERGENCY_911,stored),{
   destination:'EMERGENCY_911',uri:'tel:911',number:'911',
   requiresSystemConfirmation:true
  });
 }
});
test('G298 trusted contact supports Paraguay, international and human separators',()=>{
 assert.equal(normalizeTrustedNumber('0981 123 456'),'0981123456');
 assert.equal(normalizeTrustedNumber('+595 (981) 123-456'),'+595981123456');
 assert.equal(planDriverSosDial('TRUSTED_CONTACT','0981 123 456')?.uri,'tel:0981123456');
});
test('G298 rejects injection, URI schemes, incomplete and unsafe number formats',()=>{
 for(const value of ['',null,undefined,'911','112','tel:911','*123#','+595;123',
   '0981,222222','abc12345678','+595%0A911','+595/777777','++59598112345',
   '+595 981 123 456;extension=1','1234','0'.repeat(25),{},
   '  +595\n911911', '💥0981123456']){
  assert.equal(normalizeTrustedNumber(value),null,JSON.stringify(value));
  assert.equal(planDriverSosDial(SOS_DESTINATIONS.TRUSTED_CONTACT,value),null);
 }
 assert.equal(planDriverSosDial('UNAUTHORIZED','0981123456'),null);
});
test('G298 plan only prepares phone UI, never claims call connected or alert delivered',()=>{
 const plan=planDriverSosDial('TRUSTED_CONTACT','0981123456');
 assert.equal(plan.requiresSystemConfirmation,true);
 for(const key of ['connected','externalResponseDispatched','operatorAcknowledged','passengerId','identityReceiptId'])
  assert.equal(Object.hasOwn(plan,key),false);
 assert.equal(plan.uri,'tel:0981123456');
});
