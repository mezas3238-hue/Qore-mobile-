/**
 * Expo Push offer transport — server-side proof of interface, NOT DEPLOYED.
 * Only uses driver device tokens retrieved from server-verified registration.
 * A push ticket means accepted for processing, NOT delivery or ride acceptance.
 * Passenger identity, addresses, plate, GPS and route remain out of payload.
 */
const ENDPOINT='https://exp.host/--/api/v2/push/send';
const TOKEN=/^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]{16,128}\]$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createExpoPrivateOfferSender({request=fetch,now=Date.now}={}){
 if(typeof request!=='function'||typeof now!=='function')
  throw new Error('Push transport adapter unavailable');
 return async function sendVerifiedOffer({token,verifiedDriverId,offer}){
  if(typeof token!=='string'||!TOKEN.test(token)||
    !UUID.test(verifiedDriverId??'')||offer?.ok!==true||
    offer.recipientDriverId!==verifiedDriverId||
    offer?.message?.data?.kind!=='QORE_STAGING_OFFER'||
    !UUID.test(offer.message.data.offerId??'')||
    !UUID.test(offer.message.data.rideId??''))
   throw new Error('Unverified private driver offer');
  const at=now(),expiration=offer.expiresAtMs;
  if(!Number.isSafeInteger(at)||!Number.isSafeInteger(expiration)||
     expiration<=at||expiration-at>30_000)
   throw new Error('Expired or unsafe staging driver offer');
  // Keep a small, explicitly whitelisted notification; recipient must open
  // the app and fetch authorized offer details before tapping Accept.
  const payload={
   to:token,title:'QORE · Nueva propuesta',
   body:'Abrí QORE para revisar una solicitud y decidir.',
   data:{
    kind:'QORE_STAGING_OFFER',
    offerId:offer.message.data.offerId,
    rideId:offer.message.data.rideId
   },
   ttl:Math.max(1,Math.floor((expiration-at)/1000)),
   priority:'high'
  };
  const response=await request(ENDPOINT,{
   method:'POST',
   redirect:'error',
   headers:{'content-type':'application/json','accept':'application/json'},
   body:JSON.stringify(payload),
   signal:AbortSignal.timeout(8000)
  });
  if(!response?.ok)throw new Error('Expo push service unavailable');
  const data=await response.json();
  const ticket=data?.data;
  if(!ticket||ticket.status!=='ok'||typeof ticket.id!=='string'||ticket.id.length<8)
   throw new Error('Expo did not accept push for processing');
  // No logging of tokens or third party errors. Ticket is only pending delivery.
  return {acceptedForProcessing:true,delivered:false,rideAccepted:false,
   offerId:payload.data.offerId,providerTicketId:ticket.id,
   commercialRidesEnabled:false};
 };
}
