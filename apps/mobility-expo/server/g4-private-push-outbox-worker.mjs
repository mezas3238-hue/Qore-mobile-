/**
 * G4 private Expo notification outbox processor, SERVER-ONLY / CI CONTRACT.
 *
 * claim() is the atomic, at-most-once SQL G4 function using SKIP LOCKED.
 * This intentionally NEVER retries a claimed offer: a worker crash or push
 * timeout can mean zero notifications. A future durable, leased, retry-safe
 * design must be independently reviewed; the driver's authenticated app
 * can poll its own active offers as an alternative.
 * No worker is launched, scheduled or connected to real devices here.
 */
import {makePrivateDriverPush} from './g4-qore-radar-core.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TICKET=/^[A-Za-z0-9_-]{8,120}$/;
const okInt=x=>Number.isSafeInteger(x)&&x>=0;
const record=(status)=>({status,commercialRidesEnabled:false,delivered:false,rideAccepted:false});
export function createQoreG4PrivatePushWorker({
 workerId,environment,liveTripsEnabled,claim,readCurrentOffer,
 findVerifiedDevice,sendVerifiedOffer,ackTicket,now=Date.now
}){
 if(environment!=='staging'||liveTripsEnabled!==false||!UUID.test(workerId??'')||
    ![claim,readCurrentOffer,findVerifiedDevice,sendVerifiedOffer,ackTicket,now]
      .every(f=>typeof f==='function'))
  throw new Error('Private G4 worker requires staging, no LIVE, worker ID and server-only adapters');
 return async function processOne(){
  let selected;
  try{selected=await claim(workerId);}catch{return record('claim_unavailable');}
  if(selected===null)return record('idle');
  const at=now();
  if(!okInt(at)||!selected||typeof selected!=='object'||
     !UUID.test(selected.offerId??'')||
     !UUID.test(selected.tripId??'')||
     !UUID.test(selected.driverId??'')||
     !okInt(selected.expiresAtMs)||
     selected.expiresAtMs-at<=3_000||
     selected.expiresAtMs-at>30_000)return record('invalid_claim');
  let fresh;
  try{
   fresh=await readCurrentOffer({
    offerId:selected.offerId,driverId:selected.driverId,tripId:selected.tripId
   });
  }catch{return record('offer_recheck_failed');}
  if(!fresh||fresh.offerId!==selected.offerId||
     fresh.driverId!==selected.driverId||fresh.tripId!==selected.tripId||
     fresh.status!=='offered'||fresh.tripStatus!=='searching'||
     fresh.expiresAtMs!==selected.expiresAtMs)
   return record('no_longer_eligible');
  const timestamp=now();
  if(!okInt(timestamp)||timestamp+3_000>=selected.expiresAtMs)
   return record('expired_before_delivery');
  let device;
  try{device=await findVerifiedDevice(selected.driverId);}catch{
   return record('device_unavailable');
  }
  if(!device||device.driverId!==selected.driverId||
     device.pushOptIn!==true||device.active!==true||
     typeof device.token!=='string')return record('no_consenting_device');
  const notification=makePrivateDriverPush({
   rideId:selected.tripId,offerId:selected.offerId,
   driverId:selected.driverId,expiresAtMs:selected.expiresAtMs,
   nowMs:timestamp
  });
  if(notification.ok!==true)return record('invalid_private_payload');
  let sent;
  try{
   sent=await sendVerifiedOffer({
    token:device.token,verifiedDriverId:selected.driverId,offer:notification
   });
  }catch{return record('provider_unavailable_no_retry');}
  if(!sent||sent.acceptedForProcessing!==true||
     sent.delivered!==false||sent.rideAccepted!==false||
     sent.commercialRidesEnabled!==false||
     sent.offerId!==selected.offerId||
     typeof sent.providerTicketId!=='string'||!TICKET.test(sent.providerTicketId))
   return record('provider_receipt_untrusted');
  try{
   const saved=await ackTicket({
    workerId,offerId:selected.offerId,ticketId:sent.providerTicketId
   });
   if(saved!==true)return record('ack_unconfirmed_no_retry');
  }catch{return record('ack_unavailable_no_retry');}
  // Never assert the push arrived; only Expo's processing ticket is stored.
  return record('accepted_for_processing_not_delivered');
 };
}
