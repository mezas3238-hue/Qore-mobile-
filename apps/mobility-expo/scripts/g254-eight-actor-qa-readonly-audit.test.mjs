import test from 'node:test';
import assert from 'node:assert/strict';
import {G254_QA_SLOTS,G254_STAGING_REF,inspectEightActorQa,g254ReadOnlyCliConfig}
 from './g254-eight-actor-qa-readonly-audit.mjs';

const publicKey='sb_publishable_'+('p'.repeat(40));
test('G268 CLI maps actual Railway publishable key and never uses old anon var',()=>{
 const env={QORE_STAGING_PROJECT_REF:G254_STAGING_REF,
  QORE_MOBILITY_ENV:'staging',
  QORE_STAGING_PUBLISHABLE_KEY:publicKey,
  QORE_STAGING_SERVICE_ROLE_KEY:serviceKey,
  QORE_STAGING_ANON_KEY:'wrong-legacy-key-value',
  LIVE_TRIPS_ENABLED:'false'};
 const result=g254ReadOnlyCliConfig(env);
 assert.deepEqual(result,{
  ref:G254_STAGING_REF,environment:'staging',
  liveTripsEnabled:false,publicKey,serviceKey
 });
 assert.equal(Object.isFrozen(result),true);
 assert.notEqual(result.publicKey,env.QORE_STAGING_ANON_KEY);
 const missing=g254ReadOnlyCliConfig({
  ...env,QORE_STAGING_PUBLISHABLE_KEY:undefined
 });
 assert.equal(missing.publicKey,undefined);
});

const serviceKey='sb_secret_'+('s'.repeat(40));
const users=G254_QA_SLOTS.map(({slot},i)=>({
 id:String(i+1).padStart(8,'0')+'-2510-4251-8251-'+String(i+1).padStart(12,'0'),
 email:'qa-'+slot+'@example.invalid',is_anonymous:false,
 email_confirmed_at:'2026-10-31T12:00:00Z',
 app_metadata:{qore_stage_qa:true,qore_qa_slot:slot}
}));
const roles=users.slice(1).map((u,i)=>({
 user_id:u.id,role:G254_QA_SLOTS[i+1].role
}));
const backoffice=[{user_id:users[0].id,role:'admin',
 status:'active',approved_by:users[1].id,revision:1}];
const defaults={ref:G254_STAGING_REF,environment:'staging',
 liveTripsEnabled:false,publicKey,serviceKey};
function simulated({returnedUsers=users,returnedRoles=roles,
 returnedBackoffice=backoffice,
 signupDisabled=true,authFail=false,roleFail=false,backofficeFail=false}={}){
 const paths=[];
 const fetcher=async (url,options)=>{
  const u=new URL(url);
  assert.equal(u.hostname,G254_STAGING_REF+'.supabase.co');
  assert.equal(options.method,'GET');
  assert.equal(options.redirect,'error');
  assert.equal(options.headers.apikey,serviceKey);
  assert.equal(options.headers.Authorization,'Bearer '+serviceKey);
  paths.push(u.pathname);
  if(u.pathname==='/auth/v1/admin/users'){
   assert.equal(u.searchParams.get('per_page'),'50');
   assert.equal(u.searchParams.get('page'),'1');
   return {ok:!authFail,status:authFail?503:200,
    json:async()=>({users:returnedUsers})};
  }
  if(u.pathname==='/rest/v1/user_roles'){
   assert.equal(u.searchParams.get('select'),'user_id,role');
   return {ok:!roleFail,status:roleFail?503:200,
    json:async()=>returnedRoles};
  }
  if(u.pathname==='/rest/v1/mobility_stage_backoffice_roles'){
   assert.equal(u.searchParams.get('select'),'user_id,role,status,approved_by,revision');
   return {ok:!backofficeFail,status:backofficeFail?503:200,
    json:async()=>returnedBackoffice};
  }
  throw Error('Unexpected privileged endpoint');
 };
 const inspect=()=>inspectEightActorQa({...defaults,fetcher,
  signupGate:async()=>({certified:signupDisabled})});
 return {inspect,paths};
}
test('G254 empty Auth STAGING refuses to certify accounts; no role reads',async()=>{
 const x=simulated({returnedUsers:[]});
 await assert.rejects(x.inspect(),/G254 STAGING independent/);
 assert.deepEqual(x.paths,['/auth/v1/admin/users']);
});
test('G254 eight distinct QA actor registrations and roles: read-only, no login and no E2E claim',async()=>{
 const x=simulated();
 const result=await x.inspect();
 assert.deepEqual(result,{
  mode:'STAGING_READ_ONLY',projectPinned:true,signupDisabled:true,
  qaAuthAccounts:8,exclusiveQaRoles:8,
  privateBackofficeAdminActors:1,nativeQaRoles:7,
  independentOwnerApprovalVerified:false,
  roleCounts:{admin:1,driver:4,passenger:3},
  verifiedPasswordLogin:false,verifiedG42Sessions:0,
  externalJourneysCertified:0,commercialLaunchAllowed:false
 });
 assert.deepEqual(x.paths,['/auth/v1/admin/users','/rest/v1/user_roles',
  '/rest/v1/mobility_stage_backoffice_roles']);
 assert(!JSON.stringify(result).includes('@example.invalid'));
 assert(!JSON.stringify(result).includes(users[0].id));
});
test('G254 signup-open gate refuses privileged calls before user enumeration',async()=>{
 const x=simulated({signupDisabled:false});
 await assert.rejects(x.inspect(),/G254 STAGING independent/);
 assert.deepEqual(x.paths,[]);
});
test('G254 cannot be pointed to production, LIVE or mixed credentials',async()=>{
 const x=simulated();
 for(const change of [
  {ref:'qdqrlgzlotnfdxzpacxs'},
  {environment:'production'},
  {liveTripsEnabled:true},
  {liveTripsEnabled:'false'},
  {serviceKey:publicKey},
  {publicKey:serviceKey},
  {serviceKey:'fake-'+serviceKey},
  {serviceKey:'not-a-token-or-secret'},
  {publicKey:'not-a-public-key'}
 ]){
  await assert.rejects(inspectEightActorQa({...defaults,fetcher:async()=>{throw Error('fetch must not run');},
   signupGate:async()=>{throw Error('signup must not run');},...change}));
 }
 assert.deepEqual(x.paths,[]);
});
test('G254 wrong slot, extra person, unconfirmed user and duplicate UUID fail closed',async()=>{
 for(const changed of [
  [...users,{...users[0],id:'99999999-2510-4251-8251-999999999999'}],
  users.slice(1),
  users.map((u,i)=>i===2?{...u,
   app_metadata:{qore_stage_qa:true,qore_qa_slot:'foreign'}}:u),
  users.map((u,i)=>i===4?{...u,id:users[0].id}:u),
  users.map((u,i)=>i===3?{...u,email_confirmed_at:null}:u),
  users.map((u,i)=>i===5?{...u,email:'real@gmail.com'}:u),
  users.map((u,i)=>i===6?{...u,is_anonymous:true}:u)
 ]){
  const x=simulated({returnedUsers:changed});
  await assert.rejects(x.inspect(),/G254 STAGING independent/);
  assert.deepEqual(x.paths,['/auth/v1/admin/users']);
 }
});
test('G254 extra, missing, duplicated, mixed or forged role cannot pass',async()=>{
 for(const changed of [
  roles.slice(1),
  [...roles,roles[0]],
  roles.map((r,i)=>i===2?{...r,role:'passenger'}:r),
  [...roles,{user_id:users[0].id,role:'passenger'}],
  roles.map((r,i)=>i===4?{...r,user_id:roles[0].user_id}:r),
  roles.map((r,i)=>i===5?{...r,user_id:'99999999-2510-4251-8251-999999999999'}:r),
  roles.map((r,i)=>i===6?{...r,role:'owner'}:r)
 ]){
  const x=simulated({returnedRoles:changed});
  await assert.rejects(x.inspect(),/G254 STAGING independent/);
  assert.deepEqual(x.paths,['/auth/v1/admin/users','/rest/v1/user_roles']);
 }
});
test('G266 rejects forged, inactive, self-approved or missing private Admin registry',async()=>{
 for(const bad of [
  [],[{...backoffice[0],role:'owner'}],
  [{...backoffice[0],status:'pending'}],
  [{...backoffice[0],approved_by:users[0].id}],
  [{...backoffice[0],approved_by:'26666666-2666-4266-8266-266666666666'}],
  [{...backoffice[0],revision:0}],
  [{...backoffice[0],user_id:users[1].id}],
  [...backoffice,...backoffice]
 ]){
  const x=simulated({returnedBackoffice:bad});
  await assert.rejects(x.inspect(),/G254 STAGING independent/);
  assert.deepEqual(x.paths,['/auth/v1/admin/users','/rest/v1/user_roles',
   '/rest/v1/mobility_stage_backoffice_roles']);
 }
});
test('G254 Auth or PostgREST outage denies readiness, never attempts creation or writes',async()=>{
 for(const opts of [{authFail:true},{roleFail:true},{backofficeFail:true}]){
  const x=simulated(opts);
  await assert.rejects(x.inspect(),/G254 STAGING independent/);
  assert(x.paths.every(v=>v==='/auth/v1/admin/users'||
   v==='/rest/v1/user_roles'||v==='/rest/v1/mobility_stage_backoffice_roles'));
 }
});
