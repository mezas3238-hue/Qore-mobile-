/**
 * G269 trusted road-evidence bridge, STAGING ONLY.
 * This module does NOT look for drivers or infer road meters from straight-line GPS.
 * An independently configured backend road router must attest an exact scoped
 * pickup, never the Passenger/Driver app or an unverified map provider fallback.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const KEYS=['passengerId','bookingKey','tripId','driverId','vehicleId','proofKey'];
const validId=x=>typeof x==='string'&&UUID.test(x);
export function createG269VerifiedPickupProofRepository({
 db,resolveVerifiedRoadPickup,now=Date.now,qaOnly=true,liveEnabled=false
}={}){
 if(qaOnly!==true||liveEnabled!==false||typeof db?.rpc!=='function'||
  typeof resolveVerifiedRoadPickup!=='function'||typeof now!=='function')
  throw Error('G269 requires verified server-only STAGING road router');
 return Object.freeze({
  async registerCandidate(scope){
   if(!scope||typeof scope!=='object'||Array.isArray(scope)||
    Object.keys(scope).length!==KEYS.length||
    !KEYS.every(k=>validId(scope[k]))||
    scope.passengerId===scope.driverId)
    throw Error('G269 invalid original booking and Driver proof scope');
   // Bind one independent road result to this exact booking, attempt and Driver.
   const evidence=await resolveVerifiedRoadPickup(Object.freeze({...scope}));
   const at=now();
   if(!evidence||typeof evidence!=='object'||Array.isArray(evidence)||
    evidence.routingVerified!==true||evidence.coverageVerified!==true||
    evidence.fallbackUsed!==false||evidence.trafficAware!==true||
    !['GEOAPIFY','GOOGLE_MAPS'].includes(evidence.provider)||
    evidence.passengerId!==scope.passengerId||
    evidence.bookingKey!==scope.bookingKey||
    evidence.proofKey!==scope.proofKey||
    evidence.tripId!==scope.tripId||
    evidence.driverId!==scope.driverId||
    evidence.vehicleId!==scope.vehicleId||
    !Number.isSafeInteger(evidence.pickupRoadMeters)||
    evidence.pickupRoadMeters<1||evidence.pickupRoadMeters>50000||
    !Number.isSafeInteger(evidence.verifiedAtMs)||
    !Number.isSafeInteger(at)||evidence.verifiedAtMs>at+2000||
    evidence.verifiedAtMs<at-30000)
    throw Error('G269 road provider result not independently verified');
   const {data,error}=await db.rpc(
    'mobility_stage_g269_register_pickup_road_proof',{
     _passenger_id:scope.passengerId,_booking_key:scope.bookingKey,
     _trip_id:scope.tripId,_driver_id:scope.driverId,
     _vehicle_id:scope.vehicleId,_proof_key:scope.proofKey,
     _provider:evidence.provider,_pickup_road_meters:evidence.pickupRoadMeters,
     _verified_at:new Date(evidence.verifiedAtMs).toISOString()
    });
   if(error||!validId(data))throw Error('G269 private SQL road proof not persisted');
   return Object.freeze({id:data,mode:'STAGING_DEMO_ONLY',
    qaOnly:true,commercialEnabled:false});
  }
 });
}
