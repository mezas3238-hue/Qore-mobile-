/** Authenticated G6 merchant-order API for isolated STAGING only. */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST='/v1/staging/buyer/orders/request';
const MERCHANT_TRANSITION=/^\/v1\/staging\/merchant\/orders\/([0-9a-f-]{36})\/transition$/i;
const BUYER_TRANSITION=/^\/v1\/staging\/buyer\/orders\/([0-9a-f-]{36})\/transition$/i;
const ATTACH=/^\/v1\/staging\/merchant\/orders\/([0-9a-f-]{36})\/attach-delivery$/i;
const STATUS=/^\/v1\/staging\/orders\/([0-9a-f-]{36})\/status$/i;
const MERCHANT_EVENTS=new Set(['confirm','start_preparing','ready','hand_to_courier']);
const BUYER_EVENTS=new Set(['cancel','complete']);
const VEHICLES=new Set(['AUTO','MOTO']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
 (Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const fields=(value,names)=>plain(value)&&Object.keys(value).length===names.length&&
 names.every(name=>Object.hasOwn(value,name));
const tokenFrom=headers=>{
 const header=headers?.authorization??headers?.Authorization;
 return typeof header==='string'&&header.length<8000?
  /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(header)?.[1]??null:null;
};
const verified=user=>plain(user)&&UUID.test(user.id??'')&&user.is_anonymous!==true&&
 (typeof user.email_confirmed_at==='string'||typeof user.phone_confirmed_at==='string');
const items=value=>Array.isArray(value)&&value.length>=1&&value.length<=50&&
 new Set(value.map(x=>x?.itemId)).size===value.length&&value.every(x=>
  fields(x,['itemId','quantity'])&&UUID.test(x.itemId??'')&&
  Number.isSafeInteger(x.quantity)&&x.quantity>=1&&x.quantity<=999);
const requestBody=body=>fields(body,['requestKey','branchId','vehicleKind','items'])&&
 UUID.test(body.requestKey??'')&&UUID.test(body.branchId??'')&&
 VEHICLES.has(body.vehicleKind)&&items(body.items);
const transitionBody=(body,allowed)=>fields(body,['event','eventKey'])&&
 allowed.has(body.event)&&UUID.test(body.eventKey??'');
const attachBody=body=>fields(body,['deliveryId','requestKey'])&&
 UUID.test(body.deliveryId??'')&&UUID.test(body.requestKey??'');
const response=(status,body)=>({status,body});

export function createQoreMerchantOrderGateway({
 projectRef,verifyAccessToken,authorizeBuyer,authorizeMerchantOrder,allowRequest,
 requestOrder,transitionOrder,attachDelivery,loadOrder,
}){
 assertStagingRef(projectRef);
 if(![verifyAccessToken,authorizeBuyer,authorizeMerchantOrder,allowRequest,
  requestOrder,transitionOrder,attachDelivery,loadOrder]
  .every(value=>typeof value==='function'))throw Error('Merchant order adapters required');
 return async({method,path,headers,body})=>{
  const create=method==='POST'&&path===REQUEST;
  const merchant=method==='POST'&&typeof path==='string'?MERCHANT_TRANSITION.exec(path):null;
  const buyer=method==='POST'&&typeof path==='string'?BUYER_TRANSITION.exec(path):null;
  const attach=method==='POST'&&typeof path==='string'?ATTACH.exec(path):null;
  const status=method==='GET'&&typeof path==='string'?STATUS.exec(path):null;
  if(!create&&!merchant&&!buyer&&!attach&&!status)return response(404,{error:'Not found'});
  if(create&&!requestBody(body))return response(400,{error:'Invalid merchant order'});
  if(merchant&&!transitionBody(body,MERCHANT_EVENTS))
   return response(400,{error:'Invalid merchant transition'});
  if(buyer&&!transitionBody(body,BUYER_EVENTS))
   return response(400,{error:'Invalid buyer transition'});
  if(attach&&!attachBody(body))return response(400,{error:'Invalid delivery link'});
  const bearer=tokenFrom(headers);
  if(!bearer)return response(401,{error:'Verified session required'});
  let user;
  try{user=await verifyAccessToken(bearer);}catch{return response(401,{error:'Session invalid'});}
  if(!verified(user))return response(401,{error:'Confirmed account required'});
  const orderId=merchant?.[1]??buyer?.[1]??attach?.[1]??status?.[1]??null;
  try{
   if((create||buyer)&&await authorizeBuyer(user.id)!==true)
    return response(403,{error:'Buyer role required'});
   if((merchant||attach)&&await authorizeMerchantOrder({actorId:user.id,orderId})!==true)
    return response(403,{error:'Merchant order access required'});
  }catch{return response(503,{error:'Order authorization unavailable'});}
  const operation=create?'order_request':merchant?'order_'+body.event:
   buyer?'order_'+body.event:attach?'order_attach':'order_status';
  try{
   if(allowRequest({userId:user.id,operation})!==true)
    return response(429,{error:'Merchant order limit reached'});
  }catch{return response(503,{error:'Request limiter unavailable'});}
  try{
   if(create){
    const result=await requestOrder({actorId:user.id,...body});
    if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
      !UUID.test(result.orderId??''))throw Error('Invalid order receipt');
    return response(201,{mode:'STAGING_DEMO_ONLY',liveCommerceEnabled:false,
     orderId:result.orderId,status:'requested',serverPersisted:true});
   }
   if(merchant||buyer){
    const result=await transitionOrder({actorId:user.id,orderId,...body});
    if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
      !UUID.test(result.eventId??''))throw Error('Invalid transition receipt');
    return response(200,{mode:'STAGING_DEMO_ONLY',liveCommerceEnabled:false,
     orderId,event:body.event,eventId:result.eventId,serverPersisted:true});
   }
   if(attach){
    const result=await attachDelivery({actorId:user.id,orderId,...body});
    if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
      !UUID.test(result.eventId??''))throw Error('Invalid link receipt');
    return response(200,{mode:'STAGING_DEMO_ONLY',liveCommerceEnabled:false,
     orderId,event:'attach_delivery',eventId:result.eventId,serverPersisted:true});
   }
   const result=await loadOrder({actorId:user.id,orderId});
   if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
     !plain(result.order)||result.order.id!==orderId)throw Error('Invalid order snapshot');
   return response(200,{mode:'STAGING_DEMO_ONLY',liveCommerceEnabled:false,
    order:result.order,serverPersisted:true});
  }catch{return response(409,{error:'Merchant order rejected by persistent state'});}
 };
}
