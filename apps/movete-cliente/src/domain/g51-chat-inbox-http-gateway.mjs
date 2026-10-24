import {readBoundedResponseText} from './bounded-http-response.mjs';

/**
 * Transporte STAGING de bandeja Passenger, contrato OpenAPI G51 del A.
 * Ruta documentada, aún NO montada (x-qore-runtime-wired:false).
 * Todo gate OFF por defecto; sin credenciales ni origen codificados.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR=/^[A-Za-z0-9_.-]{44,384}$/;
const KINDS=new Set(['RIDE','DELIVERY','MERCHANT_ORDER']);
const ROW=['conversationId','serviceId','serviceKind','state','assignmentVerified',
 'counterpartRole','revision','unreadCount','updatedAt','canSend'];
const PAGE=['ownerId','generatedAt','expiresAt','revision','items','nextCursor',
 'productionEnabled'];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length
 &&keys.every(k=>Object.hasOwn(v,k));
const uuid=x=>typeof x==='string'&&UUID.test(x);
const int=n=>Number.isSafeInteger(n)&&n>=0;
const natural=n=>int(n)&&n>=1;
const fail=(code,status=0)=>Object.freeze({ok:false,code,status});
const sameSession=(a,b)=>a.subject===b.subject&&a.token===b.token
 &&a.role===b.role&&a.authRevision===b.authRevision
 &&a.sessionRevision===b.sessionRevision&&a.expiresAt===b.expiresAt;
function verifiedOrigin(input){
 try{
  if(typeof input!=='string'||input.includes('\\'))return null;
  const u=new URL(input);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.search
   &&!u.hash&&!u.port&&u.pathname==='/'&&!u.hostname.endsWith('.')
   ?u.origin:null;
 }catch{return null;}
}
const validSession=(s,now)=>object(s)&&s.role==='passenger'
 &&uuid(s.subject)&&typeof s.token==='string'&&s.token.length>=20
 &&int(s.authRevision)&&int(s.sessionRevision)
 &&Number.isFinite(s.expiresAt)&&s.expiresAt>now+1000;
function projectInbox(dto,subject,clock){
 if(!exact(dto,PAGE)||dto.ownerId!==subject
  ||dto.productionEnabled!==false||!natural(dto.revision)
  ||!int(dto.generatedAt)||dto.generatedAt>clock
  ||dto.generatedAt<clock-300000||!int(dto.expiresAt)
  ||dto.expiresAt<=clock||dto.expiresAt>clock+300000
  ||dto.expiresAt<=dto.generatedAt
  ||!Array.isArray(dto.items)||dto.items.length>100
  ||!(dto.nextCursor===null||(typeof dto.nextCursor==='string'
   &&CURSOR.test(dto.nextCursor)))
  ||(dto.items.length===0&&dto.nextCursor!==null))return null;
 const items=[],threads=new Set(),services=new Set();
 for(const row of dto.items){
  if(!exact(row,ROW)||!uuid(row.conversationId)||!uuid(row.serviceId)
   ||!KINDS.has(row.serviceKind)||row.state!=='ACTIVE'
   ||row.assignmentVerified!==true||row.counterpartRole!=='driver'
   ||row.canSend!==true||!natural(row.revision)
   ||row.revision>dto.revision||!int(row.unreadCount)
   ||!int(row.updatedAt)||row.updatedAt>clock
   ||threads.has(row.conversationId)
   ||services.has(row.serviceKind+':'+row.serviceId))return null;
  threads.add(row.conversationId);
  services.add(row.serviceKind+':'+row.serviceId);
  items.push(Object.freeze({...row}));
 }
 return Object.freeze({...dto,items:Object.freeze(items)});
}
const statusCode=status=>({
 400:'INVALID_OR_EXPIRED_CURSOR',401:'AUTH_REQUIRED',403:'FORBIDDEN',
 404:'NOT_FOUND',409:'CHAT_INBOX_REVISION_CHANGED',429:'RATE_LIMITED',
 503:'SERVICE_UNAVAILABLE'
})[status]??'UNTRUSTED_CHAT_RESPONSE';

export function createG51ChatInboxHttpGateway({
 enabled=false,contractCertified=false,stagingRuntimeVerified=false,
 origin,pinnedOrigin,getSession,fetchImpl,onSessionInvalid=()=>{},
 now=()=>Date.now(),timeoutMs=8000,maxBytes=131072
}={}){
 const host=verifiedOrigin(origin),pin=verifiedOrigin(pinnedOrigin);
 const ready=enabled===true&&contractCertified===true
  &&stagingRuntimeVerified===true&&host!==null&&host===pin
  &&typeof getSession==='function'&&typeof fetchImpl==='function';
 let epoch=0,active=null;
 function cancelInbox(){
  epoch++;
  try{active?.abort();}catch{}
  active=null;
 }
 async function readInbox({cursor=null,subject,sessionRevision}={}){
  if(!ready)return fail('G51_RUNTIME_NOT_CERTIFIED');
  if(!uuid(subject)||!int(sessionRevision)
   ||!(cursor===null||(typeof cursor==='string'
    &&CURSOR.test(cursor))))return fail('INVALID_CHAT_INBOX_QUERY');
  if(active!==null)return fail('CHAT_INBOX_READ_IN_FLIGHT');
  const started=epoch,controller=new AbortController();
  active=controller;
  let timeout=null;
  try{
   let before;
   try{before=await getSession();}catch{return fail('AUTH_UNAVAILABLE');}
   if(started!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(!validSession(before,now()))return fail('AUTH_REQUIRED');
   if(before.subject!==subject||before.sessionRevision!==sessionRevision)
    return fail('STALE_SESSION_RESPONSE');
   const ms=int(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=30000
    ?timeoutMs:8000;
   const deadline=now()+ms;
   timeout=setTimeout(()=>controller.abort(),ms);
   const expired=()=>controller.signal.aborted||now()>=deadline;
   const headers={Authorization:'Bearer '+before.token,Accept:'application/json'};
   if(cursor!==null)headers['X-Qore-Chat-Cursor']=cursor;
   const response=await fetchImpl(host+'/v1/staging/chat/conversations?limit=100',{
    method:'GET',credentials:'omit',redirect:'error',cache:'no-store',
    referrerPolicy:'no-referrer',headers,signal:controller.signal
   });
   if(started!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(expired())return fail('NETWORK_OR_TIMEOUT');
   if(!response||response.redirected===true)return fail('UNTRUSTED_REDIRECT');
   if(response.status===401||response.status===403){
    let after;try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
    if(started!==epoch)return fail('STALE_SESSION_RESPONSE');
    if(expired())return fail('NETWORK_OR_TIMEOUT');
    if(!validSession(after,now())||!sameSession(before,after))
     return fail('STALE_SESSION_RESPONSE');
    try{onSessionInvalid();}catch{}
    return fail(statusCode(response.status),response.status);
   }
   if(response.status!==200||response.ok!==true)
    return fail(statusCode(response.status),response.status);
   if(!/^application\/json(?:\s*;|$)/i.test(
    response.headers?.get?.('content-type')??''))return fail('BAD_CONTENT_TYPE');
   const limit=int(maxBytes)&&maxBytes>=1024&&maxBytes<=262144
    ?maxBytes:131072;
   const length=response.headers?.get?.('content-length');
   if(length!=null&&(!/^\d+$/.test(length)||Number(length)>limit))
    return fail('RESPONSE_TOO_LARGE');
   const decoded=await readBoundedResponseText(response,{
    limit,signal:controller.signal,timedOut:expired
   });
   if(started!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(!decoded.ok)return fail(decoded.code);
   let dto;try{dto=JSON.parse(decoded.text);}catch{return fail('BAD_SERVER_RESPONSE');}
   const projected=projectInbox(dto,before.subject,now());
   if(!projected)return fail('INVALID_CHAT_INBOX_DTO');
   let after;try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(started!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(expired())return fail('NETWORK_OR_TIMEOUT');
   if(!validSession(after,now())||!sameSession(before,after))
    return fail('STALE_SESSION_RESPONSE');
   return Object.freeze({ok:true,data:projected,status:200});
  }catch{return fail(started!==epoch?'STALE_SESSION_RESPONSE':'NETWORK_OR_TIMEOUT');}
  finally{
   if(timeout!==null)clearTimeout(timeout);
   if(active===controller)active=null;
  }
 }
 return Object.freeze({
  enabled:ready,contractCertified:ready,stagingRuntimeVerified:ready,
  isConfigured:()=>Boolean(ready),cancelInbox,readInbox
 });
}
