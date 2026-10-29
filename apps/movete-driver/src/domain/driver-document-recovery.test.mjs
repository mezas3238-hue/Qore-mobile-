import test from 'node:test';
import assert from 'node:assert/strict';
import {driverAwaitWithDeadline} from './driver-async-deadline.mjs';
import {submitPrivateDriverEvidence} from './driver-document-upload.mjs';
const id=n=>'15900000-0000-4159-8159-'+String(n).padStart(12,'0');
const driver=id(1),nonce=id(2),documentId=id(3);
const jpeg=()=>Uint8Array.from([
 255,216,255,224,0,16,74,70,73,70,0,1,0,0,0,0,0,0,255,217
]);
const time={authMs:40,keyMs:40,captureMs:15,uploadMs:15,
 checkSessionMs:40,observeMs:15,receiptMs:15};
function fixture(change={}){
 const steps=[],progress=[];
 const authAdapter={getSession:async()=>({
  role:'driver',userId:driver,
  accessToken:'g159-private-driver-verified-provider-token-123456789'
 })};
 const params={
  kind:'rostro_selfie',faceConsent:true,authAdapter,
  apiOrigin:'https://staging.movetefacil.example',
  approvedStagingHost:'staging.movetefacil.example',
  allowedByOwner:true,makeRequestKey:()=>nonce,
  captureEvidence:async()=>{steps.push('camera');return {
   bytes:jpeg(),mimeType:'image/jpeg',source:'camera'
  };},
  uploadPrivateObject:async()=>{steps.push('upload');return {storedPrivately:true};},
  request:async(_url,opts)=>{
   steps.push('observe');assert.equal(opts.redirect,'error');
   return {status:202,json:async()=>({
    mode:'STAGING_DEMO_ONLY',documentId,status:'pending',
    evidenceAuthenticityVerified:false,driverEligible:false
   })};
  },
  deadlines:time,onProgress:stage=>progress.push(stage),
  ...change
 };
 return {params,steps,progress};
}
test('G159 no-hang completion still uploads original private selfie and never promotes identity',async()=>{
 const f=fixture();
 const value=await submitPrivateDriverEvidence(f.params);
 assert.equal(value.phase,'pending-review');
 assert.equal(value.driverEligible,false);
 assert.deepEqual(f.steps,['camera','upload','observe']);
 assert.deepEqual(f.progress,['identity','camera','uploading','observing']);
});
test('G159 camera stall returns in bounded time, and late native photograph is wiped',async()=>{
 let release;
 const pending=new Promise(resolve=>{release=resolve;});
 let captureStarted=false;
 const f=fixture({captureEvidence:()=>{captureStarted=true;return pending;}});
 await assert.rejects(()=>submitPrivateDriverEvidence(f.params),/PRIVATE_CAPTURE_TIMEOUT/);
 assert.equal(captureStarted,true);
 assert.deepEqual(f.steps,[]);
 const late=jpeg();release({bytes:late,mimeType:'image/jpeg',source:'camera'});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert(late.every(x=>x===0),'late camera pixels must be cleared');
});
test('G159 camera permission and explicit user cancellation stay distinct',async()=>{
 const denied=fixture({captureEvidence:async()=>{throw Error('CAMERA_PERMISSION_DENIED');}});
 await assert.rejects(()=>submitPrivateDriverEvidence(denied.params),/CAMERA_PERMISSION_DENIED/);
 assert.deepEqual(denied.steps,[]);
 const cancelled=fixture({captureEvidence:async()=>null});
 assert.equal((await submitPrivateDriverEvidence(cancelled.params)).phase,'cancelled');
 assert.deepEqual(cancelled.steps,[]);
});
test('G159 storage never resolves: fail with unknown outcome, zero image, never observe/auto retry',async()=>{
 let late;
 const image=jpeg();
 const f=fixture({
  captureEvidence:async()=>({bytes:image,mimeType:'image/jpeg',source:'camera'}),
  uploadPrivateObject:({objectKey})=>{
   f.steps.push('upload');assert.equal(typeof objectKey,'string');
   return new Promise(resolve=>{late=resolve;});
  }
 });
 await assert.rejects(()=>submitPrivateDriverEvidence(f.params),/PRIVATE_STORAGE_OUTCOME_UNKNOWN/);
 assert.deepEqual(f.steps,['upload']);
 assert(image.every(x=>x===0),'captured image wiped on unknown upload');
 late({storedPrivately:true});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(f.steps.includes('observe'),false,'late private storage cannot forge G17 observation');
});
test('G159 POST stuck or slow JSON response settles as outcome unknown and does not retry',async()=>{
 for(const mode of ['post','json']){
  let sent=0,signal;
  const image=jpeg();
  const f=fixture({
   captureEvidence:async()=>({bytes:image,mimeType:'image/jpeg',source:'camera'}),
   request:async(_url,opts)=>{
    ++sent;signal=opts.signal;
    if(mode==='post')return new Promise(()=>{});
    return {status:202,json:async()=>new Promise(()=>{})};
   }
  });
  await assert.rejects(()=>submitPrivateDriverEvidence(f.params),/PRIVATE_OBSERVATION_OUTCOME_UNKNOWN/);
  assert.equal(sent,1,'no second HTTP attempt');
  assert(image.every(x=>x===0));
  if(mode==='post')assert.equal(signal.aborted,true,'cancel original request on timeout');
 }
});
test('G159 auth SDK may hang; deadline returns before camera, no token/photo kept',async()=>{
 const f=fixture({
  authAdapter:{getSession:()=>new Promise(()=>{})}
 });
 await assert.rejects(()=>submitPrivateDriverEvidence(f.params),/PRIVATE_AUTH_TIMEOUT/);
 assert.equal(f.steps.length,0);
});
test('G159 late exceptions and late success cannot mutate settled result',async()=>{
 const late=driverAwaitWithDeadline(()=>new Promise(resolve=>{
  setTimeout(()=>resolve('after'),25);
 }),{ms:5,timeoutCode:'DRIVER_TIMEOUT'});
 await assert.rejects(late,/DRIVER_TIMEOUT/);
 const ok=await driverAwaitWithDeadline(()=>Promise.resolve('ready'),{
  ms:100,timeoutCode:'DRIVER_TIMEOUT'});
 assert.equal(ok,'ready');
});
