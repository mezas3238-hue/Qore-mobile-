/**
 * F1: transparently continue a newly confirmed AUTO booking by ONE
 * Passenger-owned read-only status GET, then open tracking. Never book,
 * dispatch or infer assignment from the G73 receipt.
 */
const RETRY_BACKOFF_MS=5000;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=code=>Object.freeze({ok:false,code});
function scopeOf(x){
 if(!x||x.authenticated!==true||x.account?.role!=='passenger'
  ||!UUID.test(x.account?.subject??'')
  ||!Number.isSafeInteger(x.privateViewRevision)
  ||x.privateViewRevision<0
  ||x.autoPrequote?.phase!=='confirmed'
  ||!UUID.test(x.autoPrequote?.tripId??'')
  ||x.rideContinuation?.canVerify!==true
  ||x.rideContinuation?.qaOnly!==true
  ||x.rideContinuation?.productionEnabled!==false
  ||x.rideContinuation.tripId!==x.autoPrequote.tripId
  ||x.tracking?.subscriptionActive===true)
  return null;
 return Object.freeze({subject:x.account.subject,
  revision:x.privateViewRevision,tripId:x.autoPrequote.tripId});
}
function trackedOriginal(snapshot,scope,minRevision=1){
 return snapshot?.authenticated===true
  &&snapshot.account?.role==='passenger'
  &&snapshot.account.subject===scope.subject
  &&snapshot.privateViewRevision===scope.revision
  &&snapshot.autoPrequote?.phase==='confirmed'
  &&snapshot.autoPrequote.tripId===scope.tripId
  &&snapshot.rideContinuation?.canVerify===true
  &&snapshot.rideContinuation.tripId===scope.tripId
  &&snapshot.rideContinuation.qaOnly===true
  &&snapshot.rideContinuation.productionEnabled===false
  &&snapshot.tracking?.subscriptionActive===true
  &&snapshot.tracking.tripId===scope.tripId
  &&Number.isSafeInteger(snapshot.tracking.revision)
  &&snapshot.tracking.revision>=minRevision;
}
function same(x,y){
 return Boolean(x&&y&&x.subject===y.subject&&x.revision===y.revision
  &&x.tripId===y.tripId);
}
export function createF1AutoRideContinuation({
 readSnapshot,verifyRide,reverifyTracking=null,isForeground=()=>true,
 onVerified=()=>{},onFailure=()=>{},onBusy=()=>{},now=Date.now
}={}){
 if([readSnapshot,verifyRide,isForeground,onVerified,onFailure,onBusy,now]
  .some(fn=>typeof fn!=='function'))
  throw Error('AUTO continuation requires scoped verification callbacks');
 if(reverifyTracking!==null&&typeof reverifyTracking!=='function')
  throw Error('AUTO deferred tracking requires trusted status GET');
 let attempted=null,busy=false,closed=false,failedKey=null,retryAfter=0;
 let deferred=null,deferredRetryAfter=0;
 async function tryResume(){
  if(closed)return fail('AUTO_CONTINUATION_CLOSED');
  if(busy)return fail('AUTO_CONTINUATION_IN_FLIGHT');
  if(!isForeground())return fail('AUTO_CONTINUATION_BACKGROUND');
  // Navigation is deferred if the verified GET completed while backgrounded.
  // Only a NEW owner-scoped read can unlock foreground navigation.
  if(deferred!==null){
   const scope=deferred;
   let before;
   try{before=readSnapshot();}
   catch{deferred=null;return fail('AUTO_CONTINUATION_SCOPE_CHANGED');}
   if(!trackedOriginal(before,scope,scope.minRevision)){
    deferred=null;return fail('AUTO_CONTINUATION_SCOPE_CHANGED');
   }
   if(reverifyTracking===null)return fail('AUTO_CONTINUATION_REVERIFY_UNAVAILABLE');
   const time=now();
   if(!Number.isSafeInteger(time)||time<deferredRetryAfter)
    return fail('AUTO_CONTINUATION_RETRY_COOLDOWN');
   busy=true;onBusy(true);
   let answer;
   try{answer=await reverifyTracking();}
   catch{answer=fail('AUTO_STATUS_UNAVAILABLE');}
   finally{busy=false;if(!closed)onBusy(false);}
   if(closed)return fail('AUTO_CONTINUATION_CLOSED');
   let current;
   try{current=readSnapshot();}
   catch{deferred=null;return fail('AUTO_CONTINUATION_SCOPE_CHANGED');}
   if(!trackedOriginal(current,scope,scope.minRevision)){
    deferred=null;return fail('AUTO_CONTINUATION_SCOPE_CHANGED');
   }
   if(answer?.ok===true){
    if(!isForeground())return fail('AUTO_CONTINUATION_BACKGROUND');
    deferred=null;onVerified(scope.tripId);
    return Object.freeze({ok:true,tripId:scope.tripId,
     qaOnly:true,productionEnabled:false});
   }
   if(!isForeground())return fail('AUTO_CONTINUATION_BACKGROUND');
   const at=now();
   deferredRetryAfter=Number.isSafeInteger(at)&&at>=0&&
    at<=Number.MAX_SAFE_INTEGER-RETRY_BACKOFF_MS?
    at+RETRY_BACKOFF_MS:Number.MAX_SAFE_INTEGER;
   onFailure('AUTO_STATUS_NOT_VERIFIED');
   return fail('AUTO_STATUS_NOT_VERIFIED');
  }
  let scope;
  try{scope=scopeOf(readSnapshot());}
  catch{return fail('AUTO_CONTINUATION_NOT_VERIFIED');}
  if(!scope)return fail('AUTO_CONTINUATION_NOT_VERIFIED');
  const key=scope.subject+':'+scope.revision+':'+scope.tripId;
  if(attempted===key)return fail('AUTO_CONTINUATION_ALREADY_ATTEMPTED');
  // An unsuccessful status GET must not permanently strand a booked Rider.
  // Only retry a private GET on a later foreground opportunity, with backoff.
  // No booking or dispatch POST is ever sent by this continuation.
  if(failedKey===key){
   const at=now();
   if(!Number.isSafeInteger(at)||at<retryAfter)
    return fail('AUTO_CONTINUATION_RETRY_COOLDOWN');
   failedKey=null;
  }
  attempted=key;busy=true;onBusy(true);
  let result;
  try{result=await verifyRide();}
  catch{result=fail('AUTO_STATUS_UNAVAILABLE');}
  finally{
   busy=false;
   if(!closed)onBusy(false);
  }
  if(closed)return fail('AUTO_CONTINUATION_CLOSED');
  let current;
  try{current=readSnapshot();}catch{return fail('AUTO_CONTINUATION_SCOPE_CHANGED');}
  // Verification creates tracking, so original scopeOf() is no longer valid.
  // Recheck immutable Passenger, privacy epoch and exact trip instead.
  const mine=trackedOriginal(current,scope);
  if(result?.ok===true&&result.tripId===scope.tripId&&mine){
   if(!isForeground()){
    deferred=Object.freeze({...scope,minRevision:current.tracking.revision});
    deferredRetryAfter=0;
    return Object.freeze({ok:true,tripId:scope.tripId,
     deferredNavigation:true,qaOnly:true,productionEnabled:false});
   }
   onVerified(scope.tripId);
   return Object.freeze({ok:true,tripId:scope.tripId,
    qaOnly:true,productionEnabled:false});
  }
  // Do not pin a failed verification forever. Preserve the same original
  // Passenger/trip/privacy scope and bound retries to foreground GETs.
  attempted=null;
  if(same(scope,scopeOf(current))){
   const at=now();
   failedKey=key;
   retryAfter=Number.isSafeInteger(at)&&at>=0&&
    at<=Number.MAX_SAFE_INTEGER-RETRY_BACKOFF_MS?
    at+RETRY_BACKOFF_MS:Number.MAX_SAFE_INTEGER;
   onFailure('AUTO_STATUS_NOT_VERIFIED');
  }
  return fail('AUTO_STATUS_NOT_VERIFIED');
 }
 return Object.freeze({tryResume,close:()=>{closed=true;},
  isBusy:()=>busy});
}
