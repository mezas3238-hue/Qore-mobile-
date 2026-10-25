/**
 * G101: MOTO_RIDE Passenger-only HTTP contract. Separate from AUTO and
 * DELIVERY; no Driver acceptance, user-supplied price or PSP. Loopback QA.
 * SQL G100 is the price/accounting authority (12% nominal commission,
 * fixed 10%-of-original-fare Customer subsidy, 2% platform remainder).
 */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const id=x=>typeof x==='string'&&UUID.test(x);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,fields)=>plain(x)&&Object.keys(x).length===fields.length&&
 fields.every(k=>Object.hasOwn(x,k));
const tag=x=>typeof x==='string'&&/^[A-Z_]{3,40}$/.test(x);
const safeText=x=>typeof x==='string'&&x.trim()===x&&x.length>=3&&
 x.length<=120&&!/[\u0000-\u001f]/.test(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0&&x<=100000000;
const response=(status,body)=>({status,body});
const QUOTE='/v1/staging/rider/moto/quotes';
const BOOK='/v1/staging/rider/moto/book';
const BOOKING=/^\/v1\/staging\/rider\/moto\/bookings\/([0-9a-f-]{36})$/i;
const CANCEL=/^\/v1\/staging\/rider\/moto\/bookings\/([0-9a-f-]{36})\/cancel$/i;
const CANCEL_READ=/^\/v1\/staging\/rider\/moto\/bookings\/([0-9a-f-]{36})\/cancellation$/i;
const QUOTE_FIELDS=['mode','commercialEnabled','ownerId','serviceKind',
 'service','quoteId','quoteRequestKey','campaignId','currency','amountGs',
 'commissionBps','subsidyBps','customerPaysGs','customerSubsidyGs',
 'driverReceivesGs','platformRetainsGs','expiresAt','driverAssigned',
 'pspCollected','serverPersisted'];
const TRIP_FIELDS=['mode','commercialEnabled','ownerId','serviceKind',
 'service','bookingKey','quoteId','tripId','tripState','tripRevision',
 'cancellationKey','cancellationEventId','currency','amountGs',
 'customerPaysGs','customerSubsidyGs','driverReceivesGs','platformRetainsGs',
 'commissionBps','subsidyBps','financialState','reversalEntriesBalanced',
 'driverAssigned','pspCollected','pspRefunded','serverPersisted'];
function money(x){
 if(!plain(x)||!integer(x.amountGs)||x.amountGs<=0||
 !integer(x.customerPaysGs)||!integer(x.customerSubsidyGs)||
 !integer(x.driverReceivesGs)||!integer(x.platformRetainsGs)||
 x.commissionBps!==1200||x.subsidyBps!==1000||
 x.customerSubsidyGs!==Math.floor((x.amountGs*1000+5000)/10000)||
 x.driverReceivesGs!==x.amountGs-Math.floor((x.amountGs*1200+5000)/10000)||
 x.platformRetainsGs!==Math.floor((x.amountGs*1200+5000)/10000)-
  x.customerSubsidyGs||
 x.customerPaysGs!==x.amountGs-x.customerSubsidyGs||
 x.customerPaysGs!==x.driverReceivesGs+x.platformRetainsGs)
 return false;
 return true;
}
const invariant=(x,owner)=>plain(x)&&x.mode==='STAGING_DEMO_ONLY'&&
 x.commercialEnabled===false&&x.ownerId===owner&&
 x.serviceKind==='MOTO_RIDE'&&x.service==='moto_pasajero'&&
 x.currency==='PYG'&&x.driverAssigned===false&&x.pspCollected===false&&
 x.serverPersisted===true&&money(x);
const validQuote=(x,owner,requestKey,at)=>exact(x,QUOTE_FIELDS)&&
 invariant(x,owner)&&id(x.quoteId)&&id(x.campaignId)&&
 x.quoteRequestKey===requestKey&&Number.isSafeInteger(x.expiresAt)&&
 x.expiresAt>at&&x.expiresAt<=at+300000;
const validTrip=(x,owner,bookingKey,decisionKey=null)=>exact(x,TRIP_FIELDS)&&
 invariant(x,owner)&&x.bookingKey===bookingKey&&
 id(x.quoteId)&&id(x.tripId)&&
 ['searching','cancelled'].includes(x.tripState)&&
 x.tripRevision===(x.tripState==='searching'?1:2)&&
 x.pspRefunded===false&&
 x.financialState===(x.tripState==='searching'?'RESERVED_QA':'VOIDED_QA')&&
 x.reversalEntriesBalanced===(x.tripState==='cancelled')&&
 (x.tripState==='searching'
  ? x.cancellationKey===null&&x.cancellationEventId===null
  : id(x.cancellationKey)&&id(x.cancellationEventId))&&
 (decisionKey===null||x.cancellationKey===decisionKey);
const headerToken=h=>{
 const v=h?.authorization;
 if(typeof v!=='string'||h?.Authorization!==undefined||
  h?.cookie!==undefined)return null;
 return /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(v)?.[1]??null;
};
const validUser=u=>plain(u)&&id(u.id)&&u.is_anonymous===false&&
 (typeof u.email_confirmed_at==='string'||typeof u.phone_confirmed_at==='string');

export function createG101MotoPassengerRepository(client){
 if(!client||typeof client.rpc!=='function')
  throw Error('Private server-side G100 RPC adapter required');
 const rpc=async(name,args)=>{
  const {data,error}=await client.rpc(name,args);
  if(error)throw Error('G100 private SQL unavailable');
  return data;
 };
 return Object.freeze({
  quote:({actorId,requestKey,route})=>{
   if(!id(actorId)||!id(requestKey)||!plain(route)||!tag(route.originTag)||
    !tag(route.destinationTag)||!tag(route.zoneTag)||
    !integer(route.distanceMeters)||!integer(route.durationSeconds))
    throw Error('Invalid trusted MOTO route');
   return rpc('mobility_stage_g100_moto_quote_qa',{
    _passenger:actorId,_request:requestKey,
    _origin:route.originTag,_destination:route.destinationTag,
    _zone:route.zoneTag,_distance:route.distanceMeters,
    _seconds:route.durationSeconds});
  },
  book:({actorId,requestKey,quoteId})=>{
   if(!id(actorId)||!id(requestKey)||!id(quoteId))
    throw Error('Invalid MOTO booked quote');
   return rpc('mobility_stage_g100_moto_book_qa',{
    _passenger:actorId,_quote:quoteId,_booking:requestKey});
  },
  booking:({actorId,bookingKey})=>{
   if(!id(actorId)||!id(bookingKey))
    throw Error('Invalid MOTO Passenger booking owner');
   return rpc('mobility_stage_g100_moto_booking_receipt_qa',{
    _passenger:actorId,_booking:bookingKey});
  },
  cancel:({actorId,bookingKey,requestKey})=>{
   if(!id(actorId)||!id(bookingKey)||!id(requestKey))
    throw Error('Invalid MOTO Passenger cancellation');
   return rpc('mobility_stage_g100_moto_cancel_qa',{
    _passenger:actorId,_booking:bookingKey,_decision:requestKey});
  }
 });
}

export function createG101MotoPassengerGateway({
 projectRef,verifyAccessToken,authorizePassenger,allowRequest,
 resolveVerifiedMotoRoute,repository,now=Date.now
}={}){
 assertStagingRef(projectRef);
 if([verifyAccessToken,authorizePassenger,allowRequest,resolveVerifiedMotoRoute,now]
 .some(fn=>typeof fn!=='function')||
 !repository||['quote','book','booking','cancel']
 .some(k=>typeof repository[k]!=='function'))
 throw Error('G101 requires independently verified MOTO route and private SQL');
 return async({method,path,headers={},body}={})=>{
  const quote=method==='POST'&&path===QUOTE;
  const book=method==='POST'&&path===BOOK;
  const cancel=method==='POST'&&typeof path==='string'?CANCEL.exec(path):null;
  const get=method==='GET'&&typeof path==='string'?BOOKING.exec(path):null;
  const recover=method==='GET'&&typeof path==='string'?CANCEL_READ.exec(path):null;
  if(!quote&&!book&&!cancel&&!get&&!recover)
   return response(404,{error:'MOTO Passenger route unavailable'});
  if((get||recover)&&(body!==undefined&&body!==null))
   return response(400,{error:'GET body forbidden'});
  if(quote&&(!exact(body,['requestKey','origin','destination'])||
   !id(body.requestKey)||!safeText(body.origin)||!safeText(body.destination)||
   body.origin.toLowerCase()===body.destination.toLowerCase()))
   return response(400,{error:'Invalid MOTO origin or destination'});
  if(book&&(!exact(body,['requestKey','quoteId','accepted'])||
   !id(body.requestKey)||!id(body.quoteId)||body.accepted!==true))
   return response(400,{error:'Explicit quoted MOTO price consent required'});
  if(cancel&&(!id(cancel[1])||
   !exact(body,['requestKey','confirmed'])||!id(body.requestKey)||
   body.confirmed!==true))
   return response(400,{error:'Explicit MOTO cancellation required'});
  if((get&&!id(get[1]))||(recover&&!id(recover[1])))
   return response(400,{error:'Invalid booked MOTO reference'});
  const t=headerToken(headers);
  if(!t)return response(401,{error:'Verified Passenger token required'});
  let u;
  try{u=await verifyAccessToken(t);}catch{return response(401,{error:'Passenger session unavailable'});}
  if(!validUser(u))return response(401,{error:'Confirmed Passenger required'});
  try{if(await authorizePassenger(u.id)!==true)
   return response(403,{error:'Passenger role required'});}
  catch{return response(503,{error:'Passenger authority unavailable'});}
  try{if(allowRequest({userId:u.id,operation:'g101_moto_passenger'})!==true)
   return response(429,{error:'MOTO request rate limited'});}
  catch{return response(503,{error:'MOTO limiter unavailable'});}
  try{
   if(quote){
    let r;
    try{r=await resolveVerifiedMotoRoute({
     actorId:u.id,service:'moto_pasajero',
     origin:body.origin,destination:body.destination});}
    catch{return response(503,{error:'Independent MOTO route provider unavailable'});}
    if(!plain(r)||r.routingVerified!==true||r.coverageVerified!==true||
     r.trafficAware!==true||r.fallbackUsed!==false||
     !tag(r.originTag)||!tag(r.destinationTag)||!tag(r.zoneTag)||
     r.originTag===r.destinationTag||
     !integer(r.distanceMeters)||r.distanceMeters>500000||
     !integer(r.durationSeconds)||r.durationSeconds>86400)
     return response(409,{error:'MOTO route evidence unavailable'});
    const out=await repository.quote({actorId:u.id,requestKey:body.requestKey,route:r});
    if(!validQuote(out,u.id,body.requestKey,now()))
     return response(409,{error:'MOTO quote unverified'});
    return response(200,out);
   }
   if(book){
    const out=await repository.book({actorId:u.id,requestKey:body.requestKey,
     quoteId:body.quoteId});
    if(!validTrip(out,u.id,body.requestKey)||out.quoteId!==body.quoteId||
     out.tripState!=='searching')
     return response(409,{error:'MOTO booking not reconciled'});
    return response(201,out);
   }
   if(cancel){
    const out=await repository.cancel({actorId:u.id,bookingKey:cancel[1],
     requestKey:body.requestKey});
    if(!validTrip(out,u.id,cancel[1],body.requestKey)||
     out.tripState!=='cancelled')
     return response(409,{error:'MOTO cancellation not reconciled'});
    return response(200,out);
   }
   const key=(get??recover)[1];
   const out=await repository.booking({actorId:u.id,bookingKey:key});
   if(out===null)return response(404,{error:'Unknown or foreign MOTO booking'});
   if(!validTrip(out,u.id,key))
    return response(409,{error:'MOTO saved state unverified'});
   if(recover&&out.tripState!=='cancelled')
    return response(404,{error:'No committed MOTO cancellation'});
   return response(200,out);
  }catch{return response(503,{error:'MOTO private SQL unavailable; reconcile read-only booking'});}
 };
}
