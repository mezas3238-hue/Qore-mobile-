/** Server-only persistence adapter for isolated G6 merchant orders. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VEHICLES=new Set(['AUTO','MOTO']);
const EVENTS=new Set(['confirm','start_preparing','ready','cancel','hand_to_courier','complete']);
const STATUSES=new Set(['requested','confirmed','preparing','ready','handed_to_courier','delivered','cancelled']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const validId=value=>typeof value==='string'&&UUID.test(value);
const int=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const ok=extra=>Object.freeze({ok:true,liveEnabled:false,...extra});
function assertClient(client){
 if(!client||typeof client.rpc!=='function'||typeof client.from!=='function')
  throw Error('Server-only merchant persistence client required');
}
function assertBase(params){
 if(!plain(params)||params.mode!=='SYNTHETIC_STAGING'||params.liveEnabled!==false||
   !validId(params.actorId))throw Error('Invalid staging merchant input');
}
function validItems(items){
 if(!Array.isArray(items)||items.length<1||items.length>50)return false;
 const ids=new Set();
 for(const item of items){
  if(!plain(item)||Object.keys(item).length!==2||!validId(item.itemId)||
    !int(item.quantity,1,999)||ids.has(item.itemId))return false;
  ids.add(item.itemId);
 }
 return true;
}
async function rpc(client,name,params){
 const {data,error}=await client.rpc(name,params);
 if(error||!validId(data))throw Error('Staging merchant RPC rejected');
 return data;
}
function safeOrder(row,lines,id,actorId,merchantActor){
 if(!plain(row)||row.id!==id||(!merchantActor&&row.buyer_id!==actorId)||
   !validId(row.buyer_id)||!validId(row.merchant_id)||!validId(row.branch_id)||
   !VEHICLES.has(row.requested_vehicle_kind)||!STATUSES.has(row.status)||
   !int(row.subtotal_pyg,100,50000000)||!int(row.revision,1,Number.MAX_SAFE_INTEGER)||
   (row.delivery_id!==null&&!validId(row.delivery_id))||!Array.isArray(lines)||
   lines.length<1||lines.length>50)throw Error('Malformed merchant order snapshot');
 let total=0;
 const items=lines.map(line=>{
  if(!plain(line)||line.order_id!==id||!validId(line.item_id)||
    !int(line.quantity,1,999)||!int(line.unit_price_pyg,100,10000000)||
    !int(line.line_total_pyg,100,50000000)||
    line.line_total_pyg!==line.quantity*line.unit_price_pyg)
   throw Error('Malformed merchant order lines');
  total+=line.line_total_pyg;
  return Object.freeze({itemId:line.item_id,quantity:line.quantity,
   unitPricePyg:line.unit_price_pyg,lineTotalPyg:line.line_total_pyg});
 });
 if(total!==row.subtotal_pyg)throw Error('Merchant subtotal mismatch');
 return Object.freeze({id:row.id,buyerId:row.buyer_id,merchantId:row.merchant_id,
  branchId:row.branch_id,requestedVehicleKind:row.requested_vehicle_kind,
  subtotalPyg:row.subtotal_pyg,status:row.status,deliveryId:row.delivery_id??null,
  revision:row.revision,items:Object.freeze(items)});
}
async function merchantParticipant(client,params){
 const {data:order,error}=await client.from('mobility_stage_merchant_orders')
  .select('merchant_id').eq('id',params.orderId).maybeSingle();
 if(error||!validId(order?.merchant_id))return false;
 const {data:staff,error:staffError}=await client.from('mobility_stage_merchant_staff')
  .select('merchant_id,user_id,active').eq('merchant_id',order.merchant_id)
  .eq('user_id',params.actorId).eq('active',true).maybeSingle();
 return !staffError&&staff?.merchant_id===order.merchant_id&&
  staff.user_id===params.actorId&&staff.active===true;
}

export const SUPABASE_MERCHANT_LIVE_ENABLED=false;

export function createSupabaseStagingMerchantRepository(client){
 assertClient(client);
 return Object.freeze({
  async request(params){
   assertBase(params);
   if(!validId(params.requestKey)||!validId(params.branchId)||
     !VEHICLES.has(params.vehicleKind)||!validItems(params.items))
    throw Error('Invalid merchant order request');
   const orderId=await rpc(client,'mobility_stage_merchant_order_request',{
    _buyer_id:params.actorId,_request_key:params.requestKey,
    _branch_id:params.branchId,_vehicle_kind:params.vehicleKind,_items:params.items,
   });
   return ok({orderId});
  },
  async transition(params){
   assertBase(params);
   if(!validId(params.orderId)||!validId(params.eventKey)||!EVENTS.has(params.event))
    throw Error('Invalid merchant order transition');
   const eventId=await rpc(client,'mobility_stage_merchant_order_transition',{
    _order_id:params.orderId,_actor_id:params.actorId,
    _action:params.event,_request_key:params.eventKey,
   });
   return ok({eventId});
  },
  async attachDelivery(params){
   assertBase(params);
   if(!validId(params.orderId)||!validId(params.deliveryId)||!validId(params.requestKey))
    throw Error('Invalid merchant delivery link');
   const eventId=await rpc(client,'mobility_stage_merchant_order_attach_delivery',{
    _order_id:params.orderId,_actor_id:params.actorId,
    _delivery_id:params.deliveryId,_request_key:params.requestKey,
   });
   return ok({eventId});
  },
  async isMerchantParticipant(params){
   assertBase(params);
   if(!validId(params.orderId))return false;
   return merchantParticipant(client,params);
  },
  async snapshot(params){
   assertBase(params);
   if(!validId(params.orderId))throw Error('Invalid merchant order snapshot');
   const {data:row,error}=await client.from('mobility_stage_merchant_orders')
    .select('id,buyer_id,merchant_id,branch_id,requested_vehicle_kind,subtotal_pyg,status,delivery_id,revision')
    .eq('id',params.orderId).maybeSingle();
   if(error||!row)throw Error('Merchant order unavailable');
   let merchantActor=false;
   if(row.buyer_id!==params.actorId){
    merchantActor=await merchantParticipant(client,params);
    if(!merchantActor)throw Error('Merchant order unavailable');
   }
   const {data:lines,error:lineError}=await client.from('mobility_stage_merchant_order_lines')
    .select('order_id,item_id,quantity,unit_price_pyg,line_total_pyg')
    .eq('order_id',params.orderId);
   if(lineError)throw Error('Merchant order unavailable');
   return ok({order:safeOrder(row,lines,params.orderId,params.actorId,merchantActor)});
  },
 });
}
