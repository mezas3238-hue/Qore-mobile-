/** Server-only G9 merchant onboarding/catalog persistence adapter. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS=new Set(['SUPERMARKET','PHARMACY','RESTAURANT','RETAIL','OTHER']);
const REVIEWS=new Set(['approve','suspend']);
const CLASSES=new Set(['GENERAL','PHARMACY_OTC']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const id=value=>typeof value==='string'&&UUID.test(value);
const tag=(value,min,max)=>typeof value==='string'&&
 new RegExp('^[A-Z_]{'+min+','+max+'}$').test(value);
const sku=value=>typeof value==='string'&&/^[A-Z0-9_-]{2,40}$/.test(value);
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const ok=extra=>Object.freeze({ok:true,liveEnabled:false,...extra});
function base(params){
 if(!plain(params)||params.mode!=='SYNTHETIC_STAGING'||params.liveEnabled!==false||
   !id(params.actorId))throw Error('Invalid staging merchant management input');
}
function clientOnly(client){
 if(!client||typeof client.rpc!=='function')
  throw Error('Server-only merchant management client required');
}
async function rpc(client,name,params){
 const {data,error}=await client.rpc(name,params);
 if(error||!id(data))throw Error('Merchant management RPC rejected');
 return data;
}
export const SUPABASE_MERCHANT_MANAGEMENT_LIVE_ENABLED=false;
export function createSupabaseStagingMerchantManagementRepository(client){
 clientOnly(client);
 return Object.freeze({
  async onboarding(params){
   base(params);
   if(!id(params.requestKey)||!KINDS.has(params.kind)||!tag(params.displayTag,3,40))
    throw Error('Invalid merchant onboarding');
   return ok({merchantId:await rpc(client,'mobility_stage_merchant_onboarding_request',{
    _owner_id:params.actorId,_request_key:params.requestKey,_kind:params.kind,
    _display_tag:params.displayTag,
   })});
  },
  async review(params){
   base(params);
   if(!id(params.merchantId)||!REVIEWS.has(params.event)||!id(params.requestKey))
    throw Error('Invalid merchant review');
   return ok({eventId:await rpc(client,'mobility_stage_merchant_review',{
    _merchant_id:params.merchantId,_admin_id:params.actorId,
    _action:params.event,_request_key:params.requestKey,
   })});
  },
  async upsertBranch(params){
   base(params);
   if(!id(params.merchantId)||!id(params.requestKey)||!tag(params.branchTag,3,40)||
     !tag(params.pickupTag,3,40)||!integer(params.preparationMinutes,1,180)||
     typeof params.active!=='boolean'||typeof params.acceptingOrders!=='boolean')
    throw Error('Invalid merchant branch');
   return ok({branchId:await rpc(client,'mobility_stage_merchant_branch_upsert',{
    _merchant_id:params.merchantId,_actor_id:params.actorId,
    _request_key:params.requestKey,_branch_tag:params.branchTag,
    _pickup_tag:params.pickupTag,_preparation_minutes:params.preparationMinutes,
    _active:params.active,_accepting_orders:params.acceptingOrders,
   })});
  },
  async upsertItem(params){
   base(params);
   if(!id(params.branchId)||!id(params.requestKey)||!sku(params.sku)||
     typeof params.itemTag!=='string'||!/^[A-Z0-9_]{2,50}$/.test(params.itemTag)||
     !CLASSES.has(params.itemClass)||!integer(params.unitPricePyg,100,10000000)||
     !integer(params.unitGrams,1,50000)||!integer(params.stockUnits,0,1000000)||
     typeof params.active!=='boolean')throw Error('Invalid catalog item');
   return ok({itemId:await rpc(client,'mobility_stage_catalog_item_upsert',{
    _branch_id:params.branchId,_actor_id:params.actorId,_request_key:params.requestKey,
    _sku:params.sku,_item_tag:params.itemTag,_item_class:params.itemClass,
    _unit_price_pyg:params.unitPricePyg,_unit_grams:params.unitGrams,
    _stock_units:params.stockUnits,_active:params.active,
   })});
  },
 });
}
