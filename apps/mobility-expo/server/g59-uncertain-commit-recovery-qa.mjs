/**
 * G59/A47 — isolated QA-only recovery after unknown HTTP/SQL COMMIT outcome.
 * NO exposed HTTP route or production provider. Owner-only SQL RPC must be
 * injected by a trusted backend process; client cannot supply identity.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=x=>typeof x==='string'&&UUID.test(x);
const safe=x=>Number.isSafeInteger(x)&&x>=0;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(o,keys)=>plain(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const cleanMessage=x=>typeof x==='string'&&x.length>=1&&x.length<=500&&
 x===x.trim()&&Buffer.byteLength(x,'utf8')<=2000&&
 !/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069\u200e\u200f]/u.test(x)&&
 !/(?:https?:\/\/|www\.)/iu.test(x)&&
 !/[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu.test(x)&&
 !/(?:\+?\d[\s().-]*){7,}/u.test(x);
const ACK=['conversationId','serviceId','requestKey','messageId','senderRole',
 'body','createdAt','revision','serverStored'];
const TOP=['state','serverStored','retrySafe','reconcileAgain','qaOnly',
 'productionEnabled','latestRevision','historyRefreshRequired','ack'];
const UNKNOWN=['state','serverStored','retrySafe','reconcileAgain','qaOnly',
 'productionEnabled'];
const fail=(status,code)=>Object.freeze({status,body:Object.freeze({
 code,qaOnly:true,retrySafe:false})});
function validateReceipt(r,req,at){
 if(!exact(r,TOP)||r.state!=='COMMITTED'||r.serverStored!==true||
  r.retrySafe!==false||r.reconcileAgain!==false||r.qaOnly!==true||
  r.productionEnabled!==false||!safe(r.latestRevision)||
  r.latestRevision<2||typeof r.historyRefreshRequired!=='boolean')
  return false;
 const a=r.ack;
 if(!exact(a,ACK)||a.conversationId!==req.conversationId||
  a.serviceId!==req.serviceId||a.requestKey!==req.requestKey||
  !id(a.messageId)||a.senderRole!=='passenger'||a.body!==req.body||
  a.serverStored!==true||!safe(a.createdAt)||a.createdAt>at||
  !safe(a.revision)||a.revision<2||a.revision>r.latestRevision)
  return false;
 return r.historyRefreshRequired===(r.latestRevision>a.revision);
}
export function createG59UncertainCommitRecoveryQa({
 environment,localQaOnly,liveEnabled,
 verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
 allowRequest,reconcileOwnerOnly,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
   allowRequest,reconcileOwnerOnly,now].some(f=>typeof f!=='function'))
  throw Error('G59 requires private QA-only independently verified backend');
 return Object.freeze({async handle(req){
  if(!exact(req,['bearer','serviceKind','serviceId',
   'conversationId','requestKey','body'])||
   typeof req.bearer!=='string'||req.bearer.length<20||req.bearer.length>8192||
   !['RIDE','DELIVERY','MERCHANT_ORDER'].includes(req.serviceKind)||
   !id(req.serviceId)||!id(req.conversationId)||!id(req.requestKey)||
   !cleanMessage(req.body))
   return fail(400,'INVALID_RECONCILIATION');
  const started=now();
  if(!safe(started))return fail(503,'CLOCK_UNAVAILABLE');
  let actor;
  try{actor=await verifyAccessToken(req.bearer);}
  catch{return fail(401,'UNVERIFIED_JWT');}
  if(!plain(actor)||!id(actor.id)||!id(actor.sessionId)||
   !safe(actor.tokenIatMs)||actor.tokenIatMs>started||
   !safe(actor.expiresAtMs)||actor.expiresAtMs<=started||
   actor.is_anonymous===true)
   return fail(401,'UNVERIFIED_JWT');
  try{
   if(await verifySessionNotRevoked({userId:actor.id,
     sessionId:actor.sessionId,at:started})!==true)
    return fail(401,'SESSION_REVOKED');
  }catch{return fail(503,'PROVIDER_UNAVAILABLE');}
  let role;
  try{role=await resolveExclusiveRole(actor.id);}
  catch{return fail(503,'ROLE_UNAVAILABLE');}
  if(role!=='passenger')return fail(403,'PASSENGER_REQUIRED');
  try{
   if(allowRequest({userId:actor.id,operation:'CHAT_RECONCILE'})!==true)
    return fail(429,'RECONCILIATION_RATE_LIMIT');
  }catch{return fail(503,'LIMITER_UNAVAILABLE');}
  let result;
  try{
   result=await reconcileOwnerOnly(Object.freeze({
    _kind:req.serviceKind,_service:req.serviceId,
    _conversation:req.conversationId,
    _actor:actor.id,_session:actor.sessionId,_iat:actor.tokenIatMs,
    _request:req.requestKey,_body:req.body
   }));
  }catch{return fail(503,'RECONCILIATION_UNAVAILABLE');}
  const ended=now();
  if(!safe(ended)||ended<started)return fail(503,'CLOCK_UNAVAILABLE');
  if(actor.expiresAtMs<=ended)return fail(401,'SESSION_EXPIRED');
  if(!plain(result))return fail(503,'UNTRUSTED_RECONCILIATION');
  if(result.error){
   switch(result.error.code){
    case 'G5001':return fail(401,'SESSION_REVOKED');
    case 'G5003':
    case 'G5903':return fail(403,'RECONCILIATION_SCOPE_DENIED');
    case 'G5004':
    case 'G5904':return fail(409,'SERVICE_ASSIGNMENT_CHANGED');
    case 'G5902':return fail(400,'INVALID_RECONCILIATION');
    case 'G5909':return fail(409,'REQUEST_KEY_PAYLOAD_CONFLICT');
    default:return fail(503,'RECONCILIATION_UNAVAILABLE');
   }
  }
  const x=result.data;
  if(exact(x,UNKNOWN)&&x.state==='NOT_YET_OBSERVED'&&
     x.serverStored===false&&x.retrySafe===false&&
     x.reconcileAgain===true&&x.qaOnly===true&&
     x.productionEnabled===false)
   return fail(503,'OUTCOME_UNKNOWN_RECONCILE_AGAIN');
  if(!validateReceipt(x,req,ended))return fail(503,'UNTRUSTED_RECONCILIATION');
  return Object.freeze({status:200,body:Object.freeze({
   state:'COMMITTED',ack:Object.freeze({...x.ack}),
   latestRevision:x.latestRevision,
   historyRefreshRequired:x.historyRefreshRequired,
   qaOnly:true,productionEnabled:false,retrySafe:false
  })});
 }});
}
