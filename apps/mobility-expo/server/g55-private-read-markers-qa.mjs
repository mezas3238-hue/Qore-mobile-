/**
 * G55 A37: private server-issued read markers, composable with sealed G52
 * Cliente B history DTO without ever exposing message.seq in the mobile app.
 * No HTTPS, production, issuer connection or real DB executor.
 */
import {createG52ChatHistoryQa} from './g52-chat-history-qa.mjs';
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=x=>typeof x==='string'&&ID.test(x);
const safe=x=>Number.isSafeInteger(x)&&x>=0;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const error=(status,code)=>Object.freeze({status,body:Object.freeze({code,qaOnly:true})});
const TICKET=['ticket','operation','expiresAtMs','productionEnabled','qaOnly'];
const OFFER=['page','readMarker','qaOnly','productionEnabled'];
const MARKER=['marker','messageId','expiresAtMs'];
const READ=['conversationId','messageId','qaOnly','readConfirmed','readThrough'];
function validTicket(x,op,at){
 return exact(x,TICKET)&&id(x.ticket)&&x.operation===op&&
  x.qaOnly===true&&x.productionEnabled===false&&safe(x.expiresAtMs)&&
  x.expiresAtMs>at&&x.expiresAtMs<=at+20000;
}
const verifyBoundary=x=>{
 if(x.environment!=='isolated_staging'||x.localQaOnly!==true||
  x.liveEnabled!==false||[
   x.verifyAccessToken,x.verifySessionNotRevoked,x.resolveExclusiveRole,
   x.allowRequest,x.mintOwnerTicket,x.executeScopedTicket,x.now
  ].some(f=>typeof f!=='function'))
  throw Error('G55 requires isolated trusted provider and delegated SQL authorities');
};
export function createG55HistoryWithReadMarkerQa({
 environment,localQaOnly,liveEnabled,cursorSecret,
 verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
 allowRequest,mintOwnerTicket,executeScopedTicket,now=Date.now
}={}){
 const opts={environment,localQaOnly,liveEnabled,verifyAccessToken,
  verifySessionNotRevoked,resolveExclusiveRole,allowRequest,
  mintOwnerTicket,executeScopedTicket,now};
 verifyBoundary(opts);
 let readMarker=null;
 // G52 signs cursors and independently authenticates every page; only the
 // database operation is replaced with G49/G55 scoped bearer capabilities.
 const base=createG52ChatHistoryQa({...opts,cursorSecret,
  rpc:async(name,args)=>{
   const operation=name==='mobility_stage_g50_open_owner_qa'?'CHAT_OPEN':
    name==='mobility_stage_g52_history_owner_qa'?'CHAT_HISTORY':null;
   if(!operation||!obj(args))throw Error('G55 unsafe RPC escape');
   const actorId=operation==='CHAT_OPEN'?args._actor:args._actor;
   const sessionId=args._session,tokenIatMs=args._iat;
   const serviceKind=operation==='CHAT_OPEN'?args._kind:null;
   const serviceId=operation==='CHAT_OPEN'?args._service:null;
   let supplied={operation,actorId,sessionId,tokenIatMs};
   if(operation==='CHAT_OPEN'){
    supplied={...supplied,serviceKind,serviceId,conversationId:null};
   }else{
    // G55 history mint is bound to the already pinned G50 conversation.
    // Trusted SQL mint resolves serviceKind/serviceId from conversation;
    // caller never chooses another user's thread.
    supplied={...supplied,conversationId:args._conversation};
   }
   if(!id(actorId)||!id(sessionId)||!safe(tokenIatMs)||
    operation==='CHAT_OPEN'&&(!id(serviceId)||![
     'RIDE','DELIVERY','MERCHANT_ORDER'].includes(serviceKind))||
    operation==='CHAT_HISTORY'&&!id(args._conversation))
    throw Error('G55 invalid identity/scope');
   const ticket=await mintOwnerTicket(supplied);
   if(!validTicket(ticket,operation,now()))throw Error('G55 untrusted ticket');
   const delegated=await executeScopedTicket(
    operation==='CHAT_OPEN'?
    {operation,ticket:ticket.ticket}:
    {operation:'CHAT_HISTORY_MARKER',ticket:ticket.ticket,
     expectedRevision:args._expected_revision,
     beforeSeq:args._before_seq,limit:args._limit});
   if(!obj(delegated)||delegated.error)return delegated;
   if(operation==='CHAT_OPEN')return delegated;
   const envelope=delegated.data;
   if(!exact(envelope,OFFER)||envelope.qaOnly!==true||
    envelope.productionEnabled!==false||!obj(envelope.page))
    throw Error('G55 corrupted delegated history');
   const marker=envelope.readMarker;
   if(marker!==null&&(!exact(marker,MARKER)||!id(marker.marker)||
    !id(marker.messageId)||!safe(marker.expiresAtMs)||
    marker.expiresAtMs<=now()||marker.expiresAtMs>now()+60000||
    !Array.isArray(envelope.page.messages)||
    !envelope.page.messages.some(m=>m.messageId===marker.messageId&&
      m.senderRole==='driver')))
    throw Error('G55 marker not bound to returned driver message');
   if(marker===null&&Array.isArray(envelope.page.messages)&&
    envelope.page.messages.some(m=>m.senderRole==='driver'))
    throw Error('G55 missing marker for returned driver message');
   readMarker=marker===null?null:Object.freeze({...marker});
   return {data:envelope.page};
  }
 });
 return Object.freeze({async handle(req){
  readMarker=null;
  const page=await base.handle(req);
  if(page.status!==200)return page;
  if(readMarker&&(!page.body.messages.some(m=>m.messageId===readMarker.messageId&&
     m.senderRole==='driver')||readMarker.expiresAtMs<=now()))
   return error(503,'INVALID_HISTORY_READ_MARKER');
  return Object.freeze({status:200,body:Object.freeze({
   page:page.body,readMarker,qaOnly:true,productionEnabled:false
  })});
 }});
}
/** Explicit UI visibility acknowledgement only; not an on-page-load side effect.
 * G54 CHAT_READ ticket pins verified actor + conversation + session; G55 SQL
 * verifies marker belongs to identical actor/session and a previously issued
 * G52 history page before deriving m.seq privately.
 */
export function createG55MarkVisibleMessageQa({
 environment,localQaOnly,liveEnabled,verifyAccessToken,
 verifySessionNotRevoked,resolveExclusiveRole,allowRequest,
 mintOwnerTicket,executeScopedTicket,now=Date.now
}={}){
 verifyBoundary({environment,localQaOnly,liveEnabled,verifyAccessToken,
  verifySessionNotRevoked,resolveExclusiveRole,allowRequest,
  mintOwnerTicket,executeScopedTicket,now});
 return Object.freeze({async handle(req){
  if(!exact(req,['bearer','conversationId','marker'])||
   typeof req.bearer!=='string'||req.bearer.length<20||
   req.bearer.length>8192||!id(req.conversationId)||!id(req.marker))
   return error(400,'INVALID_VISIBLE_READ_REQUEST');
  const started=now();
  if(!safe(started))return error(503,'CLOCK_UNAVAILABLE');
  let actor;
  try{actor=await verifyAccessToken(req.bearer);}
  catch{return error(401,'UNVERIFIED_JWT');}
  if(!obj(actor)||!id(actor.id)||!id(actor.sessionId)||
   !safe(actor.tokenIatMs)||actor.tokenIatMs>started||
   !safe(actor.expiresAtMs)||actor.expiresAtMs<=started||
   actor.is_anonymous===true)return error(401,'UNVERIFIED_JWT');
  try{
   if(await verifySessionNotRevoked({
    userId:actor.id,sessionId:actor.sessionId,at:started})!==true)
    return error(401,'REVOKED_SESSION');
  }catch{return error(503,'PROVIDER_UNAVAILABLE');}
  let role;
  try{role=await resolveExclusiveRole(actor.id);}
  catch{return error(503,'ROLE_UNAVAILABLE');}
  if(role!=='passenger')return error(403,'PASSENGER_REQUIRED');
  try{
   if(allowRequest({actorId:actor.id,operation:'CHAT_MARK_VISIBLE'})!==true)
    return error(429,'READ_RATE_LIMIT');
  }catch{return error(503,'LIMITER_UNAVAILABLE');}
  let ticket;
  try{ticket=await mintOwnerTicket({
   operation:'CHAT_READ',actorId:actor.id,sessionId:actor.sessionId,
   tokenIatMs:actor.tokenIatMs,conversationId:req.conversationId
  });}catch{return error(503,'SCOPED_MINT_UNAVAILABLE');}
  const afterMint=now();
  if(!safe(afterMint)||afterMint<started||!validTicket(ticket,'CHAT_READ',afterMint))
   return error(503,'INVALID_SCOPED_TICKET');
  let out;
  try{out=await executeScopedTicket({
   operation:'CHAT_MARK_VISIBLE',ticket:ticket.ticket,marker:req.marker
  });}catch{return error(503,'SCOPED_READ_UNAVAILABLE');}
  const completed=now();
  if(!safe(completed)||completed<afterMint)return error(503,'CLOCK_UNAVAILABLE');
  if(completed>=actor.expiresAtMs)return error(401,'SESSION_EXPIRED');
  if(!obj(out))return error(503,'SCOPED_READ_UNAVAILABLE');
  if(out.error){
   const code=out.error.code;
   return error(['G5401','G5001'].includes(code)?401:
    ['G5403','G5003'].includes(code)?403:
    ['G5404','G5405','G5505','G5004'].includes(code)?409:
    ['G5402','G5502'].includes(code)?400:503,
    'SCOPED_MARKER_DENIED');
  }
  const data=out.data;
  if(!exact(data,READ)||data.conversationId!==req.conversationId||
   !id(data.messageId)||data.qaOnly!==true||
   data.readConfirmed!==true||!safe(data.readThrough))
   return error(503,'UNTRUSTED_VISIBLE_RECEIPT');
  // Message seq is intentionally NOT returned to Cliente B.
  return Object.freeze({status:200,body:Object.freeze({
   conversationId:data.conversationId,messageId:data.messageId,
   readConfirmed:true,qaOnly:true
  })});
 }});
}
