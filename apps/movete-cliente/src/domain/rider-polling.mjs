import {createRiderStatusStore} from './rider-status.mjs';

/**
 * Bridge B06 para status privado del pasajero.
 * El endpoint/DTO aún es contrato STAGING no certificado; no habilita LIVE.
 * El llamador decide cuándo ejecutar tick; no crea timers/background tracking.
 * Re-sincroniza exclusivamente con GET server-authoritative, nunca con push.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid=x=>typeof x==='string'&&UUID.test(x);
const fail=code=>({ok:false,code});
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
    const code=typeof reply?.code==='string'?reply.code:'SERVER_UNAVAILABLE';
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
 return Object.freeze({
  begin,tick,stop:reset,connectionLost,snapshot
 });
}
