/** G17 Auth-bound DRIVER evidence and ADMIN review gateway, LOCAL QA ONLY.
 * The client cannot assert a file exists, is safe, is legal, or is approved.
 * observePrivateObject MUST independently query/verify private Storage.
 */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
export const G17_DOCUMENTS_LIVE_ENABLED=false;
const READ='/v1/staging/driver/documents';
const OBSERVE='/v1/staging/driver/documents/observe';
const REVIEW='/v1/staging/admin/driver-documents/review';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS=new Set(['licencia','identidad_frente','identidad_dorso','cedula_verde','seguro','inspeccion','habilitacion']);
const STATUS=new Set(['pending','approved','rejected']);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const exact=(x,names)=>plain(x)&&Object.keys(x).length===names.length&&
 names.every(k=>Object.hasOwn(x,k));
const uuid=x=>typeof x==='string'&&UUID.test(x);
const response=(status,body)=>({status,body});
function token(headers){
 const s=headers?.authorization??headers?.Authorization;
 return typeof s==='string'&&s.length<8000?
  /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(s)?.[1]??null:null;
}
const confirmed=u=>plain(u)&&uuid(u.id)&&u.is_anonymous!==true&&
 (typeof u.email_confirmed_at==='string'||typeof u.phone_confirmed_at==='string');
function safeObject(userId,kind,key){
 return uuid(userId)&&KINDS.has(kind)&&typeof key==='string'&&
  key.length<=180&&
  new RegExp('^'+userId+'/'+kind+'-[A-Za-z0-9_-]{12,80}[.](jpg|jpeg|png)$').test(key);
}
function verifiedPrivateObservation(observation,userId,kind,key){
 if(!plain(observation)||observation.serverObserved!==true||
   observation.malwareScanPassed!==true||
   observation.ownerId!==userId||
   observation.storageBucket!=='mobility-staging-driver-evidence'||
   observation.objectKey!==key||
   !safeObject(userId,kind,key)||
   !['image/jpeg','image/png'].includes(observation.mimeType)||
   !Number.isSafeInteger(observation.byteSize)||
   observation.byteSize<1||observation.byteSize>5242880||
   typeof observation.sha256Hex!=='string'||
   !/^[a-f0-9]{64}$/.test(observation.sha256Hex))return false;
 const expected=observation.mimeType==='image/png'?'png':null;
 return expected?key.endsWith('.png'):/\.(jpg|jpeg)$/.test(key);
}
function statusRows(rows){
 if(!Array.isArray(rows)||rows.length>7)throw Error('Invalid G17 status');
 const seen=new Set();
 return rows.map(item=>{
  if(!plain(item)||!KINDS.has(item.kind)||!STATUS.has(item.status)||
    !Number.isSafeInteger(item.submittedAtMs)||
    !(item.reviewedAtMs===null||Number.isSafeInteger(item.reviewedAtMs))||
    (item.status==='pending')!==(item.reviewedAtMs===null)||
    seen.has(item.kind))
   throw Error('Invalid G17 status item');
  seen.add(item.kind);
  return {kind:item.kind,status:item.status,
   submittedAtMs:item.submittedAtMs,reviewedAtMs:item.reviewedAtMs};
 });
}
export function createDriverDocumentGateway({
 projectRef,verifyAccessToken,authorizeDriver,authorizeAdmin,allowRequest,
 readStatus,registerObservation,review,observePrivateObject
}={}){
 assertStagingRef(projectRef);
 if(![verifyAccessToken,authorizeDriver,authorizeAdmin,allowRequest,
   readStatus,registerObservation,review,observePrivateObject]
   .every(x=>typeof x==='function'))
  throw Error('Trusted G17 gateway adapters required');
 return async({method,path,headers,body}={})=>{
  const isRead=method==='GET'&&path===READ;
  const isObserve=method==='POST'&&path===OBSERVE;
  const isReview=method==='POST'&&path===REVIEW;
  if(!isRead&&!isObserve&&!isReview)return response(404,{error:'Not found'});
  if(isRead&&body!==undefined&&body!==null)
   return response(400,{error:'GET body is forbidden'});
  if(isObserve&&(!exact(body,['requestKey','kind','objectKey'])||
    !uuid(body.requestKey)||!KINDS.has(body.kind)||
    typeof body.objectKey!=='string'))
   return response(400,{error:'Invalid private evidence reference'});
  if(isReview&&(!exact(body,['requestKey','documentId','approve','reasonCode'])||
    !uuid(body.requestKey)||!uuid(body.documentId)||
    typeof body.approve!=='boolean'||typeof body.reasonCode!=='string'||
    !/^[A-Z_]{3,40}$/.test(body.reasonCode)))
   return response(400,{error:'Invalid KYC review request'});
  const bearer=token(headers);
  if(!bearer)return response(401,{error:'Verified session required'});
  let user;
  try{user=await verifyAccessToken(bearer);}catch{
   return response(401,{error:'Session verification failed'});
  }
  if(!confirmed(user))return response(401,{error:'Confirmed account required'});
  try{
   const allowed=await (isReview?authorizeAdmin:authorizeDriver)(user.id);
   if(allowed!==true)return response(403,{error:'Required role missing'});
  }catch{return response(503,{error:'Role verification unavailable'});}
  try{
   if(allowRequest({userId:user.id,
    operation:isReview?'document_review':isObserve?'document_observe':'document_status'})!==true)
    return response(429,{error:'Request rate limited'});
  }catch{return response(503,{error:'Rate limiter unavailable'});}
  if(isRead){
   try{
    const rows=await readStatus({driverId:user.id});
    return response(200,{mode:'STAGING_DEMO_ONLY',liveOperationsEnabled:false,
     documents:statusRows(rows)});
   }catch{return response(503,{error:'Document state unavailable'});}
  }
  if(isObserve){
   if(!safeObject(user.id,body.kind,body.objectKey))
    return response(400,{error:'Invalid private evidence path'});
   try{
    // Provider lookup must verify owner, actual bytes, storage bucket & scan.
    // No fallback accepting client-provided MIME or SHA is permitted.
    const observation=await observePrivateObject({
     driverId:user.id,kind:body.kind,objectKey:body.objectKey
    });
    if(!verifiedPrivateObservation(observation,user.id,body.kind,body.objectKey))
     return response(409,{error:'Verified private object not available'});
    const documentId=await registerObservation({
     driverId:user.id,requestKey:body.requestKey,kind:body.kind,
     objectKey:observation.objectKey,mimeType:observation.mimeType,
     byteSize:observation.byteSize,sha256Hex:observation.sha256Hex
    });
    if(!uuid(documentId))throw Error('Missing document receipt');
    return response(202,{mode:'STAGING_DEMO_ONLY',documentId,
     status:'pending',evidenceAuthenticityVerified:false,driverEligible:false});
   }catch{return response(503,{error:'Private evidence registration unavailable'});}
  }
  try{
   const auditId=await review({reviewerId:user.id,
    documentId:body.documentId,requestKey:body.requestKey,
    approve:body.approve,reasonCode:body.reasonCode});
   if(!uuid(auditId))throw Error('Invalid review audit receipt');
   return response(200,{mode:'STAGING_DEMO_ONLY',auditId,
    outcome:body.approve?'approved':'rejected',driverEligible:false,
    liveOperationsEnabled:false});
  }catch{return response(409,{error:'Review unauthorized, disputed or already decided'});}
 };
}
