import test from 'node:test';
import assert from 'node:assert/strict';
import {submitPrivateDriverEvidence,DRIVER_KYC_UPLOAD_KINDS,
 DRIVER_DOCUMENT_UPLOAD_LIVE_ENABLED} from './driver-document-upload.mjs';
const id=n=>'74740000-0000-4747-8747-'+String(n).padStart(12,'0');
const driver=id(1),second=id(2),key=id(3),receipt=id(4);
const apiOrigin='https://staging.movetefacil.example';
const token='verified-driver-session-authorization-private-000001';
const jpeg=()=>Uint8Array.from([255,216,255,224,0,16,74,70,73,70,0,1,0,0,0,0,0,0,255,217]);
const data=()=>({bytes:jpeg(),mimeType:'image/jpeg',source:'camera'});
function fixture(overrides={}){
 let userId=driver,accessToken=token;
 const steps=[],captures=[];
 const cfg={
  kind:'rostro_selfie',faceConsent:true,
  apiOrigin,approvedStagingHost:'staging.movetefacil.example',
  allowedByOwner:true,
  authAdapter:{getSession:async()=>({role:'driver',userId,accessToken})},
  makeRequestKey:()=>key,
  captureEvidence:async request=>{
   const shot=data();captures.push(shot.bytes);
   steps.push({action:'camera',kind:request.kind,source:request.source});
   return shot;
  },
  uploadPrivateObject:async p=>{
   steps.push({action:'upload',bucket:p.bucket,key:p.objectKey,mime:p.mimeType,
    upsert:p.upsert,actorToken:p.accessToken,bytes:p.bytes.slice()});
   return {storedPrivately:true};
  },
  request:async(url,p)=>{
   steps.push({action:'observe',url,method:p.method,headers:p.headers,
    body:JSON.parse(p.body),cache:p.cache,credentials:p.credentials});
   return {status:202,json:async()=>({
    mode:'STAGING_DEMO_ONLY',documentId:receipt,status:'pending',
    evidenceAuthenticityVerified:false,driverEligible:false})};
  },
  ...overrides
 };
 return {cfg,steps,captures,switchActor:()=>{userId=second},
  invalidate:()=>{accessToken='revoked-driver-token-9999999999999'}};
}
test('Driver consented selfie uploads privately and gets pending G17 receipt, never approval',async()=>{
 assert.equal(DRIVER_DOCUMENT_UPLOAD_LIVE_ENABLED,false);
 assert.equal(DRIVER_KYC_UPLOAD_KINDS.length,8);
 const f=fixture();
 const result=await submitPrivateDriverEvidence(f.cfg);
 assert.deepEqual(result,{kind:'rostro_selfie',phase:'pending-review',
  accountApproved:false,driverEligible:false,qaOnly:true,productionEnabled:false});
 assert.deepEqual(f.steps.map(s=>s.action),['camera','upload','observe']);
 assert.deepEqual(f.steps[0],{action:'camera',kind:'rostro_selfie',source:'camera'});
 assert.equal(f.steps[1].bucket,'mobility-staging-driver-evidence');
 assert.equal(f.steps[1].upsert,false);
 assert.equal(f.steps[1].actorToken,token);
 assert.equal(f.steps[1].key,driver+'/rostro_selfie-'+key.replace(/-/g,'')+'.jpg');
 assert.equal(f.steps[2].url,apiOrigin+'/v1/staging/driver/documents/observe');
 assert.equal(f.steps[2].headers.authorization,'Bearer '+token);
 assert.deepEqual(f.steps[2].body,{kind:'rostro_selfie',requestKey:key,
  objectKey:f.steps[1].key});
 assert.equal(f.captures[0].every(b=>b===0),true,'image buffer wiped');
 assert(!JSON.stringify(result).includes(driver));
 assert(!JSON.stringify(result).includes(token));
 assert(!JSON.stringify(result).includes(receipt));
});
test('Driver can upload all eight document types, selfie only camera, exact kind',async()=>{
 for(const kind of DRIVER_KYC_UPLOAD_KINDS){
  const f=fixture({kind,faceConsent:true});
  assert.equal((await submitPrivateDriverEvidence(f.cfg)).phase,'pending-review',kind);
  assert.equal(f.steps[1].key.split('/')[1].startsWith(kind+'-'),true);
 }
 for(const kind of ['licencia','identidad_frente','identidad_dorso',
  'cedula_verde','habilitacion','seguro','inspeccion']){
  const f=fixture({kind,captureEvidence:async()=>({
   ...data(),source:'library'})});
  assert.equal((await submitPrivateDriverEvidence(f.cfg)).phase,'pending-review',kind);
 }
 const f=fixture({captureEvidence:async()=>({...data(),source:'library'})});
 await assert.rejects(()=>submitPrivateDriverEvidence(f.cfg),/PRIVATE_IMAGE_INVALID/);
 assert.deepEqual(f.steps,[]);
});
test('Consent and empty runtime prevent any camera access',async()=>{
 for(const change of [
  {faceConsent:false},{allowedByOwner:false},{approvedStagingHost:null},
  {apiOrigin:'http://production.example.com'},{captureEvidence:null},
  {uploadPrivateObject:null},{makeRequestKey:null},
  {kind:'other'},{authAdapter:{getSession:async()=>null}}
 ]){
  const f=fixture(change);
  await assert.rejects(()=>submitPrivateDriverEvidence(f.cfg));
  assert.equal(f.steps.length,0);
 }
});
test('Unsafe capture, failed private upload and cross-account swap fail closed without observation',async()=>{
 for(const shot of [
  {...data(),mimeType:'image/png'},
  {...data(),bytes:Uint8Array.from([255,216,255])},
  {...data(),bytes:Uint8Array.from([11,...jpeg().slice(1)])},
  {...data(),public:true},null
 ]){
  const f=fixture({captureEvidence:async()=>shot});
  if(shot===null){
   const result=await submitPrivateDriverEvidence(f.cfg);
   assert.equal(result.phase,'cancelled');
  }else{
   await assert.rejects(()=>submitPrivateDriverEvidence(f.cfg));
  }
  assert.equal(f.steps.some(s=>s.action==='upload'),false);
 }
 const f=fixture({uploadPrivateObject:async()=>({storedPrivately:false})});
 await assert.rejects(()=>submitPrivateDriverEvidence(f.cfg));
 assert.equal(f.steps.some(s=>s.action==='observe'),false);
 const swap=fixture();
 swap.cfg.uploadPrivateObject=async()=>{swap.switchActor();return {storedPrivately:true}};
 await assert.rejects(()=>submitPrivateDriverEvidence(swap.cfg),/DRIVER_SESSION_CHANGED/);
 assert.equal(swap.steps.some(s=>s.action==='observe'),false);
});
test('Lost or unsafe G17 acknowledgment is unknown, never replay an upload or mutate eligibility',async()=>{
 for(const request of [
  async()=>{throw Error('HTTP timeout after COMMIT')},
  async()=>({status:503}),
  async()=>({status:202,json:async()=>({...{
   mode:'STAGING_DEMO_ONLY',documentId:receipt,status:'pending',
   evidenceAuthenticityVerified:false,driverEligible:false
  },accountApproved:true})}),
  async()=>({status:202,json:async()=>({
   mode:'STAGING_DEMO_ONLY',documentId:receipt,status:'approved',
   evidenceAuthenticityVerified:true,driverEligible:true})})
 ]){
  const f=fixture({request});
  await assert.rejects(()=>submitPrivateDriverEvidence(f.cfg));
  assert.equal(f.steps.filter(x=>x.action==='upload').length,1);
  assert.equal(f.captures[0].every(b=>b===0),true);
 }
});
test('Body enforces minimum 20 JPEG bytes; public content never enters React state',async()=>{
 const f=fixture();
 const r=await submitPrivateDriverEvidence(f.cfg);
 assert.deepEqual(Object.keys(r),['kind','phase','accountApproved','driverEligible',
  'qaOnly','productionEnabled']);
 assert.equal(JSON.stringify(r).includes('objectKey'),false);
});
