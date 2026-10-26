/**
 * Server-only G5 persistence adapter for delivery custody in isolated STAGING.
 * All identities are derived from verified Auth before reaching this module;
 * every mutation delegates to an atomic PostgreSQL RPC.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VEHICLES=new Set(['AUTO','MOTO']);
const CATEGORIES=new Set(['DOCUMENTS','PARCEL','GROCERIES','PHARMACY_OTC','RESTAURANT']);
const STATUSES=new Set(['requested','accepted','picked_up','delivered','disputed','returned','cancelled']);
const EVENTS=new Set(['pickup','deliver','dispute','return','cancel']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const validId=value=>typeof value==='string'&&UUID.test(value);
const validTag=value=>typeof value==='string'&&/^[A-Z_]{3,40}$/.test(value);
const int=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const ok=extra=>Object.freeze({ok:true,liveEnabled:false,...extra});

function assertClient(client){
 if(!client||typeof client.rpc!=='function'||typeof client.from!=='function')
  throw Error('Server-only Supabase delivery client required');
}
function assertBase(params){
 if(!plain(params)||params.mode!=='SYNTHETIC_STAGING'||
   params.liveEnabled!==false||!validId(params.actorId))
  throw Error('Invalid staging delivery input');
}
async function rpc(client,name,params){
 const {data,error}=await client.rpc(name,params);
 if(error||!validId(data))throw Error('Staging delivery RPC rejected');
 return data;
}
function snapshot(row,id,actorId){
 if(!plain(row)||row.id!==id||
   (row.sender_id!==actorId&&row.courier_id!==actorId)||
   !validId(row.sender_id)||!VEHICLES.has(row.requested_vehicle_kind)||
   !CATEGORIES.has(row.category)||!STATUSES.has(row.status)||
   !int(row.grams,1,100000)||!int(row.length_cm,1,200)||
   !int(row.width_cm,1,200)||!int(row.height_cm,1,200)||
   !validTag(row.pickup_tag)||!validTag(row.delivery_tag)||
   row.pickup_tag===row.delivery_tag||row.restricted_item_declared!==false||
   !int(row.revision,1,Number.MAX_SAFE_INTEGER))
  throw Error('Unauthorized or malformed delivery snapshot');
 const hasCourier=validId(row.courier_id),hasVehicle=validId(row.vehicle_id);
 const assigned=hasCourier&&hasVehicle;
 if(hasCourier!==hasVehicle||
   (row.status==='requested'&&assigned)||
   (['accepted','picked_up','delivered','disputed','returned'].includes(row.status)&&!assigned)||
   (row.proof_ref!==null&&!validId(row.proof_ref))||
   (['delivered','disputed','returned'].includes(row.status)&&!validId(row.proof_ref)))
  throw Error('Inconsistent delivery custody');
 return Object.freeze({
  id:row.id,senderId:row.sender_id,courierId:row.courier_id??null,
  vehicleId:row.vehicle_id??null,requestedVehicleKind:row.requested_vehicle_kind,
  category:row.category,grams:row.grams,
  dimensionsCm:Object.freeze({length:row.length_cm,width:row.width_cm,height:row.height_cm}),
  pickupTag:row.pickup_tag,deliveryTag:row.delivery_tag,status:row.status,
  revision:row.revision,proofRef:row.proof_ref??null,
 });
}

export const SUPABASE_DELIVERY_LIVE_ENABLED=false;

export function createSupabaseStagingDeliveryRepository(client){
 assertClient(client);
 return Object.freeze({
  async request(params){
   assertBase(params);
   if(!validId(params.requestKey)||!VEHICLES.has(params.vehicleKind)||
     !CATEGORIES.has(params.category)||!int(params.grams,1,100000)||
     !int(params.lengthCm,1,200)||!int(params.widthCm,1,200)||
     !int(params.heightCm,1,200)||!validTag(params.pickupTag)||
     !validTag(params.deliveryTag)||params.pickupTag===params.deliveryTag||
     params.restrictedItemDeclared!==false)
    throw Error('Invalid delivery request');
   const deliveryId=await rpc(client,'mobility_stage_delivery_request',{
    _sender_id:params.actorId,_request_key:params.requestKey,
    _vehicle_kind:params.vehicleKind,_category:params.category,
    _grams:params.grams,_length_cm:params.lengthCm,_width_cm:params.widthCm,
    _height_cm:params.heightCm,_pickup_tag:params.pickupTag,
    _delivery_tag:params.deliveryTag,_restricted_item_declared:false,
   });
   return ok({deliveryId});
  },

  async reconcile(params){
   assertBase(params);
   if(!validId(params.requestKey))throw Error('Invalid delivery key');
   // BOTH sender_id and request_key are necessary; never unrestricted lookup.
   const {data,error}=await client.from('mobility_stage_deliveries')
    .select('id,request_key,sender_id,requested_vehicle_kind,status,revision')
    .eq('request_key',params.requestKey).eq('sender_id',params.actorId)
    .maybeSingle();
   if(error)throw Error('Delivery recovery database unavailable');
   if(data===null)return null;
   if(!plain(data)||!validId(data.id)||data.request_key!==params.requestKey||
    data.sender_id!==params.actorId||!VEHICLES.has(data.requested_vehicle_kind)||
    !STATUSES.has(data.status)||!int(data.revision,1,Number.MAX_SAFE_INTEGER))
    throw Error('Invalid delivery recovery receipt');
   return ok({deliveryId:data.id,requestKey:data.request_key,
    vehicleKind:data.requested_vehicle_kind,status:data.status,
    revision:data.revision});
  },

  // G122: server-only persisted tariff matching. Never trust a client quote amount.
  async confirmQuote(params){
   assertBase(params);
   if(!validId(params.deliveryId)||!validId(params.quoteId)||
     !validId(params.confirmationKey)||!int(params.acceptedTotalGs,1,100000000)||
     typeof params.acceptedFareVersion!=='string'||
     !/^[a-zA-Z0-9._-]{1,48}$/.test(params.acceptedFareVersion))
    throw Error('Invalid delivery quote confirmation');
   const {data,error}=await client.rpc('mobility_stage_g122_accept_delivery_quote_qa',{
    _sender:params.actorId,_delivery:params.deliveryId,_quote:params.quoteId,
    _confirmation_key:params.confirmationKey,
    _accepted_total_gs:params.acceptedTotalGs,
    _accepted_fare_version:params.acceptedFareVersion
   });
   if(error||!plain(data)||!validId(data.consentId)||
     data.deliveryId!==params.deliveryId||data.quoteId!==params.quoteId||
     data.confirmationKey!==params.confirmationKey||
     !VEHICLES.has(data.vehicleKind)||data.acceptedTotalGs!==params.acceptedTotalGs||
     data.fareVersion!==params.acceptedFareVersion||
     data.status!=='confirmed_qa'||data.liveEnabled!==false||
     data.serverPersisted!==true)throw Error('Delivery quote consent rejected');
   return ok({...data});
  },

  async accept(params){
   assertBase(params);
   if(!validId(params.deliveryId)||!validId(params.vehicleId)||
     !validId(params.requestKey))throw Error('Invalid delivery acceptance');
   const eventId=await rpc(client,'mobility_stage_delivery_accept',{
    _delivery_id:params.deliveryId,_courier_id:params.actorId,
    _vehicle_id:params.vehicleId,_request_key:params.requestKey,
   });
   return ok({eventId});
  },

  async transition(params){
   assertBase(params);
   if(!validId(params.deliveryId)||!validId(params.eventKey)||
     !EVENTS.has(params.event)||
     (params.event==='deliver'?!validId(params.proofRef):params.proofRef!==undefined))
    throw Error('Invalid delivery transition');
   const eventId=await rpc(client,'mobility_stage_delivery_transition',{
    _delivery_id:params.deliveryId,_actor_id:params.actorId,
    _action:params.event,_request_key:params.eventKey,
    _proof_ref:params.event==='deliver'?params.proofRef:null,
   });
   return ok({eventId});
  },

  async snapshot(params){
   assertBase(params);
   if(!validId(params.deliveryId))throw Error('Invalid delivery snapshot');
   const query=client.from('mobility_stage_deliveries')
    .select('id,sender_id,courier_id,vehicle_id,requested_vehicle_kind,category,grams,length_cm,width_cm,height_cm,pickup_tag,delivery_tag,restricted_item_declared,status,revision,proof_ref')
    .eq('id',params.deliveryId)
    .or(`sender_id.eq.${params.actorId},courier_id.eq.${params.actorId}`)
    .maybeSingle();
   const {data,error}=await query;
   if(error||!data)throw Error('Delivery snapshot unavailable');
   return ok({delivery:snapshot(data,params.deliveryId,params.actorId)});
  },
 });
}
