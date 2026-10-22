/** G13 fenced STAGING push processor. No LIVE calls or device-receipt claims.
 * The repository atomically authorizes BEGIN before any provider side effect.
 * A BEGIN-committed row is not automatically retried after timeout or crash.
 */
export const G13_PUSH_LIVE_ENABLED=false;
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const ticket=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{8,120}$/.test(x);
const fail=reason=>({ok:false,liveEnabled:false,reason});
export function createFencedDeliveryPushWorker({
 claim,begin,ack,sendToProvider,workerId,now=Date.now
}={}){
 if(!uuid(workerId)||![claim,begin,ack,sendToProvider,now].every(x=>typeof x==='function'))
  throw Error('Trusted G13 worker dependencies required');
 return Object.freeze({
  async processOne(){
   try{
    const offer=await claim({workerId});
    if(offer===null)return {ok:true,empty:true,liveEnabled:false};
    if(!object(offer)||offer.liveEnabled!==false||
       ![offer.offerId,offer.courierId,offer.deliveryId,offer.claimNonce].every(uuid)||
       !Number.isSafeInteger(offer.expiresAtMs)||offer.expiresAtMs<=now()+3000)
     return fail('Invalid or expired fenced G13 claim');
    const fence={workerId,offerId:offer.offerId,claimNonce:offer.claimNonce};
    // The DB must reject this token when another worker reclaims the lease.
    if(await begin(fence)!==true)return fail('Fenced G13 send authorization refused');
    // A failure after BEGIN is ambiguous. Never infer that retrying is safe.
    if(offer.expiresAtMs<=now()+3000)
     return fail('Fenced G13 offer expired after preparation');
    const provider=await sendToProvider({
     offerId:offer.offerId,courierId:offer.courierId,
     deliveryId:offer.deliveryId,expiresAtMs:offer.expiresAtMs,
     idempotencyKey:'delivery-offer-'+offer.offerId
    });
    if(!object(provider)||provider.accepted!==true||!ticket(provider.ticketId))
     return fail('Fenced G13 provider acceptance unknown');
    if(await ack({...fence,ticketId:provider.ticketId})!==true)
     return fail('Fenced G13 provider ticket persistence unavailable');
    return {ok:true,liveEnabled:false,offerId:offer.offerId,
     providerAccepted:true,deviceReceived:false};
   }catch{return fail('Fenced G13 processing unavailable');}
  }
 });
}
