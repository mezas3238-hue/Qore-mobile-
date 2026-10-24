/** G68: server-only sender ownership query. A delivery UUID alone is NOT authorization. */
export const G68_SENDER_REPOSITORY_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const valid=x=>typeof x==='string'&&UUID.test(x);
export function createG68SenderCustodyRepository(client){
 if(!client||typeof client.from!=='function')throw Error('G68 requires server DB');
 return Object.freeze({async loadOwnDelivery({actorId,deliveryId}={}){
  if(!valid(actorId)||!valid(deliveryId))throw Error('G68 bad scope');
  const {data,error}=await client.from('mobility_stage_deliveries')
   .select('id,sender_id,courier_id,vehicle_id,status,revision,requested_vehicle_kind,proof_ref')
   .eq('id',deliveryId).eq('sender_id',actorId).maybeSingle();
  if(error)throw Error('G68 sender query failed');
  if(data===null)return null;
  if(!data||data.id!==deliveryId||data.sender_id!==actorId||
   !['requested','accepted','picked_up','delivered','disputed','returned','cancelled'].includes(data.status)||
   !['AUTO','MOTO'].includes(data.requested_vehicle_kind)||
   !Number.isSafeInteger(data.revision)||data.revision<1||
   (data.courier_id!==null&&!valid(data.courier_id))||
   (data.vehicle_id!==null&&!valid(data.vehicle_id))||
   (data.proof_ref!==null&&!valid(data.proof_ref)))
   throw Error('G68 invalid owned row');
  return Object.freeze({deliveryId:data.id,senderId:data.sender_id,
   courierId:data.courier_id,vehicleId:data.vehicle_id,
   status:data.status,revision:data.revision,
   vehicleKind:data.requested_vehicle_kind,proofRef:data.proof_ref});
 }});
}
