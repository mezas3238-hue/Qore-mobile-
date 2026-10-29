/**
 * G66: server-authorized courier custody transition, with independent proof
 * registry verification BEFORE invoking the existing G5 atomic PostgreSQL RPC.
 * The phone never proves a package delivery by inventing a UUID.
 * QA-only private route, not connected to internet or production PSP.
 */
export const G66_CUSTODY_TRANSITION_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH=/^\/v1\/staging\/courier\/deliveries\/([0-9a-f-]{36})\/custody-transition$/i;
const TOKEN=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/;
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 Object.getPrototypeOf(o)===Object.prototype;
const exact=(o,keys)=>plain(o)&&Object.keys(o).length===keys.length&&
 keys.every(x=>Object.hasOwn(o,x));
const fail=(status,code)=>Object.freeze({status,body:Object.freeze({
 code,retrySafe:false,qaOnly:true,productionEnabled:false
})});
export function createG66CourierCustodyTransitionQa({
 environment,localQaOnly,liveEnabled,verifyAccessToken,
 verifySessionNotRevoked,resolveExclusiveRole,allowRequest,
 verifyIndependentProof,transitionDelivery,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,allowRequest,
   verifyIndependentProof,transitionDelivery,now].some(f=>typeof f!=='function'))
  throw Error('G66 trusted custody transition sources required');
 return async({method,path,headers,body}={})=>{
  const found=typeof path==='string'?PATH.exec(path):null;
  if(method!=='POST'||!found||!UUID.test(found[1]))
   return fail(404,'G66_ROUTE_NOT_FOUND');
  const pickup=exact(body,['event','eventKey'])&&body.event==='pickup';
  const deliver=exact(body,['event','eventKey','proofRef'])&&body.event==='deliver';
  const returnCustody=exact(body,['event','eventKey'])&&body.event==='return';
  if(!pickup&&!deliver&&!returnCustody||!UUID.test(body?.eventKey)||
    (deliver&&!UUID.test(body.proofRef)))
   return fail(400,'G66_CUSTODY_INPUT_INVALID');
  const auth=typeof headers?.authorization==='string'&&
   headers.Authorization===undefined&&headers.cookie===undefined?
   TOKEN.exec(headers.authorization):null;
  if(!auth)return fail(401,'G66_BEARER_REQUIRED');
  let user;
  try{user=await verifyAccessToken(auth[1]);}
  catch{return fail(401,'G66_AUTH_INVALID');}
  const at=now();
  if(!exact(user,['id','sessionId','tokenIatMs','expiresAtMs','is_anonymous'])||
   !UUID.test(user.id)||!UUID.test(user.sessionId)||
   !Number.isSafeInteger(at)||at<0||
   !Number.isSafeInteger(user.tokenIatMs)||user.tokenIatMs>at||
   !Number.isSafeInteger(user.expiresAtMs)||user.expiresAtMs<=at||
   user.is_anonymous!==false)return fail(401,'G66_AUTH_INVALID');
  try{
   if(await verifySessionNotRevoked({userId:user.id,sessionId:user.sessionId,at})!==true)
    return fail(401,'G66_SESSION_REVOKED');
  }catch{return fail(503,'G66_SESSION_UNAVAILABLE');}
  try{
   if(await resolveExclusiveRole(user.id)!=='driver')
    return fail(403,'G66_ROLE_DENIED');
  }catch{return fail(503,'G66_ROLE_UNAVAILABLE');}
  try{
   if(allowRequest({actorId:user.id,operation:'courier_'+body.event})!==true)
    return fail(429,'G66_RATE_LIMIT');
  }catch{return fail(503,'G66_LIMIT_UNAVAILABLE');}
  // This check is ONLY for 'deliver'. A UUID in the request is not evidence:
  // registry must match the verified driver, service and immutable proof.
  if(deliver){
   try{
    if(await verifyIndependentProof({
     actorId:user.id,deliveryId:found[1].toLowerCase(),
     proofRef:body.proofRef,action:'deliver'
    })!==true)return fail(403,'G66_PROOF_UNVERIFIED');
   }catch{return fail(503,'G66_PROOF_REGISTRY_UNAVAILABLE');}
  }
  let receipt;
  try{
   receipt=await transitionDelivery(Object.freeze({
    actorId:user.id,deliveryId:found[1].toLowerCase(),
    event:body.event,eventKey:body.eventKey,
    ...(deliver?{proofRef:body.proofRef}:{})
   }));
  }catch{return fail(503,'G66_OUTCOME_UNKNOWN');}
  if(!exact(receipt,['ok','liveEnabled','eventId'])||
   receipt.ok!==true||receipt.liveEnabled!==false||
   !UUID.test(receipt.eventId))
   return fail(503,'G66_UNTRUSTED_CUSTODY_RECEIPT');
  // G185: the SQL transition may already have committed. Never acknowledge
  // pickup, delivery or return if the Driver token expired or was revoked
  // during that commit. The outcome is UNKNOWN, not a safe second POST.
  // The Driver must recover the original delivery with the scoped custody GET.
  const finished=now();
  if(!Number.isSafeInteger(finished)||finished<at||
   finished>=user.expiresAtMs)return fail(503,'G185_CUSTODY_OUTCOME_UNKNOWN');
  try{
   if(await verifySessionNotRevoked({
    userId:user.id,sessionId:user.sessionId,at:finished})!==true)
    return fail(503,'G185_CUSTODY_OUTCOME_UNKNOWN');
  }catch{return fail(503,'G185_CUSTODY_OUTCOME_UNKNOWN');}
  return Object.freeze({status:200,body:Object.freeze({
   mode:'STAGING_DEMO_ONLY',deliveryId:found[1].toLowerCase(),
   event:body.event,eventId:receipt.eventId,
   serverPersisted:true,qaOnly:true,productionEnabled:false,
   liveDeliveriesEnabled:false,retrySafe:false
  })});
 };
}
