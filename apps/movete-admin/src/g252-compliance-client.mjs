import {readBoundedResponseText} from './bounded-json-response.mjs';
/** G252: Admin AAL2 read-only document alerts. Default OFF until server
 * provenance, IdP, RLS and external STAGING have all been certified.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const KINDS=new Set(['licencia','identidad_frente','identidad_dorso',
 'cedula_verde','habilitacion','seguro','inspeccion','rostro_selfie']);
const BANDS=new Set(['D30','D15','D07','D01','EXPIRED']);
const FIELDS=['mode','scope','viewerId','items','hasMore','observedAt',
 'expiresAt','serverPersisted','documentFilesExposed','automaticApproval',
 'adminDispatchControl','qaOnly','productionEnabled'];
const ITEM=['driverId','kind','band','validUntilMs'];
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const fail=code=>Object.freeze({ok:false,code});
function originOf(raw){
 try{
  if(typeof raw!=='string'||raw.includes('\\'))return null;
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.port||u.username||u.password||
   u.pathname!=='/'||u.search||u.hash||
   !(/^[a-z0-9-]+\.up\.railway\.app$/.test(u.hostname)||
    /^[a-z0-9-]+\.onrender\.com$/.test(u.hostname)))
   return null;
  return u.origin;
 }catch{return null;}
}
const validSession=(s,at)=>s&&s.role==='admin'&&s.mfaVerified===true
 &&typeof s.subject==='string'&&UUID.test(s.subject)&&
 typeof s.token==='string'&&/^[A-Za-z0-9._~-]{20,7900}$/.test(s.token)
 &&Number.isSafeInteger(s.expiresAt)&&s.expiresAt>at+1000;
const same=(a,b)=>a.subject===b.subject&&a.token===b.token
 &&a.role===b.role&&a.mfaVerified===b.mfaVerified
 &&a.expiresAt===b.expiresAt;
export function projectG252ComplianceAlerts(raw,{subject,at=Date.now()}={}){
 if(!exact(raw,FIELDS)||raw.mode!=='STAGING_DEMO_ONLY'||
  raw.scope!=='admin.compliance.document_alerts.read'||
  !UUID.test(subject??'')||raw.viewerId!==subject||
  raw.qaOnly!==true||raw.productionEnabled!==false||
  raw.documentFilesExposed!==false||raw.automaticApproval!==false||
  raw.adminDispatchControl!==false||raw.serverPersisted!==true||
  typeof raw.hasMore!=='boolean'||!Array.isArray(raw.items)||
  raw.items.length>50||raw.hasMore&&raw.items.length!==50||
  !Number.isSafeInteger(raw.observedAt)||raw.observedAt>at||
  at-raw.observedAt>30000||!Number.isSafeInteger(raw.expiresAt)||
  raw.expiresAt<=at||raw.expiresAt>at+30000)return null;
 const seen=new Set(),items=[];
 for(const x of raw.items){
  if(!exact(x,ITEM)||!UUID.test(x.driverId??'')||
   !KINDS.has(x.kind)||!BANDS.has(x.band)||
   !Number.isSafeInteger(x.validUntilMs)||x.validUntilMs<=0)return null;
  const key=x.driverId+':'+x.kind+':'+x.band;
  if(seen.has(key))return null;
  seen.add(key);items.push(Object.freeze({...x}));
 }
 return Object.freeze({items:Object.freeze(items),hasMore:raw.hasMore,
  observedAt:raw.observedAt,expiresAt:raw.expiresAt});
}
export function createG252ComplianceClient({
 enabled=false,ownerApproved=false,contractVerified=false,
 externalRuntimeVerified=false,serverMfaVerified=false,
 serverRbacVerified=false,serverRevocationVerified=false,
 origin,pinnedOrigin,getSession,fetchImpl,now=Date.now
}={}){
 const host=originOf(origin);
 const ready=enabled===true&&ownerApproved===true&&contractVerified===true
  &&externalRuntimeVerified===true&&serverMfaVerified===true&&
  serverRbacVerified===true&&serverRevocationVerified===true&&
  host!==null&&host===originOf(pinnedOrigin)&&
  typeof getSession==='function'&&typeof fetchImpl==='function';
 let active=false;
 async function fetchAlerts(){
  if(!ready)return fail('G252_NOT_CERTIFIED');
  if(active)return fail('G252_READ_IN_FLIGHT');
  active=true;
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(),8000);
  const deadline=now()+8000;
  try{
   const before=await getSession();
   if(!validSession(before,now()))return fail('G252_ADMIN_AAL2_REQUIRED');
   const response=await fetchImpl(
    host+'/v1/staging/admin/compliance/document-alerts',{
     method:'GET',credentials:'omit',cache:'no-store',
     redirect:'error',referrerPolicy:'no-referrer',
     headers:{Authorization:'Bearer '+before.token,Accept:'application/json'},
     signal:ctl.signal
    });
   if(ctl.signal.aborted||now()>=deadline)return fail('G252_NETWORK_TIMEOUT');
   const after=await getSession();
   if(!validSession(after,now())||!same(before,after))
    return fail('G252_SESSION_CHANGED');
   if(!response||response.redirected===true)
    return fail('G252_REDIRECT_DENIED');
   if(response.status===401||response.status===403)
    return fail('G252_ACCESS_DENIED');
   if(response.status===429)return fail('G252_RATE_LIMITED');
   if(response.status!==200||response.ok!==true)
    return fail('G252_SERVER_UNAVAILABLE');
   if(!/^application\/json(?:\s*;|$)/i.test(
     response.headers?.get?.('content-type')??''))
    return fail('G252_CONTENT_TYPE_INVALID');
   const parsed=await readBoundedResponseText(response,{
    limit:16384,signal:ctl.signal,
    timedOut:()=>ctl.signal.aborted||now()>=deadline
   });
   if(!parsed.ok)return fail('G252_UNTRUSTED_RESPONSE');
   let raw;try{raw=JSON.parse(parsed.text);}
   catch{return fail('G252_UNTRUSTED_RESPONSE');}
   const page=projectG252ComplianceAlerts(raw,{subject:before.subject,at:now()});
   if(!page)return fail('G252_UNTRUSTED_RESPONSE');
   const final=await getSession();
   if(!validSession(final,now())||!same(before,final))
    return fail('G252_SESSION_CHANGED');
   return Object.freeze({ok:true,page});
  }catch{return fail('G252_NETWORK_TIMEOUT');}
  finally{clearTimeout(timer);active=false;}
 }
 return Object.freeze({isConfigured:()=>Boolean(ready),fetchAlerts});
}
