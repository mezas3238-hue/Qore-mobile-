import test from 'node:test';
import assert from 'node:assert/strict';
import {createG263NativeAdminReader} from './g263-native-admin-trace-reader.mjs';
const NOW=1793448000000;
const HOST='https://qore-mobile-backend-staging-staging.up.railway.app';
const USER='26300000-0000-4263-8263-000000000001';
const ID='26300000-0000-4263-8263-000000000002';
const REQUEST='26300000-0000-4263-8263-000000000003';
const EVENT='26300000-0000-4263-8263-000000000004';
const TOKEN='fake-Admin-browser-only-not-real-verified-staging';
const session={role:'admin',subject:USER,mfaVerified:true,
 expiresAt:NOW+3600000,token:TOKEN};
const receipt=(kind='AUTO_RIDE')=>({
 mode:'STAGING_DEMO_ONLY',serviceKind:kind,serviceId:ID,
 requestKey:REQUEST,viewerId:USER,actorId:USER,
 assignedParticipantOrLinkedDeliveryId:null,status:'searching',
 revision:1,createdAt:'2026-10-31T00:00:00Z',
 changedAt:'2026-10-31T00:00:00Z',
 events:[{eventId:EVENT,revision:1,status:'searching',
  at:'2026-10-31T00:00:00Z'}],totalEvents:1,
 eventsTruncated:false,serverPersisted:true,
 financialReconciliationCertified:false,
 externalEndToEndCertified:false,productionEnabled:false
});
const response=(body,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{'content-type':'application/json'}
});
function configured({fetchImpl=async()=>response(receipt()),
 getSession=async()=>session,...extra}={}){
 return createG263NativeAdminReader({
  enabled:true,ownerApproved:true,externalHttpsVerified:true,
  nativePgVerified:true,aal2ServerVerified:true,
  origin:HOST,fetchImpl,getSession,now:()=>NOW,...extra
 });
}
test('G263 is OFF without all STAGING permissions and pinned HTTPS',()=>{
 for(const config of [
  {},{enabled:true},{origin:HOST},{enabled:true,ownerApproved:true},
  {origin:'https://qore-mobile-backend-staging-staging.up.railway.app.evil.tld'},
  {origin:'http://qore-mobile-backend-staging-staging.up.railway.app'},
  {ownerApproved:false},{aal2ServerVerified:false}
 ]){
  const r=createG263NativeAdminReader({...config});
  assert.equal(r.isConfigured(),false);
  assert.equal((await r.read('AUTO_RIDE',ID)).code,'NATIVE_TRACE_NOT_CERTIFIED');
 }
});
test('G263 five server originals use one ID, no financial certification',async()=>{
 for(const kind of ['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE']){
  let called=false;
  const g=configured({fetchImpl:async(url,opt)=>{
   called=true;
   assert.equal(url,HOST+'/v1/staging/admin/native-services/'+kind+'/'+ID+'/trace');
   assert.equal(opt.method,'GET');
   assert.equal(opt.credentials,'omit');assert.equal(opt.redirect,'error');
   assert.equal(opt.headers.Authorization,'Bearer '+TOKEN);
   return response(receipt(kind));
  }});
  const r=await g.read(kind,ID);
  assert.equal(called,true);assert.equal(r.ok,true);
  assert.equal(r.data.serviceId,ID);
  assert.equal(r.data.events[0].eventId,EVENT);
  assert.equal(r.data.financialReconciliationCertified,false);
  assert.equal(r.data.externalEndToEndCertified,false);
  assert.equal(r.data.expiresAt,NOW+15000);
  assert.equal(JSON.stringify(r).includes(TOKEN),false);
 }
});
test('G263 rejects forged role, no MFA or changed Admin token before response',async()=>{
 for(const s of [
  {...session,role:'owner'}, {...session,mfaVerified:false},
  {...session,expiresAt:NOW-1},{...session,subject:'invalid'}
 ]){
  let calls=0;
  const g=configured({getSession:async()=>s,fetchImpl:async()=>{
   calls++;return response(receipt());
  }});
  assert.equal((await g.read('AUTO_RIDE',ID)).code,'ADMIN_AAL2_REQUIRED');
  assert.equal(calls,0);
 }
 let count=0;
 const g=configured({getSession:async()=>{
  count++;return count===1?session:{...session,token:'changed-token-1234567890123456789012'};
 }});
 assert.equal((await g.read('AUTO_RIDE',ID)).code,'STALE_OR_REVOKED_SESSION');
});
test('G263 validates complete original provenance and never invents settlement',async()=>{
 for(const edit of [
  d=>d.financialReconciliationCertified=true,
  d=>d.externalEndToEndCertified=true,
  d=>d.viewerId=ID,
  d=>d.serviceId=USER,
  d=>d.events[0].revision=0,
  d=>d.totalEvents=0,
  d=>d.eventsTruncated=true,
  d=>d.fakeField=5
 ]){
  const data=receipt();edit(data);
  const g=configured({fetchImpl:async()=>response(data)});
  assert.equal((await g.read('AUTO_RIDE',ID)).code,'INVALID_NATIVE_PROVENANCE');
 }
});
test('G263 denies fake kinds, IDs and server errors',async()=>{
 let calls=0;
 const g=configured({fetchImpl:async()=>{
  calls++;return response(receipt());
 }});
 for(const [kind,id] of [
  ['PAYMENT',ID],['AUTO_RIDE','../../credentials'],
  ['AUTO_RIDE',ID.toUpperCase()],['AUTO_RIDE','123']
 ]){
  assert.equal((await g.read(kind,id)).code,'INVALID_ORIGINAL_ID');
 }
 assert.equal(calls,0);
 for(const [status,code] of [
  [401,'ADMIN_SESSION_DENIED'],[403,'ADMIN_SESSION_DENIED'],
  [404,'ORIGINAL_NOT_FOUND'],[503,'BACKEND_NOT_READY'],
  [429,'BACKEND_RATE_LIMIT']
 ]){
  const x=configured({fetchImpl:async()=>response({message:'secret'},status)});
  assert.equal((await x.read('AUTO_RIDE',ID)).code,code);
 }
});
test('G263 never leaks large HTML replies, signed bearer or provider exception',async()=>{
 const g=configured({fetchImpl:async()=>new Response('<html>no</html>',{
  status:200,headers:{'content-type':'text/html'}})});
 assert.equal((await g.read('AUTO_RIDE',ID)).code,'BAD_CONTENT_TYPE');
 const huge=configured({fetchImpl:async()=>new Response('x'.repeat(70000),{
  status:200,headers:{'content-type':'application/json'}})});
 assert.equal((await huge.read('AUTO_RIDE',ID)).code,'RESPONSE_TOO_LARGE');
 const bad=configured({fetchImpl:async()=>{throw Error('private provider details '+TOKEN);}});
 const r=await bad.read('AUTO_RIDE',ID);
 assert.equal(r.ok,false);
 assert.equal(JSON.stringify(r).includes(TOKEN),false);
});
