import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTrustedNumber,planDriverSosDial,SOS_DESTINATIONS,normalizeStoredSosPreference} from './g298-driver-sos-dial.mjs';
test('G298 emergency always hands off to system dialer, never calls 911 via ACTION_CALL',()=>{
 for(const stored of [null,'','+595981123456','unsafe;tel:xyz']){
  assert.deepEqual(planDriverSosDial(SOS_DESTINATIONS.EMERGENCY_911,stored),{
   destination:'EMERGENCY_911',uri:'tel:911',number:'911',
   intentAction:'android.intent.action.DIAL',needsCallPermission:false,
   requiresSystemConfirmation:true,mayOverlayMap:true
  });
 }
});
test('G298 saved trusted contact can be called directly only with runtime CALL_PHONE permission',()=>{
 assert.equal(normalizeTrustedNumber('0981 123 456'),'0981123456');
 assert.equal(normalizeTrustedNumber('+595 (981) 123-456'),'+595981123456');
 assert.deepEqual(planDriverSosDial('TRUSTED_CONTACT','0981 123 456'),{
   destination:'TRUSTED_CONTACT',uri:'tel:0981123456',number:'0981123456',
   intentAction:'android.intent.action.CALL',needsCallPermission:true,
   requiresSystemConfirmation:false,mayOverlayMap:true
 });
});
test('G298 rejects injection, arbitrary URI, incomplete or illegal numbers',()=>{
 for(const value of ['',null,undefined,'911','112','tel:911','*123#','+595;123',
   '0981,222222','abc12345678','+595%0A911','+595/777777','++59598112345',
   '+595 981 123 456;extension=1','1234','0'.repeat(25),{},
   '  +595\n911911', '💥0981123456']){
  assert.equal(normalizeTrustedNumber(value),null,JSON.stringify(value));
  assert.equal(planDriverSosDial(SOS_DESTINATIONS.TRUSTED_CONTACT,value),null);
 }
 assert.equal(planDriverSosDial('UNAUTHORIZED','0981123456'),null);
});
test('G298 never claims telephone connection, operator acknowledgment or map visibility',()=>{
 const plan=planDriverSosDial('TRUSTED_CONTACT','0981123456');
 for(const key of ['connected','externalResponseDispatched','operatorAcknowledged',
   'passengerId','identityReceiptId','mapRemainsVisible'])
  assert.equal(Object.hasOwn(plan,key),false);
 assert.equal(plan.mayOverlayMap,true);
});

test('G299 SOS defaults OFF even if previous version saved an emergency or contact',()=>{
 for(const input of [
  undefined,null,[],{}, {destination:'EMERGENCY_911'},
  {destination:'TRUSTED_CONTACT',trustedNumber:'0981123456'},
  {enabled:'true',destination:'EMERGENCY_911'},
  {enabled:1,destination:'EMERGENCY_911'},
  {enabled:false,destination:'EMERGENCY_911'}
 ]){
  const normalized=normalizeStoredSosPreference(input);
  assert.equal(normalized.enabled,false,JSON.stringify(input));
 }
});
test('G299 only explicit opt-in true reveals SOS for a valid destination',()=>{
 assert.deepEqual(normalizeStoredSosPreference({
  enabled:true,destination:'EMERGENCY_911',trustedNumber:'untrusted'
 }),{enabled:true,destination:'EMERGENCY_911',trustedNumber:''});
 assert.deepEqual(normalizeStoredSosPreference({
  enabled:true,destination:'TRUSTED_CONTACT',trustedNumber:'0981 123 456'
 }),{enabled:true,destination:'TRUSTED_CONTACT',trustedNumber:'0981123456'});
});
test('G299 corrupt trusted number or unknown destination cannot activate SOS',()=>{
 for(const input of [
  {enabled:true,destination:'TRUSTED_CONTACT',trustedNumber:'bad'},
  {enabled:true,destination:'TRUSTED_CONTACT',trustedNumber:'tel:911'},
  {enabled:true,destination:'INJECT',trustedNumber:'0981123456'}
 ]){
  assert.equal(normalizeStoredSosPreference(input).enabled,false);
 }
});
test('G299 disabled choice can retain safe trusted number for a later explicit opt-in',()=>{
 assert.deepEqual(normalizeStoredSosPreference({
  enabled:false,destination:'TRUSTED_CONTACT',trustedNumber:'+595 981 123 456'
 }),{
  enabled:false,destination:'TRUSTED_CONTACT',trustedNumber:'+595981123456'
 });
});
