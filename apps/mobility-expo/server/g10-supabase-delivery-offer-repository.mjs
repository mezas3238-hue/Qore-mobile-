/** Server-only G10 persistence adapter for private courier delivery offers. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS=new Set(['AUTO','MOTO']);
const CATEGORIES=new Set(['DOCUMENTS','PARCEL','GROCERIES','PHARMACY_OTC','RESTAURANT']);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const id=value=>typeof value==='string'&&UUID.test(value);
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const tag=value=>typeof value==='string'&&/^[A-Z_]{3,40}$/.test(value);
const receipt=extra=>Object.freeze({ok:true,liveEnabled:false,...extra});
function clientRequired(client){
 if(!client||typeof client.rpc!=='function'||typeof client.from!=='function')
  throw Error('Server-only Supabase delivery-offer client required');
}
function base(params,actor=false){
 if(!object(params)||params.mode!=='SYNTHETIC_STAGING'||params.liveEnabled!==false||
   (actor&&!id(params.actorId)))throw Error('Invalid staging delivery-offer input');
}
async function rpc(client,name,params){
 const {data,error}=await client.rpc(name,params);
 if(error||!id(data))throw Error('Staging delivery-offer RPC rejected');
 return data;
}
export const SUPABASE_DELIVERY_OFFERS_LIVE_ENABLED=false;
export function createSupabaseStagingDeliveryOfferRepository(client){
 clientRequired(client);
 return Object.freeze({
  async create(params){
   base(params);
   if(!id(params.deliveryId)||!id(params.courierId)||!id(params.vehicleId)||
     !id(params.requestKey)||!integer(params.ttlSeconds,5,45))
    throw Error('Invalid private delivery offer');
   const offerId=await rpc(client,'mobility_stage_delivery_offer',{
    _delivery_id:params.deliveryId,_courier_id:params.courierId,
    _vehicle_id:params.vehicleId,_request_key:params.requestKey,
    _ttl_seconds:params.ttlSeconds,
   });
   return receipt({offerId});
  },
  async accept(params){
   base(params,true);
   if(!id(params.offerId)||!id(params.decisionKey))
    throw Error('Invalid delivery offer acceptance');
   const eventId=await rpc(client,'mobility_stage_delivery_accept_offer',{
    _offer_id:params.offerId,_courier_id:params.actorId,
    _decision_key:params.decisionKey,
   });
   return receipt({eventId});
  },
  async decline(params){
   base(params,true);
   if(!id(params.offerId)||!id(params.decisionKey))
    throw Error('Invalid delivery offer refusal');
   const offerId=await rpc(client,'mobility_stage_delivery_decline_offer',{
    _offer_id:params.offerId,_courier_id:params.actorId,
    _decision_key:params.decisionKey,
   });
   return receipt({offerId});
  },
  async snapshot(params){
   base(params,true);
   if(!id(params.offerId))throw Error('Invalid delivery offer snapshot');
   const {data:offer,error}=await client.from('mobility_stage_delivery_offers')
    .select('id,delivery_id,courier_id,vehicle_id,status,expires_at')
    .eq('id',params.offerId).eq('courier_id',params.actorId).maybeSingle();
   if(error||!offer||offer.id!==params.offerId||offer.courier_id!==params.actorId||
     offer.status!=='offered'||!id(offer.delivery_id)||!id(offer.vehicle_id)||
     typeof offer.expires_at!=='string')throw Error('Delivery offer unavailable');
   const {data:delivery,error:deliveryError}=await client.from('mobility_stage_deliveries')
    .select('id,requested_vehicle_kind,category,grams,length_cm,width_cm,height_cm,pickup_tag,delivery_tag,status')
    .eq('id',offer.delivery_id).eq('status','requested').maybeSingle();
   if(deliveryError||!object(delivery)||delivery.id!==offer.delivery_id||
     !KINDS.has(delivery.requested_vehicle_kind)||!CATEGORIES.has(delivery.category)||
     !integer(delivery.grams,1,100000)||!integer(delivery.length_cm,1,200)||
     !integer(delivery.width_cm,1,200)||!integer(delivery.height_cm,1,200)||
     !tag(delivery.pickup_tag)||!tag(delivery.delivery_tag)||
     delivery.pickup_tag===delivery.delivery_tag)
    throw Error('Delivery offer unavailable');
   return receipt({offer:Object.freeze({offerId:offer.id,deliveryId:offer.delivery_id,
    courierId:offer.courier_id,vehicleId:offer.vehicle_id,status:offer.status,
    expiresAt:offer.expires_at,vehicleKind:delivery.requested_vehicle_kind,
    category:delivery.category,grams:delivery.grams,lengthCm:delivery.length_cm,
    widthCm:delivery.width_cm,heightCm:delivery.height_cm,
    pickupTag:delivery.pickup_tag,deliveryTag:delivery.delivery_tag})});
  },
 });
}
