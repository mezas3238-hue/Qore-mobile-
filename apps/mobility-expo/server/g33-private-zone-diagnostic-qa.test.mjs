import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreG33InternalDiagnosticQa} from './g33-private-zone-diagnostic-qa.mjs';

const at=Date.parse('2026-10-23T12:00:00Z');
const userId='11111111-1111-4111-8111-111111111111';
const zoneId='22222222-2222-4222-8222-222222222222';
const bearer='qaSyntheticVerifiedBearerOverTwentyCharacters123';
const identity={id:userId,sessionId:'qa-session-00001',
 expiresAtMs:at+900000,is_anonymous:false,
 email_confirmed_at:'2026-10-22T11:00:00Z'};
const proof={verifiedByProvider:true,userId,
 sessionId:identity.sessionId,assuranceLevel:'aal2',
 verifiedAtMs:at-1000,expiresAtMs:at+700000};
const doc={zoneId,serviceKind:'AUTO_DELIVERY',
 source:'QA_G32_QUARANTINE_ONLY',observedAtMs:at,
 quarantinedRecentSignals:5,consentingIdleCandidates:1,
 availabilityConfirmed:false,dispatchAuthorized:false,
 publishedToG31:false,productionEnabled:false};
function fixture(overrides={}){
 const calls=[];const options={
  environment:'isolated_staging',liveEnabled:false,localQaOnly:true,
  now:()=>at,
  verifyAccessToken:async()=>{calls.push('auth');return identity;},
  verifyBackofficeMfa:async()=>{calls.push('mfa');return proof;},
  allowRequest:()=>{calls.push('rate');return true;},
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==='mobility_stage_g27_backoffice_role_of')
    return {data:'admin',error:null};
   if(name==='mobility_stage_g27_backoffice_has_scope')
    return {data:true,error:null};
   if(name==='mobility_stage_g33_quarantined_zone_diagnostic')
    return {data:doc,error:null};
   throw Error('unexpected RPC');
  },...overrides
 };
 const q=createQoreG33InternalDiagnosticQa(options);
 return {inspect:(params={})=>q({
  bearer,zoneId,serviceKind:'AUTO_DELIVERY',...params
 }),calls};
}
test('G33.1 private QA read independently validates JWT, role, scope, rate, AAL2 and SQL',async()=>{
 const f=fixture();
 const r=await f.inspect();
 assert.equal(r.status,200);
 assert.deepEqual(r.body,doc);
 assert.deepEqual(f.calls.map(x=>typeof x==='string'?x:x.name),[
  'auth','mobility_stage_g27_backoffice_role_of',
  'mobility_stage_g27_backoffice_has_scope','rate','mfa',
  'mobility_stage_g33_quarantined_zone_diagnostic'
 ]);
 const diagnostic=f.calls.at(-1);
 assert.deepEqual(diagnostic.args,{
  _admin:userId,_zone:zoneId,_service:'AUTO_DELIVERY',_anchor_ms:at
 });
 assert.doesNotMatch(JSON.stringify(r.body),/driverId|phone|latitude|longitude|rawJwt|coordinate/);
});
test('G33.1 Owner and scope denials do not even query quarantine signals',async()=>{
 for(const [name,actual] of [
  ['mobility_stage_g27_backoffice_role_of','owner'],
  ['mobility_stage_g27_backoffice_has_scope',false]
 ]){
  const calls=[];
  const f=fixture({rpc:async(op)=>{
   calls.push(op);
   if(op===name)return {data:actual,error:null};
   if(op==='mobility_stage_g27_backoffice_role_of')return {data:'admin',error:null};
   if(op==='mobility_stage_g27_backoffice_has_scope')return {data:true,error:null};
   throw Error('Unexpected diagnostic queried');
  }});
  const r=await f.inspect();
  assert.equal(r.status,403);
  assert.ok(!calls.includes('mobility_stage_g33_quarantined_zone_diagnostic'));
 }
});
test('G33.1 authenticates Admin before reading, denies expired JWT or malformed scope input',async()=>{
 for(const identityMod of [
  {id:'invalid'}, {sessionId:'too'}, {expiresAtMs:at},
  {is_anonymous:true},{email_confirmed_at:null}
 ]){
  const f=fixture({verifyAccessToken:async()=>({...identity,...identityMod})});
  assert.equal((await f.inspect()).status,401);
  assert.equal(f.calls.length,0);
 }
 const badJwt=fixture();
 assert.equal((await badJwt.inspect({bearer:'bad'})).status,401);
 assert.equal((await badJwt.inspect({zoneId:'bad'})).status,400);
 assert.equal((await badJwt.inspect({serviceKind:'MOTO_PASAJERO'})).status,400);
 assert.equal(badJwt.calls.length,0);
 const revoked=fixture({verifyAccessToken:async()=>{throw Error('revoked')}});
 assert.equal((await revoked.inspect()).status,401);
});
test('G33.1 false MFA/session binding or missing limiter fails closed',async()=>{
 for(const changed of [
  {assuranceLevel:'aal1'}, {verifiedByProvider:false},
  {sessionId:'another-session-001'}, {userId:zoneId},
  {verifiedAtMs:at-43200001},{expiresAtMs:at}
 ]){
  const f=fixture({verifyBackofficeMfa:async()=>({...proof,...changed})});
  assert.equal((await f.inspect()).status,403);
  assert.ok(!f.calls.some(x=>x?.name==='mobility_stage_g33_quarantined_zone_diagnostic'));
 }
 assert.equal((await fixture({allowRequest:()=>false}).inspect()).status,429);
 assert.equal((await fixture({allowRequest:()=>{throw Error('offline')}}).inspect()).status,503);
 assert.equal((await fixture({verifyBackofficeMfa:async()=>{throw Error('offline')}}).inspect()).status,503);
});
test('G33.1 never returns forged availability, PII, overflow or inconsistent candidate counts',async()=>{
 for(const invalid of [
  {...doc,availabilityConfirmed:true},
  {...doc,publishedToG31:true},
  {...doc,dispatchAuthorized:true},
  {...doc,productionEnabled:true},
  {...doc,quarantinedRecentSignals:0,consentingIdleCandidates:1},
  {...doc,quarantinedRecentSignals:-1},
  {...doc,consentingIdleCandidates:100001},
  {...doc,zoneId:userId},
  {...doc,driverName:'personal'},
  {...doc,observedAtMs:at+30000},
  null
 ]){
  const f=fixture({rpc:async(name)=>{
   if(name==='mobility_stage_g27_backoffice_role_of')return {data:'admin'};
   if(name==='mobility_stage_g27_backoffice_has_scope')return {data:true};
   return {data:invalid};
  }});
  assert.equal((await f.inspect()).status,503);
 }
});
test('G33.1 impossible construction in LIVE or without trusted independent authorities',()=>{
 const args={environment:'isolated_staging',liveEnabled:false,localQaOnly:true,
  verifyAccessToken:async()=>{},verifyBackofficeMfa:async()=>{},
  allowRequest:()=>true,rpc:async()=>{}};
 for(const patch of [
  {environment:'production'},{liveEnabled:true},{localQaOnly:false},
  {verifyAccessToken:null},{verifyBackofficeMfa:null},
  {allowRequest:null},{rpc:null}
 ]){
  assert.throws(()=>createQoreG33InternalDiagnosticQa({...args,...patch}));
 }
});
