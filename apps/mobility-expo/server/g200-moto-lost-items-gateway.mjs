/**
 * G200 post-trip lost belongings: separate, bounded contact after a completed
 * original MOTO ride; no G50 terminal chat mutation or personal phone exchange.
 * External IdP/G42 and PostgreSQL callbacks are REQUIRED, default OFF.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const BEARER=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/;
const OPEN=/^\/v1\/staging\/rider\/moto\/trips\/([0-9a-f-]{36})\/lost-items$/i;
const CASE=/^\/v1\/staging\/moto\/lost-items\/([0-9a-f-]{36})(?:\/(messages|close))?$/i;
const INBOX='/v1/staging/driver/moto/lost-items';
const exact=(v,k)=>v!==null&&typeof v==='object'&&!Array.isArray(v)
 &&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).length===k.length
 &&k.every(x=>Object.hasOwn(v,x));
const deny=(status,code)=>({status,body:{code,retrySafe:false,
 qaOnly:true,productionEnabled:false}});
const MSG_KEYS=['messageId','senderRole','body','createdAtMs'];
function validMessage(x){return exact(x,MSG_KEYS)&&UUID.test(x.messageId)
 &&['passenger','driver'].includes(x.senderRole)
 &&typeof x.body==='string'&&x.body.length>=1&&x.body.length<=500
 &&Number.isSafeInteger(x.createdAtMs)&&x.createdAtMs>0;}
export function createG200MotoLostItemsGateway({
 environment,qaOnly,liveEnabled,
 verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
 allowRequest,verifyDriverStopped,openCase,readCase,sendCaseMessage,closeCase,driverInbox,
 now=Date.now
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false
 ||[verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,allowRequest,
  openCase,readCase,sendCaseMessage,closeCase,driverInbox,now]
 .some(fn=>typeof fn!=='function'))
 throw Error('G200 requires independent IdP/G42, actor case SQL and rate authority');
 return async({method,path,headers={},body}={})=>{
  const open=typeof path==='string'?OPEN.exec(path):null;
  const match=typeof path==='string'?CASE.exec(path):null;
  const inbox=path===INBOX&&method==='GET';
  const openAction=open!==null&&method==='POST';
  const readAction=match!==null&&method==='GET'&&match[2]===undefined;
  const sendAction=match!==null&&method==='POST'&&match[2]==='messages';
  const closeAction=match!==null&&method==='POST'&&match[2]==='close';
  if(!openAction&&!readAction&&!sendAction&&!closeAction&&!inbox)
   return deny(404,'G200_ROUTE_UNKNOWN');
  const tripId=open?.[1]?.toLowerCase();
  const caseId=match?.[1]?.toLowerCase();
  if((openAction&&!UUID.test(tripId))||
   ((readAction||sendAction||closeAction)&&!UUID.test(caseId)))
   return deny(400,'G200_INVALID_ID');
  if((openAction&&(!exact(body,[])))||
   ((readAction||inbox)&&body!=null)||
   (closeAction&&(!exact(body,['block'])||typeof body.block!=='boolean'))||
   (sendAction&&(!exact(body,['requestKey','body'])
    ||!UUID.test(body.requestKey)||typeof body.body!=='string'
    ||body.body.trim()!==body.body||body.body.length<1||body.body.length>500
    ||/[<>]/.test(body.body)||/https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(body.body)
    ||/([0-9][\s().-]*){7,}/.test(body.body))))
   return deny(400,'G200_INVALID_INPUT');
  const token=headers.cookie===undefined&&headers.Authorization===undefined
   &&typeof headers.authorization==='string'?
   BEARER.exec(headers.authorization)?.[1]:null;
  if(!token)return deny(401,'G200_AUTH_REQUIRED');
  let actor;
  try{actor=await verifyAccessToken(token);}
  catch{return deny(401,'G200_IDP_UNAVAILABLE');}
  const at=now();
  if(!exact(actor,['id','sessionId','tokenIatMs','expiresAtMs','is_anonymous'])
   ||!UUID.test(actor.id)||!UUID.test(actor.sessionId)
   ||!Number.isSafeInteger(actor.tokenIatMs)||actor.tokenIatMs>at
   ||!Number.isSafeInteger(actor.expiresAtMs)||actor.expiresAtMs<=at
   ||actor.is_anonymous!==false)return deny(401,'G200_UNVERIFIED_IDENTITY');
  let role;
  try{
   if(await verifySessionNotRevoked({userId:actor.id,sessionId:actor.sessionId,
    tokenIatMs:actor.tokenIatMs,at})!==true)
    return deny(401,'G200_REVOKED');
   role=await resolveExclusiveRole(actor.id);
   if(!['passenger','driver'].includes(role)||
    (openAction&&role!=='passenger')||(inbox&&role!=='driver'))
    return deny(403,'G200_EXCLUSIVE_ROLE_REQUIRED');
   if(allowRequest({actorId:actor.id,
    operation:openAction?'open':sendAction?'send':closeAction?'close':inbox?'inbox':'read'})!==true)
    return deny(429,'G200_RATE_LIMITED');
  }catch{return deny(503,'G200_IDENTITY_AUTHORITY_DOWN');}
  // An authenticated Driver may not type/reply while moving; never infer
  // stopped status from UI or a bare GPS coordinate. Must be independently
  // verified at the request time (the app cannot self-attest).
  if(sendAction&&role==='driver'){
   try{
    const stationary=await verifyDriverStopped({driverId:actor.id,at});
    if(stationary!==true)return deny(403,'G200_DRIVER_NOT_VERIFIED_STOPPED');
   }catch{return deny(503,'G200_DRIVER_MOTION_AUTHORITY_DOWN');}
  }
  const scope={actorId:actor.id,sessionId:actor.sessionId,tokenIatMs:actor.tokenIatMs};
  let receipt;
  try{
   receipt=openAction?await openCase({...scope,tripId}):
    inbox?await driverInbox(scope):
    readAction?await readCase({...scope,caseId}):
    sendAction?await sendCaseMessage({...scope,caseId,
     requestKey:body.requestKey,body:body.body}):
     await closeCase({...scope,caseId,block:body.block});
  }catch{return deny(503,'G200_SQL_OUTCOME_UNKNOWN');}
  const common=receipt?.mode==='STAGING_DEMO_ONLY'
   &&receipt.qaOnly===true&&receipt.productionEnabled===false;
  let valid=false;
  if(openAction)valid=exact(receipt,['mode','caseId','tripId','state',
   'expiresAtMs','qaOnly','productionEnabled'])&&
    receipt.tripId===tripId&&UUID.test(receipt.caseId)
    &&['OPEN','CLOSED','BLOCKED'].includes(receipt.state)
    &&Number.isSafeInteger(receipt.expiresAtMs);
  else if(inbox)valid=exact(receipt,['mode','driverId','cases','qaOnly','productionEnabled'])
   &&receipt.driverId===actor.id&&Array.isArray(receipt.cases)&&receipt.cases.length<=50
   &&receipt.cases.every(c=>exact(c,['caseId','tripId','state','expiresAtMs'])
    &&UUID.test(c.caseId)&&UUID.test(c.tripId)&&c.state==='OPEN'
    &&Number.isSafeInteger(c.expiresAtMs));
  else if(readAction)valid=exact(receipt,['mode','caseId','tripId','state',
    'canSend','expiresAtMs','messages','qaOnly','productionEnabled'])
   &&receipt.caseId===caseId&&UUID.test(receipt.tripId)
   &&['OPEN','CLOSED','BLOCKED'].includes(receipt.state)
   &&typeof receipt.canSend==='boolean'&&Number.isSafeInteger(receipt.expiresAtMs)
   &&Array.isArray(receipt.messages)&&receipt.messages.length<=60
   &&receipt.messages.every(validMessage);
  else if(sendAction)valid=exact(receipt,['mode','caseId','messageId',
    'requestKey','serverPersisted','qaOnly','productionEnabled'])
   &&receipt.caseId===caseId&&UUID.test(receipt.messageId)
   &&receipt.requestKey===body.requestKey&&receipt.serverPersisted===true;
  else valid=exact(receipt,['mode','caseId','state','qaOnly','productionEnabled'])
   &&receipt.caseId===caseId&&['CLOSED','BLOCKED'].includes(receipt.state);
  if(!common||!valid)return deny(503,'G200_UNVERIFIED_SQL_PROOF');
  const ended=now();
  if(ended<at||ended>=actor.expiresAtMs)return deny(503,'G200_AUTH_EXPIRED_AFTER_SQL');
  try{
   if(await verifySessionNotRevoked({userId:actor.id,sessionId:actor.sessionId,
    tokenIatMs:actor.tokenIatMs,at:ended})!==true)
    return deny(503,'G200_SESSION_REVOKED_AFTER_SQL');
  }catch{return deny(503,'G200_SESSION_UNAVAILABLE_AFTER_SQL');}
  return {status:200,body:receipt};
 };
}
