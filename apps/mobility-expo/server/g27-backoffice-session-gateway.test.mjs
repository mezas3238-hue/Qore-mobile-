import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreBackofficeSessionGateway} from './g27-backoffice-session-gateway.mjs';

const at=Date.parse('2026-10-23T08:00:00Z');
const userId='11111111-1111-4111-8111-111111111111';
const token='verifiedSyntheticBearer123456789012345678901';
const path='/v1/staging/admin/session';
const other='/v1/staging/owner/session';
const request={method:'GET',path,headers:{authorization:'Bearer '+token}};
const user={id:userId,is_anonymous:false,
 email_confirmed_at:'2026-10-20T12:00:00Z',sessionId:'session-verified-001',
 expiresAtMs:at+300000};
const mfa={userId,sessionId:user.sessionId,verifiedByProvider:true,
 assuranceLevel:'aal2',verifiedAtMs:at-60000,expiresAtMs:at+240000};
function fixture(overrides={}){
 const seen={jwt:0,roles:0,mfa:0,limit:0};
 const gate=createQoreBackofficeSessionGateway({
  projectRef:'staging1234567890abcd',now:()=>at,
  verifyAccessToken:async t=>{seen.jwt++;assert.equal(t,token);return user;},
  loadExclusiveBackofficeRole:async()=>{seen.roles++;return 'admin';},
  verifyBackofficeMfa:async v=>{seen.mfa++;
   assert.deepEqual(v,{token,userId,sessionId:user.sessionId,
    requiredLevel:'aal2',at});
   return mfa;
  },
  allowRequest:()=>{seen.limit++;return true;},
  ...overrides
 });
 return {gate,seen};
}
test('A04.1 exclusive Admin session validates server JWT, role and MFA, returns no PII',async()=>{
 const {gate,seen}=fixture();
 const result=await gate(request);
 assert.deepEqual(result,{status:200,body:{
  mode:'STAGING_QA_ONLY',userId,role:'admin',assuranceLevel:'aal2',
  expiresAtMs:at+240000,dataAccessEnabled:false
 }});
 assert.deepEqual(seen,{jwt:1,roles:1,mfa:1,limit:1});
 assert.doesNotMatch(JSON.stringify(result),/email|phone|service_role|document|finance/);
});
test('Owner role is independent: Admin JWT cannot access Owner session',async()=>{
 const a=fixture();
 assert.equal((await a.gate({...request,path:other})).status,403);
 assert.equal(a.seen.mfa,0);
 const owner=fixture({loadExclusiveBackofficeRole:async()=> 'owner'});
 const allowed=await owner.gate({...request,path:other});
 assert.equal(allowed.status,200);
 assert.equal(allowed.body.role,'owner');
 assert.equal((await owner.gate(request)).status,403);
});
test('Missing/cross-role/revoked bearer and malformed path fail closed',async()=>{
 const a=fixture();
 for(const altered of [
  {...request,headers:{}},
  {...request,headers:{authorization:'Bearer user-provided-role-admin'}},
  {...request,method:'POST'},
  {...request,path:path+'?role=owner'},
  {...request,body:{}},
 ]){
  const out=await a.gate(altered);
  assert.ok([400,401,404].includes(out.status),JSON.stringify(out));
 }
 assert.equal(a.seen.mfa,0);
 for(const override of [
  {verifyAccessToken:async()=>{throw Error('revoked')}},
  {verifyAccessToken:async()=>({...user,expiresAtMs:at-1})},
  {verifyAccessToken:async()=>({...user,is_anonymous:true})},
  {verifyAccessToken:async()=>({...user,sessionId:undefined})},
  {verifyAccessToken:async()=>({...user,email_confirmed_at:undefined})},
 ]){
  const g=fixture(override);
  assert.equal((await g.gate(request)).status,401);
  assert.equal(g.seen.mfa,0);
 }
});
test('Admin cannot assert MFA: only independently verified same-user same-session AAL2 passes',async()=>{
 for(const value of [
  {...mfa,verifiedByProvider:false},
  {...mfa,userId:'22222222-2222-4222-8222-222222222222'},
  {...mfa,sessionId:'another-session'},
  {...mfa,assuranceLevel:'aal1'},
  {...mfa,verifiedAtMs:at-13*60*60*1000},
  {...mfa,verifiedAtMs:at+1},
  {...mfa,expiresAtMs:at-1},
  {...mfa,expiresAtMs:user.expiresAtMs+1},
  {assuranceLevel:'aal2'},
 ]){
  const g=fixture({verifyBackofficeMfa:async()=>value});
  assert.equal((await g.gate(request)).status,403);
 }
});
test('Rate limit and authority outages never authorize a backoffice session',async()=>{
 for(const [override,status] of [
  [{allowRequest:()=>false},429],
  [{allowRequest:()=>{throw Error('rate down')}},503],
  [{loadExclusiveBackofficeRole:async()=>{throw Error('db down')}},503],
  [{verifyBackofficeMfa:async()=>{throw Error('provider down')}},503],
  [{now:()=>NaN},503]
 ]){
  assert.equal((await fixture(override).gate(request)).status,status);
 }
});
test('No insecure backoffice policy without all server adapters',()=>{
 for(const missing of ['verifyAccessToken','loadExclusiveBackofficeRole',
  'verifyBackofficeMfa','allowRequest']){
  const opts={
   projectRef:'staging1234567890abcd',
   verifyAccessToken:async()=>{},
   loadExclusiveBackofficeRole:async()=>{},
   verifyBackofficeMfa:async()=>{},
   allowRequest:()=>true
  };
  delete opts[missing];
  assert.throws(()=>createQoreBackofficeSessionGateway(opts),/required/);
 }
});
