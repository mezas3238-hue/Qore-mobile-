import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyG256RailwayLaunch}
 from './g256-railway-launch-preflight.mjs';
const REF='mrjzxftsdxzepzbcuids';
const HOST='qore-mobile-backend-staging-staging.up.railway.app';
const publicKey='sb_publishable_1234567890abcdefghijklmnopqrstuvwxyz';
const secret='sb_secret_1234567890abcdefghijklmnopqrstuvwxyz';
const history='ABCDEFGHIJKLMNOPQRSTabcdefghijklmno1234567890_-';
const env={
 QORE_MOBILITY_ENV:'staging',RAILWAY_ENVIRONMENT_NAME:'staging',
 LIVE_TRIPS_ENABLED:'false',QORE_RAILWAY_NO_COMMERCIAL_TRIPS:'true',
 QORE_RAILWAY_STAGING_APPROVED:'true',QORE_STAGING_PROJECT_REF:REF,
 QORE_RAILWAY_HOSTNAME:HOST,RAILWAY_PUBLIC_DOMAIN:HOST,
 QORE_STAGING_PUBLISHABLE_KEY:publicKey,
 QORE_STAGING_SERVICE_ROLE_KEY:secret,
 QORE_HISTORY_CURSOR_SIGNING_KEY:history,PORT:'3000'
};
const run=(patch={},extra={})=>verifyG256RailwayLaunch({
 env:{...env,...patch},
 checkSignup:async()=>({certified:true,reason:'No public registration'}),
 ...extra
});
test('G256 predeploy accepts only closed independent staging and does not certify 5 trips',async()=>{
 const result=await run();
 assert.deepEqual(result,{ok:true,code:'STAGING_PREDEPLOY_GATES_PASS',
  projectRef:REF,stageOnly:true,commercialRidesEnabled:false,
  fiveExternalJourneysCertified:false});
});
test('G256 refuses all prod, wrong environment or missing owner approval',async()=>{
 for(const changes of [
  {QORE_MOBILITY_ENV:'production'},{RAILWAY_ENVIRONMENT_NAME:'production'},
  {LIVE_TRIPS_ENABLED:'true'},{QORE_RAILWAY_NO_COMMERCIAL_TRIPS:'false'},
  {QORE_RAILWAY_STAGING_APPROVED:'false'},
  {QORE_RAILWAY_STAGING_APPROVED:undefined}
 ]){
  const r=await run(changes);
  assert.equal(r.ok,false);
  assert.equal(r.code,'STAGING_OWNER_GATE_OFF');
 }
});
test('G256 pins exact target Supabase project and Railway domain',async()=>{
 for(const change of [
  {QORE_STAGING_PROJECT_REF:'qdqrlgzlotnfdxzpacxs'},
  {QORE_STAGING_PROJECT_REF:'anotherstagingref123'},
  {QORE_RAILWAY_HOSTNAME:'example.com'},
  {QORE_RAILWAY_HOSTNAME:'staging.up.railway.app.evil.test'},
  {RAILWAY_PUBLIC_DOMAIN:'other.up.railway.app'},
  {PORT:'80'},{PORT:'100000'}
 ]){
  const r=await run(change);
  assert.equal(r.ok,false);
  assert.equal(r.code,'WRONG_STAGING_DESTINATION');
 }
});
test('G256 never accepts no server secret, forged public key or weak signing secret',async()=>{
 const cases=[
  [{QORE_STAGING_SERVICE_ROLE_KEY:undefined},'SERVER_SECRET_NOT_CONFIGURED'],
  [{QORE_STAGING_SERVICE_ROLE_KEY:publicKey},'SERVER_SECRET_NOT_CONFIGURED'],
  [{QORE_STAGING_PUBLISHABLE_KEY:secret},'INVALID_PUBLIC_SUPABASE_KEY'],
  [{QORE_HISTORY_CURSOR_SIGNING_KEY:'short'},'CURSOR_SIGNING_SECRET_NOT_CONFIGURED'],
  [{QORE_HISTORY_CURSOR_SIGNING_KEY:'A'.repeat(80)},'CURSOR_SIGNING_SECRET_NOT_CONFIGURED'],
  [{QORE_HISTORY_CURSOR_SIGNING_KEY:secret},'CURSOR_SIGNING_SECRET_NOT_CONFIGURED'],
  [{QORE_HISTORY_CURSOR_PREVIOUS_KEY:history},'CURSOR_SIGNING_SECRET_NOT_CONFIGURED']
 ];
 for(const [changes,reason] of cases){
  const r=await run(changes);
  assert.equal(r.code,reason);
  assert.equal(JSON.stringify(r).includes(secret),false);
  assert.equal(JSON.stringify(r).includes(history),false);
 }
});
test('G256 fails closed when Auth settings missing, signup open or provider unavailable',async()=>{
 let times=0;
 for(const f of [
  async()=>({certified:false}),
  async()=>({}),
  async()=>{throw Error('provider internal secret')}
 ]){
  const r=await run({},{
   checkSignup:async args=>{
    times++;
    assert.deepEqual(args,{ref:REF,key:publicKey});
    return await f();
   }
  });
  assert.equal(r.ok,false);
  assert.match(r.code,/SUPABASE_AUTH_STATUS_UNVERIFIED|PUBLIC_SIGNUP_NOT_CERTIFIED_CLOSED/);
 }
 assert.equal(times,3);
});
test('G256 cannot mistake an empty Auth project for disabled public signup',async()=>{
 const r=await run({},{checkSignup:async()=>null});
 assert.equal(r.code,'PUBLIC_SIGNUP_NOT_CERTIFIED_CLOSED');
});
