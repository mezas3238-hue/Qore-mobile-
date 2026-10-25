/**
 * F1 Admin: session-only server proof monotonicity.
 * A 200 response can be individually valid but older than a previously
 * observed revision. Do not resurrect terminal rides or swap immutable
 * quote/route/price linkage while the same authenticated Admin is active.
 * No PII, token, address, Driver identity or database write is kept.
 */
const STATUSES=Object.freeze(['searching','assigned','arriving','in_progress','completed','cancelled']);
const TERMINAL=new Set(['completed','cancelled']);
const fail=code=>Object.freeze({ok:false,code});
const fields=['tripId','routeId','quoteId','bookingRequestKey','service',
 'amountGs','currency','fareVersion'];
function consistent(before,after){
 if(fields.some(field=>before[field]!==after[field]))
  return 'F1_ADMIN_TRIP_LINK_CHANGED';
 if(after.revision<before.revision||after.observedAt<before.observedAt)
  return 'F1_ADMIN_STALE_REVISION';
 if(after.revision===before.revision
  &&(after.status!==before.status
   ||after.assignmentPersisted!==before.assignmentPersisted))
  return 'F1_ADMIN_CONFLICTING_REVISION';
 if(before.assignmentPersisted===true&&after.assignmentPersisted!==true)
  return 'F1_ADMIN_ASSIGNMENT_REGRESSION';
 if(TERMINAL.has(before.status)&&after.status!==before.status)
  return 'F1_ADMIN_TERMINAL_RESURRECTION';
 const prior=STATUSES.indexOf(before.status),next=STATUSES.indexOf(after.status);
 if(prior<0||next<0)return 'F1_ADMIN_UNKNOWN_STATE';
 if(!TERMINAL.has(after.status)&&next<prior)
  return 'F1_ADMIN_STATUS_REGRESSION';
 // A cancellation can happen before any Driver assignment. Completion,
 // however, never emerges directly from searching without assigned proof.
 if(after.status==='completed'&&!after.assignmentPersisted)
  return 'F1_ADMIN_COMPLETION_UNVERIFIED';
 return null;
}
export function createF1AdminTripIntegrityFence(){
 const seen=new Map();
 function observe(proof){
  if(!proof||typeof proof!=='object'||typeof proof.tripId!=='string'
   ||!Number.isSafeInteger(proof.revision)
   ||!Number.isSafeInteger(proof.observedAt)||proof.observedAt<0
   ||!STATUSES.includes(proof.status))
   return fail('F1_ADMIN_INVALID_EVIDENCE');
  const prior=seen.get(proof.tripId);
  if(prior){
   const error=consistent(prior,proof);
   if(error)return fail(error);
  }else if(proof.status==='completed'&&!proof.assignmentPersisted)
   return fail('F1_ADMIN_COMPLETION_UNVERIFIED');
  // The snapshot is purely operational: never persist JWT or PII.
  seen.set(proof.tripId,Object.freeze(Object.fromEntries(
   [...fields,'revision','observedAt','status','assignmentPersisted']
    .map(key=>[key,proof[key]])
  )));
  return Object.freeze({ok:true});
 }
 function clear(){seen.clear();}
 return Object.freeze({observe,clear});
}
