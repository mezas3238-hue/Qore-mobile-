/**
 * Driver G107: a G4 acceptance receipt is not assignment authority.
 * Only the separately authenticated, owner-scoped G106 current-trip GET
 * may authorize navigation to G65 trip controls. No navigation after
 * rejection, uncertain ACK, mismatched trip, logout or missing backend.
 */
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES=new Set(['accepted','arriving','in_progress']);
export const DRIVER_ACCEPTED_RIDE_RESUME_LIVE_ENABLED=false;
export async function verifyAcceptedDriverAutoResume({
 decision,recoverCurrent
}={}){
 if(!decision||typeof decision!=='object'||Array.isArray(decision)||
   !ID.test(decision.offerId??'')||!ID.test(decision.serviceId??'')||
   decision.kind!=='AUTO_RIDE'||decision.action!=='accept'||
   decision.phase!=='confirmed'||typeof recoverCurrent!=='function')
  return Object.freeze({ok:false,reason:'NOT_CONFIRMED'});
 let current;
 try{current=await recoverCurrent();}
 catch{return Object.freeze({ok:false,reason:'UNVERIFIED_ASSIGNMENT'});}
 if(!current||typeof current!=='object'||
   !ID.test(current.tripId??'')||current.tripId!==decision.serviceId||
   !STATES.has(current.status)||!Number.isSafeInteger(current.revision)||
   current.revision<2)
  return Object.freeze({ok:false,reason:'UNVERIFIED_ASSIGNMENT'});
 return Object.freeze({ok:true,tripId:current.tripId});
}
