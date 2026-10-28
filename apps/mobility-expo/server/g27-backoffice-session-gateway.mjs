/**
 * A04.1 — backoffice session admission policy, synthetic QA only.
 * This is a security gateway object, NOT a public listener or deployed Auth.
 * No client-supplied role, service_role bearer, unverified JWT payload, or
 * claimed MFA flag can authorize Admin/Owner access.
 */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCOPE={
 '/v1/staging/admin/session':'admin',
 '/v1/staging/owner/session':'owner'
};
const respond=(status,body)=>({status,body});
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
function bearer(headers){
 const value=headers?.authorization??headers?.Authorization;
 return typeof value==='string'&&value.length<8000?
  /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(value)?.[1]??null:null;
}
function verifiedIdentity(user,at){
 return plain(user)&&typeof user.id==='string'&&UUID.test(user.id)&&
  user.is_anonymous!==true&&
  (typeof user.email_confirmed_at==='string'||
   typeof user.phone_confirmed_at==='string')&&
  typeof user.sessionId==='string'&&user.sessionId.length>=8&&
  user.sessionId.length<=128&&
  Number.isSafeInteger(user.expiresAtMs)&&user.expiresAtMs>at;
}
function confirmedMfa(mfa,user,at){
 return plain(mfa)&&mfa.verifiedByProvider===true&&
  mfa.userId===user.id&&mfa.sessionId===user.sessionId&&
  mfa.assuranceLevel==='aal2'&&
  Number.isSafeInteger(mfa.verifiedAtMs)&&mfa.verifiedAtMs<=at&&
  at-mfa.verifiedAtMs<=12*60*60*1000&&
  Number.isSafeInteger(mfa.expiresAtMs)&&mfa.expiresAtMs>at&&
  mfa.expiresAtMs<=user.expiresAtMs;
}
/**
 * The three injected server adapters MUST consult independent trusted
 * identity/RBAC/MFA authorities, not claims taken from the HTTP request.
 * This object returns only the session's minimum, not Admin/Owner records.
 */
export function createQoreBackofficeSessionGateway({
 projectRef,verifyAccessToken,loadExclusiveBackofficeRole,
 verifyBackofficeMfa,allowRequest,now=Date.now
}){
 assertStagingRef(projectRef);
 if(![verifyAccessToken,loadExclusiveBackofficeRole,
  verifyBackofficeMfa,allowRequest,now].every(f=>typeof f==='function'))
  throw Error('Verified backoffice Auth/RBAC/MFA adapters required');
 return async({method,path,headers,body})=>{
  if(method!=='GET'||!Object.hasOwn(SCOPE,path))
   return respond(404,{error:'Not found'});
  if(body!==undefined&&body!==null)
   return respond(400,{error:'No session GET body'});
  const token=bearer(headers);
  if(!token)return respond(401,{error:'Verified bearer token required'});
  const at=now();
  if(!Number.isSafeInteger(at)||at<0)
   return respond(503,{error:'Server clock unavailable'});
  let user;
  try{user=await verifyAccessToken(token);}
  catch{return respond(401,{error:'Session expired, revoked or invalid'});}
  if(!verifiedIdentity(user,at))
   return respond(401,{error:'Verified active session required'});
  const requested=SCOPE[path];
  let role;
  try{role=await loadExclusiveBackofficeRole(user.id);}
  catch{return respond(503,{error:'Role authority unavailable'});}
  // An Owner may view finance, an Admin may review KYC, but neither
  // automatically inherits the other's authority. Mixed roles are denied.
  if(role!==requested)
   return respond(403,{error:'Exclusive backoffice role required'});
  try{
   if(allowRequest({userId:user.id,operation:'backoffice_session'})!==true)
    return respond(429,{error:'Backoffice admission rate limited'});
  }catch{return respond(503,{error:'Request limiter unavailable'});}
  let mfa;
  try{
   mfa=await verifyBackofficeMfa({
    token,userId:user.id,sessionId:user.sessionId,
    requiredLevel:'aal2',at
   });
  }catch{return respond(503,{error:'MFA authority unavailable'});}
  if(!confirmedMfa(mfa,user,at))
   return respond(403,{error:'Fresh, provider-confirmed MFA required'});
  return respond(200,{
   mode:'STAGING_QA_ONLY',
   userId:user.id,
   role:requested,
   assuranceLevel:'aal2',
   expiresAtMs:Math.min(user.expiresAtMs,mfa.expiresAtMs),
   dataAccessEnabled:false
  });
 };
}
