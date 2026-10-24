/**
 * R54 — Guard passenger cancellation actions against stale React snapshots.
 * This checks UI scope only. Backend remains sole authority to cancel a trip
 * or determine charges/refunds; this code NEVER sends a request.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES=new Set(['searching','assigned','arriving']);
const ACTIONS=new Set(['prepare','submit','retry']);
const fail=code=>Object.freeze({ok:false,code});
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&UUID.test(x);
const actor=x=>x?.authenticated===true&&x.account?.role==='passenger'
 &&id(x.account.subject)
 &&Number.isSafeInteger(x.privateViewRevision)&&x.privateViewRevision>=0;
const tracking=x=>obj(x)&&x.subscriptionActive===true&&x.syncing===false
 &&id(x.tripId)&&STATES.has(x.state)
 &&Number.isSafeInteger(x.revision)&&x.revision>=1;
const cancellation=x=>obj(x)&&x.contractReady===true
 &&['idle','ready','retryable'].includes(x.phase);
export function guardTrackingCancellationUiAction(displayed,current,{
 action='prepare'
}={}){
 if(!ACTIONS.has(action))return fail('INVALID_CANCEL_ACTION');
 if(!actor(displayed)||!actor(current)
  ||displayed.account.subject!==current.account.subject
  ||displayed.privateViewRevision!==current.privateViewRevision)
  return fail('CANCEL_SESSION_CHANGED');
 const old=displayed.tracking,now=current.tracking;
 if(!tracking(old)||!tracking(now))return fail('CANCEL_TRIP_NOT_VERIFIED');
 if(old.tripId!==now.tripId||old.state!==now.state
  ||old.revision!==now.revision)
  return fail('CANCEL_TRACKING_CHANGED');
 const before=displayed.cancellation,after=current.cancellation;
 if(!cancellation(before)||!cancellation(after)
  ||before.phase!==after.phase)
  return fail('CANCEL_OPERATION_CHANGED');
 if(action==='prepare'&&!['idle','ready'].includes(after.phase))
  return fail('CANCEL_OPERATION_CHANGED');
 if(action==='submit'&&after.phase!=='ready')
  return fail('CANCEL_OPERATION_CHANGED');
 if(action==='retry'&&after.phase!=='retryable')
  return fail('CANCEL_OPERATION_CHANGED');
 if(after.phase==='idle'){
  if(after.tripId!==null||before.tripId!==null
   ||after.requestKey!==null||before.requestKey!==null)
   return fail('CANCEL_OPERATION_CHANGED');
 }else if(!id(before.tripId)||before.tripId!==now.tripId
  ||before.tripId!==after.tripId
  ||!id(before.requestKey)||before.requestKey!==after.requestKey)
  return fail('CANCEL_OPERATION_CHANGED');
 return Object.freeze({ok:true,scope:'CURRENT_AUTHORIZED_RIDE_UI_ONLY',
  tripId:now.tripId,
  // Existing retry must reuse its requestKey in the backend controller.
  cancellationSent:false,refundConfirmed:false,driverAssignedByUi:false});
}
