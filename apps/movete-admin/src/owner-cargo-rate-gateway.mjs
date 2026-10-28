import {readBoundedResponseText} from './bounded-json-response.mjs';
/** D/G124 — signed Owner AAL2 cargo tariff client; OFF without external verification.
 * This is a browser transport, NOT a permission grant or an active tariff.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const ZONE=/^[A-Z_]{3,20}$/;
const RULE=/^[A-Za-z0-9._-]{1,48}$/;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length
 &&keys.every(k=>Object.hasOwn(x,k));
const integer=(n,lo,hi)=>Number.isSafeInteger(n)&&n>=lo&&n<=hi;
const fail=code=>Object.freeze({ok:false,code});
const KEYS=['requestKey','basePyg','perKmPyg','perMinutePyg','minimumPyg',
 'commissionBps','durationDays'];
const RESP=['vehicleKind','cargoZone','ruleId','ruleVersion','version','basePyg',
 'perKmPyg','perMinutePyg','minimumPyg','commissionBps','active','validUntil',
 'mode','liveEnabled','passengerSubsidyPolicyApplicable'];
const validDraft=d=>exact(d,KEYS)&&UUID.test(d.requestKey??'')
 &&integer(d.basePyg,0,1000000)&&integer(d.perKmPyg,0,100000)
 &&integer(d.perMinutePyg,0,20000)&&integer(d.minimumPyg,1,1000000)
 &&integer(d.commissionBps,0,3000)&&integer(d.durationDays,1,90);
const validReceipt=(d,kind,zone,t)=>exact(d,RESP)&&d.vehicleKind===kind
 &&d.cargoZone===zone&&UUID.test(d.ruleId??'')&&RULE.test(d.ruleVersion??'')
 &&integer(d.version,1,2147483647)
 &&integer(d.basePyg,0,1000000)&&integer(d.perKmPyg,0,100000)
 &&integer(d.perMinutePyg,0,20000)&&integer(d.minimumPyg,1,1000000)
 &&integer(d.commissionBps,0,3000)&&d.active===true
 &&typeof d.validUntil==='string'&&Number.isFinite(Date.parse(d.validUntil))
 &&Date.parse(d.validUntil)>t&&d.mode==='STAGING_DEMO_ONLY'
 &&d.liveEnabled===false&&d.passengerSubsidyPolicyApplicable===false;
const validActor=(x,t)=>obj(x)&&x.role==='owner'&&x.mfaVerified===true
 &&UUID.test(x.subject??'')&&typeof x.token==='string'
 &&x.token.length>=20&&integer(x.expiresAt,t+1001,8640000000000000);
const same=(a,b)=>a.subject===b.subject&&a.role===b.role
 &&a.mfaVerified===b.mfaVerified&&a.token===b.token
 &&a.expiresAt===b.expiresAt;
function originOf(value){
 try{
  if(typeof value!=='string'||value.includes('\\'))return null;
  const p=new URL(value);
  return p.protocol==='https:'&&!p.username&&!p.password&&!p.search
   &&!p.hash&&p.pathname==='/'&&!p.port&&!p.hostname.endsWith('.')
   ?p.origin:null;
 }catch{return null;}
}
export function createOwnerCargoRateGateway({
 enabled=false,contractCertified=false,origin,pinnedOrigin,getSession,
 fetchImpl,now=Date.now,timeoutMs=8000,maxBytes=4096
}={}){
 const host=originOf(origin);
 const ready=enabled===true&&contractCertified===true&&host!==null
  &&host===originOf(pinnedOrigin)&&typeof getSession==='function'
  &&typeof fetchImpl==='function';
 let busy=false;
 async function request(kind,zone,draft=null){
  if(!ready)return fail('CARGO_OWNER_BACKEND_NOT_CERTIFIED');
  if(!['AUTO','MOTO'].includes(kind)||!ZONE.test(zone??''))
   return fail('INVALID_CARGO_TARGET');
  if(draft!==null&&!validDraft(draft))return fail('INVALID_CARGO_DRAFT');
  if(busy)return fail('CARGO_REQUEST_IN_FLIGHT');
  busy=true;
  const ctl=new AbortController();
  const ms=integer(timeoutMs,1000,30000)?timeoutMs:8000;
  const deadline=now()+ms,timer=setTimeout(()=>ctl.abort(),ms);
  const timedOut=()=>ctl.signal.aborted||now()>=deadline;
  try{
   const before=await getSession();
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!validActor(before,now()))return fail('OWNER_AAL2_REQUIRED');
   const response=await fetchImpl(host+'/v1/staging/owner/delivery-rates/'
    +encodeURIComponent(kind)+'/'+encodeURIComponent(zone),{
    method:draft===null?'GET':'POST',credentials:'omit',cache:'no-store',
    redirect:'error',referrerPolicy:'no-referrer',
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json',
     ...(draft===null?{}:{'Content-Type':'application/json'})},
    signal:ctl.signal,...(draft===null?{}:{body:JSON.stringify(draft)})
   });
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!response||response.redirected===true)return fail('UNTRUSTED_REDIRECT');
   const after=await getSession();
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!validActor(after,now())||!same(before,after))
    return fail('STALE_OWNER_SESSION');
   if(response.status===401||response.status===403)
    return fail('OWNER_AUTH_REJECTED');
   if(response.status===404)return fail('CARGO_RATE_NOT_CONFIGURED');
   if(response.status!==200||response.ok!==true)
    return fail('CARGO_RATE_NOT_CONFIRMED');
   if(!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type')??''))
    return fail('BAD_CONTENT_TYPE');
   const limit=integer(maxBytes,1024,8192)?maxBytes:4096;
   const len=response.headers?.get?.('content-length');
   if(len!=null&&(!/^\d+$/.test(len)||Number(len)>limit))
    return fail('RESPONSE_TOO_LARGE');
   const body=await readBoundedResponseText(response,{
    limit,signal:ctl.signal,timedOut
   });
   if(!body.ok)return fail(body.code);
   let dto;try{dto=JSON.parse(body.text);}catch{return fail('BAD_SERVER_RESPONSE');}
   if(!validReceipt(dto,kind,zone,now()))return fail('INVALID_CARGO_RECEIPT');
   if(draft!==null&&KEYS.filter(x=>x!=='requestKey'&&x!=='durationDays')
    .some(x=>dto[x]!==draft[x]))return fail('CARGO_WRITE_MISMATCH');
   const final=await getSession();
   if(timedOut()||!validActor(final,now())||!same(before,final))
    return fail('STALE_OWNER_SESSION');
   return Object.freeze({ok:true,data:Object.freeze({...dto})});
  }catch{return fail(ctl.signal.aborted?'NETWORK_OR_TIMEOUT':'CARGO_RATE_UNAVAILABLE');}
  finally{clearTimeout(timer);busy=false;}
 }
 return Object.freeze({isConfigured:()=>ready,read:(k,z)=>request(k,z),
  change:(k,z,d)=>request(k,z,d)});
}
