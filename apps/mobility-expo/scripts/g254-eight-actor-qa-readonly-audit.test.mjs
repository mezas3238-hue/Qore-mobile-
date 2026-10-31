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
const approvingOwner={
 id:'26900000-0000-4269-8269-000000000001',
 email:'owner-approver@example.invalid',is_anonymous:false,
 email_confirmed_at:'2026-10-31T12:00:00Z',
 app_metadata:{qore_stage_owner_approver:true}
};
const allUsers=[...users,approvingOwner];
const roles=users.slice(1).map((u,i)=>({
 user_id:u.id,role:G254_QA_SLOTS[i+1].role
}));
const backoffice=[
 {user_id:users[0].id,role:'admin',
  status:'active',approved_by:approvingOwner.id,revision:1},
 {user_id:approvingOwner.id,role:'owner',
  status:'active',approved_by:users[1].id,revision:1}
];
const defaults={ref:G254_STAGING_REF,environment:'staging',
 liveTripsEnabled:false,publicKey,serviceKey};
function simulated({returnedUsers=allUsers,returnedRoles=roles,
 returnedBackoffice=backoffice,secret=serviceKey,
 signupDisabled=true,authFail=false,roleFail=false,backofficeFail=false}={}){
 const paths=[];
 const fetcher=async (url,options)=>{
  const u=new URL(url);
  assert.equal(u.hostname,G254_STAGING_REF+'.supabase.co');
  assert.equal(options.method,'GET');
  assert.equal(options.redirect,'error');
  assert.equal(options.headers.apikey,secret);
  if(secret.startsWith('sb_secret_'))
   assert.equal(Object.hasOwn(options.headers,'Authorization'),false);
  else assert.equal(options.headers.Authorization,'Bearer '+secret);
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
 const inspect=()=>inspectEightActorQa({...defaults,serviceKey:secret,
  fetcher,signupGate:async()=>({certified:signupDisabled})});
 return {inspect,paths};
}
test('G270 opaque secret on apikey only, legacy JWT service_role uses Bearer',async()=>{
 const modern=simulated();
 assert.equal((await modern.inspect()).qaAuthAccounts,8);
 const jwt=[
  Buffer.from(JSON.stringify({typ:'JWT',alg:'HS256'})).toString('base64url'),
  Buffer.from(JSON.stringify({role:'service_role',ref:G254_STAGING_REF})).toString('base64url'),
  'a'.repeat(43)
 ].join('.');
 const old=simulated({secret:jwt});
 const result=await old.inspect();
 assert.equal(result.qaAuthAccounts,8);
 assert.equal(result.distinctBackofficeOwnerApprover,1);
});
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
  distinctBackofficeOwnerApprover:1,
  ownerBootstrapIndependentlyCertified:false,
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
  [...allUsers,{...users[0],id:'99999999-2510-4251-8251-999999999999'}],
  allUsers.slice(1),
  allUsers.map((u,i)=>i===2?{...u,
   app_metadata:{qore_stage_qa:true,qore_qa_slot:'foreign'}}:u),
  allUsers.map((u,i)=>i===4?{...u,id:users[0].id}:u),
  allUsers.map((u,i)=>i===3?{...u,email_confirmed_at:null}:u),
  allUsers.map((u,i)=>i===5?{...u,email:'real@gmail.com'}:u),
  allUsers.map((u,i)=>i===6?{...u,is_anonymous:true}:u),
  allUsers.map((u,i)=>i===8?{...u,app_metadata:{qore_stage_qa:true,qore_qa_slot:'passenger'}}:u),
  allUsers.map((u,i)=>i===8?{...u,app_metadata:{qore_stage_owner_approver:false}}:u)
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
test('G269 requires a distinct Owner approver, not any passenger/driver QA user',async()=>{
 for(const bad of [
  [],[backoffice[0]],
  [{...backoffice[0],role:'owner'},backoffice[1]],
  [{...backoffice[0],status:'pending'},backoffice[1]],
  [{...backoffice[0],approved_by:users[1].id},backoffice[1]],
  [{...backoffice[0],approved_by:users[0].id},backoffice[1]],
  [{...backoffice[0],approved_by:'26666666-2666-4266-8266-266666666666'},backoffice[1]],
  [{...backoffice[0],revision:0},backoffice[1]],
  [{...backoffice[0],user_id:users[1].id},backoffice[1]],
  [backoffice[0],{...backoffice[1],role:'admin'}],
  [backoffice[0],{...backoffice[1],status:'suspended'}],
  [backoffice[0],{...backoffice[1],approved_by:users[0].id}],
  [backoffice[0],{...backoffice[1],revision:0}],
  [...backoffice,backoffice[0]]
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
