/**
 * G65/A54 Driver-only private AUTO trip state, QA-only.
 * Resolves actor exclusively from verified JWT + independently confirmed
 * provider session and SQL role. Neither a query string nor a phone role
 * can confer assignment; status comes from owner-filtered storage.
 */
export const G65_DRIVER_TRIP_STATUS_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH=/^\/v1\/staging\/driver\/trips\/([0-9a-f-]{36})\/status$/i;
const BEARER=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/;
const STATE=new Set(['accepted','arriving','in_progress','completed','cancelled']);
const NEXT=Object.freeze({accepted:'arrive',arriving:'pickup',
 in_progress:'complete',completed:null,cancelled:null});
const own=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 Object.getPrototypeOf(o)===Object.prototype;
const exact=(o,keys)=>own(o)&&Object.keys(o).length===keys.length&&
 keys.every(k=>Object.hasOwn(o,k));
const denied=(status,code)=>Object.freeze({status,body:Object.freeze({
 code,qaOnly:true,productionEnabled:false
})});
export function createG65PrivateDriverTripStatusQa({
 environment,localQaOnly,liveEnabled,
 verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
 loadAssignedTrip,allowRequest,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||
  liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
   loadAssignedTrip,allowRequest,now].some(f=>typeof f!=='function'))
  throw Error('G65 only isolated authenticated STAGING QA authorities');
 return async({method,path,headers,body}={})=>{
  const match=typeof path==='string'?PATH.exec(path):null;
  if(method!=='GET'||!match||!UUID.test(match[1])||
   (body!==undefined&&body!==null))
   return denied(404,'G65_ROUTE_NOT_FOUND');
  if(!headers||typeof headers.authorization!=='string'||
   headers.Authorization!==undefined||headers.cookie!==undefined)
   return denied(401,'G65_BEARER_REQUIRED');
  const auth=BEARER.exec(headers.authorization);
  if(!auth)return denied(401,'G65_BEARER_REQUIRED');
  let actor;
  try{actor=await verifyAccessToken(auth[1]);}
  catch{return denied(401,'G65_AUTH_INVALID');}
  const at=now();
  if(!exact(actor,['id','sessionId','tokenIatMs','expiresAtMs',
   'is_anonymous'])||
   !UUID.test(actor.id)||!UUID.test(actor.sessionId)||
   !Number.isSafeInteger(at)||at<0||
   !Number.isSafeInteger(actor.tokenIatMs)||actor.tokenIatMs>at||
   !Number.isSafeInteger(actor.expiresAtMs)||actor.expiresAtMs<=at||
   actor.is_anonymous!==false)
   return denied(401,'G65_AUTH_INVALID');
  try{
   if(await verifySessionNotRevoked({
    userId:actor.id,sessionId:actor.sessionId,at
   })!==true)return denied(401,'G65_SESSION_REVOKED');
  }catch{return denied(503,'G65_SESSION_UNAVAILABLE');}
  try{
   if(await resolveExclusiveRole(actor.id)!=='driver')
    return denied(403,'G65_DRIVER_REQUIRED');
  }catch{return denied(503,'G65_ROLE_UNAVAILABLE');}
  try{
   if(allowRequest({actorId:actor.id,operation:'driver_trip_status'})!==true)
    return denied(429,'G65_RATE_LIMITED');
  }catch{return denied(503,'G65_RATE_UNAVAILABLE');}
  let row;
  try{row=await loadAssignedTrip({
   actorId:actor.id,tripId:match[1].toLowerCase()
  });}catch{return denied(503,'G65_SQL_UNAVAILABLE');}
  if(!exact(row,['tripId','driverId','vehicleId','status','revision',
    'passengerId','service'])||
   row.tripId!==match[1].toLowerCase()||row.driverId!==actor.id||
   !UUID.test(row.vehicleId)||!UUID.test(row.passengerId)||
   row.passengerId===actor.id||!STATE.has(row.status)||
   !['economico','confort','xl'].includes(row.service)||
   !Number.isSafeInteger(row.revision)||row.revision<2)
   return denied(404,'G65_NO_ASSIGNED_TRIP');
  // No passenger identity, location, destination, phone, payments or
  // document references travel to the Driver UI. Requery is authoritative.
  return Object.freeze({status:200,body:Object.freeze({
   mode:'STAGING_DEMO_ONLY',tripId:row.tripId,
   state:row.status,revision:row.revision,
   nextEvent:NEXT[row.status],assignmentPersisted:true,
   qaOnly:true,productionEnabled:false,liveTripsEnabled:false,
   gpsVerified:false,passengerContactVisible:false
  })});
 };
}
