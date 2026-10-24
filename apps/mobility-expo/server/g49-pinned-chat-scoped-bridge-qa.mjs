/**
 * G49 / A35 — provider-pinned JWT -> independent provider session -> G42
 * private grant -> exclusive Passenger role -> owner-only QA mint -> NOLOGIN
 * delegated one-use SQL wrapper. INTERNAL QA ONLY; no HTTP server/DB login.
 *
 * A genuine provider connection and restricted DB session MUST be supplied
 * separately before real service. Do not expose this broker as an endpoint.
 */
import {createG42PinnedJwtVerifier,createG42ProviderSessionAdapters}
 from './g42-provider-pinned-jwt-auth-qa.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid=x=>typeof x==='string'&&UUID.test(x);
const safe=x=>Number.isSafeInteger(x)&&x>=0;
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(o,k)=>record(o)&&Object.keys(o).length===k.length&&k.every(n=>Object.hasOwn(o,n));
const response=(status,code)=>Object.freeze({status,body:Object.freeze({code,qaOnly:true})});
const MSG=/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069\u200e\u200f]/u;
const cleanMessage=x=>typeof x==='string'&&x.length>=1&&x.length<=500&&
 x===x.trim()&&Buffer.byteLength(x,'utf8')<=2000&&!MSG.test(x)&&
 !/(?:https?:\/\/|www\.)/iu.test(x)&&
 !/[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu.test(x)&&
 !/(?:\+?\d[\s().-]*){7,}/u.test(x);
const OPERATIONS=['CHAT_OPEN','CHAT_HISTORY','CHAT_SEND'];
const TICKET=['ticket','operation','expiresAtMs','productionEnabled','qaOnly'];
const OPEN=['conversationId','serviceKind','serviceId','serverStored','qaOnly'];
const ACK=['conversationId','serviceId','requestKey','messageId','senderRole','body','createdAt','revision','serverStored'];
const HIST=['conversationId','serviceId','serviceKind','ownerId','counterpartRole',
 'assignmentVerified','state','revision','generatedAt','expiresAt','messages',
 'hasMore','nextPosition','canSend','productionEnabled','qaOnly'];
function validReceipt(operation,x,req,actor,at){
 if(operation==='CHAT_OPEN')return exact(x,OPEN)&&uuid(x.conversationId)&&
  x.serviceId===req.serviceId&&x.serviceKind===req.serviceKind&&
  x.serverStored===true&&x.qaOnly===true;
 if(operation==='CHAT_SEND')return exact(x,ACK)&&uuid(x.messageId)&&
  x.conversationId===req.conversationId&&x.serviceId===req.serviceId&&
  x.requestKey===req.requestKey&&x.senderRole==='passenger'&&
  x.body===req.body&&x.serverStored===true&&safe(x.createdAt)&&
  x.createdAt<=at&&safe(x.revision)&&x.revision>=2;
 return exact(x,HIST)&&x.conversationId===req.conversationId&&
  x.serviceId===req.serviceId&&x.serviceKind===req.serviceKind&&
  x.ownerId===actor&&x.counterpartRole==='driver'&&
  x.state==='ACTIVE'&&x.assignmentVerified===true&&
  x.canSend===true&&x.productionEnabled===false&&x.qaOnly===true&&
  safe(x.revision)&&x.revision>=1&&safe(x.generatedAt)&&
  x.generatedAt<=at&&safe(x.expiresAt)&&x.expiresAt>at&&
  x.expiresAt<=at+300000&&Array.isArray(x.messages)&&
  x.messages.length<=req.limit&&typeof x.hasMore==='boolean'&&
  (x.hasMore?record(x.nextPosition)&&safe(x.nextPosition.beforeSeq)
   :x.nextPosition===null);
}
export function createG49PinnedChatBridgeQa({
 environment,localQaOnly,liveEnabled,issuer,audience,publicKeys,
 readProviderUser,readProviderSession,readPrivateSessionGrant,
 resolveExclusiveRole,allowRequest,mintOwnerTicket,executeScopedTicket,
 now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||
  liveEnabled!==false||[
   readProviderUser,readProviderSession,readPrivateSessionGrant,
   resolveExclusiveRole,allowRequest,mintOwnerTicket,executeScopedTicket,now
  ].some(fn=>typeof fn!=='function'))
  throw Error('G49 requires isolated QA and independent provider/DB sources');
 const verifyJwt=createG42PinnedJwtVerifier({issuer,audience,publicKeys,now});
 const auth=createG42ProviderSessionAdapters({
  environment,localQaOnly,liveEnabled,verifyJwt,
  readProviderUser,readProviderSession,readPrivateSessionGrant,now
 });
 return Object.freeze({async handle(req){
  if(!exact(req,['bearer','operation','serviceKind','serviceId',
   'conversationId','requestKey','body','expectedRevision','beforeSeq','limit'])||
   typeof req.bearer!=='string'||req.bearer.length<100||req.bearer.length>8192||
   !OPERATIONS.includes(req.operation)||
   !['RIDE','DELIVERY','MERCHANT_ORDER'].includes(req.serviceKind)||
   !uuid(req.serviceId)||
   (req.operation==='CHAT_OPEN'&&(req.conversationId!==null||
    req.requestKey!==null||req.body!==null||req.expectedRevision!==null||
    req.beforeSeq!==null||req.limit!==null))||
   (req.operation==='CHAT_SEND'&&(!uuid(req.conversationId)||
    !uuid(req.requestKey)||!cleanMessage(req.body)||
    req.expectedRevision!==null||req.beforeSeq!==null||req.limit!==null))||
   (req.operation==='CHAT_HISTORY'&&(!uuid(req.conversationId)||
    req.requestKey!==null||req.body!==null||
    !Number.isSafeInteger(req.limit)||req.limit<1||req.limit>100||
    !(req.expectedRevision===null||
     safe(req.expectedRevision)&&req.expectedRevision>0)||
    !(req.beforeSeq===null||safe(req.beforeSeq)&&req.beforeSeq>0)||
    (req.beforeSeq===null)!==(req.expectedRevision===null)))
  )return response(400,'INVALID_SCOPED_CHAT_REQUEST');
  const at=now();
  if(!safe(at))return response(503,'CLOCK_UNAVAILABLE');
  let actor;
  try{actor=await auth.verifyAccessToken(req.bearer);}
  catch{return response(401,'PROVIDER_OR_SESSION_UNVERIFIED');}
  if(!record(actor)||!uuid(actor.id)||!uuid(actor.sessionId)||
   !safe(actor.tokenIatMs)||actor.tokenIatMs>at||
   !safe(actor.expiresAtMs)||actor.expiresAtMs<=at)
   return response(401,'PROVIDER_OR_SESSION_UNVERIFIED');
  // Re-read provider revocation immediately before mint, never trust JWT role.
  try{
   if(await auth.verifySessionNotRevoked({
    userId:actor.id,sessionId:actor.sessionId,at})!==true)
    return response(401,'PROVIDER_SESSION_REVOKED');
  }catch{return response(503,'PROVIDER_UNAVAILABLE');}
  let role;
  try{role=await resolveExclusiveRole(actor.id);}
  catch{return response(503,'ROLE_AUTHORITY_UNAVAILABLE');}
  if(role!=='passenger')return response(403,'PASSENGER_REQUIRED');
  try{
   if(allowRequest({actorId:actor.id,operation:req.operation})!==true)
    return response(429,'SCOPED_CHAT_RATE_LIMIT');
  }catch{return response(503,'LIMITER_UNAVAILABLE');}
  // This is intentionally a trusted owner-injected *synthetic* mint. It
  // cannot be driven by unverified HTTP UUIDs or service_role.
  let minted;
  try{minted=await mintOwnerTicket({
   actorId:actor.id,sessionId:actor.sessionId,tokenIatMs:actor.tokenIatMs,
   operation:req.operation,serviceKind:req.serviceKind,
   serviceId:req.serviceId,conversationId:req.conversationId
  });}catch{return response(503,'SCOPED_TICKET_MINT_UNAVAILABLE');}
  const afterMint=now();
  if(!safe(afterMint)||afterMint<at)return response(503,'CLOCK_UNAVAILABLE');
  if(!exact(minted,TICKET)||!uuid(minted.ticket)||
   minted.operation!==req.operation||minted.productionEnabled!==false||
   minted.qaOnly!==true||!safe(minted.expiresAtMs)||
   minted.expiresAtMs<=afterMint||minted.expiresAtMs>afterMint+20000||
   afterMint>=actor.expiresAtMs)
   return response(503,'INVALID_SCOPED_TICKET');
  let delegated;
  try{delegated=await executeScopedTicket({
   operation:req.operation,ticket:minted.ticket,
   ...(req.operation==='CHAT_SEND'?{requestKey:req.requestKey,body:req.body}:{}),
   ...(req.operation==='CHAT_HISTORY'?{
    expectedRevision:req.expectedRevision,beforeSeq:req.beforeSeq,limit:req.limit
   }:{})
  });}catch{return response(503,'SCOPED_DATABASE_UNAVAILABLE');}
  const done=now();
  if(!safe(done)||done<afterMint)return response(503,'CLOCK_UNAVAILABLE');
  if(done>=actor.expiresAtMs)return response(401,'SESSION_EXPIRED');
  if(!record(delegated))return response(503,'SCOPED_DATABASE_UNAVAILABLE');
  if(delegated.error){
   const code=delegated.error.code;
   if(['G4901','G5001'].includes(code))return response(401,'SESSION_REVOKED');
   if(['G4903','G5003','G5303'].includes(code))
    return response(403,'ROLE_OR_ASSIGNMENT_REVOKED');
   if(['G4902','G5002','G5302','G5202'].includes(code))
    return response(400,'INVALID_SCOPED_CHAT_REQUEST');
   if(['G4904','G4905','G5004','G5009','G5209','G5304'].includes(code))
    return response(409,'SCOPED_CHAT_CONFLICT');
   return response(503,'SCOPED_DATABASE_UNAVAILABLE');
  }
  if(!validReceipt(req.operation,delegated.data,req,actor.id,done))
   return response(503,'UNTRUSTED_SCOPED_CHAT_RECEIPT');
  return Object.freeze({status:200,body:Object.freeze(delegated.data)});
 }});
}
