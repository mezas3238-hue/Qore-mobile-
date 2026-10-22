/** QORE STAGING persistence boundary. Never falls back to in-memory dispatch. */
export const PERSISTENT_DISPATCH_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId=x=>typeof x==='string'&&UUID.test(x);
const validTag=x=>typeof x==='string'&&/^[A-Z_]{3,40}$/.test(x);
const fail=reason=>({ok:false,reason,liveEnabled:false});
/** Repository methods must use authenticated, server-only SQL transactions.
 * Adapter is NOT a database implementation; it enforces safe invocation shape.
 */
export function createStagingDispatchPersistence(repository){
 const methods=['request','offer','accept','transition','snapshot'];
 if(!repository||methods.some(m=>typeof repository[m]!=='function'))throw Error('Incomplete dispatch repository');
 async function call(method,params){
  if(!params||typeof params!=='object'||Array.isArray(params)||params.mode!=='SYNTHETIC_STAGING'||params.liveEnabled!==false||!validId(params.actorId))return fail('Unauthenticated or non-staging request');
  if(method==='request'&&(!validId(params.requestKey)||!['economico','confort','xl'].includes(params.service)||!validTag(params.originTag)||!validTag(params.destinationTag)||params.originTag===params.destinationTag))return fail('Invalid trip request');
  if(method!=='request'&&method!=='accept'&&!validId(params.tripId))return fail('Invalid trip identity');
  if(method==='accept'&&(!validId(params.offerId)||!validId(params.decisionKey)))return fail('Invalid idempotency key or offer');
  if(method==='accept'&&params.driverId!==undefined&&params.driverId!==params.actorId)return fail('Driver identity mismatch');
  if(method==='request'&&params.passengerId!==undefined&&params.passengerId!==params.actorId)return fail('Passenger identity mismatch');
  if(method==='offer'&&params.driverId!==params.actorId)return fail('Offer driver identity mismatch');
  if(method==='transition'&&(!validId(params.eventKey)||typeof params.event!=='string'||!['arrive','pickup','complete','cancel'].includes(params.event)))return fail('Invalid transition event');
  if(method==='offer'&&(!validId(params.driverId)||!validId(params.vehicleId)||!validId(params.requestKey)||!Number.isSafeInteger(params.ttlSeconds)||params.ttlSeconds<5||params.ttlSeconds>30))return fail('Invalid private offer input');
  try{
   // Identity aliases supplied by a client are validation hints only. The
   // repository receives the server-resolved actor and must authorize against
   // persisted rows; it never receives a claimed passenger/driver identity.
   const safe={...params};
   delete safe.passengerId;
   if(method!=='offer')delete safe.driverId;
   const result=await repository[method](Object.freeze(safe));
   if(!result||result.ok!==true||result.liveEnabled!==false)return fail('Unverified persistence response');
   return result;
  }catch{return fail('Persistence unavailable');}
 }
 return Object.freeze(Object.fromEntries(methods.map(m=>[m,params=>call(m,params)])));
}

/** Server-only boundary: caller-supplied actorId is never authoritative.
 * resolveActor must validate the session on the server and return its user UUID.
 * No request is dispatched if identity cannot be resolved.
 */
export function createAuthenticatedStagingDispatchPersistence(repository,resolveActor){
 if(typeof resolveActor!=='function')throw Error('Missing server identity resolver');
 const dispatch=createStagingDispatchPersistence(repository);
 return Object.freeze(Object.fromEntries(['request','offer','accept','transition','snapshot'].map(method=>[
  method,async (params,session)=>{
   try{
    const actorId=await resolveActor(session);
    if(!validId(actorId))return fail('Unverified server identity');
    if(!params||typeof params!=='object'||Array.isArray(params))return fail('Invalid dispatch input');
    const {actorId:ignored,...safeParams}=params;
    return dispatch[method]({...safeParams,actorId});
   }catch{return fail('Identity verification unavailable');}
  }
 ])));
}
