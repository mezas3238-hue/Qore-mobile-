import {readBoundedResponseText} from './bounded-http-response.mjs';

/**
 * GET de historial G52. Contrato A (OpenAPI g52) todavía NO montado.
 * Cero red por defecto y NUNCA simula POST/ACK ni permisos de envío.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR=/^[A-Za-z0-9_.-]{44,384}$/;
const BEARER=/^[A-Za-z0-9._~+/-]{20,8192}={0,2}$/;
const KINDS=new Set(['RIDE','DELIVERY','MERCHANT_ORDER']);
const ROLES=new Set(['passenger','driver']);
const FIELDS=['conversationId','serviceId','serviceKind','ownerId',
 'counterpartRole','assignmentVerified','state','revision','generatedAt',
 'expiresAt','messages','nextCursor','canSend','productionEnabled'];
const MESSAGE=['messageId','senderRole','body','createdAt','revision'];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(o,keys)=>object(o)&&Object.keys(o).length===keys.length
 &&keys.every(k=>Object.hasOwn(o,k));
const uuid=x=>typeof x==='string'&&UUID.test(x);
const int=n=>Number.isSafeInteger(n)&&n>=0;
const fail=(code,status=0)=>Object.freeze({ok:false,code,status});
const same=(a,b)=>a.subject===b.subject&&a.token===b.token
 &&a.role===b.role&&a.authRevision===b.authRevision
 &&a.sessionRevision===b.sessionRevision&&a.expiresAt===b.expiresAt;
function origin(input){
 try{
  if(typeof input!=='string'||input.includes('\\'))return null;
  const u=new URL(input);
  return u.protocol==='https:'&&!u.username&&!u.password
   &&!u.search&&!u.hash&&!u.port&&u.pathname==='/'
   &&!u.hostname.endsWith('.')?u.origin:null;
 }catch{return null;}
}
const sessionValid=(s,clock)=>object(s)&&s.role==='passenger'
 &&uuid(s.subject)&&typeof s.token==='string'&&BEARER.test(s.token)
 &&int(s.authRevision)&&int(s.sessionRevision)
 &&Number.isSafeInteger(s.expiresAt)&&s.expiresAt>clock+1000;
const bodyValid=s=>typeof s==='string'&&s.length>=1&&s.length<=500
 &&s===s.trim()&&s.trim().length>=1
 &&!/[\u0000-\u001f\u007f<>]/u.test(s)
 &&!/(?:https?:\/\/|www\.)/i.test(s)
 &&!/[\u202a-\u202e\u2066-\u2069\u200e\u200f]/u.test(s)
 &&!/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/u.test(s)
 &&!/(?:\+?\d[\s().-]*){7,}/u.test(s);
function verifyPage(dto,{serviceId,serviceKind,subject,conversationId,clock,cursor}){
 if(!exact(dto,FIELDS)||!uuid(dto.conversationId)
  ||conversationId!==null&&dto.conversationId!==conversationId
  ||dto.serviceId!==serviceId||dto.serviceKind!==serviceKind
  ||dto.ownerId!==subject||dto.counterpartRole!=='driver'
  ||dto.assignmentVerified!==true||dto.state!=='ACTIVE'
  ||dto.canSend!==true||dto.productionEnabled!==false
  ||!int(dto.revision)||dto.revision<1
  ||!int(dto.generatedAt)||dto.generatedAt>clock
  ||dto.generatedAt<clock-300000
  ||!int(dto.expiresAt)||dto.expiresAt<=clock
  ||dto.expiresAt>clock+300000||dto.expiresAt<=dto.generatedAt
  ||!Array.isArray(dto.messages)||dto.messages.length>100
  ||!(dto.nextCursor===null||(typeof dto.nextCursor==='string'
   &&CURSOR.test(dto.nextCursor)))
  ||dto.nextCursor!==null&&dto.nextCursor===cursor
  ||dto.messages.length===0&&dto.nextCursor!==null)return null;
 const messages=[],seen=new Set();
 for(const item of dto.messages){
  if(!exact(item,MESSAGE)||!uuid(item.messageId)
   ||!ROLES.has(item.senderRole)||!bodyValid(item.body)
   ||!int(item.createdAt)||item.createdAt>clock
   ||!int(item.revision)||item.revision>dto.revision
   ||seen.has(item.messageId)
   ||messages.length>0&&item.createdAt>messages[messages.length-1].createdAt)
   return null;
  seen.add(item.messageId);
  messages.push(Object.freeze({...item}));
 }
 return Object.freeze({...dto,messages:Object.freeze(messages)});
}
const statusCode=status=>({
 400:'INVALID_OR_EXPIRED_CURSOR',401:'AUTH_REQUIRED',403:'FORBIDDEN',
 404:'NOT_FOUND',409:'CHAT_HISTORY_REVISION_CHANGED',429:'RATE_LIMITED',
 503:'SERVICE_UNAVAILABLE'
})[status]??'UNTRUSTED_CHAT_HISTORY_RESPONSE';

export function createG52ChatHistoryHttpGateway({
 enabled=false,contractCertified=false,stagingRuntimeVerified=false,
 origin:remoteOrigin,pinnedOrigin,getSession,fetchImpl,
 onSessionInvalid=()=>{},now=()=>Date.now(),timeoutMs=8000,
 maxBytes=262144
}={}){
 const host=origin(remoteOrigin),pin=origin(pinnedOrigin);
 const ready=enabled===true&&contractCertified===true
  &&stagingRuntimeVerified===true&&host!==null&&host===pin
  &&typeof getSession==='function'&&typeof fetchImpl==='function';
 let generation=0,active=null;
 function cancelPending(){
  generation++;
  try{active?.abort();}catch{}
  active=null;
 }
 async function readMessages({serviceId,serviceKind,cursor=null,
  expectedConversationId=null,subject,sessionRevision}={}){
  if(!ready)return fail('G52_RUNTIME_NOT_CERTIFIED');
  if(!uuid(serviceId)||!KINDS.has(serviceKind)||!uuid(subject)
   ||!int(sessionRevision)
   ||!(cursor===null||(typeof cursor==='string'&&CURSOR.test(cursor)))
   ||!(expectedConversationId===null||uuid(expectedConversationId)))
   return fail('INVALID_CHAT_HISTORY_QUERY');
  if(active!==null)return fail('CHAT_HISTORY_READ_IN_FLIGHT');
  const controller=new AbortController(),started=generation;
  active=controller;
  let timeout=null;
  try{
   let before;try{before=await getSession();}catch{return fail('AUTH_UNAVAILABLE');}
   if(started!==generation)return fail('STALE_SESSION_RESPONSE');
   if(!sessionValid(before,now()))return fail('AUTH_REQUIRED');
   if(before.subject!==subject||before.sessionRevision!==sessionRevision)
    return fail('STALE_SESSION_RESPONSE');
   const ms=int(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=30000?timeoutMs:8000;
   const deadline=now()+ms;
   timeout=setTimeout(()=>controller.abort(),ms);
   const expired=()=>controller.signal.aborted||now()>=deadline;
   const params='limit=100'+(expectedConversationId===null?''
    :'&expectedConversationId='+encodeURIComponent(expectedConversationId));
   const url=host+'/v1/staging/chat/services/'
    +encodeURIComponent(serviceKind)+'/'+encodeURIComponent(serviceId)
    +'/messages?'+params;
   const headers={Authorization:'Bearer '+before.token,Accept:'application/json'};
   if(cursor!==null)headers['X-Qore-Chat-History-Cursor']=cursor;
   const response=await fetchImpl(url,{
    method:'GET',credentials:'omit',redirect:'error',
    cache:'no-store',referrerPolicy:'no-referrer',
    headers,signal:controller.signal
   });
   if(started!==generation)return fail('STALE_SESSION_RESPONSE');
   if(expired())return fail('NETWORK_OR_TIMEOUT');
   if(!response||response.redirected===true)return fail('UNTRUSTED_REDIRECT');
   if(response.status===401||response.status===403){
    let after;try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
    if(started!==generation)return fail('STALE_SESSION_RESPONSE');
    if(expired())return fail('NETWORK_OR_TIMEOUT');
    if(!sessionValid(after,now())||!same(before,after))
     return fail('STALE_SESSION_RESPONSE');
    try{onSessionInvalid();}catch{}
    return fail(statusCode(response.status),response.status);
   }
   if(response.status!==200||response.ok!==true)
    return fail(statusCode(response.status),response.status);
   if(!/^application\/json(?:\s*;|$)/i.test(
    response.headers?.get?.('content-type')??''))
    return fail('BAD_CONTENT_TYPE');
   const limit=int(maxBytes)&&maxBytes>=1024&&maxBytes<=524288
    ?maxBytes:262144;
   const length=response.headers?.get?.('content-length');
   if(length!==null&&length!==undefined
    &&(!/^\d+$/.test(length)||Number(length)>limit))
    return fail('RESPONSE_TOO_LARGE');
   const decoded=await readBoundedResponseText(response,{
    limit,signal:controller.signal,timedOut:expired
   });
   if(started!==generation)return fail('STALE_SESSION_RESPONSE');
   if(!decoded.ok)return fail(decoded.code);
   let dto;try{dto=JSON.parse(decoded.text);}catch{return fail('BAD_SERVER_RESPONSE');}
   const projected=verifyPage(dto,{serviceId,serviceKind,
    subject,conversationId:expectedConversationId,clock:now(),cursor});
   if(!projected)return fail('INVALID_CHAT_PAGE');
   let after;try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(started!==generation)return fail('STALE_SESSION_RESPONSE');
   if(expired())return fail('NETWORK_OR_TIMEOUT');
   if(!sessionValid(after,now())||!same(before,after))
    return fail('STALE_SESSION_RESPONSE');
   return Object.freeze({ok:true,status:200,data:projected});
  }catch{return fail(started!==generation
   ?'STALE_SESSION_RESPONSE':'NETWORK_OR_TIMEOUT');}
  finally{
   if(timeout!==null)clearTimeout(timeout);
   if(active===controller)active=null;
  }
 }
 return Object.freeze({
  enabled:ready,contractCertified:ready,stagingRuntimeVerified:ready,
  isConfigured:()=>Boolean(ready),cancelPending,readMessages
 });
}
