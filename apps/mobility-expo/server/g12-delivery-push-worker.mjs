/** G12 delivery private-offer push: claim != provider acceptance != device receipt.
 * STAGING only. Durable claim/ack must be implemented by trusted SQL repository.
 */
export const DELIVERY_PUSH_LIVE_ENABLED=false;
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=reason=>({ok:false,liveEnabled:false,reason});
export function createDeliveryPushWorker({claim,ack,sendToProvider,workerId}={}){
 if(!uuid(workerId)||![claim,ack,sendToProvider].every(x=>typeof x==='function'))
  throw Error('Trusted STAGING push worker dependencies required');
 return Object.freeze({
  async processOne(){
   try{
    const claimed=await claim({workerId});
    if(claimed===null)return {ok:true,liveEnabled:false,empty:true};
    if(!object(claimed)||claimed.liveEnabled!==false||!uuid(claimed.offerId)||
      !uuid(claimed.courierId)||!uuid(claimed.deliveryId)||
      !Number.isSafeInteger(claimed.expiresAtMs)||claimed.expiresAtMs<=Date.now()+3000)
     return fail('Invalid or expired delivery push claim');
    // A claim may have been queued for seconds before this worker received it.
    // Never contact the provider if the private offer is now too close to expiry.
    if(claimed.expiresAtMs<=Date.now()+3000)
     return fail('Delivery offer expired before provider dispatch');
    const sent=await sendToProvider({offerId:claimed.offerId,courierId:claimed.courierId,
      deliveryId:claimed.deliveryId,expiresAtMs:claimed.expiresAtMs});
    if(!object(sent)||sent.accepted!==true||
      typeof sent.ticketId!=='string'||!/^[A-Za-z0-9_-]{8,120}$/.test(sent.ticketId))
     return fail('Push provider did not accept delivery ticket');
    const stored=await ack({workerId,offerId:claimed.offerId,ticketId:sent.ticketId});
    if(stored!==true)return fail('Delivery push ACK persistence unavailable');
    return {ok:true,liveEnabled:false,offerId:claimed.offerId,
      providerAccepted:true,deviceReceived:false};
   }catch{return fail('Delivery push processing unavailable');}
  }
 });
}
