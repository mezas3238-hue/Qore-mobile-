import {readBoundedResponseText} from './bounded-http-response.mjs';

/**
 * G40: recibo privado, tipado y SOLO DE BASE QA. Jamás equivale a SOS,
 * contacto a operadores, patrullas, emergencias o atención comercial.
 * Backend A controla identidad, RLS, revocación e idempotencia durable.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kind=new Set(['RIDE','DELIVERY','MERCHANT_ORDER']);
const category=new Set(['SAFETY','LOSS','DISPUTE','FRAUD','QUALITY']);
const severity=new Set(['LOW','MEDIUM','HIGH']); // CRITICAL/SOS prohibidos G40.
const state=new Set(['open','triaged','investigating','resolved','dismissed']);
const fields=['requestKey','subjectKind','subjectId','category','severity'];
const responseFields=['incidentId','receiptId','state','revision','createdAt','observedAt','receiptStatus'];
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,k)=>obj(x)&&Object.keys(x).length===k.length&&k.every(y=>Object.hasOwn(x,y));
const uuid=x=>typeof x==='string'&&UUID.test(x);
const fail=(code,status=0)=>Object.freeze({ok:false,code,status});
const validSession=(s,now)=>obj(s)&&uuid(s.subject)&&s.role==='passenger'
 &&typeof s.token==='string'&&s.token.length>=20
 &&Number.isSafeInteger(s.authRevision)&&s.authRevision>=0
 &&Number.isFinite(s.expiresAt)&&s.expiresAt>now+1000;
const sameSession=(a,b)=>a.subject===b.subject&&a.token===b.token
 &&a.authRevision===b.authRevision&&a.expiresAt===b.expiresAt
 &&a.sessionRevision===b.sessionRevision;
function originOf(raw){
 try{
  if(typeof raw!=='string'||raw.includes('\\'))return null;
  const u=new URL(raw);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.search
   &&!u.hash&&!u.port&&!u.hostname.endsWith('.')&&u.pathname==='/'?u.origin:null;
 }catch{return null;}
}
export function validateIncidentG40Request(body){
 return exact(body,fields)&&uuid(body.requestKey)&&kind.has(body.subjectKind)
  &&uuid(body.subjectId)&&category.has(body.category)&&severity.has(body.severity);
}
function validDate(x,now){
 if(typeof x!=='string'||!/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(x))return null;
 const ms=Date.parse(x);
 return Number.isFinite(ms)&&ms<=now+120000&&ms>=0?ms:null;
}
export function projectQaIncidentReceipt(dto,{now=Date.now(),incidentId=null,minimumRevision=1}={}){
 if(!exact(dto,responseFields)||!uuid(dto.incidentId)||!uuid(dto.receiptId)
  ||(incidentId!==null&&dto.incidentId!==incidentId)
  ||!state.has(dto.state)||!Number.isSafeInteger(dto.revision)
  ||dto.revision<minimumRevision||dto.receiptStatus!=='RECEIVED_IN_QA_DATABASE_ONLY')
  return null;
 const created=validDate(dto.createdAt,now),observed=validDate(dto.observedAt,now);
 if(created===null||observed===null||observed<created)return null;
 return Object.freeze({...dto});
}
export function createIncidentG40Gateway({
 enabled=false,contractCertified=false,stagingRuntimeVerified=false,
 origin,pinnedOrigin,getSession,fetchImpl,onSessionInvalid=()=>{},
 now=()=>Date.now(),timeoutMs=8000
}={}){
 const host=originOf(origin),pin=originOf(pinnedOrigin);
 // OpenAPI G41 A declara x-qore-runtime-wired=false. No activar por
 // solo tener el esquema o por disponer de JWT en navegador.
 const ready=enabled===true&&contractCertified===true&&stagingRuntimeVerified===true
  &&host!==null&&host===pin&&typeof getSession==='function'&&typeof fetchImpl==='function';
 const active=new Set();
 async function perform(operation,{request=null,incidentId=null,minimumRevision=1,
  expectedSessionRevision=null}={}){
  if(!ready)return fail('INCIDENT_RUNTIME_NOT_CERTIFIED');
  if(operation==='report'?!validateIncidentG40Request(request):!uuid(incidentId))
   return fail('INVALID_INPUT');
  if(!Number.isSafeInteger(minimumRevision)||minimumRevision<1)
   return fail('INVALID_INPUT');
  if(active.has(operation))return fail('INCIDENT_OPERATION_IN_FLIGHT');
  active.add(operation);
  let timer=null;
  try{
   let before;
   try{before=await getSession();}catch{return fail('AUTH_UNAVAILABLE');}
   if(!validSession(before,now()))return fail('AUTH_REQUIRED');
   if(expectedSessionRevision!==null&&before.sessionRevision!==expectedSessionRevision)
    return fail('STALE_SESSION_RESPONSE');
   const ctl=new AbortController(),ms=Number.isSafeInteger(timeoutMs)
    &&timeoutMs>=1000&&timeoutMs<=30000?timeoutMs:8000;
   const deadline=now()+ms;
   timer=setTimeout(()=>ctl.abort(),ms);
   const timedOut=()=>ctl.signal.aborted||now()>=deadline;
   const isPost=operation==='report';
   const url=host+(isPost?'/v1/staging/safety/incidents/report'
    :'/v1/staging/safety/incidents/'+encodeURIComponent(incidentId)+'/status');
   const response=await fetchImpl(url,{
    method:isPost?'POST':'GET',credentials:'omit',redirect:'error',cache:'no-store',
    referrerPolicy:'no-referrer',
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json',
     ...(isPost?{'Content-Type':'application/json'}:{})},
    ...(isPost?{body:JSON.stringify(request)}:{}),signal:ctl.signal
   });
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!response||response.redirected===true)return fail('UNTRUSTED_REDIRECT');
   if(response.status===401||response.status===403){
    let after;
    try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
    if(timedOut())return fail('NETWORK_OR_TIMEOUT');
    if(!validSession(after,now())||!sameSession(before,after))
     return fail('STALE_SESSION_RESPONSE');
    onSessionInvalid();
    return fail(response.status===401?'AUTH_REQUIRED':'FORBIDDEN',response.status);
   }
   if(response.status===400)return fail('BAD_REQUEST',400);
   if(response.status===404)return fail('INCIDENT_NOT_FOUND',404);
   if(response.status===409)return fail('RECONCILE_SAME_REQUEST_KEY',409);
   if(response.status===429)return fail('RATE_LIMITED',429);
   if(response.status===503)return fail('SERVICE_UNAVAILABLE',503);
   const expected=isPost?201:200;
   if(response.status!==expected||response.ok!==true)
    return fail('INCIDENT_RECEIPT_NOT_CONFIRMED',response.status);
   if(!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type')??''))
    return fail('BAD_CONTENT_TYPE');
   const length=response.headers?.get?.('content-length');
   if(length!=null&&(!/^\d+$/.test(length)||Number(length)>8192))
    return fail('RESPONSE_TOO_LARGE');
   const parsed=await readBoundedResponseText(response,{
    limit:8192,signal:ctl.signal,timedOut
   });
   if(!parsed.ok)return fail(parsed.code);
   let dto;
   try{dto=JSON.parse(parsed.text);}catch{return fail('BAD_SERVER_RESPONSE');}
   const receipt=projectQaIncidentReceipt(dto,{now:now(),incidentId,minimumRevision});
   if(!receipt)return fail('INVALID_INCIDENT_RECEIPT');
   let after;
   try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!validSession(after,now())||!sameSession(before,after))
    return fail('STALE_SESSION_RESPONSE');
   return Object.freeze({ok:true,status:expected,receipt,
    qaDatabaseOnly:true,sosDispatched:false,operatorNotified:false});
  }catch{return fail('NETWORK_OR_TIMEOUT');}
  finally{if(timer!==null)clearTimeout(timer);active.delete(operation);}
 }
 return Object.freeze({
  isConfigured:()=>Boolean(ready),
  report:(request,expectedSessionRevision=null)=>perform('report',{request,expectedSessionRevision}),
  status:(incidentId,minimumRevision=1)=>perform('status',{incidentId,minimumRevision})
 });
}
