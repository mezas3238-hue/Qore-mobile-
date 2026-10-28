/**
 * D #18 — anti-rollback guard on read-only Admin traces.
 * An individually valid server 200 may be older than a prior observation.
 * Keep only public operational IDs/status/amounts in RAM for one Admin.
 * This never proves that PostgreSQL or MFA is deployed.
 */
const fail=code=>Object.freeze({ok:false,code});
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const STATES=Object.freeze({
 AUTO_RIDE:['requested','searching','assigned','arriving','in_progress','completed','cancelled'],
 MOTO_RIDE:['requested','searching','assigned','arriving','in_progress','completed','cancelled'],
 DELIVERY_AUTO:['requested','searching','assigned','pickup_pending','picked_up','in_transit','delivered','returned','cancelled'],
 DELIVERY_MOTO:['requested','searching','assigned','pickup_pending','picked_up','in_transit','delivered','returned','cancelled'],
 COMMERCE:['requested','confirmed','preparing','ready','in_transit','delivered','returned','cancelled']
});
const terminal=new Set(['completed','delivered','returned','cancelled']);
const assignmentKey=a=>JSON.stringify([a?.state,a?.legalGate]);
const ledgerKey=l=>l===null?'null':JSON.stringify([
 l.serviceId,l.currency,l.grossGs,l.platformCommissionGs,
 l.customerSubsidyGs,l.driverPayoutGs,l.reconciliationStatus]);
const eventKey=e=>JSON.stringify([e.eventId,e.serviceId,e.sequence,e.status,e.at]);
function compare(previous,current){
 if(previous.serviceKind!==current.serviceKind||
  previous.bookingRequestKey!==current.bookingRequestKey||
  previous.quoteId!==current.quoteId||
  (current.serviceKind==='COMMERCE'&&(
    previous.branchId!==current.branchId||
    previous.vehicleKind!==current.vehicleKind||
    previous.orderSubtotalGs!==current.orderSubtotalGs)))
  return 'TRACE_IMMUTABLE_LINK_CHANGED';
 if(current.serviceKind==='COMMERCE'&&previous.deliveryId!==current.deliveryId&&
  !(previous.deliveryId===null&&typeof current.deliveryId==='string'&&
    current.revision===previous.revision+1&&current.revision===5&&current.status==='ready'))
  return 'TRACE_DELIVERY_LINK_CHANGED';
 if(current.revision<previous.revision
  ||current.observedAt<previous.observedAt)
  return 'TRACE_STALE_REVISION';
 if(terminal.has(previous.status)&&current.status!==previous.status)
  return 'TRACE_TERMINAL_RESURRECTION';
 const priorStage=STATES[current.serviceKind]?.indexOf(previous.status)??-1;
 const nextStage=STATES[current.serviceKind]?.indexOf(current.status)??-1;
 if(priorStage<0||nextStage<0)return 'TRACE_UNKNOWN_STAGE';
 if(current.status!=='cancelled'&&current.status!=='returned'
   &&nextStage<priorStage)return 'TRACE_STATE_REGRESSION';
 if(current.events.length<previous.events.length)
  return 'TRACE_HISTORY_TRUNCATED';
 for(let i=0;i<previous.events.length;i++){
  if(eventKey(previous.events[i])!==eventKey(current.events[i]))
   return 'TRACE_HISTORY_REWRITTEN';
 }
 if(current.revision===previous.revision){
  if(current.status!==previous.status
   ||assignmentKey(current.assignment)!==assignmentKey(previous.assignment)
   ||ledgerKey(current.ledger)!==ledgerKey(previous.ledger)
   ||current.events.length!==previous.events.length)
   return 'TRACE_CONFLICTING_REVISION';
 }
 if(previous.ledger?.reconciliationStatus==='RECONCILED'&&
  ledgerKey(previous.ledger)!==ledgerKey(current.ledger))
  return 'TRACE_RECONCILED_LEDGER_CHANGED';
 // A cleared legal gate may later be revoked by the backend. Do not reject
 // that revocation, but never restore a disallowed assignment.
 return null;
}
export function createServiceTraceIntegrityFence(){
 const seen=new Map();
 function observe(dto){
  if(!obj(dto)||typeof dto.serviceId!=='string'
   ||!Object.hasOwn(STATES,dto.serviceKind)
   ||!Array.isArray(dto.events)||!Number.isSafeInteger(dto.revision)
   ||!Number.isSafeInteger(dto.observedAt)
   ||!obj(dto.assignment)||!Object.hasOwn(dto,'ledger'))
   return fail('TRACE_INVALID_PROOF');
  const previous=seen.get(dto.serviceId);
  if(previous){
   const reason=compare(previous,dto);
   if(reason)return fail(reason);
  }
  // Trusted projection already sanitizes transport in service-trace-gateway.
  // Freeze copies to avoid external mutation of previous evidence.
  seen.set(dto.serviceId,Object.freeze({
   serviceKind:dto.serviceKind,serviceId:dto.serviceId,
   bookingRequestKey:dto.bookingRequestKey,quoteId:dto.quoteId,
   ...(dto.serviceKind==='COMMERCE'?{branchId:dto.branchId,
    vehicleKind:dto.vehicleKind,orderSubtotalGs:dto.orderSubtotalGs,
    deliveryId:dto.deliveryId}:{}),
   status:dto.status,revision:dto.revision,observedAt:dto.observedAt,
   assignment:Object.freeze({...dto.assignment}),
   ledger:dto.ledger===null?null:Object.freeze({...dto.ledger}),
   events:Object.freeze(dto.events.map(e=>Object.freeze({...e})))
  }));
  return Object.freeze({ok:true});
 }
 return Object.freeze({observe,clear:()=>seen.clear()});
}
