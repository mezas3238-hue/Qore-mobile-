/** Authenticated G7 fare and SIMULATED-payment API for isolated STAGING. */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUOTE='/v1/staging/fares/quote';
const AUTHORIZE='/v1/staging/payments/authorize';
const TRANSITION=/^\/v1\/staging\/payments\/([0-9a-f-]{36})\/transition$/i;
const STATUS=/^\/v1\/staging\/payments\/([0-9a-f-]{36})\/status$/i;
const MODES=new Set(['AUTO','MOTO','DELIVERY','MERCHANT_DELIVERY']);
const SUBJECTS=new Set(['RIDE','DELIVERY','MERCHANT_ORDER']);
const METHODS=new Set(['SIMULATED_CASH','SIMULATED_CARD']);
const EVENTS=new Set(['capture','refund','cancel']);
const SUBJECT_MODE=new Map([
 ['RIDE',new Set(['AUTO','MOTO'])],['DELIVERY',new Set(['DELIVERY'])],
 ['MERCHANT_ORDER',new Set(['MERCHANT_DELIVERY'])],
]);
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
const quoteBody=body=>fields(body,['requestKey','fareMode','subjectKind','subjectId'])&&
 UUID.test(body.requestKey??'')&&MODES.has(body.fareMode)&&
 SUBJECTS.has(body.subjectKind)&&UUID.test(body.subjectId??'')&&
 SUBJECT_MODE.get(body.subjectKind)?.has(body.fareMode)===true;
const authorizeBody=body=>fields(body,['requestKey','quoteId','method'])&&
 UUID.test(body.requestKey??'')&&UUID.test(body.quoteId??'')&&METHODS.has(body.method);
const transitionBody=body=>fields(body,['event','eventKey'])&&EVENTS.has(body.event)&&
 UUID.test(body.eventKey??'');
const response=(status,body)=>({status,body});

export function createQoreFinanceGateway({
 projectRef,verifyAccessToken,authorizePassenger,allowRequest,loadPricingContext,
 quoteFare,authorizePayment,transitionPayment,loadPayment,
}){
 assertStagingRef(projectRef);
 if(![verifyAccessToken,authorizePassenger,allowRequest,loadPricingContext,
  quoteFare,authorizePayment,transitionPayment,loadPayment]
  .every(value=>typeof value==='function'))throw Error('Finance adapters required');
 return async({method,path,headers,body})=>{
  const quote=method==='POST'&&path===QUOTE;
  const authorize=method==='POST'&&path===AUTHORIZE;
  const transition=method==='POST'&&typeof path==='string'?TRANSITION.exec(path):null;
  const status=method==='GET'&&typeof path==='string'?STATUS.exec(path):null;
  if(!quote&&!authorize&&!transition&&!status)return response(404,{error:'Not found'});
  if(quote&&!quoteBody(body))return response(400,{error:'Invalid fare quote request'});
  if(authorize&&!authorizeBody(body))
   return response(400,{error:'Invalid simulated payment authorization'});
  if(transition&&!transitionBody(body))
   return response(400,{error:'Invalid simulated payment transition'});
  const bearer=tokenFrom(headers);
  if(!bearer)return response(401,{error:'Verified session required'});
  let user;
  try{user=await verifyAccessToken(bearer);}catch{return response(401,{error:'Session invalid'});}
  if(!verified(user))return response(401,{error:'Confirmed account required'});
  try{
   if(await authorizePassenger(user.id)!==true)
    return response(403,{error:'Passenger role required'});
  }catch{return response(503,{error:'Finance authorization unavailable'});}
  const operation=quote?'fare_quote':authorize?'payment_authorize':
   transition?'payment_'+body.event:'payment_status';
  try{
   if(allowRequest({userId:user.id,operation})!==true)
    return response(429,{error:'Finance request limit reached'});
  }catch{return response(503,{error:'Request limiter unavailable'});}
  try{
   if(quote){
    // Distance, duration, zone and tolls come only from a trusted route adapter.
    const pricing=await loadPricingContext({actorId:user.id,fareMode:body.fareMode,
     subjectKind:body.subjectKind,subjectId:body.subjectId});
    if(!plain(pricing)||pricing.trafficAware!==true||pricing.fallbackUsed!==false||
      typeof pricing.zoneTag!=='string'||!/^[A-Z_]{3,40}$/.test(pricing.zoneTag)||
      !Number.isSafeInteger(pricing.distanceMeters)||pricing.distanceMeters<0||
      pricing.distanceMeters>500000||!Number.isSafeInteger(pricing.durationSeconds)||
      pricing.durationSeconds<0||pricing.durationSeconds>86400||
      !Number.isSafeInteger(pricing.tollsPyg)||pricing.tollsPyg<0||pricing.tollsPyg>1000000)
     throw Error('Unverified pricing context');
    const result=await quoteFare({actorId:user.id,...body,zoneTag:pricing.zoneTag,
     distanceMeters:pricing.distanceMeters,durationSeconds:pricing.durationSeconds,
     tollsPyg:pricing.tollsPyg});
    if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
      !plain(result.quote)||!UUID.test(result.quote.id??'')||
      result.quote.subjectId!==body.subjectId||result.quote.mode!==body.fareMode)
     throw Error('Invalid quote receipt');
    return response(201,{mode:'STAGING_DEMO_ONLY',livePaymentsEnabled:false,
     quote:result.quote,serverPriced:true});
   }
   if(authorize){
    const result=await authorizePayment({actorId:user.id,...body});
    if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
      !UUID.test(result.paymentId??''))throw Error('Invalid authorization receipt');
    return response(201,{mode:'STAGING_DEMO_ONLY',livePaymentsEnabled:false,
     paymentId:result.paymentId,status:'authorized',serverPersisted:true});
   }
   const paymentId=transition?.[1]??status?.[1];
   if(transition){
    const result=await transitionPayment({actorId:user.id,paymentId,...body});
    if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
      !UUID.test(result.eventId??''))throw Error('Invalid payment transition receipt');
    return response(200,{mode:'STAGING_DEMO_ONLY',livePaymentsEnabled:false,
     paymentId,event:body.event,eventId:result.eventId,serverPersisted:true});
   }
   const result=await loadPayment({actorId:user.id,paymentId});
   if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
     !plain(result.payment)||result.payment.id!==paymentId)
    throw Error('Invalid payment snapshot');
   return response(200,{mode:'STAGING_DEMO_ONLY',livePaymentsEnabled:false,
    payment:result.payment,serverPersisted:true});
  }catch{return response(409,{error:'Finance operation rejected by persistent state'});}
 };
}
