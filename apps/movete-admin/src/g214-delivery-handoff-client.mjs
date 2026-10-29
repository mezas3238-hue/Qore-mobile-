import {readBoundedResponseText} from './bounded-json-response.mjs';
/** G214 D Admin: read terminal original AUTO/MOTO courier evidence and
 * distinct recipient G187 ACK. Read-only; never KYC, GPS, PSP or LIVE.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const KEY=['mode','viewerId','serviceId','serviceKind','bookingRequestKey',
 'quoteId','deliveryState','revision','courierAccepted','courierProofCommitted',
 'recipientBound','recipientConfirmed','eligibleForSettlement',
 'paymentAuthorized','commerciallyCertified','legalGate','commerceOrderId',
 'observedAt','expiresAt','serverPersisted','qaOnly','productionEnabled'];
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,k)=>plain(x)&&Object.keys(x).length===k.length&&
 k.every(v=>Object.hasOwn(x,v));
const fail=code=>Object.freeze({ok:false,code});
const validUuid=x=>typeof x==='string'&&UUID.test(x);
const num=x=>Number.isSafeInteger(x)&&x>=0;
function originOf(x){
 try{
  if(typeof x!=='string'||x.includes('\\'))return null;
  const u=new URL(x);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port
   &&u.pathname==='/'&&!u.search&&!u.hash&&
   /^[a-z0-9-]+\.onrender\.com$/.test(u.hostname)?u.origin:null;
 }catch{return null;}
}
const sessionOk=(s,t)=>plain(s)&&s.role==='admin'&&s.mfaVerified===true
 &&validUuid(s.subject)&&num(s.expiresAt)&&s.expiresAt>t+1000
 &&typeof s.token==='string'&&/^[A-Za-z0-9._~-]{20,7900}$/.test(s.token);
const same=(a,b)=>a.subject===b.subject&&a.token===b.token
 &&a.role===b.role&&a.mfaVerified===b.mfaVerified&&a.expiresAt===b.expiresAt;
export function validateG214AdminHandoff(r,{kind,id,actor,at}={}){
 if(!exact(r,KEY)||r.mode!=='STAGING_DEMO_ONLY'||
 r.serviceKind!==kind||r.serviceId!==id||r.viewerId!==actor||
 !validUuid(r.bookingRequestKey)||!validUuid(r.quoteId)||
 !['delivered','disputed','returned'].includes(r.deliveryState)||
 r.revision!==({delivered:4,disputed:5,returned:6}[r.deliveryState])||
 r.courierAccepted!==true||r.courierProofCommitted!==true||
 typeof r.recipientBound!=='boolean'||typeof r.recipientConfirmed!=='boolean'||
 (r.recipientConfirmed&&!r.recipientBound)||
 r.eligibleForSettlement!==(r.deliveryState==='delivered'&&r.recipientConfirmed)||
 r.paymentAuthorized!==false||r.commerciallyCertified!==false||
 r.legalGate!=='EXTERNAL_NOT_CERTIFIED'||
 (r.commerceOrderId!==null&&!validUuid(r.commerceOrderId))||
 !num(at)||!num(r.observedAt)||r.observedAt>at||at-r.observedAt>30000||
 !num(r.expiresAt)||r.expiresAt<=at||r.expiresAt>at+60000||
 r.serverPersisted!==true||r.qaOnly!==true||r.productionEnabled!==false)
 return null;
 return Object.freeze({...r});
}
export function createG214AdminHandoffClient({
 enabled=false,ownerApproved=false,contractVerified=false,
 externalRuntimeVerified=false,serverMfaVerified=false,
 serverRbacVerified=false,serverRevocationVerified=false,
 origin,pinnedOrigin,getSession,fetchImpl=fetch,now=Date.now
}={}){
 const host=originOf(origin);
 const ready=enabled===true&&ownerApproved===true&&contractVerified===true
 &&externalRuntimeVerified===true&&serverMfaVerified===true
 &&serverRbacVerified===true&&serverRevocationVerified===true
 &&host!==null&&host===originOf(pinnedOrigin)
 &&typeof getSession==='function'&&typeof fetchImpl==='function';
 let active=false;let epoch=0;let ctl=null;
 function cancelPending(){epoch++;ctl?.abort();ctl=null;}
 async function read(kind,id){
  if(!ready)return fail('G214_EXTERNAL_AUTHORITY_NOT_CERTIFIED');
  if(!['DELIVERY_AUTO','DELIVERY_MOTO'].includes(kind)||!validUuid(id))
   return fail('G214_INVALID_SERVICE');
  if(active)return fail('G214_READ_IN_FLIGHT');
  active=true;const version=epoch;
  const abort=new AbortController();ctl=abort;
  const timer=setTimeout(()=>abort.abort(),8000),deadline=now()+8000;
  try{
   const initial=await getSession();
   if(!sessionOk(initial,now())||epoch!==version)
    return fail('G214_ADMIN_AAL2_REQUIRED');
   const response=await fetchImpl(host+'/v1/staging/admin/services/'+kind+
    '/'+id.toLowerCase()+'/handoff',{
     method:'GET',credentials:'omit',cache:'no-store',redirect:'error',
     referrerPolicy:'no-referrer',
     headers:{Authorization:'Bearer '+initial.token,Accept:'application/json'},
     signal:abort.signal
    });
   if(abort.signal.aborted||now()>=deadline||version!==epoch)
    return fail('G214_TIMEOUT_OR_STALE');
   const after=await getSession();
   if(!sessionOk(after,now())||!same(initial,after))
    return fail('G214_SESSION_CHANGED');
   if(!response||response.redirected===true)return fail('G214_REDIRECT_DENIED');
   if(response.status===401||response.status===403)return fail('G214_ACCESS_DENIED');
   if(response.status===404)return fail('G214_HANDOFF_NOT_FOUND');
   if(response.status===429)return fail('G214_RATE_LIMIT');
   if(response.status!==200||response.ok!==true)return fail('G214_SERVER_UNAVAILABLE');
   if(!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type')??''))
    return fail('G214_UNTRUSTED_RECEIPT');
   const raw=await readBoundedResponseText(response,{
    limit:8192,signal:abort.signal,
    timedOut:()=>abort.signal.aborted||now()>=deadline||version!==epoch
   });
   if(!raw.ok)return fail('G214_UNTRUSTED_RECEIPT');
   let json;try{json=JSON.parse(raw.text);}catch{return fail('G214_UNTRUSTED_RECEIPT');}
   const result=validateG214AdminHandoff(json,{kind,id:id.toLowerCase(),
    actor:initial.subject,at:now()});
   if(!result)return fail('G214_UNTRUSTED_RECEIPT');
   const last=await getSession();
   if(!sessionOk(last,now())||!same(initial,last)||version!==epoch
    ||abort.signal.aborted)return fail('G214_SESSION_CHANGED');
   return Object.freeze({ok:true,item:result});
  }catch{return fail('G214_NETWORK_UNAVAILABLE');}
  finally{clearTimeout(timer);if(ctl===abort)ctl=null;active=false;}
 }
 return Object.freeze({read,isConfigured:()=>ready,cancelPending});
}
