import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverKycExpiryStatusQa,DRIVER_KYC_EXPIRY_LIVE_ENABLED}
 from './driver-kyc-expiry-status-qa.mjs';
const id=n=>'72720000-0000-4727-8727-'+String(n).padStart(12,'0');
const driver=id(1),session=id(2),vehicle=id(3),other=id(4);
const at=Date.parse('2026-10-24T18:00:00Z'),bearer='qa-private-signed-driver-token-000000000';
const dto={mode:'STAGING_DEMO_ONLY',state:'BLOCKED_EXPIRED',
 expiredKinds:['licencia'],renewalRequiredKinds:['licencia'],
 expiringSoonKinds:[],nearestExpiryAtMs:at+864000000,
 accountBlocked:true,qaOnboardingActive:false,
 commercialDispatchAuthorized:false,qaOnly:true,productionEnabled:false};
function setup(extra={}){
 const calls=[];const f=createDriverKycExpiryStatusQa({
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  now:()=>at,
  verifyAccessToken:async()=>({id:driver,sessionId:session,
   tokenIatMs:at-1000,expiresAtMs:at+60000,is_anonymous:false}),
  verifySessionNotRevoked:async()=>true,
  resolveExclusiveRole:async()=> 'driver',
  resolveActiveVehicle:async()=>({driverId:driver,vehicleId:vehicle}),
  allowRequest:()=>true,
  queryOwnerValidity:async scope=>{calls.push(scope);return dto;},...extra
 });return {f,calls};
}
test('KYC expiry authenticated Driver sees only document categories and block state',async()=>{
 assert.equal(DRIVER_KYC_EXPIRY_LIVE_ENABLED,false);
 const {f,calls}=setup();const r=await f({bearer});
 assert.equal(r.status,200);assert.deepEqual(r.body,dto);
 assert.deepEqual(calls,[{driverId:driver,vehicleId:vehicle}]);
 for(const sensitive of [driver,vehicle,session,bearer,'faceTemplate','objectKey','expiresAtRaw']){
  assert.equal(JSON.stringify(r).includes(sensitive),false);
 }
});
test('Independently verified renewal automatically restores only QA state',async()=>{
 const active={...dto,state:'READY_QA',expiredKinds:[],renewalRequiredKinds:[],
  qaOnboardingActive:true,accountBlocked:false};
 const {f}=setup({queryOwnerValidity:async()=>active});
 assert.deepEqual((await f({bearer})).body,active);
 assert.equal((await f({bearer})).body.commercialDispatchAuthorized,false);
});
test('No access for revoked session, wrong role or foreign assigned vehicle',async()=>{
 for(const changes of [
  {verifyAccessToken:async()=>{throw Error('invalid JWT')}},
  {verifySessionNotRevoked:async()=>false},
  {resolveExclusiveRole:async()=> 'passenger'},
  {resolveExclusiveRole:async()=> ['driver','passenger']},
  {resolveActiveVehicle:async()=>({driverId:other,vehicleId:vehicle})},
  {resolveActiveVehicle:async()=>({driverId:driver,vehicleId:'bad'})},
  {allowRequest:()=>false}
 ]){
  const {f,calls}=setup(changes);
  const r=await f({bearer});
  assert.equal(r.status,503);
  assert.equal(calls.length,0);
 }
});
test('Forged active, PII, future expiry contradiction and missing categories fail closed',async()=>{
 for(const invalid of [
  {...dto,state:'READY_QA'},
  {...dto,qaOnboardingActive:true},
  {...dto,accountBlocked:false},
  {...dto,commercialDispatchAuthorized:true},
  {...dto,driverPhone:'0991-private'},
  {...dto,expiredKinds:[]},
  {...dto,renewalRequiredKinds:[]},
  {...dto,nearestExpiryAtMs:at-1},
  {...dto,expiredKinds:['licencia','licencia']},
  {...dto,expiredKinds:['passport']},
  {...dto,productionEnabled:true}
 ]){
  const {f}=setup({queryOwnerValidity:async()=>invalid});
  assert.equal((await f({bearer})).status,503);
 }
});
test('Production and absent authority cannot instantiate',()=>{
 for(const opt of [{environment:'production'},{liveEnabled:true},
  {localQaOnly:false},{verifyAccessToken:null},
  {queryOwnerValidity:null},{verifySessionNotRevoked:null}])
  assert.throws(()=>setup(opt));
});
