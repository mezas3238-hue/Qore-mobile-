/**
 * G263 native PostgreSQL-17 provenance reader for Admin D.
 * NOT the legacy CI-only priced service-trace contract. No billing claims.
 * Feature is OFF without independent Owner, HTTPS, G262 SQL and AAL2 signoff.
 * Never persists bearer, service data, storage or browser credentials.
 */
import {readBoundedResponseText} from './bounded-json-response.mjs';
const HOST='https://qore-mobile-backend-staging-staging.up.railway.app';
const KINDS=new Set(['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE']);
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const FIELDS=['mode','serviceKind','serviceId','requestKey','viewerId',
 'actorId','assignedParticipantOrLinkedDeliveryId','status','revision',
 'createdAt','changedAt','events','totalEvents','eventsTruncated',
 'serverPersisted','financialReconciliationCertified',
 'externalEndToEndCertified','productionEnabled'];
const fail=code=>Object.freeze({ok:false,code});
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function actor(s,now){
 return plain(s)&&s.role==='admin'&&s.mfaVerified===true&&
  ID.test(s.subject??'')&&typeof s.token==='string'&&
  /^[A-Za-z0-9._~-]{20,7900}$/.test(s.token)&&
  Number.isSafeInteger(s.expiresAt)&&s.expiresAt>now()+1000;
}
const same=(a,b)=>a.subject===b.subject&&a.token===b.token&&
 a.role===b.role&&a.expiresAt===b.expiresAt&&
 a.mfaVerified===b.mfaVerified;
function receipt(d,kind,id,viewer){
 if(!plain(d)||Object.keys(d).length!==FIELDS.length||
  FIELDS.some(k=>!Object.hasOwn(d,k))||
  d.mode!=='STAGING_DEMO_ONLY'||d.serviceKind!==kind||
  d.serviceId!==id||d.viewerId!==viewer||
  !ID.test(d.requestKey??'')||!ID.test(d.actorId??'')||
  !(d.assignedParticipantOrLinkedDeliveryId===null||
    ID.test(d.assignedParticipantOrLinkedDeliveryId??''))||
  !Number.isSafeInteger(d.revision)||d.revision<1||
  typeof d.status!=='string'||d.status.length>35||
  !Number.isFinite(Date.parse(d.createdAt))||
  !Number.isFinite(Date.parse(d.changedAt))||
  !Array.isArray(d.events)||d.events.length>64||
  !Number.isSafeInteger(d.totalEvents)||d.totalEvents<0||
  d.totalEvents<d.events.length||
  d.eventsTruncated!==(d.totalEvents>64)||
  d.serverPersisted!==true||
  d.financialReconciliationCertified!==false||
  d.externalEndToEndCertified!==false||
  d.productionEnabled!==false)return false;
 let revision=0;const seen=new Set();
 for(const e of d.events){
  if(!plain(e)||Object.keys(e).length!==4||
   !ID.test(e.eventId??'')||seen.has(e.eventId)||
   !Number.isSafeInteger(e.revision)||e.revision<=revision||
   typeof e.status!=='string'||e.status.length>35||
   !Number.isFinite(Date.parse(e.at)))return false;
  seen.add(e.eventId);revision=e.revision;
 }
 return true;
}
export function createG263NativeAdminReader({
 enabled=false,ownerApproved=false,externalHttpsVerified=false,
 nativePgVerified=false,aal2ServerVerified=false,
 origin,fetchImpl,getSession,now=Date.now
}={}){
 const ready=enabled===true&&ownerApproved===true&&
  externalHttpsVerified===true&&nativePgVerified===true&&
  aal2ServerVerified===true&&origin===HOST&&
  typeof fetchImpl==='function'&&typeof getSession==='function'&&
  typeof now==='function';
 let epoch=0,active=null;
 const cancelPending=()=>{epoch++;active?.abort();active=null;};
 async function read(kind,id){
  if(!ready)return fail('NATIVE_TRACE_NOT_CERTIFIED');
  if(!KINDS.has(kind)||!ID.test(id??'')||id!==id.toLowerCase())
   return fail('INVALID_ORIGINAL_ID');
  if(active!==null)return fail('NATIVE_READ_BUSY');
  const gen=epoch,abort=new AbortController();active=abort;
  let timeout;
  try{
   const before=await getSession();
   if(gen!==epoch||!actor(before,now()))return fail('ADMIN_AAL2_REQUIRED');
   timeout=setTimeout(()=>abort.abort(),7000);
   const response=await fetchImpl(origin+
    '/v1/staging/admin/native-services/'+kind+'/'+id+'/trace',{
    method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
    referrerPolicy:'no-referrer',
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json'},
    signal:abort.signal
   });
   if(gen!==epoch||abort.signal.aborted)
    return fail('STALE_OR_TIMEOUT');
   const next=await getSession();
   if(!actor(next,now())||!same(before,next))
    return fail('STALE_OR_REVOKED_SESSION');
   if(response?.redirected===true)return fail('UNTRUSTED_REDIRECT');
   if(response?.status===401||response?.status===403)
    return fail('ADMIN_SESSION_DENIED');
   if(response?.status===404)return fail('ORIGINAL_NOT_FOUND');
   if(response?.status===429)return fail('BACKEND_RATE_LIMIT');
   if(response?.status!==200||response?.ok!==true)
    return fail('BACKEND_NOT_READY');
   if(!/^application\/json(?:\s*;|$)/i.test(
     response.headers?.get?.('content-type')??''))
    return fail('BAD_CONTENT_TYPE');
   const advertised=response.headers?.get?.('content-length');
   if(advertised!==null&&advertised!==undefined&&
     (!/^\d+$/.test(advertised)||Number(advertised)>32768))
    return fail('RESPONSE_TOO_LARGE');
   const body=await readBoundedResponseText(response,{
    limit:32768,signal:abort.signal,timedOut:()=>abort.signal.aborted
   });
   if(!body.ok||gen!==epoch)return fail(body.code??'STALE_OR_TIMEOUT');
   let json;
   try{json=JSON.parse(body.text);}catch{return fail('BAD_JSON');}
   if(!receipt(json,kind,id,before.subject))
    return fail('INVALID_NATIVE_PROVENANCE');
   const finalSession=await getSession();
   if(gen!==epoch||abort.signal.aborted||
     !actor(finalSession,now())||!same(before,finalSession))
    return fail('STALE_OR_REVOKED_SESSION');
   const createdAt=now();
   return Object.freeze({ok:true,qaOnly:true,productionEnabled:false,
    data:Object.freeze({serviceKind:kind,serviceId:id,status:json.status,
     revision:json.revision,requestKey:json.requestKey,
     events:Object.freeze(json.events.map(e=>Object.freeze({...e}))),
     eventsTruncated:json.eventsTruncated,totalEvents:json.totalEvents,
     linkedDeliveryId:kind==='COMMERCE'?
      json.assignedParticipantOrLinkedDeliveryId:null,
     financialReconciliationCertified:false,
     externalEndToEndCertified:false,
     expiresAt:createdAt+15000})});
  }catch{return fail(gen!==epoch?'STALE_OR_REVOKED_SESSION':'BACKEND_NOT_READY');}
  finally{if(timeout!==undefined)clearTimeout(timeout);if(active===abort)active=null;}
 }
 return Object.freeze({isConfigured:()=>ready,read,cancelPending});
}
