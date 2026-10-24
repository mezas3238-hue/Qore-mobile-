import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreG32QuarantineRepository} from './g32-driver-telemetry-persistence-qa.mjs';
const driverId='11111111-1111-4111-8111-111111111111';
const eventId='22222222-2222-4222-8222-222222222222';
const zoneId='33333333-3333-4333-8333-333333333333';
const payload={driverId,eventId,sequence:5,
 capturedAtMs:Date.parse('2026-10-23T12:00:00Z'),
 zoneId,serviceKind:'AUTO_DELIVERY',
 consentRevision:2,geometryRevision:9};
test('G32 trusted SQL adapter sends only frozen, scoped 8 params and attests exact stored UUID',async()=>{
 const calls=[];
 const commit=createQoreG32QuarantineRepository({rpc:async(name,args)=>{
  calls.push({name,args});return {data:eventId,error:null};
 }});
 assert.deepEqual(await commit(payload),{persisted:true,eventId});
 assert.deepEqual(calls,[{
  name:'mobility_stage_g32_quarantine_signal',
  args:{_driver:driverId,_event:eventId,_sequence:5,
   _captured_ms:payload.capturedAtMs,_zone:zoneId,
   _service:'AUTO_DELIVERY',_consent_revision:2,_geometry_revision:9}
 }]);
 assert.doesNotMatch(JSON.stringify(calls),/latitude|longitude|accuracyMeters|phone|plate/);
});
test('G32 cannot manufacture quarantine success from missing/mismatched SQL',async()=>{
 for(const output of [null,{}, {data:null,error:null},
  {data:driverId,error:null},{data:eventId,error:{message:'conflict'}}]){
  const commit=createQoreG32QuarantineRepository({rpc:async()=>output});
  await assert.rejects(()=>commit(payload),/rejected signal/);
 }
});
test('G32 invalid service, sequence, actors or revisions reject before SQL call',async()=>{
 let calls=0;
 const commit=createQoreG32QuarantineRepository({rpc:async()=>{
  calls++;return {data:eventId};
 }});
 for(const invalid of [
  {driverId:'bad'}, {eventId:'bad'}, {zoneId:'bad'},
  {sequence:0},{sequence:1.7},{serviceKind:'MOTO_PASAJERO'},
  {consentRevision:0},{geometryRevision:-1},
  {capturedAtMs:NaN}
 ]){
  await assert.rejects(()=>commit({...payload,...invalid}),/Invalid trusted/);
 }
 assert.equal(calls,0);
 assert.throws(()=>createQoreG32QuarantineRepository({rpc:null}),/required/);
});
