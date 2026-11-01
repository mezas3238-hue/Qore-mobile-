import {readBoundedResponseText} from './bounded-json-response.mjs';
/**
 * G285 Owner AUTO fare publisher — browser holds only the signed AAL2 session.
 * POST is NOT a readback. No automatic retry: an uncertain commit must be
 * reconciled by the Owner through independent persisted database audit.
 * Zero keys, prices, Owners, sessions, zones or commissions are invented.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const ZONE=/^[A-Z_]{3,40}$/;
const KEYS=['requestKey','basePyg','perKmPyg','perMinutePyg','minimumPyg','commissionBps'];
const RECEIPT=['mode','commercialEnabled','ruleKey','zoneTag','commissionBps','commissionPercent','active','idempotent'];
const exact=(x,ks)=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.keys(x).length===ks.length&&ks.every(k=>Object.hasOwn(x,k));
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const fail=code=>Object.freeze({ok:false,code});
const draftValid=x=>exact(x,KEYS)&&UUID.test(x.requestKey??'')
 &&integer(x.basePyg,1000,1000000)&&integer(x.perKmPyg,0,100000)
 &&integer(x.perMinutePyg,0,20000)&&integer(x.minimumPyg,1000,1000000)
 &&integer(x.commissionBps,0,3000);
const active=(x,t)=>x?.role==='owner'&&x?.mfaVerified===true
 &&UUID.test(x.subject??'')&&typeof x.token==='string'
 &&x.token.length>=20&&x.token.length<=7900
 &&integer(x.expiresAt,t+1001,8640000000000000);
const same=(a,b)=>a.subject===b.subject&&a.role===b.role
 &&a.token===b.token&&a.expiresAt===b.expiresAt
 &&a.mfaVerified===b.mfaVerified;
function originOf(x){
 try{
  if(typeof x!=='string'||x.includes('\\'))return null;
  const url=new URL(x);
  if(url.protocol!=='https:'||url.port||url.username||url.password
    ||url.search||url.hash||url.pathname!=='/'||url.hostname.endsWith('.'))
   return null;
  return url.origin;
 }catch{return null;}
}
const receiptValid=(r,z,d)=>exact(r,RECEIPT)
 &&r.mode==='STAGING_DEMO_ONLY'&&r.commercialEnabled===false
 &&r.ruleKey==='G265_'+d.requestKey.replace(/-/g,'')
 &&r.zoneTag===z&&r.active===true&&typeof r.idempotent==='boolean'
 &&r.commissionBps===d.commissionBps
 &&r.commissionPercent===d.commissionBps/100;
export function createOwnerAutoFareGateway({
 enabled=false,contractCertified=false,origin,pinnedOrigin,
 getSession,fetchImpl,now=Date.now,timeoutMs=8000,maxBytes=4096
}={}){
 const host=originOf(origin);
 const ready=enabled===true&&contractCertified===true&&host!==null
  &&host===originOf(pinnedOrigin)&&typeof getSession==='function'
  &&typeof fetchImpl==='function';
 let busy=false;
 async function publish(zone,draft){
  if(!ready)return fail('G285_FARE_BACKEND_NOT_CERTIFIED');
  if(!ZONE.test(zone??'')||!draftValid(draft))
   return fail('G285_INVALID_OWNER_FARE');
  if(busy)return fail('G285_FARE_WRITE_IN_FLIGHT');
  busy=true;
  const ms=integer(timeoutMs,1000,30000)?timeoutMs:8000;
  const limit=integer(maxBytes,1024,8192)?maxBytes:4096;
  const controller=new AbortController();
  const deadline=now()+ms;
  const timer=setTimeout(()=>controller.abort(),ms);
  const expired=()=>controller.signal.aborted||now()>=deadline;
  try{
   const before=await getSession();
   if(expired())return fail('G285_NETWORK_OR_TIMEOUT');
   if(!active(before,now()))return fail('G285_OWNER_AAL2_REQUIRED');
   const response=await fetchImpl(host+'/v1/staging/owner/auto-fares/'+zone,{
    method:'POST',credentials:'omit',redirect:'error',cache:'no-store',
    referrerPolicy:'no-referrer',
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json',
     'Content-Type':'application/json'},signal:controller.signal,
    body:JSON.stringify(draft)
   });
   if(expired())return fail('G285_NETWORK_OR_TIMEOUT');
   if(!response||response.redirected===true)return fail('G285_UNTRUSTED_REDIRECT');
   const after=await getSession();
   if(expired())return fail('G285_NETWORK_OR_TIMEOUT');
   if(!active(after,now())||!same(before,after))
    return fail('G285_STALE_OWNER_SESSION');
   if(response.status===401||response.status===403)
    return fail('G285_OWNER_AUTH_DENIED');
   if(response.status!==200||response.ok!==true)
    return fail('G285_WRITE_UNCONFIRMED');
   if(!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type')??''))
    return fail('G285_BAD_CONTENT_TYPE');
   const declared=response.headers?.get?.('content-length');
   if(declared!=null&&(!/^\d+$/.test(declared)||Number(declared)>limit))
    return fail('G285_RESPONSE_TOO_LARGE');
   const body=await readBoundedResponseText(response,{
    limit,signal:controller.signal,timedOut:expired
   });
   if(!body.ok)return fail('G285_UNVERIFIED_RESPONSE');
   const last=await getSession();
   if(expired()||!active(last,now())||!same(before,last))
    return fail('G285_STALE_OWNER_SESSION');
   let data;try{data=JSON.parse(body.text);}
   catch{return fail('G285_BAD_JSON');}
   if(!receiptValid(data,zone,draft))
    return fail('G285_RECEIPT_MISMATCH');
   return Object.freeze({ok:true,data:Object.freeze({...data}),
    independentlyReadBack:false,externalJourneysCertified:0});
  }catch{return fail('G285_NETWORK_OR_TIMEOUT_OR_UNKNOWN_COMMIT');}
  finally{clearTimeout(timer);busy=false;}
 }
 return Object.freeze({isConfigured:()=>ready,publish});
}
