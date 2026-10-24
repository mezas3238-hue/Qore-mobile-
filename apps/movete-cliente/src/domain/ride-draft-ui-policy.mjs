/**
 * R53 — fail-closed local ride editor UI policy.
 * Read-only snapshot projection. No fares, GPS, availability, persistence,
 * remote dispatch or reservation is performed by this module.
 */
const PHASES=new Set(['idle','ready','in_flight','retryable','acknowledged','failed']);
const OPERATIONS=new Set([null,'rideRequest','deliveryRequest','fareQuote','paymentAuthorize']);
const SERVICES=new Set(['economico','confort','xl']);
const fail=code=>Object.freeze({ok:false,code});
export function projectRideDraftUi({
 phase='idle',operation=null,authenticated=false,validated=false,
 stopsCount=0,service='economico'
}={}){
 if(!PHASES.has(phase)||!OPERATIONS.has(operation)
  ||typeof authenticated!=='boolean'||typeof validated!=='boolean'
  ||!Number.isSafeInteger(stopsCount)||stopsCount<0||stopsCount>8
  ||!SERVICES.has(service))
  return fail('INVALID_RIDE_UI_STATE');
 if(phase==='idle'&&operation!==null)return fail('INVALID_IDLE_OPERATION');
 if(phase!=='idle'&&operation===null)return fail('MISSING_MUTATION_OPERATION');
 const editable=phase==='idle';
 const ownDraft=phase==='ready'&&operation==='rideRequest';
 const canPrepare=editable&&authenticated&&validated&&stopsCount===0;
 let status;
 if(ownDraft)status='Borrador de viaje preparado en esta sesión. No se envió ni buscó conductor.';
 else if(!editable)
  status='Existe una operación pendiente o sin conciliar. La ruta y el servicio quedan bloqueados; no se genera otro viaje.';
 else if(stopsCount>0)
  status='Ruta con paradas en borrador local. El servidor todavía no admite cotizar ni solicitar esas paradas.';
 else if(!authenticated)
  status='Podés revisar la ruta localmente. Iniciá sesión para preparar el viaje; no hay conductor asignado.';
 else if(validated)
  status='Ruta y servicio revisados localmente. Se puede preparar el borrador sin enviarlo; la tarifa está pendiente.';
 else status='Ruta editable. Revisá origen, destino y servicio antes de preparar. Sin cotización ni despacho.';
 return Object.freeze({ok:true,editable,canReview:editable,
  canPrepare,canDiscard:ownDraft,status,
  draftOnly:true,requestSent:false,driverAssigned:false,
  fareVerified:false,paymentCaptured:false});
}
