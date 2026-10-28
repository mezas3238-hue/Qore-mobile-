/**
 * G47 A28: private Driver document evidence lease boundary, QA ONLY.
 * NO storage SDK, signed URL, file bytes, client-controlled identity or LIVE.
 * SQL RPC functions require disposable database owner; they are NOT mounted.
 */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const id=s=>typeof s==='string'&&ID.test(s);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const number=n=>Number.isSafeInteger(n)&&n>=0;
const purposes=new Set(['DRIVER_SELF_VIEW','ADMIN_MANUAL_REVIEW']);
const error=(status,code)=>Object.freeze({status,body:Object.freeze({error:code})});
const LEASE=['leaseId','expiresAtMs','accessMode','signedUrlAvailable',
 'storageConnected','documentBytesAvailable','productionEnabled'];
const PROBE=['leaseActive','signedUrlAvailable','documentBytesAvailable',
 'productionEnabled'];
function validLease(value,at){
 return exact(value,LEASE)&&id(value.leaseId)&&
  number(value.expiresAtMs)&&value.expiresAtMs>at&&
  value.expiresAtMs<=at+60000&&
  value.accessMode==='QA_PRIVATE_METADATA_ONLY'&&
  value.signedUrlAvailable===false&&value.storageConnected===false&&
  value.documentBytesAvailable===false&&value.productionEnabled===false;
}
function validProbe(value){
 return exact(value,PROBE)&&typeof value.leaseActive==='boolean'&&
  value.signedUrlAvailable===false&&value.documentBytesAvailable===false&&
  value.productionEnabled===false;
}
export function createG47DriverEvidenceLeaseQa({
 environment,liveEnabled,localQaOnly,projectRef,verifyAccessToken,
 verifySessionNotRevoked,resolveExclusiveRole,verifyBackofficeMfa,
 allowRequest,rpc,now=Date.now
}={}){
 assertStagingRef(projectRef);
 if(environment!=='isolated_staging'||liveEnabled!==false||localQaOnly!==true||
 [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
  verifyBackofficeMfa,allowRequest,rpc,now].some(f=>typeof f!=='function'))
 throw Error('G47 signed provider and independent QA sources required');
 async function actor(bearer,purpose){
  if(typeof bearer!=='string'||bearer.length<20||bearer.length>7900||
   !/^[A-Za-z0-9._~-]+$/.test(bearer))return {failure:error(401,'PROVIDER_JWT_REQUIRED')};
  const at=now();
  if(!number(at)||at>8640000000000000)
   return {failure:error(503,'CLOCK_UNAVAILABLE')};
  let identity;
  try{identity=await verifyAccessToken(bearer);}
  catch{return {failure:error(401,'PROVIDER_JWT_INVALID')};}
  if(!obj(identity)||!id(identity.id)||!id(identity.sessionId)||
   !number(identity.tokenIatMs)||identity.tokenIatMs>at||
   !number(identity.expiresAtMs)||identity.expiresAtMs<=at||
   identity.is_anonymous===true||
   !(typeof identity.email_confirmed_at==='string'||
    typeof identity.phone_confirmed_at==='string'))
   return {failure:error(401,'PROVIDER_SESSION_INVALID')};
  let verified;
  try{
   verified=await verifySessionNotRevoked({userId:identity.id,
    sessionId:identity.sessionId,at});
  }catch{return {failure:error(503,'SESSION_SOURCE_UNAVAILABLE')};}
  if(verified!==true)return {failure:error(401,'SESSION_REVOKED')};
  let role;
  try{role=await resolveExclusiveRole(identity.id);}
  catch{return {failure:error(503,'ROLE_SOURCE_UNAVAILABLE')};}
  if(role!== (purpose==='DRIVER_SELF_VIEW'?'driver':'admin'))
   return {failure:error(403,'ROLE_NOT_AUTHORIZED')};
  if(purpose==='ADMIN_MANUAL_REVIEW'){
   let mfa;
   try{
    mfa=await verifyBackofficeMfa({token:bearer,userId:identity.id,
      sessionId:identity.sessionId,at});
   }catch{return {failure:error(403,'AAL2_REQUIRED')};}
   if(!obj(mfa)||mfa.verifiedByProvider!==true||
    mfa.userId!==identity.id||mfa.sessionId!==identity.sessionId||
    mfa.assuranceLevel!=='aal2'||!number(mfa.verifiedAtMs)||
    mfa.verifiedAtMs>at||at-mfa.verifiedAtMs>43200000||
    !number(mfa.expiresAtMs)||mfa.expiresAtMs<=at)
    return {failure:error(403,'AAL2_REQUIRED')};
  }
  try{
   if(allowRequest({userId:identity.id,
     operation:'g47.document.'+purpose})!==true)
    return {failure:error(429,'EVIDENCE_RATE_LIMIT')};
  }catch{return {failure:error(503,'RATE_LIMIT_UNAVAILABLE')};}
  return {identity,at};
 }
 async function issue({bearer,body}={}){
  if(!exact(body,['documentId','requestKey','purpose'])||
   !id(body.documentId)||!id(body.requestKey)||!purposes.has(body.purpose))
   return error(400,'INVALID_LEASE_REQUEST');
  const {identity,at,failure}=await actor(bearer,body.purpose);
  if(failure)return failure;
  let res;
  try{
   res=await rpc('mobility_stage_g47_issue_lease_qa',{
    _actor:identity.id,_session:identity.sessionId,
    _iat_ms:identity.tokenIatMs,_document:body.documentId,
    _request_key:body.requestKey,_purpose:body.purpose
   });
  }catch{return error(503,'EVIDENCE_SOURCE_UNAVAILABLE')};
  if(!obj(res))return error(503,'EVIDENCE_SOURCE_UNAVAILABLE');
  if(res.error){
   if(res.error.code==='G4709')return error(409,'LEASE_REQUEST_CONFLICT');
   if(res.error.code==='G4704')return error(410,'LEASE_EXPIRED_OR_REVOKED');
   if(['G4701','G4703'].includes(res.error.code))
    return error(403,'EVIDENCE_ACCESS_DENIED');
   return error(503,'EVIDENCE_SOURCE_UNAVAILABLE');
  }
  if(!validLease(res.data,at))return error(503,'UNSAFE_EVIDENCE_RECEIPT');
  return Object.freeze({status:201,body:Object.freeze({...res.data})});
 }
 async function probe({bearer,body}={}){
  if(!exact(body,['leaseId','purpose'])||!id(body.leaseId)||
   !purposes.has(body.purpose))return error(400,'INVALID_LEASE_PROBE');
  const {identity,failure}=await actor(bearer,body.purpose);
  if(failure)return failure;
  let res;
  try{
   res=await rpc('mobility_stage_g47_probe_lease_qa',{
    _actor:identity.id,_session:identity.sessionId,
    _iat_ms:identity.tokenIatMs,_lease:body.leaseId
   });
  }catch{return error(503,'EVIDENCE_SOURCE_UNAVAILABLE')};
  if(!obj(res)||res.error||!validProbe(res.data))
   return error(503,'UNSAFE_EVIDENCE_PROBE');
  return Object.freeze({status:200,body:Object.freeze({...res.data})});
 }
 return Object.freeze({issue,probe});
}
