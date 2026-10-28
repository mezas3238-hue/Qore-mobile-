import test from 'node:test';
import assert from 'node:assert/strict';
import {createF1AutoRideAuditGateway} from './f1-auto-ride-audit-gateway.mjs';
const clock=1900000000000;
const id=n=>'f1000000-0000-4100-8100-'+String(n).padStart(12,'0');
const viewer=id(1),other=id(2),trip=id(3),route=id(4),quote=id(5);
const booking=id(6),passenger=id(7),driver=id(8);
const user=()=>({role:'admin',mfaVerified:true,subject:viewer,
 token:'mfa-protected-admin-token-abcdefghijklmnop',expiresAt:clock+300000,
 authRevision:1});
const dto=(overrides={})=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 viewerId:viewer,tripId:trip,routeId:route,quoteId:quote,
 passengerId:passenger,bookingRequestKey:booking,service:'economico',
 currency:'PYG',amountGs:18500,fareVersion:'f1-qa-v1',revision:1,
 status:'searching',assignmentPersisted:false,driverId:null,
 observedAt:clock-1000,expiresAt:clock+20000,serverPersisted:true,
 ...overrides});
const http=(data,status=200,overrides={})=>({status,
 ok:status>=200&&status<300,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data),...overrides});
function setup({enabled=true,certified=true,mfa=true,role='admin',
 response=null,origin='https://qa.example.invalid',
 pinnedOrigin='https://qa.example.invalid'}={}){
 let current={...user(),mfaVerified:mfa,role},calls=[],invalidations=0;
 const gateway=createF1AutoRideAuditGateway({
  enabled,contractCertified:certified,stagingRuntimeVerified:true,
  origin,pinnedOrigin,now:()=>clock,getSession:async()=>current,
  onSessionInvalid:()=>{invalidations++;},
  fetchImpl:async(url,request)=>{
   calls.push({url,request});
   return response?response(url,request):http(dto());
  }
 });
 return {gateway,calls,change:x=>{current=x;},actor:()=>current,
  invalidations:()=>invalidations};
}
test('F1 Admin audit OFF without authorized backend or pinned HTTPS',async()=>{
 for(const p of [{enabled:false},{certified:false},
  {origin:'http://qa.example.invalid',pinnedOrigin:'http://qa.example.invalid'},
  {origin:'https://qa.example.invalid/path',pinnedOrigin:'https://qa.example.invalid/path'},
  {pinnedOrigin:'https://elsewhere.example.invalid'}]){
  const f=setup(p);
  assert.equal(f.gateway.isConfigured(),false);
  assert.equal((await f.gateway.read(trip)).code,'F1_ADMIN_CONTRACT_PENDING');
  assert.equal(f.calls.length,0);
 }
});
test('MFA Admin reads one existing trip and sees minimal operational proof only',async()=>{
 const f=setup(),r=await f.gateway.read(trip);
 assert.equal(r.ok,true);assert.equal(r.data.tripId,trip);
 assert.equal(r.data.amountGs,18500);assert.equal(r.data.currency,'PYG');
 assert.equal(r.data.status,'searching');assert.equal(r.data.assignmentPersisted,false);
 assert.equal(r.data.productionEnabled,false);
 assert.equal(r.data.passengerId,undefined);
 assert.equal(r.data.driverId,undefined);
 assert.equal(JSON.stringify(r).includes(user().token),false);
 assert.equal(JSON.stringify(r).includes(passenger),false);
 assert.equal(JSON.stringify(r).includes(driver),false);
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].request.method,'GET');
 assert.equal(new URL(f.calls[0].url).pathname,
  '/v1/staging/admin/rides/'+trip+'/f1-verification');
 assert.equal(f.calls[0].request.body,undefined);
 assert.equal(f.calls[0].request.credentials,'omit');
 assert.equal(f.calls[0].request.redirect,'error');
});
test('owner role, missing MFA and invalid trip cannot reach Admin F1 endpoint',async()=>{
 for(const opts of [{mfa:false},{role:'owner'}]){
  const f=setup(opts);
  assert.equal((await f.gateway.read(trip)).code,'FORBIDDEN');
  assert.equal(f.calls.length,0);
 }
 const f=setup();
 assert.equal((await f.gateway.read('not-a-uuid')).code,'INVALID_TRIP_ID');
 assert.equal(f.calls.length,0);
});
test('Admin rejects wrong owner, trip, revision, stale proof and additional PII',async()=>{
 const patches=[
  {viewerId:other},{tripId:other},{routeId:'bogus'},
  {amountGs:0},{currency:'USD'},{serverPersisted:false},{revision:0},
  {commercialEnabled:true},{observedAt:clock-60000},
  {expiresAt:clock-1},{expiresAt:clock+200000},
  {phone:'0981000000'},{driverId:driver},
  {status:'assigned',assignmentPersisted:false},
  {status:'assigned',assignmentPersisted:true,driverId:null}
 ];
 for(const patch of patches){
  const f=setup({response:()=>http(dto(patch))});
  assert.equal((await f.gateway.read(trip)).code,'INVALID_F1_ADMIN_PROOF',
   JSON.stringify(patch));
 }
});
test('assigned state accepted only with independently persisted driver link',async()=>{
 const f=setup({response:()=>http(dto({
  status:'assigned',assignmentPersisted:true,driverId:driver,revision:2
 }))});
 const r=await f.gateway.read(trip);
 assert.equal(r.ok,true);assert.equal(r.data.assignmentPersisted,true);
 assert.equal(r.data.revision,2);assert.equal(r.data.driverId,undefined);
});
test('completed or cancelled ride retains historical assignment flag without exposing former Driver',async()=>{
 for(const status of ['completed','cancelled']){
  const f=setup({response:()=>http(dto({
   status,assignmentPersisted:true,driverId:null,revision:5
  }))});
  const result=await f.gateway.read(trip);
  assert.equal(result.ok,true);
  assert.equal(result.data.status,status);
  assert.equal(result.data.assignmentPersisted,true);
  assert.equal(result.data.driverId,undefined);
 }
});
test('404, 503, redirects, invalid MIME, oversize body never show synthetic trip',async()=>{
 for(const status of [404,503]){
  const f=setup({response:()=>http({error:'private'},status)});
  assert.equal((await f.gateway.read(trip)).ok,false);
 }
 const redirect=setup({response:()=>http(dto(),200,{redirected:true})});
 assert.equal((await redirect.gateway.read(trip)).code,'UNTRUSTED_REDIRECT');
 const mime=setup({response:()=>http(dto(),200,
  {headers:{get:k=>k==='content-type'?'text/html':null}})});
 assert.equal((await mime.gateway.read(trip)).code,'BAD_CONTENT_TYPE');
 const huge=setup({response:()=>http(dto(),200,
  {headers:{get:k=>k==='content-type'?'application/json':
   k==='content-length'?'9999999':null}})});
 assert.equal((await huge.gateway.read(trip)).code,'RESPONSE_TOO_LARGE');
});
test('401/403 invalidate only still-identical verified Admin identity',async()=>{
 for(const status of [401,403]){
  const f=setup({response:()=>http({error:'no'},status)});
  assert.equal((await f.gateway.read(trip)).ok,false);
  assert.equal(f.invalidations(),1);
 }
});
test('JWT rotation during GET never exposes old trip in new Admin session',async()=>{
 let release,started;
 const waiting=new Promise(resolve=>release=resolve);
 const entered=new Promise(resolve=>started=resolve);
 const f=setup({response:async()=>{started();await waiting;return http(dto());}});
 const pending=f.gateway.read(trip);
 await entered;
 f.change({...f.actor(),token:'rotated-admin-jwt-abcdefghijklmnopqrstuvwxyz'});
 release();
 assert.equal((await pending).code,'STALE_SESSION_RESPONSE');
});
test('logout cancels in flight, and double reads cannot trigger duplicate GET',async()=>{
 let release,started;
 const waiting=new Promise(resolve=>release=resolve);
 const entered=new Promise(resolve=>started=resolve);
 const f=setup({response:async()=>{started();await waiting;return http(dto());}});
 const pending=f.gateway.read(trip);
 await entered;
 assert.equal((await f.gateway.read(trip)).code,'F1_ADMIN_READ_IN_FLIGHT');
 f.gateway.cancelPending();
 release();
 assert.equal((await pending).code,'STALE_SESSION_RESPONSE');
 assert.equal(f.calls.length,1);
});
