/** Authenticated recipient-only courier offer API for isolated STAGING. */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const READ=/^\/v1\/staging\/courier\/delivery-offers\/([0-9a-f-]{36})$/i;
const DECIDE=/^\/v1\/staging\/courier\/delivery-offers\/(accept|decline)$/;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
 (Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const fields=(value,names)=>object(value)&&Object.keys(value).length===names.length&&
 names.every(name=>Object.hasOwn(value,name));
const tokenFrom=headers=>{
 const value=headers?.authorization??headers?.Authorization;
 return typeof value==='string'&&value.length<8000?
  /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(value)?.[1]??null:null;
};
const verified=user=>object(user)&&UUID.test(user.id??'')&&user.is_anonymous!==true&&
 (typeof user.email_confirmed_at==='string'||typeof user.phone_confirmed_at==='string');
const payload=body=>fields(body,['offerId','requestKey'])&&
 UUID.test(body.offerId??'')&&UUID.test(body.requestKey??'');
const response=(status,body)=>({status,body});
export function createQoreDeliveryOfferGateway({
 projectRef,verifyAccessToken,authorizeCourier,allowRequest,
 loadOffer,acceptOffer,declineOffer,now=Date.now,
}){
 assertStagingRef(projectRef);
 if(![verifyAccessToken,authorizeCourier,allowRequest,loadOffer,acceptOffer,
  declineOffer,now].every(value=>typeof value==='function'))
  throw Error('Authenticated delivery-offer adapters required');
 return async({method,path,headers,body})=>{
  const read=method==='GET'&&typeof path==='string'?READ.exec(path):null;
  const decision=method==='POST'&&typeof path==='string'?DECIDE.exec(path):null;
  if(!read&&!decision)return response(404,{error:'Not found'});
  if(read&&body!==undefined&&body!==null)return response(400,{error:'GET cannot include body'});
  if(decision&&!payload(body))return response(400,{error:'Invalid delivery offer decision'});
  const bearer=tokenFrom(headers);
  if(!bearer)return response(401,{error:'Verified session required'});
  let user;
  try{user=await verifyAccessToken(bearer);}catch{return response(401,{error:'Session invalid'});}
  if(!verified(user))return response(401,{error:'Confirmed courier account required'});
  try{
   if(await authorizeCourier(user.id)!==true)return response(403,{error:'Courier role required'});
  }catch{return response(503,{error:'Courier role verification unavailable'});}
  try{
   if(allowRequest({userId:user.id,operation:read?'delivery_offer_read':
    'delivery_offer_'+decision[1]})!==true)
    return response(429,{error:'Delivery offer request limit reached'});
  }catch{return response(503,{error:'Request limiter unavailable'});}
  if(read){
   try{
    const result=await loadOffer({actorId:user.id,offerId:read[1]});
    const offer=result?.offer,expiresAtMs=Date.parse(offer?.expiresAt??'');
    const at=now();
    if(result?.ok!==true||result.liveEnabled!==false||!object(offer)||
      offer.offerId!==read[1]||offer.courierId!==user.id||offer.status!=='offered'||
      !Number.isSafeInteger(expiresAtMs)||!Number.isSafeInteger(at)||
      expiresAtMs<=at||expiresAtMs-at>45_000)
     return response(404,{error:'No active private delivery offer'});
    return response(200,{mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,
     offerId:offer.offerId,deliveryId:offer.deliveryId,vehicleId:offer.vehicleId,
     vehicleKind:offer.vehicleKind,category:offer.category,grams:offer.grams,
     dimensionsCm:{length:offer.lengthCm,width:offer.widthCm,height:offer.heightCm},
     pickupTag:offer.pickupTag,deliveryTag:offer.deliveryTag,expiresAtMs,
     confirmedAcceptance:false});
   }catch{return response(404,{error:'No active private delivery offer'});}
  }
  try{
   const action=decision[1];
   const result=await (action==='accept'?acceptOffer:declineOffer)({
    actorId:user.id,offerId:body.offerId,decisionKey:body.requestKey});
   const resultId=action==='accept'?result?.eventId:result?.offerId;
   if(result?.ok!==true||result.liveEnabled!==false||!UUID.test(resultId??''))
    throw Error('Invalid private delivery decision receipt');
   return response(200,{mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,
    outcome:action==='accept'?'accepted':'declined',
    ...(action==='accept'?{eventId:resultId}:{offerId:resultId}),
    senderEventDelivered:false,pushDelivered:false,serverPersisted:true});
  }catch{return response(409,{error:'Delivery offer expired, unauthorized or already decided'});}
 };
}
