import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createVerifiedPrivateDriverEvidenceObserver,G19_EVIDENCE_LIVE_ENABLED,
 G19_PRIVATE_BUCKET} from './g19-private-driver-evidence-observer.mjs';

const driver='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const objectId='33333333-3333-4333-8333-333333333333';
const objectKey=driver+'/licencia-abcdefghijklmnop.jpg';
const jpeg=Uint8Array.from([255,216,255,224,0,16,74,70,73,70,0,1,255,217]);
const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,0]);
const sha=buf=>createHash('sha256').update(buf).digest('hex');
const metadata={bucketId:G19_PRIVATE_BUCKET,public:false,ownerId:driver,
 objectId,objectKey,version:'revision_0001',byteSize:jpeg.length,mimeType:'image/jpeg'};
function fixture(options={}){
 const steps=[];
 let reads=0;
 const getObjectMetadata=async params=>{
  steps.push(['metadata',params]);reads++;
  if(options.failMetadata)throw Error('PRIVATE: metadata API failed');
  return {...metadata,...(reads===1?options.first:options.second)};
 };
 const downloadObject=async params=>{
  steps.push(['download',params]);
  if(options.failDownload)throw Error('PRIVATE: download failed');
  return {bytes:options.bytes??jpeg,version:options.version??'revision_0001'};
 };
 const scanBytes=async({bytes,sha256Hex,mimeType})=>{
  steps.push(['scan',{sha256Hex,mimeType,byteSize:bytes.length}]);
  if(options.failScan)throw Error('PRIVATE: virus engine unavailable');
  if(options.verdict)return {...options.verdict};
  return {verdict:'clean',sha256Hex,engine:'TEST_ONLY_SCANNER'};
 };
 return {steps,getObjectMetadata,downloadObject,scanBytes};
}
const observe=(opts={})=>{
 const f=fixture(opts);
 const observer=createVerifiedPrivateDriverEvidenceObserver(f);
 return {f,observer,run:()=>observer({driverId:driver,kind:'licencia',objectKey})};
};
test('G19 accepts only a scanned, private, immutable revision and returns metadata, not bytes',async()=>{
 assert.equal(G19_EVIDENCE_LIVE_ENABLED,false);
 const {f,run}=observe();
 const result=await run();
 assert.deepEqual(result,{
  serverObserved:true,malwareScanPassed:true,ownerId:driver,
  storageBucket:G19_PRIVATE_BUCKET,objectKey,mimeType:'image/jpeg',
  byteSize:jpeg.length,sha256Hex:sha(jpeg)
 });
 assert.ok(Object.isFrozen(result));
 assert.deepEqual(f.steps.map(x=>x[0]),['metadata','download','scan','metadata']);
 assert.equal(f.steps[1][1].version,'revision_0001');
 assert.equal(f.steps[1][1].maxBytes,5*1024*1024);
 assert.equal(JSON.stringify(result).includes('bytes'),false);
 assert.equal(JSON.stringify(result).includes('TEST_ONLY'),false);
});
test('G19 refuses wrong user, unsupported document type and unsafe object path before storage calls',async()=>{
 const f=fixture(),observer=createVerifiedPrivateDriverEvidenceObserver(f);
 for(const input of [
  {driverId:other,kind:'licencia',objectKey},
  {driverId:driver,kind:'identidad_frente',objectKey},
  {driverId:driver,kind:'licencia',objectKey:'../private.jpg'},
  {driverId:driver,kind:'licencia',objectKey:driver+'/licencia-short.jpg'},
  {driverId:driver,kind:'licencia',objectKey:driver+'/licencia-abcdefghijklmnop.jpg?download=1'}
 ]){
  await assert.rejects(()=>observer(input));
 }
 assert.deepEqual(f.steps,[]);
 assert.throws(()=>createVerifiedPrivateDriverEvidenceObserver({}),/requires/);
});
test('G19 refuses public bucket, wrong owner, oversized, invalid MIME or mutable metadata',async()=>{
 for(const first of [
  {public:true},{ownerId:other},{bucketId:'public-evidence'},
  {objectKey:other+'/licencia-abcdefghijklmnop.jpg'},{objectId:'invalid'},
  {version:'invalid?'},{byteSize:0},{byteSize:5242881},
  {mimeType:'application/pdf'}
 ]){
  await assert.rejects(()=>observe({first}).run());
 }
 for(const second of [
  {version:'revision_0002'},{ownerId:other},{byteSize:25},
  {public:true},{objectId:other}
 ]){
  await assert.rejects(()=>observe({second}).run());
 }
});
test('G19 fails closed on replacement bytes, revision mismatch, JPEG spoof and truncated payload',async()=>{
 for(const values of [
  {bytes:jpeg.subarray(0,5)},{bytes:Uint8Array.from(jpeg.map(()=>0))},
  {bytes:Uint8Array.from([255,216,255,224,0,16,74,70,73,70,0,1,255,0])},
  {version:'revision_0002'},
  {failDownload:true},{failMetadata:true}
 ]){
  await assert.rejects(()=>observe(values).run(),/verification unavailable/);
 }
});
test('G19 must actually get an external clean scan matched to downloaded SHA',async()=>{
 for(const values of [
  {failScan:true},
  {verdict:{verdict:'infected',sha256Hex:sha(jpeg),engine:'TEST_ONLY_SCANNER'}},
  {verdict:{verdict:'clean',sha256Hex:'a'.repeat(64),engine:'TEST_ONLY_SCANNER'}},
  {verdict:{verdict:'clean',sha256Hex:sha(jpeg),engine:''}},
  {verdict:{verdict:'clean',sha256Hex:sha(jpeg)}}
 ]){
  await assert.rejects(()=>observe(values).run(),/verification unavailable/);
 }
});
test('G19 accepts PNG only when magic and declared extension/type all agree',async()=>{
 const key=driver+'/licencia-abcdefghijklmnop.png';
 const meta={...metadata,objectKey:key,mimeType:'image/png',byteSize:png.length};
 const f=fixture({bytes:png,first:meta,second:meta});
 const observer=createVerifiedPrivateDriverEvidenceObserver(f);
 const value=await observer({driverId:driver,kind:'licencia',objectKey:key});
 assert.equal(value.mimeType,'image/png');assert.equal(value.byteSize,png.length);
 const spoof=fixture({first:meta,second:meta,bytes:jpeg});
 await assert.rejects(()=>createVerifiedPrivateDriverEvidenceObserver(spoof)(
  {driverId:driver,kind:'licencia',objectKey:key}));
});

test('G19 supports all eight owner-scoped document keys with mandatory external scan',async()=>{
 const kinds=['licencia','identidad_frente','identidad_dorso','cedula_verde',
  'habilitacion','seguro','inspeccion','rostro_selfie'];
 for(const kind of kinds){
  const key=driver+'/'+kind+'-abcdefghijklmnop.jpg';
  const meta={...metadata,objectKey:key};
  const f=fixture({first:meta,second:meta});
  const observer=createVerifiedPrivateDriverEvidenceObserver(f);
  const result=await observer({driverId:driver,kind,objectKey:key});
  assert.equal(result.objectKey,key);
  assert.equal(result.sha256Hex,sha(jpeg));
  assert.equal(f.steps.filter(x=>x[0]==='scan').length,1);
 }
});
