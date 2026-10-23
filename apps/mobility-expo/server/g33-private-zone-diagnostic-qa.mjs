/**
 * G33.1 — internal-only diagnostics for quarantined Driver telemetry.
 * No HTTP listener, never part of Admin B / passenger-facing APIs.
 * JWT, role and AAL2 MFA MUST come from separate server-trusted providers.
 */
import {createQoreBackofficeRoleAuthority} from './g27-backoffice-role-authority.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SERVICES=new Set(['AUTO_RIDE','AUTO_DELIVERY','MOTO_DELIVERY']);
const fields=['zoneId','serviceKind','source','observedAtMs',
 'quarantinedRecentSignals','consentingIdleCandidates',
 'availabilityConfirmed','dispatchAuthorized','publishedToG31',
 'productionEnabled'];
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const reply=(status,code,data)=>Object.freeze({
 status,body:data??Object.freeze({code})
});
export function createQoreG33InternalDiagnosticQa({
 environment,liveEnabled,localQaOnly,rpc,verifyAccessToken,
 verifyBackofficeMfa,allowRequest,now=Date.now
}={}){
 if(environment!=='isolated_staging'||liveEnabled!==false||
  localQaOnly!==true)throw Error('G33 internal diagnostics allow QA only');
 if([rpc,verifyAccessToken,verifyBackofficeMfa,allowRequest,now]
   .some(fn=>typeof fn!=='function'))
  throw Error('Trusted G33 JWT, SQL role, MFA and limiter adapters required');
 const roleAuthority=createQoreBackofficeRoleAuthority({rpc});
 return async function inspect({
  bearer,zoneId,serviceKind
 }={}){
  if(typeof bearer!=='string'||bearer.length<20||bearer.length>7900||
   !/^[A-Za-z0-9._~-]+$/.test(bearer))
   return reply(401,'JWT_REQUIRED');
  if(typeof zoneId!=='string'||!UUID.test(zoneId)||
    !SERVICES.has(serviceKind))
   return reply(400,'INVALID_ZONE_SERVICE');
  const at=now();
  if(!Number.isSafeInteger(at)||at<0)
   return reply(503,'CLOCK_UNAVAILABLE');
  let identity;
  try{identity=await verifyAccessToken(bearer);}
  catch{return reply(401,'SESSION_NOT_VERIFIED');}
  if(!plain(identity)||typeof identity.id!=='string'||!UUID.test(identity.id)||
    identity.is_anonymous===true||
    !(typeof identity.email_confirmed_at==='string'||
      typeof identity.phone_confirmed_at==='string')||
    typeof identity.sessionId!=='string'||identity.sessionId.length<8||
    !Number.isSafeInteger(identity.expiresAtMs)||identity.expiresAtMs<=at)
   return reply(401,'SESSION_NOT_VERIFIED');
  let role;
  try{role=await roleAuthority.loadExclusiveBackofficeRole(identity.id);}
  catch{return reply(503,'ROLE_UNAVAILABLE');}
  if(role!=='admin')return reply(403,'EXCLUSIVE_ADMIN_REQUIRED');
  let allowed;
  try{allowed=await roleAuthority.authorizePermission({
   userId:identity.id,scope:'admin.zones.read'
  });}catch{return reply(503,'SCOPE_UNAVAILABLE');}
  if(allowed!==true)return reply(403,'ZONE_SCOPE_DENIED');
  try{
   if(allowRequest({userId:identity.id,operation:'qa.zone.diagnostic'})!==true)
    return reply(429,'ZONE_DIAGNOSTIC_LIMITED');
  }catch{return reply(503,'RATE_LIMIT_UNAVAILABLE');}
  let mfa;
  try{mfa=await verifyBackofficeMfa({
   token:bearer,userId:identity.id,sessionId:identity.sessionId,
   requiredLevel:'aal2',at
  });}catch{return reply(503,'MFA_UNAVAILABLE');}
  if(!plain(mfa)||mfa.verifiedByProvider!==true||
   mfa.userId!==identity.id||mfa.sessionId!==identity.sessionId||
   mfa.assuranceLevel!=='aal2'||
   !Number.isSafeInteger(mfa.verifiedAtMs)||mfa.verifiedAtMs>at||
   at-mfa.verifiedAtMs>43200000||
   !Number.isSafeInteger(mfa.expiresAtMs)||mfa.expiresAtMs<=at||
   mfa.expiresAtMs>identity.expiresAtMs)
   return reply(403,'FRESH_AAL2_REQUIRED');
  let doc;
  try{
   const output=await rpc('mobility_stage_g33_quarantined_zone_diagnostic',{
    _admin:identity.id,_zone:zoneId,_service:serviceKind,_anchor_ms:at
   });
   if(!plain(output)||output.error)throw Error('untrusted sql');
   doc=output.data;
  }catch{return reply(503,'QA_SOURCE_UNAVAILABLE');}
  if(!plain(doc)||Object.keys(doc).length!==fields.length||
   !fields.every(f=>Object.hasOwn(doc,f))||
   doc.zoneId!==zoneId||doc.serviceKind!==serviceKind||
   doc.source!=='QA_G32_QUARANTINE_ONLY'||
   doc.observedAtMs!==at||
   !Number.isSafeInteger(doc.quarantinedRecentSignals)||
   !Number.isSafeInteger(doc.consentingIdleCandidates)||
   doc.quarantinedRecentSignals<0||
   doc.quarantinedRecentSignals>100000||
   doc.consentingIdleCandidates<0||
   doc.consentingIdleCandidates>doc.quarantinedRecentSignals||
   doc.availabilityConfirmed!==false||
   doc.dispatchAuthorized!==false||
   doc.publishedToG31!==false||
   doc.productionEnabled!==false)
   return reply(503,'UNSAFE_QA_DIAGNOSTIC');
  return reply(200,'',Object.freeze({...doc}));
 };
}
