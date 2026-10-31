import {readBoundedResponseText} from './bounded-http-response.mjs';

/**
 * Client physical-device reachability probe for a pinned, owner-authorized
 * Render STAGING origin. A 200 only proves PROCESS_UP_ONLY, never provider
 * routing, Auth, PostgreSQL persistence, live dispatch or commercial readiness.
 * No JWT, cookies, address, phone or location is transmitted.
 */
const error=code=>Object.freeze({ok:false,code,commercialReady:false});
function pinned(raw){
 try{
  if(typeof raw!=='string'||raw.includes('\\'))return null;
  const u=new URL(raw);
  return u.protocol==='https:'&&u.origin===raw&&!u.username&&!u.password
   &&!u.port&&!u.search&&!u.hash&&u.pathname==='/'
   &&/^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?\.(?:onrender\.com|up\.railway\.app)$/.test(u.hostname)
   ?u.origin:null;
 }catch{return null;}
}
export function createF1StagingConnectivityProbe({
 origin,pinnedOrigin,fetchImpl=fetch,now=Date.now,timeoutMs=5000
}={}){
 const host=pinned(origin),expected=pinned(pinnedOrigin);
 const configured=host!==null&&expected!==null&&host===expected
  &&typeof fetchImpl==='function'&&typeof now==='function'
  &&Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=10000;
 let busy=false;
 async function check(){
  if(!configured)return error('STAGING_ORIGIN_NOT_CONFIGURED');
  if(busy)return error('STAGING_CHECK_IN_PROGRESS');
  busy=true;
  const controller=new AbortController(),started=now();
  const deadline=started+timeoutMs;
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  const timedOut=()=>controller.signal.aborted||now()>=deadline;
  try{
   const response=await fetchImpl(host+'/_qore/liveness',{
    method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
    referrerPolicy:'no-referrer',
    headers:{Accept:'application/json'},signal:controller.signal
   });
   if(timedOut())return error('STAGING_TIMEOUT');
   if(!response||response.redirected===true||
    response.status!==200||response.ok!==true)
    return error('STAGING_HTTP_UNAVAILABLE');
   if(!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type')??''))
    return error('STAGING_INVALID_RESPONSE');
   const declared=response.headers?.get?.('content-length');
   if(declared!=null&&(!/^\d+$/.test(declared)||Number(declared)>2048))
    return error('STAGING_INVALID_RESPONSE');
   const read=await readBoundedResponseText(response,{
    limit:2048,signal:controller.signal,timedOut
   });
   if(!read.ok)return error(read.code);
   let proof;try{proof=JSON.parse(read.text);}catch{return error('STAGING_INVALID_RESPONSE');}
   if(!proof||typeof proof!=='object'||Array.isArray(proof)||
    Object.keys(proof).length!==2||proof.state!=='PROCESS_UP_ONLY'||
    proof.commercialRidesEnabled!==false)
    return error('STAGING_INVALID_RESPONSE');
   if(timedOut())return error('STAGING_TIMEOUT');
   return Object.freeze({ok:true,code:'STAGING_PROCESS_REACHABLE',
    state:'PROCESS_UP_ONLY',commercialReady:false});
  }catch{return error('STAGING_NETWORK_UNAVAILABLE');}
  finally{clearTimeout(timeout);busy=false;}
 }
 return Object.freeze({isConfigured:()=>configured,check});
}
