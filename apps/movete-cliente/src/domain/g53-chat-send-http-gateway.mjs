import {readBoundedResponseText} from './bounded-http-response.mjs';

/**
 * Transporte POST G53 para ACK persistido del pasajero.
 * El OpenAPI de A sigue x-qore-runtime-wired:false: OFF por defecto.
 * Ante ACK ilegible/post ambiguo conservar SIEMPRE la misma requestKey.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BEARER=/^[A-Za-z0-9._~+/-]{20,8192}={0,2}$/;
const KINDS=new Set(['RIDE','DELIVERY','MERCHANT_ORDER']);
const ACK=['conversationId','serviceId','requestKey','messageId','senderRole',
 'body','createdAt','revision','serverStored'];
const uuid=x=>typeof x==='string'&&UUID.test(x);
const int=x=>Number.isSafeInteger(x)&&x>=0;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).length===keys.length
 &&keys.every(k=>Object.hasOwn(x,k));
const safeBody=s=>typeof s==='string'&&s.length>=1&&s.length<=500
 &&s===s.trim()&&s.trim().length>=1
 &&!/[\u0000-\u001f\u007f<>]/u.test(s)
 &&!/(?:https?:\/\/|www\.)/i.test(s)
 &&!/[\u202a-\u202e\u2066-\u2069\u200e\u200f]/u.test(s)
 &&!/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/u.test(s)
 &&!/(?:\+?\d[\s().-]*){7,}/u.test(s);
const fail=(code,status=0)=>Object.freeze({ok:false,code,status});
function verifiedOrigin(value){
 try{
  if(typeof value!=='string'||value.includes('\\'))return null;
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.search
   &&!u.hash&&!u.port&&u.pathname==='/'&&!u.hostname.endsWith('.')
   ?u.origin:null;
 }catch{return null;}
}
const sessionValid=(s,clock)=>object(s)&&s.role==='passenger'
 &&uuid(s.subject)&&typeof s.token==='string'&&BEARER.test(s.token)
 &&int(s.authRevision)&&int(s.sessionRevision)
 &&Number.isSafeInteger(s.expiresAt)&&s.expiresAt>clock+1000;
const sameSession=(a,b)=>a.subject===b.subject&&a.role===b.role
 &&a.token===b.token&&a.authRevision===b.authRevision
 &&a.sessionRevision===b.sessionRevision&&a.expiresAt===b.expiresAt;
function storedAck(dto,{conversationId,serviceId,requestKey,body,clock}){
 return exact(dto,ACK)&&dto.conversationId===conversationId
  &&dto.serviceId===serviceId&&dto.requestKey===requestKey
  &&uuid(dto.messageId)&&dto.senderRole==='passenger'
  &&dto.body===body&&safeBody(dto.body)&&int(dto.createdAt)
  &&dto.createdAt<=clock&&int(dto.revision)&&dto.revision>=2
  &&dto.serverStored===true;
}
export function createG53ChatSendHttpGateway({
 enabled=false,contractCertified=false,stagingRuntimeVerified=false,
 origin,pinnedOrigin,getSession,fetchImpl,onSessionInvalid=()=>{},
 now=()=>Date.now(),timeoutMs=8000,maxBytes=32768
}={}){
 const host=verifiedOrigin(origin),pin=verifiedOrigin(pinnedOrigin);
 const ready=enabled===true&&contractCertified===true
  &&stagingRuntimeVerified===true&&host!==null&&host===pin
  &&typeof getSession==='function'&&typeof fetchImpl==='function';
 let generation=0,active=null;
 function cancelPending(){
  generation++;
  try{active?.abort();}catch{}
  active=null;
 }
 async function sendMessage({conversationId,serviceId,serviceKind,
  requestKey,body,subject,sessionRevision}={}){
  if(!ready)return fail('G53_RUNTIME_NOT_CERTIFIED');
  if(!uuid(conversationId)||!uuid(serviceId)||!KINDS.has(serviceKind)
   ||!uuid(requestKey)||!safeBody(body)||!uuid(subject)
   ||!int(sessionRevision))return fail('INVALID_MESSAGE');
  if(active!==null)return fail('CHAT_SEND_IN_FLIGHT');
  const controller=new AbortController(),started=generation;
  active=controller;
  let timeout=null,dispatched=false;
  // Después de transmitir POST jamás declarar un rechazo local definitivo
  // por respuesta corrupta, redirect, timeout o ACK no legible: si PostgreSQL
  // alcanzó COMMIT, una nueva clave podría duplicar el mensaje.
  const uncertain=()=>fail('CHAT_NETWORK_OR_TIMEOUT');
  try{
   let before;try{before=await getSession();}catch{return fail('AUTH_UNAVAILABLE');}
   if(started!==generation)return fail('STALE_SESSION_RESPONSE');
   if(!sessionValid(before,now()))return fail('AUTH_REQUIRED');
   if(before.subject!==subject||before.sessionRevision!==sessionRevision)
    return fail('STALE_SESSION_RESPONSE');
   const ms=int(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=30000
    ?timeoutMs:8000;
   const deadline=now()+ms;
   timeout=setTimeout(()=>controller.abort(),ms);
   const expired=()=>controller.signal.aborted||now()>=deadline;
   const url=host+'/v1/staging/chat/services/'
    +encodeURIComponent(serviceKind)+'/'+encodeURIComponent(serviceId)
    +'/conversations/'+encodeURIComponent(conversationId)+'/messages';
   const payload=JSON.stringify({requestKey,body});
   dispatched=true;
   const response=await fetchImpl(url,{
    method:'POST',credentials:'omit',redirect:'error',cache:'no-store',
    referrerPolicy:'no-referrer',
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json',
     'Content-Type':'application/json'},
    body:payload,signal:controller.signal
   });
   if(started!==generation)return fail('STALE_SESSION_RESPONSE');
   if(expired())return uncertain();
   if(!response||response.redirected===true)return uncertain();
   if(response.status===401||response.status===403){
    let after;try{after=await getSession();}catch{return uncertain();}
    if(started!==generation)return fail('STALE_SESSION_RESPONSE');
    if(expired())return uncertain();
    if(!sessionValid(after,now())||!sameSession(before,after))
     return fail('STALE_SESSION_RESPONSE');
    try{onSessionInvalid();}catch{}
    return fail(response.status===401?'AUTH_REQUIRED':'FORBIDDEN',response.status);
   }
   if(response.status===429)return fail('RATE_LIMITED',429);
   if(response.status===503)return fail('SERVICE_UNAVAILABLE',503);
   if(response.status!==200||response.ok!==true)return uncertain();
   if(!/^application\/json(?:\s*;|$)/i.test(
    response.headers?.get?.('content-type')??''))return uncertain();
   const limit=int(maxBytes)&&maxBytes>=1024&&maxBytes<=131072
    ?maxBytes:32768;
   const length=response.headers?.get?.('content-length');
   if(length!=null&&(!/^\d+$/.test(length)||Number(length)>limit))
    return uncertain();
   const decoded=await readBoundedResponseText(response,{
    limit,signal:controller.signal,timedOut:expired
   });
   if(started!==generation)return fail('STALE_SESSION_RESPONSE');
   if(!decoded.ok)return uncertain();
   let dto;try{dto=JSON.parse(decoded.text);}catch{return uncertain();}
   if(!storedAck(dto,{conversationId,serviceId,requestKey,body,clock:now()}))
    return uncertain();
   let after;try{after=await getSession();}catch{return uncertain();}
   if(started!==generation)return fail('STALE_SESSION_RESPONSE');
   if(expired())return uncertain();
   if(!sessionValid(after,now())||!sameSession(before,after))
    return fail('STALE_SESSION_RESPONSE');
   return Object.freeze({ok:true,status:200,data:Object.freeze({...dto})});
  }catch{return started!==generation?fail('STALE_SESSION_RESPONSE')
    :dispatched?uncertain():fail('AUTH_UNAVAILABLE');}
  finally{
   if(timeout!==null)clearTimeout(timeout);
   if(active===controller)active=null;
  }
 }
 return Object.freeze({
  enabled:ready,contractCertified:ready,stagingRuntimeVerified:ready,
  isConfigured:()=>Boolean(ready),cancelPending,sendMessage
 });
}
