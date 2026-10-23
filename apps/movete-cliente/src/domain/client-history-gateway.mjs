/**
 * CLIENTE: paginación de historial solo lectura.
 * GET /v1/staging/rider/history consta en OpenAPI STAGING de A:
 * deshabilitada hasta que A certifique endpoint, JWT/RLS y DTO.
 * La cantidad por página no limita registros totales de la plataforma.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR=/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/;
const fail=(code,status=0)=>Object.freeze({ok:false,code,status});
const uuid=x=>typeof x==='string'&&UUID.test(x);
const validCursor=x=>x===null||(typeof x==='string'&&x.length<=200&&CURSOR.test(x));
const validSession=(x,now)=>x&&x.role==='passenger'&&uuid(x.subject)
 &&typeof x.token==='string'&&x.token.length>=20
 &&Number.isFinite(x.expiresAt)&&x.expiresAt>now+1000
 &&Number.isSafeInteger(x.authRevision)&&x.authRevision>=0;
const sameSession=(a,b)=>a.subject===b.subject&&a.token===b.token
 &&a.expiresAt===b.expiresAt&&a.authRevision===b.authRevision;
const originOf=raw=>{
 try{
  if(typeof raw!=='string'||raw.includes('\\'))return null;
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash
    ||u.pathname!=='/'||u.port||u.hostname.endsWith('.'))return null;
  return u.origin;
 }catch{return null;}
};
export function createClientHistoryGateway({
 enabled=false,contractCertified=false,origin,pinnedOrigin,getSession,fetchImpl,
 onSessionInvalid=()=>{},now=()=>Date.now(),timeoutMs=8000,maxBytes=262144
}={}){
 const host=originOf(origin),pin=originOf(pinnedOrigin);
 const ready=enabled===true&&contractCertified===true&&host!==null&&host===pin
  &&typeof getSession==='function'&&typeof fetchImpl==='function';
 let active=false;
 async function fetchPage(cursor=null){
  if(!ready)return fail('HISTORY_CONTRACT_PENDING');
  if(!validCursor(cursor))return fail('INVALID_CURSOR');
  if(active)return fail('HISTORY_READ_IN_FLIGHT');
  active=true;
  let timeout=null;
  try{
   let before;
   try{before=await getSession();}catch{return fail('AUTH_UNAVAILABLE');}
   if(!validSession(before,now()))return fail('AUTH_REQUIRED');
   const controller=new AbortController();
   const ms=Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=30000?timeoutMs:8000;
   const deadline=now()+ms;
   timeout=setTimeout(()=>controller.abort(),ms);
   const timedOut=()=>controller.signal.aborted||now()>=deadline;
   const url=host+'/v1/staging/rider/history';
   const res=await fetchImpl(url,{
    method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
    referrerPolicy:'no-referrer',
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json',
      ...(cursor!==null?{'X-Qore-History-Cursor':cursor}:{})},
    signal:controller.signal
   });
   // Incluso si un fetch provisto ignora AbortSignal, una respuesta después
   // del plazo no puede revelar historial ni invalidar la sesión actual.
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!res||res.redirected===true)return fail('UNTRUSTED_REDIRECT');
   if(res.status===401||res.status===403){
    let after;
    try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
    if(!validSession(after,now())||!sameSession(before,after))
     return fail('STALE_SESSION_RESPONSE');
    onSessionInvalid();
    return fail(res.status===401?'AUTH_REQUIRED':'FORBIDDEN',res.status);
   }
   if(res.status===400)return fail('INVALID_OR_EXPIRED_CURSOR',400);
   if(res.status===429)return fail('RATE_LIMITED',429);
   if(res.status===503)return fail('SERVICE_UNAVAILABLE',503);
   if(res.status!==200||res.ok!==true)return fail('SERVER_DENIED',res.status);
   const type=res.headers?.get?.('content-type');
   if(typeof type!=='string'||!/^application\/json(?:\s*;|$)/i.test(type))
    return fail('BAD_CONTENT_TYPE');
   const limit=Number.isSafeInteger(maxBytes)&&maxBytes>=1024&&maxBytes<=1048576?maxBytes:262144;
   const length=res.headers?.get?.('content-length');
   if(length!==null&&length!==undefined&&(!/^\d+$/.test(length)||Number(length)>limit))
    return fail('RESPONSE_TOO_LARGE');
   if(typeof res.text!=='function')return fail('BAD_SERVER_RESPONSE');
   const text=await res.text();
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(typeof text!=='string'||text.length>limit
    ||new TextEncoder().encode(text).byteLength>limit)return fail('RESPONSE_TOO_LARGE');
   let data;
   try{data=JSON.parse(text);}catch{return fail('BAD_SERVER_RESPONSE');}
   if(!data||typeof data!=='object'||Array.isArray(data))return fail('BAD_SERVER_RESPONSE');
   let after;
   try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!validSession(after,now())||!sameSession(before,after))
    return fail('STALE_SESSION_RESPONSE');
   return Object.freeze({ok:true,data,status:200});
  }catch{return fail('NETWORK_OR_TIMEOUT');}
  finally{if(timeout!==null)clearTimeout(timeout);active=false;}
 }
 return Object.freeze({isConfigured:()=>Boolean(ready),fetchPage});
}
