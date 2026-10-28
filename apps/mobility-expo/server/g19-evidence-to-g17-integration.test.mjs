import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDriverDocumentGateway} from './g17-driver-document-gateway.mjs';
import {createVerifiedPrivateDriverEvidenceObserver,
 G19_PRIVATE_BUCKET} from './g19-private-driver-evidence-observer.mjs';

const driver='11111111-1111-4111-8111-111111111111';
const outsider='22222222-2222-4222-8222-222222222222';
const documentId='33333333-3333-4333-8333-333333333333';
const requestKey='44444444-4444-4444-8444-444444444444';
const key=driver+'/licencia-abcdefghijklmnop.jpg';
const bytes=Uint8Array.from([255,216,255,224,0,16,74,70,73,70,0,1,255,217]);
const digest=createHash('sha256').update(bytes).digest('hex');
const base={bucketId:G19_PRIVATE_BUCKET,public:false,ownerId:driver,
 objectId:'55555555-5555-4555-8555-555555555555',
 objectKey:key,byteSize:bytes.length,mimeType:'image/jpeg',version:'revision_001'};
const request={method:'POST',path:'/v1/staging/driver/documents/observe',
 headers:{authorization:'Bearer '+('a'.repeat(60))},
 body:{requestKey,kind:'licencia',objectKey:key}};
function fixture({
 metadata=base,downloadVersion='revision_001',scannerClean=true,
 allowDriver=true
}={}){
 const calls=[];
 const verified=createVerifiedPrivateDriverEvidenceObserver({
  getObjectMetadata:async input=>{calls.push(['metadata',input]);return metadata;},
  downloadObject:async input=>{calls.push(['download',input]);
   return {bytes,version:downloadVersion};},
  scanBytes:async input=>{calls.push(['scan',{sha256Hex:input.sha256Hex}]);
   return {verdict:scannerClean?'clean':'infected',
    sha256Hex:input.sha256Hex,engine:'TEST_ONLY_SCANNER'};}
 });
 const handler=createDriverDocumentGateway({
  projectRef:'staging1234567890abcd',
  verifyAccessToken:async()=>({id:driver,is_anonymous:false,
   email_confirmed_at:'2026-10-22T00:00:00Z'}),
  authorizeDriver:async()=>allowDriver,authorizeAdmin:async()=>false,
  allowRequest:()=>true,
  readStatus:async()=>[],review:async()=>{throw Error('No review in observation');},
  observePrivateObject:verified,
  registerObservation:async info=>{
   calls.push(['persist',info]);return documentId;
  }
 });
 return {handler,calls};
}
test('G19 scanned private bytes produce only a pending G17 receipt, no PII',async()=>{
 const {handler,calls}=fixture();
 const response=await handler(request);
 assert.equal(response.status,202);
 assert.deepEqual(response.body,{mode:'STAGING_DEMO_ONLY',documentId,
  status:'pending',evidenceAuthenticityVerified:false,driverEligible:false});
 assert.equal(calls.filter(x=>x[0]==='persist').length,1);
 assert.deepEqual(calls.map(x=>x[0]),['metadata','download','scan','metadata','persist']);
 const stored=calls.at(-1)[1];
 assert.equal(stored.driverId,driver);
 assert.equal(stored.objectKey,key);assert.equal(stored.byteSize,bytes.length);
 assert.equal(stored.sha256Hex,digest);
 assert.doesNotMatch(JSON.stringify(response),/sha256|ownerId|objectKey|driverId|scan/i);
});
test('G19 rejects incorrect owner, changed revision and malware before G17 persistence',async()=>{
 for(const input of [
  {metadata:{...base,ownerId:outsider}},
  {metadata:{...base,public:true}},
  {downloadVersion:'revision_002'},
  {scannerClean:false}
 ]){
  const {handler,calls}=fixture(input);
  const out=await handler(request);
  assert.equal(out.status,503);
  assert.equal(calls.filter(x=>x[0]==='persist').length,0);
 }
});
test('G17 cannot observe any file if role revoked or evidence type is unknown',async()=>{
 const unauthorized=fixture({allowDriver:false});
 assert.equal((await unauthorized.handler(request)).status,403);
 assert.deepEqual(unauthorized.calls,[]);
 const unsupported=fixture();
 const other={...request,body:{
  requestKey,kind:'identidad_extranjera',
  objectKey:driver+'/identidad_extranjera-abcdefghijklmnop.jpg'
 }};
 assert.equal((await unsupported.handler(other)).status,400);
 assert.deepEqual(unsupported.calls,[]);
});

test('G19 scanned selfie can register a pending G17 reference but cannot claim face verified',async()=>{
 const faceKey=driver+'/rostro_selfie-abcdefghijklmnop.jpg';
 const {handler,calls}=fixture({metadata:{...base,objectKey:faceKey}});
 const response=await handler({...request,body:{requestKey,kind:'rostro_selfie',objectKey:faceKey}});
 assert.equal(response.status,202);
 assert.equal(response.body.status,'pending');
 assert.equal(response.body.evidenceAuthenticityVerified,false);
 assert.equal(response.body.driverEligible,false);
 assert.equal(calls.at(-1)[0],'persist');
 assert.equal(calls.at(-1)[1].kind,'rostro_selfie');
 assert(!JSON.stringify(response).includes(faceKey));
});
