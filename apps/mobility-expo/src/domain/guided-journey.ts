/**
 * Same-device ride walkthrough. NEVER a dispatch or entitlement API.
 * This is the existing offline rides reducer exposed as a guided QA journey.
 * The route estimates, driver and fares are demonstrative; no live operations.
 */
import {
 createDemoRide,initialRideState,PLACES,rideReducer,type Action,
 type Ride,type RideStage,type RideState,
} from './rides';

export type JourneyPhase='request'|'accept'|'arrive'|'start'|'complete'|'receipt'|'cancelled';
export type JourneyActor='pasajero'|'conductor'|'sistema-demo';
export type JourneyGuide={
 readonly phase:JourneyPhase;
 readonly actor:JourneyActor;
 readonly index:number;
 readonly title:string;
 readonly instruction:string;
 readonly buttonText:string|null;
 readonly commercialRidesEnabled:false;
 readonly paymentsEnabled:false;
 readonly usesRealGps:false;
};
const GUIDE:Readonly<Record<JourneyPhase,Omit<JourneyGuide,'phase'>>> = {
 request:{
  actor:'pasajero',index:0,title:'1. Pasajero solicita',
  instruction:'Se crea un pedido ficticio entre dos puntos de Asunción. No sale del teléfono.',
  buttonText:'Crear solicitud DEMO',commercialRidesEnabled:false,paymentsEnabled:false,usesRealGps:false,
 },
 accept:{
  actor:'conductor',index:1,title:'2. Conductor acepta',
  instruction:'Un conductor de ejemplo acepta en el mismo dispositivo; nadie recibe notificaciones reales.',
  buttonText:'Aceptar como conductor DEMO',commercialRidesEnabled:false,paymentsEnabled:false,usesRealGps:false,
 },
 arrive:{
  actor:'conductor',index:2,title:'3. Conductor llega',
  instruction:'Simulá la llegada al punto de partida. No se consulta posición del GPS.',
  buttonText:'Marcar llegada DEMO',commercialRidesEnabled:false,paymentsEnabled:false,usesRealGps:false,
 },
 start:{
  actor:'conductor',index:3,title:'4. Comienza el viaje',
  instruction:'El conductor ficticio inicia el trayecto. No hay navegación o seguimiento en vivo.',
  buttonText:'Iniciar viaje DEMO',commercialRidesEnabled:false,paymentsEnabled:false,usesRealGps:false,
 },
 complete:{
  actor:'conductor',index:4,title:'5. Finaliza el viaje',
  instruction:'Se marca el final y se calcula únicamente un recibo ilustrativo.',
  buttonText:'Finalizar viaje DEMO',commercialRidesEnabled:false,paymentsEnabled:false,usesRealGps:false,
 },
 receipt:{
  actor:'sistema-demo',index:5,title:'6. Comprobante ilustrativo',
  instruction:'Flujo simulado completado. No hubo pago, cobro ni conductor real asignado.',
  buttonText:null,commercialRidesEnabled:false,paymentsEnabled:false,usesRealGps:false,
 },
 cancelled:{
  actor:'sistema-demo',index:0,title:'Viaje de prueba cancelado',
  instruction:'El pedido ficticio fue cancelado; no se realizó cobro.',
  buttonText:null,commercialRidesEnabled:false,paymentsEnabled:false,usesRealGps:false,
 },
};
function classify(state:RideState):{phase:JourneyPhase;ride:Ride|undefined}{
 const ride=state.rides.find(r=>!['completed','cancelled'].includes(r.stage));
 if(ride){
  const phases:Readonly<Record<RideStage,JourneyPhase>>={
   searching:'accept',accepted:'arrive',arriving:'start',in_progress:'complete',
   completed:'receipt',cancelled:'cancelled',
  };
  return {phase:phases[ride.stage],ride};
 }
 const last=state.rides[0];
 if(last?.stage==='completed')return {phase:'receipt',ride:last};
 if(last?.stage==='cancelled')return {phase:'cancelled',ride:last};
 return {phase:'request',ride:undefined};
}
export function guideJourney(state:RideState):JourneyGuide{
 const {phase}=classify(state);
 return {phase,...GUIDE[phase]};
}
/** Recommended next button action only. Never authorized for a real ride. */
export function nextJourneyAction(state:RideState):Action|null{
 const {phase,ride}=classify(state);
 if(phase==='request')return {type:'request',ride:createDemoRide(PLACES[0],PLACES[1],'economico')};
 if(!ride || phase==='receipt'||phase==='cancelled')return null;
 if(phase==='accept'&&!state.driverAvailable)return null;
 return {type:phase,id:ride.id};
}
/** A single guided button tap advances exactly one simulated transition. */
export function advanceJourney(state:RideState):RideState{
 const action=nextJourneyAction(state);
 return action?rideReducer(state,action):state;
}
export {initialRideState};
