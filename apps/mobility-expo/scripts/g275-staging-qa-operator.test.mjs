import test from 'node:test';
import assert from 'node:assert/strict';
import {stageAndProveEightQa,verifyExistingEightQa} from './g275-staging-qa-operator.mjs';
import {QA_SLOTS,STAGING_REF} from './qore-staging-qa-identity-bootstrap.mjs';

const manifest=QA_SLOTS.map(([slot,role],i)=>({
 slot,role,email:'qa-'+slot+'@example.invalid',
 password:'offline-only-unique-secret-000'+i+'-do-not-use'
}));
const conf={ref:STAGING_REF,environment:'staging',liveTripsEnabled:'false',
 publicKey:'sb_publishable_'+'p'.repeat(36),
 secret:'sb_secret_'+'s'.repeat(36),manifest};
function spies({createCount=8,auditCount=8,revoked=8,auditMode='STAGING_READ_ONLY'}={}){
 const calls=[];
 const provision=async()=>{calls.push('provision');return {mode:'STAGING_ONLY',
  count:createCount,roles:QA_SLOTS.map(x=>x[1]),commercialEnabled:false};};
 const audit=async()=>{calls.push('audit');return {mode:auditMode,qaAuthAccounts:auditCount,
  exclusiveQaRoles:8,signupDisabled:true,projectPinned:true,
  externalJourneysCertified:0,roleCounts:{admin:1,driver:4,passenger:3}};};
 const verifySessions=async()=>{calls.push('sessions');return {
  mode:'PROVIDER_AUTH_SESSION_ONLY',
  eightIndependentPasswordSessionsVerified:8,crossIdentitySessionDenied:1,
  verifiedLocallyRevokedSessions:revoked,externalJourneysCertified:0,
  commercialLaunchAllowed:false};};
 return {provision,audit,verifySessions,calls};
}
test('G275 connects bootstrap, read-only identity audit and G42 revoked-session proof',async()=>{
 const s=spies();
 const result=await stageAndProveEightQa({...conf,...s});
 assert.deepEqual(s.calls,['provision','audit','sessions']);
 assert.equal(result.authAccounts,8);
 assert.equal(result.independentSessionsVerified,8);
 assert.equal(result.revokedLocalSessionsVerified,8);
 assert.equal(result.externalJourneysCertified,0);
 assert.equal(result.commercialLaunchAllowed,false);
 assert.equal(result.backofficeOwnerApprovalCertified,false);
});
test('G275 validates staging ref, NO LIVE and manifest before any external call',async()=>{
 for(const override of [{ref:'qdqrlgzlotnfdxzpacxs'},
  {environment:'production'},{liveTripsEnabled:'true'},
  {manifest:manifest.slice(1)},{secret:conf.publicKey}]){
  const s=spies();
  await assert.rejects(stageAndProveEightQa({...conf,...s,...override}));
  assert.equal(s.calls.length,0);
 }
});
test('G275 stops before later stage on incomplete creation or unexpected audit',async()=>{
 for(const defect of [{createCount:7},{auditCount:7},{auditMode:'UNKNOWN'}]){
  const s=spies(defect);
  await assert.rejects(stageAndProveEightQa({...conf,...s}));
  assert.equal(s.calls.includes('sessions'),false);
 }
});
test('G275 refuses certification if session revocation evidence is partial',async()=>{
 const s=spies({revoked:7});
 await assert.rejects(stageAndProveEightQa({...conf,...s}));
 assert.deepEqual(s.calls,['provision','audit','sessions']);
});

test('G276 verify-only resumes proof for existing eight actors without calling bootstrap',async()=>{
 const s=spies();
 const result=await verifyExistingEightQa({...conf,...s});
 assert.deepEqual(s.calls,['audit','sessions']);
 assert.equal(result.authAccounts,8);
 assert.equal(result.independentSessionsVerified,8);
 assert.equal(result.externalJourneysCertified,0);
});
test('G276 verify-only rejects partial identities without sessions or account mutation',async()=>{
 const s=spies({auditCount:7});
 await assert.rejects(verifyExistingEightQa({...conf,...s}));
 assert.deepEqual(s.calls,['audit']);
});
test('G276 verify-only checks staging, flags and QA manifest before network',async()=>{
 for(const override of [
  {ref:'qdqrlgzlotnfdxzpacxs'},{environment:'production'},
  {liveTripsEnabled:'true'},{manifest:manifest.slice(1)}
 ]){
  const s=spies();
  await assert.rejects(verifyExistingEightQa({...conf,...s,...override}));
  assert.deepEqual(s.calls,[]);
 }
});
test('G276 verify-only refuses fake session evidence or incomplete logout',async()=>{
 const s=spies({revoked:7});
 await assert.rejects(verifyExistingEightQa({...conf,...s}));
 assert.deepEqual(s.calls,['audit','sessions']);
});
