/** G155 authenticated post-service ratings. Loopback QA contract, NOT LIVE.
 * Verified completed participant authority + G42 occurs inside SQL as well.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/;
const POST='/v1/staging/reputation/ratings';
const kinds=new Set(['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE']);
const targets=new Set(['DRIVER','COURIER','MERCHANT','CLIENT']);
const incidents=new Set(['SUSPECTED_FRAUD','SAFETY','NO_SHOW','INCORRECT_ITEM','OTHER']);
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const fail=(status,code)=>({status,body:{code,qaOnly:true,productionEnabled:false}});
export function createG155VerifiedRatingGateway({
 environment,qaOnly,liveEnabled,verifyAccessToken,
 verifySessionNotRevoked,allowRequest,submitRating,now=Date.now
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,allowRequest,submitRating,now]
  .some(f=>typeof f!=='function'))throw Error('G155 independent rating authorities required');
 return async({method,path,headers={},body}={})=>{
  if(method!=='POST'||path!==POST)return fail(404,'G155_ROUTE_UNAVAILABLE');
  if(!exact(body,['requestKey','serviceKind','serviceId','ratedKind','stars','incidentCode'])
   ||![body.requestKey,body.serviceId].every(x=>typeof x==='string'&&UUID.test(x)&&x===x.toLowerCase())
   ||!kinds.has(body.serviceKind)||!targets.has(body.ratedKind)
   ||!Number.isSafeInteger(body.stars)||body.stars<1||body.stars>5
   ||!(body.incidentCode===null||incidents.has(body.incidentCode)))
   return fail(400,'G155_INVALID_RATING');
  const token=typeof headers.authorization==='string'
   &&headers.Authorization===undefined&&headers.cookie===undefined
   ?TOKEN.exec(headers.authorization)?.[1]:null;
  if(!token)return fail(401,'G155_BEARER_REQUIRED');
  let actor;
  try{actor=await verifyAccessToken(token);}catch{return fail(401,'G155_SESSION_INVALID');}
  const at=now();
  if(!exact(actor,['id','sessionId','tokenIatMs','expiresAtMs','is_anonymous'])
   ||![actor.id,actor.sessionId].every(x=>typeof x==='string'&&UUID.test(x))
   ||!Number.isSafeInteger(at)||!Number.isSafeInteger(actor.tokenIatMs)
   ||actor.tokenIatMs>at||!Number.isSafeInteger(actor.expiresAtMs)
   ||actor.expiresAtMs<=at||actor.is_anonymous!==false)
   return fail(401,'G155_SESSION_INVALID');
  try{
   if(await verifySessionNotRevoked({userId:actor.id,sessionId:actor.sessionId,at})!==true)
    return fail(401,'G155_SESSION_REVOKED');
  }catch{return fail(503,'G155_REVOCATION_UNAVAILABLE');}
  try{
   if(allowRequest({userId:actor.id,operation:'reputation.rate'})!==true)
    return fail(429,'G155_RATE_LIMIT');
  }catch{return fail(503,'G155_LIMIT_UNAVAILABLE');}
  let receipt;
  try{receipt=await submitRating({
   reviewerId:actor.id,sessionId:actor.sessionId,
   tokenIatMs:actor.tokenIatMs,...body
  });}catch{return fail(409,'G155_UNVERIFIED_SERVICE_OR_REPLAY');}
  if(!exact(receipt,['ratingId','serviceId','serviceKind','ratedKind','stars',
    'requestKey','serverPersisted','qaOnly','productionEnabled',
    'dispatchPriorityChanged','automatedSuspension'])
   ||typeof receipt.ratingId!=='string'||!UUID.test(receipt.ratingId)
   ||receipt.serviceId!==body.serviceId||receipt.serviceKind!==body.serviceKind
   ||receipt.ratedKind!==body.ratedKind||receipt.stars!==body.stars
   ||receipt.requestKey!==body.requestKey
   ||receipt.serverPersisted!==true||receipt.qaOnly!==true
   ||receipt.productionEnabled!==false
   ||receipt.dispatchPriorityChanged!==false||receipt.automatedSuspension!==false)
   return fail(503,'G155_UNTRUSTED_RECEIPT');
  // Recheck identity after the SQL mutation; a network loss is outcome-unknown
  // and must be reconciled by resending the ORIGINAL requestKey.
  try{
   if(await verifySessionNotRevoked({userId:actor.id,sessionId:actor.sessionId,at:now()})!==true)
    return fail(401,'G155_SESSION_REVOKED');
  }catch{return fail(503,'G155_REVOCATION_UNAVAILABLE');}
  return {status:201,body:receipt};
 };
}
