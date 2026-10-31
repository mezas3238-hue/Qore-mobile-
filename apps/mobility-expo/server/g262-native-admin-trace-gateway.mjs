/**
 * G262 native five-service Admin provenance HTTP gateway over real PG17 tables.
 * It is NOT the disposable G138/142/145/146 priced receipt and NEVER certifies
 * billing, settlement or external five-journey E2E. Opt-in G260 AAL2/G42 only.
 */
const PATH=/^\/v1\/staging\/admin\/native-services\/(AUTO_RIDE|MOTO_RIDE|DELIVERY_AUTO|DELIVERY_MOTO|COMMERCE)\/([0-9a-f-]{36})\/trace$/i;
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}-[0-9a-f]{12}$/i;
const deny=(status,code)=>({status,body:{code,qaOnly:true,productionEnabled:false}});
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const FIELDS=['mode','serviceKind','serviceId','requestKey','viewerId',
 'actorId','assignedParticipantOrLinkedDeliveryId','status','revision',
 'createdAt','changedAt','events','totalEvents','eventsTruncated',
 'serverPersisted','financialReconciliationCertified',
 'externalEndToEndCertified','productionEnabled'];
function validEvidence(data,viewer,kind,id){
 if(!obj(data)||Object.keys(data).length!==FIELDS.length||
  FIELDS.some(k=>!Object.hasOwn(data,k))||
  data.mode!=='STAGING_DEMO_ONLY'||data.serviceKind!==kind||
  data.serviceId!==id||data.viewerId!==viewer||
  !ID.test(data.requestKey??'')||!ID.test(data.actorId??'')||
  !(data.assignedParticipantOrLinkedDeliveryId===null||
    ID.test(data.assignedParticipantOrLinkedDeliveryId??''))||
  !Number.isSafeInteger(data.revision)||data.revision<1||
  typeof data.status!=='string'||data.status.length>35||
  !Number.isFinite(Date.parse(data.createdAt))||
  !Number.isFinite(Date.parse(data.changedAt))||
  !Array.isArray(data.events)||data.events.length>64||
  !Number.isSafeInteger(data.totalEvents)||data.totalEvents<0||
  data.totalEvents<data.events.length||
  data.eventsTruncated!==(data.totalEvents>64)||
  data.serverPersisted!==true||
  data.financialReconciliationCertified!==false||
  data.externalEndToEndCertified!==false||data.productionEnabled!==false)
  return false;
 let previous=0;const ids=new Set();
 for(const e of data.events){
  if(!obj(e)||Object.keys(e).length!==4||
   !ID.test(e.eventId??'')||ids.has(e.eventId)||
   !Number.isSafeInteger(e.revision)||e.revision<=previous||
   typeof e.status!=='string'||e.status.length>35||
   !Number.isFinite(Date.parse(e.at)))return false;
  ids.add(e.eventId);previous=e.revision;
 }
 return true;
}
export function createG262NativeAdminTraceGateway({
 environment,qaOnly,liveEnabled,
 verifyAccessToken,verifySessionNotRevoked,
 loadExclusiveBackofficeRole,verifyBackofficeMfa,
 allowRequest,loadNativeTrace,now=Date.now
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,loadExclusiveBackofficeRole,
   verifyBackofficeMfa,allowRequest,loadNativeTrace,now]
   .some(f=>typeof f!=='function'))
  throw Error('G262 requires explicit independent Admin AAL2 and native SQL');
 return async({method,path,headers={},body}={})=>{
  const match=method==='GET'&&typeof path==='string'?PATH.exec(path):null;
  if(!match||!ID.test(match[2]??'')||body!=null)
   return deny(404,'G262_ROUTE_NOT_FOUND');
  const kind=match[1].toUpperCase(),sourceId=match[2].toLowerCase();
  const token=typeof headers.authorization==='string'&&
    !headers.Authorization&&!headers.cookie?
    /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(headers.authorization)?.[1]:null;
  if(!token)return deny(401,'G262_BEARER_REQUIRED');
  const at=now();
  if(!Number.isSafeInteger(at)||at<0)return deny(503,'G262_CLOCK_INVALID');
  let user;
  try{user=await verifyAccessToken(token);}catch{return deny(401,'G262_IDENTITY_UNAVAILABLE');}
  if(!obj(user)||!ID.test(user.id??'')||!ID.test(user.sessionId??'')||
   user.is_anonymous!==false||
   !Number.isSafeInteger(user.expiresAtMs)||user.expiresAtMs<=at||
   !(typeof user.email_confirmed_at==='string'||
    typeof user.phone_confirmed_at==='string'))
   return deny(401,'G262_IDENTITY_UNVERIFIED');
  try{
   if(await verifySessionNotRevoked({userId:user.id,sessionId:user.sessionId,at})!==true)
    return deny(401,'G262_SESSION_REVOKED');
  }catch{return deny(503,'G262_SESSION_CHECK_UNAVAILABLE');}
  let role;
  try{role=await loadExclusiveBackofficeRole(user.id);}
  catch{return deny(503,'G262_ADMIN_ROLE_UNAVAILABLE');}
  if(role!=='admin')return deny(403,'G262_ADMIN_REQUIRED');
  let mfa;
  try{mfa=await verifyBackofficeMfa({
   token,userId:user.id,sessionId:user.sessionId,
   requiredLevel:'aal2',at
  });}catch{return deny(503,'G262_MFA_UNAVAILABLE');}
  if(!obj(mfa)||mfa.verifiedByProvider!==true||
   mfa.userId!==user.id||mfa.sessionId!==user.sessionId||
   mfa.assuranceLevel!=='aal2'||
   !Number.isSafeInteger(mfa.verifiedAtMs)||
   mfa.verifiedAtMs>at||at-mfa.verifiedAtMs>43_200_000||
   !Number.isSafeInteger(mfa.expiresAtMs)||mfa.expiresAtMs<=at||
   mfa.expiresAtMs>user.expiresAtMs)
   return deny(403,'G262_AAL2_REQUIRED');
  try{
   if(allowRequest({userId:user.id,operation:'admin.native.trace.read'})!==true)
    return deny(429,'G262_RATE_LIMITED');
  }catch{return deny(503,'G262_RATE_UNAVAILABLE');}
  let evidence;
  try{evidence=await loadNativeTrace({
   viewerId:user.id,serviceKind:kind,serviceId:sourceId
  });}catch{return deny(503,'G262_ORIGINAL_SQL_UNAVAILABLE');}
  if(evidence===null)return deny(404,'G262_ORIGINAL_NOT_FOUND');
  if(!validEvidence(evidence,user.id,kind,sourceId))
   return deny(503,'G262_UNVERIFIED_PROVENANCE');
  return {status:200,body:evidence};
 };
}
