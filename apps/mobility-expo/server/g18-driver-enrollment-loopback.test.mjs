import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
import {createDriverEnrollmentGateway}
 from './g18-driver-enrollment-gateway.mjs';
const driver='11111111-1111-4111-8111-111111111111';
const receipt='22222222-2222-4222-8222-222222222222';
const requestKey='33333333-3333-4333-8333-333333333333';
const jwt='a'.repeat(60),path='/v1/staging/driver/enrollment';
const inactive=async()=>({status:404,body:{error:'Not found'}});
const close=s=>new Promise((resolve,reject)=>s.close(err=>err?reject(err):resolve()));
function fixture(){
 const log=[];
 const driverEnrollmentHandler=createDriverEnrollmentGateway({
  projectRef:'staging1234567890abcd',
  verifyAccessToken:async token=>{
   if(token!==jwt)throw Error('Unverified');
   return {id:driver,is_anonymous:false,email_confirmed_at:'2026-10-22T00:00:00Z'};
  },
  authorizeNewDriver:async user=>user===driver,
  allowRequest:()=>true,
  enroll:async data=>{log.push(data);return receipt;}
 });
 const opts={riderHandler:inactive,offerHandler:inactive,tripCommandHandler:inactive,
  deliveryHandler:inactive,merchantHandler:inactive,financeHandler:inactive,
  safetyHandler:inactive,merchantManagementHandler:inactive,deliveryOfferHandler:inactive,
  courierPollHandler:inactive,driverInboxHandler:inactive,driverDocumentHandler:inactive,
  driverEnrollmentHandler};
 return {opts,log};
}
test('G18 HTTP converts explicit Driver consent without inserting user-supplied role/actor',async t=>{
 const {opts,log}=fixture(),server=createQoreRadarLoopbackTransport(opts);
 const base=await listenQoreRadarLoopback(server);t.after(()=>close(server));
 const data={requestKey,driverConsent:true};
 const res=await fetch(base+path,{method:'POST',headers:{
  authorization:'Bearer '+jwt,'content-type':'application/json'},body:JSON.stringify(data)});
 assert.equal(res.status,202);
 const body=await res.json();
 assert.equal(body.status,'pending_compliance');
 assert.equal(body.driverEligible,false);
 assert.equal(body.liveOperationsEnabled,false);
 assert.deepEqual(log,[{driverId:driver,requestKey,consent:true}]);
 assert.doesNotMatch(JSON.stringify(body),/driverId|accessToken|service_role/i);
 assert.equal(res.headers.get('cache-control'),'private, no-store, max-age=0');
 assert.equal(res.headers.get('access-control-allow-origin'),null);
 assert.equal((await fetch(base+path,{method:'POST',headers:{
  authorization:'Bearer '+jwt,'content-type':'application/json'},
  body:JSON.stringify({...data,userId:driver})})).status,400);
 assert.equal((await fetch(base+path,{method:'POST',headers:{
  authorization:'Bearer '+jwt,'content-type':'application/json'},
  body:JSON.stringify({...data,driverConsent:false})})).status,400);
});
test('G18 HTTP refuses browser-origin/cookie sessions and remains local QA only',async t=>{
 const {opts}=fixture(),server=createQoreRadarLoopbackTransport(opts);
 const base=await listenQoreRadarLoopback(server);t.after(()=>close(server));
 const body=JSON.stringify({requestKey,driverConsent:true});
 for(const headers of [
  {'content-type':'application/json',authorization:'Bearer '+jwt,origin:'https://evil.example'},
  {'content-type':'application/json',authorization:'Bearer '+jwt,cookie:'session=fake'}]){
  const res=await fetch(base+path,{method:'POST',headers,body});
  assert.equal(res.status,403);
 }
 const unauth=await fetch(base+path,{method:'POST',
  headers:{'content-type':'application/json'},body});
 assert.equal(unauth.status,401);
});
test('G18 HTTP no backend adapter means 503 and never auto-enrolls',async t=>{
 const {opts}=fixture();const {driverEnrollmentHandler:unused,...safe}=opts;
 const server=createQoreRadarLoopbackTransport(safe);
 const base=await listenQoreRadarLoopback(server);t.after(()=>close(server));
 const res=await fetch(base+path,{method:'POST',headers:{
  authorization:'Bearer '+jwt,'content-type':'application/json'},
  body:JSON.stringify({requestKey,driverConsent:true})});
 assert.equal(res.status,503);
 assert.equal((await res.json()).error,'Driver enrollment not configured');
});
