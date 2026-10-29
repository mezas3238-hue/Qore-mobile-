import {readBoundedResponseText} from './bounded-json-response.mjs';
/** G158 Admin D: read-only fraud-allegation summary from original G155/G157,
 * never automatic punishment, dispatch ranking, client-borne admin authority.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const TARGET=new Set(['DRIVER','COURIER','MERCHANT','CLIENT']);
const TIER=new Set(['SINGLE_SOURCE_REVIEW','MULTI_SOURCE_REVIEW']);
const EXACT=['qaOnly','productionEnabled','automaticSuspension',
 'dispatchPenaltyApplied','findingEstablished','hasMore','items',
 'viewerId','serverPersisted','observedAt','expiresAt','scope'];
const ITEM=['ratedKind','ratedId','recentReports','independentReporters',
 'distinctServices','reviewTier','allegationOnly'];
const fail=code=>Object.freeze({ok:false,code});
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length
 &&keys.every(k=>Object.hasOwn(x,k));
const hostOf=x=>{
 try{
  if(typeof x!=='string'||x.includes('\\'))return null;
  const u=new URL(x);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&
   !u.search&&!u.hash&&u.pathname==='/'&&
   /^[a-z0-9-]+\.onrender\.com$/.test(u.hostname)?u.origin:null;
 }catch{return null;}
};
const valid=(s,t)=>obj(s)&&s.role==='admin'&&s.mfaVerified===true
 &&typeof s.subject==='string'&&UUID.test(s.subject)
 &&typeof s.token==='string'&&/^[A-Za-z0-9._~-]{20,7900}$/.test(s.token)
 &&Number.isSafeInteger(s.expiresAt)&&s.expiresAt>t+1000;
const same=(a,b)=>a.subject===b.subject&&a.token===b.token
 &&a.expiresAt===b.expiresAt&&a.mfaVerified===b.mfaVerified&&a.role===b.role;
export function projectG158FraudReports(raw,{subject,at=Date.now()}={}){
 if(!exact(raw,EXACT)||!UUID.test(subject??'')||
  raw.viewerId!==subject||raw.qaOnly!==true||
  raw.productionEnabled!==false||raw.automaticSuspension!==false||
  raw.dispatchPenaltyApplied!==false||raw.findingEstablished!==false||
  raw.serverPersisted!==true||raw.scope!=='admin.incidents.read'||
  typeof raw.hasMore!=='boolean'||!Array.isArray(raw.items)||
  raw.items.length>50||(raw.hasMore&&raw.items.length!==50)||
  !Number.isSafeInteger(raw.observedAt)||raw.observedAt>at||
  at-raw.observedAt>30000||!Number.isSafeInteger(raw.expiresAt)||
  raw.expiresAt<=at||raw.expiresAt>at+30000)return null;
 const seen=new Set(),items=[];
 for(const x of raw.items){
  if(!exact(x,ITEM)||!TARGET.has(x.ratedKind)||!UUID.test(x.ratedId??'')||
   seen.has(x.ratedKind+':'+x.ratedId)||
   ![x.recentReports,x.independentReporters,x.distinctServices]
    .every(v=>Number.isSafeInteger(v)&&v>=1)||
   x.independentReporters>x.recentReports||
   x.distinctServices>x.recentReports||!TIER.has(x.reviewTier)||
   x.allegationOnly!==true||
   (x.reviewTier==='MULTI_SOURCE_REVIEW')!==
   (x.recentReports>=3&&x.independentReporters>=3&&x.distinctServices>=3))
   return null;
  seen.add(x.ratedKind+':'+x.ratedId);
  items.push(Object.freeze({...x}));
 }
 return Object.freeze({items:Object.freeze(items),
  hasMore:raw.hasMore,observedAt:raw.observedAt,expiresAt:raw.expiresAt,
  allegationOnly:true,automaticSuspension:false,dispatchPenaltyApplied:false});
}
export function createG158FraudReportsClient({
 enabled=false,ownerApproved=false,contractVerified=false,
 externalRuntimeVerified=false,serverMfaVerified=false,
 serverRbacVerified=false,serverRevocationVerified=false,
 origin,pinnedOrigin,getSession,fetchImpl,now=Date.now
}={}){
 const host=hostOf(origin);
 const ready=enabled===true&&ownerApproved===true&&contractVerified===true
  &&externalRuntimeVerified===true&&serverMfaVerified===true
  &&serverRbacVerified===true&&serverRevocationVerified===true
  &&host!==null&&host===hostOf(pinnedOrigin)
  &&typeof getSession==='function'&&typeof fetchImpl==='function';
 let active=false;
 async function fetchReports(){
  if(!ready)return fail('G158_EXTERNAL_RUNTIME_NOT_CERTIFIED');
  if(active)return fail('G158_READ_IN_FLIGHT');
  active=true;
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),8000);
  const deadline=now()+8000;
  try{
   const before=await getSession();
   if(!valid(before,now()))return fail('G158_ADMIN_AAL2_REQUIRED');
   const response=await fetchImpl(host+'/v1/staging/admin/fraud/verified-reports',{
    method:'GET',credentials:'omit',cache:'no-store',redirect:'error',
    referrerPolicy:'no-referrer',
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json'},
    signal:ctl.signal
   });
   if(ctl.signal.aborted||now()>=deadline)return fail('G158_NETWORK_TIMEOUT');
   const after=await getSession();
   if(!valid(after,now())||!same(before,after))return fail('G158_SESSION_CHANGED');
   if(!response||response.redirected===true)return fail('G158_REDIRECT_DENIED');
   if(response.status===401||response.status===403)return fail('G158_ACCESS_DENIED');
   if(response.status===429)return fail('G158_RATE_LIMITED');
   if(response.status!==200||response.ok!==true)return fail('G158_SERVER_UNAVAILABLE');
   if(!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type')??''))
    return fail('G158_CONTENT_TYPE_INVALID');
   const parsed=await readBoundedResponseText(response,{
    limit:16384,signal:ctl.signal,timedOut:()=>ctl.signal.aborted||now()>=deadline
   });
   if(!parsed.ok)return fail('G158_UNTRUSTED_RESPONSE');
   let body;try{body=JSON.parse(parsed.text);}catch{return fail('G158_UNTRUSTED_RESPONSE');}
   const page=projectG158FraudReports(body,{subject:before.subject,at:now()});
   if(!page)return fail('G158_UNTRUSTED_RESPONSE');
   const final=await getSession();
   if(!valid(final,now())||!same(before,final))return fail('G158_SESSION_CHANGED');
   return Object.freeze({ok:true,page});
  }catch{return fail('G158_NETWORK_TIMEOUT');}
  finally{clearTimeout(timer);active=false;}
 }
 return Object.freeze({isConfigured:()=>Boolean(ready),fetchReports});
}
