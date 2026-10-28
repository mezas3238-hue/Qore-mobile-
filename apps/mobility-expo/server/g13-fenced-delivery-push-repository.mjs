/** G13: STAGING-only fenced delivery push RPC adapter.
 * No credentials, real push, browser calls or remote migration.
 * A prepared send must never be reclaimed automatically after an ambiguous provider outcome.
 */
export const G13_DELIVERY_PUSH_LIVE_ENABLED=false;
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const ticket=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{8,120}$/.test(x);
function result(response,expected){
 if(!object(response)||response.error||typeof response.data!==expected)
  throw Error('G13 private PostgreSQL RPC failed');
 return response.data;
}
export function createFencedDeliveryPushRepository({rpc}={}){
 if(typeof rpc!=='function')throw Error('Trusted G13 PostgreSQL RPC required');
 return Object.freeze({
  async claim({workerId}={}){
   if(!uuid(workerId))throw Error('Invalid G13 worker identity');
   const response=await rpc('mobility_stage_claim_delivery_push_v2',{_worker_id:workerId});
   if(!object(response)||response.error||!Array.isArray(response.data)||
      response.data.length>1)throw Error('Invalid G13 claim response');
   if(response.data.length===0)return null;
   const row=response.data[0];
   if(!object(row)||!uuid(row.offer_id)||!uuid(row.courier_id)||
      !uuid(row.delivery_id)||!uuid(row.claim_nonce)||
      typeof row.expires_at!=='string')
    throw Error('Invalid G13 claim content');
   const expiresAtMs=Date.parse(row.expires_at);
   if(!Number.isSafeInteger(expiresAtMs))throw Error('Invalid G13 claim expiry');
   return {offerId:row.offer_id,courierId:row.courier_id,
    deliveryId:row.delivery_id,claimNonce:row.claim_nonce,expiresAtMs,liveEnabled:false};
  },
  async begin({workerId,offerId,claimNonce}={}){
   if(![workerId,offerId,claimNonce].every(uuid))throw Error('Invalid G13 begin fence');
   return result(await rpc('mobility_stage_begin_delivery_push_v2',{
    _worker_id:workerId,_offer_id:offerId,_claim_nonce:claimNonce}),'boolean');
  },
  async ack({workerId,offerId,claimNonce,ticketId}={}){
   if(![workerId,offerId,claimNonce].every(uuid)||!ticket(ticketId))
    throw Error('Invalid G13 ACK fence');
   return result(await rpc('mobility_stage_ack_delivery_push_v2',{
    _worker_id:workerId,_offer_id:offerId,
    _claim_nonce:claimNonce,_ticket_id:ticketId}),'boolean');
  },
  async cleanupExpired(){
   const count=result(await rpc('mobility_stage_expire_delivery_push_claims_v2',{}),'number');
   if(!Number.isSafeInteger(count)||count<0||count>100)
    throw Error('Invalid G13 cleanup result');
   return count;
  }
 });
}
