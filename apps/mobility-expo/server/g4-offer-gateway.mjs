/**
 * QORE Radar G4 — JWT-bound private offer API contract, SERVER-ONLY.
 * Not deployed; requires CI-only G4 SQL before it may run on staging.
 * No LIVE_TRIPS_ENABLED, no passenger location, no payment, no MOTO commercial.
 */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const routePrefix='/v1/staging/driver/offers/';
const read=/^\/v1\/staging\/driver\/offers\/([0-9a-f-]{36})$/i;
const allowedActions=new Set(['accept','decline']);
const bare=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 (Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
const fields=(o,names)=>bare(o)&&Object.keys(o).length===names.length&&
 names.every(k=>Object.hasOwn(o,k));
const response=(status,body)=>({status,body});
const tokenFrom=headers=>{
 const h=headers?.authorization??headers?.Authorization;
 if(typeof h!=='string'||h.length>8000)return null;
 return /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(h)?.[1]??null;
};
function verified(u){
 return bare(u)&&UUID.test(u.id??'')&&u.is_anonymous!==true&&
 (typeof u.email_confirmed_at==='string'||typeof u.phone_confirmed_at==='string');
}
const payloadValid=b=>fields(b,['offerId','requestKey'])&&
 UUID.test(b.offerId??'')&&UUID.test(b.requestKey??'');
/** Read API has no GPS, passenger contact or price from client. The server
 * loader must scope SQL by both offer_id AND driver_id and status/expiry. */
function validatedOffer(result,driverId,offerId,at){
 return bare(result)&&result.offerId===offerId&&result.driverId===driverId&&
 UUID.test(result.tripId??'')&&result.status==='offered'&&
 Number.isSafeInteger(result.expiresAtMs)&&result.expiresAtMs>at&&
 result.expiresAtMs-at<=30_000&&
 ['economico','confort','xl'].includes(result.service)&&
 /^[A-Z_]{3,40}$/.test(result.originTag??'')&&
 /^[A-Z_]{3,40}$/.test(result.destinationTag??'')&&
 result.originTag!==result.destinationTag;
}
export function createQoreOfferGateway({
 projectRef,verifyAccessToken,authorizeDriver,loadOfferForDriver,
 acceptOffer,declineOffer,allowRequest,now=Date.now,
 requireFreshSession=false,verifySessionNotRevoked,
}){
 assertStagingRef(projectRef);
 if(![verifyAccessToken,authorizeDriver,loadOfferForDriver,
   acceptOffer,declineOffer,allowRequest,now].every(x=>typeof x==='function'))
  throw new Error('QORE server-only offer gateway adapters required');
 if(requireFreshSession===true&&typeof verifySessionNotRevoked!=='function')
  throw Error('G4 guarded Driver decisions require revocation authority');
 return async({method,path,headers,body})=>{
  const found=typeof path==='string'?read.exec(path):null;
  const action=typeof path==='string'&&path.startsWith(routePrefix)?
    path.slice(routePrefix.length):null;
  const detail=method==='GET'&&found&&UUID.test(found[1]);
  const decision=method==='POST'&&allowedActions.has(action);
  if(!detail&&!decision)return response(404,{error:'Not found'});
  if(decision&&!payloadValid(body))return response(400,{error:'Invalid offer request'});
  if(detail&&body!==undefined&&body!==null)return response(400,{error:'GET cannot include body'});
  const token=tokenFrom(headers);
  if(!token)return response(401,{error:'Verified session required'});
  let user;
  try{user=await verifyAccessToken(token);}catch{return response(401,{error:'Session invalid'});}
  if(!verified(user))return response(401,{error:'Confirmed driver session required'});
  if(requireFreshSession===true){
   const at=now();
   if(!UUID.test(user.sessionId??'')||!Number.isSafeInteger(user.expiresAtMs)||
    !Number.isSafeInteger(at)||user.expiresAtMs<=at)
    return response(401,{error:'Driver session expired or incomplete'});
   try{
    if(await verifySessionNotRevoked({userId:user.id,sessionId:user.sessionId,at})!==true)
     return response(401,{error:'Driver session revoked'});
   }catch{return response(503,{error:'Driver session authority unavailable'});}
  }
  let allowed=false;
  try{allowed=await authorizeDriver(user.id);}catch{
   return response(503,{error:'Driver role verification unavailable'});
  }
  if(allowed!==true)return response(403,{error:'Driver role required'});
  try {
   if(allowRequest({userId:user.id,operation:detail?'offer_read':'offer_'+action})!==true)
    return response(429,{error:'Offer request limit reached'});
  }catch{return response(503,{error:'Request limiter unavailable'});}
  if(detail){
   try{
    const timestamp=now();
    if(!Number.isSafeInteger(timestamp)||timestamp<0)throw Error('clock');
    const data=await loadOfferForDriver({offerId:found[1],driverId:user.id});
    if(!validatedOffer(data,user.id,found[1],timestamp))
     return response(404,{error:'No active private offer'});
    return response(200,{
     mode:'STAGING_DEMO_ONLY',commercialRidesEnabled:false,
     offerId:data.offerId,tripId:data.tripId,
     service:data.service,originTag:data.originTag,
     destinationTag:data.destinationTag,expiresAtMs:data.expiresAtMs,
     confirmedAcceptance:false,
    });
   }catch{return response(503,{error:'Offer lookup unavailable'});}
  }
  try{
   // Only server-side verified actor ID enters the service-role SQL RPC.
   const params={
    _offer_id:body.offerId,_driver_id:user.id,_decision_key:body.requestKey
   };
   const result=await (action==='accept'?acceptOffer(params):declineOffer(params));
   if(typeof result!=='string'||!UUID.test(result))
    return response(503,{error:'Invalid database decision receipt'});
   return response(200,{
    mode:'STAGING_DEMO_ONLY',commercialRidesEnabled:false,
    outcome:action==='accept'?'accepted':'declined',
    ...(action==='accept'?{eventId:result}:{offerId:result}),
    // Never assert notification delivery; client must resync state from DB.
    passengerEventDelivered:false,pushDelivered:false
   });
  }catch{return response(409,{error:'Offer expired, unauthorized or already decided'});}
 };
}
