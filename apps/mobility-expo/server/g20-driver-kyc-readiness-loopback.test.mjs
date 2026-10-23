import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
import {createDriverKycReadinessGateway}
 from './g20-driver-kyc-readiness-gateway.mjs';
const driver='11111111-1111-4111-8111-111111111111';
const token='a'.repeat(60),path='/v1/staging/driver/license-readiness';
const no=async()=>({status:404,body:{error:'Not found'}});
function fixture(){
 const calls=[];
 const driverLicenseReadinessHandler=createDriverKycReadinessGateway({
  projectRef:'staging1234567890abcd',
  verifyAccessToken:async provided=>{
   if(provided!==token)throw Error('Invalid session');
   return {id:driver,email_confirmed_at:'2026-10-22T00:00:00Z',
    is_anonymous:false};
  },
  authorizeDriver:async id=>id===driver,
  allowRequest:()=>true,
  currentLicenseApproved:async input=>{calls.push(input);return true;}
 });
 const opts={riderHandler:no,offerHandler:no,tripCommandHandler:no,
  deliveryHandler:no,merchantHandler:no,financeHandler:no,
  safetyHandler:no,merchantManagementHandler:no,deliveryOfferHandler:no,
  courierPollHandler:no,driverInboxHandler:no,driverDocumentHandler:no,
  driverEnrollmentHandler:no,driverLicenseReadinessHandler};
 return {opts,calls};
}
const close=s=>new Promise((ok,fail)=>s.close(e=>e?fail(e):ok()));
test('G20 localhost HTTP returns no KYC PII and remains Driver-only',async t=>{
 const {opts,calls}=fixture();
 const server=createQoreRadarLoopbackTransport(opts);
 const base=await listenQoreRadarLoopback(server);t.after(()=>close(server));
 const res=await fetch(base+path,{headers:{authorization:'Bearer '+token}});
 assert.equal(res.status,200);
 assert.equal(res.headers.get('cache-control'),'private, no-store, max-age=0');
 assert.equal(res.headers.get('access-control-allow-origin'),null);
 const data=await res.json();
 assert.equal(data.currentLicenseApproved,true);
 assert.equal(data.driverEligible,false);assert.equal(data.liveOperationsEnabled,false);
 assert.deepEqual(calls,[{driverId:driver}]);
 for(const [headers,status] of [
  [{authorization:'Bearer '+('b'.repeat(60))},401],
  [{authorization:'Bearer '+token,origin:'https://evil.example'},403],
  [{authorization:'Bearer '+token,cookie:'session=forged'},403]
 ]){
  assert.equal((await fetch(base+path,{headers})).status,status);
 }
 assert.equal((await fetch(base+path+'?driverId='+driver,
  {headers:{authorization:'Bearer '+token}})).status,404);
});
test('G20 transport fails closed absent an installed KYC gate',async t=>{
 const {opts}=fixture(),{driverLicenseReadinessHandler:unused,...rest}=opts;
 const server=createQoreRadarLoopbackTransport(rest);
 const base=await listenQoreRadarLoopback(server);t.after(()=>close(server));
 const res=await fetch(base+path,{headers:{authorization:'Bearer '+token}});
 assert.equal(res.status,503);
 assert.equal((await res.json()).error,'Driver KYC readiness not configured');
});
