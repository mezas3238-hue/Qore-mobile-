/**
 * Concrete G4 persistence adapter for the isolated Supabase STAGING schema.
 *
 * The caller must provide a server-only Supabase client. This module never
 * creates a client, reads secrets, opens a listener, migrates a database, or
 * enables commercial trips. Every mutation is delegated to the versioned SQL
 * RPCs, which execute atomically inside PostgreSQL.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SERVICES=new Set(['economico','confort','xl']);
const TRANSITIONS=Object.freeze({
 arrive:'arriving',
 pickup:'in_progress',
 complete:'completed',
 cancel:'cancelled',
});
const STATUS=new Set(['searching','accepted','arriving','in_progress','completed','cancelled']);
const ok=extra=>Object.freeze({ok:true,liveEnabled:false,...extra});
const validId=value=>typeof value==='string'&&UUID.test(value);
const validTag=value=>typeof value==='string'&&/^[A-Z_]{3,40}$/.test(value);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

function requireClient(client){
 if(!client||typeof client.rpc!=='function'||typeof client.from!=='function')
  throw Error('Server-only Supabase persistence client required');
}
async function rpc(client,name,params){
 const {data,error}=await client.rpc(name,params);
 if(error||!validId(data))throw Error('Staging persistence RPC rejected');
 return data;
}
function assertBase(params){
 if(!plain(params)||params.mode!=='SYNTHETIC_STAGING'||
   params.liveEnabled!==false||!validId(params.actorId))
  throw Error('Invalid staging persistence input');
}
function safeSnapshot(row,tripId,actorId){
 if(!plain(row)||row.id!==tripId||
   (row.passenger_id!==actorId&&row.driver_id!==actorId)||
   !validId(row.passenger_id)||!STATUS.has(row.status)||
   !SERVICES.has(row.service)||!validTag(row.origin_tag)||
   !validTag(row.destination_tag)||row.origin_tag===row.destination_tag||
   !Number.isSafeInteger(row.revision)||row.revision<1)
  throw Error('Unauthorized or malformed trip snapshot');
 const hasDriver=validId(row.driver_id),hasVehicle=validId(row.vehicle_id);
 const assigned=hasDriver&&hasVehicle;
 if(hasDriver!==hasVehicle||
   (row.status==='searching'&&assigned)||
   (['accepted','arriving','in_progress','completed'].includes(row.status)&&!assigned))
  throw Error('Inconsistent trip assignment');
 return Object.freeze({
  id:row.id,
  passengerId:row.passenger_id,
  driverId:row.driver_id??null,
  vehicleId:row.vehicle_id??null,
  service:row.service,
  originTag:row.origin_tag,
  destinationTag:row.destination_tag,
  status:row.status,
  revision:row.revision,
 });
}

export const SUPABASE_DISPATCH_LIVE_ENABLED=false;

/**
 * Implements request/offer/accept/transition/snapshot against G3/G4 SQL.
 * Authorization is based only on params.actorId, which the authenticated
 * boundary resolves from Supabase Auth on the server.
 */
export function createSupabaseStagingDispatchRepository(client){
 requireClient(client);
 return Object.freeze({
  async request(params){
   assertBase(params);
   if(!validId(params.requestKey)||!SERVICES.has(params.service)||
     !validTag(params.originTag)||!validTag(params.destinationTag)||
     params.originTag===params.destinationTag)
    throw Error('Invalid staging trip request');
   const tripId=await rpc(client,'mobility_stage_auto_demo_request',{
    _passenger_id:params.actorId,
    _request_key:params.requestKey,
    _origin_tag:params.originTag,
    _destination_tag:params.destinationTag,
    _service:params.service,
   });
   return ok({tripId});
  },

  async offer(params){
   assertBase(params);
   if(!validId(params.tripId)||params.driverId!==params.actorId||
     !validId(params.vehicleId)||!validId(params.requestKey)||
     !Number.isSafeInteger(params.ttlSeconds)||params.ttlSeconds<5||params.ttlSeconds>30)
    throw Error('Invalid staging private offer');
   const offerId=await rpc(client,'mobility_stage_auto_demo_offer',{
    _trip_id:params.tripId,
    _driver_id:params.actorId,
    _vehicle_id:params.vehicleId,
    _request_key:params.requestKey,
    _ttl_seconds:params.ttlSeconds,
   });
   return ok({offerId});
  },

  async accept(params){
   assertBase(params);
   if(!validId(params.offerId)||!validId(params.decisionKey))
    throw Error('Invalid staging acceptance');
   const eventId=await rpc(client,'mobility_stage_auto_demo_accept_offer',{
    _offer_id:params.offerId,
    _driver_id:params.actorId,
    _decision_key:params.decisionKey,
   });
   return ok({eventId});
  },

  async transition(params){
   assertBase(params);
   const next=TRANSITIONS[params.event];
   if(!validId(params.tripId)||!validId(params.eventKey)||!next)
    throw Error('Invalid staging transition');
   const eventId=await rpc(client,'mobility_stage_auto_demo_transition',{
    _trip_id:params.tripId,
    _actor_id:params.actorId,
    _next:next,
    _request_key:params.eventKey,
   });
   return ok({eventId});
  },

  async snapshot(params){
   assertBase(params);
   if(!validId(params.tripId))throw Error('Invalid staging snapshot');
   // The service-role client bypasses RLS, so the participant predicate is
   // mandatory in the SQL query itself. Client-carried passengerId/driverId
   // values are never used to authorize this read.
   const query=client.from('mobility_stage_auto_demo_trips')
    .select('id,passenger_id,driver_id,vehicle_id,service,origin_tag,destination_tag,status,revision')
    .eq('id',params.tripId)
    .or(`passenger_id.eq.${params.actorId},driver_id.eq.${params.actorId}`)
    .maybeSingle();
   const {data,error}=await query;
   if(error||!data)throw Error('Trip snapshot unavailable');
   return ok({trip:safeSnapshot(data,params.tripId,params.actorId)});
  },
 });
}
