/**
 * QORE Radar: one-shot passenger polling bridge for React Native UI.
 *
 * This is NOT connected to the DEMO screens or any deployed endpoint.
 * Caller must supply a JWT from Supabase Auth and a reviewed HTTPS staging
 * API origin. Never creates a "live" GPS marker, mock driver, or countdown.
 * Offline/revoked access cannot appear to be fresh server tracking.
 */
import {
 initialRiderRadar,receiveRiderRadar,presentRiderRadar,
 type RiderRadarState,type RiderRadarView,type TrustedRiderEvent
} from './qore-radar-feed.ts';

export type RadarConnection='connected'|'no-session'|'forbidden'|'offline'|'invalid-response';
export type RadarPollResult={
 readonly state:RiderRadarState;
 readonly view:RiderRadarView;
 readonly connection:RadarConnection;
 readonly commercialRidesEnabled:false;
};
type ResponseLike={
 readonly status:number;
 json():Promise<unknown>;
};
export type RadarRequest=(url:string,init:{
 readonly method:'GET';readonly headers:Readonly<Record<string,string>>;
 readonly cache:'no-store';readonly credentials:'omit';readonly redirect:'error';
 readonly signal:AbortSignal;
})=>Promise<ResponseLike>;

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedStatuses=new Set(['searching','offer_pending','accepted','at_pickup','in_progress','completed','cancelled']);
const plain=(x:unknown):x is Record<string,unknown>=>
 x!==null&&typeof x==='object'&&!Array.isArray(x);
function checkOrigin(value:string,enableLoopback:boolean):string{
 let url:URL;
 try{url=new URL(value);}catch{throw Error('Invalid QORE Radar API origin');}
 const local=url.protocol==='http:'&&enableLoopback&&
  url.hostname==='127.0.0.1'&&url.port!=='';
 if(!(url.protocol==='https:'||local)||url.username||url.password||
    url.search||url.hash||url.pathname!=='/'||
    url.hostname==='localhost'||url.hostname==='0.0.0.0'||
    url.hostname==='qdqrlgzlotnfdxzpacxs.supabase.co')
  throw Error('Only a reviewed isolated staging HTTPS origin or loopback QA is allowed');
 return url.origin;
}
const blank=(s:RiderRadarState,message:string):RiderRadarView=>({
 status:'not_connected',title:message,
 driver:null,etaMinutes:null,roadMeters:null,driverPosition:null,
 freshness:'awaiting_data',isCommercialRideEnabled:false
});
const offline=(s:RiderRadarState,message:string):RiderRadarView=>({
 ...blank(s,message),freshness:'stale'
});
function validateEnvelope(json:unknown,state:RiderRadarState):TrustedRiderEvent|null{
 if(!plain(json)||json.mode!=='STAGING_DEMO_ONLY'||
   json.commercialRidesEnabled!==false||!plain(json.event))return null;
 const e=json.event;
 if(e.source!=='server'||e.tripId!==state.tripId||e.passengerId!==state.passengerId||
   !Number.isSafeInteger(e.serverRevision)||!Number.isSafeInteger(e.trackingSequence)||
   !allowedStatuses.has(e.status as string))return null;
 // Confirmed only by a server-side authorized response, not an Expo push.
 return e as TrustedRiderEvent;
}
/** Caller owns token lifecycle; it never leaves the Authorization header. */
export async function pollQoreRadar({
 state,accessToken,apiOrigin,request=fetch as RadarRequest,
 now=Date.now,enableLoopbackQA=false
}:{
 state:RiderRadarState;accessToken:string|null;
 apiOrigin:string;request?:RadarRequest;now?:()=>number;
 enableLoopbackQA?:boolean
}):Promise<RadarPollResult>{
 if(!state||!UUID.test(state.tripId)||!UUID.test(state.passengerId))
  throw Error('A known passenger and ride are required');
 const origin=checkOrigin(apiOrigin,enableLoopbackQA);
 if(!accessToken||typeof accessToken!=='string'||accessToken.length<20||
    /[\s]/.test(accessToken)){
  const reset=initialRiderRadar(state.tripId,state.passengerId);
  return {state:reset,view:blank(reset,'Ingresá para consultar tu viaje'),
   connection:'no-session',commercialRidesEnabled:false};
 }
 const url=origin+'/v1/staging/rider/trips/'+state.tripId+'/status';
 let response:ResponseLike;
 // AbortController is available in React Native; AbortSignal.timeout may
 // not exist on every Android/Hermes version, so do not depend on it here.
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),8_000);
 try {
  response=await request(url,{
   method:'GET',cache:'no-store',credentials:'omit',redirect:'error',
   headers:{authorization:'Bearer '+accessToken,accept:'application/json'},
   signal:controller.signal
  });
 }catch {
  return {state,view:offline(state,'Conexión interrumpida: sin ETA actualizada'),
   connection:'offline',commercialRidesEnabled:false};
 }finally{
  clearTimeout(timeout);
 }
 if(response.status===401||response.status===403||response.status===404){
  const cleared=initialRiderRadar(state.tripId,state.passengerId);
  return {state:cleared,view:blank(cleared,'No disponible para esta cuenta'),
   connection:'forbidden',commercialRidesEnabled:false};
 }
 if(response.status!==200){
  return {state,view:offline(state,'Servidor temporalmente no disponible'),
   connection:'offline',commercialRidesEnabled:false};
 }
 try{
  const body=await response.json();
  const event=validateEnvelope(body,state);
  if(!event){
   return {state,view:offline(state,'Respuesta del servidor sin verificar'),
    connection:'invalid-response',commercialRidesEnabled:false};
  }
  const updated=receiveRiderRadar(state,event);
  return {state:updated,view:presentRiderRadar(updated,now()),
   connection:'connected',commercialRidesEnabled:false};
 }catch{
  return {state,view:offline(state,'Respuesta de QORE no disponible'),
   connection:'invalid-response',commercialRidesEnabled:false};
 }
}
