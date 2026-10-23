import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreG35PrivateReadinessQa} from './g35-private-driver-evidence-qa.mjs';

const at=Date.parse('2026-10-23T12:00:00Z');
const userId='11111111-1111-4111-8111-111111111111';
const driverId='22222222-2222-4222-8222-222222222222';
const zoneId='33333333-3333-4333-8333-333333333333';
const bearer='syntheticProviderAuthBearerLongEnough1234567';
const identity={id:userId,sessionId:'qa-session-12345',
 expiresAtMs:at+900000,is_anonymous:false,
 email_confirmed_at:'2026-10-22T12:00:00Z'};
const proof={userId,sessionId:identity.sessionId,
 assuranceLevel:'aal2',verifiedByProvider:true,
 verifiedAtMs:at-1000,expiresAtMs:at+500000};
const doc={
 source:'QA_G35_DOCUMENTARY_DIAGNOSTIC_ONLY',
 hasFreshQuarantinedSignal:true,
 hasCurrentLocationConsent:true,
 freeOfActiveAssignments:true,
 vehicleDocumentEvidenceReviewed:true,
 candidateEvidenceComplete:true,
 zoneEligibleByPolicy:false,
 availabilityConfirmed:false,
 dispatchAuthorized:false,
 productionEnabled:false
};
function fixture(overrides={}){
 const calls=[];
 const options={
  environment:'isolated_staging',liveEnabled:false,localQaOnly:true,now:()=>at,
  verifyAccessToken:async()=>{calls.push('jwt');return identity;},
  verifyBackofficeMfa:async()=>{calls.push('mfa');return proof;},
  allowRequest:()=>{calls.push('rate');return true;},
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==='mobility_stage_g27_backoffice_role_of')
    return {data:'admin',error:null};
   if(name==='mobility_stage_g27_backoffice_has_scope')
    return {data:true,error:null};
   if(name==='mobility_stage_g35_driver_documentary_diagnostic')
    return {data:doc,error:null};
   throw Error('Unknown SQL RPC');
  },...overrides
 };
 const gateway=createQoreG35PrivateReadinessQa(options);
 const inspect=(args={})=>gateway({bearer,driverId,zoneId,
  serviceKind:'AUTO_DELIVERY',...args});
 return {calls,inspect};
}
test('G35.1 private admin preflight uses verified JWT role permission AAL2 and SQL, never dispatch',async()=>{
 const f=fixture(),r=await f.inspect();
 assert.equal(r.status,200);
 assert.deepEqual(r.body,doc);
 assert.deepEqual(f.calls.map(x=>typeof x==='string'?x:x.name),[
  'jwt','mobility_stage_g27_backoffice_role_of',
  'mobility_stage_g27_backoffice_has_scope','rate','mfa',
  'mobility_stage_g35_driver_documentary_diagnostic'
 ]);
 assert.deepEqual(f.calls.at(-1).args,{
  _admin:userId,_driver:driverId,_zone:zoneId,
  _service:'AUTO_DELIVERY',_anchor_ms:at
 });
 assert.doesNotMatch(JSON.stringify(r.body),/driverId|phone|plate|coordinates|lat|lng|token/);
 assert.equal(r.body.productionEnabled,false);
 assert.equal(r.body.dispatchAuthorized,false);
});
test('G35.1 denies Owner, absent scope, unverified or expired session before SQL',async()=>{
 for(const [name,result] of [
  ['mobility_stage_g27_backoffice_role_of','owner'],
  ['mobility_stage_g27_backoffice_has_scope',false]
 ]){
  const calls=[];
  const f=fixture({rpc:async(operation)=>{
   calls.push(operation);
   if(operation===name)return {data:result};
   if(operation==='mobility_stage_g27_backoffice_role_of')return {data:'admin'};
   if(operation==='mobility_stage_g27_backoffice_has_scope')return {data:true};
   throw Error('Should never reach actual documentary SQL');
  }});
  assert.equal((await f.inspect()).status,403);
  assert.ok(!calls.includes('mobility_stage_g35_driver_documentary_diagnostic'));
 }
 for(const invalid of [{id:'invalid'},{sessionId:'x'},
  {expiresAtMs:at},{is_anonymous:true},{email_confirmed_at:null}]){
  const f=fixture({verifyAccessToken:async()=>({...identity,...invalid})});
  assert.equal((await f.inspect()).status,401);
  assert.equal(f.calls.length,0);
 }
 assert.equal((await fixture({
  verifyAccessToken:async()=>{throw Error('revoked')}
 }).inspect()).status,401);
});
test('G35.1 malformed input or unsupported passenger motorcycle is rejected before provider',async()=>{
 const f=fixture();
 for(const arg of [
  {bearer:'bad'},{driverId:'bad'},{zoneId:'bad'},
  {serviceKind:'MOTO_PASAJERO'}, {serviceKind:'auto_delivery'},
  {serviceKind:'AUTO_RIDE',zoneId:'not-a-uuid'}
 ])assert.ok([400,401].includes((await f.inspect(arg)).status));
 assert.equal(f.calls.length,0);
});
test('G35.1 MFA and rate limit cannot be bypassed even when SQL is available',async()=>{
 for(const invalid of [
  {verifiedByProvider:false},{assuranceLevel:'aal1'},
  {userId:driverId},{sessionId:'another-session'},
  {verifiedAtMs:at-43200001},{expiresAtMs:at}
 ]){
  const f=fixture({verifyBackofficeMfa:async()=>({...proof,...invalid})});
  assert.equal((await f.inspect()).status,403);
  assert.ok(!f.calls.some(x=>x?.name==='mobility_stage_g35_driver_documentary_diagnostic'));
 }
 assert.equal((await fixture({allowRequest:()=>false}).inspect()).status,429);
 assert.equal((await fixture({allowRequest:()=>{throw Error('offline')}}).inspect()).status,503);
 assert.equal((await fixture({verifyBackofficeMfa:async()=>{throw Error('offline')}}).inspect()).status,503);
});
test('G35.1 reject fabricated readiness, PII, contradictory fields, or source outage',async()=>{
 const make=over=>fixture({rpc:async name=>{
  if(name==='mobility_stage_g27_backoffice_role_of')return {data:'admin'};
  if(name==='mobility_stage_g27_backoffice_has_scope')return {data:true};
  return {data:over};
 }});
 const invalid=[
  {...doc,candidateEvidenceComplete:false},
  {...doc,vehicleDocumentEvidenceReviewed:false},
  {...doc,zoneEligibleByPolicy:true},
  {...doc,availabilityConfirmed:true},
  {...doc,dispatchAuthorized:true},
  {...doc,productionEnabled:true},
  {...doc,driverId},
  {...doc,source:'REAL_DRIVER_AVAILABLE'},
  {...doc,freeOfActiveAssignments:1},
  null
 ];
 for(const x of invalid)assert.equal((await make(x).inspect()).status,503);
 assert.equal((await fixture({rpc:async()=>{throw Error('database down')}}).inspect()).status,503);
});
test('G35.1 construction forbidden without trusted providers or outside isolated QA',()=>{
 const common={environment:'isolated_staging',liveEnabled:false,localQaOnly:true,
  rpc:async()=>{},verifyAccessToken:async()=>{},
  verifyBackofficeMfa:async()=>{},allowRequest:()=>true};
 for(const patch of [
  {environment:'production'},{environment:'staging'},
  {liveEnabled:true},{localQaOnly:false},
  {rpc:null},{verifyAccessToken:null},{verifyBackofficeMfa:null},
  {allowRequest:null}
 ])assert.throws(()=>createQoreG35PrivateReadinessQa({...common,...patch}));
});
