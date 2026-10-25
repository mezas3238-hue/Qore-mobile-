import {readBoundedResponseText} from './bounded-json-response.mjs';

/**
 * F1: operational Admin READ only. Endpoint is a proposed A/B contract,
 * NOT mounted by G73. No server authorization is inferred from Admin UI.
 * A must independently attest same tripId->quoteId->routeId->fare->status.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const STATES=new Set(['searching','assigned','arriving','in_progress',
 'completed','cancelled']);
const SERVICES=new Set(['economico','confort','xl']);
const FIELDS=['mode','commercialEnabled','viewerId','tripId','routeId',
 'quoteId','passengerId','bookingRequestKey','service','currency',
 'amountGs','fareVersion','revision','status','assignmentPersisted',
 'driverId','observedAt','expiresAt','serverPersisted'];
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const uuid=x=>typeof x==='string'&&UUID.test(x);
const exact=x=>obj(x)&&Object.keys(x).length===FIELDS.length
 &&FIELDS.every(k=>Object.hasOwn(x,k));
const fail=(code,status=0)=>Object.freeze({ok:false,code,status});
function originOf(x){
 try{
  if(typeof x!=='string'||x.includes('\\'))return null;
  const u=new URL(x);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.search
   &&!u.hash&&!u.port&&u.pathname==='/'&&!u.hostname.endsWith('.')
   ?u.origin:null;
 }catch{return null;}
}
const validActor=(s,t)=>obj(s)&&s.role==='admin'&&s.mfaVerified===true
 &&uuid(s.subject)&&typeof s.token==='string'&&s.token.length>=20
 &&Number.isSafeInteger(s.authRevision)&&s.authRevision>=0
 &&Number.isSafeInteger(s.expiresAt)&&s.expiresAt>t+1000;
const same=(a,b)=>a.subject===b.subject&&a.role===b.role
 &&a.token===b.token&&a.authRevision===b.authRevision
 &&a.expiresAt===b.expiresAt&&b.mfaVerified===true;
function validAudit(d,tripId,viewerId,t){
 if(!exact(d)||d.mode!=='STAGING_DEMO_ONLY'||d.commercialEnabled!==false
  ||d.viewerId!==viewerId||d.tripId!==tripId
  ||!uuid(d.routeId)||!uuid(d.quoteId)||!uuid(d.passengerId)
  ||!uuid(d.bookingRequestKey)||!SERVICES.has(d.service)
  ||d.currency!=='PYG'||!Number.isSafeInteger(d.amountGs)
  ||d.amountGs<1||d.amountGs>100000000
  ||typeof d.fareVersion!=='string'||!/^[A-Za-z0-9._-]{1,48}$/.test(d.fareVersion)
  ||!Number.isSafeInteger(d.revision)||d.revision<1
  ||!STATES.has(d.status)||typeof d.assignmentPersisted!=='boolean'
  ||!(d.driverId===null||uuid(d.driverId))
  ||!Number.isSafeInteger(d.observedAt)||d.observedAt>t
  ||t-d.observedAt>30000||!Number.isSafeInteger(d.expiresAt)
  ||d.expiresAt<=t||d.expiresAt>t+60000||d.serverPersisted!==true)
  return false;
 const assigned=['assigned','arriving','in_progress'].includes(d.status);
 if(d.assignmentPersisted!==assigned
  ||(assigned&&d.driverId===null)
  ||(!assigned&&d.driverId!==null))return false;
 return true;
}
export function createF1AutoRideAuditGateway({
 enabled=false,contractCertified=false,stagingRuntimeVerified=false,
 origin,pinnedOrigin,getSession,fetchImpl,onSessionInvalid=()=>{},
 now=()=>Date.now(),timeoutMs=8000,maxBytes=32768
}={}){
 const host=originOf(origin),pin=originOf(pinnedOrigin);
 const ready=enabled===true&&contractCertified===true
  &&stagingRuntimeVerified===true&&host!==null&&host===pin
  &&typeof getSession==='function'&&typeof fetchImpl==='function';
 let epoch=0,active=null;
 function cancelPending(){
  epoch++;active?.abort();active=null;
 }
 async function read(tripId){
  if(!ready)return fail('F1_ADMIN_CONTRACT_PENDING');
  if(!uuid(tripId))return fail('INVALID_TRIP_ID');
  if(active!==null)return fail('F1_ADMIN_READ_IN_FLIGHT');
  const run=epoch,ctl=new AbortController();active=ctl;
  let timer=null;
  try{
   let before;try{before=await getSession();}catch{return fail('ADMIN_AUTH_REQUIRED');}
   if(run!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(!validActor(before,now()))return fail('FORBIDDEN');
   const ms=Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000
    &&timeoutMs<=30000?timeoutMs:8000,deadline=now()+ms;
   timer=setTimeout(()=>ctl.abort(),ms);
   const timedOut=()=>ctl.signal.aborted||now()>=deadline;
   const response=await fetchImpl(host+
    '/v1/staging/admin/rides/'+encodeURIComponent(tripId)+'/f1-verification',{
     method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
     referrerPolicy:'no-referrer',
     headers:{Authorization:'Bearer '+before.token,Accept:'application/json'},
     signal:ctl.signal
    });
   if(run!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!response||response.redirected===true)return fail('UNTRUSTED_REDIRECT');
   let after;try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(run!==epoch||timedOut()||!validActor(after,now())||!same(before,after))
    return fail('STALE_SESSION_RESPONSE');
   if(response.status===401||response.status===403){
    onSessionInvalid();
    return fail(response.status===401?'ADMIN_AUTH_REQUIRED':'FORBIDDEN',response.status);
   }
   if(response.status===404)return fail('TRIP_NOT_FOUND',404);
   if(response.status===429)return fail('RATE_LIMITED',429);
   if(response.status===503)return fail('SERVICE_UNAVAILABLE',503);
   if(response.status!==200||response.ok!==true)
    return fail('ADMIN_READ_UNAVAILABLE',response.status);
   if(!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type')??''))
    return fail('BAD_CONTENT_TYPE');
   const limit=Number.isSafeInteger(maxBytes)&&maxBytes>=1024
    &&maxBytes<=65536?maxBytes:32768;
   const len=response.headers?.get?.('content-length');
   if(len!=null&&(!/^\d+$/.test(len)||Number(len)>limit))
    return fail('RESPONSE_TOO_LARGE');
   const read=await readBoundedResponseText(response,{
    limit,signal:ctl.signal,timedOut
   });
   if(run!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(!read.ok)return fail(read.code);
   let dto;try{dto=JSON.parse(read.text);}catch{return fail('BAD_SERVER_RESPONSE');}
   if(!validAudit(dto,tripId,before.subject,now()))
    return fail('INVALID_F1_ADMIN_PROOF');
   try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(run!==epoch||timedOut()||!validActor(after,now())||!same(before,after))
    return fail('STALE_SESSION_RESPONSE');
   // Never leak passenger/driver identifiers to a display model.
   return Object.freeze({ok:true,status:200,
    data:Object.freeze({tripId:dto.tripId,routeId:dto.routeId,
     quoteId:dto.quoteId,bookingRequestKey:dto.bookingRequestKey,
     service:dto.service,amountGs:dto.amountGs,currency:'PYG',
     fareVersion:dto.fareVersion,revision:dto.revision,status:dto.status,
     assignmentPersisted:dto.assignmentPersisted,observedAt:dto.observedAt,
     expiresAt:dto.expiresAt,qaOnly:true,productionEnabled:false})});
  }catch{return fail(run!==epoch?'STALE_SESSION_RESPONSE':'NETWORK_OR_TIMEOUT');}
  finally{if(timer!==null)clearTimeout(timer);if(active===ctl)active=null;}
 }
 return Object.freeze({isConfigured:()=>ready,read,cancelPending,productionEnabled:false});
}
