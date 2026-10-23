import {readBoundedResponseText} from './bounded-http-response.mjs';
/**
 * Pasajero: GET de estado de viaje propio según OpenAPI RiderStatusV1 (G11).
 * JWT/RLS y propiedad se verifican solo en servidor A. Bloqueado por defecto.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES=new Set(['searching','assigned','arriving','in_progress','completed','cancelled']);
const EVENT_STATES=new Set(['searching','accepted','at_pickup','in_progress','completed','cancelled']);
const fail=(code,status=0)=>Object.freeze({ok:false,code,status});
const uuid=x=>typeof x==='string'&&UUID.test(x);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,required)=>object(x)&&Object.keys(x).length===required.length
 &&required.every(k=>Object.hasOwn(x,k));
const int=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const text=(s,min,max)=>typeof s==='string'&&s.trim().length>=min&&s.trim().length<=max;
const validSession=(s,clock)=>object(s)&&s.role==='passenger'&&uuid(s.subject)
 &&typeof s.token==='string'&&s.token.length>=20
 &&Number.isFinite(s.expiresAt)&&s.expiresAt>clock+1000
 &&int(s.authRevision);
const same=(a,b)=>a.subject===b.subject&&a.token===b.token
 &&a.authRevision===b.authRevision&&a.expiresAt===b.expiresAt;
const originOf=raw=>{
 try{
  if(typeof raw!=='string'||raw.includes('\\'))return null;
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||
   u.pathname!=='/'||u.port||u.hostname.endsWith('.'))return null;
  return u.origin;
 }catch{return null;}
};
const EVENT=['source','tripId','passengerId','serverRevision','trackingSequence',
 'status','acceptedDriver','tracking'];
const FIELDS=['tripId','ownerId','revision','state','assignmentPersisted','driver',
 'vehicle','gpsConsent','location','etaVerified','etaMinutes','mode',
 'commercialRidesEnabled','event','locationVisible','deliveryConfirmed'];
function validEvent(x,tripId,ownerId){
 if(!exact(x,EVENT)||x.source!=='server'||x.tripId!==tripId||
   x.passengerId!==ownerId||!int(x.serverRevision,1)||
   !int(x.trackingSequence)||!EVENT_STATES.has(x.status))return false;
 if(x.acceptedDriver!==null&&(!exact(x.acceptedDriver,
  ['name','vehicleKind','model','color','plate','rating'])||
  x.acceptedDriver.vehicleKind!=='AUTO'||!text(x.acceptedDriver.name,1,100)||
  !text(x.acceptedDriver.model,1,100)||!text(x.acceptedDriver.color,1,100)||
  !text(x.acceptedDriver.plate,1,20)||typeof x.acceptedDriver.rating!=='number'||
  !Number.isFinite(x.acceptedDriver.rating)||x.acceptedDriver.rating<0||
  x.acceptedDriver.rating>5))return false;
 if(x.tracking!==null&&(!exact(x.tracking,['lat','lng','roadMeters','etaSeconds',
  'locationUpdatedAtMs','routeUpdatedAtMs','trafficAware','fallbackUsed'])||
  !Number.isFinite(x.tracking.lat)||Math.abs(x.tracking.lat)>90||
  !Number.isFinite(x.tracking.lng)||Math.abs(x.tracking.lng)>180||
  !int(x.tracking.roadMeters)||!int(x.tracking.etaSeconds)||
  !int(x.tracking.locationUpdatedAtMs)||!int(x.tracking.routeUpdatedAtMs)||
  x.tracking.trafficAware!==true||x.tracking.fallbackUsed!==false))return false;
 return true;
}
function validStatus(x,tripId,ownerId,clock){
 if(!exact(x,FIELDS)||x.tripId!==tripId||x.ownerId!==ownerId||
  !int(x.revision,1)||!STATES.has(x.state)||
  typeof x.assignmentPersisted!=='boolean'||typeof x.gpsConsent!=='boolean'||
  typeof x.etaVerified!=='boolean'||typeof x.locationVisible!=='boolean'||
  x.mode!=='STAGING_DEMO_ONLY'||x.commercialRidesEnabled!==false||
  x.deliveryConfirmed!==false||!validEvent(x.event,tripId,ownerId))return false;
 if(x.driver!==null&&(!exact(x.driver,['verified','displayName'])||
  x.driver.verified!==true||!text(x.driver.displayName,2,70)))return false;
 if(x.vehicle!==null&&(!exact(x.vehicle,['kind','plate'])||
  x.vehicle.kind!=='AUTO'||typeof x.vehicle.plate!=='string'||
  !/^[A-Z0-9-]{4,12}$/.test(x.vehicle.plate)))return false;
 if(x.location!==null&&(!exact(x.location,['latitude','longitude','observedAt'])||
  typeof x.location.latitude!=='number'||!Number.isFinite(x.location.latitude)||
  Math.abs(x.location.latitude)>90||typeof x.location.longitude!=='number'||
  !Number.isFinite(x.location.longitude)||Math.abs(x.location.longitude)>180||
  !int(x.location.observedAt)))return false;
 if(x.etaMinutes!==null&&!int(x.etaMinutes,0,240))return false;
 // No aceptar campos sensibles si los flags del servidor contradicen el DTO.
 const assigned=['assigned','arriving','in_progress'].includes(x.state);
 if(!assigned||!x.assignmentPersisted){
  if(x.driver!==null||x.vehicle!==null||x.location!==null||
   x.etaMinutes!==null||x.locationVisible===true)return false;
 }
 if(x.locationVisible===true){
  if(!assigned||!x.assignmentPersisted||!x.gpsConsent||!x.etaVerified||
   x.driver===null||x.vehicle===null||x.location===null||
   x.etaMinutes===null||x.location.observedAt>clock||
   clock-x.location.observedAt>30000)return false;
 }else if(x.location!==null||x.etaMinutes!==null)return false;
 return true;
}
export function createRiderStatusGateway({
 enabled=false,contractCertified=false,origin,pinnedOrigin,getSession,fetchImpl,
 onSessionInvalid=()=>{},now=()=>Date.now(),timeoutMs=8000,maxBytes=32768
}={}){
 const host=originOf(origin),pin=originOf(pinnedOrigin);
 const configured=enabled===true&&contractCertified===true&&host!==null&&host===pin
  &&typeof getSession==='function'&&typeof fetchImpl==='function';
 let busy=false;
 async function fetchStatus(tripId){
  if(!configured)return fail('STATUS_CONTRACT_PENDING');
  if(!uuid(tripId))return fail('INVALID_TRIP_ID');
  if(busy)return fail('STATUS_READ_IN_FLIGHT');
  busy=true;let timer=null;
  try{
   let before;
   try{before=await getSession();}catch{return fail('AUTH_UNAVAILABLE');}
   if(!validSession(before,now()))return fail('AUTH_REQUIRED');
   const ctl=new AbortController();
   const ms=int(timeoutMs,1000,30000)?timeoutMs:8000;
   const deadline=now()+ms;
   timer=setTimeout(()=>ctl.abort(),ms);
   const timedOut=()=>ctl.signal.aborted||now()>=deadline;
   const response=await fetchImpl(host+'/v1/staging/rider/trips/'+encodeURIComponent(tripId)+'/status',{
    method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
    referrerPolicy:'no-referrer',
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json'},signal:ctl.signal
   });
   // Ignorar transportes que resuelven después de AbortSignal/deadline.
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!response||response.redirected===true)return fail('UNTRUSTED_REDIRECT');
   if(response.status===401||response.status===403){
    let after;
    try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
    if(!validSession(after,now())||!same(before,after))return fail('STALE_SESSION_RESPONSE');
    onSessionInvalid();
    return fail(response.status===401?'AUTH_REQUIRED':'FORBIDDEN',response.status);
   }
   if(response.status===404)return fail('TRIP_NOT_FOUND',404);
   if(response.status===429)return fail('RATE_LIMITED',429);
   if(response.status===503)return fail('SERVICE_UNAVAILABLE',503);
   if(response.status!==200||response.ok!==true)return fail('STATUS_UNAVAILABLE',response.status);
   const type=response.headers?.get?.('content-type');
   if(typeof type!=='string'||!/^application\/json(?:\s*;|$)/i.test(type))
    return fail('BAD_CONTENT_TYPE');
   const limit=int(maxBytes,1024,262144)?maxBytes:32768;
   const len=response.headers?.get?.('content-length');
   if(len!=null&&(!/^\d+$/.test(len)||Number(len)>limit))return fail('RESPONSE_TOO_LARGE');
   const bodyResult=await readBoundedResponseText(response,{
    limit,signal:ctl.signal,timedOut
   });
   if(!bodyResult.ok)return fail(bodyResult.code);
   const body=bodyResult.text;
   let data;
   try{data=JSON.parse(body);}catch{return fail('BAD_SERVER_RESPONSE');}
   let after;
   try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!validSession(after,now())||!same(before,after))return fail('STALE_SESSION_RESPONSE');
   if(!validStatus(data,tripId,before.subject,now()))return fail('INVALID_SERVER_SNAPSHOT');
   return Object.freeze({ok:true,status:200,data});
  }catch{return fail('NETWORK_OR_TIMEOUT');}
  finally{if(timer!==null)clearTimeout(timer);busy=false;}
 }
 return Object.freeze({isConfigured:()=>Boolean(configured),fetchStatus});
}
