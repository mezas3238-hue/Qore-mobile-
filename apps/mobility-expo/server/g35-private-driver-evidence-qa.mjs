/**
 * G35.1 — private, QA-only documentary preflight diagnostic.
 * No HTTP listener and NO dispatch capability. All server authorities injected.
 * This is not an identity or GPS spoof-detection implementation.
 */
import {createQoreBackofficeRoleAuthority} from './g27-backoffice-role-authority.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SERVICES=new Set(['AUTO_RIDE','AUTO_DELIVERY','MOTO_DELIVERY']);
const fields=['source','hasFreshQuarantinedSignal','hasCurrentLocationConsent',
 'freeOfActiveAssignments','vehicleDocumentEvidenceReviewed',
 'candidateEvidenceComplete','zoneEligibleByPolicy',
 'availabilityConfirmed','dispatchAuthorized','productionEnabled'];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const res=(status,code,data)=>Object.freeze({
 status,body:data??Object.freeze({code})
});
export function createQoreG35PrivateReadinessQa({
 environment,liveEnabled,localQaOnly,rpc,verifyAccessToken,
 verifyBackofficeMfa,allowRequest,now=Date.now
}={}){
 if(environment!=='isolated_staging'||liveEnabled!==false||localQaOnly!==true)
  throw Error('G35 documentary diagnostic is local QA only');
 if([rpc,verifyAccessToken,verifyBackofficeMfa,allowRequest,now]
   .some(fn=>typeof fn!=='function'))
  throw Error('G35 independent trusted JWT, role, MFA, limiter, SQL sources required');
 const roles=createQoreBackofficeRoleAuthority({rpc});
 return async function inspect({bearer,driverId,zoneId,serviceKind}={}){
  if(typeof bearer!=='string'||bearer.length<20||bearer.length>7900||
   !/^[A-Za-z0-9._~-]+$/.test(bearer))return res(401,'JWT_REQUIRED');
  if(typeof driverId!=='string'||!UUID.test(driverId)||
   typeof zoneId!=='string'||!UUID.test(zoneId)||
   !SERVICES.has(serviceKind))return res(400,'INVALID_QA_EVIDENCE_REQUEST');
  const at=now();
  if(!Number.isSafeInteger(at)||at<0)return res(503,'CLOCK_UNAVAILABLE');
  let identity;
  try{identity=await verifyAccessToken(bearer);}
  catch{return res(401,'SESSION_NOT_VERIFIED');}
  if(!object(identity)||typeof identity.id!=='string'||!UUID.test(identity.id)||
    identity.is_anonymous===true||
    !(typeof identity.email_confirmed_at==='string'||
      typeof identity.phone_confirmed_at==='string')||
    typeof identity.sessionId!=='string'||identity.sessionId.length<8||
    !Number.isSafeInteger(identity.expiresAtMs)||identity.expiresAtMs<=at)
   return res(401,'SESSION_NOT_VERIFIED');
  let role;
  try{role=await roles.loadExclusiveBackofficeRole(identity.id);}
  catch{return res(503,'ROLE_UNAVAILABLE');}
  if(role!=='admin')return res(403,'EXCLUSIVE_ADMIN_REQUIRED');
  let allowed;
  try{allowed=await roles.authorizePermission({
   userId:identity.id,scope:'admin.zones.read'
  });}catch{return res(503,'SCOPE_UNAVAILABLE');}
  if(allowed!==true)return res(403,'ZONE_SCOPE_DENIED');
  try{
   if(allowRequest({userId:identity.id,operation:'qa.driver.evidence'})!==true)
    return res(429,'QA_EVIDENCE_LIMITED');
  }catch{return res(503,'RATE_LIMIT_UNAVAILABLE');}
  let proof;
  try{proof=await verifyBackofficeMfa({
   token:bearer,userId:identity.id,sessionId:identity.sessionId,
   requiredLevel:'aal2',at
  });}catch{return res(503,'MFA_UNAVAILABLE');}
  if(!object(proof)||proof.verifiedByProvider!==true||
   proof.userId!==identity.id||proof.sessionId!==identity.sessionId||
   proof.assuranceLevel!=='aal2'||
   !Number.isSafeInteger(proof.verifiedAtMs)||proof.verifiedAtMs>at||
   at-proof.verifiedAtMs>43200000||
   !Number.isSafeInteger(proof.expiresAtMs)||proof.expiresAtMs<=at||
   proof.expiresAtMs>identity.expiresAtMs)return res(403,'AAL2_REQUIRED');
  let doc;
  try{
   const out=await rpc('mobility_stage_g35_driver_documentary_diagnostic',{
    _admin:identity.id,_driver:driverId,_zone:zoneId,
    _service:serviceKind,_anchor_ms:at
   });
   if(!object(out)||out.error)throw Error('Source unavailable');
   doc=out.data;
  }catch{return res(503,'EVIDENCE_SOURCE_UNAVAILABLE');}
  if(!object(doc)||Object.keys(doc).length!==fields.length||
   !fields.every(k=>Object.hasOwn(doc,k))||
   doc.source!=='QA_G35_DOCUMENTARY_DIAGNOSTIC_ONLY'||
   !['hasFreshQuarantinedSignal','hasCurrentLocationConsent',
    'freeOfActiveAssignments','vehicleDocumentEvidenceReviewed',
    'candidateEvidenceComplete'].every(k=>typeof doc[k]==='boolean')||
   doc.candidateEvidenceComplete!==(
    doc.hasFreshQuarantinedSignal&&doc.hasCurrentLocationConsent&&
    doc.freeOfActiveAssignments&&doc.vehicleDocumentEvidenceReviewed
   )||doc.zoneEligibleByPolicy!==false||
   doc.availabilityConfirmed!==false||doc.dispatchAuthorized!==false||
   doc.productionEnabled!==false)
   return res(503,'UNSAFE_EVIDENCE_DIAGNOSTIC');
  return res(200,'',Object.freeze({...doc}));
 };
}
