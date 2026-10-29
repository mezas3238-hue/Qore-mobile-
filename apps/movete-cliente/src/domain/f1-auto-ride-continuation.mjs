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
function same(x,y){
 return Boolean(x&&y&&x.subject===y.subject&&x.revision===y.revision
  &&x.tripId===y.tripId);
}
export function createF1AutoRideContinuation({
 readSnapshot,verifyRide,isForeground=()=>true,
 onVerified=()=>{},onFailure=()=>{},onBusy=()=>{},now=Date.now
}={}){
 if([readSnapshot,verifyRide,isForeground,onVerified,onFailure,onBusy,now]
  .some(fn=>typeof fn!=='function'))
  throw Error('AUTO continuation requires scoped verification callbacks');
 let attempted=null,busy=false,closed=false,failedKey=null,retryAfter=0;
 async function tryResume(){
  if(closed)return fail('AUTO_CONTINUATION_CLOSED');
  if(busy)return fail('AUTO_CONTINUATION_IN_FLIGHT');
  if(!isForeground())return fail('AUTO_CONTINUATION_BACKGROUND');
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
  const mine=current?.authenticated===true
   &&current?.account?.role==='passenger'
   &&current.account.subject===scope.subject
   &&current.privateViewRevision===scope.revision
   &&current.tracking?.subscriptionActive===true
   &&current.tracking.tripId===scope.tripId
   &&Number.isSafeInteger(current.tracking.revision)
   &&current.tracking.revision>=1;
  if(result?.ok===true&&result.tripId===scope.tripId&&mine){
   if(!isForeground())return Object.freeze({ok:true,tripId:scope.tripId,
    deferredNavigation:true,qaOnly:true,productionEnabled:false});
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
