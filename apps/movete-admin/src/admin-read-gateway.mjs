import {isValidCursor} from './page-cursor.mjs';
/**
 * Frontera de lectura de Admin Web — SOLO STAGING, bloqueada por defecto.
 * Rutas PROPUESTAS, todavía no contratadas/certificadas por Backend A.
 * Un consumidor no puede activar solicitudes con parámetros del navegador:
 * habilitar una operación exige configuración de integración explícita.
 * Autorización final, tenant y MFA real son siempre responsabilidad de A.
 */
export const READ_CONTRACTS=Object.freeze({
 kyc:Object.freeze({path:'/v1/staging/admin/vehicle-review-queue',role:'admin'}),
 zones:Object.freeze({path:'/v1/staging/admin/zones/overview',role:'admin'}),
 incidents:Object.freeze({path:'/v1/staging/admin/incidents/queue',role:'admin'}),
 audit:Object.freeze({path:'/v1/staging/admin/audit/events',role:'admin'}),
 finance:Object.freeze({path:'/v1/staging/owner/finance/summary',role:'owner'})
});
const fail=(code,status=0)=>Object.freeze({ok:false,code,status});
function safeOrigin(value){
 try{
  if(typeof value!=='string'||value.includes('\\'))return null;
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash
   ||url.pathname!=='/'||url.port||url.hostname.endsWith('.'))
   return null;
  return url.origin;
 }catch{return null;}
}
const validActor=(s,expected,now)=>s!==null&&typeof s==='object'
 &&s.role===expected&&s.mfaVerified===true
 &&typeof s.subject==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.subject)
 &&typeof s.token==='string'&&s.token.length>=20
 &&Number.isFinite(s.expiresAt)&&s.expiresAt>now+1000;

/**
 * Ejemplo de configuración segura: enabled=false hasta que A publique
 * OpenAPI versionado, Auth/MFA reales y autorizaciones RLS/DB certificadas.
 */
export function createAdminReadGateway({
 enabled=false,certifiedContracts=[],origin,pinnedOrigin,getSession,fetchImpl,
 onSessionInvalid=()=>{},now=()=>Date.now(),timeoutMs=8000,maxBytes=262144
}={}){
 const host=safeOrigin(origin),pinned=safeOrigin(pinnedOrigin);
 const accepted=Array.isArray(certifiedContracts)?certifiedContracts:[];
 const allowed=new Set(accepted.filter(x=>Object.hasOwn(READ_CONTRACTS,x)));
 const ready=enabled===true&&host!==null&&host===pinned
  &&typeof getSession==='function'&&typeof fetchImpl==='function'
  &&allowed.size>0;
 const inFlight=new Set();
 function isConfigured(operation){
  return ready&&allowed.has(operation)&&Object.hasOwn(READ_CONTRACTS,operation);
 }
 async function read(operation,{cursor=null}={}){
  if(!isConfigured(operation))return fail('READ_CONTRACT_NOT_CERTIFIED');
  if(cursor!==null&&!isValidCursor(cursor))return fail('INVALID_CURSOR');
  if(operation==='finance'&&cursor!==null)return fail('INVALID_CURSOR');
  if(inFlight.has(operation))return fail('READ_IN_FLIGHT');
  inFlight.add(operation); // before await: no parallel duplicate GET
  let timeout=null;
  try{
   const definition=READ_CONTRACTS[operation];
   let first;
   try{first=await getSession();}
   catch{return fail('AUTH_UNAVAILABLE');}
   if(!validActor(first,definition.role,now()))return fail('FORBIDDEN');
   const ctl=new AbortController();
   const ms=Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=30000?timeoutMs:8000;
   timeout=setTimeout(()=>ctl.abort(),ms);
   const query=cursor===null?'':'?cursor='+encodeURIComponent(cursor);
   const result=await fetchImpl(host+definition.path+query,{
    method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
    referrerPolicy:'no-referrer',
    headers:{Authorization:'Bearer '+first.token,Accept:'application/json'},
    signal:ctl.signal
   });
   if(!result||result.redirected===true)return fail('UNTRUSTED_REDIRECT');
   if(result.status===401||result.status===403){
    // No revocar sesión nueva por el 401/403 de una petición vieja.
    let latest;
    try{latest=await getSession();}
    catch{return fail('STALE_SESSION_RESPONSE');}
    if(!validActor(latest,definition.role,now())
     ||latest.subject!==first.subject||latest.token!==first.token
     ||latest.expiresAt!==first.expiresAt
     ||latest.authRevision!==first.authRevision)
     return fail('STALE_SESSION_RESPONSE');
    onSessionInvalid();
    return fail(result.status===401?'AUTH_REQUIRED':'FORBIDDEN',result.status);
   }
   if(result.status===429)return fail('RATE_LIMITED',429);
   if(result.status===503)return fail('SERVICE_UNAVAILABLE',503);
   if(result.status!==200||result.ok!==true)return fail('SERVER_DENIED',result.status);
   const contentType=result.headers?.get?.('content-type');
   if(typeof contentType!=='string'||!/^application\/json(?:\s*;|$)/i.test(contentType))
    return fail('BAD_CONTENT_TYPE');
   const advertised=result.headers?.get?.('content-length');
   const limit=Number.isSafeInteger(maxBytes)&&maxBytes>=1024&&maxBytes<=1048576?maxBytes:262144;
   if(advertised!==null&&advertised!==undefined&&(!/^\d+$/.test(advertised)||Number(advertised)>limit))
    return fail('RESPONSE_TOO_LARGE');
   if(typeof result.text!=='function')return fail('BAD_SERVER_RESPONSE');
   const body=await result.text();
   if(typeof body!=='string'||body.length>limit)return fail('RESPONSE_TOO_LARGE');
   let json;
   try{json=JSON.parse(body);}
   catch{return fail('BAD_SERVER_RESPONSE');}
   if(!json||typeof json!=='object'||Array.isArray(json))return fail('BAD_SERVER_RESPONSE');
   // Strict post-response identity check: no old admin/owner data on new user.
   let latest;
   try{latest=await getSession();}
   catch{return fail('STALE_SESSION_RESPONSE');}
   if(!validActor(latest,definition.role,now())
    ||first.subject!==latest.subject||first.token!==latest.token
    ||first.expiresAt!==latest.expiresAt
    ||first.authRevision!==latest.authRevision)return fail('STALE_SESSION_RESPONSE');
   return Object.freeze({ok:true,data:json,status:200});
  }catch{return fail('NETWORK_OR_TIMEOUT');}
  finally{
   if(timeout!==null)clearTimeout(timeout);
   inFlight.delete(operation);
  }
 }
 return Object.freeze({isConfigured,read});
}
