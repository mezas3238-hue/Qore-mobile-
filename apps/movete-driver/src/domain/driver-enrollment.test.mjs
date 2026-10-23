import test from 'node:test';
import assert from 'node:assert/strict';
import {enrollDriverIdentity,DRIVER_ENROLLMENT_LIVE_ENABLED}
 from './driver-enrollment.mjs';
const origin='http://127.0.0.1:4141';
const token='a'.repeat(60);
const requestKey='11111111-1111-4111-8111-111111111111';
const enrollmentId='22222222-2222-4222-8222-222222222222';
const response={mode:'STAGING_DEMO_ONLY',status:'pending_compliance',enrollmentId,
 driverEligible:false,liveOperationsEnabled:false};
function mock(data=response,status=202){
 const seen={};
 const request=async(url,opts)=>{seen.url=url;seen.opts=opts;
  return {status,json:async()=>data};
 };
 return {seen,request};
}
const enroll=(params={})=>enrollDriverIdentity({apiOrigin:origin,
 accessToken:token,requestKey,driverConsent:true,...params});
test('Driver enrollment sends explicit consent and stable key, not role/actor fields',async()=>{
 assert.equal(DRIVER_ENROLLMENT_LIVE_ENABLED,false);
 const m=mock();const result=await enroll({request:m.request});
 assert.deepEqual(result,{enrollmentId,status:'pending_compliance',
  driverEligible:false,liveEnabled:false});
 assert.ok(Object.isFrozen(result));
 assert.equal(m.seen.url,origin+'/v1/staging/driver/enrollment');
 assert.equal(m.seen.opts.method,'POST');
 assert.equal(m.seen.opts.credentials,'omit');
 assert.equal(m.seen.opts.cache,'no-store');
 assert.equal(m.seen.opts.headers.authorization,'Bearer '+token);
 assert.deepEqual(JSON.parse(m.seen.opts.body),{requestKey,driverConsent:true});
 assert.doesNotMatch(m.seen.opts.body,/role|driverId|passengerId|approved|admin/i);
});
test('Driver enrollment cannot happen without explicit consent or verified bearer',async()=>{
 let calls=0;const request=async()=>{calls++;throw Error('MUST NOT CONTACT')};
 for(const values of [{driverConsent:false},{driverConsent:null},
  {accessToken:''},{accessToken:'bad'},{requestKey:'bad'},
  {apiOrigin:'https://remote.example'},{apiOrigin:'http://localhost:4141'},
  {apiOrigin:'http://0.0.0.0:4141'},
  {apiOrigin:'http://127.0.0.1:4141/route'},
  {apiOrigin:'http://admin:pass@127.0.0.1:4141'}]){
  await assert.rejects(()=>enroll({...values,request}));
 }
 assert.equal(calls,0);
});
test('Driver enrollment does not invent eligibility after network or server rejection',async()=>{
 await assert.rejects(()=>enroll({request:mock(response,401).request}),/session expired/);
 await assert.rejects(()=>enroll({request:mock(response,403).request}),/role ineligible/);
 await assert.rejects(()=>enroll({request:mock(response,409).request}),/separate identity/);
 await assert.rejects(()=>enroll({request:async()=>{throw Error('private error')}}),/uncertain/);
 for(const bad of [
  {...response,status:'approved'},
  {...response,driverEligible:true},
  {...response,liveOperationsEnabled:true},
  {...response,enrollmentId:'fake'},
  {...response,driverId:'private'}
 ]){
  await assert.rejects(()=>enroll({request:mock(bad).request}));
 }
});
test('Driver uncertain enrollment retry reuses the same caller-owned requestKey',async()=>{
 const sent=[];const request=async(url,opts)=>{
  sent.push(JSON.parse(opts.body));
  if(sent.length===1)throw Error('network uncertainty');
  return {status:202,json:async()=>response};
 };
 const params={request};
 await assert.rejects(()=>enroll(params),/uncertain/);
 assert.equal((await enroll(params)).status,'pending_compliance');
 assert.deepEqual(sent,[{requestKey,driverConsent:true},{requestKey,driverConsent:true}]);
});
