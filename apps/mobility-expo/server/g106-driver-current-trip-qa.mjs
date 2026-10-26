/**
 * G106 authenticated Driver-only recovery of ONE active assigned AUTO trip.
 * Server derives actor from verified Auth; no client supplied actor or tripId.
 * No GPS, payment, Passenger PII, commercial authority or server default.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/;
const PATH='/v1/staging/driver/trips/current';
const ACTIVE=new Set(['accepted','arriving','in_progress']);
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)
 &&Object.getPrototypeOf(v)===Object.prototype
 &&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const deny=(status,code)=>({status,body:{code,qaOnly:true,productionEnabled:false}});
export const G106_DRIVER_CURRENT_TRIP_LIVE_ENABLED=false;
export function createG106PrivateDriverCurrentTripQa({
 environment,localQaOnly,liveEnabled,verifyAccessToken,
 verifySessionNotRevoked,resolveExclusiveRole,loadCurrentAssignedTrip,
 allowRequest,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||
 liveEnabled!==false||[verifyAccessToken,verifySessionNotRevoked,
 resolveExclusiveRole,loadCurrentAssignedTrip,allowRequest,now]
 .some(f=>typeof f!=='function'))
  throw Error('G106 requires isolated verified Driver and PostgreSQL sources');
 return async({method,path,headers,body}={})=>{
  if(method!=='GET'||path!==PATH||(body!==undefined&&body!==null))
   return deny(404,'G106_ROUTE_NOT_FOUND');
  if(!headers||typeof headers.authorization!=='string'||
     headers.Authorization!==undefined||headers.cookie!==undefined)
   return deny(401,'G106_BEARER_REQUIRED');
  const token=TOKEN.exec(headers.authorization);
  if(!token)return deny(401,'G106_BEARER_REQUIRED');
  let actor;try{actor=await verifyAccessToken(token[1]);}
  catch{return deny(401,'G106_AUTH_INVALID');}
  const at=now();
  if(!exact(actor,['id','sessionId','tokenIatMs','expiresAtMs','is_anonymous'])||
  !UUID.test(actor.id)||!UUID.test(actor.sessionId)||
  !Number.isSafeInteger(at)||at<0||
  !Number.isSafeInteger(actor.tokenIatMs)||actor.tokenIatMs>at||
  !Number.isSafeInteger(actor.expiresAtMs)||actor.expiresAtMs<=at||
  actor.is_anonymous!==false)return deny(401,'G106_AUTH_INVALID');
  try{if(await verifySessionNotRevoked({
   userId:actor.id,sessionId:actor.sessionId,at})!==true)
    return deny(401,'G106_SESSION_REVOKED');}
  catch{return deny(503,'G106_AUTH_UNAVAILABLE');}
  try{if(await resolveExclusiveRole(actor.id)!=='driver')
    return deny(403,'G106_DRIVER_REQUIRED');}
  catch{return deny(503,'G106_ROLE_UNAVAILABLE');}
  try{if(allowRequest({actorId:actor.id,operation:'driver_current_trip'})!==true)
    return deny(429,'G106_RATE_LIMITED');}
  catch{return deny(503,'G106_LIMITER_UNAVAILABLE');}
  let row;try{row=await loadCurrentAssignedTrip({actorId:actor.id});}
  catch{return deny(503,'G106_SQL_UNAVAILABLE');}
  if(row!==null&&(!exact(row,['tripId','driverId','status','revision'])||
    !UUID.test(row.tripId)||row.driverId!==actor.id||
    !ACTIVE.has(row.status)||!Number.isSafeInteger(row.revision)||
    row.revision<2))
   return deny(503,'G106_UNTRUSTED_ASSIGNMENT');
  return {status:200,body:{
   mode:'STAGING_DEMO_ONLY',
   activeTrip:row===null?null:{
    tripId:row.tripId,status:row.status,revision:row.revision},
   liveTripsEnabled:false,qaOnly:true,productionEnabled:false
  }};
 };
}
