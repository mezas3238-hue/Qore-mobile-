import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
import {createDriverDocumentGateway} from './g17-driver-document-gateway.mjs';
const driver='11111111-1111-4111-8111-111111111111';
const admin='22222222-2222-4222-8222-222222222222';
const offer='33333333-3333-4333-8333-333333333333';
const key='44444444-4444-4444-8444-444444444444';
const doc='55555555-5555-4555-8555-555555555555';
const jwtDriver='a'.repeat(60),jwtAdmin='b'.repeat(60);
const readPath='/v1/staging/driver/documents';
const observePath='/v1/staging/driver/documents/observe';
const reviewPath='/v1/staging/admin/driver-documents/review';
const objectKey=driver+'/licencia-abcdefghijklmnop.jpg';
const fallback=async()=>({status:404,body:{error:'Not found'}});
const close=server=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
function fixture(){
 const calls=[];
 const driverDocumentHandler=createDriverDocumentGateway({
  projectRef:'staging1234567890abcd',
  verifyAccessToken:async token=>{
   if(token===jwtDriver)return {id:driver,is_anonymous:false,
    email_confirmed_at:'2026-10-22T00:00:00Z'};
   if(token===jwtAdmin)return {id:admin,is_anonymous:false,
    phone_confirmed_at:'2026-10-22T00:00:00Z'};
   throw Error('Unverified');
  },
  authorizeDriver:async id=>id===driver,authorizeAdmin:async id=>id===admin,
  allowRequest:()=>true,
  readStatus:async()=>[{kind:'licencia',status:'pending',
   submittedAtMs:1760000000000,reviewedAtMs:null}],
  registerObservation:async info=>{calls.push(info);return doc;},
  observePrivateObject:async({driverId,kind,objectKey:key})=>{
   calls.push({driverId,kind,objectKey:key});
   return {serverObserved:true,malwareScanPassed:true,ownerId:driver,
    storageBucket:'mobility-staging-driver-evidence',objectKey:key,
    mimeType:'image/jpeg',byteSize:1200,sha256Hex:'a'.repeat(64)};
  },
  review:async info=>{calls.push(info);return offer;}
 });
 const opts={riderHandler:fallback,offerHandler:fallback,tripCommandHandler:fallback,
  deliveryHandler:fallback,merchantHandler:fallback,financeHandler:fallback,
  safetyHandler:fallback,merchantManagementHandler:fallback,deliveryOfferHandler:fallback,
  courierPollHandler:fallback,driverInboxHandler:fallback,driverDocumentHandler};
 return {opts,calls};
}
test('G17 HTTP Driver sees only sanitized KYC state; no object key, hash, or admin identity',async t=>{
 const {opts}=fixture(),server=createQoreRadarLoopbackTransport(opts);
 const base=await listenQoreRadarLoopback(server);t.after(()=>close(server));
 const res=await fetch(base+readPath,{headers:{authorization:'Bearer '+jwtDriver}});
 assert.equal(res.status,200);
 const b=await res.json();
 assert.equal(b.documents[0].status,'pending');
 assert.equal(b.liveOperationsEnabled,false);
 assert.doesNotMatch(JSON.stringify(b),/objectKey|sha256|driverId|reviewerId|licenseBytes/i);
 assert.equal(res.headers.get('cache-control'),'private, no-store, max-age=0');
 assert.equal(res.headers.get('access-control-allow-origin'),null);
 assert.equal((await fetch(base+readPath,{headers:{authorization:'Bearer '+jwtAdmin}})).status,403);
 assert.equal((await fetch(base+readPath,{headers:{authorization:'Bearer '+('c'.repeat(60))}})).status,401);
 assert.equal((await fetch(base+readPath+'?driverId='+driver,{headers:{authorization:'Bearer '+jwtDriver}})).status,404);
});
test('G17 HTTP observes only independently scanned private metadata, never client hash/owner',async t=>{
 const {opts,calls}=fixture(),server=createQoreRadarLoopbackTransport(opts);
 const base=await listenQoreRadarLoopback(server);t.after(()=>close(server));
 const input={kind:'licencia',objectKey,requestKey:key};
 const res=await fetch(base+observePath,{method:'POST',headers:{
  authorization:'Bearer '+jwtDriver,'content-type':'application/json'},
  body:JSON.stringify(input)});
 assert.equal(res.status,202);
 const body=await res.json();
 assert.equal(body.status,'pending');assert.equal(body.driverEligible,false);
 assert.deepEqual(calls[0],{driverId:driver,kind:'licencia',objectKey});
 assert.equal(calls[1].sha256Hex,'a'.repeat(64));
 assert.equal(JSON.stringify(body).includes(objectKey),false);
 const spoof=await fetch(base+observePath,{method:'POST',headers:{
  authorization:'Bearer '+jwtDriver,'content-type':'application/json'},
  body:JSON.stringify({...input,driverId:admin})});
 assert.equal(spoof.status,400);
});
test('G17 HTTP admin review requires admin bearer and gives only audit receipt',async t=>{
 const {opts}=fixture(),server=createQoreRadarLoopbackTransport(opts);
 const base=await listenQoreRadarLoopback(server);t.after(()=>close(server));
 const input={documentId:doc,requestKey:key,approve:false,reasonCode:'DOCUMENT_INVALID'};
 const headers={'content-type':'application/json'};
 const res=await fetch(base+reviewPath,{method:'POST',headers:{
  ...headers,authorization:'Bearer '+jwtAdmin},body:JSON.stringify(input)});
 assert.equal(res.status,200);
 const body=await res.json();
 assert.equal(body.outcome,'rejected');assert.equal(body.driverEligible,false);
 assert.equal((await fetch(base+reviewPath,{method:'POST',headers:{
  ...headers,authorization:'Bearer '+jwtDriver},body:JSON.stringify(input)})).status,403);
});
test('G17 HTTP fails closed without document gateway and blocks browser CORS/cookies',async t=>{
 const {opts}=fixture();
 const {driverDocumentHandler:unused,...without}=opts;
 const server=createQoreRadarLoopbackTransport(without);
 const base=await listenQoreRadarLoopback(server);t.after(()=>close(server));
 const res=await fetch(base+readPath,{headers:{authorization:'Bearer '+jwtDriver}});
 assert.equal(res.status,503);
 assert.equal((await res.json()).error,'Private Driver documents not configured');
 assert.equal((await fetch(base+readPath,{headers:{
  authorization:'Bearer '+jwtDriver,origin:'https://evil.example'}})).status,403);
 assert.equal((await fetch(base+readPath,{headers:{
  authorization:'Bearer '+jwtDriver,cookie:'session=bad'}})).status,403);
});
