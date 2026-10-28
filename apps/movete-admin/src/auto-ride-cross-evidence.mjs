/**
 * D: independent Admin F1 and service-trace receipts for the exact same
 * AUTO_RIDE ID. Two valid API responses are not proof of bank settlement or
 * E2E deployment. This checker never calls the network or mutates a trip.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=code=>Object.freeze({ok:false,code,financiallyReconciled:false});
const stages=new Set(['searching','assigned','arriving','in_progress',
 'completed','cancelled']);
export function inspectAutoRideCrossEvidence({
 trace,f1,now=Date.now()
}={}){
 if(!trace||!f1||!Number.isSafeInteger(now))
  return fail('CROSS_EVIDENCE_MISSING');
 if(!UUID.test(trace.serviceId??'')||trace.serviceId!==f1.tripId
  ||trace.serviceKind!=='AUTO_RIDE')
  return fail('CROSS_DIFFERENT_SERVICE');
 if(trace.qaOnly!==true||trace.productionEnabled!==false
  ||f1.qaOnly!==true||f1.productionEnabled!==false
  ||trace.serverPersistedReported!==true)
  return fail('CROSS_UNTRUSTED_ENVIRONMENT');
 if(!Number.isSafeInteger(trace.observedAt)
  ||!Number.isSafeInteger(f1.observedAt)
  ||!Number.isSafeInteger(trace.expiresAt)
  ||!Number.isSafeInteger(f1.expiresAt)
  ||trace.observedAt>now||f1.observedAt>now
  ||trace.expiresAt<=now||f1.expiresAt<=now)
  return fail('CROSS_STALE_RECEIPT');
 if(!UUID.test(trace.bookingRequestKey??'')
  ||trace.bookingRequestKey!==f1.bookingRequestKey
  ||!UUID.test(trace.quoteId??'')
  ||trace.quoteId!==f1.quoteId)
  return fail('CROSS_IMMUTABLE_LINK_MISMATCH');
 if(!stages.has(trace.status)||trace.status!==f1.status)
  return fail('CROSS_STATUS_CONFLICT');
 if(!Number.isSafeInteger(trace.revision)||trace.revision<1
  ||!Number.isSafeInteger(f1.revision)||f1.revision<1)
  return fail('CROSS_BAD_REVISION');
 if(!['UNASSIGNED','ASSIGNED','CLOSED','NOT_ASSIGNABLE'].includes(
   trace.assignment?.state))
  return fail('CROSS_ASSIGNMENT_UNKNOWN');
 if(f1.assignmentPersisted===true&&(
   !['ASSIGNED','CLOSED'].includes(trace.assignment.state)
   ||trace.assignment.legalGate!=='CLEARED'))
  return fail('CROSS_ASSIGNMENT_MISMATCH');
 if(['assigned','arriving','in_progress','completed'].includes(f1.status)
  &&f1.assignmentPersisted!==true)
  return fail('CROSS_ASSIGNMENT_MISMATCH');
 if(f1.status==='completed'){
  const ledger=trace.ledger;
  if(!ledger||ledger.reconciliationStatus!=='RECONCILED')
   return fail('CROSS_LEDGER_NOT_RECONCILED');
  if(ledger.serviceId!==f1.tripId||ledger.currency!=='PYG'
   ||f1.currency!=='PYG'||!Number.isSafeInteger(f1.amountGs)
   ||f1.amountGs<=0||ledger.grossGs!==f1.amountGs)
   return fail('CROSS_FARE_LEDGER_MISMATCH');
  return Object.freeze({ok:true,code:'CROSS_LINKED_RECONCILED_RECEIPTS',
   financiallyReconciled:true});
 }
 if(trace.ledger?.reconciliationStatus==='RECONCILED')
  return fail('CROSS_PREMATURE_RECONCILIATION');
 return Object.freeze({ok:true,code:'CROSS_LINKED_PENDING_SETTLEMENT',
  financiallyReconciled:false});
}
