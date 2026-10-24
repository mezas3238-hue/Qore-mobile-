/** G68/A57: PRIVATE Passenger sender status, distinct from G66 Driver route.
 * HTTPS mount disabled. All identity/session and proof sources server injected.
 * A proof UUID in the row is NOT evidence; trust G67 DB authority only.
 */
export const G68_SENDER_CUSTODY_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROUTE=/^\/v1\/staging\/sender\/deliveries\/([0-9a-f-]{36})\/custody$/i;
const TOKEN=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/;
const STATES=new Set(['requested','accepted','picked_up','delivered','disputed','returned','cancelled']);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const fail=(status,code)=>Object.freeze({status,body:Object.freeze({
 code,qaOnly:true,productionEnabled:false,retrySafe:false
})});
export function createG68SenderCustodyStatusQa({
 environment,localQaOnly,liveEnabled,verifyAccessToken,
 verifySessionNotRevoked,resolveExclusiveRole,allowRequest,
 loadOwnDelivery,verifyStoredProof,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
 [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,allowRequest,
 loadOwnDelivery,verifyStoredProof,now].some(x=>typeof x!=='function'))
 throw Error('G68 requires trusted disabled-by-default STAGING sources');
 return async({method,path,headers,body}={})=>{
  const m=typeof path==='string'?ROUTE.exec(path):null;
  if(method!=='GET')return fail(404,'G68_METHOD_INVALID');
  if(!m)return fail(404,'G68_ROUTE_PATH_INVALID');
  if(!UUID.test(m[1]))return fail(404,'G68_ROUTE_UUID_INVALID');
  if(body!==undefined&&body!==null)return fail(404,'G68_GET_BODY_INVALID');
  const match=typeof headers?.authorization==='string'
   &&headers.Authorization===undefined&&headers.cookie===undefined
   ?TOKEN.exec(headers.authorization):null;
  if(!match)return fail(401,'G68_BEARER_REQUIRED');
  let user;
  try{user=await verifyAccessToken(match[1]);}
  catch{return fail(401,'G68_IDENTITY_INVALID');}
  const at=now();
  if(!exact(user,['id','sessionId','tokenIatMs','expiresAtMs','is_anonymous'])||
   !UUID.test(user.id)||!UUID.test(user.sessionId)||
   !Number.isSafeInteger(at)||at<0||
   !Number.isSafeInteger(user.tokenIatMs)||user.tokenIatMs>at||
   !Number.isSafeInteger(user.expiresAtMs)||user.expiresAtMs<=at||
   user.is_anonymous!==false)return fail(401,'G68_IDENTITY_INVALID');
  try{
   if(await verifySessionNotRevoked({userId:user.id,sessionId:user.sessionId,at})!==true)
    return fail(401,'G68_SESSION_REVOKED');
  }catch{return fail(503,'G68_SESSION_UNAVAILABLE');}
  try{
   if(await resolveExclusiveRole(user.id)!=='passenger')
    return fail(403,'G68_PASSENGER_REQUIRED');
  }catch{return fail(503,'G68_ROLE_UNAVAILABLE');}
  try{
   if(allowRequest({actorId:user.id,operation:'sender_custody_read'})!==true)
    return fail(429,'G68_RATE_LIMIT');
  }catch{return fail(503,'G68_RATE_UNAVAILABLE');}
  const deliveryId=m[1].toLowerCase();
  let row;
  try{row=await loadOwnDelivery({actorId:user.id,deliveryId});}
  catch{return fail(503,'G68_STORAGE_UNAVAILABLE');}
  if(row===null)return fail(404,'G68_NOT_FOUND');
  if(!exact(row,['deliveryId','senderId','courierId','vehicleId','status',
     'revision','vehicleKind','proofRef'])||row.deliveryId!==deliveryId||
   row.senderId!==user.id||!STATES.has(row.status)||
   !Number.isSafeInteger(row.revision)||row.revision<1||
   !['AUTO','MOTO'].includes(row.vehicleKind)||
   (row.courierId!==null&&!UUID.test(row.courierId))||
   (row.vehicleId!==null&&!UUID.test(row.vehicleId))||
   (row.proofRef!==null&&!UUID.test(row.proofRef)))
   return fail(503,'G68_UNTRUSTED_CUSTODY_ROW');
  const assigned=UUID.test(row.courierId??'')&&UUID.test(row.vehicleId??'');
  if((row.courierId===null)!==(row.vehicleId===null)||
   (row.status==='requested'&&(assigned||row.proofRef!==null))||
   (['accepted','picked_up','delivered','disputed','returned'].includes(row.status)&&!assigned)||
   (['requested','accepted','picked_up'].includes(row.status)&&row.proofRef!==null)||
   (['delivered','disputed','returned'].includes(row.status)&&row.proofRef===null))
   return fail(503,'G68_INVALID_PERSISTED_STATE');
  let proofVerified=false;
  if(row.proofRef!==null){
   try{
    // Must read the G67 owner-only DB registry and committed G5 transition.
    proofVerified=await verifyStoredProof({actorId:user.id,
      courierId:row.courierId,deliveryId,proofRef:row.proofRef})===true;
   }catch{return fail(503,'G68_PROOF_UNAVAILABLE');}
   if(!proofVerified)return fail(503,'G68_PROOF_UNVERIFIED');
  }
  return Object.freeze({status:200,body:Object.freeze({
   mode:'STAGING_DEMO_ONLY',deliveryId,ownerId:user.id,
   state:row.status,revision:row.revision,vehicleKind:row.vehicleKind,
   assignmentPersisted:assigned,proofVerified,qaOnly:true,
   productionEnabled:false,liveDeliveriesEnabled:false
  })});
 };
}
