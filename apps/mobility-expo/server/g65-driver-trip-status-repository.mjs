/**
 * G65 server-only Supabase adapter. Caller owns credential lifecycle and
 * server Auth boundary; there is no key, URL, app-side storage or deployment.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const good=x=>typeof x==='string'&&UUID.test(x);
export const G65_TRIP_REPOSITORY_LIVE_ENABLED=false;
export function createG65DriverTripStatusRepository(client){
 if(!client||typeof client.from!=='function'||typeof client.rpc!=='function')
  throw Error('G65 requires independently trusted server DB client');
 return Object.freeze({
  async loadAssignedTrip({actorId,tripId}={}){
   if(!good(actorId)||!good(tripId))throw Error('G65 invalid actor/trip');
   const {data,error}=await client.from('mobility_stage_auto_demo_trips')
    .select('id,driver_id,vehicle_id,passenger_id,status,revision,service')
    .eq('id',tripId).eq('driver_id',actorId).maybeSingle();
   if(error)throw Error('G65 read unavailable');
   if(!data)return null;
   if(data.id!==tripId||data.driver_id!==actorId||
    !good(data.vehicle_id)||!good(data.passenger_id)||
    !['accepted','arriving','in_progress','completed','cancelled'].includes(data.status)||
    !['economico','confort','xl'].includes(data.service)||
    !Number.isSafeInteger(data.revision)||data.revision<2)
    throw Error('G65 malformed assigned trip');
   return Object.freeze({
    tripId:data.id,driverId:data.driver_id,
    vehicleId:data.vehicle_id,passengerId:data.passenger_id,
    status:data.status,revision:data.revision,service:data.service
   });
  }
 });
}
