/** G139: B Buyer HTTP transport to G45 synthetic stock reservation.
 * A persisted QA receipt is NEVER a paid or deliverable order.
 */
import {readBoundedResponseText} from './bounded-http-response.mjs';
import {validateG45ReserveRequest,projectG45QaReserveReceipt,
 prepareG45QaCancelDraft,projectG45QaCancelReceipt,
 projectG144OrderRecoveryReceipt}
 from './g45-order-qa-contract.mjs';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const fail=code=>Object.freeze({ok:false,code,paymentEnabled:false});
function origin(x){
 try{
  if(typeof x!=='string'||x.includes('\\'))return null;
  const u=new URL(x);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&
   !u.search&&!u.hash&&u.pathname==='/'&&!u.hostname.endsWith('.')
   ?u.origin:null;
 }catch{return null;}
}
const good=(s,t)=>s?.role==='passenger'&&UUID.test(s.subject??'')
 &&typeof s.token==='string'&&/^[A-Za-z0-9._~-]{20,7900}$/.test(s.token)
 &&Number.isSafeInteger(s.sessionRevision)&&s.sessionRevision>=0
 &&Number.isSafeInteger(s.expiresAt)&&s.expiresAt>t+1000;
const same=(x,y)=>x.subject===y.subject&&x.token===y.token
 &&x.expiresAt===y.expiresAt&&x.sessionRevision===y.sessionRevision;
export function createG139CommerceQaHttpGateway({
 enabled=false,contractCertified=false,disposableQaVerified=false,
 origin:raw,pinnedOrigin,getSession,fetchImpl=fetch,
 now=Date.now,timeoutMs=8000
}={}){
 const host=origin(raw),pinned=origin(pinnedOrigin);
 const ready=enabled===true&&contractCertified===true
  &&disposableQaVerified===true&&host!==null&&host===pinned
  &&typeof getSession==='function'&&typeof fetchImpl==='function';
 let busy=false;
 async function send(type,body){
  if(!ready)return fail('G139_NOT_CERTIFIED');
  if(busy)return fail('G139_BUSY');
  if(type==='reserve'&&!validateG45ReserveRequest(body))
   return fail('INVALID_G45_RESERVE');
  if(type==='cancel'&&!prepareG45QaCancelDraft({
   orderId:body?.orderId,body:{cancelKey:body?.cancelKey}
  }).ok)return fail('INVALID_G45_CANCEL');
  busy=true;
  const abort=new AbortController(),ms=Number.isSafeInteger(timeoutMs)
   &&timeoutMs>=1000&&timeoutMs<=30000?timeoutMs:8000;
  const timeout=setTimeout(()=>abort.abort(),ms);
  try{
   const before=await getSession();
   if(!good(before,now()))return fail('AUTH_REQUIRED');
   const res=await fetchImpl(host+'/v1/staging/buyer/orders/qa/'+type,{
    method:'POST',credentials:'omit',redirect:'error',cache:'no-store',
    referrerPolicy:'no-referrer',signal:abort.signal,
    headers:{Authorization:'Bearer '+before.token,
     Accept:'application/json','Content-Type':'application/json'},
    body:JSON.stringify(body)
   });
   const after=await getSession();
   if(!good(after,now())||!same(before,after))
    return fail('STALE_SESSION');
   if(abort.signal.aborted)return fail('NETWORK_OR_TIMEOUT');
   if(res?.redirected!==false||res.status!==(type==='reserve'?201:200)
    ||res.ok!==true)return fail('ORDER_NOT_CONFIRMED');
   if(!/^application\/json(?:\s*;|$)/i.test(
    res.headers?.get?.('content-type')??''))return fail('BAD_CONTENT_TYPE');
   const read=await readBoundedResponseText(res,{
    limit:8192,signal:abort.signal,timedOut:()=>abort.signal.aborted
   });
   if(!read.ok)return fail(read.code);
   const final=await getSession();
   if(!good(final,now())||!same(before,final))
    return fail('STALE_SESSION');
   let dto;try{dto=JSON.parse(read.text);}catch{return fail('BAD_JSON');}
   const receipt=type==='reserve'?
    projectG45QaReserveReceipt(dto,{request:body}):
    projectG45QaCancelReceipt(dto,{orderId:body.orderId});
   if(!receipt)return fail('INVALID_SERVER_RECEIPT');
   return Object.freeze({ok:true,receipt,
    checkoutEnabled:false,paymentEnabled:false});
  }catch{return fail(abort.signal.aborted?'NETWORK_OR_TIMEOUT':'ORDER_NETWORK_UNAVAILABLE');}
  finally{clearTimeout(timeout);busy=false;}
 }

 async function recover(requestKey){
  if(!ready)return fail('G139_NOT_CERTIFIED');
  if(typeof requestKey!=='string'||!UUID.test(requestKey)
   ||requestKey!==requestKey.toLowerCase())return fail('INVALID_RECOVERY_KEY');
  if(busy)return fail('G139_BUSY');
  busy=true;
  const abort=new AbortController(),ms=Number.isSafeInteger(timeoutMs)
   &&timeoutMs>=1000&&timeoutMs<=30000?timeoutMs:8000;
  const timeout=setTimeout(()=>abort.abort(),ms);
  try{
   const before=await getSession();
   if(!good(before,now()))return fail('AUTH_REQUIRED');
   const res=await fetchImpl(host+'/v1/staging/buyer/orders/qa/requests/'+requestKey,{
    method:'GET',credentials:'omit',redirect:'error',cache:'no-store',
    referrerPolicy:'no-referrer',signal:abort.signal,
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json'}
   });
   const after=await getSession();
   if(!good(after,now())||!same(before,after))return fail('STALE_SESSION');
   if(abort.signal.aborted)return fail('NETWORK_OR_TIMEOUT');
   if(res?.redirected!==false)return fail('UNTRUSTED_REDIRECT');
   if(res.status===404)return fail('ORDER_NOT_FOUND');
   if(res.status!==200||res.ok!==true)return fail('ORDER_NOT_CONFIRMED');
   if(!/^application\/json(?:\s*;|$)/i.test(
    res.headers?.get?.('content-type')??''))return fail('BAD_CONTENT_TYPE');
   const read=await readBoundedResponseText(res,{
    limit:8192,signal:abort.signal,timedOut:()=>abort.signal.aborted
   });
   if(!read.ok)return fail(read.code);
   const final=await getSession();
   if(!good(final,now())||!same(before,final))return fail('STALE_SESSION');
   let dto;try{dto=JSON.parse(read.text);}catch{return fail('BAD_JSON');}
   const receipt=projectG144OrderRecoveryReceipt(dto,{requestKey});
   if(!receipt)return fail('INVALID_SERVER_RECEIPT');
   return Object.freeze({ok:true,receipt,checkoutEnabled:false,paymentEnabled:false});
  }catch{return fail(abort.signal.aborted?'NETWORK_OR_TIMEOUT':'ORDER_NETWORK_UNAVAILABLE');}
  finally{clearTimeout(timeout);busy=false;}
 }
 return Object.freeze({isConfigured:()=>ready,
  reserve:body=>send('reserve',body),cancel:body=>send('cancel',body),
  recover});
}
