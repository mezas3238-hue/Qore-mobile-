import {readBoundedResponseText} from './bounded-http-response.mjs';

/**
 * R79 — Transport Client -> G101, MOTO_RIDE passengers only.
 * G101 currently runs in A's PostgreSQL16 loopback QA. Never enable this
 * on native builds until an external HTTPS+IdP+legal+route+PG audit exists.
 * The server, not Expo flags or any supplied quote, owns 12/10/2 pricing.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const uuid=x=>typeof x==='string'&&UUID.test(x);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=(code,status=0)=>Object.freeze({ok:false,code,status});
const PATH='/v1/staging/rider/moto';
const safeText=x=>typeof x==='string'&&x.length>=3&&x.length<=120
 &&x.trim()===x&&!/[\u0000-\u001f\u007f]/.test(x);
function pinnedOrigin(raw){
 try{
  if(typeof raw!=='string'||raw.includes('\\'))return null;
  const u=new URL(raw);
  return u.protocol==='https:'&&u.origin===raw
   &&u.pathname==='/'&&!u.port&&!u.search&&!u.hash
   &&!u.username&&!u.password&&!u.hostname.endsWith('.')
   &&/^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?\.onrender\.com$/.test(u.hostname)
   ?u.origin:null;
 }catch{return null;}
}
const validSession=(s,t)=>object(s)&&s.role==='passenger'
 &&uuid(s.subject)&&typeof s.token==='string'
 &&/^[A-Za-z0-9._~-]{20,7900}$/.test(s.token)
 &&Number.isSafeInteger(s.authRevision)&&s.authRevision>=0
 &&Number.isSafeInteger(s.sessionRevision)&&s.sessionRevision>=0
 &&Number.isSafeInteger(s.expiresAt)&&s.expiresAt>t+1000;
const sameSession=(a,b)=>Boolean(a&&b&&a.subject===b.subject
 &&a.token===b.token&&a.authRevision===b.authRevision
 &&a.sessionRevision===b.sessionRevision&&a.expiresAt===b.expiresAt);
function scopeOK(type,s,a){
 if(!object(s)||!a||!uuid(s.ownerId)||s.ownerId!==a.subject
  ||s.sessionRevision!==a.sessionRevision)return false;
 if(type==='quote')return s.serviceKind==='MOTO_RIDE'
  &&uuid(s.quoteRequestKey)&&safeText(s.origin)&&safeText(s.destination)
  &&s.origin.toLocaleLowerCase('es')!==s.destination.toLocaleLowerCase('es');
 if(type==='book')return uuid(s.quoteId)&&uuid(s.bookingKey);
 if(type==='readBook'||type==='readCancel')return uuid(s.bookingKey);
 if(type==='cancel')return uuid(s.bookingKey)&&uuid(s.cancellationKey)
  &&s.cancellationKey!==s.bookingKey;
 return false;
}
export function createG101MotoPassengerHttpGateway({
 enabled=false,contractCertified=false,externalRuntimeVerified=false,
 motoLegalVerified=false,motoRouteVerified=false,
 passengerRlsVerified=false,idempotencyVerified=false,
 origin,pinnedOrigin,getSession,fetchImpl=fetch,onSessionInvalid=()=>{},
 now=Date.now,timeoutMs=8000,maxBytes=32768
}={}){
 const host=pinnedOrigin(origin),pin=pinnedOrigin(pinnedOrigin);
 const ready=enabled===true&&contractCertified===true
  &&externalRuntimeVerified===true&&motoLegalVerified===true
  &&motoRouteVerified===true&&passengerRlsVerified===true
  &&idempotencyVerified===true&&host!==null&&host===pin
  &&typeof getSession==='function'&&typeof fetchImpl==='function';
 let sequence=0,busy=null;
 function cancelPending(){sequence++;busy?.abort();busy=null;}
 async function request(type,s){
  if(!ready)return fail('G101_EXTERNAL_CONTRACT_PENDING');
  if(busy!==null)return fail('G101_REQUEST_IN_FLIGHT');
  const epoch=sequence,ctl=new AbortController();busy=ctl;
  const timeout=Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=30000
   ?timeoutMs:8000;
  const limit=Number.isSafeInteger(maxBytes)&&maxBytes>=1024&&maxBytes<=65536
   ?maxBytes:32768;
  let timer=null;
  try{
   let before;
   try{before=getSession();}catch{return fail('AUTH_REQUIRED');}
   if(sequence!==epoch||!validSession(before,now()))return fail('AUTH_REQUIRED');
   if(!scopeOK(type,s,before))return fail('G101_INVALID_PRIVATE_SCOPE');
   let path,method,body;
   if(type==='quote'){
    method='POST';path=PATH+'/quotes';
    body={requestKey:s.quoteRequestKey,origin:s.origin,destination:s.destination};
   }else if(type==='book'){
    method='POST';path=PATH+'/book';
    body={requestKey:s.bookingKey,quoteId:s.quoteId,accepted:true};
   }else if(type==='cancel'){
    method='POST';path=PATH+'/bookings/'+s.bookingKey+'/cancel';
    body={requestKey:s.cancellationKey,confirmed:true};
   }else{
    method='GET';path=PATH+'/bookings/'+s.bookingKey+
     (type==='readCancel'?'/cancellation':'');
   }
   const deadline=now()+timeout;timer=setTimeout(()=>ctl.abort(),timeout);
   const timedOut=()=>ctl.signal.aborted||now()>=deadline;
   const response=await fetchImpl(host+path,{
    method,redirect:'error',credentials:'omit',cache:'no-store',
    referrerPolicy:'no-referrer',signal:ctl.signal,
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json',
     ...(body===undefined?{}:{'Content-Type':'application/json'})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})
   });
   if(sequence!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!response||response.redirected===true)return fail('UNTRUSTED_REDIRECT');
   let after;
   try{after=getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(sequence!==epoch||timedOut()||!validSession(after,now())
    ||!sameSession(before,after))return fail('STALE_SESSION_RESPONSE');
   if(response.status===401||response.status===403){
    onSessionInvalid();
    return fail(response.status===401?'AUTH_REQUIRED':'FORBIDDEN',response.status);
   }
   if(response.status===404)return fail('MOTO_PRIVATE_NOT_FOUND',404);
   if(response.status===409)return fail('MOTO_SERVER_CONFLICT',409);
   if(response.status===429)return fail('RATE_LIMITED',429);
   if(response.status===503)return fail('SERVICE_UNAVAILABLE',503);
   const expected=type==='book'?201:200;
   if(response.status!==expected||response.ok!==true)
    return fail('MOTO_BACKEND_UNAVAILABLE',response.status);
   if(!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type')??''))
    return fail('BAD_CONTENT_TYPE');
   const length=response.headers?.get?.('content-length');
   if(length!=null&&(!/^\d+$/.test(length)||Number(length)>limit))
    return fail('RESPONSE_TOO_LARGE');
   const read=await readBoundedResponseText(response,{limit,signal:ctl.signal,timedOut});
   if(!read.ok)return fail(read.code);
   let data;try{data=JSON.parse(read.text);}catch{return fail('BAD_SERVER_RESPONSE');}
   try{after=getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(sequence!==epoch||timedOut()||!validSession(after,now())
    ||!sameSession(before,after))return fail('STALE_SESSION_RESPONSE');
   // Private DTO is revalidated against G100 exact 12/10/2 + Owner scope
   // by the companion flow, before it can reach native screen.
   return Object.freeze({ok:true,status:expected,data});
  }catch{return fail(sequence!==epoch?'STALE_SESSION_RESPONSE':'NETWORK_OR_TIMEOUT');}
  finally{if(timer!==null)clearTimeout(timer);if(busy===ctl)busy=null;}
 }
 const options=()=>ready?Object.freeze({
  enabled:true,contractCertified:true,externalRuntimeVerified:true,
  motoLegalVerified:true,motoRouteVerified:true,
  quoteGateway:s=>request('quote',s),
  bookGateway:s=>request('book',s),
  bookingReadGateway:s=>request('readBook',s),
  cancelGateway:s=>request('cancel',s),
  cancelReadGateway:s=>request('readCancel',s)
 }):null;
 return Object.freeze({isConfigured:()=>ready,flowOptions:options,
  cancelPending,productionEnabled:false});
}
