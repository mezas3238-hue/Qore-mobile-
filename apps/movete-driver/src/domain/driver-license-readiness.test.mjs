import test from 'node:test';
import assert from 'node:assert/strict';
import {readDriverLicenseReadiness,DRIVER_LICENSE_READINESS_LIVE_ENABLED}
 from './driver-license-readiness.mjs';
const apiOrigin='http://127.0.0.1:4141',accessToken='a'.repeat(60);
const payload={mode:'STAGING_DEMO_ONLY',currentLicenseApproved:true,
 driverEligible:false,liveOperationsEnabled:false,
 verificationScope:'CURRENT_LICENSE_REVIEW_ONLY'};
function fake(data=payload,status=200){
 const seen={};
 const request=async(url,options)=>{
  seen.url=url;seen.options=options;
  return {status,json:async()=>data};
 };
 return {request,seen};
}
const read=(input={})=>readDriverLicenseReadiness({
 apiOrigin,accessToken,...input
});
test('Driver license status is only review state, never operational eligibility',async()=>{
 assert.equal(DRIVER_LICENSE_READINESS_LIVE_ENABLED,false);
 const f=fake(),result=await read({request:f.request});
 assert.deepEqual(result,{currentLicenseApproved:true,driverEligible:false,
  liveEnabled:false,scope:'CURRENT_LICENSE_REVIEW_ONLY'});
 assert.equal(Object.isFrozen(result),true);
 assert.equal(f.seen.url,apiOrigin+'/v1/staging/driver/license-readiness');
 assert.equal(f.seen.options.method,'GET');
 assert.equal(f.seen.options.cache,'no-store');
 assert.equal(f.seen.options.credentials,'omit');
 assert.equal(f.seen.options.headers.authorization,'Bearer '+accessToken);
 assert.doesNotMatch(JSON.stringify(result),/licensePath|sha256|reviewer|name|phone/);
});
test('Driver license review fails closed on remote origin or missing token',async()=>{
 let count=0;
 const request=async()=>{count++;throw Error('No network allowed')};
 for(const apiOrigin of ['https://stage.example',
  'http://localhost:4141','http://0.0.0.0:4141',
  'http://127.0.0.1:4141/?driverId=private',
  'http://127.0.0.1:4141/private',
  'http://user:pass@127.0.0.1:4141']){
  await assert.rejects(()=>read({apiOrigin,request}));
 }
 await assert.rejects(()=>read({accessToken:'',request}));
 await assert.rejects(()=>read({accessToken:'bad',request}));
 assert.equal(count,0);
});
test('Driver rejects LIVE claims and private fields in readiness snapshots',async()=>{
 for(const value of [
  {...payload,driverEligible:true},
  {...payload,liveOperationsEnabled:true},
  {...payload,currentLicenseApproved:'yes'},
  {...payload,verificationScope:'ALL_ELIGIBILITY'},
  {...payload,sha256Hex:'private'},
  {...payload,driverId:'private'},
  null
 ]){
  await assert.rejects(()=>read({request:fake(value).request}));
 }
 const unavailable=await read({request:fake({...payload,currentLicenseApproved:false}).request});
 assert.equal(unavailable.currentLicenseApproved,false);
});
test('Driver license query does not retain old data after logout/offline',async()=>{
 await assert.rejects(()=>read({request:fake(payload,401).request}),/session expired/);
 await assert.rejects(()=>read({request:fake(payload,403).request}),/role not authorized/);
 await assert.rejects(()=>read({request:fake(payload,503).request}),/unavailable/);
 await assert.rejects(()=>read({request:async()=>{throw Error('private')}}),/unavailable/);
});
