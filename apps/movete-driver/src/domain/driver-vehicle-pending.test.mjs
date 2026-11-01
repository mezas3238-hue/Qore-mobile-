import test from 'node:test';
import assert from 'node:assert/strict';
import {submitDriverPendingVehicle,validateDriverPendingVehicleDraft}
 from './driver-vehicle-pending.mjs';
const origin='https://qore-mobile-backend-staging-staging.up.railway.app';
const host='qore-mobile-backend-staging-staging.up.railway.app';
const uuid='00000000-0000-4000-8000-000000000101';
const requestKey='00000000-0000-4000-8000-000000000401';
const applicationId='00000000-0000-4000-8000-000000000501';
const token='a'.repeat(24)+'.'+'b'.repeat(24)+'.'+'c'.repeat(24);
const draft={kind:'AUTO',service:'economico',
 plate:'REAL123',brand:'Real Motor',model:'City',year:2023,passengerCapacity:4};
const auth={getSession:async()=>({role:'driver',userId:uuid,accessToken:token})};
function run({status=202,receipt=null,session=auth}={}){
 const requests=[];const request=async(url,options)=>{
  requests.push({url,options});
  return Response.json(receipt??{
   mode:'STAGING_DEMO_ONLY',applicationId,status:'pending',
   evidenceVerified:false,driverEligible:false,commercialEnabled:false
  },{status});
 };
 const submit=options=>submitDriverPendingVehicle({
  auth:session,request,apiOrigin:origin,approvedStagingHost:host,
  allowedByOwner:true,liveEnabled:false,
  draft,requestKey,...options
 });
 return {submit,requests};
}
test('G287 valid real draft posts to exact approved HTTPS STAGING path',async()=>{
 const x=run(),r=await x.submit();
 assert.deepEqual(r,{ok:true,applicationId,status:'pending',driverEligible:false,
  commercialEnabled:false});
 assert.equal(x.requests.length,1);
 const call=x.requests[0];
 assert.equal(call.url,origin+'/v1/staging/vehicle-applications');
 assert.equal(call.options.method,'POST');
 assert.equal(call.options.credentials,'omit');
 assert.equal(call.options.redirect,'error');
 assert.equal(call.options.headers.authorization,'Bearer '+token);
 assert.deepEqual(JSON.parse(call.options.body),{requestKey,...draft});
 assert.equal('approved' in JSON.parse(call.options.body),false);
 assert.equal('driverId' in JSON.parse(call.options.body),false);
 assert.equal('municipalityCode' in JSON.parse(call.options.body),false);
});
test('G287 rejects disabled mobile flag before accessing Auth or transport',async()=>{
 const x=run();
 const r=await x.submit({allowedByOwner:false});
 assert.equal(r.ok,false);assert.equal(r.code,'STAGING_VEHICLE_DRAFT_DISABLED');
 assert.equal(x.requests.length,0);
});
test('G287 denies arbitrary host and insecure HTTP before Auth',async()=>{
 const x=run();
 for(const options of [
  {apiOrigin:'http://'+host},
  {apiOrigin:'https://wrong-staging.example.com'},
  {approvedStagingHost:'wrong-staging.example.com'},
  {apiOrigin:origin+'/v1/staging/admin'},
  {apiOrigin:origin+'?target=live'}
 ]){
  const r=await x.submit(options);
  assert.equal(r.ok,false);
  assert.equal(r.code,'STAGING_ORIGIN_NOT_PINNED');
 }
 assert.equal(x.requests.length,0);
});
test('G287 rejects absent/Passenger/stale verified session before POST',async()=>{
 for(const session of [
  {getSession:async()=>null},
  {getSession:async()=>({role:'passenger',userId:uuid,accessToken:token})},
  {getSession:async()=>({role:'driver',userId:'other',accessToken:token})},
  {getSession:async()=>{throw Error('session expired')}}
 ]){
  const x=run({session}),r=await x.submit();
  assert.equal(r.ok,false);assert.equal(r.code,'VERIFIED_DRIVER_SESSION_UNAVAILABLE');
  assert.equal(x.requests.length,0);
 }
});
test('G287 invalid vehicle kind, service, capacity, year and injected fields never POST',async()=>{
 const x=run();
 for(const bad of [
  {...draft,driverId:uuid},{...draft,approved:true},
  {...draft,plate:'invalid plate'},
  {...draft,municipalityCode:'FORGED'},
  {...draft,kind:'MOTO',service:'economico'},
  {...draft,kind:'MOTO',service:'moto_pasajero',passengerCapacity:4},
  {...draft,service:'xl',passengerCapacity:4},
  {...draft,year:1980},{...draft,brand:' Trimmed'},
  {...draft,model:''}
 ]){
  assert.equal(validateDriverPendingVehicleDraft(bad),false);
  const r=await x.submit({draft:bad});
  assert.equal(r.code,'INVALID_REAL_VEHICLE_DRAFT');
 }
 assert.equal(validateDriverPendingVehicleDraft({
  ...draft,kind:'MOTO',service:'moto_pasajero',passengerCapacity:1
 }),true);
 assert.equal(x.requests.length,0);
});
test('G287 invalid session/role, malformed receipt or commercial flag can never pass',async()=>{
 for(const [status,expected] of [
  [401,'DRIVER_SESSION_REVOKED'],[403,'DRIVER_ROLE_DENIED'],
  [400,'VEHICLE_FIELDS_REJECTED'],[409,'VEHICLE_PENDING_CONFLICT'],
  [429,'VEHICLE_RATE_LIMIT'],[503,'STAGING_MUNICIPALITY_UNCONFIGURED']
 ]){
  const x=run({status}),r=await x.submit();
  assert.equal(r.ok,false);assert.equal(r.code,expected);
 }
 for(const badReceipt of [
  {mode:'STAGING_DEMO_ONLY',applicationId,status:'approved',
   evidenceVerified:false,driverEligible:false,commercialEnabled:false},
  {mode:'STAGING_DEMO_ONLY',applicationId,status:'pending',
   evidenceVerified:false,driverEligible:true,commercialEnabled:false},
  {mode:'STAGING_DEMO_ONLY',applicationId,status:'pending',
   evidenceVerified:false,driverEligible:false,commercialEnabled:true},
  {mode:'STAGING_DEMO_ONLY',applicationId,status:'pending',
   evidenceVerified:false,driverEligible:false,commercialEnabled:false,secret:'bad'},
 ]){
  const x=run({receipt:badReceipt}),r=await x.submit();
  assert.equal(r.ok,false);
  assert.equal(r.code,'VEHICLE_RECEIPT_INVALID');
 }
});
test('G287 reuses caller-provided idempotency key on retry; never generates a second one',async()=>{
 const x=run();await x.submit();await x.submit();
 assert.equal(x.requests.length,2);
 assert.equal(JSON.parse(x.requests[0].options.body).requestKey,requestKey);
 assert.equal(JSON.parse(x.requests[1].options.body).requestKey,requestKey);
});
test('G287 network interruption reports unknown outcome, never claims accepted or retries',async()=>{
 let calls=0;
 const r=await submitDriverPendingVehicle({auth,apiOrigin:origin,approvedStagingHost:host,
  allowedByOwner:true,liveEnabled:false,draft,requestKey,request:async()=>{
   calls++;throw Error('network');
  }});
 assert.equal(r.code,'VEHICLE_RECEIPT_UNCONFIRMED');
 assert.equal(r.ok,false);
 assert.equal(calls,1);
});
