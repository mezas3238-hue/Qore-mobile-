import test from 'node:test';
import assert from 'node:assert/strict';
import {G254_QA_SLOTS,G254_STAGING_REF,inspectEightActorQa}
 from './g254-eight-actor-qa-readonly-audit.mjs';

const publicKey='sb_publishable_'+('p'.repeat(40));
const serviceKey='sb_secret_'+('s'.repeat(40));
const users=G254_QA_SLOTS.map(({slot},i)=>({
 id:String(i+1).padStart(8,'0')+'-2510-4251-8251-'+String(i+1).padStart(12,'0'),
 email:'qa-'+slot+'@example.invalid',is_anonymous:false,
 email_confirmed_at:'2026-10-31T12:00:00Z',
 app_metadata:{qore_stage_qa:true,qore_qa_slot:slot}
}));
const roles=users.map((u,i)=>({
 user_id:u.id,role:G254_QA_SLOTS[i].role
}));
const defaults={ref:G254_STAGING_REF,environment:'staging',
 liveTripsEnabled:false,publicKey,serviceKey};
function simulated({returnedUsers=users,returnedRoles=roles,
 signupDisabled=true,authFail=false,roleFail=false}={}){
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
  roleCounts:{admin:1,driver:4,passenger:3},
  verifiedPasswordLogin:false,verifiedG42Sessions:0,
  externalJourneysCertified:0,commercialLaunchAllowed:false
 });
 assert.deepEqual(x.paths,['/auth/v1/admin/users','/rest/v1/user_roles']);
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
  roles.map((r,i)=>i===4?{...r,user_id:roles[0].user_id}:r),
  roles.map((r,i)=>i===5?{...r,user_id:'99999999-2510-4251-8251-999999999999'}:r),
  roles.map((r,i)=>i===7?{...r,role:'owner'}:r)
 ]){
  const x=simulated({returnedRoles:changed});
  await assert.rejects(x.inspect(),/G254 STAGING independent/);
  assert.deepEqual(x.paths,['/auth/v1/admin/users','/rest/v1/user_roles']);
 }
});
test('G254 Auth or PostgREST outage denies readiness, never attempts creation or writes',async()=>{
 for(const opts of [{authFail:true},{roleFail:true}]){
  const x=simulated(opts);
  await assert.rejects(x.inspect(),/G254 STAGING independent/);
  assert(x.paths.every(v=>v==='/auth/v1/admin/users'||
   v==='/rest/v1/user_roles'));
 }
});
