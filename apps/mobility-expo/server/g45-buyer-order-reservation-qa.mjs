/**
 * G45 A26 — private, synthetic Buyer order and cancel contract (QA only).
 * Never deployed. PostgreSQL G45 fixture callable by disposable DB OWNER only.
 * Any future runtime MUST independently bind genuine provider Auth + SQL grant.
 */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validUuid=x=>typeof x==='string'&&UUID.test(x)&&x===x.toLowerCase();
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const sealed=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&
  keys.every(k=>Object.hasOwn(x,k));
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const positive=x=>Number.isSafeInteger(x)&&x>0;
const fail=(status,name)=>Object.freeze({status,body:Object.freeze({error:name})});
const allowedItems=items=>Array.isArray(items)&&items.length>=1&&
 items.length<=50&&items.every(row=>
   sealed(row,['itemId','quantity'])&&validUuid(row.itemId)&&
   Number.isSafeInteger(row.quantity)&&row.quantity>=1&&row.quantity<=999
 )&&new Set(items.map(row=>row.itemId)).size===items.length;
const RECEIPT=['receiptId','orderId','requestKey','branchId','catalogVersion',
 'subtotalPyg','receiptStatus','orderEnabled','productionEnabled'];
const CANCEL=['orderId','receiptId','eventId','receiptStatus',
 'refundStatus','orderEnabled','productionEnabled'];
const validReceipt=(data,request)=>sealed(data,RECEIPT)&&
 [data.receiptId,data.orderId,data.requestKey,data.branchId].every(validUuid)&&
 data.requestKey===request.requestKey&&data.branchId===request.branchId&&
 data.catalogVersion===request.catalogVersion&&
 Number.isSafeInteger(data.subtotalPyg)&&
 data.subtotalPyg>=100&&data.subtotalPyg<=50000000&&
 data.receiptStatus==='QA_RESERVED_NO_PAYMENT'&&
 data.orderEnabled===false&&data.productionEnabled===false;
const validCancel=(data,request)=>sealed(data,CANCEL)&&
 [data.orderId,data.receiptId,data.eventId].every(validUuid)&&
 data.orderId===request.orderId&&
 data.receiptStatus==='QA_CANCELLED_STOCK_RESTORED'&&
 data.refundStatus==='NO_PSP_NO_FINANCIAL_REFUND'&&
 data.orderEnabled===false&&data.productionEnabled===false;

export function createG45BuyerOrderReservationQa({
 environment,localQaOnly,liveEnabled,projectRef,
 verifyAccessToken,verifySessionNotRevoked,loadExclusiveRole,
 allowRequest,rpc,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,loadExclusiveRole,
   allowRequest,rpc,now].some(f=>typeof f!=='function'))
  throw Error('G45 trusted local QA authorities required');
 assertStagingRef(projectRef);
 async function actorFor(bearer,operation){
  if(typeof bearer!=='string'||bearer.length<20||bearer.length>7900||
   !/^[A-Za-z0-9._~-]+$/.test(bearer))
   return {failure:fail(401,'JWT_REQUIRED')};
  const at=now();
  if(!integer(at))return {failure:fail(503,'CLOCK_UNAVAILABLE')};
  let actor;
  try{actor=await verifyAccessToken(bearer);}
  catch{return {failure:fail(401,'UNVERIFIED_SESSION')};}
  if(!plain(actor)||!validUuid(actor.id)||!validUuid(actor.sessionId)||
   !integer(actor.tokenIatMs)||actor.tokenIatMs>at||
   !integer(actor.expiresAtMs)||actor.expiresAtMs<=at||
   actor.is_anonymous===true||
   !(typeof actor.email_confirmed_at==='string'||
      typeof actor.phone_confirmed_at==='string'))
   return {failure:fail(401,'UNVERIFIED_SESSION')};
  let current;
  try{current=await verifySessionNotRevoked({
   userId:actor.id,sessionId:actor.sessionId,at
  });}catch{return {failure:fail(503,'REVOCATION_UNAVAILABLE')};}
  if(current!==true)return {failure:fail(401,'SESSION_REVOKED')};
  let role;
  try{role=await loadExclusiveRole(actor.id);}
  catch{return {failure:fail(503,'ROLE_AUTHORITY_UNAVAILABLE')};}
  if(role!=='passenger')return {failure:fail(403,'BUYER_ROLE_REQUIRED')};
  try{
   if(allowRequest({userId:actor.id,operation})!==true)
    return {failure:fail(429,'ORDER_RATE_LIMIT')};
  }catch{return {failure:fail(503,'RATE_LIMIT_UNAVAILABLE')};}
  return {actor};
 }
 async function reserve({bearer,body}={}){
  if(!sealed(body,['requestKey','branchId','catalogVersion','vehicleKind','items'])||
   !validUuid(body.requestKey)||!validUuid(body.branchId)||
   !positive(body.catalogVersion)||!['AUTO','MOTO'].includes(body.vehicleKind)||
   !allowedItems(body.items))
   return fail(400,'INVALID_ORDER_REQUEST');
  const {actor,failure}=await actorFor(bearer,'buyer.order.reserve.qa');
  if(failure)return failure;
  let source;
  try{source=await rpc('mobility_stage_g45_reserve_order_qa',{
   _buyer:actor.id,_session:actor.sessionId,_iat_ms:actor.tokenIatMs,
   _request_key:body.requestKey,_branch:body.branchId,
   _catalog_version:body.catalogVersion,_vehicle_kind:body.vehicleKind,
   _items:body.items
  });}
  catch{return fail(503,'ORDER_SOURCE_UNAVAILABLE')};
  if(!plain(source))return fail(503,'ORDER_SOURCE_UNAVAILABLE');
  if(source.error){
   if(source.error.code==='G4509')return fail(409,'ORDER_VERSION_OR_KEY_CONFLICT');
   if(['G4501','G4503'].includes(source.error.code))
    return fail(403,'BUYER_OR_BRANCH_UNAVAILABLE');
   return fail(503,'ORDER_SOURCE_UNAVAILABLE');
  }
  if(!validReceipt(source.data,body))return fail(503,'UNSAFE_ORDER_RECEIPT');
  return Object.freeze({status:201,body:Object.freeze({...source.data})});
 }
 async function cancel({bearer,body}={}){
  if(!sealed(body,['orderId','cancelKey'])||
   !validUuid(body.orderId)||!validUuid(body.cancelKey))
   return fail(400,'INVALID_CANCEL_REQUEST');
  const {actor,failure}=await actorFor(bearer,'buyer.order.cancel.qa');
  if(failure)return failure;
  let source;
  try{source=await rpc('mobility_stage_g45_cancel_order_qa',{
   _buyer:actor.id,_session:actor.sessionId,_iat_ms:actor.tokenIatMs,
   _order_id:body.orderId,_cancel_key:body.cancelKey
  });}
  catch{return fail(503,'ORDER_SOURCE_UNAVAILABLE')};
  if(!plain(source))return fail(503,'ORDER_SOURCE_UNAVAILABLE');
  if(source.error){
   if(source.error.code==='G4509')return fail(409,'CANCELLATION_REPLAY_CONFLICT');
   if(['G4501','G4503'].includes(source.error.code))
    return fail(403,'BUYER_OR_ORDER_UNAVAILABLE');
   return fail(503,'ORDER_SOURCE_UNAVAILABLE');
  }
  if(!validCancel(source.data,body))return fail(503,'UNSAFE_CANCEL_RECEIPT');
  return Object.freeze({status:200,body:Object.freeze({...source.data})});
 }
 return Object.freeze({reserve,cancel});
}
