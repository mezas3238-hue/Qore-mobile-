import {verifyAcceptedDriverAutoResume} from './driver-accepted-ride-resume.mjs';

/**
 * C17: a single explicit Driver tap POSTs a private AUTO offer once.
 * A second, independent owner-scoped SQL GET must match that receipt's
 * serviceId before navigation. Unknown COMMIT never causes an automatic retry.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function acceptAndRecoverDriverAuto({
 offerId,decide,recoverCurrent
}={}){
 if(typeof offerId!=='string'||!UUID.test(offerId)||
   typeof decide!=='function'||typeof recoverCurrent!=='function')
  return Object.freeze({ok:false,reason:'INVALID_REQUEST'});
 let decision;
 try{decision=await decide(offerId,'accept');}
 catch{return Object.freeze({ok:false,reason:'NOT_CONFIRMED'});}
 if(!decision||decision.offerId!==offerId)
  return Object.freeze({ok:false,reason:'NOT_CONFIRMED'});
 return verifyAcceptedDriverAutoResume({decision,recoverCurrent});
}
