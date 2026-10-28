/**
 * B17 / A G121: read-only lookup for a Passenger's submitted delivery key.
 * "requested" confirms an unpriced QA row, NOT a quote, dispatch or payment.
 * No code path issues a POST or clears an uncertain mutation.
 */
import {readBoundedResponseText} from './bounded-http-response.mjs';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const STATUSES=new Set(['requested','accepted','picked_up','delivered',
 'disputed','returned','cancelled']);
const KEYS=['mode','liveDeliveriesEnabled','serverPersisted','ownerId',
 'requestKey','deliveryId','vehicleKind','status','revision'];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=(code,status=0)=>Object.freeze({ok:false,code,status});
function pinned(raw){
 try{
  if(typeof raw!=='string'||raw.includes('\\'))return null;
  const u=new URL(raw);
  return u.protocol==='https:'&&u.origin===raw&&u.pathname==='/'&&
   !u.username&&!u.password&&!u.search&&!u.hash&&!u.port&&
   /^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?\.onrender\.com$/.test(u.hostname)
   ?u.origin:null;
 }catch{return null;}
}
const goodActor=(s,t)=>object(s)&&s.role==='passenger'
 &&UUID.test(s.subject??'')&&typeof s.token==='string'
 &&/^[A-Za-z0-9._~-]{20,7900}$/.test(s.token)
 &&Number.isSafeInteger(s.authRevision)&&s.authRevision>=0
 &&Number.isSafeInteger(s.sessionRevision)&&s.sessionRevision>=0
 &&Number.isSafeInteger(s.expiresAt)&&s.expiresAt>t+1000;
const sameActor=(a,b)=>goodActor(b,0)&&a.subject===b.subject
 &&a.token===b.token&&a.authRevision===b.authRevision
 &&a.sessionRevision===b.sessionRevision&&a.expiresAt===b.expiresAt;
function exactReceipt(dto,scope){
 return object(dto)&&Object.keys(dto).length===KEYS.length
  &&KEYS.every(k=>Object.hasOwn(dto,k))
  &&dto.mode==='STAGING_DEMO_ONLY'
  &&dto.liveDeliveriesEnabled===false&&dto.serverPersisted===true
  &&dto.ownerId===scope.subject&&UUID.test(dto.ownerId)
  &&dto.requestKey===scope.requestKey
  &&UUID.test(dto.deliveryId)
  &&['AUTO','MOTO'].includes(dto.vehicleKind)
  &&STATUSES.has(dto.status)
  &&Number.isSafeInteger(dto.revision)&&dto.revision>=1;
}
export function createG121DeliveryRegistrationGateway({
 enabled=false,contractCertified=false,externalRuntimeVerified=false,
 passengerRlsVerified=false,ownerApproved=false,origin,pinnedOrigin,
 getSession,fetchImpl=fetch,onSessionInvalid=()=>{},now=Date.now,
 timeoutMs=8000,maxBytes=4096
}={}){
 const host=pinned(origin);
 const ready=enabled===true&&contractCertified===true
  &&externalRuntimeVerified===true&&passengerRlsVerified===true
  &&ownerApproved===true&&host!==null&&host===pinned(pinnedOrigin)
  &&typeof getSession==='function'&&typeof fetchImpl==='function';
 let epoch=0,busy=null;
 function cancelPending(){epoch++;busy?.abort();busy=null;}
 async function read({requestKey,expectedSubject,expectedSessionRevision}={}){
  if(!ready)return fail('G121_NOT_CERTIFIED');
  if(!UUID.test(requestKey??'')||!UUID.test(expectedSubject??'')
   ||!Number.isSafeInteger(expectedSessionRevision)
   ||expectedSessionRevision<0)return fail('G121_INVALID_SCOPE');
  if(busy)return fail('G121_IN_FLIGHT');
  const version=epoch,ctl=new AbortController();busy=ctl;
  let timer;
  try{
   let before;
   try{before=await getSession();}catch{return fail('AUTH_REQUIRED');}
   if(!goodActor(before,now())||before.subject!==expectedSubject
    ||before.sessionRevision!==expectedSessionRevision||version!==epoch)
    return fail('STALE_SESSION_RESPONSE');
   const ms=Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=30000?timeoutMs:8000;
   const limit=Number.isSafeInteger(maxBytes)&&maxBytes>=512&&maxBytes<=16384?maxBytes:4096;
   const deadline=now()+ms;timer=setTimeout(()=>ctl.abort(),ms);
   const expired=()=>ctl.signal.aborted||now()>=deadline||version!==epoch;
   // The URL contains ONLY an opaque random UUID, no address/recipient/JWT.
   const response=await fetchImpl(host+
    '/v1/staging/sender/deliveries/requests/'+encodeURIComponent(requestKey),{
    method:'GET',headers:{Authorization:'Bearer '+before.token,Accept:'application/json'},
    credentials:'omit',cache:'no-store',redirect:'error',
    referrerPolicy:'no-referrer',signal:ctl.signal
   });
   if(expired())return fail('NETWORK_OR_TIMEOUT');
   if(!response||response.redirected===true)return fail('UNTRUSTED_REDIRECT');
   let after;
   try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(expired()||!goodActor(after,now())||!sameActor(before,after))
    return fail('STALE_SESSION_RESPONSE');
   if(response.status===401||response.status===403){
    try{onSessionInvalid();}catch{}
    return fail(response.status===401?'AUTH_REQUIRED':'FORBIDDEN',response.status);
   }
   if(response.status===404)return fail('G121_NOT_FOUND',404);
   if(response.status===409)return fail('G121_CONFLICT',409);
   if(response.status===429)return fail('RATE_LIMITED',429);
   if(response.status===503)return fail('SERVICE_UNAVAILABLE',503);
   if(response.status!==200||response.ok!==true)return fail('G121_UNAVAILABLE',response.status);
   if(!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type')??''))
    return fail('BAD_CONTENT_TYPE');
   const len=response.headers?.get?.('content-length');
   if(len!==null&&len!==undefined&&(!/^\d+$/.test(len)||Number(len)>limit))
    return fail('RESPONSE_TOO_LARGE');
   const body=await readBoundedResponseText(response,{limit,signal:ctl.signal,timedOut:expired});
   if(!body.ok)return fail(body.code);
   let dto;try{dto=JSON.parse(body.text);}catch{return fail('BAD_SERVER_RESPONSE');}
   try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(expired()||!goodActor(after,now())||!sameActor(before,after))
    return fail('STALE_SESSION_RESPONSE');
   if(!exactReceipt(dto,{subject:before.subject,requestKey}))
    return fail('G121_UNVERIFIED_RECEIPT');
   // Emit only the registration proof. Never surface an inferred price,
   // dispatch authorization, courier, GPS, recipient or payment.
   return Object.freeze({ok:true,status:200,deliveryId:dto.deliveryId,
    requestKey,vehicleKind:dto.vehicleKind,revision:dto.revision,
    status:dto.status,terminal:['delivered','returned','cancelled'].includes(dto.status),
    registrationOnly:true,commercialEnabled:false,qaOnly:true,
    productionEnabled:false});
  }catch{return fail(version!==epoch?'STALE_SESSION_RESPONSE':'NETWORK_OR_TIMEOUT');}
  finally{if(timer!==undefined)clearTimeout(timer);if(busy===ctl)busy=null;}
 }
 return Object.freeze({isConfigured:()=>Boolean(ready),read,cancelPending,
  isReadOnly:true,productionEnabled:false});
}
