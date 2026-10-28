import {createRiderStatusStore} from './rider-status.mjs';

/**
 * Bridge B06 para status privado del pasajero.
 * El endpoint/DTO aún es contrato STAGING no certificado; no habilita LIVE.
 * El llamador decide cuándo ejecutar tick; no crea timers/background tracking.
 * Re-sincroniza exclusivamente con GET server-authoritative, nunca con push.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid=x=>typeof x==='string'&&UUID.test(x);
/**
 * F1/G3 PostgreSQL transition rules. The backend remains authoritative.
 * Valid mobile polls may skip intermediate events but may NEVER reverse
 * a committed completed/cancelled ride or change state at the same revision.
 */
const RIDE_RANK=Object.freeze({
 searching:0,assigned:1,arriving:2,in_progress:3,completed:4
});
function serverStateConsistent(prior,upcoming){
 if(prior.tripId===null||prior.tripId!==upcoming.tripId)return true;
 if(upcoming.revision<prior.revision)return false;
 if(upcoming.revision===prior.revision)return upcoming.state===prior.state;
 if(prior.state==='completed'||prior.state==='cancelled')return false;
 if(upcoming.state==='cancelled'){
  return ['searching','assigned','arriving'].includes(prior.state);
 }
 const old=RIDE_RANK[prior.state],next=RIDE_RANK[upcoming.state];
 return Number.isSafeInteger(old)&&Number.isSafeInteger(next)
  &&next>old&&upcoming.revision-prior.revision>=next-old;
}
const fail=code=>({ok:false,code});
/**
 * R61: errors can cross an injected network boundary and later render in
 * Tracking. Never publish an untrusted code containing PII/HTML/JWT.
 */
const SAFE_STATUS_CODES=new Set([
 'AUTH_REQUIRED','AUTH_UNAVAILABLE','FORBIDDEN','SESSION_CHANGED',
 'STALE_SESSION_RESPONSE','NETWORK_OR_TIMEOUT','RATE_LIMITED',
 'SERVICE_UNAVAILABLE','STATUS_UNAVAILABLE','STATUS_CONTRACT_PENDING',
 'TRIP_NOT_FOUND','INVALID_TRIP_ID','UNTRUSTED_REDIRECT',
 'BAD_SERVER_RESPONSE','BAD_CONTENT_TYPE','RESPONSE_TOO_LARGE',
 'INVALID_SERVER_SNAPSHOT','STATUS_READ_IN_FLIGHT','OFFLINE',
 'GATEWAY_UNAVAILABLE','SERVER_UNAVAILABLE','STALE_SERVER_REVISION',
 'TRIP_STATE_CONFLICT'
]);
const safeStatusCode=x=>
 typeof x==='string'&&SAFE_STATUS_CODES.has(x)?x:'SERVER_UNAVAILABLE';
export function createRiderPollingCoordinator({
 gateway,getSession,store=createRiderStatusStore(),now=()=>Date.now()
}={}){
 let active=null,version=0,busy=false,lastFetchedAt=null,lastError=null;
 function reset(){
  version++;
  active=null;busy=false;lastFetchedAt=null;lastError=null;
  store.clear();
 }
 function begin(tripId,subject){
  if(!isUuid(tripId)||!isUuid(subject))return fail('INVALID_SUBSCRIPTION');
  reset();
  active={tripId,subject};
  return {ok:true};
 }
 function snapshot(){
  const view=store.current();
  return Object.freeze({
   ...view,
   subscriptionActive:active!==null,
   syncing:busy,lastFetchedAt,
   lastError,
   // La carátula de tracking jamás certifica mapa/ETA reales.
   liveEnabled:false
  });
 }
 function connectionLost(){
  version++;
  busy=false;lastError='OFFLINE';lastFetchedAt=null;
  store.networkLost();
 }
 async function tick(){
  if(!active)return fail('NO_ACTIVE_TRIP');
  if(busy)return fail('POLL_IN_PROGRESS');
  if(!gateway||typeof gateway.send!=='function'||typeof getSession!=='function'){
   store.networkLost();lastError='GATEWAY_UNAVAILABLE';
   return fail('GATEWAY_UNAVAILABLE');
  }
  const captured=active,seq=++version;
  busy=true;
  try{
   let session;
   try{session=await getSession();}
   catch{
    if(seq!==version)return fail('STALE_RESPONSE_IGNORED');
    reset();return fail('AUTH_UNAVAILABLE');
   }
   if(seq!==version||active!==captured)return fail('STALE_RESPONSE_IGNORED');
   if(!session||session.role!=='passenger'||session.subject!==captured.subject){
    reset();return fail('SESSION_CHANGED');
   }
   let reply;
   try{reply=await gateway.send('rideStatus',{id:captured.tripId});}
   catch{reply=fail('NETWORK_OR_TIMEOUT');}
   if(seq!==version||active!==captured)return fail('STALE_RESPONSE_IGNORED');
   if(!reply||reply.ok!==true){
    const code=safeStatusCode(reply?.code);
    if(code==='AUTH_REQUIRED'||code==='FORBIDDEN'){
     reset();return fail(code);
    }
    store.networkLost();lastFetchedAt=null;lastError=code;
    return fail(code);
   }
   // No reinterpretar la respuesta genérica de OpenAPI como DTO certificado.
   // En el futuro, A versionará este snapshot o se mantendrá fail-closed.
   const data=reply.data;
   if(!data||typeof data!=='object'||Array.isArray(data)
     ||data.tripId!==captured.tripId||data.ownerId!==captured.subject
     ||!Number.isSafeInteger(data.revision)){
    store.networkLost();lastFetchedAt=null;lastError='INVALID_SERVER_SNAPSHOT';
    return fail('INVALID_SERVER_SNAPSHOT');
   }
   const current=store.current();
   // A server snapshot older than a persisted revision MUST NOT count as
   // a successful refresh or reset the freshness clock.
   if(current.tripId===captured.tripId&&data.revision<current.revision){
    store.networkLost();lastFetchedAt=null;
    lastError='STALE_SERVER_REVISION';
    return fail('STALE_SERVER_REVISION');
   }
   if(current.tripId===captured.tripId
    &&!serverStateConsistent(current,data)){
    store.networkLost();lastFetchedAt=null;
    lastError=data.revision<current.revision
     ?'STALE_SERVER_REVISION':'TRIP_STATE_CONFLICT';
    return fail(lastError);
   }
   const accepted=store.ingest(data,captured.subject);
   if(!accepted&&store.current().tripId!==captured.tripId){
    store.networkLost();lastError='INVALID_SERVER_SNAPSHOT';
    return fail('INVALID_SERVER_SNAPSHOT');
   }
   lastError=null;lastFetchedAt=now();
   return {ok:true,applied:accepted,revision:store.current().revision};
  }finally{
   if(seq===version)busy=false;
  }
 }
 function stopIfMatching(tripId,subject){
  // The active subscription may exist before a valid server status arrives,
  // when store.current().tripId is still null. Never stop another trip.
  if(!active||active.tripId!==tripId||active.subject!==subject)return false;
  reset();return true;
 }
 return Object.freeze({
  begin,tick,stop:reset,stopIfMatching,connectionLost,snapshot
 });
}
