/**
 * G57 A39 — Passenger read acknowledgement with no skipped incoming messages.
 * QA only: explicit UI callback must supply the exact G52 visible messageId
 * plus its server-issued G57 marker. No network routes, LIVE or actual viewport
 * verification. PostgreSQL is final authority for FIRST unread Driver message.
 */
import {createG52ChatHistoryQa} from './g52-chat-history-qa.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=x=>typeof x==='string'&&UUID.test(x);
const safe=x=>Number.isSafeInteger(x)&&x>=0;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(o,keys)=>plain(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const deny=(status,code)=>Object.freeze({status,body:Object.freeze({code,qaOnly:true})});
const TICKET=['ticket','operation','expiresAtMs','productionEnabled','qaOnly'];
const ENVELOPE=['page','readMarkers','qaOnly','productionEnabled'];
const MARKER=['marker','messageId','expiresAtMs'];
const CONFIRM=['conversationId','messageId','readConfirmed','qaOnly'];
function setup(o){
 if(o.environment!=='isolated_staging'||o.localQaOnly!==true||
  o.liveEnabled!==false||
  [o.verifyAccessToken,o.verifySessionNotRevoked,o.resolveExclusiveRole,
   o.allowRequest,o.mintOwnerTicket,o.executeScopedTicket,o.now]
   .some(f=>typeof f!=='function'))
  throw Error('G57 requires isolated trusted authorities and SQL delegated execution');
}
function validTicket(t,op,at){
 return exact(t,TICKET)&&id(t.ticket)&&t.operation===op&&
 t.productionEnabled===false&&t.qaOnly===true&&
 safe(t.expiresAtMs)&&t.expiresAtMs>at&&t.expiresAtMs<=at+20000;
}
export function createG57OrderedHistoryQa({
 environment,localQaOnly,liveEnabled,cursorSecret,
 verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
 allowRequest,mintOwnerTicket,executeScopedTicket,now=Date.now
}={}){
 const opts={environment,localQaOnly,liveEnabled,
 verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
 allowRequest,mintOwnerTicket,executeScopedTicket,now};
 setup(opts);
 if(!Buffer.isBuffer(cursorSecret)||cursorSecret.length<32)
  throw Error('G57 requires G52 HMAC cursor secret >=32 bytes');
 return Object.freeze({async handle(req){
  let issued=null;
  const history=createG52ChatHistoryQa({...opts,cursorSecret,
   rpc:async(name,args)=>{
    const op=name==='mobility_stage_g50_open_owner_qa'?'CHAT_OPEN':
     name==='mobility_stage_g52_history_owner_qa'?'CHAT_HISTORY':null;
    if(!op||!plain(args))throw Error('G57 unauthorized RPC operation');
    const mint={operation:op,actorId:args._actor,sessionId:args._session,
     tokenIatMs:args._iat,
     serviceKind:op==='CHAT_OPEN'?args._kind:req.serviceKind,
     serviceId:op==='CHAT_OPEN'?args._service:req.serviceId,
     conversationId:op==='CHAT_OPEN'?null:args._conversation};
    if(!id(mint.actorId)||!id(mint.sessionId)||!safe(mint.tokenIatMs)||
     !id(mint.serviceId)||!['RIDE','DELIVERY','MERCHANT_ORDER'].includes(mint.serviceKind)||
     (op==='CHAT_HISTORY'&&!id(mint.conversationId)))
     throw Error('G57 invalid provider-attested scope');
    const cap=await mintOwnerTicket(mint);
    if(!validTicket(cap,op,now()))throw Error('G57 invalid owner ticket');
    const result=await executeScopedTicket(op==='CHAT_OPEN'?
     {operation:op,ticket:cap.ticket}:
     {operation:'CHAT_HISTORY_ORDERED_MARKERS',ticket:cap.ticket,
      expectedRevision:args._expected_revision,beforeSeq:args._before_seq,
      limit:args._limit});
    if(!plain(result)||result.error)return result;
    if(op==='CHAT_OPEN')return result;
    const data=result.data;
    if(!exact(data,ENVELOPE)||data.qaOnly!==true||
     data.productionEnabled!==false||!plain(data.page)||
     !Array.isArray(data.readMarkers))throw Error('G57 untrusted page envelope');
    const incoming=data.page.messages;
    if(!Array.isArray(incoming))throw Error('G57 invalid history');
    const ids=incoming.filter(m=>m.senderRole==='driver').map(m=>m.messageId);
    const seen=new Set();
    if(data.readMarkers.length!==ids.length)throw Error('G57 missing incoming markers');
    for(const mark of data.readMarkers){
     if(!exact(mark,MARKER)||!id(mark.marker)||!id(mark.messageId)||
      !ids.includes(mark.messageId)||seen.has(mark.messageId)||
      !safe(mark.expiresAtMs)||mark.expiresAtMs<=now()||
      mark.expiresAtMs>now()+60000)
      throw Error('G57 forged marker or repeated incoming message');
     seen.add(mark.messageId);
    }
    issued=data.readMarkers.map(mark=>Object.freeze({...mark}));
    return {data:data.page};
   }
  });
  const read=await history.handle(req);
  if(read.status!==200)return read;
  const ids=read.body.messages.filter(m=>m.senderRole==='driver').map(m=>m.messageId);
  if(!Array.isArray(issued)||issued.length!==ids.length||
   issued.some(m=>!ids.includes(m.messageId)||m.expiresAtMs<=now()))
   return deny(503,'INVALID_ORDERED_VISIBLE_MARKERS');
  return Object.freeze({status:200,body:Object.freeze({
   page:read.body,readMarkers:Object.freeze(issued),qaOnly:true,productionEnabled:false
  })});
 }});
}
export function createG57MarkVisibleOrderedQa({
 environment,localQaOnly,liveEnabled,
 verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
 allowRequest,mintOwnerTicket,executeScopedTicket,now=Date.now
}={}){
 setup({environment,localQaOnly,liveEnabled,verifyAccessToken,
  verifySessionNotRevoked,resolveExclusiveRole,allowRequest,
  mintOwnerTicket,executeScopedTicket,now});
 return Object.freeze({async handle(req){
  if(!exact(req,['bearer','conversationId','messageId','marker'])||
   typeof req.bearer!=='string'||req.bearer.length<20||req.bearer.length>8192||
   !id(req.conversationId)||!id(req.messageId)||!id(req.marker))
   return deny(400,'INVALID_EXPLICIT_VISIBILITY_REQUEST');
  const started=now();
  if(!safe(started))return deny(503,'CLOCK_UNAVAILABLE');
  let actor;
  try{actor=await verifyAccessToken(req.bearer);}
  catch{return deny(401,'UNVERIFIED_JWT');}
  if(!plain(actor)||!id(actor.id)||!id(actor.sessionId)||
   !safe(actor.tokenIatMs)||actor.tokenIatMs>started||
   !safe(actor.expiresAtMs)||actor.expiresAtMs<=started||
   actor.is_anonymous===true)return deny(401,'UNVERIFIED_JWT');
  try{
   if(await verifySessionNotRevoked({userId:actor.id,
    sessionId:actor.sessionId,at:started})!==true)
    return deny(401,'REVOKED_SESSION');
  }catch{return deny(503,'PROVIDER_UNAVAILABLE');}
  let role;
  try{role=await resolveExclusiveRole(actor.id);}
  catch{return deny(503,'ROLE_UNAVAILABLE');}
  if(role!=='passenger')return deny(403,'PASSENGER_REQUIRED');
  try{
   if(allowRequest({actorId:actor.id,operation:'CHAT_MARK_VISIBLE_ORDERED'})!==true)
    return deny(429,'READ_RATE_LIMIT');
  }catch{return deny(503,'LIMITER_UNAVAILABLE');}
  let cap;
  try{cap=await mintOwnerTicket({
   operation:'CHAT_READ',actorId:actor.id,sessionId:actor.sessionId,
   tokenIatMs:actor.tokenIatMs,conversationId:req.conversationId
  });}catch{return deny(503,'SCOPED_MINT_UNAVAILABLE');}
  const ticketAt=now();
  if(!safe(ticketAt)||ticketAt<started||actor.expiresAtMs<=ticketAt||
   !validTicket(cap,'CHAT_READ',ticketAt))
   return deny(503,'INVALID_SCOPED_TICKET');
  let response;
  try{response=await executeScopedTicket({
   operation:'CHAT_MARK_VISIBLE_ORDERED',ticket:cap.ticket,marker:req.marker
  });}catch{return deny(503,'SCOPED_READ_UNAVAILABLE');}
  const done=now();
  if(!safe(done)||done<ticketAt)return deny(503,'CLOCK_UNAVAILABLE');
  if(done>=actor.expiresAtMs)return deny(401,'SESSION_EXPIRED');
  if(!plain(response))return deny(503,'SCOPED_READ_UNAVAILABLE');
  if(response.error){
   const code=response.error.code;
   return deny(['G5401','G5001'].includes(code)?401:
    ['G5403','G5003'].includes(code)?403:
    ['G5404','G5405','G5705','G5708','G5709','G5004'].includes(code)?409:
    ['G5402','G5702'].includes(code)?400:503,
    code==='G5708'?'EARLIER_UNREAD_MESSAGE':
    code==='G5709'?'STALE_READ_MARKER':'SCOPED_ORDERED_READ_DENIED');
  }
  const data=response.data;
  if(!exact(data,CONFIRM)||data.conversationId!==req.conversationId||
   data.messageId!==req.messageId||data.readConfirmed!==true||
   data.qaOnly!==true)return deny(503,'UNTRUSTED_READ_ACK');
  return Object.freeze({status:200,body:Object.freeze({...data})});
 }});
}
