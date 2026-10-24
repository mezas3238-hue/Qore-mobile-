/** G16 STAGING: one trusted-service adapter for AUTO ride and DELIVERY offers.
 * No customer information or provider push tickets. No LIVE.
 */
export const G16_DRIVER_INBOX_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId=x=>typeof x==='string'&&UUID.test(x);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function normalize(rows,kind){
 if(!Array.isArray(rows)||rows.length>5)throw Error('Invalid private offer set');
 return rows.map(row=>{
  if(!object(row)||!validId(row.offer_id)||!validId(row[kind==='AUTO_RIDE'?'trip_id':'delivery_id'])||
     typeof row.expires_at!=='string')throw Error('Invalid private offer');
  const expiresAtMs=Date.parse(row.expires_at);
  if(!Number.isSafeInteger(expiresAtMs))throw Error('Invalid private offer expiry');
  return Object.freeze({
   kind,offerId:row.offer_id,
   serviceId:row[kind==='AUTO_RIDE'?'trip_id':'delivery_id'],expiresAtMs
  });
 });
}
export function createDriverPrivateInboxRepository({rpc}={}){
 if(typeof rpc!=='function')throw Error('Trusted private inbox RPC required');
 return Object.freeze({
  async listForDriver({driverId}={}){
   if(!validId(driverId))throw Error('Invalid verified driver ID');
   const [auto,delivery]=await Promise.all([
    rpc('mobility_stage_poll_driver_auto_offers',{_driver_id:driverId}),
    rpc('mobility_stage_poll_courier_delivery_offers',{_courier_id:driverId})
   ]);
   if(!object(auto)||auto.error||!object(delivery)||delivery.error)
    throw Error('Private inbox persistence unavailable');
   const offers=[...normalize(auto.data,'AUTO_RIDE'),...normalize(delivery.data,'DELIVERY')];
   const seen=new Set();
   for(const item of offers){
    const key=item.kind+':'+item.offerId;
    if(seen.has(key))throw Error('Repeated private offer');
    seen.add(key);
   }
   offers.sort((a,b)=>a.expiresAtMs-b.expiresAtMs||
    a.kind.localeCompare(b.kind)||a.offerId.localeCompare(b.offerId));
   return Object.freeze({ok:true,liveEnabled:false,offers:Object.freeze(offers)});
  }
 });
}
