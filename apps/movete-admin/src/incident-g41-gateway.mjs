import {readBoundedResponseText} from './bounded-json-response.mjs';
/**
 * G41: GET filtrado global de incidentes. SOLO QA — endpoint UNMOUNTED por A.
 * No autoriza acciones, no garantiza snapshot consistente, no envía SOS.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR=/^[A-Za-z0-9_.-]{44,384}$/;
const severities=['CRITICAL','HIGH','MEDIUM','LOW'];
const statuses=['OPEN','TRIAGED','INVESTIGATING','RESOLVED','CLOSED'];
const categories=['SAFETY','RIDE','DELIVERY','PAYMENT_SIMULATED','OTHER'];
const top=['scope','priorityOrder','severityFilter','statusFilter','revision','items',
 'nextCursor','generatedAt','expiresAt','snapshotConsistent','productionEnabled'];
const cols=['incidentId','category','severity','status','createdAt','revision'];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(v,k)=>object(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const safeInt=(x,min=0)=>Number.isSafeInteger(x)&&x>=min;
const fail=(code,status=0)=>Object.freeze({ok:false,code,status});
const allow=(value,values)=>value===null||values.includes(value);
function safeOrigin(raw){
 try{
  if(typeof raw!=='string'||raw.includes('\\'))return null;
  const u=new URL(raw);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.search
   &&!u.hash&&!u.port&&u.pathname==='/'&&!u.hostname.endsWith('.')?u.origin:null;
 }catch{return null;}
}
function validSession(s,now){
 return object(s)&&s.role==='admin'&&s.mfaVerified===true
  &&typeof s.subject==='string'&&UUID.test(s.subject)
  &&typeof s.token==='string'&&s.token.length>=20
  &&safeInt(s.authRevision)&&Number.isFinite(s.expiresAt)&&s.expiresAt>now+1000;
}
const same=(a,b)=>a.subject===b.subject&&a.token===b.token&&a.expiresAt===b.expiresAt
 &&a.authRevision===b.authRevision;
export function projectG41TriagePage(raw,{
 severityFilter=null,statusFilter=null,now=Date.now()
}={}){
 if(!allow(severityFilter,severities)||!allow(statusFilter,statuses)
  ||!exact(raw,top)||raw.scope!=='admin.incidents.read'
  ||raw.priorityOrder!=='SEVERITY_THEN_NEWEST'
  ||raw.severityFilter!==severityFilter||raw.statusFilter!==statusFilter
  ||raw.snapshotConsistent!==false||raw.productionEnabled!==false
  ||!safeInt(raw.revision)||!safeInt(raw.generatedAt)||!safeInt(raw.expiresAt)
  ||raw.generatedAt>now||raw.generatedAt<now-300000
  ||raw.expiresAt<=now||raw.expiresAt>now+300000
  ||!Array.isArray(raw.items)||raw.items.length>50
  ||!(raw.nextCursor===null||(typeof raw.nextCursor==='string'&&CURSOR.test(raw.nextCursor))))
  return null;
 const seen=new Set(),rows=[];
 for(const record of raw.items){
  if(!exact(record,cols)||!UUID.test(record.incidentId)
   ||seen.has(record.incidentId)||!categories.includes(record.category)
   ||!severities.includes(record.severity)||!statuses.includes(record.status)
   ||!safeInt(record.createdAt)||record.createdAt>now||!safeInt(record.revision)
   ||(severityFilter!==null&&record.severity!==severityFilter)
   ||(statusFilter!==null&&record.status!==statusFilter))return null;
  seen.add(record.incidentId);
  rows.push(Object.freeze({...record}));
 }
 // La API promete prioridad GLOBAL antes de paginar; validar orden de la página,
 // sin suponer cardinalidad total ni consistencia de snapshot entre consultas.
 for(let i=1;i<rows.length;i++){
  const a=rows[i-1],b=rows[i];
  const diff=severities.indexOf(a.severity)-severities.indexOf(b.severity);
  if(diff>0||(diff===0&&a.createdAt<b.createdAt))return null;
 }
 return Object.freeze({
  scope:'SERVER_FILTERED_PAGE_ONLY',severityFilter,statusFilter,
  priorityOrder:raw.priorityOrder,revision:raw.revision,generatedAt:raw.generatedAt,
  expiresAt:raw.expiresAt,nextCursor:raw.nextCursor,
  items:Object.freeze(rows),hasGlobalTotal:false,snapshotConsistent:false,
  operationsEnabled:false,emergencyDispatchEnabled:false
 });
}
export function createIncidentTriageG41Gateway({
 enabled=false,contractCertified=false,stagingRuntimeVerified=false,
 origin,pinnedOrigin,getSession,fetchImpl,onSessionInvalid=()=>{},
 now=()=>Date.now(),timeoutMs=8000,maxBytes=65536
}={}){
 const host=safeOrigin(origin),pin=safeOrigin(pinnedOrigin);
 // G41 OpenAPI: x-qore-runtime-wired=false, nunca conectar por simple contrato.
 const ready=enabled===true&&contractCertified===true&&stagingRuntimeVerified===true
  &&host!==null&&host===pin&&typeof getSession==='function'&&typeof fetchImpl==='function';
 let busy=false,epoch=0,activeController=null;
 function cancelPending(){
  // Revocación local en logout/rotación; nunca autoriza ni reintenta HTTP.
  epoch++;busy=false;
  if(activeController)activeController.abort();
  activeController=null;
 }
 async function fetchPage({severityFilter=null,statusFilter=null,cursor=null}={}){
  if(!ready)return fail('G41_RUNTIME_NOT_CERTIFIED');
  if(!allow(severityFilter,severities)||!allow(statusFilter,statuses)
   ||!(cursor===null||(typeof cursor==='string'&&CURSOR.test(cursor))))
   return fail('INVALID_FILTER_OR_CURSOR');
  if(busy)return fail('TRIAGE_READ_IN_FLIGHT');
  const started=++epoch;busy=true;let timer=null;
  try{
   let first;
   try{first=await getSession();}catch{return fail('AUTH_UNAVAILABLE');}
   if(started!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(!validSession(first,now()))return fail('FORBIDDEN');
   const ctl=new AbortController();activeController=ctl;
   const ms=Number.isSafeInteger(timeoutMs)
    &&timeoutMs>=1000&&timeoutMs<=30000?timeoutMs:8000;
   const deadline=now()+ms;
   timer=setTimeout(()=>ctl.abort(),ms);
   const timedOut=()=>ctl.signal.aborted||now()>=deadline;
   const params=[];
   if(severityFilter!==null)params.push('severity='+encodeURIComponent(severityFilter));
   if(statusFilter!==null)params.push('status='+encodeURIComponent(statusFilter));
   if(cursor!==null)params.push('cursor='+encodeURIComponent(cursor));
   const url=host+'/v1/staging/admin/incidents/triage-queue'
    +(params.length?'?'+params.join('&'):'');
   const response=await fetchImpl(url,{
    method:'GET',credentials:'omit',redirect:'error',cache:'no-store',
    referrerPolicy:'no-referrer',
    headers:{Authorization:'Bearer '+first.token,Accept:'application/json'},
    signal:ctl.signal
   });
   if(started!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!response||response.redirected===true)return fail('UNTRUSTED_REDIRECT');
   if(response.status===401||response.status===403){
    let after;
    try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
    if(started!==epoch)return fail('STALE_SESSION_RESPONSE');
    if(timedOut())return fail('NETWORK_OR_TIMEOUT');
    if(!validSession(after,now())||!same(first,after))return fail('STALE_SESSION_RESPONSE');
    onSessionInvalid();
    return fail(response.status===401?'AUTH_REQUIRED':'FORBIDDEN',response.status);
   }
   if(response.status===400)return fail('INVALID_OR_EXPIRED_CURSOR',400);
   if(response.status===429)return fail('RATE_LIMITED',429);
   if(response.status===503)return fail('SERVICE_UNAVAILABLE',503);
   if(response.status!==200||response.ok!==true)return fail('UNTRUSTED_TRIAGE_RESPONSE',response.status);
   if(!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type')??''))
    return fail('BAD_CONTENT_TYPE');
   const limit=Number.isSafeInteger(maxBytes)&&maxBytes>=1024&&maxBytes<=262144
    ?maxBytes:65536;
   const size=response.headers?.get?.('content-length');
   if(size!=null&&(!/^\d+$/.test(size)||Number(size)>limit))return fail('RESPONSE_TOO_LARGE');
   const parsed=await readBoundedResponseText(response,{limit,signal:ctl.signal,timedOut});
   if(started!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(!parsed.ok)return fail(parsed.code);
   let json;
   try{json=JSON.parse(parsed.text);}catch{return fail('BAD_SERVER_RESPONSE');}
   const page=projectG41TriagePage(json,{severityFilter,statusFilter,now:now()});
   if(!page)return fail('INVALID_G41_PAGE');
   let after;
   try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(started!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!validSession(after,now())||!same(first,after))return fail('STALE_SESSION_RESPONSE');
   return Object.freeze({ok:true,page,status:200});
  }catch{return fail(started!==epoch?'STALE_SESSION_RESPONSE':'NETWORK_OR_TIMEOUT');}
  finally{if(timer!==null)clearTimeout(timer);
   if(started===epoch){busy=false;activeController=null;}
  }
 }
 return Object.freeze({isConfigured:()=>Boolean(ready),fetchPage,cancelPending});
}
