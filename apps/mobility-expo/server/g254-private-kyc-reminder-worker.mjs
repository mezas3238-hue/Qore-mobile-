/**
 * G254 Driver KYC reminder push coordinator (NO LIVE, not wired to deployment).
 * The SQL owner backend must claim a private outbox row atomically, and
 * independently recheck that SAME attested evidence is current before push.
 * A ticket is provider accepted-for-processing, NEVER handset delivery.
 *
 * No Admin dispatch, document images, GPS, passenger info, KYC approval,
 * network request, scheduling or secrets created by this module.
 */
export const G254_KYC_REMINDER_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const TOKEN=/^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]{16,128}\]$/;
const KEY=/^G25[14]:[0-9a-f-]{36}:[0-9]+:[0-9]+:(?:D30|D15|D07|D01|EXPIRED)$/i;
const TICKET=/^[A-Za-z0-9_-]{8,120}$/;
const KINDS=new Set(['licencia','identidad_frente','identidad_dorso',
 'cedula_verde','habilitacion','seguro','inspeccion','rostro_selfie']);
const BANDS=new Set(['D30','D15','D07','D01','EXPIRED']);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const exact=(x,keys)=>x!==null&&typeof x==='object'
 &&!Array.isArray(x)&&Object.keys(x).length===keys.length
 &&keys.every(k=>Object.hasOwn(x,k));
const result=status=>Object.freeze({status,qaOnly:true,productionEnabled:false,
 providerAcceptedForProcessing:false,handsetDelivered:false,
 driverApproved:false,commercialDispatchAuthorized:false});
const ALERT_FIELDS=['alertId','eventKey','driverId','kind','band',
 'documentRevision','validUntilMs'];
const DEVICE_FIELDS=['driverId','token','active','notificationsConsent',
 'registeredByVerifiedSession'];
const RECEIPT_FIELDS=['acceptedForProcessing','handsetDelivered',
 'driverApproved','productionEnabled','providerTicketId'];
export function createG254PrivateDocumentReminderWorker({
 environment,qaOnly,liveEnabled,
 claimNextAlert,verifyCurrentAttestation,findVerifiedDevice,
 sendGenericReminder,ackProcessingTicket,now=Date.now
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
 [claimNextAlert,verifyCurrentAttestation,findVerifiedDevice,
  sendGenericReminder,ackProcessingTicket,now].some(x=>typeof x!=='function'))
  throw Error('G254_PRIVATE_STAGING_OUTBOX_REQUIRED');
 let busy=false;
 return async function processOne(){
  if(busy)return result('IN_FLIGHT');
  busy=true;
  try{
   let alert;
   try{alert=await claimNextAlert();}
   catch{return result('CLAIM_UNAVAILABLE');}
   if(alert===null)return result('IDLE');
   if(!exact(alert,ALERT_FIELDS)||!integer(alert.alertId)||alert.alertId===0||
    !KEY.test(alert.eventKey)||!UUID.test(alert.driverId??'')||
    !KINDS.has(alert.kind)||!BANDS.has(alert.band)||
    !integer(alert.documentRevision)||alert.documentRevision<1||
    !integer(alert.validUntilMs)||alert.validUntilMs<1||
    !alert.eventKey.endsWith(':'+alert.band))
    return result('INVALID_PRIVATE_CLAIM');
   const scope={alertId:alert.alertId,eventKey:alert.eventKey,
    driverId:alert.driverId,kind:alert.kind,band:alert.band,
    documentRevision:alert.documentRevision,validUntilMs:alert.validUntilMs};
   // This must independently query the latest provider-verified document,
   // not trust a SQL boolean cached when a job was claimed.
   try{if(await verifyCurrentAttestation(scope)!==true)
    return result('STALE_OR_REVOKED');}
   catch{return result('ATTESTOR_UNAVAILABLE');}
   let device;
   try{device=await findVerifiedDevice({driverId:alert.driverId});}
   catch{return result('DEVICE_UNAVAILABLE');}
   if(!exact(device,DEVICE_FIELDS)||device.driverId!==alert.driverId||
    device.active!==true||device.notificationsConsent!==true||
    device.registeredByVerifiedSession!==true||!TOKEN.test(device.token))
    return result('NO_CONSENTING_VERIFIED_DEVICE');
   // Double check after the external device-lookup await. A Driver might
   // renew the license while the device is being looked up.
   try{if(await verifyCurrentAttestation(scope)!==true)
    return result('RENEWED_BEFORE_SEND');}
   catch{return result('FINAL_ATTESTOR_UNAVAILABLE');}
   const at=now();
   if(!integer(at)||at<1)return result('CLOCK_UNAVAILABLE');
   // Validate interval category at the last possible synchronous step.
   const days=alert.validUntilMs-at;
   const current=days<=0?'EXPIRED':days<=86400000?'D01':
    days<=7*86400000?'D07':days<=15*86400000?'D15':
    days<=30*86400000?'D30':null;
   if(current!==alert.band)return result('ALERT_WINDOW_CHANGED');
   // The outgoing payload has NO document identifier, Driver identifier,
   // expiry date, evidence, financial detail or passenger information.
   const message=Object.freeze({
    title:'QORE · Documentación',
    body:'Revisá tus documentos en la aplicación QORE Driver.',
    data:Object.freeze({kind:'QORE_STAGING_KYC_REMINDER'})
   });
   let receipt;
   try{receipt=await sendGenericReminder({
    token:device.token,recipientDriverId:alert.driverId,message
   });}
   catch{return result('PROVIDER_OUTCOME_UNKNOWN_NO_RETRY');}
   if(!exact(receipt,RECEIPT_FIELDS)||
    receipt.acceptedForProcessing!==true||
    receipt.handsetDelivered!==false||receipt.driverApproved!==false||
    receipt.productionEnabled!==false||
    !TICKET.test(receipt.providerTicketId))
    return result('UNTRUSTED_PROVIDER_RECEIPT');
   try{if(await ackProcessingTicket({
    alertId:alert.alertId,eventKey:alert.eventKey,
    providerTicketId:receipt.providerTicketId
   })!==true)return result('ACK_UNCONFIRMED_NO_RETRY');}
   catch{return result('ACK_UNAVAILABLE_NO_RETRY');}
   return Object.freeze({...result('ACCEPTED_FOR_PROCESSING_NOT_DELIVERED'),
    providerAcceptedForProcessing:true});
  }finally{busy=false;}
 };
}
