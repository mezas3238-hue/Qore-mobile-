/** G72 AUTO F1 prequote -> explicit consent -> exactly-one booking -> GET.
 * Local QA only. Never accepts money, distance or self-asserted routing from mobile.
 */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=x=>typeof x==='string'&&UUID.test(x);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=(x,k)=>plain(x)&&Object.keys(x).length===k.length&&k.every(n=>Object.hasOwn(x,n));
const tag=x=>typeof x==='string'&&/^[A-Z_]{3,40}$/.test(x);
const routeText=x=>typeof x==='string'&&x.trim()===x&&x.length>=3&&x.length<=120&&
 !/[\u0000-\u001f]/.test(x);
const SERVICES=new Set(['economico','confort','xl']);
const PRE='/v1/staging/rider/auto/prequote';
const BOOK='/v1/staging/rider/auto/book';
const GET=/^\/v1\/staging\/rider\/auto\/bookings\/([a-f0-9-]{36})$/i;
const response=(status,body)=>({status,body});
const token=h=>{
 const raw=h?.authorization??h?.Authorization;
 return typeof raw==='string'&&raw.length<8000?
  /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(raw)?.[1]??null:null;
};
const verified=u=>plain(u)&&id(u.id)&&u.is_anonymous!==true&&
 (typeof u.email_confirmed_at==='string'||typeof u.phone_confirmed_at==='string');
const bookingReceipt=(v,actor,key)=>keys(v,['mode','commercialEnabled','ownerId','requestKey',
 'operation','serviceId','revision','serverPersisted','status'])&&
 v.mode==='STAGING_DEMO_ONLY'&&v.commercialEnabled===false&&
 v.ownerId===actor&&v.requestKey===key&&v.operation==='rideRequest'&&
 id(v.serviceId)&&Number.isSafeInteger(v.revision)&&v.revision>=1&&
 v.serverPersisted===true&&v.status==='ACCEPTED_QA';
const quoteReceipt=(v,actor,quoteId,key,now)=>plain(v)&&
 v.mode==='STAGING_DEMO_ONLY'&&v.commercialEnabled===false&&
 v.ownerId===actor&&v.quoteId===quoteId&&v.requestKey===key&&
 v.fareMode==='AUTO'&&SERVICES.has(v.service)&&
 tag(v.originTag)&&tag(v.destinationTag)&&tag(v.zoneTag)&&
 Number.isSafeInteger(v.amountGs)&&v.amountGs>0&&v.amountGs<=100000000&&
 Number.isSafeInteger(v.subtotalGs)&&v.subtotalGs>=0&&
 Number.isSafeInteger(v.commissionGs)&&v.commissionGs>=0&&
 Number.isSafeInteger(v.providerGs)&&v.providerGs>=0&&
 v.amountGs===v.commissionGs+v.providerGs&&
 typeof v.fareVersion==='string'&&/^[A-Za-z0-9._-]{1,48}$/.test(v.fareVersion)&&
 Number.isFinite(Date.parse(v.expiresAt))&&Date.parse(v.expiresAt)>now&&
 Date.parse(v.expiresAt)<=now+3600000&&v.serverPriced===true&&
 v.serverPersisted===true&&v.bookingId===null;
export function createQoreG72AutoGateway({projectRef,verifyAccessToken,authorizePassenger,
 allowRequest,resolveVerifiedRoute,prequoteFare,loadQuote,bookQuote,
 reconcileBooking,now=Date.now}={}){
 assertStagingRef(projectRef);
 if(![verifyAccessToken,authorizePassenger,allowRequest,resolveVerifiedRoute,
  prequoteFare,loadQuote,bookQuote,reconcileBooking,now].every(f=>typeof f==='function'))
  throw Error('G72 verified backend adapters required');
 return async({method,path,headers={},body}={})=>{
  const pre=method==='POST'&&path===PRE;
  const book=method==='POST'&&path===BOOK;
  const lookup=method==='GET'&&typeof path==='string'?GET.exec(path):null;
  if(!pre&&!book&&!lookup)return response(404,{error:'Not found'});
  if(pre&&(!keys(body,['requestKey','origin','destination','service'])||
    !id(body.requestKey)||!routeText(body.origin)||!routeText(body.destination)||
    body.origin.toLocaleLowerCase()===body.destination.toLocaleLowerCase()||
    !SERVICES.has(body.service)))return response(400,{error:'Invalid AUTO quote request'});
  if(book&&(!keys(body,['requestKey','quoteId','accepted'])||
    !id(body.requestKey)||!id(body.quoteId)||body.accepted!==true))
    return response(400,{error:'Explicit quote acceptance required'});
  const bearer=token(headers);
  if(!bearer)return response(401,{error:'Verified session required'});
  let user;
  try{user=await verifyAccessToken(bearer);}catch{return response(401,{error:'Session invalid'});}
  if(!verified(user))return response(401,{error:'Confirmed passenger required'});
  try{
   if(await authorizePassenger(user.id)!==true)return response(403,{error:'Passenger required'});
  }catch{return response(503,{error:'Roles unavailable'});}
  try{
   if(allowRequest({userId:user.id,operation:pre?'auto_prequote':
    book?'auto_book':'auto_reconcile'})!==true)
    return response(429,{error:'Request limit'});
  }catch{return response(503,{error:'Limiter unavailable'});}
  try{
   if(pre){
    // The route service must independently confirm source and non-fallback;
    // human addresses NEVER become invented PYG, GPS or zone tags.
    const r=await resolveVerifiedRoute({actorId:user.id,origin:body.origin,
     destination:body.destination,service:body.service});
    if(!plain(r)||r.routingVerified!==true||r.trafficAware!==true||
      r.fallbackUsed!==false||!tag(r.originTag)||!tag(r.destinationTag)||
      r.originTag===r.destinationTag||!tag(r.zoneTag)||
      !Number.isSafeInteger(r.distanceMeters)||r.distanceMeters<0||
      r.distanceMeters>500000||!Number.isSafeInteger(r.durationSeconds)||
      r.durationSeconds<0||r.durationSeconds>86400||
      !Number.isSafeInteger(r.tollsPyg)||r.tollsPyg<0||r.tollsPyg>1000000)
      return response(409,{error:'Independently verified route unavailable'});
    const quoteId=await prequoteFare({actorId:user.id,requestKey:body.requestKey,
     service:body.service,originTag:r.originTag,destinationTag:r.destinationTag,
     zoneTag:r.zoneTag,distanceMeters:r.distanceMeters,
     durationSeconds:r.durationSeconds,tollsPyg:r.tollsPyg});
    if(!id(quoteId))throw Error('Quote RPC did not persist');
    const receipt=await loadQuote({actorId:user.id,quoteId});
    if(!quoteReceipt(receipt,user.id,quoteId,body.requestKey,now())||
      receipt.service!==body.service||receipt.originTag!==r.originTag||
      receipt.destinationTag!==r.destinationTag||receipt.zoneTag!==r.zoneTag)
      throw Error('Quote receipt invalid');
    return response(201,receipt);
   }
   if(book){
    const tripId=await bookQuote({actorId:user.id,quoteId:body.quoteId,
     requestKey:body.requestKey});
    if(!id(tripId))throw Error('Unconfirmed booking');
    const receipt=await reconcileBooking({actorId:user.id,requestKey:body.requestKey});
    if(!bookingReceipt(receipt,user.id,body.requestKey)||receipt.serviceId!==tripId)
      throw Error('Invalid persisted booking receipt');
    return response(201,receipt);
   }
   const rec=await reconcileBooking({actorId:user.id,requestKey:lookup[1]});
   if(rec===null)return response(404,{error:'Unknown or unauthorized booking'});
   if(!bookingReceipt(rec,user.id,lookup[1]))
    throw Error('Invalid persisted reconciliation');
   return response(200,rec);
  }catch{
   // Unknown commit never tells the client to re-POST with a new key.
   return response(409,{error:'G72 transactional state unresolved; reconcile same key'});
  }
 };
}
