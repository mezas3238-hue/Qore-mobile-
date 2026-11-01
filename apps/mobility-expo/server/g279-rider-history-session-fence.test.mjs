import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createG279RiderHistorySessionVerifier} from './g279-rider-history-session-fence.mjs';
import {createQoreRiderHistoryGateway} from './g26-rider-history-gateway.mjs';

const ref='mrjzxftsdxzepzbcuids';
const actor='00000000-0000-4000-8000-000000000101';
const other='00000000-0000-4000-8000-000000000102';
const session='00000000-0000-4000-8000-000000000501';
const time=Date.parse('2026-10-31T20:00:00Z');
const iat=Math.floor(time/1000)-10;
const user={id:actor,is_anonymous:false,email_confirmed_at:'2026-10-31T00:00:00Z'};
const token=(overrides={})=>{
 const body={sub:actor,session_id:session,
  iss:'https://'+ref+'.supabase.co/auth/v1',role:'authenticated',
  aud:'authenticated',iat,exp:iat+1800,...overrides};
 return [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),
  Buffer.from(JSON.stringify(body)).toString('base64url'),
  's'.repeat(43)].join('.');
};
const make=({authenticated=user,active=true,now=()=>time}={})=>{
 const seen=[];
 return {seen,verify:createG279RiderHistorySessionVerifier({
  projectRef:ref,now,
  verifyProviderUser:async received=>{
   assert.equal(typeof received,'string');
   if(authenticated===null)throw Error('Identity provider offline');
   return authenticated;
  },
  readProviderSession:async scope=>{
   seen.push(scope);
   return active;
  }
 })};
};
test('G279 requires original provider Auth and same active G42 session',async()=>{
 const m=make();
 const got=await m.verify(token());
 assert.deepEqual(got,user);
 assert.deepEqual(m.seen,[{userId:actor,sessionId:session,issuedAtMs:iat*1000}]);
});
test('G279 denies locally revoked token even when provider getUser still returns the user',async()=>{
 const m=make({active:false});
 await assert.rejects(m.verify(token()),/G279 private Passenger session unavailable/);
 assert.equal(m.seen.length,1);
});
test('G279 refuses JWT cross-subject, foreign issuer, expired and malformed sessions',async()=>{
 for(const claims of [
  {sub:other},{session_id:'not-a-uuid'},
  {session_id:null},{iss:'https://wrong.supabase.co/auth/v1'},
  {iat:iat+90000},{exp:iat-1},{role:'service_role'},
  {aud:'anon'},{aud:['authenticated','admin']}
 ]){
  const m=make();
  await assert.rejects(m.verify(token(claims)));
  assert.equal(m.seen.length,0);
 }
 for(const bad of ['', 'signed.notjson.signature',token().split('.').slice(0,2).join('.')]){
  const m=make();
  await assert.rejects(m.verify(bad));
  assert.equal(m.seen.length,0);
 }
});
test('G279 rejects unavailable Auth/G42, anonymous users and missing confirmation',async()=>{
 for(const scenario of [
  {authenticated:null},{active:null},{active:'true'},
  {authenticated:{...user,is_anonymous:true}},
  {authenticated:{id:actor,is_anonymous:false}},
  {authenticated:{...user,id:other}}
 ]){
  const m=make(scenario);
  await assert.rejects(m.verify(token()));
 }
 for(const params of [{projectRef:'production'},
  {projectRef:ref,verifyProviderUser:async()=>user},
  {projectRef:ref,readProviderSession:async()=>true}]){
  assert.throws(()=>createG279RiderHistorySessionVerifier(params));
 }
});
test('G279 real rider history gateway denies revoked session before any SQL history read',async()=>{
 let active=true,loads=0,roles=0;
 const verify=createG279RiderHistorySessionVerifier({
  projectRef:ref,now:()=>time,
  verifyProviderUser:async()=>user,
  readProviderSession:async()=>active
 });
 const gateway=createQoreRiderHistoryGateway({
  projectRef:ref,verifyAccessToken:verify,
  authorizePassenger:async()=>{roles++;return true;},
  allowRequest:()=>true,
  loadOwnHistory:async()=>{loads++;return {items:[],nextPosition:null};},
  cursorSecrets:{current:'g279_ci_only_distinct_key_do_not_use_in_staging_xyz'},
  now:()=>time
 });
 const request=()=>gateway({method:'GET',path:'/v1/staging/rider/history',
  headers:{authorization:'Bearer '+token()},body:null});
 assert.equal((await request()).status,200);
 assert.equal(loads,1);
 active=false;
 assert.equal((await request()).status,401);
 assert.equal(loads,1);
 assert.equal(roles,1);
});
test('G279 guard remains wired to the original G4 runtime, not a parallel endpoint',()=>{
 const source=readFileSync(new URL('./g4-staging-runtime.mjs',import.meta.url),'utf8');
 assert.match(source,/verifyAccessToken:verifiedHistorySession/);
 assert.match(source,/admin\.rpc\('mobility_stage_g42_session_active'/);
 assert.match(source,/readProviderSession:async/);
 assert.match(source,/createG279RiderHistorySessionVerifier/);
});
