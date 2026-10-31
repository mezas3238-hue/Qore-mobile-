import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreG260AdminAal2Trust}
 from './g260-supabase-admin-aal2-trust.mjs';
const REF='mrjzxftsdxzepzbcuids';
const USER='26000000-0000-4260-8260-000000000001';
const SESSION='26000000-0000-4260-8260-000000000002';
const NOW=1793448000000;
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const bearer=(body={})=>[
 encode({alg:'HS256',typ:'JWT'}),
 encode({
  iss:'https://'+REF+'.supabase.co/auth/v1',
  role:'authenticated',aud:'authenticated',sub:USER,session_id:SESSION,
  iat:Math.floor(NOW/1000)-180,exp:Math.floor(NOW/1000)+3600,
  aal:'aal2',amr:[{method:'password',timestamp:Math.floor(NOW/1000)-220},
   {method:'totp',timestamp:Math.floor(NOW/1000)-120}],
  ...body
 }), 'A'.repeat(48)].join('.');
const confirmed=Object.freeze({id:USER,is_anonymous:false,
 email_confirmed_at:'2026-10-30T00:00:00Z'});
function providers({allow=true,providerUser=confirmed}={}){
 const calls={auth:0,sql:0};
 const auth={getUser:async()=>{
  calls.auth++;return providerUser===null?{error:new Error('revoked')}:
   {data:{user:providerUser},error:null};
 }};
 const db={rpc:async(name,params)=>{
  calls.sql++;
  assert.equal(name,'mobility_stage_g42_session_active');
  assert.equal(params._user,USER);
  assert.equal(params._session,SESSION);
  assert.equal(params._iat_ms,NOW-180000);
  return {data:allow,error:null};
 }};
 return {auth,db,calls,create:()=>createQoreG260AdminAal2Trust({
  projectRef:REF,auth,db,now:()=>NOW,allowedByOwner:true,liveEnabled:false
 })};
}
test('G260 cannot mount in wrong environment, LIVE or without owner permission',()=>{
 const p=providers();
 for(const edit of [
  {projectRef:'qdqrlgzlotnfdxzpacxs'},{allowedByOwner:false},
  {liveEnabled:true},{auth:null},{db:null}
 ]){
  assert.throws(()=>createQoreG260AdminAal2Trust({
   projectRef:REF,auth:p.auth,db:p.db,now:()=>NOW,
   allowedByOwner:true,liveEnabled:false,...edit
  }));
 }
});
test('G260 rechecks independently verified provider and G42 before Admin AAL2',async()=>{
 const p=providers(),t=p.create(),token=bearer();
 const verified=await t.verifyAdminSession(token);
 assert.deepEqual(verified,{id:USER,sessionId:SESSION,
  tokenIatMs:NOW-180000,expiresAtMs:NOW+3600000,is_anonymous:false});
 assert.equal(await t.verifySessionNotRevoked({userId:USER,sessionId:SESSION}),true);
 const mfa=await t.verifyBackofficeMfa({
  token,userId:USER,sessionId:SESSION,requiredLevel:'aal2',at:NOW
 });
 assert.deepEqual(mfa,{verifiedByProvider:true,userId:USER,sessionId:SESSION,
  assuranceLevel:'aal2',verifiedAtMs:NOW-120000,
  expiresAtMs:NOW+3600000});
 assert.equal(p.calls.auth>=2,true);
 assert.equal(p.calls.sql>=4,true);
});
test('G260 rejects unknown sessions even with a well-formed actor',async()=>{
 const p=providers(),t=p.create();
 assert.equal(await t.verifySessionNotRevoked({userId:USER,sessionId:SESSION}),false);
 assert.equal(await t.verifySessionNotRevoked({userId:'other',sessionId:SESSION}),false);
 assert.equal(await t.verifySessionNotRevoked(),false);
 assert.deepEqual(p.calls,{auth:0,sql:0});
});
test('G260 checks SQL revocation instead of believing cached sessions',async()=>{
 const p=providers({allow:false}),t=p.create();
 await assert.rejects(()=>t.verifyAdminSession(bearer()));
 assert.equal(await t.verifySessionNotRevoked({userId:USER,sessionId:SESSION}),false);
});
test('G260 rejects wrong provider subject, missing confirmation or expired session',async()=>{
 for(const u of [
  null,{...confirmed,id:'26000000-0000-4260-8260-000000000003'},
  {...confirmed,is_anonymous:true},{id:USER,is_anonymous:false}
 ]){
  const p=providers({providerUser:u});
  await assert.rejects(()=>p.create().verifyAdminSession(bearer()));
 }
});
test('G260 requires genuine recent signed AAL2 methods after provider validation',async()=>{
 const bad=[
  {aal:'aal1'},{aal:undefined},{amr:undefined},
  {amr:[{method:'password',timestamp:Math.floor(NOW/1000)-120}]},
  {amr:[{method:'totp',timestamp:Math.floor(NOW/1000)-50000}]},
  {amr:[{method:'totp',timestamp:Math.floor(NOW/1000)+300}]},
  {amr:[{method:'fake',timestamp:Math.floor(NOW/1000)-120}]},
  {amr:[{method:'totp',timestamp:'2026-10-30'}]}
 ];
 for(const payload of bad){
  const t=providers().create();
  const token=bearer(payload);
  await t.verifyAdminSession(token);
  await assert.rejects(()=>t.verifyBackofficeMfa({
   token,userId:USER,sessionId:SESSION,requiredLevel:'aal2',at:NOW
  }));
 }
});
test('G260 refuses forged subject/session and never returns an Admin role',async()=>{
 const t=providers().create(),token=bearer();
 await t.verifyAdminSession(token);
 await assert.rejects(()=>t.verifyBackofficeMfa({
  token,userId:USER,sessionId:'26000000-0000-4260-8260-000000000003',
  requiredLevel:'aal2',at:NOW
 }));
 await assert.rejects(()=>t.verifyBackofficeMfa({
  token,userId:USER,sessionId:SESSION,requiredLevel:'aal1',at:NOW
 }));
 assert.equal(Object.hasOwn(t,'grantAdmin'),false);
});
