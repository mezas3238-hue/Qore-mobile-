/**
 * G56 A38 / phase 2 — Driver-only QA adapter.
 * NOT mounted to HTTP, NOT LIVE. Caller must inject independent JWT verification,
 * provider-session revocation, exclusive role, rate limiter and non-owner
 * transactional SQL executor. Synthetic owner mints are allowed ONLY in QA.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=x=>typeof x==='string'&&UUID.test(x);
const safe=x=>Number.isSafeInteger(x)&&x>=0;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const kind=x=>['RIDE','DELIVERY','MERCHANT_ORDER'].includes(x);
const fail=(status,code)=>Object.freeze({status,body:Object.freeze({code,qaOnly:true})});
const TICKET=['ticket','operation','expiresAtMs','productionEnabled','qaOnly'];
const OPEN=['conversationId','serviceKind','serviceId','serverStored','qaOnly'];
const ACK=['conversationId','serviceId','requestKey','messageId','senderRole','body','createdAt','revision','serverStored'];
const PAGE=['conversationId','serviceId','serviceKind','ownerId','counterpartRole',
 'assignmentVerified','state','revision','generatedAt','expiresAt',
 'messages','hasMore','nextPosition','canSend','productionEnabled','qaOnly'];
const MESSAGE=['messageId','senderRole','body','createdAt','revision'];
const clean=x=>typeof x==='string'&&x.length>=1&&x.length<=500&&
 x===x.trim()&&Buffer.byteLength(x,'utf8')<=2000&&
 !/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069\u200e\u200f]/u.test(x)&&
 !/(?:https?:\/\/|www\.)/iu.test(x)&&
 !/[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu.test(x)&&
 !/(?:\+?\d[\s().-]*){7,}/u.test(x);
const validTicket=(t,op,now)=>exact(t,TICKET)&&id(t.ticket)&&
 t.operation===op&&t.qaOnly===true&&t.productionEnabled===false&&
 safe(t.expiresAtMs)&&t.expiresAtMs>now&&t.expiresAtMs<=now+20000;
const sqlError=code=>['G5601','G5001'].includes(code)?fail(401,'REVOKED_SESSION'):
 ['G5603','G5604','G5003'].includes(code)?fail(403,'DRIVER_ASSIGNMENT_DENIED'):
 ['G5605','G5609','G5004','G5009'].includes(code)?fail(409,'STALE_DRIVER_CHAT'):
 ['G5602','G5002'].includes(code)?fail(400,'INVALID_CHAT_REQUEST'):
 fail(503,'SCOPED_CHAT_UNAVAILABLE');
const sign=(secret,serialized)=>createHmac('sha256',secret).update(serialized).digest('base64url');
function seal(secret,scope,revision,beforeSeq,now){
 const body=Buffer.from(JSON.stringify({scope,revision,beforeSeq,until:now+60000})).toString('base64url');
 return body+'.'+sign(secret,body);
}
function unseal(secret,token,scope,now){
 if(typeof token!=='string'||token.length>2048||!/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(token))return null;
 const [payload,mac]=token.split('.');
 const actual=Buffer.from(sign(secret,payload),'base64url');
 const claimed=Buffer.from(mac,'base64url');
 if(claimed.length!==actual.length||!timingSafeEqual(actual,claimed))return null;
 try{
  const a=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
  if(!exact(a,['scope','revision','beforeSeq','until'])||
   JSON.stringify(a.scope)!==JSON.stringify(scope)||
   !safe(a.revision)||a.revision<1||
   !safe(a.beforeSeq)||a.beforeSeq<1||
   !safe(a.until)||a.until<=now||a.until>now+60000)return null;
  return a;
 }catch{return null;}
}
const validPage=(p,req,actor,at)=>exact(p,PAGE)&&
 p.conversationId===req.conversationId&&p.serviceKind===req.serviceKind&&
 p.serviceId===req.serviceId&&p.ownerId===actor.id&&
 p.counterpartRole==='passenger'&&p.assignmentVerified===true&&
 p.state==='ACTIVE'&&safe(p.revision)&&p.revision>=1&&
 safe(p.generatedAt)&&p.generatedAt<=at&&safe(p.expiresAt)&&p.expiresAt>at&&
 p.expiresAt<=at+60000&&p.canSend===true&&p.productionEnabled===false&&
 p.qaOnly===true&&typeof p.hasMore==='boolean'&&
 Array.isArray(p.messages)&&p.messages.length<=req.limit&&
 p.messages.every(m=>exact(m,MESSAGE)&&id(m.messageId)&&
  ['passenger','driver'].includes(m.senderRole)&&clean(m.body)&&
  safe(m.createdAt)&&m.createdAt<=at&&safe(m.revision)&&m.revision>=1)&&
 (p.hasMore?
  exact(p.nextPosition,['beforeSeq'])&&safe(p.nextPosition.beforeSeq)&&p.nextPosition.beforeSeq>0:
  p.nextPosition===null);
const validAck=(a,req,at)=>exact(a,ACK)&&a.conversationId===req.conversationId&&
 a.serviceId===req.serviceId&&a.requestKey===req.requestKey&&
 id(a.messageId)&&a.senderRole==='driver'&&a.body===req.body&&clean(a.body)&&
 safe(a.createdAt)&&a.createdAt<=at&&safe(a.revision)&&a.revision>=2&&a.serverStored===true;

export function createG56DriverScopedChatQa({
 environment,localQaOnly,liveEnabled,verifyAccessToken,
 verifySessionNotRevoked,resolveExclusiveRole,allowRequest,
 mintOwnerTicket,executeScopedTicket,cursorSecret,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
  !Buffer.isBuffer(cursorSecret)||cursorSecret.length<32||
  [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
   allowRequest,mintOwnerTicket,executeScopedTicket,now].some(f=>typeof f!=='function'))
  throw Error('G56 requires isolated QA, signed cursor and separated trusted authorities');
 async function handle(operation,req){
  const required=operation==='DRIVER_OPEN'?['bearer','serviceKind','serviceId']:
   operation==='DRIVER_SEND'?['bearer','serviceKind','serviceId','conversationId','requestKey','body']:
   ['bearer','serviceKind','serviceId','conversationId','cursor','limit'];
  if(!exact(req,required)||typeof req.bearer!=='string'||
   req.bearer.length<20||req.bearer.length>8192||!kind(req.serviceKind)||
   !id(req.serviceId)|| (operation!=='DRIVER_OPEN'&&!id(req.conversationId))||
   (operation==='DRIVER_SEND'&&(!id(req.requestKey)||!clean(req.body)))||
   (operation==='DRIVER_HISTORY'&&(
    !Number.isInteger(req.limit)||req.limit<1||req.limit>100||
    (req.cursor!==null&&typeof req.cursor!=='string'))))
   return fail(400,'INVALID_DRIVER_CHAT_REQUEST');
  const started=now();
  if(!safe(started))return fail(503,'CLOCK_UNAVAILABLE');
  let actor;
  try{actor=await verifyAccessToken(req.bearer);}catch{return fail(401,'UNVERIFIED_JWT');}
  if(!plain(actor)||!id(actor.id)||!id(actor.sessionId)||!safe(actor.tokenIatMs)||
   actor.tokenIatMs>started||!safe(actor.expiresAtMs)||
   actor.expiresAtMs<=started||actor.is_anonymous===true)
   return fail(401,'UNVERIFIED_JWT');
  try{
   if(await verifySessionNotRevoked({userId:actor.id,sessionId:actor.sessionId,at:started})!==true)
    return fail(401,'REVOKED_SESSION');
  }catch{return fail(503,'PROVIDER_UNAVAILABLE');}
  let role;
  try{role=await resolveExclusiveRole(actor.id);}catch{return fail(503,'ROLE_UNAVAILABLE');}
  if(role!=='driver')return fail(403,'EXCLUSIVE_DRIVER_REQUIRED');
  try{
   if(allowRequest({actorId:actor.id,operation})!==true)return fail(429,'DRIVER_CHAT_RATE_LIMIT');
  }catch{return fail(503,'LIMITER_UNAVAILABLE');}
  const scope={actorId:actor.id,sessionId:actor.sessionId,
   tokenIatMs:actor.tokenIatMs,serviceKind:req.serviceKind,
   serviceId:req.serviceId,conversationId:req.conversationId??null};
  const prior=operation==='DRIVER_HISTORY'&&req.cursor!==null?
   unseal(cursorSecret,req.cursor,scope,started):null;
  if(operation==='DRIVER_HISTORY'&&req.cursor!==null&&!prior)
   return fail(409,'STALE_OR_FOREIGN_CHAT_CURSOR');
  let t;
  try{t=await mintOwnerTicket({operation,actorId:actor.id,sessionId:actor.sessionId,
   tokenIatMs:actor.tokenIatMs,serviceKind:req.serviceKind,
   serviceId:req.serviceId,conversationId:req.conversationId??null});}
  catch{return fail(503,'TICKET_MINT_UNAVAILABLE');}
  const ticketAt=now();
  if(!safe(ticketAt)||ticketAt<started||actor.expiresAtMs<=ticketAt||
   !validTicket(t,operation,ticketAt))return fail(503,'INVALID_DRIVER_CHAT_TICKET');
  const command={operation,ticket:t.ticket};
  if(operation==='DRIVER_SEND'){command.requestKey=req.requestKey;command.body=req.body;}
  if(operation==='DRIVER_HISTORY'){
   command.expectedRevision=prior?.revision??null;
   command.beforeSeq=prior?.beforeSeq??null;
   command.limit=req.limit;
  }
  let r;
  try{r=await executeScopedTicket(command);}
  catch{return fail(503,'SCOPED_CHAT_UNAVAILABLE');}
  const done=now();
  if(!safe(done)||done<ticketAt)return fail(503,'CLOCK_UNAVAILABLE');
  if(done>=actor.expiresAtMs)return fail(401,'SESSION_EXPIRED');
  if(!plain(r))return fail(503,'SCOPED_CHAT_UNAVAILABLE');
  if(r.error)return sqlError(r.error.code);
  const data=r.data;
  if(operation==='DRIVER_OPEN'){
   if(!exact(data,OPEN)||!id(data.conversationId)||
    data.serviceKind!==req.serviceKind||data.serviceId!==req.serviceId||
    data.serverStored!==true||data.qaOnly!==true)
    return fail(503,'UNTRUSTED_CHAT_OPEN');
   return Object.freeze({status:200,body:Object.freeze({...data})});
  }
  if(operation==='DRIVER_SEND'){
   if(!validAck(data,req,done))return fail(503,'UNTRUSTED_DRIVER_ACK');
   return Object.freeze({status:200,body:Object.freeze({...data})});
  }
  if(!validPage(data,req,actor,done)||
   (prior!==null&&data.revision!==prior.revision))
   return fail(503,'UNTRUSTED_DRIVER_HISTORY');
  const nextCursor=data.hasMore?seal(cursorSecret,scope,data.revision,
   data.nextPosition.beforeSeq,done):null;
  const {nextPosition,hasMore,...rest}=data;
  return Object.freeze({status:200,body:Object.freeze({...rest,nextCursor})});
 }
 return Object.freeze({
  open:req=>handle('DRIVER_OPEN',req),
  history:req=>handle('DRIVER_HISTORY',req),
  send:req=>handle('DRIVER_SEND',req)
 });
}
