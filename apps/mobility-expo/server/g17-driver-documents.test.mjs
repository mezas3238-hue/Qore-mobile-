import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverDocumentGateway,G17_DOCUMENTS_LIVE_ENABLED as API_LIVE}
 from './g17-driver-document-gateway.mjs';
import {createDriverDocumentRepository,G17_DOCUMENTS_LIVE_ENABLED as DB_LIVE}
 from './g17-driver-document-repository.mjs';
const driver='11111111-1111-4111-8111-111111111111';
const admin='22222222-2222-4222-8222-222222222222';
const outsider='33333333-3333-4333-8333-333333333333';
const documentId='44444444-4444-4444-8444-444444444444';
const requestKey='55555555-5555-4555-8555-555555555555';
const reviewId='66666666-6666-4666-8666-666666666666';
const token='a'.repeat(60);
const objectKey=driver+'/licencia-abcdefghijklmnop.jpg';
const selfieKey=driver+'/rostro_selfie-abcdefghijklmnop.jpg';
const observation={serverObserved:true,malwareScanPassed:true,ownerId:driver,
 storageBucket:'mobility-staging-driver-evidence',objectKey,
 mimeType:'image/jpeg',byteSize:2000,sha256Hex:'a'.repeat(64)};
const readPath='/v1/staging/driver/documents';
const observePath='/v1/staging/driver/documents/observe';
const reviewPath='/v1/staging/admin/driver-documents/review';
const bearer={authorization:'Bearer '+token};
const read={method:'GET',path:readPath,headers:bearer};
const observe={method:'POST',path:observePath,headers:bearer,
 body:{kind:'licencia',objectKey,requestKey}};
const review={method:'POST',path:reviewPath,headers:bearer,
 body:{documentId,requestKey,approve:true,reasonCode:'DOCUMENT_VALID'}};
const status=[{kind:'licencia',status:'pending',
 submittedAtMs:Date.parse('2026-10-22T12:00:00Z'),reviewedAtMs:null}];
function gateway(overrides={}){
 const calls=[];
 const handle=createDriverDocumentGateway({
  projectRef:'staging1234567890abcd',
  verifyAccessToken:async()=>({id:driver,is_anonymous:false,
   email_confirmed_at:'2026-10-22T00:00:00Z'}),
  authorizeDriver:async()=>true,
  authorizeAdmin:async()=>false,
  allowRequest:()=>true,
  readStatus:async query=>{calls.push(['status',query]);return status;},
  registerObservation:async query=>{calls.push(['register',query]);return documentId;},
  review:async query=>{calls.push(['review',query]);return reviewId;},
  observePrivateObject:async query=>{calls.push(['storage',query]);return observation;},
  ...overrides
 });
 return {handle,calls};
}
test('G17 repository uses only service-only RPC and sanitized output',async()=>{
 assert.equal(API_LIVE,false);assert.equal(DB_LIVE,false);
 const rpcCalls=[];
 const repo=createDriverDocumentRepository({rpc:async(name,args)=>{
  rpcCalls.push([name,args]);
  if(name==='mobility_stage_read_driver_document_status')
   return {data:[{kind:'licencia',status:'pending',submitted_at:'2026-10-22T12:00:00Z',reviewed_at:null}],error:null};
  return {data:documentId,error:null};
 }});
 assert.deepEqual(await repo.readStatus({driverId:driver}),status);
 assert.equal(await repo.registerObservation({driverId:driver,requestKey,
  kind:'licencia',objectKey,mimeType:'image/jpeg',byteSize:2000,sha256Hex:'a'.repeat(64)}),documentId);
 assert.equal(await repo.review({reviewerId:admin,documentId,
  requestKey,approve:true,reasonCode:'DOCUMENT_VALID'}),documentId);
 assert.equal(rpcCalls[0][0],'mobility_stage_read_driver_document_status');
 assert.equal(rpcCalls[1][1]._driver_id,driver);
 assert.equal(rpcCalls[2][1]._reviewer_id,admin);
 assert.equal(Object.isFrozen(await repo.readStatus({driverId:driver})),true);
});
test('G17 Driver can read only own doc status without object keys or reviewer IDs',async()=>{
 const {handle,calls}=gateway();
 const out=await handle(read);
 assert.equal(out.status,200);
 assert.deepEqual(out.body.documents,status);
 assert.equal(out.body.liveOperationsEnabled,false);
 assert.deepEqual(calls,[['status',{driverId:driver}]]);
 assert.doesNotMatch(JSON.stringify(out),/object_key|sha256|reviewerId|ownerId|mimeType|documentId|privateURL/i);
});
test('G17 evidence path must match verified identity and storage observation',async()=>{
 const {handle,calls}=gateway();
 const out=await handle(observe);
 assert.equal(out.status,202);
 assert.equal(out.body.status,'pending');assert.equal(out.body.driverEligible,false);
 assert.equal(out.body.evidenceAuthenticityVerified,false);
 assert.deepEqual(calls[0],['storage',{driverId:driver,kind:'licencia',objectKey}]);
 assert.equal(calls[1][0],'register');
 assert.equal(calls[1][1].sha256Hex,'a'.repeat(64));
 assert.equal(JSON.stringify(out).includes(objectKey),false);
 for(const invalid of [
  {...observation,serverObserved:false},
  {...observation,malwareScanPassed:false},
  {...observation,ownerId:outsider},
  {...observation,storageBucket:'public-docs'},
  {...observation,objectKey:outsider+'/licencia-abcdefghijklmnop.jpg'},
  {...observation,sha256Hex:'INVALID'},
  {...observation,byteSize:5242881},
  {...observation,mimeType:'application/pdf'}
 ]){
  const state=gateway({observePrivateObject:async()=>invalid,
   registerObservation:async()=>{throw Error('MUST NOT TOUCH DATABASE')}});
  assert.equal((await state.handle(observe)).status,409);
 }
});
test('G17 rejects spoofed document identity, extra fields and unconfirmed users',async()=>{
 assert.equal((await gateway().handle({...observe,
  body:{...observe.body,driverId:outsider}})).status,400);
 assert.equal((await gateway().handle({...observe,
  body:{...observe.body,objectKey:outsider+'/licencia-abcdefghijklmnop.jpg'}})).status,400);
 assert.equal((await gateway().handle({...read,
  body:{driverId:outsider}})).status,400);
 assert.equal((await gateway().handle({...read,headers:{}})).status,401);
 assert.equal((await gateway({verifyAccessToken:async()=>({...{id:driver},
  is_anonymous:true,email_confirmed_at:'2026-10-22'})}).handle(read)).status,401);
 assert.equal((await gateway({authorizeDriver:async()=>false}).handle(observe)).status,403);
 assert.equal((await gateway({allowRequest:()=>false}).handle(read)).status,429);
});
test('G17 Admin review requires administrator JWT and does not activate Driver',async()=>{
 const adminGateway=gateway({
  verifyAccessToken:async()=>({id:admin,is_anonymous:false,
   phone_confirmed_at:'2026-10-22T00:00:00Z'}),
  authorizeDriver:async()=>false,
  authorizeAdmin:async id=>id===admin
 });
 const out=await adminGateway.handle(review);
 assert.equal(out.status,200);
 assert.deepEqual(out.body,{mode:'STAGING_DEMO_ONLY',auditId:reviewId,
  outcome:'approved',driverEligible:false,liveOperationsEnabled:false});
 assert.deepEqual(adminGateway.calls.at(-1),['review',{
  reviewerId:admin,documentId,requestKey,approve:true,reasonCode:'DOCUMENT_VALID'}]);
 assert.equal((await gateway().handle(review)).status,403);
 assert.equal((await adminGateway.handle({...review,
  body:{...review.body,reviewerId:admin}})).status,400);
 assert.equal((await adminGateway.handle({...review,
  body:{...review.body,reasonCode:'<script>'}})).status,400);
});
test('G17 denied storage, RPC failures, invalid state all fail closed',async()=>{
 assert.equal((await gateway({observePrivateObject:async()=>{throw Error('storage down')}})
  .handle(observe)).status,503);
 assert.equal((await gateway({readStatus:async()=>[
  {...status[0],storagePath:objectKey}]}).handle(read)).status,200); // sanitized mapping
 assert.equal((await gateway({readStatus:async()=>[...status,...status]})
  .handle(read)).status,503);
 assert.equal((await gateway({registerObservation:async()=>null}).handle(observe)).status,503);
 assert.equal((await gateway({review:async()=>null,
  authorizeAdmin:async()=>true}).handle(review)).status,409);
 for(const data of [null,[{kind:'licencia',status:'approved',submittedAtMs:1,reviewedAtMs:null}],
 [{kind:'private',status:'pending',submittedAtMs:1,reviewedAtMs:null}]]){
  assert.equal((await gateway({readStatus:async()=>data}).handle(read)).status,503);
 }
});

test('G17 all eight private kinds including selfie are observed safely and stay unverified',async()=>{
 const kinds=['licencia','identidad_frente','identidad_dorso','cedula_verde',
  'habilitacion','seguro','inspeccion','rostro_selfie'];
 for(const kind of kinds){
  const key=driver+'/'+kind+'-abcdefghijklmnop.jpg';
  const {handle,calls}=gateway({
   observePrivateObject:async()=>({...observation,objectKey:key})
  });
  const res=await handle({...observe,body:{requestKey,kind,objectKey:key}});
  assert.equal(res.status,202,kind);
  assert.equal(res.body.status,'pending');
  assert.equal(res.body.evidenceAuthenticityVerified,false);
  assert.equal(res.body.driverEligible,false);
  assert.equal(calls.at(-1)[0],'register');
  assert.equal(calls.at(-1)[1].kind,kind);
  assert.equal(JSON.stringify(res).includes(key),false);
 }
 for(const o of [
  {...observation,objectKey:selfieKey,malwareScanPassed:false},
  {...observation,objectKey:selfieKey,ownerId:outsider},
  {...observation,objectKey:selfieKey,serverObserved:false}
 ]){
  const {handle}=gateway({observePrivateObject:async()=>o});
  const res=await handle({...observe,body:{requestKey,kind:'rostro_selfie',objectKey:selfieKey}});
  assert.equal(res.status,409);
 }
});
