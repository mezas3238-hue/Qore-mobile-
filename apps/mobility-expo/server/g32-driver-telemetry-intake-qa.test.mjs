import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreG32TelemetryIntakeQa} from './g32-driver-telemetry-intake-qa.mjs';
const at=Date.parse('2026-10-23T12:00:00Z');
const driverId='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const zoneId='33333333-3333-4333-8333-333333333333';
const eventId='44444444-4444-4444-8444-444444444444';
const token='verifiedSyntheticDriverBearer12345678912345678';
const packet=()=>({eventId,sequence:7,capturedAtMs:at-1000,
 location:{lat:-25.3,lng:-57.6,accuracyMeters:10}});
const headers={authorization:'Bearer '+token};
function fixture(extra={}){
 const state={calls:[],commits:[]};
 const opt={
  environment:'isolated_staging',liveEnabled:false,localQaOnly:true,now:()=>at,
  verifyDriverAccessToken:async()=>{state.calls.push('jwt');return {
   id:driverId,role:'driver',revoked:false,sessionId:'qa-session-001',
   verifiedByProvider:true,expiresAtMs:at+600000};},
  allowRequest:async()=>{state.calls.push('rate');return true;},
  loadLocationConsent:async()=>{state.calls.push('consent');return {
   driverId,verifiedByServer:true,active:true,revision:3,
   optedInAtMs:at-100000,revokedAtMs:null};},
  verifyLocationIntegrity:async()=>{state.calls.push('integrity');return {
   driverId,eventId,accepted:true,verifiedByServer:true,checkedAtMs:at-100};},
  resolveVerifiedGeofence:async()=>{state.calls.push('geo');return {
   driverId,zoneId,countryCode:'PY',geometryRevision:8,
   verifiedByServer:true,verifiedAtMs:at-100};},
  verifyDriverEligibility:async()=>{state.calls.push('eligibility');return {
   driverId,zoneId,serviceKind:'AUTO_DELIVERY',eligible:true,
   verifiedByServer:true,checkedAtMs:at-100};},
  commitQuarantinedSignal:async d=>{state.calls.push('commit');
   state.commits.push(d);return {persisted:true,eventId:d.eventId};},
  ...extra
 };
 const g=createQoreG32TelemetryIntakeQa(opt);
 return {state,send:(body=packet(),hdr=headers)=>g({
  method:'POST',headers:hdr,packet:body
 }),g};
}
test('G32 server controls actor/zone, commits quarantine only after seven gates',async()=>{
 const f=fixture(),r=await f.send();
 assert.equal(r.status,202);
 assert.equal(r.body.code,'LOCATION_QA_QUARANTINED');
 assert.equal(r.body.availabilityConfirmed,false);
 assert.equal(r.body.dispatchAuthorized,false);
 assert.deepEqual(f.state.calls,['jwt','rate','consent','integrity','geo','eligibility','commit']);
 assert.deepEqual(f.state.commits,[{driverId,eventId,sequence:7,
  capturedAtMs:at-1000,zoneId,serviceKind:'AUTO_DELIVERY',
  consentRevision:3,geometryRevision:8}]);
 assert.ok(!Object.hasOwn(f.state.commits[0],'location'));
});
test('G32 rejects client chosen driver/zone, stale or inaccurate GPS before verification',async()=>{
 const invalid=[
  {...packet(),driverId:other},{...packet(),zoneId},
  {...packet(),serviceKind:'MOTO_DELIVERY'},
  {...packet(),location:{...packet().location,driverId:other}},
  {...packet(),location:{lat:91,lng:-57,accuracyMeters:10}},
  {...packet(),location:{lat:-25,lng:-181,accuracyMeters:10}},
  {...packet(),location:{lat:-25,lng:-57,accuracyMeters:55}},
  {...packet(),location:{lat:-25,lng:-57,accuracyMeters:0}},
  {...packet(),capturedAtMs:at-40000},
  {...packet(),capturedAtMs:at+6000},
  {...packet(),sequence:0},{...packet(),sequence:3.4},
  {...packet(),eventId:'bad'},
  {...packet(),location:{lat:NaN,lng:10,accuracyMeters:8}}
 ];
 for(const p of invalid){
  const f=fixture();assert.equal((await f.send(p)).status,400);
  assert.equal(f.state.calls.length,0);
 }
});
test('G32 refuses spoofed JWT, wrong role, expired token and browser cookies',async()=>{
 const base={id:driverId,role:'driver',revoked:false,
  sessionId:'qa-session-001',verifiedByProvider:true,expiresAtMs:at+600000};
 for(const delta of [{role:'passenger'},{revoked:true},
   {verifiedByProvider:false},{expiresAtMs:at},{id:'invalid'}]){
  const f=fixture({verifyDriverAccessToken:async()=>({...base,...delta})});
  assert.equal((await f.send()).status,401);
  assert.equal(f.state.commits.length,0);
 }
 const f=fixture({verifyDriverAccessToken:async()=>{throw Error('revoked');}});
 assert.equal((await f.send()).status,401);
 const h=fixture();
 assert.equal((await h.g({method:'GET',headers,packet:packet()})).status,405);
 assert.equal((await h.send(packet(),{})).status,401);
 assert.equal((await h.send(packet(),{...headers,cookie:'session=1'})).status,403);
 assert.equal((await h.send(packet(),{...headers,origin:'https://evil.example'})).status,403);
});
test('G32 rejects missing/revoked/unverified consent and false integrity proofs',async()=>{
 const good={driverId,verifiedByServer:true,active:true,revision:3,
  optedInAtMs:at-100000,revokedAtMs:null};
 for(const delta of [{active:false},{driverId:other},
  {verifiedByServer:false},{revokedAtMs:at-300},
  {revision:0},{optedInAtMs:at}]){
  const f=fixture({loadLocationConsent:async()=>({...good,...delta})});
  assert.equal((await f.send()).status,403);
  assert.equal(f.state.commits.length,0);
 }
 const truth={driverId,eventId,accepted:true,
  verifiedByServer:true,checkedAtMs:at-100};
 for(const delta of [{accepted:false},{driverId:other},{eventId:other},
  {verifiedByServer:false},{checkedAtMs:at-11000}]){
  const f=fixture({verifyLocationIntegrity:async()=>({...truth,...delta})});
  assert.equal((await f.send()).status,403);
  assert.equal(f.state.commits.length,0);
 }
});
test('G32 geofence identity, country, verification and service eligibility are independent',async()=>{
 const geo={driverId,zoneId,countryCode:'PY',
  geometryRevision:8,verifiedByServer:true,verifiedAtMs:at-100};
 for(const delta of [{driverId:other},{zoneId:other},{countryCode:'AR'},
  {verifiedByServer:false},{geometryRevision:0},{verifiedAtMs:at-12000}]){
  const f=fixture({resolveVerifiedGeofence:async()=>({...geo,...delta})});
  assert.equal((await f.send()).status,403);
  assert.equal(f.state.commits.length,0);
 }
 const eligibility={driverId,zoneId,serviceKind:'AUTO_DELIVERY',
  eligible:true,verifiedByServer:true,checkedAtMs:at-100};
 for(const delta of [{driverId:other},{zoneId:other},{eligible:false},
   {serviceKind:'MOTO_PASAJERO'},{verifiedByServer:false},
   {checkedAtMs:at-12000}]){
  const f=fixture({verifyDriverEligibility:async()=>({...eligibility,...delta})});
  assert.equal((await f.send()).status,403);
  assert.equal(f.state.commits.length,0);
 }
});
test('G32 SQL duplicate, backend outage or missing confirmation never reports acceptance',async()=>{
 assert.equal((await fixture({allowRequest:async()=>false}).send()).status,429);
 assert.equal((await fixture({commitQuarantinedSignal:async()=>{throw Error('replay')}}).send()).status,409);
 assert.equal((await fixture({commitQuarantinedSignal:async()=>({persisted:false})}).send()).status,503);
 for(const name of ['allowRequest','loadLocationConsent',
   'verifyLocationIntegrity','resolveVerifiedGeofence',
   'verifyDriverEligibility']){
  const f=fixture({[name]:async()=>{throw Error('unavailable')}});
  assert.equal((await f.send()).status,503);
  assert.equal(f.state.commits.length,0);
 }
});
test('G32 constructing a network/live deployment or missing any security gate fails',()=>{
 const opt={environment:'isolated_staging',liveEnabled:false,localQaOnly:true,
  verifyDriverAccessToken:async()=>{},loadLocationConsent:async()=>{},
  verifyDriverEligibility:async()=>{},resolveVerifiedGeofence:async()=>{},
  verifyLocationIntegrity:async()=>{},allowRequest:async()=>{},
  commitQuarantinedSignal:async()=>{}};
 for(const delta of [{environment:'production'},{liveEnabled:true},
  {localQaOnly:false},{verifyDriverAccessToken:null},
  {loadLocationConsent:null},{resolveVerifiedGeofence:null},
  {verifyLocationIntegrity:null},{verifyDriverEligibility:null},
  {allowRequest:null},{commitQuarantinedSignal:null}]){
  assert.throws(()=>createQoreG32TelemetryIntakeQa({...opt,...delta}));
 }
});
