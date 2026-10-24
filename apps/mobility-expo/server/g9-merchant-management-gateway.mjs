/** Authenticated G9 merchant management API for isolated STAGING only. */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ONBOARD='/v1/staging/merchant/onboarding/request';
const REVIEW=/^\/v1\/staging\/admin\/merchants\/([0-9a-f-]{36})\/review$/i;
const BRANCH='/v1/staging/merchant/branches/upsert';
const ITEM='/v1/staging/merchant/catalog/upsert';
const KINDS=new Set(['SUPERMARKET','PHARMACY','RESTAURANT','RETAIL','OTHER']);
const REVIEWS=new Set(['approve','suspend']);
const CLASSES=new Set(['GENERAL','PHARMACY_OTC']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
 (Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const fields=(value,names)=>plain(value)&&Object.keys(value).length===names.length&&
 names.every(name=>Object.hasOwn(value,name));
const tokenFrom=headers=>{const header=headers?.authorization??headers?.Authorization;
 return typeof header==='string'&&header.length<8000?
  /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(header)?.[1]??null:null;};
const verified=user=>plain(user)&&UUID.test(user.id??'')&&user.is_anonymous!==true&&
 (typeof user.email_confirmed_at==='string'||typeof user.phone_confirmed_at==='string');
const onboarding=body=>fields(body,['requestKey','kind','displayTag'])&&
 UUID.test(body.requestKey??'')&&KINDS.has(body.kind)&&
 typeof body.displayTag==='string'&&/^[A-Z_]{3,40}$/.test(body.displayTag);
const review=body=>fields(body,['event','requestKey'])&&REVIEWS.has(body.event)&&
 UUID.test(body.requestKey??'');
const branch=body=>fields(body,['merchantId','requestKey','branchTag','pickupTag',
 'preparationMinutes','active','acceptingOrders'])&&UUID.test(body.merchantId??'')&&
 UUID.test(body.requestKey??'')&&/^[A-Z_]{3,40}$/.test(body.branchTag??'')&&
 /^[A-Z_]{3,40}$/.test(body.pickupTag??'')&&Number.isSafeInteger(body.preparationMinutes)&&
 body.preparationMinutes>=1&&body.preparationMinutes<=180&&
 typeof body.active==='boolean'&&typeof body.acceptingOrders==='boolean';
const item=body=>fields(body,['branchId','requestKey','sku','itemTag','itemClass',
 'unitPricePyg','unitGrams','stockUnits','active'])&&UUID.test(body.branchId??'')&&
 UUID.test(body.requestKey??'')&&/^[A-Z0-9_-]{2,40}$/.test(body.sku??'')&&
 /^[A-Z0-9_]{2,50}$/.test(body.itemTag??'')&&CLASSES.has(body.itemClass)&&
 Number.isSafeInteger(body.unitPricePyg)&&body.unitPricePyg>=100&&body.unitPricePyg<=10000000&&
 Number.isSafeInteger(body.unitGrams)&&body.unitGrams>=1&&body.unitGrams<=50000&&
 Number.isSafeInteger(body.stockUnits)&&body.stockUnits>=0&&body.stockUnits<=1000000&&
 typeof body.active==='boolean';
const response=(status,body)=>({status,body});

export function createQoreMerchantManagementGateway({projectRef,verifyAccessToken,
 authorizeAdmin,allowRequest,onboardMerchant,reviewMerchant,upsertBranch,upsertItem}){
 assertStagingRef(projectRef);
 if(![verifyAccessToken,authorizeAdmin,allowRequest,onboardMerchant,reviewMerchant,
  upsertBranch,upsertItem].every(x=>typeof x==='function'))
  throw Error('Merchant management adapters required');
 return async({method,path,headers,body})=>{
  const create=method==='POST'&&path===ONBOARD;
  const admin=method==='POST'&&typeof path==='string'?REVIEW.exec(path):null;
  const branchWrite=method==='POST'&&path===BRANCH;
  const itemWrite=method==='POST'&&path===ITEM;
  if(!create&&!admin&&!branchWrite&&!itemWrite)return response(404,{error:'Not found'});
  if(create&&!onboarding(body))return response(400,{error:'Invalid merchant onboarding'});
  if(admin&&!review(body))return response(400,{error:'Invalid merchant review'});
  if(branchWrite&&!branch(body))return response(400,{error:'Invalid merchant branch'});
  if(itemWrite&&!item(body))return response(400,{error:'Invalid catalog item'});
  const bearer=tokenFrom(headers);if(!bearer)return response(401,{error:'Verified session required'});
  let user;try{user=await verifyAccessToken(bearer);}catch{return response(401,{error:'Session invalid'});}
  if(!verified(user))return response(401,{error:'Confirmed account required'});
  if(admin){try{if(await authorizeAdmin(user.id)!==true)
    return response(403,{error:'Admin role required'});
   }catch{return response(503,{error:'Merchant review authorization unavailable'});}}
  const operation=create?'merchant_onboard':admin?'merchant_'+body.event:
   branchWrite?'merchant_branch':'merchant_catalog';
  try{if(allowRequest({userId:user.id,operation})!==true)
   return response(429,{error:'Merchant management limit reached'});
  }catch{return response(503,{error:'Request limiter unavailable'});}
  try{
   if(create){const result=await onboardMerchant({actorId:user.id,...body});
    if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
      !UUID.test(result.merchantId??''))throw Error('Invalid onboarding receipt');
    return response(202,{mode:'STAGING_DEMO_ONLY',merchantId:result.merchantId,
     status:'pending',commercialOrdersEnabled:false,serverPersisted:true});}
   if(admin){const result=await reviewMerchant({actorId:user.id,merchantId:admin[1],...body});
    if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
      !UUID.test(result.eventId??''))throw Error('Invalid review receipt');
    return response(200,{mode:'STAGING_DEMO_ONLY',merchantId:admin[1],event:body.event,
     eventId:result.eventId,serverPersisted:true});}
   if(branchWrite){const result=await upsertBranch({actorId:user.id,...body});
    if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
      !UUID.test(result.branchId??''))throw Error('Invalid branch receipt');
    return response(200,{mode:'STAGING_DEMO_ONLY',branchId:result.branchId,
     serverPersisted:true});}
   const result=await upsertItem({actorId:user.id,...body});
   if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
     !UUID.test(result.itemId??''))throw Error('Invalid catalog receipt');
   return response(200,{mode:'STAGING_DEMO_ONLY',itemId:result.itemId,
    serverPersisted:true});
  }catch{return response(409,{error:'Merchant management rejected by persistent state'});}
 };
}
