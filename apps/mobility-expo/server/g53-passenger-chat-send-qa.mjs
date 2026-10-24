/**
 * QORE G53 A34 — Passenger-only durable chat send receipt. QA-only, no HTTPS.
 * Independently verified provider identity; never trust actorId/role/subject
 * from request. The PostgreSQL G53 owner-only RPC is unavailable to SDKs.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid=x=>typeof x==='string'&&UUID.test(x);
const safe=x=>Number.isSafeInteger(x)&&x>=0;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const OUT=['conversationId','serviceId','requestKey','messageId','senderRole','body','createdAt','revision','serverStored'];
const result=(status,code)=>Object.freeze({status,body:Object.freeze({code,qaOnly:true})});
const cleanMessage=x=>typeof x==='string'&&x.length>=1&&x.length<=500&&
 x===x.trim()&&Buffer.byteLength(x,'utf8')<=2000&&
 !/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069\u200e\u200f]/u.test(x)&&
 !/(?:https?:\/\/|www\.)/iu.test(x)&&
 !/[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu.test(x)&&
 !/(?:\+?\d[\s().-]*){7,}/u.test(x);
function trustedAck(x,req,at){
 return exact(x,OUT)&&x.conversationId===req.conversationId&&
  x.serviceId===req.serviceId&&x.requestKey===req.requestKey&&
  uuid(x.messageId)&&x.senderRole==='passenger'&&
  x.body===req.body&&cleanMessage(x.body)&&
  safe(x.createdAt)&&x.createdAt<=at&&
  safe(x.revision)&&x.revision>=2&&x.serverStored===true;
}
export function createG53PassengerChatSendQa({
 environment,localQaOnly,liveEnabled,
 verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
 allowRequest,rpc,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
   allowRequest,rpc,now].some(x=>typeof x!=='function'))
  throw Error('G53 requires isolated QA and independent Auth/DB authorities');
 return Object.freeze({async handle(request){
  if(!exact(request,['bearer','serviceKind','serviceId',
   'conversationId','requestKey','body'])||
   typeof request.bearer!=='string'||request.bearer.length<20||
   request.bearer.length>8192||
   !['RIDE','DELIVERY','MERCHANT_ORDER'].includes(request.serviceKind)||
   !uuid(request.serviceId)||!uuid(request.conversationId)||
   !uuid(request.requestKey)||!cleanMessage(request.body))
   return result(400,'INVALID_CHAT_SEND');
  const start=now();
  if(!safe(start))return result(503,'CLOCK_UNAVAILABLE');
  let actor;
  try{actor=await verifyAccessToken(request.bearer);}
  catch{return result(401,'UNVERIFIED_JWT');}
  if(!plain(actor)||!uuid(actor.id)||!uuid(actor.sessionId)||
   !safe(actor.tokenIatMs)||actor.tokenIatMs>start||
   !safe(actor.expiresAtMs)||actor.expiresAtMs<=start||
   actor.is_anonymous===true)
   return result(401,'UNVERIFIED_JWT');
  try{
   if(await verifySessionNotRevoked({
    userId:actor.id,sessionId:actor.sessionId,at:start})!==true)
    return result(401,'REVOKED_SESSION');
  }catch{return result(503,'PROVIDER_UNAVAILABLE');}
  let role;
  try{role=await resolveExclusiveRole(actor.id);}
  catch{return result(503,'ROLE_UNAVAILABLE');}
  if(role!=='passenger')return result(403,'PASSENGER_REQUIRED');
  try{
   if(allowRequest({userId:actor.id,operation:'CHAT_SEND'})!==true)
    return result(429,'CHAT_RATE_LIMIT');
  }catch{return result(503,'LIMITER_UNAVAILABLE');}
  let receipt;
  try{
   receipt=await rpc('mobility_stage_g53_passenger_send_owner_qa',{
    _kind:request.serviceKind,_service:request.serviceId,
    _conversation:request.conversationId,
    _actor:actor.id,_session:actor.sessionId,_iat:actor.tokenIatMs,
    _request:request.requestKey,_body:request.body
   });
  }catch{return result(503,'CHAT_STORAGE_UNAVAILABLE');}
  if(!plain(receipt))return result(503,'CHAT_STORAGE_UNAVAILABLE');
  if(receipt.error){
   const code=receipt.error.code;
   if(code==='G5001')return result(401,'REVOKED_SESSION');
   if(code==='G5002'||code==='G5302')return result(400,'INVALID_CHAT_SEND');
   if(code==='G5003'||code==='G5303')return result(403,'ASSIGNMENT_OR_ROLE_DENIED');
   if(['G5004','G5009','G5304'].includes(code))
    return result(409,'CHAT_CONVERSATION_OR_KEY_CONFLICT');
   return result(503,'CHAT_STORAGE_UNAVAILABLE');
  }
  const completed=now();
  if(!safe(completed)||completed<start)return result(503,'CLOCK_UNAVAILABLE');
  if(actor.expiresAtMs<=completed)return result(401,'SESSION_EXPIRED');
  if(!trustedAck(receipt.data,request,completed))
   return result(503,'UNTRUSTED_DURABLE_ACK');
  return Object.freeze({status:200,body:Object.freeze({...receipt.data})});
 }});
}
