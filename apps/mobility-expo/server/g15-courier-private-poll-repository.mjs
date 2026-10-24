/** G15 trusted-server courier-scoped offers for push-independent polling.
 * Only a verified actor supplied by a JWT-bound gateway may become _courier_id.
 */
export const G15_COURIER_POLL_LIVE_ENABLED=false;
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function createCourierPrivatePollRepository({rpc}={}){
 if(typeof rpc!=='function')throw Error('Trusted G15 RPC required');
 return Object.freeze({
  async listForCourier({courierId}={}){
   if(!uuid(courierId))throw Error('Invalid verified courier');
   const response=await rpc('mobility_stage_poll_courier_delivery_offers',
    {_courier_id:courierId});
   if(!plain(response)||response.error||!Array.isArray(response.data)||
      response.data.length>5)throw Error('G15 private courier polling unavailable');
   const seen=new Set();
   const offers=response.data.map(row=>{
    if(!plain(row)||!uuid(row.offer_id)||!uuid(row.delivery_id)||
       typeof row.expires_at!=='string'||seen.has(row.offer_id))
     throw Error('Invalid private offer poll snapshot');
    const expiresAtMs=Date.parse(row.expires_at);
    if(!Number.isSafeInteger(expiresAtMs))
     throw Error('Invalid private offer expiry');
    seen.add(row.offer_id);
    return Object.freeze({offerId:row.offer_id,deliveryId:row.delivery_id,expiresAtMs});
   });
   return Object.freeze({ok:true,liveEnabled:false,offers:Object.freeze(offers)});
  }
 });
}
