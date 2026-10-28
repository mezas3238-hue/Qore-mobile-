/**
 * R58 — User-facing recovery state for an UNCONFIRMED ride or delivery POST.
 * Pure read model. Does not reveal requestKey, bearer, service ID or PII.
 * Does not authorize HTTP or change backend state.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPERATIONS=new Set(['rideRequest','deliveryRequest']);
const PHASES=new Set(['failed','in_flight','acknowledged']);
const fail=code=>Object.freeze({ok:false,code,visible:false,canRead:false});
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const validActor=x=>object(x)&&x.authenticated===true
 &&x.account?.role==='passenger'
 &&typeof x.account.subject==='string'&&UUID.test(x.account.subject)
 &&Number.isSafeInteger(x.privateViewRevision)&&x.privateViewRevision>=0;
const sameActor=(a,b)=>validActor(a)&&validActor(b)
 &&a.account.subject===b.account.subject
 &&a.privateViewRevision===b.privateViewRevision;
export function projectBookingRecoveryUi(displayed,current,{
 operation='rideRequest'
}={}){
 if(!OPERATIONS.has(operation))return fail('INVALID_OPERATION');
 if(!sameActor(displayed,current))return fail('SESSION_CHANGED');
 const a=displayed.mutation,b=current.mutation;
 if(!object(a)||!object(b)||a.operation!==operation||b.operation!==operation
  ||!PHASES.has(a.phase)||a.phase!==b.phase
  ||typeof a.requestKey!=='string'||!UUID.test(a.requestKey)
  ||a.requestKey!==b.requestKey)
  return fail('REQUEST_CHANGED');
 const recoveryReady=displayed.bookingRecovery?.readReady===true
  &&current.bookingRecovery?.readReady===true
  &&displayed.bookingRecovery?.productionEnabled===false
  &&current.bookingRecovery?.productionEnabled===false;
 const kind=operation==='rideRequest'?'viaje':'envío';
 let message,canRead=false;
 if(a.phase==='failed'){
  canRead=recoveryReady;
  message='No pudimos confirmar el resultado de tu '+kind
   +'. La solicitud podría estar registrada. No generes otra solicitud.'
   +(canRead?' Podés consultar su estado sin volver a enviarla.'
    :' La consulta todavía necesita un servidor autorizado.');
 }else if(a.phase==='in_flight'){
  message='La solicitud de '+kind
   +' se está procesando o consultando. No inicies otra solicitud.';
 }else{
  message='El sistema reconoció la solicitud de '+kind
   +' en QA. Esto no significa que haya un conductor asignado,'
   +' un despacho activo o una reserva comercial.';
 }
 return Object.freeze({ok:true,visible:true,canRead,phase:a.phase,
  message,actionLabel:canRead?'Consultar resultado sin reenviar':'',
  productionEnabled:false,postReplayAllowed:false});
}
