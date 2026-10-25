/** G73 server-only private six-RPC adapter, synthetic CI schema only. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=x=>typeof x==='string'&&UUID.test(x);
const num=(n,lo,hi)=>Number.isSafeInteger(n)&&n>=lo&&n<=hi;
const tag=x=>typeof x==='string'&&/^[A-Z_]{3,40}$/.test(x);
const SERVICES=new Set(['economico','confort','xl']);
async function rpc(client,name,p){
 const {data,error}=await client.rpc(name,p);
 if(error)throw Error('G73 private PostgreSQL operation failed');
 return data;
}
export function createQoreG73AutoRepository(client){
 if(!client||typeof client.rpc!=='function')throw Error('Server-only DB client required');
 return Object.freeze({
  async registerRoute(p){
   if(!id(p.actorId)||!id(p.requestKey)||!SERVICES.has(p.service)||
    !tag(p.originTag)||!tag(p.destinationTag)||!tag(p.zoneTag)||
    p.originTag===p.destinationTag||
    !num(p.distanceMeters,0,500000)||!num(p.durationSeconds,0,86400)||
    !num(p.tollsPyg,0,1000000))throw Error('Unverified route fields');
   const routeId=await rpc(client,'mobility_stage_g73_route',{
    _passenger_id:p.actorId,_request_key:p.requestKey,_service:p.service,
    _origin_tag:p.originTag,_destination_tag:p.destinationTag,
    _zone_tag:p.zoneTag,_distance_meters:p.distanceMeters,
    _duration_seconds:p.durationSeconds,_tolls_pyg:p.tollsPyg});
   if(!id(routeId))throw Error('Route not persisted');
   return routeId;
  },
  async routeReceipt(p){
   if(!id(p.actorId)||!id(p.routeId))throw Error('Route scope');
   return rpc(client,'mobility_stage_g73_route_receipt',{
    _passenger_id:p.actorId,_route_id:p.routeId});
  },
  async quote(p){
   if(!id(p.actorId)||!id(p.routeId)||!id(p.requestKey))
    throw Error('Invalid quote scope');
   const quoteId=await rpc(client,'mobility_stage_g73_quote',{
    _passenger_id:p.actorId,_route_id:p.routeId,_quote_request_key:p.requestKey});
   if(!id(quoteId))throw Error('Quote not persisted');
   return quoteId;
  },
  async quoteReceipt(p){
   if(!id(p.actorId)||!id(p.quoteId))throw Error('Quote receipt scope');
   return rpc(client,'mobility_stage_g73_quote_receipt',{
    _passenger_id:p.actorId,_quote_id:p.quoteId});
  },
  async book(p){
   if(!id(p.actorId)||!id(p.quoteId)||!id(p.requestKey))
    throw Error('Invalid booking scope');
   const tripId=await rpc(client,'mobility_stage_g73_book',{
    _passenger_id:p.actorId,_quote_id:p.quoteId,_request_key:p.requestKey});
   if(!id(tripId))throw Error('Booking not persisted');
   return tripId;
  },
  async dispatchStatus(p){
   if(!p||!id(p.actorId)||!id(p.requestKey))throw Error('G90 invalid Passenger SQL scope');
   return rpc(client,'mobility_stage_g90_passenger_dispatch_status_qa',{
    _passenger_id:p.actorId,_booking_key:p.requestKey});
  },
  async previewAutoSubsidy(p){
   if(!p||!id(p.actorId)||!id(p.quoteId))
    throw Error('G93 invalid private quote scope');
   return rpc(client,'mobility_stage_g93_preview_auto_qa',{
    _passenger_id:p.actorId,_quote_id:p.quoteId});
  },
  async autoSubsidySettlement(p){
   if(!p||!id(p.actorId)||!id(p.requestKey))
    throw Error('G93 invalid private booking scope');
   return rpc(client,'mobility_stage_g93_settlement_receipt_qa',{
    _passenger_id:p.actorId,_booking_key:p.requestKey});
  },
  async bookingReceipt(p){
   if(!id(p.actorId)||!id(p.requestKey))throw Error('Booking receipt scope');
   return rpc(client,'mobility_stage_g73_booking_receipt',{
    _passenger_id:p.actorId,_request_key:p.requestKey});
  }
 });
}
