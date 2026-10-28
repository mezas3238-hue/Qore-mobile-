/**
 * G75 F1 Admin private QA-only read. External IdP MUST independently attest
 * JWT revocation and AAL2 MFA; no guessed Admin claims or frontend roles.
 * Runtime is deliberately unmounted until provider-backed MFA is configured.
 */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const PATH=/^\/v1\/staging\/admin\/rides\/([0-9a-f-]{36})\/f1-verification$/i;
const FIELDS=['mode','commercialEnabled','viewerId','tripId','routeId',
 'quoteId','passengerId','bookingRequestKey','service','currency',
 'amountGs','fareVersion','revision','status','assignmentPersisted',
 'driverId','observedAt','expiresAt','serverPersisted'];
const STAGES=new Set(['searching','assigned','arriving','in_progress','completed','cancelled']);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length
 &&keys.every(k=>Object.hasOwn(x,k));
const id=x=>typeof x==='string'&&ID.test(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const reject=(status,code)=>Object.freeze({status,body:Object.freeze({code,qaOnly:true,productionEnabled:false})});
function valid(dto,actor,trip,now){
 if(!exact(dto,FIELDS)||dto.mode!=='STAGING_DEMO_ONLY'||
  dto.commercialEnabled!==false||dto.viewerId!==actor||dto.tripId!==trip||
  !id(dto.routeId)||!id(dto.quoteId)||!id(dto.passengerId)||
  !id(dto.bookingRequestKey)||!['economico','confort','xl'].includes(dto.service)||
  dto.currency!=='PYG'||!integer(dto.amountGs)||dto.amountGs===0||
  dto.amountGs>100000000||
  typeof dto.fareVersion!=='string'||!/^[a-z0-9._-]{1,48}$/i.test(dto.fareVersion)||
  !integer(dto.revision)||dto.revision===0||!STAGES.has(dto.status)||
  typeof dto.assignmentPersisted!=='boolean'||
  !(dto.driverId===null||id(dto.driverId))||
  !integer(dto.observedAt)||dto.observedAt>now||now-dto.observedAt>30000||
  !integer(dto.expiresAt)||dto.expiresAt<=now||dto.expiresAt>now+60000||
  dto.serverPersisted!==true)return false;
 const active=['assigned','arriving','in_progress'].includes(dto.status);
 return !((active&&(!dto.assignmentPersisted||dto.driverId===null))
  ||(!active&&dto.driverId!==null)
  ||(dto.status==='searching'&&dto.assignmentPersisted));
}
export function createG75AdminF1AuditGateway({
 environment,localQaOnly=false,liveEnabled=false,projectRef,
 verifyAccessToken,verifySessionNotRevoked,loadExclusiveBackofficeRole,
 verifyBackofficeMfa,allowRequest,loadAdminRideReceipt,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,loadExclusiveBackofficeRole,
   verifyBackofficeMfa,allowRequest,loadAdminRideReceipt,now]
   .some(f=>typeof f!=='function'))throw Error('G75 requires trusted Admin authorities');
 assertStagingRef(projectRef);
 return async({method,path,headers={},body}={})=>{
  const m=method==='GET'&&typeof path==='string'?PATH.exec(path):null;
  if(!m||!id(m[1])||(body!==undefined&&body!==null))
   return reject(404,'G75_ROUTE_NOT_FOUND');
  if(typeof headers.authorization!=='string'||headers.Authorization!==undefined||
   headers.cookie!==undefined)return reject(401,'G75_AUTH_REQUIRED');
  const token=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(headers.authorization)?.[1];
  if(!token)return reject(401,'G75_AUTH_REQUIRED');
  const at=now();if(!integer(at))return reject(503,'G75_CLOCK_INVALID');
  let user;try{user=await verifyAccessToken(token);}
  catch{return reject(401,'G75_AUTH_INVALID');}
  if(!plain(user)||!id(user.id)||!id(user.sessionId)||user.is_anonymous!==false||
   !(typeof user.email_confirmed_at==='string'||
    typeof user.phone_confirmed_at==='string')||
   !integer(user.expiresAtMs)||user.expiresAtMs<=at)
   return reject(401,'G75_AUTH_INVALID');
  try{if(await verifySessionNotRevoked({userId:user.id,sessionId:user.sessionId,at})!==true)
   return reject(401,'G75_SESSION_REVOKED');}
  catch{return reject(503,'G75_REVOKE_UNAVAILABLE');}
  let role;try{role=await loadExclusiveBackofficeRole(user.id);}
  catch{return reject(503,'G75_ROLE_UNAVAILABLE');}
  if(role!=='admin')return reject(403,'G75_ADMIN_REQUIRED');
  let mfa;try{mfa=await verifyBackofficeMfa({
   token,userId:user.id,sessionId:user.sessionId,requiredLevel:'aal2',at
  });}catch{return reject(503,'G75_PROVIDER_MFA_UNAVAILABLE');}
  if(!plain(mfa)||mfa.verifiedByProvider!==true||
   mfa.userId!==user.id||mfa.sessionId!==user.sessionId||
   mfa.assuranceLevel!=='aal2'||!integer(mfa.verifiedAtMs)||
   mfa.verifiedAtMs>at||at-mfa.verifiedAtMs>43200000||
   !integer(mfa.expiresAtMs)||mfa.expiresAtMs<=at||
   mfa.expiresAtMs>user.expiresAtMs)
   return reject(403,'G75_PROVIDER_AAL2_REQUIRED');
  try{if(allowRequest({userId:user.id,operation:'admin.f1.ride.read'})!==true)
   return reject(429,'G75_RATE_LIMITED');}
  catch{return reject(503,'G75_RATE_UNAVAILABLE');}
  let dto;try{dto=await loadAdminRideReceipt({
   actorId:user.id,tripId:m[1].toLowerCase()
  });}catch{return reject(503,'G75_SQL_UNAVAILABLE');}
  if(dto===null)return reject(404,'G75_TRIP_NOT_FOUND');
  if(!valid(dto,user.id,m[1].toLowerCase(),now()))
   return reject(503,'G75_UNVERIFIED_PROOF');
  return Object.freeze({status:200,body:Object.freeze({...dto})});
 };
}
