import test from 'node:test';
import assert from 'node:assert/strict';
import {createG262NativeAdminTraceGateway}
 from './g262-native-admin-trace-gateway.mjs';
const USER='26200000-0000-4262-8262-000000000001';
const SESSION='26200000-0000-4262-8262-000000000002';
const ORIGINAL='26200000-0000-4262-8262-000000000003';
const REQUEST='26200000-0000-4262-8262-000000000004';
const ACTOR='26200000-0000-4262-8262-000000000005';
const EVENT='26200000-0000-4262-8262-000000000006';
const NOW=1793448000000;
const TOKEN='independentlyVerifiedStagingAdminBearerToken12345';
const path=(kind='AUTO_RIDE')=>'/v1/staging/admin/native-services/'+kind+'/'+ORIGINAL+'/trace';
const evidence=(kind='AUTO_RIDE')=>({
 mode:'STAGING_DEMO_ONLY',serviceKind:kind,serviceId:ORIGINAL,
 requestKey:REQUEST,viewerId:USER,actorId:ACTOR,
 assignedParticipantOrLinkedDeliveryId:null,status:'searching',revision:1,
 createdAt:'2026-10-31T11:00:00Z',changedAt:'2026-10-31T11:00:00Z',
 events:[{eventId:EVENT,revision:1,status:'searching',at:'2026-10-31T11:00:00Z'}],
 totalEvents:1,eventsTruncated:false,serverPersisted:true,
 financialReconciliationCertified:false,
 externalEndToEndCertified:false,productionEnabled:false
});
const user={id:USER,sessionId:SESSION,is_anonymous:false,
 expiresAtMs:NOW+3600000,email_confirmed_at:'2026-10-30T00:00:00Z'};
function setup(changes={}){
 const calls=[];
 const gw=createG262NativeAdminTraceGateway({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  verifyAccessToken:async token=>{calls.push('auth');assert.equal(token,TOKEN);return user;},
  verifySessionNotRevoked:async()=>{calls.push('G42');return true;},
  loadExclusiveBackofficeRole:async()=>{calls.push('G27');return 'admin';},
  verifyBackofficeMfa:async()=>{calls.push('MFA');return {
   verifiedByProvider:true,userId:USER,sessionId:SESSION,
   assuranceLevel:'aal2',verifiedAtMs:NOW-60000,
   expiresAtMs:NOW+1800000
  };},
  allowRequest:()=>{calls.push('LIMIT');return true;},
  loadNativeTrace:async({viewerId,serviceKind,serviceId})=>{
   calls.push('SQL');
   assert.deepEqual({viewerId,serviceKind,serviceId},
    {viewerId:USER,serviceKind:'AUTO_RIDE',serviceId:ORIGINAL});
   return evidence();
  },
  now:()=>NOW,...changes
 });
 return {gw,calls};
}
const get=(gw,route=path(),token=TOKEN)=>gw({
 method:'GET',path:route,headers:{authorization:'Bearer '+token}
});
test('G262 native provenance returns the SAME original ID only after G42 G27 AAL2',async()=>{
 const {gw,calls}=setup(),r=await get(gw);
 assert.equal(r.status,200);assert.deepEqual(r.body,evidence());
 assert.deepEqual(calls,['auth','G42','G27','MFA','LIMIT','SQL']);
 assert.equal(r.body.financialReconciliationCertified,false);
 assert.equal(r.body.externalEndToEndCertified,false);
});
test('G262 cannot mount in LIVE or without fully supplied Admin authority',()=>{
 for(const diff of [
  {environment:'production'},{qaOnly:false},{liveEnabled:true},
  {verifyBackofficeMfa:null},{loadNativeTrace:null}
 ]){
  assert.throws(()=>setup(diff));
 }
});
test('G262 route is exact and no unauthorized method may query any original',async()=>{
 const {gw,calls}=setup();
 for(const route of [
  path().replace('native-services','production'),
  path().replace(ORIGINAL,'bad'),
  path().replace('AUTO_RIDE','EVIL'),
  path()+'?sort=all'
 ])assert.equal((await get(gw,route)).status,404);
 assert.equal((await gw({method:'POST',path:path()})).status,404);
 assert.equal((await gw({method:'GET',path:path(),body:{}})).status,404);
 assert.equal(calls.length,0);
});
test('G262 requires verified bearer before any provider or SQL',async()=>{
 const {gw,calls}=setup();
 assert.equal((await gw({method:'GET',path:path()})).status,401);
 assert.equal((await gw({method:'GET',path:path(),headers:{authorization:'Bearer bad'}})).status,401);
 assert.equal(calls.length,0);
});
test('G262 revoked session or non-Admin cannot read SQL even if JWT was valid',async()=>{
 for(const [change,status,expected] of [
  [{verifySessionNotRevoked:async()=>false},401,['auth']],
  [{loadExclusiveBackofficeRole:async()=> 'passenger'},403,['auth','G42']],
  [{verifyBackofficeMfa:async()=>({assuranceLevel:'aal1'})},403,['auth','G42','G27']],
  [{allowRequest:()=>false},429,['auth','G42','G27','MFA']]
 ]){
  const {gw,calls}=setup(change);
  const r=await get(gw);
  assert.equal(r.status,status);
  assert.equal(calls.includes('SQL'),false);
  assert.deepEqual(calls.filter(x=>!['G42','G27','MFA'].includes(x)),expected.filter(x=>!['G42','G27','MFA'].includes(x)));
 }
});
test('G262 never turns wrong service ID, partial chronology, or billing claim into success',async()=>{
 const bad=[
  {...evidence(),serviceId:ACTOR},
  {...evidence(),financialReconciliationCertified:true},
  {...evidence(),externalEndToEndCertified:true},
  {...evidence(),totalEvents:0},
  {...evidence(),events:[{...evidence().events[0],revision:0}]},
  {...evidence(),viewerId:ACTOR}
 ];
 for(const data of bad){
  const {gw}=setup({loadNativeTrace:async()=>data});
  assert.equal((await get(gw)).status,503);
 }
});
test('G262 does not expose provider SQL exception or cross-row fields',async()=>{
 const {gw}=setup({loadNativeTrace:async()=>{throw Error('PRIVATE SQL DETAILS')}});
 const r=await get(gw);
 assert.equal(r.status,503);
 assert.equal(JSON.stringify(r).includes('PRIVATE SQL DETAILS'),false);
});
