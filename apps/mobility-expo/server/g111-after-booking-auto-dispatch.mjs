/**
 * G111: server-owned first dispatch attempt AFTER a durably committed G73
 * AUTO booking. The booked Passenger UUID is taken from verified backend
 * authentication, NEVER from a new client parameter or Driver selection.
 *
 * G85 is already the SQL concurrency/eligibility/offer authority. This
 * adapter can only advance that worker once, then read the owner-scoped G90
 * status. Offer creation is NOT assignment; G38 legal approval and the G71
 * eight-document acceptance gates are untouched.
 *
 * No scheduler, LIVE service, network binding, PSP, GPS or Driver matching
 * authority is created by this isolated STAGING module.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const MODE='STAGING_DEMO_ONLY';
const no=why=>Object.freeze({ok:false,reason:why,qaOnly:true,productionEnabled:false});
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 Object.getPrototypeOf(v)===Object.prototype;
const EXACT=(v,keys)=>plain(v)&&Object.keys(v).length===keys.length&&
 keys.every(key=>Object.hasOwn(v,key));
const receiptKeys=['mode','commercialEnabled','ownerId','bookingKey','tripId',
 'tripState','dispatchState','attempts','offerPendingAcceptance'];
const states=new Set(['SEARCHING_DRIVER','OFFER_PENDING','RETRY_PENDING',
 'SEARCH_EXHAUSTED','CLOSED']);
const validStatus=(r,actor,key,trip)=>EXACT(r,receiptKeys)&&
 r.mode===MODE&&r.commercialEnabled===false&&r.ownerId===actor&&
 r.bookingKey===key&&r.tripId===trip&&
 ['searching','accepted','arriving','in_progress','completed','cancelled']
 .includes(r.tripState)&&states.has(r.dispatchState)&&
 Number.isSafeInteger(r.attempts)&&r.attempts>=0&&r.attempts<=12&&
 r.offerPendingAcceptance===(r.dispatchState==='OFFER_PENDING')&&
 (r.tripState==='searching'||r.dispatchState==='CLOSED');
const workerKeys=['mode','commercialEnabled','status','tripId','offerId'];
const workerResult=(r,trip)=>{
 if(!plain(r)||r.mode!==MODE||r.commercialEnabled!==false||
  !['IDLE','WAITING','OFFERED','CLOSED','EXHAUSTED'].includes(r.status))
  return false;
 if(r.status==='IDLE')return EXACT(r,['mode','commercialEnabled','status']);
 if(r.status==='CLOSED'||r.status==='EXHAUSTED')
  return EXACT(r,['mode','commercialEnabled','status','tripId'])&&r.tripId===trip;
 return EXACT(r,workerKeys)&&r.tripId===trip&&
  (r.status==='OFFERED'?UUID.test(r.offerId??''):r.offerId===null);
};
export const G111_COMMERCIAL_DISPATCH_ENABLED=false;
export function createG111AfterBookingAutoDispatch({
 environment,qaOnly,liveEnabled,readPrivateDispatchStatus,
 runOneDueDispatch
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
 typeof readPrivateDispatchStatus!=='function'||
 typeof runOneDueDispatch!=='function')
  throw Error('G111 requires private G90 and G85 in isolated STAGING QA');
 return Object.freeze({
  async dispatchBookedAuto({passengerId,bookingKey,tripId}={}){
   if(!UUID.test(passengerId??'')||!UUID.test(bookingKey??'')||
    !UUID.test(tripId??'')||passengerId===tripId)
    return no('UNVERIFIED_BOOKING_SCOPE');
   // This owner-scoped G90 check must bind the exact original G73 booking.
   const scope={actorId:passengerId,requestKey:bookingKey};
   let initial;
   try{initial=await readPrivateDispatchStatus(scope);}
   catch{return no('PRIVATE_DISPATCH_UNAVAILABLE');}
   if(!validStatus(initial,passengerId,bookingKey,tripId))
    return no('UNVERIFIED_PERSISTED_BOOKING');
   // Never replay a G85 worker when the queue is already waiting, offered,
   // exhausted or closed. G85 handles its own bounded future retries.
   if(initial.dispatchState!=='SEARCHING_DRIVER')
    return Object.freeze({ok:true,dispatchState:initial.dispatchState,
     attemptExecuted:false,qaOnly:true,productionEnabled:false});
   let attempted;
   try{attempted=await runOneDueDispatch();}
   catch{return no('WORKER_UNCERTAIN_RECONCILE_G90');}
   // G85 selects jobs itself under FOR UPDATE SKIP LOCKED. Reject any
   // mis-scoped result; do NOT claim this Passenger's offer succeeded.
   if(!workerResult(attempted,tripId))
    return no('WORKER_DID_NOT_VERIFY_OWN_TRIP');
   let updated;
   try{updated=await readPrivateDispatchStatus(scope);}
   catch{return no('PRIVATE_DISPATCH_UNAVAILABLE');}
   if(!validStatus(updated,passengerId,bookingKey,tripId))
    return no('UNVERIFIED_WORKER_RECEIPT');
   if(attempted.status==='WAITING'&&
      (updated.dispatchState!=='RETRY_PENDING'||
       updated.attempts!==initial.attempts+1))
    return no('BACKOFF_NOT_PERSISTED');
   if(attempted.status==='OFFERED'&&
      (updated.dispatchState!=='OFFER_PENDING'||
       updated.attempts!==initial.attempts+1))
    return no('OFFER_NOT_PERSISTED');
   if(attempted.status==='IDLE'&&updated.dispatchState==='OFFER_PENDING')
    return no('UNRELATED_WORKER_OFFER');
   return Object.freeze({ok:true,dispatchState:updated.dispatchState,
    attemptExecuted:attempted.status!=='IDLE',qaOnly:true,
    productionEnabled:false});
  }
 });
}
