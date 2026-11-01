/**
 * G298 — Direct Driver-initiated telephone handoff.
 * Emergency numbers MUST be dialed through the system phone app.
 * This function does not initiate/confirm a call or claim that help responded.
 */
export const SOS_DESTINATIONS=Object.freeze({
 EMERGENCY_911:'EMERGENCY_911',
 TRUSTED_CONTACT:'TRUSTED_CONTACT'
});
export function normalizeTrustedNumber(value){
 if(typeof value!=='string'||value.length<7||value.length>48)return null;
 // Only digits, optional leading +, and human-readable phone separators.
 if(!/^[+]?[0-9 ().-]+$/.test(value))return null;
 const compact=value.replace(/[ ().-]/g,'');
 if(!/^\+?[0-9]{7,15}$/.test(compact))return null;
 if(compact.replace(/^\+/,'')==='911')return null;
 return compact;
}
export function planDriverSosDial(destination,trustedNumber=null){
 if(destination===SOS_DESTINATIONS.EMERGENCY_911)
  return Object.freeze({destination,uri:'tel:911',number:'911',
   requiresSystemConfirmation:true});
 if(destination!==SOS_DESTINATIONS.TRUSTED_CONTACT)return null;
 const number=normalizeTrustedNumber(trustedNumber);
 if(number===null)return null;
 return Object.freeze({destination,uri:'tel:'+number,number,
  requiresSystemConfirmation:true});
}
