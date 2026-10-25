/** G73 F1 QA: independently resolved route before quote, consent and booking.
 * Any missing provider or role fails closed. No commercial trip or PSP.
 */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=x=>typeof x==='string'&&UUID.test(x);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,a)=>obj(x)&&Object.keys(x).length===a.length&&a.every(k=>Object.hasOwn(x,k));
const tag=x=>typeof x==='string'&&/^[A-Z_]{3,40}$/.test(x);
const human=x=>typeof x==='string'&&x.trim()===x&&x.length>=3&&x.length<=120&&
 !/[\u0000-\u001f]/.test(x);
const service=x=>['economico','confort','xl'].includes(x);
const ROUTE='/v1/staging/rider/auto/routes';
const QUOTE='/v1/staging/rider/auto/prequote';
const BOOK='/v1/staging/rider/auto/book';
const RECON=/^\/v1\/staging\/rider\/auto\/bookings\/([a-f0-9-]{36})$/i;
const respond=(status,body)=>({status,body});
const bearer=h=>{
 const raw=h?.authorization??h?.Authorization;
 return typeof raw==='string'&&raw.length<8000?
  /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(raw)?.[1]??null:null;
};
const actor=u=>obj(u)&&id(u.id)&&u.is_anonymous!==true&&
 (typeof u.email_confirmed_at==='string'||typeof u.phone_confirmed_at==='string');
const routeFields=['mode','commercialEnabled','ownerId','routeId','requestKey',
 'service','routingVerified','expiresAt'];
const quoteFields=['mode','commercialEnabled','ownerId','routeId','quoteId',
 'quoteRequestKey','fareMode','service','currency','amountGs','fareVersion',
 'expiresAt','serverPriced','routingVerified','status'];
const bookFields=['mode','commercialEnabled','ownerId','requestKey',
 'quoteId','routeId','tripId','revision','serverPersisted','status'];
const saneRoute=(x,uid,key,serviceName,now)=>exact(x,routeFields)&&
 x.mode==='STAGING_DEMO_ONLY'&&x.commercialEnabled===false&&
 x.ownerId===uid&&x.requestKey===key&&id(x.routeId)&&
 x.service===serviceName&&x.routingVerified===true&&
 Number.isSafeInteger(x.expiresAt)&&x.expiresAt>now&&x.expiresAt<=now+3600000;
const saneQuote=(x,uid,key,routeId,now)=>exact(x,quoteFields)&&
 x.mode==='STAGING_DEMO_ONLY'&&x.commercialEnabled===false&&
 x.ownerId===uid&&x.routeId===routeId&&id(x.quoteId)&&
 x.quoteRequestKey===key&&x.fareMode==='AUTO'&&service(x.service)&&
 x.currency==='PYG'&&Number.isSafeInteger(x.amountGs)&&x.amountGs>0&&
 x.amountGs<=100000000&&typeof x.fareVersion==='string'&&
 /^[a-z0-9._-]{1,48}$/i.test(x.fareVersion)&&
 Number.isSafeInteger(x.expiresAt)&&x.expiresAt>now&&
 x.expiresAt<=now+3600000&&x.serverPriced===true&&
 x.routingVerified===true&&x.status==='QUOTED_QA';
const saneBook=(x,uid,key)=>exact(x,bookFields)&&
 x.mode==='STAGING_DEMO_ONLY'&&x.commercialEnabled===false&&
 x.ownerId===uid&&x.requestKey===key&&id(x.quoteId)&&
 id(x.routeId)&&id(x.tripId)&&Number.isSafeInteger(x.revision)&&
 x.revision>=1&&x.serverPersisted===true&&x.status==='ACCEPTED_QA';
export function createQoreG73AutoGateway({projectRef,verifyAccessToken,authorizePassenger,
 allowRequest,resolveVerifiedRoute,registerRoute,loadRoute,quoteRoute,loadQuote,
 bookQuote,reconcileBooking,now=Date.now}={}){
 assertStagingRef(projectRef);
 if(![verifyAccessToken,authorizePassenger,allowRequest,resolveVerifiedRoute,
 registerRoute,loadRoute,quoteRoute,loadQuote,bookQuote,reconcileBooking,now]
 .every(fn=>typeof fn==='function'))throw Error('G73 backend adapters required');
 return async({method,path,headers={},body}={})=>{
  const isRoute=method==='POST'&&path===ROUTE;
  const isQuote=method==='POST'&&path===QUOTE;
  const isBook=method==='POST'&&path===BOOK;
  const match=method==='GET'&&typeof path==='string'?RECON.exec(path):null;
  if(!isRoute&&!isQuote&&!isBook&&!match)return respond(404,{error:'Not found'});
  if(isRoute&&(!exact(body,['requestKey','origin','destination','service'])||
    !id(body.requestKey)||!human(body.origin)||!human(body.destination)||
    body.origin.toLowerCase()===body.destination.toLowerCase()||
    !service(body.service)))return respond(400,{error:'Invalid route'});
  if(isQuote&&(!exact(body,['requestKey','routeId'])||
    !id(body.requestKey)||!id(body.routeId)))
    return respond(400,{error:'Invalid quote'});
  if(isBook&&(!exact(body,['requestKey','quoteId','accepted'])||
    !id(body.requestKey)||!id(body.quoteId)||body.accepted!==true))
    return respond(400,{error:'Explicit price acceptance required'});
  const token=bearer(headers);
  if(!token)return respond(401,{error:'Verified session required'});
  let user;try{user=await verifyAccessToken(token);}
  catch{return respond(401,{error:'Session invalid'});}
  if(!actor(user))return respond(401,{error:'Confirmed passenger required'});
  try{if(await authorizePassenger(user.id)!==true)
    return respond(403,{error:'Passenger role required'});}
  catch{return respond(503,{error:'Role verification unavailable'});}
  try{if(allowRequest({userId:user.id,operation:
    isRoute?'g73_route':isQuote?'g73_quote':isBook?'g73_book':'g73_reconcile'})!==true)
    return respond(429,{error:'Request rate limited'});}
  catch{return respond(503,{error:'Rate limiter unavailable'});}
  try{
   if(isRoute){
    const r=await resolveVerifiedRoute({
     actorId:user.id,origin:body.origin,destination:body.destination,
     service:body.service});
    if(!obj(r)||r.routingVerified!==true||r.trafficAware!==true||
      r.fallbackUsed!==false||!tag(r.originTag)||!tag(r.destinationTag)||
      r.originTag===r.destinationTag||!tag(r.zoneTag)||
      !Number.isSafeInteger(r.distanceMeters)||r.distanceMeters<0||
      r.distanceMeters>500000||!Number.isSafeInteger(r.durationSeconds)||
      r.durationSeconds<0||r.durationSeconds>86400||
      !Number.isSafeInteger(r.tollsPyg)||r.tollsPyg<0||r.tollsPyg>1000000)
      return respond(409,{error:'Independently verified route unavailable'});
    const routeId=await registerRoute({
     actorId:user.id,requestKey:body.requestKey,service:body.service,
     originTag:r.originTag,destinationTag:r.destinationTag,zoneTag:r.zoneTag,
     distanceMeters:r.distanceMeters,durationSeconds:r.durationSeconds,
     tollsPyg:r.tollsPyg});
    const receipt=await loadRoute({actorId:user.id,routeId});
    if(!saneRoute(receipt,user.id,body.requestKey,body.service,now()))
      throw Error('Route not confirmed');
    return respond(201,receipt);
   }
   if(isQuote){
    const quoteId=await quoteRoute({actorId:user.id,
      requestKey:body.requestKey,routeId:body.routeId});
    const receipt=await loadQuote({actorId:user.id,quoteId});
    if(!saneQuote(receipt,user.id,body.requestKey,body.routeId,now()))
      throw Error('Quote not confirmed');
    return respond(200,receipt);
   }
   if(isBook){
    const tripId=await bookQuote({actorId:user.id,requestKey:body.requestKey,
      quoteId:body.quoteId});
    const rec=await reconcileBooking({actorId:user.id,requestKey:body.requestKey});
    if(!saneBook(rec,user.id,body.requestKey)||rec.tripId!==tripId||
      rec.quoteId!==body.quoteId)throw Error('Booking not confirmed');
    return respond(201,rec);
   }
   const rec=await reconcileBooking({actorId:user.id,requestKey:match[1]});
   if(rec===null)return respond(404,{error:'Unknown or unauthorized booking'});
   if(!saneBook(rec,user.id,match[1]))throw Error('Unreadable booking');
   return respond(200,rec);
  }catch{
   return respond(409,{error:'G73 transaction unresolved; read owner-scoped GET'});
  }
 };
}
