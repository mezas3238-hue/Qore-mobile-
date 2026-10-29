/**
 * G214: independent Admin-only original G5/G10/G122/G67/G187 handoff.
 * A courier's delivered flag is NEVER recipient consent or PSP settlement.
 * This route cannot be enabled without independent Admin AAL2 authority.
 */
const PATH=/^\/v1\/staging\/admin\/services\/(DELIVERY_AUTO|DELIVERY_MOTO)\/([0-9a-f-]{36})\/handoff$/i;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const FIELDS=['mode','viewerId','serviceId','serviceKind','bookingRequestKey',
 'quoteId','deliveryState','revision','courierAccepted','courierProofCommitted',
 'recipientBound','recipientConfirmed','eligibleForSettlement',
 'paymentAuthorized','commerciallyCertified','legalGate','commerceOrderId',
 'observedAt','expiresAt','serverPersisted','qaOnly','productionEnabled'];
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,k)=>plain(x)&&Object.keys(x).length===k.length&&
 k.every(v=>Object.hasOwn(x,v));
const uuid=x=>typeof x==='string'&&UUID.test(x);
const int=x=>Number.isSafeInteger(x)&&x>=0;
const deny=(status,code)=>({status,body:{
 code,qaOnly:true,productionEnabled:false,retrySafe:false}});
export function createG214AdminDeliveryHandoffGateway({
 environment,qaOnly,liveEnabled,verifyAccessToken,
 verifySessionNotRevoked,loadExclusiveBackofficeRole,
 verifyBackofficeMfa,allowRequest,loadHandoffReceipt,now=Date.now
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
 [verifyAccessToken,verifySessionNotRevoked,loadExclusiveBackofficeRole,
 verifyBackofficeMfa,allowRequest,loadHandoffReceipt,now]
 .some(v=>typeof v!=='function'))
 throw Error('G214 requires independent Admin AAL2 and source-backed G187');
 return async({method,path,headers={},body}={})=>{
  const match=method==='GET'&&typeof path==='string'?PATH.exec(path):null;
  if(!match||!uuid(match[2].toLowerCase())||body!=null)
   return deny(404,'G214_ROUTE_UNAVAILABLE');
  if(typeof headers.authorization!=='string'||headers.Authorization!==undefined
   ||headers.cookie!==undefined)
   return deny(401,'G214_BEARER_REQUIRED');
  const token=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/
   .exec(headers.authorization)?.[1];
  if(!token)return deny(401,'G214_BEARER_REQUIRED');
  const at=now();
  if(!int(at))return deny(503,'G214_CLOCK_UNAVAILABLE');
  let actor;
  try{actor=await verifyAccessToken(token);}
  catch{return deny(401,'G214_AUTH_INVALID');}
  if(!plain(actor)||!uuid(actor.id)||!uuid(actor.sessionId)||
   actor.is_anonymous!==false||!int(actor.expiresAtMs)||
   actor.expiresAtMs<=at)return deny(401,'G214_AUTH_INVALID');
  const revoked=async when=>{
   try{return await verifySessionNotRevoked({
    userId:actor.id,sessionId:actor.sessionId,at:when})===true;}
   catch{return null;}
  };
  const first=await revoked(at);
  if(first!==true)return deny(first===null?503:401,'G214_SESSION_INVALID');
  let role;
  try{role=await loadExclusiveBackofficeRole(actor.id);}
  catch{return deny(503,'G214_ROLE_UNAVAILABLE');}
  if(role!=='admin')return deny(403,'G214_ADMIN_REQUIRED');
  let mfa;
  try{mfa=await verifyBackofficeMfa({
   token,userId:actor.id,sessionId:actor.sessionId,requiredLevel:'aal2',at
  });}catch{return deny(503,'G214_MFA_UNAVAILABLE');}
  if(!plain(mfa)||mfa.verifiedByProvider!==true||
   mfa.assuranceLevel!=='aal2'||mfa.userId!==actor.id||
   mfa.sessionId!==actor.sessionId||!int(mfa.verifiedAtMs)||
   mfa.verifiedAtMs>at||at-mfa.verifiedAtMs>43200000||
   !int(mfa.expiresAtMs)||mfa.expiresAtMs<=at||
   mfa.expiresAtMs>actor.expiresAtMs)
   return deny(403,'G214_AAL2_REQUIRED');
  try{if(allowRequest({userId:actor.id,
   operation:'admin.delivery.handoff.read'})!==true)
   return deny(429,'G214_RATE_LIMIT');}
  catch{return deny(503,'G214_LIMITER_UNAVAILABLE');}
  const kind=match[1].toUpperCase(),id=match[2].toLowerCase();
  let d;
  try{d=await loadHandoffReceipt({actorId:actor.id,deliveryId:id});}
  catch{return deny(503,'G214_SQL_UNAVAILABLE');}
  if(d===null)return deny(404,'G214_HANDOFF_NOT_VERIFIED');
  const finish=now();
  if(!int(finish)||finish<at||finish>=actor.expiresAtMs||
   finish>=mfa.expiresAtMs)return deny(503,'G214_SESSION_LOST');
  if(!exact(d,FIELDS)||d.mode!=='STAGING_DEMO_ONLY'||
   d.viewerId!==actor.id||d.serviceId!==id||d.serviceKind!==kind||
   !uuid(d.bookingRequestKey)||!uuid(d.quoteId)||
   !['delivered','disputed','returned'].includes(d.deliveryState)||
   d.revision!==({'delivered':4,'disputed':5,'returned':6}[d.deliveryState])||
   d.courierAccepted!==true||d.courierProofCommitted!==true||
   typeof d.recipientBound!=='boolean'||
   typeof d.recipientConfirmed!=='boolean'||
   (!d.recipientBound&&d.recipientConfirmed)||
   d.eligibleForSettlement!==(
    d.deliveryState==='delivered'&&d.recipientConfirmed)||
   d.paymentAuthorized!==false||d.commerciallyCertified!==false||
   d.legalGate!=='EXTERNAL_NOT_CERTIFIED'||
   (d.commerceOrderId!==null&&!uuid(d.commerceOrderId))||
   !int(d.observedAt)||d.observedAt>finish||
   finish-d.observedAt>30000||!int(d.expiresAt)||
   d.expiresAt<=finish||d.expiresAt>finish+60000||
   d.serverPersisted!==true||d.qaOnly!==true||d.productionEnabled!==false)
   return deny(503,'G214_UNTRUSTED_OR_CONTRADICTORY_RECEIPT');
  if(await revoked(finish)!==true)return deny(503,'G214_SESSION_LOST_AFTER_SQL');
  return {status:200,body:d};
 };
}
