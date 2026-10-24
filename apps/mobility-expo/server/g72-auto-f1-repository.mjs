/** G72: server-side only. Four disposable SQL RPCs; no client direct write. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=x=>typeof x==='string'&&UUID.test(x);
const integer=(n,lo,hi)=>Number.isSafeInteger(n)&&n>=lo&&n<=hi;
const tag=x=>typeof x==='string'&&/^[A-Z_]{3,40}$/.test(x);
const SERVICES=new Set(['economico','confort','xl']);
async function call(client,name,params){
 const {data,error}=await client.rpc(name,params);
 if(error)throw Error('G72 private SQL unavailable');
 return data;
}
export function createQoreG72AutoRepository(client){
 if(!client||typeof client.rpc!=='function')
  throw Error('G72 requires server-only RPC client');
 return Object.freeze({
  async prequote(p){
   if(!id(p.actorId)||!id(p.requestKey)||!SERVICES.has(p.service)||
    !tag(p.originTag)||!tag(p.destinationTag)||
    p.originTag===p.destinationTag||!tag(p.zoneTag)||
    !integer(p.distanceMeters,0,500000)||!integer(p.durationSeconds,0,86400)||
    !integer(p.tollsPyg,0,1000000))throw Error('G72 unverified pricing inputs');
   const result=await call(client,'mobility_stage_g72_prequote',{
    _passenger_id:p.actorId,_request_key:p.requestKey,_service:p.service,
    _origin_tag:p.originTag,_destination_tag:p.destinationTag,
    _zone_tag:p.zoneTag,_distance_meters:p.distanceMeters,
    _duration_seconds:p.durationSeconds,_tolls_pyg:p.tollsPyg
   });
   if(!id(result))throw Error('G72 quote not persisted');
   return result;
  },
  async quoteReceipt(p){
   if(!id(p.actorId)||!id(p.quoteId))throw Error('G72 quote scope');
   return await call(client,'mobility_stage_g72_prequote_receipt',{
    _passenger_id:p.actorId,_quote_id:p.quoteId
   });
  },
  async book(p){
   if(!id(p.actorId)||!id(p.quoteId)||!id(p.requestKey))
    throw Error('G72 invalid book');
   const trip=await call(client,'mobility_stage_g72_book',{
    _passenger_id:p.actorId,_quote_id:p.quoteId,_request_key:p.requestKey
   });
   if(!id(trip))throw Error('G72 booking absent');
   return trip;
  },
  async bookingReceipt(p){
   if(!id(p.actorId)||!id(p.requestKey))throw Error('G72 receipt scope');
   return await call(client,'mobility_stage_g72_booking_receipt',{
    _passenger_id:p.actorId,_request_key:p.requestKey
   });
  }
 });
}
