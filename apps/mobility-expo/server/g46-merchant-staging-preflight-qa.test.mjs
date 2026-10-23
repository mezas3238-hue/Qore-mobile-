import test from 'node:test';
import assert from 'node:assert/strict';
import {createG46MerchantStagingPreflightQa} from './g46-merchant-staging-preflight-qa.mjs';
const sha='a'.repeat(40),at=Date.parse('2026-10-23T19:00:00Z');
const checks={
 owner:['OWNER_EXPLICIT_STAGING_APPROVAL'],
 tls:['HTTPS_TLS_PEER_CERT_VERIFIED'],
 provider:['PINNED_JWT_ISSUER_AUDIENCE_JWKS',
  'PROVIDER_SESSION_REVOCATION_AND_AAL2'],
 database:['G6_G9_DML_AND_RPC_DENIAL','JWT_BOUND_PG_TRANSACTION_AND_RLS'],
 legal:['REAL_ZONE_LEGAL_ELIGIBILITY'],
 flags:['PSP_DISABLED_AND_NO_CLIENT_CHECKOUT',
  'CLIENT_DRIVER_ADMIN_RUNTIME_FLAGS_OFF'],
 secrets:['PRODUCTION_SECRETS_OUTSIDE_REPOSITORY']
};
const methods={
 owner:'inspectOwnerApproval',tls:'inspectTls',provider:'inspectProvider',
 database:'inspectDatabase',legal:'inspectLegal',flags:'inspectFlags',
 secrets:'inspectSecrets'
};
function mk(changes={},time=at){
 const inspectors=Object.fromEntries(Object.keys(checks).map(name=>
  [methods[name],async()=>({
   headSha:sha,observedAtMs:time,checks:Object.fromEntries(checks[name].map(k=>[k,true]))
  })]
 ));
 return createG46MerchantStagingPreflightQa({
  environment:'isolated_staging',liveEnabled:false,localQaOnly:true,
  expectedHeadSha:sha,now:()=>at,...inspectors,...changes
 });
}
test('G46 complete SYNTHETIC checklist never authorizes HTTPS, commerce, payment or LIVE',async()=>{
 const x=await mk()();
 assert.equal(x.qaChecklistPassed,true);
 assert.deepEqual(x.missingChecks,[]);
 for(const field of ['httpsStagingConnected','authProviderConnected',
  'clientRuntimeEnabled','paymentEnabled','activationPermitted','productionEnabled'])
  assert.equal(x[field],false,field);
 assert.equal(x.mode,'G46_SYNTHETIC_CHECKLIST_ONLY');
});
test('G46 does not infer Owner consent, TLS, JWKS, revocation, legal zones from other evidence',async()=>{
 const x=await mk({
  inspectOwnerApproval:async()=>{throw Error('Owner has not authorized staging');},
  inspectTls:async()=>null,
  inspectProvider:async()=>({headSha:sha,observedAtMs:at,
   checks:{PINNED_JWT_ISSUER_AUDIENCE_JWKS:true,
    PROVIDER_SESSION_REVOCATION_AND_AAL2:false}}),
  inspectLegal:async()=>({headSha:sha,observedAtMs:at,
   checks:{REAL_ZONE_LEGAL_ELIGIBILITY:false}})
 })();
 assert.equal(x.qaChecklistPassed,false);
 for(const k of ['OWNER_EXPLICIT_STAGING_APPROVAL',
  'HTTPS_TLS_PEER_CERT_VERIFIED','PROVIDER_SESSION_REVOCATION_AND_AAL2',
  'REAL_ZONE_LEGAL_ELIGIBILITY'])
  assert.ok(x.missingChecks.includes(k));
 assert.equal(x.activationPermitted,false);
});
test('G46 stale SHA/time, unsigned extra fields or spoofing from another inspector fail closed',async()=>{
 const x=await mk({
  inspectDatabase:async()=>({headSha:'b'.repeat(40),observedAtMs:at,
   checks:Object.fromEntries(checks.database.map(k=>[k,true]))}),
  inspectSecrets:async()=>({headSha:sha,observedAtMs:at-61000,
   checks:{PRODUCTION_SECRETS_OUTSIDE_REPOSITORY:true}}),
  inspectTls:async()=>({headSha:sha,observedAtMs:at,
   checks:{HTTPS_TLS_PEER_CERT_VERIFIED:true,
    accessToken:'sensitive-do-not-copy'}}),
  inspectOwnerApproval:async()=>({headSha:sha,observedAtMs:at,
   checks:{OWNER_EXPLICIT_STAGING_APPROVAL:true},
   email:'sensitive-owner@example.com'})
 })();
 assert.equal(x.qaChecklistPassed,false);
 for(const k of ['OWNER_EXPLICIT_STAGING_APPROVAL','HTTPS_TLS_PEER_CERT_VERIFIED',
  'G6_G9_DML_AND_RPC_DENIAL','PRODUCTION_SECRETS_OUTSIDE_REPOSITORY'])
  assert.ok(x.missingChecks.includes(k));
 assert.doesNotMatch(JSON.stringify(x),/accessToken|sensitive-owner|sensitive-do-not-copy/);
});
test('G46 cannot construct a production gate or omit independent attestations',()=>{
 for(const bad of [
  {environment:'production'}, {liveEnabled:true},{localQaOnly:false},
  {expectedHeadSha:'bad'}, {inspectOwnerApproval:null},
  {inspectDatabase:null},{inspectLegal:null}
 ])assert.throws(()=>mk(bad));
});
