import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverKycReadinessGateway,G20_LICENSE_READINESS_LIVE_ENABLED as API_LIVE}
 from './g20-driver-kyc-readiness-gateway.mjs';
import {createDriverKycReadinessRepository,G20_LICENSE_READINESS_LIVE_ENABLED as DB_LIVE}
 from './g20-driver-kyc-readiness-repository.mjs';
const driver='11111111-1111-4111-8111-111111111111';
const token='a'.repeat(60),path='/v1/staging/driver/license-readiness';
const request={method:'GET',path,headers:{authorization:'Bearer '+token}};
function gateway(overrides={}){
 const calls=[];
 const handler=createDriverKycReadinessGateway({
  projectRef:'staging1234567890abcd',
  verifyAccessToken:async value=>{
   calls.push(['auth',value]);
   return {id:driver,email_confirmed_at:'2026-10-22T00:00:00Z',is_anonymous:false};
  },
  authorizeDriver:async id=>{calls.push(['role',id]);return true;},
  allowRequest:args=>{calls.push(['rate',args]);return true;},
  currentLicenseApproved:async args=>{
   calls.push(['license',args]);return true;
  },...overrides
 });
 return {handler,calls};
}
test('G20 gateway is private, read-only and makes NO LIVE eligibility assertions',async()=>{
 assert.equal(API_LIVE,false);assert.equal(DB_LIVE,false);
 const {handler,calls}=gateway();
 const out=await handler(request);
 assert.equal(out.status,200);
 assert.deepEqual(out.body,{mode:'STAGING_DEMO_ONLY',
  currentLicenseApproved:true,driverEligible:false,liveOperationsEnabled:false,
  verificationScope:'CURRENT_LICENSE_REVIEW_ONLY'});
 assert.deepEqual(calls.at(-1),['license',{driverId:driver}]);
 assert.doesNotMatch(JSON.stringify(out),/licensePath|hash|reviewer|driverId|phone/i);
});
test('G20 rejects spoofed driver identities, unverified JWT and request bodies',async()=>{
 const {handler,calls}=gateway();
 assert.equal((await handler({...request,body:{driverId:driver}})).status,400);
 assert.equal((await handler({...request,path:path+'?driverId='+driver})).status,404);
 assert.equal((await handler({...request,method:'POST'})).status,404);
 assert.equal((await handler({...request,headers:{}})).status,401);
 assert.equal(calls.filter(v=>v[0]==='license').length,0);
 assert.equal((await gateway({verifyAccessToken:async()=>{throw Error('JWT')}})
  .handler(request)).status,401);
 assert.equal((await gateway({verifyAccessToken:async()=>({
  id:driver,is_anonymous:true,email_confirmed_at:'2026-10-22'})})
  .handler(request)).status,401);
 assert.equal((await gateway({authorizeDriver:async()=>false})
  .handler(request)).status,403);
 assert.equal((await gateway({allowRequest:()=>false})
  .handler(request)).status,429);
});
test('G20 fails closed if lookup is unavailable, malformed or revoked',async()=>{
 for(const callback of [async()=>null,async()=>1,
  async()=>{throw Error('private database exception')}]){
  const {handler}=gateway({currentLicenseApproved:callback});
  const out=await handler(request);
  assert.equal(out.status,503);
  assert.doesNotMatch(JSON.stringify(out),/private database exception/);
 }
 const {handler}=gateway({currentLicenseApproved:async()=>false});
 assert.equal((await handler(request)).body.currentLicenseApproved,false);
});
test('G20 repository calls exactly one service-role SQL function and validates boolean',async()=>{
 const calls=[];
 const repo=createDriverKycReadinessRepository({rpc:async(name,args)=>{
  calls.push({name,args});return {data:true,error:null};
 }});
 assert.equal(await repo.currentLicenseApproved({driverId:driver}),true);
 assert.deepEqual(calls,[{name:'mobility_stage_driver_current_license_approved',
  args:{_driver_id:driver}}]);
 await assert.rejects(()=>repo.currentLicenseApproved({driverId:'invalid'}));
 for(const response of [{data:null,error:null},{data:'true',error:null},
  {data:false,error:{message:'db'}},null]){
  const broken=createDriverKycReadinessRepository({rpc:async()=>response});
  await assert.rejects(()=>broken.currentLicenseApproved({driverId:driver}));
 }
 assert.throws(()=>createDriverKycReadinessRepository({}),/Trusted G20 RPC/);
});
