/**
 * G173: original merchant fulfillment and priced delivery linking require a
 * separately attested staff session and a source-owned G42 transaction fence.
 * Isolated QA only. Buyer paths remain delegated to the existing G6 handler.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const URI=/^\/v1\/staging\/merchant\/orders\/([0-9a-f-]{36})\/(transition|attach-delivery)$/i;
const TOKEN=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/;
const ACTIONS=new Set(['confirm','start_preparing','ready','hand_to_courier']);
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const deny=(status,code)=>({status,body:{code,qaOnly:true,productionEnabled:false}});
export const G173_MERCHANT_MUTATION_LIVE_ENABLED=false;
export function createG173MerchantVerifiedMutationGateway({
 environment,qaOnly,liveEnabled,verifyAccessToken,verifySessionNotRevoked,
 allowRequest,runMutation,legacyGateway,now=Date.now
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
 [verifyAccessToken,verifySessionNotRevoked,allowRequest,runMutation,legacyGateway,now]
  .some(f=>typeof f!=='function'))
  throw Error('G173 requires verified merchant and transaction authority');
 return async input=>{
  const {method,path,headers={},body}=input??{};
  const m=typeof path==='string'?URI.exec(path):null;
  if(!m){
   if(typeof path==='string'&&/^\/v1\/staging\/merchant\/orders\//i.test(path))
    return deny(404,'G173_ROUTE_DENIED');
   return legacyGateway(input);
  }
  const [_,orderId,kindRaw]=m;
  const kind=kindRaw.toLowerCase();
  if(method!=='POST'||!UUID.test(orderId))return deny(404,'G173_ROUTE_DENIED');
  const transition=kind==='transition';
  const fields=transition?['event','eventKey']:['deliveryId','requestKey'];
  if(!exact(body,fields)||
   (transition?(!ACTIONS.has(body.event)||!UUID.test(body.eventKey)):
    (!UUID.test(body.deliveryId)||!UUID.test(body.requestKey))))
   return deny(400,'G173_INVALID_MUTATION');
  if(typeof headers.authorization!=='string'||headers.Authorization!==undefined||
   headers.cookie!==undefined)return deny(401,'G173_SESSION_REQUIRED');
  const bearer=TOKEN.exec(headers.authorization)?.[1];
  if(!bearer)return deny(401,'G173_SESSION_REQUIRED');
  let actor;
  try{actor=await verifyAccessToken(bearer);}catch{return deny(401,'G173_IDP_UNVERIFIED');}
  const at=now();
  if(!exact(actor,['id','sessionId','tokenIatMs','expiresAtMs','is_anonymous'])||
   !UUID.test(actor.id)||!UUID.test(actor.sessionId)||
   !Number.isSafeInteger(actor.tokenIatMs)||actor.tokenIatMs<0||actor.tokenIatMs>at||
   !Number.isSafeInteger(actor.expiresAtMs)||actor.expiresAtMs<=at||
   actor.is_anonymous!==false)return deny(401,'G173_IDP_UNVERIFIED');
  try{if(await verifySessionNotRevoked({userId:actor.id,sessionId:actor.sessionId,at})!==true)
    return deny(401,'G173_REVOKED');}
  catch{return deny(503,'G173_IDP_UNAVAILABLE');}
  try{if(allowRequest({userId:actor.id,operation:'merchant.verified.mutation'})!==true)
    return deny(429,'G173_RATE_LIMIT');}
  catch{return deny(503,'G173_RATE_UNAVAILABLE');}
  let eventId;
  try{eventId=await runMutation({
   actorId:actor.id,sessionId:actor.sessionId,tokenIatMs:actor.tokenIatMs,
   orderId,kind,...body
  });}catch{return deny(409,'G173_ORIGINAL_SQL_DENIED');}
  if(typeof eventId!=='string'||!UUID.test(eventId))
   return deny(503,'G173_UNVERIFIED_RECEIPT');
  // Do not claim successful commit after a session is revoked while the
  // original PostgreSQL response is in flight. SQL G42 already held the
  // grant row lock during the real mutation.
  try{if(await verifySessionNotRevoked({
    userId:actor.id,sessionId:actor.sessionId,at:now()})!==true)
    return deny(401,'G173_REVOKED');}
  catch{return deny(503,'G173_IDP_UNAVAILABLE');}
  return {status:200,body:{mode:'STAGING_DEMO_ONLY',liveCommerceEnabled:false,
   orderId,event:transition?body.event:'attach_delivery',eventId,
   serverPersisted:true}};
 };
}
