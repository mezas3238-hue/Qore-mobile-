/**
 * Driver G107: a G4 acceptance receipt is not assignment authority.
 * Only the separately authenticated, owner-scoped G106 current-trip GET
 * may authorize navigation to G65 trip controls. No navigation after
 * rejection, uncertain ACK, mismatched trip, logout or missing backend.
 */
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES=new Set(['accepted','arriving','in_progress']);
export const DRIVER_ACCEPTED_RIDE_RESUME_LIVE_ENABLED=false;
/**
 * G121C: an existing Driver trip can be resumed after an app restart only
 * after a FRESH G106 owner-scoped GET. Never navigate from a remembered ID,
 * an offer receipt, or a stale local screen snapshot.
 */
export async function verifyResumableDriverAutoTrip({
 expectedTripId,minimumRevision=2,recoverCurrent
}={}){
 if(!ID.test(expectedTripId??'')||
   !Number.isSafeInteger(minimumRevision)||minimumRevision<2||
   typeof recoverCurrent!=='function')
  return Object.freeze({ok:false,reason:'UNVERIFIED_ASSIGNMENT'});
 let current;
 try{current=await recoverCurrent();}
 catch{return Object.freeze({ok:false,reason:'UNVERIFIED_ASSIGNMENT'});}
 if(!current||typeof current!=='object'||
   !ID.test(current.tripId??'')||current.tripId!==expectedTripId||
   !STATES.has(current.status)||!Number.isSafeInteger(current.revision)||
   current.revision<minimumRevision)
  return Object.freeze({ok:false,reason:'UNVERIFIED_ASSIGNMENT'});
 return Object.freeze({ok:true,tripId:current.tripId});
}
export async function verifyAcceptedDriverAutoResume({
 decision,recoverCurrent
}={}){
 if(!decision||typeof decision!=='object'||Array.isArray(decision)||
   !ID.test(decision.offerId??'')||!ID.test(decision.serviceId??'')||
   decision.kind!=='AUTO_RIDE'||decision.action!=='accept'||
   decision.phase!=='confirmed'||typeof recoverCurrent!=='function')
  return Object.freeze({ok:false,reason:'NOT_CONFIRMED'});
 return verifyResumableDriverAutoTrip({
  expectedTripId:decision.serviceId,recoverCurrent
 });
}
