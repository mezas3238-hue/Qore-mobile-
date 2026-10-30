/**
 * G217: terminal attestation from an INDEPENDENT Admin SQL readback of the
 * original service, never from a fixture's requested success or a UI flag.
 * All identifiers and events must match the G202 original source. No LIVE.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const isUuid=v=>typeof v==='string'&&UUID.test(v);
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const reject=reason=>Object.freeze({ok:false,reason});
export function verifyG217TerminalRead({
 source,receipt,linkedDeliveryReceipt=null,now=Date.now()
}={}){
 if(!obj(source)||!obj(receipt)||!Number.isSafeInteger(now))
  return reject('NO_INDEPENDENT_ADMIN_TERMINAL_RECEIPT');
 if(!isUuid(source.originalServiceId)||!isUuid(source.originalRequestKey)||
  source.clientToAdminSameOriginal!==true||source.sourcePersisted!==true)
  return reject('INVALID_ORIGINAL_SOURCE');
 if(receipt.mode!=='STAGING_DEMO_ONLY'||receipt.productionEnabled!==false||
  receipt.serverPersisted!==true||
  receipt.serviceId!==source.originalServiceId||
  receipt.bookingRequestKey!==source.originalRequestKey||
  receipt.serviceKind!==source.serviceKind||
  !isUuid(receipt.viewerId)||!Number.isSafeInteger(receipt.observedAt)||
  !Number.isSafeInteger(receipt.expiresAt)||receipt.observedAt>now||
  now-receipt.observedAt>30000||receipt.expiresAt<=now||
  !obj(receipt.assignment)||receipt.assignment.legalGate!=='EXTERNAL_NOT_CERTIFIED')
  return reject('TERMINAL_PROVENANCE_OR_ADMIN_AUTHORITY_MISMATCH');
 if(source.serviceKind==='COMMERCE'){
  if(receipt.status!=='ready'||receipt.revision!==5||
   receipt.deliveryId!==source.linkedCommerceDeliveryId||
   !isUuid(receipt.deliveryId)||receipt.assignment.state!=='NOT_ASSIGNABLE')
   return reject('COMMERCE_ORDER_ORIGINAL_LINK_NOT_CONFIRMED');
  if(!obj(linkedDeliveryReceipt)||
   linkedDeliveryReceipt.serviceId!==receipt.deliveryId||
   linkedDeliveryReceipt.serviceKind!=='DELIVERY_'+receipt.vehicleKind)
   return reject('MISSING_COMMERCE_COURIER_TERMINAL_READ');
  return verifyG217TerminalRead({
   source:{...source,serviceKind:linkedDeliveryReceipt.serviceKind,
    originalServiceId:receipt.deliveryId,
    originalRequestKey:linkedDeliveryReceipt.bookingRequestKey},
   receipt:linkedDeliveryReceipt,now
  });
 }
 if(!['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO']
 .includes(source.serviceKind))return reject('UNKNOWN_SERVICE_KIND');
 if(!isUuid(receipt.quoteId)||receipt.status!=='completed'&&receipt.status!=='delivered'||
  receipt.revision!==5&&receipt.revision!==4||
  receipt.assignment.state!=='QA_COMPLETED')
  return reject('SERVICE_NOT_COMPLETED_BY_ORIGINAL_DRIVER');
 const expected=source.serviceKind.endsWith('_RIDE')
  ?['searching','assigned','arriving','in_progress','completed']
  :['requested','accepted','picked_up','delivered'];
 if(receipt.status!==expected.at(-1)||receipt.revision!==expected.length||
  !Array.isArray(receipt.events)||receipt.events.length!==expected.length)
  return reject('MISSING_OR_REORDERED_TERMINAL_EVENTS');
 const ids=new Set();let lastAt=0;
 for(let i=0;i<expected.length;i++){
  const e=receipt.events[i];
  if(!obj(e)||!isUuid(e.eventId)||ids.has(e.eventId)||
   e.serviceId!==receipt.serviceId||e.sequence!==i+1||
   e.status!==expected[i]||!Number.isSafeInteger(e.at)||
   e.at<lastAt||e.at>receipt.observedAt)
   return reject('ORIGINAL_EVENT_CHAIN_INCOMPLETE');
  lastAt=e.at;ids.add(e.eventId);
 }
 if(receipt.events[0].eventId!==source.originalServiceId)
  return reject('ORIGINAL_EVENT_ID_MISMATCH');
 if(source.serviceKind.startsWith('DELIVERY_')){
  if(receipt.ledger!==null)return reject('UNVERIFIED_DELIVERY_SETTLEMENT');
 }else{
  if(!obj(receipt.ledger)||receipt.ledger.serviceId!==receipt.serviceId||
   receipt.ledger.currency!=='PYG'||
   receipt.ledger.reconciliationStatus!=='PENDING')
   return reject('UNVERIFIED_RIDE_LEDGER');
 }
 return Object.freeze({ok:true,qaOnly:true,commerciallyCertified:false,
  terminalServiceId:receipt.serviceId,terminalEventCount:expected.length});
}
