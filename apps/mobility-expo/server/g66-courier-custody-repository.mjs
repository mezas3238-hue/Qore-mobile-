/** Server-owned delivery custody read: ID AND courier ID at SQL level. */
export const G66_CUSTODY_REPOSITORY_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const valid=x=>typeof x==='string'&&UUID.test(x);
export function createG66CourierCustodyRepository(client){
 if(!client||typeof client.from!=='function')
  throw Error('G66 requires server-only DB adapter');
 return Object.freeze({
  async loadAssignedDelivery({actorId,deliveryId}={}){
   if(!valid(actorId)||!valid(deliveryId))
    throw Error('G66 invalid assignment lookup');
   const {data,error}=await client.from('mobility_stage_deliveries')
    .select('id,courier_id,vehicle_id,sender_id,status,revision,requested_vehicle_kind,category,proof_ref')
    .eq('id',deliveryId).eq('courier_id',actorId).maybeSingle();
   if(error)throw Error('G66 custody database unavailable');
   if(!data)return null;
   if(data.id!==deliveryId||data.courier_id!==actorId||
    !valid(data.vehicle_id)||!valid(data.sender_id)||
    !['accepted','picked_up','delivered','disputed','returned','cancelled'].includes(data.status)||
    !Number.isSafeInteger(data.revision)||data.revision<2||
    !['MOTO','AUTO'].includes(data.requested_vehicle_kind)||
    !['DOCUMENTS','PARCEL','GROCERIES','PHARMACY_OTC','RESTAURANT'].includes(data.category)||
    (data.proof_ref!==null&&!valid(data.proof_ref)))
    throw Error('G66 malformed courier-scoped custody row');
   return Object.freeze({deliveryId:data.id,courierId:data.courier_id,
    senderId:data.sender_id,vehicleId:data.vehicle_id,
    status:data.status,revision:data.revision,
    vehicleKind:data.requested_vehicle_kind,category:data.category,
    proofRef:data.proof_ref});
  }
 });
}
