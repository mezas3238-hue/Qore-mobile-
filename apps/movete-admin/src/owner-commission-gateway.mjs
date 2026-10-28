import {readBoundedResponseText} from './bounded-json-response.mjs';
/** Browser Owner commission client: server decides prices, role and 10% subsidy.
 * Disabled until the external G116 backend and Owner AAL2 are certified.
 */
const SERVICES=new Set(['AUTO_RIDE','MOTO_RIDE']);
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const fail=code=>Object.freeze({ok:false,code});
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)
 &&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
function originOf(url){
 try{
  if(typeof url!=='string'||url.includes('\\'))return null;
  const p=new URL(url);
  return p.protocol==='https:'&&!p.username&&!p.password&&!p.search&&!p.hash
   &&p.pathname==='/'&&!p.port&&!p.hostname.endsWith('.')?p.origin:null;
 }catch{return null;}
}
const safe=x=>exact(x,['serviceKind','commissionBps','subsidyBps','version',
 'mode','productionEnabled'])&&SERVICES.has(x.serviceKind)
 &&Number.isSafeInteger(x.commissionBps)&&x.commissionBps>=1000
 &&x.commissionBps<=3000&&x.subsidyBps===1000
 &&Number.isSafeInteger(x.version)&&x.version>=1
 &&x.mode==='STAGING_DEMO_ONLY'&&x.productionEnabled===false;
const active=(x,at)=>x?.role==='owner'&&x?.mfaVerified===true
 &&typeof x.token==='string'&&x.token.length>=20
 &&typeof x.subject==='string'&&UUID.test(x.subject)
 &&Number.isSafeInteger(x.expiresAt)&&x.expiresAt>at+1000;
const same=(a,b)=>active(a,0)&&active(b,0)
 &&a.subject===b.subject&&a.role===b.role&&a.mfaVerified===b.mfaVerified
 &&a.token===b.token&&a.expiresAt===b.expiresAt;
export function createOwnerCommissionGateway({
 enabled=false,contractCertified=false,origin,pinnedOrigin,
 getSession,fetchImpl,now=Date.now,timeoutMs=8000,maxBytes=4096
}={}){
 const host=originOf(origin),pin=originOf(pinnedOrigin);
 const ready=enabled===true&&contractCertified===true&&host!==null
 &&host===pin&&typeof getSession==='function'&&typeof fetchImpl==='function';
 let busy=false;
 async function send(service,update=null){
  if(!ready)return fail('G116_OWNER_BACKEND_NOT_CERTIFIED');
  if(!SERVICES.has(service))return fail('INVALID_SERVICE');
  if(busy)return fail('OWNER_COMMISSION_IN_FLIGHT');
  if(update!==null&&(!exact(update,['requestKey','commissionBps'])
    ||!UUID.test(update.requestKey)
    ||!Number.isSafeInteger(update.commissionBps)
    ||update.commissionBps<1000||update.commissionBps>3000))
   return fail('INVALID_COMMISSION');
  busy=true;
  const ctl=new AbortController();
  const ms=Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000
   &&timeoutMs<=30000?timeoutMs:8000;
  const deadline=now()+ms;
  const timer=setTimeout(()=>ctl.abort(),ms);
  const timedOut=()=>ctl.signal.aborted||now()>=deadline;
  try{
   const before=await getSession();
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!active(before,now()))return fail('OWNER_AAL2_REQUIRED');
   const response=await fetchImpl(host+'/v1/staging/owner/commissions/'+service,{
    method:update===null?'GET':'POST',credentials:'omit',redirect:'error',
    cache:'no-store',referrerPolicy:'no-referrer',
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json',
     ...(update===null?{}:{'Content-Type':'application/json'})},
    signal:ctl.signal,
    ...(update===null?{}:{body:JSON.stringify(update)})
   });
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(response?.redirected===true)return fail('UNTRUSTED_REDIRECT');
   const after=await getSession();
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!active(after,now())||!same(before,after))return fail('STALE_OWNER_SESSION');
   if(response?.status!==200||response?.ok!==true)
    return fail('OWNER_COMMISSION_NOT_CONFIRMED');
   if(!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type')??''))
    return fail('INVALID_CONTENT_TYPE');
   const limit=Number.isSafeInteger(maxBytes)&&maxBytes>=1024
    &&maxBytes<=8192?maxBytes:4096;
   const advertised=response.headers?.get?.('content-length');
   if(advertised!=null&&(!/^\d+$/.test(advertised)||Number(advertised)>limit))
    return fail('RESPONSE_TOO_LARGE');
   const body=await readBoundedResponseText(response,{
    limit,signal:ctl.signal,timedOut
   });
   if(!body.ok)return fail(body.code);
   const again=await getSession();
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!active(again,now())||!same(before,again))return fail('STALE_OWNER_SESSION');
   let data;try{data=JSON.parse(body.text);}catch{return fail('INVALID_RESPONSE');}
   if(!safe(data)||data.serviceKind!==service
    ||update!==null&&data.commissionBps!==update.commissionBps)
    return fail('INVALID_POLICY_RECEIPT');
   return Object.freeze({ok:true,data:Object.freeze({...data})});
  }catch{return fail(ctl.signal.aborted?'NETWORK_OR_TIMEOUT':'OWNER_COMMISSION_UNAVAILABLE');}
  finally{clearTimeout(timer);busy=false;}
 }
 return Object.freeze({isConfigured:()=>Boolean(ready),
  read:service=>send(service),change:(service,body)=>send(service,body)});
}
