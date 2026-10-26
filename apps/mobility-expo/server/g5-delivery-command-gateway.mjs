/** Authenticated delivery API for isolated STAGING; never a live dispatch API. */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST='/v1/staging/sender/deliveries/request';
const RECONCILE=/^\/v1\/staging\/sender\/deliveries\/requests\/([0-9a-f-]{36})$/i;
const ACCEPT=/^\/v1\/staging\/courier\/deliveries\/([0-9a-f-]{36})\/accept$/i;
const TRANSITION=/^\/v1\/staging\/deliveries\/([0-9a-f-]{36})\/transition$/i;
const STATUS=/^\/v1\/staging\/deliveries\/([0-9a-f-]{36})\/status$/i;
const VEHICLES=new Set(['AUTO','MOTO']);
const CATEGORIES=new Set(['DOCUMENTS','PARCEL','GROCERIES','PHARMACY_OTC','RESTAURANT']);
const COURIER_EVENTS=new Set(['pickup','deliver','return']);
const SENDER_EVENTS=new Set(['cancel','dispute']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
 (Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const fields=(value,names)=>plain(value)&&Object.keys(value).length===names.length&&
 names.every(name=>Object.hasOwn(value,name));
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const tokenFrom=headers=>{
 const header=headers?.authorization??headers?.Authorization;
 return typeof header==='string'&&header.length<8000?
  /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(header)?.[1]??null:null;
};
const verified=user=>plain(user)&&UUID.test(user.id??'')&&user.is_anonymous!==true&&
 (typeof user.email_confirmed_at==='string'||typeof user.phone_confirmed_at==='string');
const tag=value=>typeof value==='string'&&/^[A-Z_]{3,40}$/.test(value);
const requestBody=body=>fields(body,['requestKey','vehicleKind','category','grams',
 'lengthCm','widthCm','heightCm','pickupTag','deliveryTag','restrictedItemDeclared'])&&
 UUID.test(body.requestKey??'')&&VEHICLES.has(body.vehicleKind)&&
 CATEGORIES.has(body.category)&&integer(body.grams,1,100000)&&
 integer(body.lengthCm,1,200)&&integer(body.widthCm,1,200)&&
 integer(body.heightCm,1,200)&&tag(body.pickupTag)&&tag(body.deliveryTag)&&
 body.pickupTag!==body.deliveryTag&&body.restrictedItemDeclared===false;
const acceptBody=body=>fields(body,['vehicleId','requestKey'])&&
 UUID.test(body.vehicleId??'')&&UUID.test(body.requestKey??'');
const transitionBody=body=>{
 if(!plain(body)||!UUID.test(body.eventKey??''))return false;
 if(body.event==='deliver')return fields(body,['event','eventKey','proofRef'])&&
  UUID.test(body.proofRef??'');
 return fields(body,['event','eventKey'])&&
  (COURIER_EVENTS.has(body.event)||SENDER_EVENTS.has(body.event));
};
const response=(status,body)=>({status,body});

export function createQoreDeliveryCommandGateway({
 projectRef,verifyAccessToken,resolveRole,allowRequest,
 requestDelivery,acceptDelivery,transitionDelivery,loadDelivery,
 reconcileDelivery=null,
}){
 assertStagingRef(projectRef);
 if(![verifyAccessToken,resolveRole,allowRequest,requestDelivery,acceptDelivery,
  transitionDelivery,loadDelivery].every(value=>typeof value==='function'))
  throw Error('Authenticated delivery adapters required');
 return async({method,path,headers,body})=>{
  const create=method==='POST'&&path===REQUEST;
  const recover=method==='GET'&&typeof path==='string'?RECONCILE.exec(path):null;
  const accept=method==='POST'&&typeof path==='string'?ACCEPT.exec(path):null;
  const transition=method==='POST'&&typeof path==='string'?TRANSITION.exec(path):null;
  const status=method==='GET'&&typeof path==='string'?STATUS.exec(path):null;
  if(!create&&!accept&&!transition&&!status&&!recover)return response(404,{error:'Not found'});
  if(create&&!requestBody(body))return response(400,{error:'Invalid delivery request'});
  if(accept&&!acceptBody(body))return response(400,{error:'Invalid delivery acceptance'});
  if(transition&&!transitionBody(body))return response(400,{error:'Invalid delivery transition'});
  const bearer=tokenFrom(headers);
  if(!bearer)return response(401,{error:'Verified session required'});
  let user;
  try{user=await verifyAccessToken(bearer);}catch{
   return response(401,{error:'Session invalid'});
  }
  if(!verified(user))return response(401,{error:'Confirmed account required'});
  let role;
  try{role=await resolveRole(user.id);}catch{
   return response(503,{error:'Role verification unavailable'});
  }
  if(role!=='passenger'&&role!=='driver')
   return response(403,{error:'Single sender or courier role required'});
  if((create||recover)&&role!=='passenger')return response(403,{error:'Sender role required'});
  if(accept&&role!=='driver')return response(403,{error:'Courier role required'});
  if(transition&&((SENDER_EVENTS.has(body.event)&&role!=='passenger')||
    (COURIER_EVENTS.has(body.event)&&role!=='driver')))
   return response(403,{error:'Role cannot perform delivery transition'});
  const operation=create?'delivery_request':recover?'delivery_reconcile':accept?'delivery_accept':
   transition?'delivery_'+body.event:'delivery_status';
  try{
   if(allowRequest({userId:user.id,operation})!==true)
    return response(429,{error:'Delivery command limit reached'});
  }catch{return response(503,{error:'Request limiter unavailable'});}
  const deliveryId=create?null:(accept?.[1]??transition?.[1]??status?.[1]);
  try{
   if(recover){
    // Owner-scoped READ after an uncertain POST, never a second booking.
    if(!UUID.test(recover[1]))return response(404,{error:'Not found'});
    if(typeof reconcileDelivery!=='function')
     return response(503,{error:'Delivery recovery unavailable'});
    const proof=await reconcileDelivery({actorId:user.id,requestKey:recover[1]});
    if(proof===null)return response(404,{error:'Delivery request unavailable'});
    if(!plain(proof)||proof.ok!==true||proof.liveEnabled!==false||
      !UUID.test(proof.deliveryId??'')||proof.requestKey!==recover[1]||
      !VEHICLES.has(proof.vehicleKind)||!Number.isSafeInteger(proof.revision)||
      proof.revision<1||
      !['requested','accepted','picked_up','delivered','disputed','returned','cancelled']
       .includes(proof.status))throw Error('Unverified delivery receipt');
    return response(200,{mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,
     serverPersisted:true,ownerId:user.id,requestKey:proof.requestKey,
     deliveryId:proof.deliveryId,vehicleKind:proof.vehicleKind,
     status:proof.status,revision:proof.revision});
   }
   if(create){
    const result=await requestDelivery({actorId:user.id,...body});
    if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
      !UUID.test(result.deliveryId??''))throw Error('Invalid request receipt');
    return response(201,{mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,
     deliveryId:result.deliveryId,status:'requested',serverPersisted:true});
   }
   if(accept){
    const result=await acceptDelivery({actorId:user.id,deliveryId,...body});
    if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
      !UUID.test(result.eventId??''))throw Error('Invalid accept receipt');
    return response(200,{mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,
     deliveryId,event:'accept',eventId:result.eventId,serverPersisted:true});
   }
   if(transition){
    const result=await transitionDelivery({actorId:user.id,deliveryId,...body});
    if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
      !UUID.test(result.eventId??''))throw Error('Invalid transition receipt');
    return response(200,{mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,
     deliveryId,event:body.event,eventId:result.eventId,serverPersisted:true});
   }
   const result=await loadDelivery({actorId:user.id,deliveryId});
   if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
     !plain(result.delivery)||result.delivery.id!==deliveryId)
    throw Error('Invalid delivery snapshot');
   return response(200,{mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,
    delivery:result.delivery,serverPersisted:true});
  }catch{return response(409,{error:'Delivery command rejected by persistent state'});}
 };
}
