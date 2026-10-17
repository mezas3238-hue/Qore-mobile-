/**
 * Client-side QORE Radar display selector (not an authorization boundary).
 * Events MUST arrive from a JWT-verified, private server-authorized channel.
 * Push notifications cannot mark a ride accepted. Server revision wins.
 * No synthetic position or client-generated ETA is ever added.
 */
export type RadarStatus='searching'|'offer_pending'|'accepted'|'at_pickup'|'in_progress'|'completed'|'cancelled';
export type RadarActor='server';
export type TrustedRiderEvent={
 readonly tripId:string;
 readonly serverRevision:number;
 readonly trackingSequence:number;
 readonly source:RadarActor;
 readonly status:RadarStatus;
 readonly passengerId:string;
 readonly acceptedDriver?:{
  readonly name:string;readonly vehicleKind:'AUTO'|'MOTO';
  readonly model:string;readonly color:string;readonly plate:string;readonly rating:number;
 }|null;
 readonly tracking?:{
  readonly lat:number;readonly lng:number;readonly roadMeters:number;
  readonly etaSeconds:number;readonly locationUpdatedAtMs:number;readonly routeUpdatedAtMs:number;
  readonly trafficAware:true;readonly fallbackUsed:false;
 }|null;
};
export type RiderRadarState={
 readonly tripId:string;
 readonly passengerId:string;
 readonly serverRevision:number;
 readonly trackingSequence:number;
 readonly latest:TrustedRiderEvent|null;
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asInt=(n:number)=>Number.isSafeInteger(n);
const finite=(n:number)=>Number.isFinite(n);
export function initialRiderRadar(tripId:string,passengerId:string):RiderRadarState{
 if(!UUID.test(tripId)||!UUID.test(passengerId))throw new Error('Real verified trip/user IDs required');
 return {tripId,passengerId,serverRevision:-1,trackingSequence:-1,latest:null};
}
export function receiveRiderRadar(current:RiderRadarState,event:TrustedRiderEvent):RiderRadarState{
 if(!event||event.source!=='server'||event.tripId!==current.tripId||
 event.passengerId!==current.passengerId||!asInt(event.serverRevision)||
 event.serverRevision<1||!asInt(event.trackingSequence)||event.trackingSequence<0)
  return current;
 if(event.serverRevision<current.serverRevision||
  (event.serverRevision===current.serverRevision&&event.trackingSequence<=current.trackingSequence))
  return current;
 if(!['searching','offer_pending','accepted','at_pickup','in_progress','completed','cancelled'].includes(event.status))
  return current;
 // Terminal trips never reopen from out-of-order WebSocket or push events.
 if(current.latest&&['completed','cancelled'].includes(current.latest.status))return current;
 // An earlier offer or unaccepted status must not overwrite assigned driver.
 if(current.latest&&['accepted','at_pickup','in_progress'].includes(current.latest.status)&&
    ['searching','offer_pending'].includes(event.status))return current;
 return {tripId:current.tripId,passengerId:current.passengerId,
  serverRevision:event.serverRevision,trackingSequence:event.trackingSequence,latest:event};
}
export type RiderRadarView={
 readonly status:RadarStatus|'not_connected';
 readonly title:string;readonly driver:TrustedRiderEvent['acceptedDriver']|null;
 readonly etaMinutes:number|null;readonly roadMeters:number|null;
 readonly driverPosition:{lat:number;lng:number}|null;
 readonly freshness:'live_estimate'|'awaiting_data'|'stale';
 readonly isCommercialRideEnabled:false;
};
export function presentRiderRadar(state:RiderRadarState,nowMs:number):RiderRadarView{
 const evt=state.latest;
 const none=(status:RiderRadarView['status'],title:string,freshness:RiderRadarView['freshness']='awaiting_data'):RiderRadarView=>({
  status,title,driver:null,etaMinutes:null,roadMeters:null,
  driverPosition:null,freshness,isCommercialRideEnabled:false
 });
 if(!evt||!asInt(nowMs)||nowMs<0)return none('not_connected','Esperando conexión autenticada al servidor');
 if(evt.status==='searching'||evt.status==='offer_pending')
  return none(evt.status,evt.status==='searching'?'Buscando conductores verificados':'Consultando disponibilidad de conductores');
 if(evt.status==='completed'||evt.status==='cancelled')
  return none(evt.status,evt.status==='completed'?'Viaje finalizado':'Viaje cancelado');
 const details=evt.acceptedDriver;
 if(!details||typeof details.name!=='string'||details.name.length<2||
    details.vehicleKind!=='AUTO'||
    typeof details.model!=='string'||details.model.length<2||
    typeof details.plate!=='string'||!/^[A-Z0-9-]{4,12}$/.test(details.plate)||
    !finite(details.rating)||details.rating<0||details.rating>5)
  return none('not_connected','La identidad del conductor aún no está confirmada');
 const driver={
  name:details.name,vehicleKind:details.vehicleKind,model:details.model,
  color:details.color,plate:details.plate,rating:details.rating,
 };
 const heading=evt.status==='accepted'?'Conductor de camino':
  evt.status==='at_pickup'?'Tu conductor llegó':'Viaje iniciado';
 if(evt.status!=='accepted')return {
  ...none(evt.status,heading),driver
 };
 const t=evt.tracking;
 if(!t)return {...none(evt.status,'Calculando distancia y llegada'),driver};
 const good=finite(t.lat)&&t.lat>=-90&&t.lat<=90&&
  finite(t.lng)&&t.lng>=-180&&t.lng<=180&&
  asInt(t.roadMeters)&&t.roadMeters>=0&&t.roadMeters<=250_000&&
  asInt(t.etaSeconds)&&t.etaSeconds>=0&&t.etaSeconds<=21_600&&
  asInt(t.locationUpdatedAtMs)&&asInt(t.routeUpdatedAtMs)&&
  t.locationUpdatedAtMs<=nowMs+5000&&t.routeUpdatedAtMs<=nowMs+5000&&
  nowMs-t.locationUpdatedAtMs<=30_000&&
  nowMs-t.routeUpdatedAtMs<=20_000&&
  t.trafficAware===true&&t.fallbackUsed===false;
 if(!good)return {...none(evt.status,'Actualizando GPS y tiempo de llegada','stale'),driver};
 return {
  status:evt.status,title:heading,driver,
  etaMinutes:Math.max(1,Math.ceil(t.etaSeconds/60)),
  roadMeters:t.roadMeters,driverPosition:{lat:t.lat,lng:t.lng},
  freshness:'live_estimate',isCommercialRideEnabled:false
 };
}
