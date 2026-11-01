/**
 * G298: single-tap SOS on Driver map uses the Driver's saved destination.
 * Android permits CALL_PHONE + ACTION_CALL for an ordinary trusted contact.
 * Android forbids ACTION_CALL emergency numbers: use ACTION_DIAL for 911.
 * A native telephone call may bring the system UI over the map. We can
 * preserve trip navigation state but cannot force a silent in-app 911 call.
 */
export const SOS_DESTINATIONS=Object.freeze({
 EMERGENCY_911:'EMERGENCY_911',
 TRUSTED_CONTACT:'TRUSTED_CONTACT'
});
export function normalizeTrustedNumber(value){
 if(typeof value!=='string'||value.length<7||value.length>48)return null;
 if(!/^[+]?[0-9 ().-]+$/.test(value))return null;
 const compact=value.replace(/[ ().-]/g,'');
 if(!/^\+?[0-9]{7,15}$/.test(compact))return null;
 return compact;
}
export function planDriverSosDial(destination,trustedNumber){
 if(destination===SOS_DESTINATIONS.EMERGENCY_911)
  return Object.freeze({
   destination,uri:'tel:911',number:'911',
   intentAction:'android.intent.action.DIAL',
   needsCallPermission:false,requiresSystemConfirmation:true,
   mayOverlayMap:true
  });
 if(destination!==SOS_DESTINATIONS.TRUSTED_CONTACT)return null;
 const number=normalizeTrustedNumber(trustedNumber);
 if(number===null)return null;
 return Object.freeze({
  destination,uri:'tel:'+number,number,
  intentAction:'android.intent.action.CALL',
  needsCallPermission:true,requiresSystemConfirmation:false,
  mayOverlayMap:true
 });
}
