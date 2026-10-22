/** G15 JWT-bound private polling fallback. No device receipt, location or push proof.
 * GET /v1/staging/courier/delivery-offers. STAGING only, never LIVE.
 */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
export const G15_COURIER_POLL_LIVE_ENABLED=false;
const PATH='/v1/staging/courier/delivery-offers';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const resp=(status,body)=>({status,body});
function bearer(headers){
 const value=headers?.authorization??headers?.Authorization;
 return typeof value==='string'&&value.length<8000?
  /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(value)?.[1]??null:null;
}
const verified=user=>plain(user)&&uuid(user.id)&&user.is_anonymous!==true&&
 (typeof user.email_confirmed_at==='string'||typeof user.phone_confirmed_at==='string');
export function createCourierPrivatePollGateway({
 projectRef,verifyAccessToken,authorizeCourier,allowRequest,listForCourier,now=Date.now
}={}){
 assertStagingRef(projectRef);
 if(![verifyAccessToken,authorizeCourier,allowRequest,listForCourier,now]
  .every(x=>typeof x==='function'))
  throw Error('Trusted G15 courier polling dependencies required');
 return async({method,path,headers,body}={})=>{
  if(method!=='GET'||path!==PATH)return resp(404,{error:'Not found'});
  if(body!==undefined&&body!==null)
   return resp(400,{error:'Polling GET cannot include body'});
  const token=bearer(headers);
  if(!token)return resp(401,{error:'Verified courier session required'});
  let user;
  try{user=await verifyAccessToken(token);}catch{
   return resp(401,{error:'Courier session invalid'});
  }
  if(!verified(user))return resp(401,{error:'Confirmed courier required'});
  try{
   if(await authorizeCourier(user.id)!==true)
    return resp(403,{error:'Courier role required'});
  }catch{return resp(503,{error:'Courier authorization unavailable'});}
  try{
   if(allowRequest({userId:user.id,operation:'courier_private_offer_poll'})!==true)
    return resp(429,{error:'Courier polling rate limit reached'});
  }catch{return resp(503,{error:'Courier polling limiter unavailable'});}
  try{
   const at=now();
   if(!Number.isSafeInteger(at)||at<0)throw Error('Invalid server clock');
   const result=await listForCourier({courierId:user.id});
   if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
      !Array.isArray(result.offers)||result.offers.length>5)
    throw Error('Untrusted courier polling response');
   const seen=new Set(),offers=[];
   for(const x of result.offers){
    if(!plain(x)||!uuid(x.offerId)||!uuid(x.deliveryId)||
       !Number.isSafeInteger(x.expiresAtMs)||seen.has(x.offerId)||
       x.expiresAtMs<=at+3000||x.expiresAtMs>at+45000)
     throw Error('Invalid or expired private offer in poll');
    seen.add(x.offerId);
    offers.push({offerId:x.offerId,deliveryId:x.deliveryId,expiresAtMs:x.expiresAtMs});
   }
   return resp(200,{mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,
    offers,deviceReceived:false,pushDelivered:false,suggestedPollIntervalMs:5000});
  }catch{return resp(503,{error:'Private courier offers temporarily unavailable'});}
 };
}
