/**
 * G66 STAGING-only Courier delivery custody status; actor from independently
 * verified session/role. Does not expose sender, address, phone or proof media.
 */
export const G66_COURIER_CUSTODY_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH=/^\/v1\/staging\/courier\/deliveries\/([0-9a-f-]{36})\/custody$/i;
const TOKEN=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/;
const STATES=new Set(['accepted','picked_up','delivered','disputed','returned','cancelled']);
const STAGES=Object.freeze({accepted:'pickup',picked_up:'deliver',
 delivered:null,disputed:'return',returned:null,cancelled:null});
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,k)=>plain(x)&&Object.keys(x).length===k.length&&k.every(v=>Object.hasOwn(x,v));
const fail=(status,code)=>Object.freeze({status,body:Object.freeze({code,qaOnly:true,productionEnabled:false})});
export function createG66CourierCustodyStatusQa({
 environment,localQaOnly,liveEnabled,verifyAccessToken,
 verifySessionNotRevoked,resolveExclusiveRole,allowRequest,
 loadAssignedDelivery,verifyStoredProof,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,allowRequest,
  loadAssignedDelivery,verifyStoredProof,now].some(f=>typeof f!=='function'))
  throw Error('G66 trusted STAGING server only');
 return async({method,path,headers,body}={})=>{
  const m=typeof path==='string'?PATH.exec(path):null;
  if(method!=='GET'||!m||!UUID.test(m[1])||
   (body!==undefined&&body!==null))
   return fail(404,'G66_ROUTE_INVALID');
  const auth=typeof headers?.authorization==='string'
   &&headers.Authorization===undefined&&headers.cookie===undefined?
   TOKEN.exec(headers.authorization):null;
  if(!auth)return fail(401,'G66_BEARER_REQUIRED');
  let user;
  try{user=await verifyAccessToken(auth[1]);}
  catch{return fail(401,'G66_IDENTITY_INVALID');}
  const at=now();
  if(!exact(user,['id','sessionId','tokenIatMs','expiresAtMs','is_anonymous'])||
   !UUID.test(user.id)||!UUID.test(user.sessionId)||
   !Number.isSafeInteger(at)||at<0||
   !Number.isSafeInteger(user.tokenIatMs)||user.tokenIatMs>at||
   !Number.isSafeInteger(user.expiresAtMs)||user.expiresAtMs<=at||
   user.is_anonymous!==false)
   return fail(401,'G66_IDENTITY_INVALID');
  try{
   if(await verifySessionNotRevoked({
    userId:user.id,sessionId:user.sessionId,at})!==true)
    return fail(401,'G66_SESSION_REVOKED');
  }catch{return fail(503,'G66_SESSION_UNAVAILABLE');}
  try{
   if(await resolveExclusiveRole(user.id)!=='driver')
    return fail(403,'G66_DRIVER_REQUIRED');
  }catch{return fail(503,'G66_ROLE_UNAVAILABLE');}
  try{
   if(allowRequest({actorId:user.id,operation:'courier_custody_read'})!==true)
    return fail(429,'G66_RATE_LIMIT');
  }catch{return fail(503,'G66_LIMIT_UNAVAILABLE');}
  let row;
  try{row=await loadAssignedDelivery({actorId:user.id,deliveryId:m[1].toLowerCase()});}
  catch{return fail(503,'G66_STORAGE_UNAVAILABLE');}
  if(!exact(row,['deliveryId','courierId','vehicleId','senderId',
    'status','revision','vehicleKind','category','proofRef'])||
   row.deliveryId!==m[1].toLowerCase()||row.courierId!==user.id||
   !UUID.test(row.vehicleId)||!UUID.test(row.senderId)||row.senderId===user.id||
   !STATES.has(row.status)||!Number.isSafeInteger(row.revision)||row.revision<2||
   !['AUTO','MOTO'].includes(row.vehicleKind)||
   !['DOCUMENTS','PARCEL','GROCERIES','PHARMACY_OTC','RESTAURANT'].includes(row.category)||
   (row.proofRef!==null&&!UUID.test(row.proofRef))||
   (['delivered','disputed','returned'].includes(row.status)&&!UUID.test(row.proofRef)))
   return fail(404,'G66_NOT_ASSIGNED');
  // Proof UUID in SQL is NOT itself evidence of verified delivery.
  let proofVerified=false;
  if(row.proofRef!==null){
   try{
    proofVerified=await verifyStoredProof({
     actorId:user.id,deliveryId:row.deliveryId,proofRef:row.proofRef
    })===true;
   }catch{return fail(503,'G66_PROOF_UNAVAILABLE');}
   if(!proofVerified&&['delivered','disputed','returned'].includes(row.status))
    return fail(503,'G66_PROOF_UNVERIFIED');
  }
  // G185: reading the assigned SQL row and verifying the independent
  // proof take time. If this session loses authority meanwhile, do not
  // disclose its delivery state in the response. No sender PII is ever read.
  const finished=now();
  if(!Number.isSafeInteger(finished)||finished<at||
   finished>=user.expiresAtMs)return fail(401,'G185_COURIER_SESSION_EXPIRED');
  try{
   if(await verifySessionNotRevoked({
    userId:user.id,sessionId:user.sessionId,at:finished})!==true)
    return fail(401,'G185_COURIER_SESSION_REVOKED');
  }catch{return fail(503,'G185_COURIER_REVOCATION_UNAVAILABLE');}
  return Object.freeze({status:200,body:Object.freeze({
   mode:'STAGING_DEMO_ONLY',deliveryId:row.deliveryId,
   state:row.status,revision:row.revision,nextEvent:STAGES[row.status],
   assignmentPersisted:true,proofVerified,
   qaOnly:true,productionEnabled:false,liveDeliveriesEnabled:false,
   senderContactVisible:false,gpsVerified:false
  })});
 };
}
