import {readBoundedResponseText} from './bounded-http-response.mjs';

/**
 * Transporte opt-in G51 POST de read receipt. OpenAPI A QA-only:
 * no existe runtime montado. NO inferir throughSeq de revision/createdAt
 * ni marcar una lectura automáticamente desde el historial G52.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BEARER=/^[A-Za-z0-9._~+/-]{20,8192}={0,2}$/;
const ACK=['conversationId','readThrough','qaOnly'];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).length===keys.length
 &&keys.every(k=>Object.hasOwn(x,k));
const uuid=x=>typeof x==='string'&&UUID.test(x);
const int=x=>Number.isSafeInteger(x)&&x>=0;
const fail=(code,status=0)=>Object.freeze({ok:false,code,status});
const same=(a,b)=>a.subject===b.subject&&a.role===b.role
 &&a.token===b.token&&a.authRevision===b.authRevision
 &&a.sessionRevision===b.sessionRevision&&a.expiresAt===b.expiresAt;
const sessionValid=(s,clock)=>object(s)&&s.role==='passenger'
 &&uuid(s.subject)&&typeof s.token==='string'&&BEARER.test(s.token)
 &&int(s.authRevision)&&int(s.sessionRevision)
 &&Number.isFinite(s.expiresAt)&&s.expiresAt>clock+1000;
function verifiedOrigin(input){
 try{
  if(typeof input!=='string'||input.includes('\\'))return null;
  const u=new URL(input);
  return u.protocol==='https:'&&!u.username&&!u.password
   &&!u.search&&!u.hash&&!u.port&&u.pathname==='/'
   &&!u.hostname.endsWith('.')?u.origin:null;
 }catch{return null;}
}
export function createG51ChatReadReceiptHttpGateway({
 enabled=false,contractCertified=false,stagingRuntimeVerified=false,
 origin,pinnedOrigin,getSession,fetchImpl,onSessionInvalid=()=>{},
 now=()=>Date.now(),timeoutMs=8000,maxBytes=16384
}={}){
 const host=verifiedOrigin(origin),pin=verifiedOrigin(pinnedOrigin);
 const ready=enabled===true&&contractCertified===true
  &&stagingRuntimeVerified===true&&host!==null&&host===pin
  &&typeof getSession==='function'&&typeof fetchImpl==='function';
 let generation=0,active=null;
 const cancelPending=()=>{
  generation++;try{active?.abort();}catch{}
  active=null;
 };
 async function markRead({conversationId,throughSeq,subject,sessionRevision}={}){
  if(!ready)return fail('G51_READ_RECEIPT_RUNTIME_NOT_CERTIFIED');
  if(!uuid(conversationId)||!int(throughSeq)||!uuid(subject)
   ||!int(sessionRevision))return fail('INVALID_READ_RECEIPT_QUERY');
  if(active!==null)return fail('READ_RECEIPT_IN_FLIGHT');
  const controller=new AbortController(),started=generation;
  active=controller;
  let timer=null,dispatched=false;
  const uncertain=()=>fail('READ_RECEIPT_UNCONFIRMED');
  try{
   let before;try{before=await getSession();}catch{return fail('AUTH_UNAVAILABLE');}
   if(started!==generation)return fail('STALE_SESSION_RESPONSE');
   if(!sessionValid(before,now()))return fail('AUTH_REQUIRED');
   if(before.subject!==subject||before.sessionRevision!==sessionRevision)
    return fail('STALE_SESSION_RESPONSE');
   const ms=int(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=30000?timeoutMs:8000;
   const deadline=now()+ms;
   timer=setTimeout(()=>controller.abort(),ms);
   const expired=()=>controller.signal.aborted||now()>=deadline;
   dispatched=true;
   const response=await fetchImpl(host+'/v1/staging/chat/conversations/'
    +encodeURIComponent(conversationId)+'/read-receipt',{
    method:'POST',credentials:'omit',redirect:'error',cache:'no-store',
    referrerPolicy:'no-referrer',signal:controller.signal,
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json',
     'Content-Type':'application/json'},
    body:JSON.stringify({throughSeq})
   });
   if(started!==generation)return fail('STALE_SESSION_RESPONSE');
   if(expired()||!response||response.redirected===true)return uncertain();
   if(response.status===401||response.status===403){
    let after;try{after=await getSession();}catch{return uncertain();}
    if(started!==generation)return fail('STALE_SESSION_RESPONSE');
    if(expired())return uncertain();
    if(!sessionValid(after,now())||!same(before,after))
     return fail('STALE_SESSION_RESPONSE');
    try{onSessionInvalid();}catch{}
    return fail(response.status===401?'AUTH_REQUIRED':'FORBIDDEN',response.status);
   }
   if(response.status!==200||response.ok!==true)return uncertain();
   if(!/^application\/json(?:\s*;|$)/i.test(
    response.headers?.get?.('content-type')??''))return uncertain();
   const limit=int(maxBytes)&&maxBytes>=1024&&maxBytes<=65536
    ?maxBytes:16384;
   const length=response.headers?.get?.('content-length');
   if(length!=null&&(!/^\d+$/.test(length)||Number(length)>limit))
    return uncertain();
   const decoded=await readBoundedResponseText(response,{
    limit,signal:controller.signal,timedOut:expired
   });
   if(started!==generation)return fail('STALE_SESSION_RESPONSE');
   if(!decoded.ok)return uncertain();
   let dto;try{dto=JSON.parse(decoded.text);}catch{return uncertain();}
   // Nunca presumir que la lectura se confirmó a partir de un 200 vacío.
   // readThrough >= throughSeq permite watermark avanzado por otro dispositivo;
   // A conserva validación de no avanzar hacia una secuencia futura.
   if(!exact(dto,ACK)||dto.conversationId!==conversationId
    ||!int(dto.readThrough)||dto.readThrough<throughSeq
    ||dto.qaOnly!==true)return uncertain();
   let after;try{after=await getSession();}catch{return uncertain();}
   if(started!==generation)return fail('STALE_SESSION_RESPONSE');
   if(expired())return uncertain();
   if(!sessionValid(after,now())||!same(before,after))
    return fail('STALE_SESSION_RESPONSE');
   return Object.freeze({ok:true,status:200,data:Object.freeze({...dto})});
  }catch{return started!==generation?fail('STALE_SESSION_RESPONSE')
   :dispatched?uncertain():fail('AUTH_UNAVAILABLE');}
  finally{
   if(timer!==null)clearTimeout(timer);
   if(active===controller)active=null;
  }
 }
 return Object.freeze({
  enabled:ready,contractCertified:ready,stagingRuntimeVerified:ready,
  isConfigured:()=>Boolean(ready),cancelPending,markRead
 });
}
