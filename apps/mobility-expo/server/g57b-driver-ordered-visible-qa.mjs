/**
 * G57B / A40: Driver-side ordered, explicit Passenger-message visibility.
 * QA only, NO HTTP, no LIVE; preserves G56 sealed Driver history DTO.
 * SQL G57B, not a client flag, decides whether earliest unread can advance.
 */
import {createG56DriverScopedChatQa} from './g56-driver-scoped-chat-qa.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=x=>typeof x==='string'&&UUID.test(x);
const safe=x=>Number.isSafeInteger(x)&&x>=0;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(o,k)=>plain(o)&&Object.keys(o).length===k.length&&k.every(f=>Object.hasOwn(o,f));
const error=(status,code)=>Object.freeze({status,body:Object.freeze({code,qaOnly:true})});
const TICKET=['ticket','operation','expiresAtMs','productionEnabled','qaOnly'];
const ENVELOPE=['page','readMarkers','qaOnly','productionEnabled'];
const MARKER=['marker','messageId','expiresAtMs'];
const ACK=['conversationId','messageId','readConfirmed','qaOnly'];
function check(o){
 if(o.environment!=='isolated_staging'||o.localQaOnly!==true||
  o.liveEnabled!==false||[
   o.verifyAccessToken,o.verifySessionNotRevoked,o.resolveExclusiveRole,
   o.allowRequest,o.mintOwnerTicket,o.executeScopedTicket,o.now
  ].some(f=>typeof f!=='function'))
  throw Error('G57B requires isolated Driver QA and separated Auth/SQL authorities');
}
const cap=(v,op,at)=>exact(v,TICKET)&&id(v.ticket)&&v.operation===op&&
 v.qaOnly===true&&v.productionEnabled===false&&safe(v.expiresAtMs)&&
 v.expiresAtMs>at&&v.expiresAtMs<=at+20000;

export function createG57BDriverHistoryWithOrderedMarkersQa({
 environment,localQaOnly,liveEnabled,cursorSecret,
 verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
 allowRequest,mintOwnerTicket,executeScopedTicket,now=Date.now
}={}){
 const opts={environment,localQaOnly,liveEnabled,cursorSecret,
  verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
  allowRequest,mintOwnerTicket,executeScopedTicket,now};
 check(opts);
 if(!Buffer.isBuffer(cursorSecret)||cursorSecret.length<32)
  throw Error('G57B Driver history needs HMAC cursor secret');
 return Object.freeze({async handle(req){
  let markers=null;
  const history=createG56DriverScopedChatQa({
   ...opts,executeScopedTicket:async command=>{
    if(command.operation!=='DRIVER_HISTORY')
     return executeScopedTicket(command);
    const result=await executeScopedTicket({
     ...command,operation:'DRIVER_HISTORY_ORDERED_MARKERS'});
    if(!plain(result)||result.error)return result;
    const envelope=result.data;
    if(!exact(envelope,ENVELOPE)||envelope.qaOnly!==true||
     envelope.productionEnabled!==false||!plain(envelope.page)||
     !Array.isArray(envelope.readMarkers))
     throw Error('G57B untrusted delegated Driver page');
    const messages=envelope.page.messages;
    if(!Array.isArray(messages))throw Error('G57B malformed Driver history');
    const received=messages.filter(m=>m.senderRole==='passenger')
     .map(m=>m.messageId);
    if(envelope.readMarkers.length!==received.length)
     throw Error('G57B marker coverage does not match incoming messages');
    const seen=new Set();
    for(const marker of envelope.readMarkers){
     if(!exact(marker,MARKER)||!id(marker.marker)||!id(marker.messageId)||
      !received.includes(marker.messageId)||seen.has(marker.messageId)||
      !safe(marker.expiresAtMs)||marker.expiresAtMs<=now()||
      marker.expiresAtMs>now()+60000)
      throw Error('G57B forged, expired or repeated incoming marker');
     seen.add(marker.messageId);
    }
    markers=envelope.readMarkers.map(m=>Object.freeze({...m}));
    return {data:envelope.page};
   }
  });
  const result=await history.history(req);
  if(result.status!==200)return result;
  const incoming=result.body.messages.filter(m=>m.senderRole==='passenger')
   .map(m=>m.messageId);
  if(!Array.isArray(markers)||markers.length!==incoming.length||
   markers.some(m=>!incoming.includes(m.messageId)||m.expiresAtMs<=now()))
   return error(503,'UNTRUSTED_DRIVER_VISIBILITY_MARKERS');
  return Object.freeze({status:200,body:Object.freeze({
   page:result.body,readMarkers:Object.freeze(markers),
   qaOnly:true,productionEnabled:false
  })});
 }});
}
export function createG57BDriverMarkVisibleOrderedQa({
 environment,localQaOnly,liveEnabled,
 verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
 allowRequest,mintOwnerTicket,executeScopedTicket,now=Date.now
}={}){
 check({environment,localQaOnly,liveEnabled,
 verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,allowRequest,
 mintOwnerTicket,executeScopedTicket,now});
 return Object.freeze({async handle(req){
  if(!exact(req,['bearer','conversationId','messageId','marker'])||
   typeof req.bearer!=='string'||req.bearer.length<20||req.bearer.length>8192||
   !id(req.conversationId)||!id(req.messageId)||!id(req.marker))
   return error(400,'INVALID_DRIVER_VISIBILITY_REQUEST');
  const started=now();
  if(!safe(started))return error(503,'CLOCK_UNAVAILABLE');
  let actor;
  try{actor=await verifyAccessToken(req.bearer);}
  catch{return error(401,'UNVERIFIED_JWT');}
  if(!plain(actor)||!id(actor.id)||!id(actor.sessionId)||
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
  if(role!=='driver')return error(403,'EXCLUSIVE_DRIVER_REQUIRED');
  try{
   if(allowRequest({actorId:actor.id,operation:'DRIVER_MARK_VISIBLE_ORDERED'})!==true)
    return error(429,'DRIVER_READ_RATE_LIMIT');
  }catch{return error(503,'LIMITER_UNAVAILABLE');}
  let ticket;
  try{ticket=await mintOwnerTicket({operation:'DRIVER_MARK_VISIBLE',
   actorId:actor.id,sessionId:actor.sessionId,tokenIatMs:actor.tokenIatMs,
   conversationId:req.conversationId});}
  catch{return error(503,'DRIVER_SCOPED_MINT_UNAVAILABLE');}
  const issuedAt=now();
  if(!safe(issuedAt)||issuedAt<started||actor.expiresAtMs<=issuedAt||
   !cap(ticket,'DRIVER_MARK_VISIBLE',issuedAt))
   return error(503,'UNTRUSTED_DRIVER_READ_TICKET');
  let output;
  try{output=await executeScopedTicket({
   operation:'DRIVER_MARK_VISIBLE_ORDERED',ticket:ticket.ticket,marker:req.marker
  });}catch{return error(503,'DRIVER_SCOPED_READ_UNAVAILABLE');}
  const done=now();
  if(!safe(done)||done<issuedAt)return error(503,'CLOCK_UNAVAILABLE');
  if(done>=actor.expiresAtMs)return error(401,'SESSION_EXPIRED');
  if(!plain(output))return error(503,'DRIVER_SCOPED_READ_UNAVAILABLE');
  if(output.error){
   const code=output.error.code;
   return error(['G5711','G5001','G5601'].includes(code)?401:
    ['G5713','G5003','G5603'].includes(code)?403:
    ['G5714','G5715','G5718','G5719','G5004','G5604'].includes(code)?409:
    ['G5712','G5602'].includes(code)?400:503,
    code==='G5718'?'EARLIER_UNREAD_PASSENGER_MESSAGE':
    code==='G5719'?'STALE_DRIVER_READ_MARKER':'DRIVER_ORDERED_READ_DENIED');
  }
  const value=output.data;
  if(!exact(value,ACK)||value.conversationId!==req.conversationId||
   value.messageId!==req.messageId||value.readConfirmed!==true||
   value.qaOnly!==true)return error(503,'UNTRUSTED_DRIVER_READ_ACK');
  return Object.freeze({status:200,body:Object.freeze({...value})});
 }});
}
