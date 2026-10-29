/**
 * G177: Driver AUTO progression cannot bypass independently verified G42
 * revocable identity. G38/G71 remain the ONLY legal acceptance gates; this
 * endpoint advances an already-assigned original G3 trip, never assigns one.
 * No GPS, PSP, LIVE or forged legal attestation is implied by a QA receipt.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const PATH=/^\/v1\/staging\/trips\/([0-9a-f-]{36})\/transition$/i;
const EVENTS=new Set(['arrive','pickup','complete']);
const BEARER=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/;
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const deny=(status,code)=>({status,body:{
 code,qaOnly:true,productionEnabled:false,retrySafe:false
}});
export function createG177VerifiedAutoDriverStepGateway({
 environment,qaOnly,liveEnabled,legacyGateway,verifyAccessToken,
 verifySessionNotRevoked,resolveExclusiveRole,allowRequest,commitStep,now=Date.now
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
 [legacyGateway,verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
  allowRequest,commitStep,now].some(f=>typeof f!=='function'))
  throw Error('G177 requires original verified Driver mutation authorities');
 return async input=>{
  const {method,path,headers={},body}=input??{};
  const found=typeof path==='string'?PATH.exec(path):null;
  // G210: an unknown or malformed Driver step must NEVER fall through to
  // the older G4 transition handler, which lacks G42 session revocation.
  // Preserve only the explicit G184 legacy Passenger cancel denial path.
  if(method!=='POST'||!found||body?.event==='cancel')
   return legacyGateway(input);
  const tripId=found[1].toLowerCase();
  if(!UUID.test(tripId)||!exact(body,['event','eventKey'])||
     !EVENTS.has(body.event)||!UUID.test(body.eventKey))
   return deny(400,'G177_DRIVER_STEP_INVALID');
  const match=typeof headers.authorization==='string'&&
   headers.Authorization===undefined&&headers.cookie===undefined?
   BEARER.exec(headers.authorization):null;
  if(!match)return deny(401,'G177_DRIVER_SESSION_REQUIRED');
  let actor;
  try{actor=await verifyAccessToken(match[1]);}
  catch{return deny(401,'G177_PROVIDER_IDENTITY_REQUIRED');}
  const at=now();
  if(!exact(actor,['id','sessionId','tokenIatMs','expiresAtMs','is_anonymous'])||
   !UUID.test(actor.id)||!UUID.test(actor.sessionId)||
   !Number.isSafeInteger(at)||at<0||
   !Number.isSafeInteger(actor.tokenIatMs)||actor.tokenIatMs>at||
   !Number.isSafeInteger(actor.expiresAtMs)||actor.expiresAtMs<=at||
   actor.is_anonymous!==false)return deny(401,'G177_PROVIDER_IDENTITY_REQUIRED');
  try{
   if(await verifySessionNotRevoked({
    userId:actor.id,sessionId:actor.sessionId,at})!==true)
    return deny(401,'G177_DRIVER_REVOKED');
  }catch{return deny(503,'G177_REVOCATION_UNAVAILABLE');}
  try{
   if(await resolveExclusiveRole(actor.id)!=='driver')
    return deny(403,'G177_DRIVER_ROLE_REQUIRED');
  }catch{return deny(503,'G177_ROLE_UNAVAILABLE');}
  try{
   if(allowRequest({actorId:actor.id,operation:'auto_driver_'+body.event})!==true)
    return deny(429,'G177_RATE_LIMITED');
  }catch{return deny(503,'G177_RATE_UNAVAILABLE');}
  let eventId;
  try{
   eventId=await commitStep({actorId:actor.id,sessionId:actor.sessionId,
    tokenIatMs:actor.tokenIatMs,tripId,event:body.event,
    eventKey:body.eventKey});
  }catch{return deny(409,'G177_ORIGINAL_TRIP_SQL_DENIED');}
  if(typeof eventId!=='string'||!UUID.test(eventId))
   return deny(503,'G177_UNVERIFIED_EVENT');
  const finished=now();
  if(!Number.isSafeInteger(finished)||finished<at||finished>=actor.expiresAtMs)
   return deny(401,'G177_DRIVER_EXPIRED');
  try{
   if(await verifySessionNotRevoked({
    userId:actor.id,sessionId:actor.sessionId,at:finished})!==true)
    return deny(401,'G177_DRIVER_REVOKED');
  }catch{return deny(503,'G177_REVOCATION_UNAVAILABLE');}
  return {status:200,body:{mode:'STAGING_DEMO_ONLY',
   commercialRidesEnabled:false,tripId,event:body.event,eventId,
   serverPersisted:true}};
 };
}
