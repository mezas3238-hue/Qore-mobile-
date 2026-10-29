/**
 * G187: one original G5 delivery, courier G67 proof then independently
 * authenticated recipient confirmation. Confirming receipt NEVER captures
 * payment or changes the courier-reported G5 delivered state.
 * QA-only, opt-in external session authority. No recipient phone/PII.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROUTE=/^\/v1\/staging\/(sender|recipient)\/deliveries\/([0-9a-f-]{36})\/(recipient-bind|recipient-confirmation|confirm)$/i;
const BEARER=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/;
const exact=(x,names)=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.getPrototypeOf(x)===Object.prototype
 &&Object.keys(x).length===names.length
 &&names.every(n=>Object.hasOwn(x,n));
const deny=(status,code)=>({status,body:{code,retrySafe:false,
 qaOnly:true,productionEnabled:false}});
export function createG187RecipientConfirmationGateway({
 environment,qaOnly,liveEnabled,verifyAccessToken,verifySessionNotRevoked,
 resolveExclusiveRole,allowRequest,bindRecipient,confirmReceived,
 readSenderStatus,now=Date.now
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
 [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
 allowRequest,bindRecipient,confirmReceived,readSenderStatus,now]
 .some(f=>typeof f!=='function'))
 throw Error('G187 independent recipient and sender authorities required');
 return async(input={})=>{
  const {method,path,headers={},body}=input;
  const match=typeof path==='string'?ROUTE.exec(path):null;
  if(!match)return deny(404,'G187_ROUTE_UNKNOWN');
  const [,side,rawId,action]=match;
  const deliveryId=rawId.toLowerCase();
  const bind=method==='POST'&&side==='sender'&&action==='recipient-bind';
  const confirm=method==='POST'&&side==='recipient'&&action==='confirm';
  const read=method==='GET'&&side==='sender'&&action==='recipient-confirmation';
  if(!UUID.test(deliveryId)||(!bind&&!confirm&&!read))
   return deny(404,'G187_ROUTE_UNKNOWN');
  if(read?(body!==undefined&&body!==null):
    bind?(!exact(body,['recipientId','requestKey'])||
      !UUID.test(body.recipientId)||!UUID.test(body.requestKey)):
      (!exact(body,['requestKey'])||!UUID.test(body.requestKey)))
   return deny(400,'G187_INPUT_INVALID');
  const token=typeof headers.authorization==='string'&&
   headers.Authorization===undefined&&headers.cookie===undefined?
   BEARER.exec(headers.authorization)?.[1]:null;
  if(!token)return deny(401,'G187_VERIFIED_SESSION_REQUIRED');
  let actor;
  try{actor=await verifyAccessToken(token);}
  catch{return deny(401,'G187_PROVIDER_UNAVAILABLE');}
  const at=now();
  if(!exact(actor,['id','sessionId','tokenIatMs','expiresAtMs','is_anonymous'])||
    !UUID.test(actor.id)||!UUID.test(actor.sessionId)||
    !Number.isSafeInteger(at)||at<0||
    !Number.isSafeInteger(actor.tokenIatMs)||actor.tokenIatMs>at||
    !Number.isSafeInteger(actor.expiresAtMs)||actor.expiresAtMs<=at||
    actor.is_anonymous!==false)
   return deny(401,'G187_IDENTITY_INVALID');
  try{
   if(await verifySessionNotRevoked({
    userId:actor.id,sessionId:actor.sessionId,at})!==true)
    return deny(401,'G187_SESSION_REVOKED');
  }catch{return deny(503,'G187_SESSION_AUTHORITY_UNAVAILABLE');}
  try{
   if(await resolveExclusiveRole(actor.id)!=='passenger')
    return deny(403,'G187_PASSENGER_ROLE_REQUIRED');
  }catch{return deny(503,'G187_ROLE_UNAVAILABLE');}
  try{
   if(allowRequest({actorId:actor.id,operation:
    bind?'g187_bind':confirm?'g187_confirm':'g187_status'})!==true)
    return deny(429,'G187_RATE_LIMITED');
  }catch{return deny(503,'G187_LIMIT_UNAVAILABLE');}
  const scope={actorId:actor.id,sessionId:actor.sessionId,
   tokenIatMs:actor.tokenIatMs,deliveryId};
  let receipt;
  try{
   receipt=bind?await bindRecipient({...scope,recipientId:body.recipientId,
    requestKey:body.requestKey}):
    confirm?await confirmReceived({...scope,requestKey:body.requestKey}):
    await readSenderStatus(scope);
  }catch{return deny(503,'G187_SQL_OUTCOME_UNCERTAIN');}
  const common=receipt?.mode==='STAGING_DEMO_ONLY'&&
   receipt?.deliveryId===deliveryId&&receipt?.qaOnly===true&&
   receipt?.productionEnabled===false;
  const valid=bind?
   exact(receipt,['mode','deliveryId','bindingPersisted','recipientConfirmed',
    'qaOnly','productionEnabled'])&&receipt.bindingPersisted===true&&
    receipt.recipientConfirmed===false:
   confirm?
    exact(receipt,['mode','deliveryId','confirmationId','recipientConfirmed',
     'serverPersisted','qaOnly','productionEnabled','paymentAuthorized'])&&
     UUID.test(receipt.confirmationId??'')&&receipt.recipientConfirmed===true&&
     receipt.serverPersisted===true&&receipt.paymentAuthorized===false:
    exact(receipt,['mode','deliveryId','ownerId','deliveryState','revision',
     'courierProofCommitted','recipientBound','recipientConfirmed',
     'eligibleForSettlement','paymentAuthorized','qaOnly','productionEnabled'])&&
    receipt.ownerId===actor.id&&
    ['requested','accepted','picked_up','delivered','disputed','returned','cancelled']
     .includes(receipt.deliveryState)&&
    Number.isSafeInteger(receipt.revision)&&receipt.revision>=1&&
    ['courierProofCommitted','recipientBound','recipientConfirmed','eligibleForSettlement']
     .every(k=>typeof receipt[k]==='boolean')&&
    receipt.eligibleForSettlement===receipt.recipientConfirmed&&
    receipt.paymentAuthorized===false;
  if(!common||!valid)return deny(503,'G187_UNTRUSTED_SQL_RECEIPT');
  const ended=now();
  if(!Number.isSafeInteger(ended)||ended<at||ended>=actor.expiresAtMs)
   return deny(503,'G187_SESSION_LOST_AFTER_SQL');
  try{
   if(await verifySessionNotRevoked({userId:actor.id,sessionId:actor.sessionId,
    at:ended})!==true)return deny(503,'G187_SESSION_LOST_AFTER_SQL');
  }catch{return deny(503,'G187_SESSION_LOST_AFTER_SQL');}
  return {status:200,body:receipt};
 };
}
