import test from 'node:test';
import assert from 'node:assert/strict';
import {DRIVER_REQUIRED_KYC_KINDS,evaluateDriverAutoApproval,
 createDriverKycAutoReviewQa,AUTO_DRIVER_ACCOUNT_APPROVAL_LIVE_ENABLED}
 from './driver-kyc-auto-approval-qa.mjs';
const id=n=>'71710000-0000-4717-8717-'+String(n).padStart(12,'0');
const driver=id(1),vehicle=id(2),other=id(3),session=id(4);
const now=Date.parse('2026-10-24T18:00:00Z');
const token='private-verified-driver-session-token-00000';
const kinds=['licencia','identidad_frente','identidad_dorso','cedula_verde',
 'habilitacion','seguro','inspeccion','rostro_selfie'];
const vehKinds=new Set(['cedula_verde','habilitacion','seguro','inspeccion']);
function docs(){
 return kinds.map(kind=>({
  kind,driverId:driver,vehicleId:vehKinds.has(kind)?vehicle:null,
  status:'verified',authenticityVerified:true,issuerVerified:true,
  expiryVerified:true,validUntilMs:now+86400000,
  verifiedAtMs:now-60000
 }));
}
const face=()=>({driverId:driver,photoReceived:true,consentGranted:true,
 livenessVerified:true,identityFaceMatchVerified:true,
 trustedProviderVerified:true,verifiedAtMs:now-60000,expiresAtMs:now+60000});
const veh=()=>({driverId:driver,vehicleId:vehicle,vehicleKind:'AUTO',
 ownershipVerified:true,registrationMatchesVehicle:true,
 vehicleEligibleForReview:true});
const evaluate=({documents=docs(),f=face(),v=veh(),...rest}={})=>
 evaluateDriverAutoApproval({driverId:driver,vehicleId:vehicle,
  vehicleKind:'AUTO',documents,face:f,vehicle:v,now,...rest});
test('full mandatory dossier including facial photo qualifies only for atomic backend review',()=>{
 assert.equal(AUTO_DRIVER_ACCOUNT_APPROVAL_LIVE_ENABLED,false);
 assert.deepEqual(DRIVER_REQUIRED_KYC_KINDS,kinds);
 const result=evaluate();
 assert.equal(result.reviewState,'READY_FOR_ATOMIC_APPROVAL');
 assert.equal(result.eligibleForAutomaticApproval,true);
 assert.equal(result.accountApproved,false,'evaluation cannot approve an account');
 assert.equal(result.driverEligible,false);
 assert.equal(result.productionEnabled,false);
 assert(!JSON.stringify(result).includes(driver));
 assert(!JSON.stringify(result).includes(vehicle));
});
test('missing face image, missing identity card or habilitacion prevents auto-approval',()=>{
 for(const missing of kinds){
  const outcome=evaluate({documents:docs().filter(d=>d.kind!==missing)});
  assert.equal(outcome.reviewState,'PENDING_DOCUMENTS',missing);
  assert.equal(outcome.eligibleForAutomaticApproval,false);
  assert.deepEqual(outcome.missingKinds,[missing]);
 }
});
test('biometric consent, liveness and ID matching all independently required',()=>{
 for(const property of ['photoReceived','consentGranted',
  'livenessVerified','identityFaceMatchVerified','trustedProviderVerified']){
  const outcome=evaluate({f:{...face(),[property]:false}});
  assert.equal(outcome.reviewState,'MANUAL_REVIEW',property);
  assert.deepEqual(outcome.needsReview,['rostro_selfie']);
 }
 const expired=evaluate({f:{...face(),expiresAtMs:now-1}});
 assert.equal(expired.reviewState,'MANUAL_REVIEW');
 assert.equal(expired.accountApproved,false);
});
test('expiry, counterfeit, provider not verified and rejected docs block automatic approval',()=>{
 for(const property of ['authenticityVerified','issuerVerified','expiryVerified']){
  const list=docs();list[0]={...list[0],[property]:false};
  const outcome=evaluate({documents:list});
  assert.equal(outcome.reviewState,'PENDING_VERIFICATION',property);
  assert.equal(outcome.accountApproved,false);
 }
 for(const status of ['pending','expired','rejected','disputed']){
  const list=docs();list[4]={...list[4],status};
  const result=evaluate({documents:list});
  assert.notEqual(result.reviewState,'READY_FOR_ATOMIC_APPROVAL');
  assert.equal(result.eligibleForAutomaticApproval,false);
  assert.equal(result.reviewState,['rejected','disputed'].includes(status)
   ?'MANUAL_REVIEW':'PENDING_VERIFICATION');
 }
 const list=docs();list[1]={...list[1],validUntilMs:now-1};
 assert.equal(evaluate({documents:list}).reviewState,'PENDING_VERIFICATION');
});
test('cross-vehicle, cross-driver, duplicates and spoofed extra metadata block approval',()=>{
 for(const bad of [
  {...docs()[3],vehicleId:other},
  {...docs()[0],driverId:other},
  {...docs()[0],driverId:driver,ocrName:'claimed real name'},
  {...docs()[0],verifiedAtMs:now+60000}
 ]){
  const list=docs();list[kinds.indexOf(bad.kind)]=bad;
  assert.equal(evaluate({documents:list}).reviewState,'MANUAL_REVIEW');
 }
 assert.equal(evaluate({documents:[...docs(),docs()[0]]}).reviewState,'MANUAL_REVIEW');
 assert.equal(evaluate({v:{...veh(),ownershipVerified:false}}).reviewState,'MANUAL_REVIEW');
 assert.equal(evaluate({v:{...veh(),vehicleId:other}}).reviewState,'MANUAL_REVIEW');
});
test('server only: independent JWT, exclusive Driver, valid G42, no PII or raw face in result',async()=>{
 const checks=[];
 const cfg={
  environment:'isolated_staging',liveEnabled:false,now:()=>now,
  verifyAccessToken:async()=>({id:driver,sessionId:session,
   tokenIatMs:now-10000,expiresAtMs:now+10000,is_anonymous:false}),
  verifySessionNotRevoked:async params=>{checks.push(['session',params]);return true;},
  resolveExclusiveDriverRole:async subject=>{checks.push(['role',subject]);return 'driver';},
  readAttestedDocuments:async params=>{checks.push(['docs',params]);return docs();},
  readAttestedFace:async params=>{checks.push(['face',params]);return face();},
  readAttestedVehicle:async params=>{checks.push(['vehicle',params]);return veh();}
 };
 const review=createDriverKycAutoReviewQa(cfg);
 const result=await review({accessToken:token,vehicleId:vehicle,vehicleKind:'AUTO'});
 assert.equal(result.reviewState,'READY_FOR_ATOMIC_APPROVAL');
 assert.equal(result.accountApproved,false);
 assert.equal(checks.filter(x=>x[0]==='session').length,1);
 assert.equal(checks.filter(x=>x[0]==='face').length,1);
 assert(!JSON.stringify(result).includes(token));
 assert(!JSON.stringify(result).includes(driver));
 assert(!JSON.stringify(result).includes('photo'));
 for(const overrides of [
  {resolveExclusiveDriverRole:async()=> 'passenger'},
  {resolveExclusiveDriverRole:async()=> ['driver','passenger']},
  {verifySessionNotRevoked:async()=>false},
  {readAttestedFace:async()=>{throw Error('facial service offline')}},
  {verifyAccessToken:async()=>{throw Error('expired')}},
  {readAttestedDocuments:async()=>[]}
 ]){
  const safe=await createDriverKycAutoReviewQa({...cfg,...overrides})({
   accessToken:token,vehicleId:vehicle,vehicleKind:'AUTO'
  });
  assert.equal(safe.accountApproved,false);
  assert.equal(safe.eligibleForAutomaticApproval,false);
 }
 assert.throws(()=>createDriverKycAutoReviewQa({...cfg,liveEnabled:true}));
});
