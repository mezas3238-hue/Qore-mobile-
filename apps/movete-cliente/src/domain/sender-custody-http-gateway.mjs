/**
 * R65 — G68 Passenger-owned delivery custody HTTPS consumer.
 * G68 exists ONLY as a Node/SQL QA route: there is NO mounted HTTPS service.
 * Default OFF; four independent opt-ins must be justified by external evidence.
 * Never send a Passenger to G66 courier/Driver routes.
 */
import {readBoundedResponseText} from './bounded-http-response.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES=new Set(['requested','accepted','picked_up','delivered',
 'disputed','returned','cancelled']);
const PROVEN=new Set(['delivered','disputed','returned']);
const FIELDS=['mode','deliveryId','ownerId','state','revision','vehicleKind',
 'assignmentPersisted','proofVerified','qaOnly','productionEnabled',
 'liveDeliveriesEnabled'];
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.getPrototypeOf(x)===Object.prototype;
const uuid=x=>typeof x==='string'&&UUID.test(x);
const int=(v,min=0,max=Number.MAX_SAFE_INTEGER)=>
 Number.isSafeInteger(v)&&v>=min&&v<=max;
const fail=(code,status=0)=>Object.freeze({ok:false,code,status});
function originOnly(value){
 try{
  if(typeof value!=='string'||value.includes('\\'))return null;
  const u=new URL(value);
  const host=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash
   ||u.pathname!=='/'||u.port||host.endsWith('.')
   ||host==='localhost'||host.endsWith('.localhost')
   ||host==='127.0.0.1'||host==='0.0.0.0'||host==='[::1]')return null;
  return u.origin;
 }catch{return null;}
}
function session(s,at){
 return plain(s)&&s.role==='passenger'&&uuid(s.subject)
  &&typeof s.token==='string'&&/^[A-Za-z0-9._~-]{20,7900}$/.test(s.token)
  &&int(s.expiresAt)&&s.expiresAt>at+1000
  &&int(s.authRevision)&&int(s.sessionRevision);
}
const same=(a,b)=>a.subject===b.subject&&a.token===b.token
 &&a.expiresAt===b.expiresAt&&a.authRevision===b.authRevision
 &&a.sessionRevision===b.sessionRevision;
function exactG68(dto,deliveryId,ownerId){
 if(!plain(dto)||Object.keys(dto).length!==FIELDS.length
  ||!FIELDS.every(k=>Object.hasOwn(dto,k))
  ||dto.mode!=='STAGING_DEMO_ONLY'||dto.deliveryId!==deliveryId
  ||dto.ownerId!==ownerId||!STATES.has(dto.state)
  ||!int(dto.revision,1)||!['AUTO','MOTO'].includes(dto.vehicleKind)
  ||typeof dto.assignmentPersisted!=='boolean'
  ||typeof dto.proofVerified!=='boolean'||dto.qaOnly!==true
  ||dto.productionEnabled!==false||dto.liveDeliveriesEnabled!==false)return false;
 if(dto.state==='requested'&&(dto.assignmentPersisted||dto.proofVerified))return false;
 if(['accepted','picked_up',...PROVEN].includes(dto.state)
  &&!dto.assignmentPersisted)return false;
 if(PROVEN.has(dto.state)!==dto.proofVerified)return false;
 // A cancelled delivery cannot be presented as independently delivered.
 if(dto.state==='cancelled'&&dto.proofVerified)return false;
 return true;
}
export function createSenderCustodyHttpGateway({
 enabled=false,contractCertified=false,stagingRuntimeVerified=false,
 g68SenderContractCertified=false,origin,pinnedOrigin,getSession,
 fetchImpl,onSessionInvalid=()=>{},now=()=>Date.now(),
 timeoutMs=8000,maxBytes=32768
}={}){
 const host=originOnly(origin),pin=originOnly(pinnedOrigin);
 const ready=enabled===true&&contractCertified===true
  &&stagingRuntimeVerified===true&&g68SenderContractCertified===true
  &&host!==null&&pin===host&&typeof getSession==='function'
  &&typeof fetchImpl==='function';
 let busy=false;
 async function readOwnDelivery(scope={}){
  if(!ready)return fail('SENDER_CUSTODY_HTTPS_NOT_CERTIFIED');
  if(!plain(scope)||Object.keys(scope).length!==4
   ||!['deliveryId','ownerId','sessionRevision','bearer']
    .every(k=>Object.hasOwn(scope,k))
   ||!uuid(scope.deliveryId)||!uuid(scope.ownerId)
   ||!int(scope.sessionRevision)||typeof scope.bearer!=='string')
   return fail('INVALID_SENDER_CUSTODY_SCOPE');
  if(busy)return fail('SENDER_CUSTODY_READ_IN_FLIGHT');
  busy=true;
  let timer=null;
  try{
   let before;
   try{before=await getSession();}catch{return fail('AUTH_UNAVAILABLE');}
   if(!session(before,now())||before.subject!==scope.ownerId
    ||before.sessionRevision!==scope.sessionRevision
    ||before.token!==scope.bearer)return fail('AUTH_REQUIRED');
   const ctl=new AbortController();
   const ms=int(timeoutMs,1000,30000)?timeoutMs:8000;
   const deadline=now()+ms;
   timer=setTimeout(()=>ctl.abort(),ms);
   const timedOut=()=>ctl.signal.aborted||now()>=deadline;
   const response=await fetchImpl(host+'/v1/staging/sender/deliveries/'
    +encodeURIComponent(scope.deliveryId)+'/custody',{
    method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
    referrerPolicy:'no-referrer',
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json'},
    signal:ctl.signal
   });
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!response||response.redirected===true)return fail('UNTRUSTED_REDIRECT');
   // An aged HTTP error cannot revoke a different session.
   if(response.status===401||response.status===403){
    let after;
    try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
    if(!session(after,now())||!same(before,after))
     return fail('STALE_SESSION_RESPONSE');
    onSessionInvalid();
    return fail(response.status===401?'AUTH_REQUIRED':'FORBIDDEN',response.status);
   }
   if(response.status===404)return fail('SENDER_CUSTODY_NOT_FOUND',404);
   if(response.status===429)return fail('RATE_LIMITED',429);
   if(response.status===503)return fail('SERVICE_UNAVAILABLE',503);
   if(response.status!==200||response.ok!==true)
    return fail('SENDER_CUSTODY_UNAVAILABLE',response.status);
   const type=response.headers?.get?.('content-type');
   if(typeof type!=='string'||!/^application\/json(?:\s*;|$)/i.test(type))
    return fail('BAD_CONTENT_TYPE');
   const limit=int(maxBytes,1024,262144)?maxBytes:32768;
   const length=response.headers?.get?.('content-length');
   if(length!==null&&length!==undefined&&
    (!/^\d+$/.test(length)||Number(length)>limit))
    return fail('RESPONSE_TOO_LARGE');
   const text=await readBoundedResponseText(response,{
    limit,signal:ctl.signal,timedOut
   });
   if(!text.ok)return fail(text.code);
   let payload;
   try{payload=JSON.parse(text.text);}catch{return fail('BAD_SERVER_RESPONSE');}
   let after;
   try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!session(after,now())||!same(before,after))
    return fail('STALE_SESSION_RESPONSE');
   if(!exactG68(payload,scope.deliveryId,before.subject))
    return fail('INVALID_SERVER_SNAPSHOT');
   return Object.freeze({ok:true,status:200,
    // Only projected minimum DTO; never retain raw server response.
    data:Object.freeze({...payload}),qaOnly:true,productionEnabled:false});
  }catch{return fail('NETWORK_OR_TIMEOUT');}
  finally{if(timer!==null)clearTimeout(timer);busy=false;}
 }
 return Object.freeze({isConfigured:()=>Boolean(ready),readOwnDelivery,
  productionEnabled:false,endpointKind:'SENDER_ONLY'});
}
