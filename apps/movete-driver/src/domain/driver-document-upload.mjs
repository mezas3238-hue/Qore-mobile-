/**
 * Driver KYC upload: authenticated STAGING-only, private object and G17
 * observe. Native camera/gallery + Storage are injected by an authorized
 * integration, never inferred, mocked or enabled in the production app tree.
 * The phone does NOT attest authenticity, expiry, identity or face match.
 */
import {resolveDriverStatusOrigin} from './driver-status-origin.mjs';
export const DRIVER_DOCUMENT_UPLOAD_LIVE_ENABLED=false;
export const DRIVER_KYC_UPLOAD_KINDS=Object.freeze([
 'licencia','identidad_frente','identidad_dorso','cedula_verde',
 'habilitacion','seguro','inspeccion','rostro_selfie']);
const KINDS=new Set(DRIVER_KYC_UPLOAD_KINDS);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const BUCKET='mobility-staging-driver-evidence';
const MAX=5242880;
const exact=(obj,keys)=>obj!==null&&typeof obj==='object'&&
 !Array.isArray(obj)&&Object.keys(obj).length===keys.length&&
 keys.every(k=>Object.hasOwn(obj,k));
function validMagic(bytes,mime){
 if(!(bytes instanceof Uint8Array)||bytes.byteLength<20||
   bytes.byteLength>MAX)return false;
 if(mime==='image/png')return [137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x)&&
  bytes[12]===73&&bytes[13]===72&&bytes[14]===68&&bytes[15]===82;
 if(mime==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&
  bytes.at(-2)===255&&bytes.at(-1)===217;
 return false;
}
const receipt=(kind)=>Object.freeze({kind,phase:'pending-review',
 accountApproved:false,driverEligible:false,qaOnly:true,
 productionEnabled:false});
/**
 * Returns only a privacy-safe status; never persists the image in state.
 * A 503/lost response from observe means unknown COMMIT: do NOT automatically
 * reupload, reobserve or claim rollback. The user can refresh private status.
 */
export async function submitPrivateDriverEvidence({
 kind,faceConsent=false,authAdapter,
 apiOrigin,approvedStagingHost=null,allowedByOwner=false,
 captureEvidence,uploadPrivateObject,makeRequestKey,request=fetch
}={}){
 if(!KINDS.has(kind)||typeof authAdapter?.getSession!=='function'||
  typeof captureEvidence!=='function'||typeof uploadPrivateObject!=='function'||
  typeof makeRequestKey!=='function'||typeof request!=='function'||
  allowedByOwner!==true||approvedStagingHost===null)
  throw Error('DOCUMENT_UPLOAD_NOT_CONFIGURED');
 if(kind==='rostro_selfie'&&faceConsent!==true)
  throw Error('FACE_CONSENT_REQUIRED');
 const origin=resolveDriverStatusOrigin({
  apiOrigin,approvedStagingHost,allowedByOwner:true});
 const session=await authAdapter.getSession().catch(()=>null);
 if(session?.role!=='driver'||!UUID.test(session.userId??'')||
   typeof session.accessToken!=='string'||!TOKEN.test(session.accessToken))
  throw Error('DRIVER_SESSION_REQUIRED');
 const nonce=await makeRequestKey();
 if(typeof nonce!=='string'||!UUID.test(nonce))
  throw Error('PRIVATE_DOCUMENT_KEY_UNAVAILABLE');
 const key=session.userId+'/'+kind+'-'+nonce.replace(/-/g,'')+'.jpg';
 let bytes;
 try{
  const capture=await captureEvidence({
   kind,source:kind==='rostro_selfie'?'camera':'camera_or_library',
   maxBytes:MAX
  });
  if(capture===null)return Object.freeze({kind,phase:'cancelled',
   accountApproved:false,driverEligible:false,qaOnly:true,
   productionEnabled:false});
  // Even rejected camera data must be wiped before leaving this function.
  if(capture?.bytes instanceof Uint8Array)bytes=capture.bytes;
  if(!exact(capture,['bytes','mimeType','source'])||
    !['camera','library'].includes(capture.source)||
    (kind==='rostro_selfie'&&capture.source!=='camera')||
    !validMagic(capture.bytes,capture.mimeType))
   throw Error('PRIVATE_IMAGE_INVALID');
  bytes=capture.bytes;
  const ext=capture.mimeType==='image/png'?'png':'jpg';
  const objectKey=key.slice(0,-3)+ext;
  // The Storage SDK must use the verified account session and private bucket
  // RLS; never upload via a general-purpose URL, public bucket or signed URL.
  const uploaded=await uploadPrivateObject({
   bucket:BUCKET,objectKey,mimeType:capture.mimeType,
   bytes,upsert:false,accessToken:session.accessToken
  });
  if(!exact(uploaded,['storedPrivately'])||
    uploaded.storedPrivately!==true)
   throw Error('PRIVATE_STORAGE_NOT_CONFIRMED');
  // Session/account changes mid-upload must never register a cross-user file.
  const later=await authAdapter.getSession().catch(()=>null);
  if(later?.role!=='driver'||later.userId!==session.userId||
    later.accessToken!==session.accessToken)
   throw Error('DRIVER_SESSION_CHANGED');
  let answer;
  try{
   answer=await request(origin+'/v1/staging/driver/documents/observe',{
    method:'POST',cache:'no-store',credentials:'omit',
    headers:{authorization:'Bearer '+session.accessToken,
     'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify({requestKey:nonce,kind,objectKey})
   });
  }catch{throw Error('PRIVATE_OBSERVATION_OUTCOME_UNKNOWN');}
  if(answer?.status!==202)
   throw Error('PRIVATE_OBSERVATION_NOT_CONFIRMED');
  let parsed;
  try{parsed=await answer.json();}catch{
   throw Error('PRIVATE_OBSERVATION_OUTCOME_UNKNOWN');
  }
  if(!exact(parsed,['mode','documentId','status',
    'evidenceAuthenticityVerified','driverEligible'])||
    parsed.mode!=='STAGING_DEMO_ONLY'||!UUID.test(parsed.documentId??'')||
    parsed.status!=='pending'||parsed.evidenceAuthenticityVerified!==false||
    parsed.driverEligible!==false)
   throw Error('PRIVATE_OBSERVATION_UNTRUSTED');
  return receipt(kind);
 }finally{
  // Native capture must return a disposable owned buffer. Destroy local
  // image data after transfer/failure, never keep photo bytes in React state.
  if(bytes)bytes.fill(0);
 }
}
