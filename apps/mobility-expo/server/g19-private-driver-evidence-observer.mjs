/**
 * G19: trusted PRIVATE evidence verifier for STAGING, not an upload endpoint.
 *
 * All three adapters MUST be server-owned and independently implemented:
 *   getObjectMetadata({bucketId,objectKey}) -> immutable revision descriptor
 *   downloadObject({bucketId,objectKey,version,maxBytes}) -> {bytes,version}
 *   scanBytes({bytes,sha256Hex,mimeType}) -> {verdict,sha256Hex,engine}
 *
 * The scanner MUST actually decode and inspect imagery for malicious content,
 * not merely check image magic numbers. No scanner is shipped in this module.
 * Do not use a pass-through/mock scanner outside synthetic unit tests.
 * The metadata adapter must guarantee version changes on every overwrite.
 *
 * No network endpoints, secret tokens, real uploads, downloads, or storage
 * providers are configured by this module. Never run LIVE.
 */
import {createHash} from 'node:crypto';

export const G19_EVIDENCE_LIVE_ENABLED=false;
export const G19_PRIVATE_BUCKET='mobility-staging-driver-evidence';
const MAX_BYTES=5*1024*1024;
const ALLOWED=new Set(['licencia','identidad_frente','identidad_dorso',
 'cedula_verde','habilitacion','seguro','inspeccion','rostro_selfie']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const version=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{8,120}$/.test(x);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const isUuid=x=>typeof x==='string'&&UUID.test(x);
function checkKey({driverId,kind,objectKey}={}){
 if(!isUuid(driverId)||!ALLOWED.has(kind)||typeof objectKey!=='string'||
    objectKey.length>180||
    !new RegExp('^'+driverId+'/'+kind+'-[A-Za-z0-9_-]{12,80}[.](jpg|jpeg|png))
  throw Error('G19 invalid private Driver evidence key');
}
function validMetadata(record,{driverId,objectKey}){
 return plain(record)&&record.bucketId===G19_PRIVATE_BUCKET&&
   record.public===false&&record.ownerId===driverId&&
   record.objectKey===objectKey&&isUuid(record.objectId)&&
   version(record.version)&&Number.isSafeInteger(record.byteSize)&&
   record.byteSize>=1&&record.byteSize<=MAX_BYTES&&
   ['image/jpeg','image/png'].includes(record.mimeType)&&
   ((record.mimeType==='image/png'&&objectKey.endsWith('.png'))||
    (record.mimeType==='image/jpeg'&&/[.](jpg|jpeg)$/.test(objectKey)));
}
function sameMetadata(a,b){
 return a.objectId===b.objectId&&a.version===b.version&&
  a.ownerId===b.ownerId&&a.objectKey===b.objectKey&&
  a.byteSize===b.byteSize&&a.mimeType===b.mimeType&&
  a.public===b.public&&a.bucketId===b.bucketId;
}
function validImageHeader(bytes,mimeType){
 if(mimeType==='image/png'){
  if(bytes.length<20)return false;
  const magic=[137,80,78,71,13,10,26,10];
  return magic.every((n,i)=>bytes[i]===n)&&
   bytes[12]===73&&bytes[13]===72&&bytes[14]===68&&bytes[15]===82;
 }
 return bytes.length>=8&&bytes[0]===255&&bytes[1]===216&&
    bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217;
}
/**
 * Returns metadata only after independently verifying ownership, immutable
 * version, real downloaded bytes, SHA-256, and an external clean scan verdict.
 */
export function createVerifiedPrivateDriverEvidenceObserver({
 getObjectMetadata,downloadObject,scanBytes
}={}){
 if(![getObjectMetadata,downloadObject,scanBytes].every(f=>typeof f==='function'))
  throw Error('G19 requires private metadata, version-pinned download and real scanner');
 return async function observePrivateObject({driverId,kind,objectKey}={}){
  checkKey({driverId,kind,objectKey});
  const params={bucketId:G19_PRIVATE_BUCKET,objectKey};
  let bytes;
  try{
   const before=await getObjectMetadata(params);
   if(!validMetadata(before,{driverId,objectKey}))
    throw Error('Private evidence metadata mismatch');
   const download=await downloadObject({
    ...params,version:before.version,maxBytes:MAX_BYTES
   });
   if(!plain(download)||download.version!==before.version||
      !(download.bytes instanceof Uint8Array)||
      download.bytes.byteLength!==before.byteSize||
      download.bytes.byteLength<1||download.bytes.byteLength>MAX_BYTES)
    throw Error('Private object bytes or revision mismatch');
   bytes=Buffer.from(download.bytes); // private copy for scanner and wiping
   if(!validImageHeader(bytes,before.mimeType))
    throw Error('Document magic or MIME mismatch');
   const sha256Hex=createHash('sha256').update(bytes).digest('hex');
   const scan=await scanBytes({
    bytes,sha256Hex,mimeType:before.mimeType
   });
   if(!plain(scan)||scan.verdict!=='clean'||
      scan.sha256Hex!==sha256Hex||
      typeof scan.engine!=='string'||!/[A-Za-z0-9_-]{3,80}/.test(scan.engine)||
      scan.engine.length>80)
    throw Error('Verified malware inspection required');
   // Detect replacement, ownership, or metadata changes during download/scan.
   const after=await getObjectMetadata(params);
   if(!validMetadata(after,{driverId,objectKey})||!sameMetadata(before,after))
    throw Error('Private evidence changed during inspection');
   return Object.freeze({
    serverObserved:true,malwareScanPassed:true,
    ownerId:driverId,storageBucket:G19_PRIVATE_BUCKET,objectKey,
    mimeType:before.mimeType,byteSize:bytes.byteLength,sha256Hex
   });
  }catch{
   // Do not echo storage paths, media payloads, signer IDs, scanner internals.
   throw Error('G19 private evidence verification unavailable');
  }finally{
   if(bytes)bytes.fill(0); // never retain an unencrypted local file
  }
 };
}
).test(objectKey))
  throw Error('G19 invalid private Driver evidence key');
}
function validMetadata(record,{driverId,objectKey}){
 return plain(record)&&record.bucketId===G19_PRIVATE_BUCKET&&
   record.public===false&&record.ownerId===driverId&&
   record.objectKey===objectKey&&isUuid(record.objectId)&&
   version(record.version)&&Number.isSafeInteger(record.byteSize)&&
   record.byteSize>=1&&record.byteSize<=MAX_BYTES&&
   ['image/jpeg','image/png'].includes(record.mimeType)&&
   ((record.mimeType==='image/png'&&objectKey.endsWith('.png'))||
    (record.mimeType==='image/jpeg'&&/[.](jpg|jpeg)$/.test(objectKey)));
}
function sameMetadata(a,b){
 return a.objectId===b.objectId&&a.version===b.version&&
  a.ownerId===b.ownerId&&a.objectKey===b.objectKey&&
  a.byteSize===b.byteSize&&a.mimeType===b.mimeType&&
  a.public===b.public&&a.bucketId===b.bucketId;
}
function validImageHeader(bytes,mimeType){
 if(mimeType==='image/png'){
  if(bytes.length<20)return false;
  const magic=[137,80,78,71,13,10,26,10];
  return magic.every((n,i)=>bytes[i]===n)&&
   bytes[12]===73&&bytes[13]===72&&bytes[14]===68&&bytes[15]===82;
 }
 return bytes.length>=8&&bytes[0]===255&&bytes[1]===216&&
    bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217;
}
/**
 * Returns metadata only after independently verifying ownership, immutable
 * version, real downloaded bytes, SHA-256, and an external clean scan verdict.
 */
export function createVerifiedPrivateDriverEvidenceObserver({
 getObjectMetadata,downloadObject,scanBytes
}={}){
 if(![getObjectMetadata,downloadObject,scanBytes].every(f=>typeof f==='function'))
  throw Error('G19 requires private metadata, version-pinned download and real scanner');
 return async function observePrivateObject({driverId,kind,objectKey}={}){
  checkKey({driverId,kind,objectKey});
  const params={bucketId:G19_PRIVATE_BUCKET,objectKey};
  let bytes;
  try{
   const before=await getObjectMetadata(params);
   if(!validMetadata(before,{driverId,objectKey}))
    throw Error('Private evidence metadata mismatch');
   const download=await downloadObject({
    ...params,version:before.version,maxBytes:MAX_BYTES
   });
   if(!plain(download)||download.version!==before.version||
      !(download.bytes instanceof Uint8Array)||
      download.bytes.byteLength!==before.byteSize||
      download.bytes.byteLength<1||download.bytes.byteLength>MAX_BYTES)
    throw Error('Private object bytes or revision mismatch');
   bytes=Buffer.from(download.bytes); // private copy for scanner and wiping
   if(!validImageHeader(bytes,before.mimeType))
    throw Error('Document magic or MIME mismatch');
   const sha256Hex=createHash('sha256').update(bytes).digest('hex');
   const scan=await scanBytes({
    bytes,sha256Hex,mimeType:before.mimeType
   });
   if(!plain(scan)||scan.verdict!=='clean'||
      scan.sha256Hex!==sha256Hex||
      typeof scan.engine!=='string'||!/[A-Za-z0-9_-]{3,80}/.test(scan.engine)||
      scan.engine.length>80)
    throw Error('Verified malware inspection required');
   // Detect replacement, ownership, or metadata changes during download/scan.
   const after=await getObjectMetadata(params);
   if(!validMetadata(after,{driverId,objectKey})||!sameMetadata(before,after))
    throw Error('Private evidence changed during inspection');
   return Object.freeze({
    serverObserved:true,malwareScanPassed:true,
    ownerId:driverId,storageBucket:G19_PRIVATE_BUCKET,objectKey,
    mimeType:before.mimeType,byteSize:bytes.byteLength,sha256Hex
   });
  }catch{
   // Do not echo storage paths, media payloads, signer IDs, scanner internals.
   throw Error('G19 private evidence verification unavailable');
  }finally{
   if(bytes)bytes.fill(0); // never retain an unencrypted local file
  }
 };
}
