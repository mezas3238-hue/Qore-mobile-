/** G81 server-only, non-commercial dispatch handoff.
 * A trusted dispatcher selects a Driver candidate; the DB resolves tripId
 * exclusively from the persisted G73 booking key and locks it atomically.
 * No public route, no push-delivery claim, no direct client actor authority.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId=x=>typeof x==='string'&&UUID.test(x);
export function createG81BookedAutoOfferRepository(client){
 if(!client||typeof client.rpc!=='function')
  throw Error('G81 requires server-only privileged SQL client');
 return Object.freeze({
  async offerBookedAuto({passengerId,bookingKey,driverId,vehicleId,offerKey,ttlSeconds}={}){
   if(![passengerId,bookingKey,driverId,vehicleId,offerKey].every(isId)||
     passengerId===driverId||!Number.isSafeInteger(ttlSeconds)||
     ttlSeconds<5||ttlSeconds>30)
    throw Error('G81 invalid server-side dispatch request');
   const {data,error}=await client.rpc('mobility_stage_g81_offer_booked_auto',{
    _passenger_id:passengerId,_booking_key:bookingKey,
    _driver_id:driverId,_vehicle_id:vehicleId,
    _offer_key:offerKey,_ttl_seconds:ttlSeconds
   });
   if(error||!isId(data))throw Error('G81 private SQL offer denied');
   return Object.freeze({offerId:data,pushDelivered:false,commercialRidesEnabled:false});
  }
 });
}
