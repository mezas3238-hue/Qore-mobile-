/**
 * G252 — Admin only, private document compliance alerts.
 * This gateway owns no dispatch/driver assignment, KYC approval or proof upload.
 * Requires independently confirmed IdP JWT, revoked-session check and AAL2 MFA.
 * Backend uses trusted owner-scoped PG reader (no raw documents to browser).
 */
export const G252_DOCUMENT_ALERTS_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const TOKEN=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/;
const KINDS=new Set(['licencia','identidad_frente','identidad_dorso',
 'cedula_verde','habilitacion','seguro','inspeccion','rostro_selfie']);
const BANDS=new Set(['D30','D15','D07','D01','EXPIRED']);
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const error=(status,code)=>Object.freeze({status,body:Object.freeze({
 code,qaOnly:true,productionEnabled:false})});
export function createG252AdminDocumentAlertsGateway({
 environment,qaOnly,liveEnabled,
 verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
 verifyProviderAal2,allowRequest,readDocumentAlerts,now=Date.now
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
 [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
  verifyProviderAal2,allowRequest,readDocumentAlerts,now]
  .some(f=>typeof f!=='function'))
  throw Error('G252 requires isolated trusted Admin session and PG backend');
 return async({method,path,headers={},body}={})=>{
  if(method!=='GET'||path!=='/v1/staging/admin/compliance/document-alerts'
   ||body!==undefined&&body!==null)
   return error(404,'G252_ROUTE_NOT_FOUND');
  const raw=typeof headers.authorization==='string'
   &&headers.Authorization===undefined&&headers.cookie===undefined?
   TOKEN.exec(headers.authorization):null;
  if(!raw)return error(401,'G252_AUTH_REQUIRED');
  const at=now();
  if(!Number.isSafeInteger(at)||at<0)return error(503,'G252_CLOCK_UNAVAILABLE');
  let user;
  try{user=await verifyAccessToken(raw[1]);}
  catch{return error(401,'G252_AUTH_UNVERIFIED');}
  if(!exact(user,['id','sessionId','tokenIatMs','expiresAtMs',
      'is_anonymous'])||!UUID.test(user.id)||!UUID.test(user.sessionId)
    ||user.is_anonymous!==false||
    !Number.isSafeInteger(user.tokenIatMs)||user.tokenIatMs>at||
    !Number.isSafeInteger(user.expiresAtMs)||user.expiresAtMs<=at)
   return error(401,'G252_AUTH_UNVERIFIED');
  try{
   if(await verifySessionNotRevoked({userId:user.id,sessionId:user.sessionId,at})!==true)
    return error(401,'G252_SESSION_REVOKED');
   if(await resolveExclusiveRole(user.id)!=='admin')
    return error(403,'G252_ADMIN_ONLY');
   const mfa=await verifyProviderAal2({userId:user.id,
    sessionId:user.sessionId,token:raw[1],at});
   if(!exact(mfa,['userId','sessionId','assuranceLevel','providerVerified',
      'expiresAtMs'])||
    mfa.userId!==user.id||mfa.sessionId!==user.sessionId||
    mfa.assuranceLevel!=='aal2'||mfa.providerVerified!==true||
    !Number.isSafeInteger(mfa.expiresAtMs)||mfa.expiresAtMs<=at||
    mfa.expiresAtMs>user.expiresAtMs)
    return error(403,'G252_AAL2_REQUIRED');
   if(allowRequest({actorId:user.id,operation:'admin.document_alerts.read'})!==true)
    return error(429,'G252_RATE_LIMITED');
  }catch{return error(503,'G252_BACKOFFICE_UNAVAILABLE');}
  let records;
  try{records=await readDocumentAlerts({actorId:user.id,limit:50});}
  catch{return error(503,'G252_DOCUMENTS_UNAVAILABLE');}
  if(!exact(records,['items','hasMore','persistedAtMs'])||
   !Array.isArray(records.items)||records.items.length>50||
   typeof records.hasMore!=='boolean'||
   records.hasMore&&records.items.length!==50||
   !Number.isSafeInteger(records.persistedAtMs)||
   records.persistedAtMs>at||
   at-records.persistedAtMs>30000)
   return error(503,'G252_UNVERIFIED_RECORDS');
  const rows=[],seen=new Set();
  for(const item of records.items){
   if(!exact(item,['driverId','kind','band','validUntilMs'])||
    !UUID.test(item.driverId)||!KINDS.has(item.kind)||
    !BANDS.has(item.band)||!Number.isSafeInteger(item.validUntilMs)||
    item.validUntilMs<=0)
    return error(503,'G252_UNVERIFIED_RECORDS');
   const k=item.driverId+':'+item.kind+':'+item.band;
   if(seen.has(k))return error(503,'G252_DUPLICATE_RECORD');
   seen.add(k);rows.push(Object.freeze({...item}));
  }
  // G254: user can lose Admin role, AAL2 or session while SQL is reading.
  // Revalidate independently AFTER the sensitive read, before any response.
  const finalAt=now();
  if(!Number.isSafeInteger(finalAt)||finalAt<at||
   finalAt>=user.expiresAtMs)return error(401,'G252_SESSION_EXPIRED');
  let finalRole,finalMfa,finalSession;
  try{
   finalSession=await verifySessionNotRevoked({
    userId:user.id,sessionId:user.sessionId,at:finalAt
   });
   finalRole=await resolveExclusiveRole(user.id);
   finalMfa=await verifyProviderAal2({
    userId:user.id,sessionId:user.sessionId,token:raw[1],at:finalAt
   });
  }catch{return error(503,'G252_POSTREAD_AUTHORITY_UNAVAILABLE');}
  if(finalSession!==true)return error(401,'G252_SESSION_REVOKED_AFTER_READ');
  if(finalRole!=='admin')return error(403,'G252_ADMIN_REVOKED_AFTER_READ');
  if(!exact(finalMfa,['userId','sessionId','assuranceLevel',
    'providerVerified','expiresAtMs'])||
   finalMfa.userId!==user.id||finalMfa.sessionId!==user.sessionId||
   finalMfa.assuranceLevel!=='aal2'||finalMfa.providerVerified!==true||
   !Number.isSafeInteger(finalMfa.expiresAtMs)||
   finalMfa.expiresAtMs<=finalAt||finalMfa.expiresAtMs>user.expiresAtMs)
   return error(403,'G252_AAL2_REVOKED_AFTER_READ');
  return Object.freeze({status:200,body:Object.freeze({
   mode:'STAGING_DEMO_ONLY',scope:'admin.compliance.document_alerts.read',
   viewerId:user.id,items:Object.freeze(rows),hasMore:records.hasMore,
   observedAt:records.persistedAtMs,
   expiresAt:Math.min(finalAt+30000,finalMfa.expiresAtMs,user.expiresAtMs),
   serverPersisted:true,documentFilesExposed:false,
   automaticApproval:false,adminDispatchControl:false,
   qaOnly:true,productionEnabled:false
  })});
 };
}
