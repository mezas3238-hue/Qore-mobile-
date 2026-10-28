/**
 * R52 Delivery UI gate. A local draft is NOT a dispatched courier request.
 * Interpret only the public mutation phase; never expose addresses, request
 * keys, account subjects, weight, or tracking information in announcements.
 */
const PHASES=new Set(['idle','ready','in_flight','retryable','acknowledged','failed']);
const OPS=new Set([null,'rideRequest','deliveryRequest','fareQuote','paymentAuthorize']);
const fail=code=>Object.freeze({ok:false,code});
export function projectDeliveryDraftUi({
 phase='idle',operation=null,authenticated=false,validated=false,
 restricted=false,vehicleKind='MOTO'
}={}){
 if(!PHASES.has(phase)||!OPS.has(operation)
  ||typeof authenticated!=='boolean'
  ||typeof validated!=='boolean'||typeof restricted!=='boolean'
  ||!['MOTO','AUTO'].includes(vehicleKind))
  return fail('INVALID_DELIVERY_UI_STATE');
 if(phase==='idle'&&operation!==null)return fail('INVALID_IDLE_OPERATION');
 if(phase!=='idle'&&operation===null)return fail('MISSING_MUTATION_OPERATION');
 const editable=phase==='idle';
 const ownDraft=phase==='ready'&&operation==='deliveryRequest';
 const canReview=editable;
 const canPrepare=editable&&authenticated&&validated&&!restricted;
 const canDiscard=ownDraft;
 let status;
 if(ownDraft)status='Borrador de envío preparado en esta sesión. No fue enviado ni se asignó repartidor.';
 else if(phase!=='idle')
  status='Hay una operación pendiente, preparada o sin conciliar. El formulario está bloqueado. No se generó otro envío.';
 else if(restricted)
  status='Declaraste artículos restringidos. No se puede preparar este envío.';
 else if(!authenticated)
  status='Formulario local editable. Iniciá sesión para preparar un envío. No hay despacho ni cobro.';
 else if(validated)
  status='Borrador revisado localmente. Podés prepararlo sin enviarlo; precio y repartidor pendientes del servidor.';
 else status='Formulario editable. Revisá origen, destino y carga antes de preparar. No hay envío confirmado.';
 return Object.freeze({ok:true,editable,canReview,canPrepare,canDiscard,
  status,vehicleKind,requestSent:false,courierAssigned:false,
  paymentCaptured:false,serverPriceVerified:false});
}
