/** G12 trusted-server adapter for a durable, private PostgreSQL delivery outbox.
 * RPC implementation and privileges MUST be deployed/tested separately in disposable CI.
 * No browser client, no service credentials, no live push.
 */
export const DELIVERY_PUSH_REPOSITORY_LIVE_ENABLED=false;
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=new Set(['offer_id','courier_id','delivery_id','expires_at']);
export function createDeliveryPushRepository({rpc}={}){
 if(typeof rpc!=='function')throw Error('Trusted PostgreSQL RPC required');
 return Object.freeze({
  async claim({workerId}={}){
   if(!uuid(workerId))throw Error('Invalid worker identity');
   const response=await rpc('mobility_stage_claim_delivery_push',{_worker_id:workerId});
   if(!object(response)||response.error)throw Error('Private delivery claim failed');
   const rows=response.data;
   if(!Array.isArray(rows)||rows.length>1)throw Error('Ambiguous delivery claim');
   if(rows.length===0)return null;
   const row=rows[0];
   if(!object(row)||[...keys].some(k=>!Object.hasOwn(row,k))||
      !uuid(row.offer_id)||!uuid(row.courier_id)||!uuid(row.delivery_id))
    throw Error('Invalid private delivery claim');
   const expiresAtMs=Date.parse(row.expires_at);
   if(!Number.isSafeInteger(expiresAtMs))throw Error('Invalid delivery expiry');
   return {offerId:row.offer_id,courierId:row.courier_id,
     deliveryId:row.delivery_id,expiresAtMs,liveEnabled:false};
  },
  async ack({workerId,offerId,ticketId}={}){
   if(!uuid(workerId)||!uuid(offerId)||typeof ticketId!=='string'||
      !/^[A-Za-z0-9_-]{8,120}$/.test(ticketId))
    throw Error('Invalid delivery push ACK');
   const response=await rpc('mobility_stage_ack_delivery_push',{
    _worker_id:workerId,_offer_id:offerId,_ticket_id:ticketId});
   if(!object(response)||response.error||typeof response.data!=='boolean')
    throw Error('Private delivery ACK failed');
   return response.data;
  }
 });
}
