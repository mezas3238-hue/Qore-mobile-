import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverKycOnboardingCommandQa,DRIVER_KYC_AUTOAPPROVAL_LIVE_ENABLED}
 from './driver-kyc-onboarding-command-qa.mjs';
const id=n=>'72720000-0000-4727-8727-'+String(n).padStart(12,'0');
const driver=id(1),vehicle=id(2),other=id(3),session=id(4),key=id(5),
 receipt=id(6);
const at=Date.parse('2026-10-24T18:00:00Z');
const bearer='pinned-staging-driver-identity-token-00112233';
const kinds=['licencia','identidad_frente','identidad_dorso','cedula_verde',
 'habilitacion','seguro','inspeccion','rostro_selfie'];
const related=new Set(['cedula_verde','habilitacion','seguro','inspeccion']);
const documents=()=>kinds.map(kind=>({
 kind,driverId:driver,vehicleId:related.has(kind)?vehicle:null,
 status:'verified',authenticityVerified:true,issuerVerified:true,
 expiryVerified:true,validUntilMs:at+86400000,verifiedAtMs:at-5000
}));
const face=()=>({driverId:driver,photoReceived:true,consentGranted:true,
 livenessVerified:true,identityFaceMatchVerified:true,trustedProviderVerified:true,
 verifiedAtMs:at-2000,expiresAtMs:at+60000});
const assignedVehicle=()=>({driverId:driver,vehicleId:vehicle,vehicleKind:'AUTO',
 ownershipVerified:true,registrationMatchesVehicle:true,
 vehicleEligibleForReview:true});
const request={method:'POST',path:'/v1/staging/driver/onboarding/review',
 headers:{authorization:'Bearer '+bearer},
 body:{requestKey:key,vehicleId:vehicle,vehicleKind:'AUTO'}};
const receiptBody={mode:'ISOLATED_QA_ONLY',decisionId:receipt,
 onboardingApprovedInQa:true,commercialDriverEligible:false,
 productionEnabled:false};
function setup(extra={}){
 const actions={db:[],auth:[],attest:[]};
 const fn=createDriverKycOnboardingCommandQa({
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,now:()=>at,
  verifyAccessToken:async t=>{actions.auth.push(t);
   return {id:driver,sessionId:session,tokenIatMs:at-4000,
    expiresAtMs:at+30000,is_anonymous:false};},
  verifySessionNotRevoked:async()=>true,
  resolveExclusiveDriverRole:async()=> 'driver',
  allowRequest:()=>true,
  readAttestedDocuments:async args=>{actions.attest.push(['documents',args]);return documents();},
  readAttestedFace:async args=>{actions.attest.push(['face',args]);return face();},
  readAttestedVehicle:async args=>{actions.attest.push(['vehicle',args]);return assignedVehicle();},
  approveAtomicOwnerOnly:async args=>{actions.db.push(args);return receiptBody;},
  ...extra
 });
 return {fn,actions};
}
test('KYC full verified driver dossier + consented selfie can be approved only by atomic SQL',async()=>{
 assert.equal(DRIVER_KYC_AUTOAPPROVAL_LIVE_ENABLED,false);
 const {fn,actions}=setup();
 const output=await fn(request);
 assert.equal(output.status,200);
 assert.deepEqual(output.body,{
  mode:'STAGING_DEMO_ONLY',reviewState:'QA_ONBOARDING_APPROVED',
  onboardingApprovedInQa:true,accountCommerciallyEnabled:false,
  driverEligible:false,qaOnly:true,productionEnabled:false
 });
 assert.deepEqual(actions.db,[{driverId:driver,vehicleId:vehicle,
  sessionId:session,tokenIatMs:at-4000,requestKey:key}]);
 assert.equal(actions.attest.length,3);
 const visible=JSON.stringify(output);
 for(const forbidden of [driver,vehicle,session,key,bearer,receipt,
  'selfieImage','photoBytes','faceTemplate','objectKey','sha256Hex'])
  assert.equal(visible.includes(forbidden),false);
});
test('KYC missing selfie, failed liveness, expired license, wrong vehicle never writes approval SQL',async()=>{
 for(const extra of [
  {readAttestedDocuments:async()=>documents().filter(x=>x.kind!=='rostro_selfie')},
  {readAttestedFace:async()=>({...face(),livenessVerified:false})},
  {readAttestedFace:async()=>({...face(),consentGranted:false})},
  {readAttestedFace:async()=>({...face(),identityFaceMatchVerified:false})},
  {readAttestedDocuments:async()=>documents().map(x=>x.kind==='licencia'?
   {...x,validUntilMs:at-1000}:x)},
  {readAttestedVehicle:async()=>({...assignedVehicle(),vehicleId:other})}
 ]){
  const {fn,actions}=setup(extra);
  const x=await fn(request);
  assert.equal(x.status,202);
  assert.equal(x.body.accountApproved,false);
  assert.equal(x.body.driverEligible,false);
  assert.equal(actions.db.length,0);
 }
});
test('KYC forged body, foreign role, revoked JWT, duplicate authorization and backend failure denied',async()=>{
 const {fn}=setup();
 for(const invalid of [
  {...request,body:{...request.body,driverId:driver}},
  {...request,body:{...request.body,faceVerified:true}},
  {...request,body:{...request.body,photo:'base64Sensitive'}},
  {...request,method:'GET'},
  {...request,path:'/v1/staging/admin/driver/onboarding/review'},
  {...request,headers:{authorization:'Bearer short'}},
  {...request,headers:{authorization:'Bearer '+bearer,cookie:'from-browser'}},
  {...request,headers:{authorization:'Bearer '+bearer,Authorization:'Bearer '+bearer}}
 ])assert.notEqual((await fn(invalid)).status,200);
 for(const ex of [
  {resolveExclusiveDriverRole:async()=> 'passenger'},
  {resolveExclusiveDriverRole:async()=> ['driver','passenger']},
  {verifySessionNotRevoked:async()=>false},
  {verifyAccessToken:async()=>{throw Error('JWT invalid')}},
  {allowRequest:()=>false},
  {readAttestedFace:async()=>{throw Error('verifier offline')}}
 ]){
  const {fn,actions}=setup(ex);
  assert.notEqual((await fn(request)).status,200);
  assert.equal(actions.db.length,0);
 }
});
test('KYC lost SQL receipt or forged success never activates commercial operations',async()=>{
 for(const sql of [
  async()=>{throw Error('unknown COMMIT')},
  async()=>({...receiptBody,productionEnabled:true}),
  async()=>({...receiptBody,driverEligible:true}),
  async()=>({...receiptBody,decisionId:'forged'}),
  async()=>({...receiptBody,commercialDriverEligible:true}),
  async()=>null
 ]){
  const {fn}=setup({approveAtomicOwnerOnly:sql});
  const output=await fn(request);
  assert.equal(output.status,503);
  assert.equal(output.body.retrySafe,false);
  assert.equal(output.body.productionEnabled,false);
 }
});
test('KYC cannot instantiate with LIVE mode or missing independently verified source',()=>{
 for(const extra of [
  {environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {readAttestedFace:null},{readAttestedDocuments:null},
  {approveAtomicOwnerOnly:null},{resolveExclusiveDriverRole:null}
 ])assert.throws(()=>setup(extra));
});
