/**
 * G142: original MOTO_RIDE booked by Client -> SQL G100 -> Admin D trace.
 * Server-only identity + exclusive Admin role + provider AAL2. No production.
 */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
const PATH=/^\/v1\/staging\/admin\/services\/MOTO_RIDE\/([0-9a-f-]{36})\/trace$/i;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const deny=(status,code)=>({status,body:{code,qaOnly:true,productionEnabled:false}});
export function createG142AdminMotoTraceGateway({
 projectRef,environment,qaOnly,liveEnabled,
 verifyAccessToken,verifySessionNotRevoked,loadExclusiveBackofficeRole,
 verifyBackofficeMfa,allowRequest,loadMotoTraceReceipt,now=Date.now
}={}){
 assertStagingRef(projectRef);
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,loadExclusiveBackofficeRole,
   verifyBackofficeMfa,allowRequest,loadMotoTraceReceipt,now]
  .some(f=>typeof f!=='function'))throw Error('G142 requires verified Admin AAL2');
 return async({method,path,headers={},body}={})=>{
  const hit=method==='GET'&&typeof path==='string'?PATH.exec(path):null;
  if(!hit||!UUID.test(hit[1])||body!=null)
   return deny(404,'G142_TRACE_NOT_FOUND');
  if(typeof headers.authorization!=='string'||headers.Authorization!==undefined||
   headers.cookie!==undefined)return deny(401,'G142_AUTH_REQUIRED');
  const token=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(headers.authorization)?.[1];
  if(!token)return deny(401,'G142_AUTH_REQUIRED');
  const at=now();if(!Number.isSafeInteger(at))return deny(503,'G142_CLOCK_INVALID');
  let user;
  try{user=await verifyAccessToken(token);}
  catch{return deny(401,'G142_AUTH_INVALID');}
  if(!obj(user)||!UUID.test(user.id??'')||!UUID.test(user.sessionId??'')||
   user.is_anonymous!==false||!Number.isSafeInteger(user.expiresAtMs)||
   user.expiresAtMs<=at)return deny(401,'G142_AUTH_INVALID');
  try{
   if(await verifySessionNotRevoked({userId:user.id,sessionId:user.sessionId,at})!==true)
    return deny(401,'G142_SESSION_REVOKED');
  }catch{return deny(503,'G142_REVOCATION_UNAVAILABLE');}
  let role;
  try{role=await loadExclusiveBackofficeRole(user.id);}
  catch{return deny(503,'G142_ROLE_UNAVAILABLE');}
  if(role!=='admin')return deny(403,'G142_ADMIN_REQUIRED');
  let mfa;
  try{mfa=await verifyBackofficeMfa({
   token,userId:user.id,sessionId:user.sessionId,requiredLevel:'aal2',at
  });}catch{return deny(503,'G142_PROVIDER_MFA_UNAVAILABLE');}
  if(!obj(mfa)||mfa.verifiedByProvider!==true||mfa.assuranceLevel!=='aal2'||
   mfa.userId!==user.id||mfa.sessionId!==user.sessionId||
   !Number.isSafeInteger(mfa.verifiedAtMs)||mfa.verifiedAtMs>at||
   at-mfa.verifiedAtMs>43200000||!Number.isSafeInteger(mfa.expiresAtMs)||
   mfa.expiresAtMs<=at||mfa.expiresAtMs>user.expiresAtMs)
   return deny(403,'G142_PROVIDER_AAL2_REQUIRED');
  try{
   if(allowRequest({userId:user.id,operation:'admin.moto.trace.read'})!==true)
    return deny(429,'G142_RATE_LIMITED');
  }catch{return deny(503,'G142_LIMITER_UNAVAILABLE');}
  const tripId=hit[1].toLowerCase();
  let d;
  try{d=await loadMotoTraceReceipt({actorId:user.id,tripId});}
  catch{return deny(503,'G142_SQL_UNAVAILABLE');}
  if(d===null)return deny(404,'G142_MOTO_TRIP_NOT_FOUND');
  const expected=['mode','viewerId','serviceId','serviceKind',
   'bookingRequestKey','quoteId','status','revision','observedAt',
   'expiresAt','serverPersisted','productionEnabled','assignment','events','ledger'];
  if(!obj(d)||Object.keys(d).length!==expected.length||
   expected.some(k=>!Object.hasOwn(d,k))||
   d.mode!=='STAGING_DEMO_ONLY'||d.viewerId!==user.id||
   d.serviceId!==tripId||d.serviceKind!=='MOTO_RIDE'||
   !UUID.test(d.bookingRequestKey??'')||!UUID.test(d.quoteId??'')||
   !['searching','cancelled'].includes(d.status)||d.revision!==
    (d.status==='searching'?1:2)||d.serverPersisted!==true||
   d.productionEnabled!==false||!Number.isSafeInteger(d.observedAt)||
   d.observedAt>now()||now()-d.observedAt>30000||
   !Number.isSafeInteger(d.expiresAt)||d.expiresAt<=now()||
   d.expiresAt>now()+60000||
   !obj(d.assignment)||d.assignment.state!=='NOT_ASSIGNABLE'||
   d.assignment.legalGate!=='G38_BLOCKED'||
   !Array.isArray(d.events)||d.events.length!==d.revision||
   d.events.some((e,i)=>!obj(e)||!UUID.test(e.eventId??'')||
    e.serviceId!==tripId||e.sequence!==i+1||
    e.status!==(i===0?'searching':'cancelled')||
    !Number.isSafeInteger(e.at)||e.at>d.observedAt||
    i>0&&e.at<d.events[i-1].at)||
   !obj(d.ledger)||d.ledger.serviceId!==tripId||
   d.ledger.currency!=='PYG'||d.ledger.reconciliationStatus!=='PENDING'||
   !['grossGs','platformCommissionGs','customerSubsidyGs','driverPayoutGs']
    .every(k=>Number.isSafeInteger(d.ledger[k])&&d.ledger[k]>=0)||
   d.ledger.driverPayoutGs+d.ledger.platformCommissionGs!==d.ledger.grossGs)
   return deny(503,'G142_TRACE_PROVENANCE_INVALID');
  return {status:200,body:d};
 };
}
