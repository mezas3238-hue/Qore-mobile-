import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createG101MotoPassengerGateway,
 createG101MotoPassengerRepository} from './g101-moto-passenger-gateway.mjs';
import {createQoreRadarLoopbackTransport,
 listenQoreRadarLoopback} from './g4-loopback-http-transport.mjs';
const u='10110000-0000-4101-8101-000000000001';
const foreign='10110000-0000-4101-8101-000000000002';
const routeKey='10110000-0000-4101-8101-000000000010';
const quoteId='10110000-0000-4101-8101-000000000011';
const bookingKey='10110000-0000-4101-8101-000000000012';
const decision='10110000-0000-4101-8101-000000000013';
const trip='10110000-0000-4101-8101-000000000014';
const campaign='10110000-0000-4101-8101-000000000015';
const cancelEvent='10110000-0000-4101-8101-000000000016';
const at=1900000000000;
const prefix='/v1/staging/rider/moto';
const token='x'.repeat(40);
const headers={authorization:'Bearer '+token};
const pricing={
 amountGs:11000,customerPaysGs:9900,customerSubsidyGs:1100,
 driverReceivesGs:9680,platformRetainsGs:220,
 commissionBps:1200,subsidyBps:1000
};
const q={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:u,
 serviceKind:'MOTO_RIDE',service:'moto_pasajero',quoteId,quoteRequestKey:routeKey,
 campaignId:campaign,currency:'PYG',...pricing,expiresAt:at+120000,
 driverAssigned:false,pspCollected:false,serverPersisted:true};
const b={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:u,
 serviceKind:'MOTO_RIDE',service:'moto_pasajero',bookingKey,
 quoteId,tripId:trip,tripState:'searching',tripRevision:1,
 cancellationKey:null,cancellationEventId:null,currency:'PYG',...pricing,
 financialState:'RESERVED_QA',reversalEntriesBalanced:false,
 driverAssigned:false,pspCollected:false,pspRefunded:false,serverPersisted:true};
const cb={...b,tripState:'cancelled',tripRevision:2,cancellationKey:decision,
 cancellationEventId:cancelEvent,financialState:'VOIDED_QA',
 reversalEntriesBalanced:true};
const quoteRequest={method:'POST',path:prefix+'/quotes',
 headers,body:{requestKey:routeKey,origin:'Centro de Asunción',
 destination:'Aeropuerto de Asunción'}};
const bookRequest={method:'POST',path:prefix+'/book',headers,
 body:{requestKey:bookingKey,quoteId,accepted:true}};
const cancelRequest={method:'POST',
 path:prefix+'/bookings/'+bookingKey+'/cancel',headers,
 body:{requestKey:decision,confirmed:true}};
const readRequest={method:'GET',
 path:prefix+'/bookings/'+bookingKey,headers};
function fixture(other={}){
 const calls=[],state={current:b};
 const repo={
  quote:async arg=>{calls.push(['quote',arg]);return q;},
  book:async arg=>{calls.push(['book',arg]);return b;},
  booking:async arg=>{calls.push(['booking',arg]);return state.current;},
  cancel:async arg=>{calls.push(['cancel',arg]);state.current=cb;return cb;}
 };
 const h=createG101MotoPassengerGateway({
  projectRef:'staging1234567890abcd',
  now:()=>at,
  verifyAccessToken:async x=>{
   if(x!==token)throw Error('Unverified Passenger');
   return {id:u,is_anonymous:false,email_confirmed_at:'2026-10-25T00:00:00Z'};
  },
  authorizePassenger:async()=>true,
  allowRequest:()=>true,
  resolveVerifiedMotoRoute:async params=>{
   calls.push(['route',params]);
   return {routingVerified:true,coverageVerified:true,
    trafficAware:true,fallbackUsed:false,originTag:'CENTRO_FIXTURE',
    destinationTag:'AEROPUERTO',zoneTag:'MOTO_TEST_ZONE',
    distanceMeters:5000,durationSeconds:600,tollsPyg:0};
  },
  repository:repo,...other
 });
 return {h,calls,state};
}
test('G101 MOTO Passenger quote->book->replay->cancel->lost ACK from same trip',async()=>{
 const f=fixture();
 assert.deepEqual(await f.h(quoteRequest),{status:200,body:q});
 assert.deepEqual(f.calls[0],[ 'route',{actorId:u,quoteRequestKey:routeKey,service:'moto_pasajero',
  origin:quoteRequest.body.origin,destination:quoteRequest.body.destination} ]);
 assert.equal(f.calls[1][1].route.zoneTag,'MOTO_TEST_ZONE');
 assert.deepEqual(await f.h(bookRequest),{status:201,body:b});
 assert.deepEqual(await f.h(readRequest),{status:200,body:b});
 assert.equal((await f.h({...readRequest,
  path:prefix+'/bookings/'+bookingKey+'/cancellation'})).status,404);
 assert.deepEqual(await f.h(cancelRequest),{status:200,body:cb});
 assert.deepEqual(await f.h({...readRequest,path:readRequest.path+'/cancellation'}),
  {status:200,body:cb});
 assert.deepEqual(await f.h(readRequest),{status:200,body:cb});
 assert.equal(f.calls.filter(([k])=>k==='cancel').length,1);
});
test('G101 rejects user-defined MOTO prices, DriverId, AUTO or delivery substitution',async()=>{
 const f=fixture();
 for(const body of [
  {...quoteRequest.body,priceGs:1},
  {...quoteRequest.body,service:'moto_envio'},
  {...quoteRequest.body,driverId:trip},
  {...quoteRequest.body,requestKey:'not-a-uuid'},
  {...quoteRequest.body,origin:'Centro',destination:'centro'},
  null,
 ]){
  assert.equal((await f.h({...quoteRequest,body})).status,400);
 }
 for(const body of [
  {...bookRequest.body,accepted:false},
  {...bookRequest.body,amountGs:100},
  {...bookRequest.body,driverId:trip},
  {...bookRequest.body,service:'economico'}
 ]){
  assert.equal((await f.h({...bookRequest,body})).status,400);
 }
 for(const body of [
  {...cancelRequest.body,confirmed:false},
  {...cancelRequest.body,refundGs:500},
  {...cancelRequest.body,driverId:trip}
 ])assert.equal((await f.h({...cancelRequest,body})).status,400);
 assert.equal((await f.h({...readRequest,body:{x:1}})).status,400);
 assert.equal(f.calls.length,0);
});
test('G101 blocks spoofed financial percentages, Driver association and non-MOTO service',async()=>{
 for(const replacement of [
  {commissionBps:1500},{subsidyBps:900},{customerPaysGs:10000},
  {platformRetainsGs:500},{driverReceivesGs:10000},
  {serviceKind:'AUTO_RIDE'},{service:'economico'},
  {driverAssigned:true},{pspCollected:true},{commercialEnabled:true},
  {ownerId:foreign},{extra:'secret'}
 ]){
  const f=fixture({repository:{
   quote:async()=>({...q,...replacement}),book:async()=>b,
   booking:async()=>b,cancel:async()=>cb
  }});
  assert.equal((await f.h(quoteRequest)).status,409,JSON.stringify(replacement));
 }
 for(const patch of [
  {tripState:'accepted'},{driverAssigned:true},{pspRefunded:true},
  {financialState:'PAID'},{tripRevision:3},{ownerId:foreign},
  {serviceKind:'MOTO_DELIVERY'},{extra:1}
 ]){
  assert.equal((await fixture({repository:{
   quote:async()=>q,book:async()=>({...b,...patch}),
   booking:async()=>b,cancel:async()=>cb
  }}).h(bookRequest)).status,409,JSON.stringify(patch));
 }
});
test('G137 an unpriced MOTO toll cannot enter the passenger ledger',async()=>{
 for(const tollsPyg of [undefined,100]){
  const f=fixture({resolveVerifiedMotoRoute:async()=>({
   routingVerified:true,coverageVerified:true,trafficAware:true,
   fallbackUsed:false,originTag:'CENTRO_FIXTURE',destinationTag:'AEROPUERTO',
   zoneTag:'MOTO_TEST_ZONE',distanceMeters:5000,durationSeconds:600,
   tollsPyg
  })});
  assert.equal((await f.h(quoteRequest)).status,409);
  assert.equal(f.calls.length,0,'No SQL quote without zero-toll proof');
 }
});
test('G101 fail-closed on absent independent MOTO road authority and missing SQL',async()=>{
 assert.equal((await fixture({resolveVerifiedMotoRoute:async()=>null}).h(quoteRequest)).status,409);
 assert.equal((await fixture({resolveVerifiedMotoRoute:async()=>{throw Error('MAP_SECRET');}}).h(quoteRequest)).status,503);
 assert.equal((await fixture({repository:{
  quote:async()=>{throw Error('DB_PASSWORD');},
  book:async()=>b,booking:async()=>b,cancel:async()=>cb
 }}).h(quoteRequest)).status,503);
 assert.equal((await fixture({repository:{
  quote:async()=>q,book:async()=>b,booking:async()=>null,cancel:async()=>cb
 }}).h(readRequest)).status,404);
 assert.equal((await fixture({authorizePassenger:async()=>false}).h(bookRequest)).status,403);
 assert.equal((await fixture({allowRequest:()=>false}).h(bookRequest)).status,429);
 assert.equal((await fixture().h({...bookRequest,headers:{}})).status,401);
});
test('G101 SQL repository calls only authorized private MOTO RPCs',async()=>{
 const names=[];
 const repo=createG101MotoPassengerRepository({
  rpc:async(name,params)=>{names.push({name,params});return {data:q,error:null};}
 });
 const trusted={originTag:'CENTRO_FIXTURE',destinationTag:'AEROPUERTO',
  zoneTag:'MOTO_TEST_ZONE',distanceMeters:5000,durationSeconds:600,tollsPyg:0};
 assert.deepEqual(await repo.quote({actorId:u,requestKey:routeKey,route:trusted}),q);
 await repo.book({actorId:u,requestKey:bookingKey,quoteId});
 await repo.booking({actorId:u,bookingKey});
 await repo.cancel({actorId:u,bookingKey,requestKey:decision});
 assert.deepEqual(names.map(x=>x.name),[
  'mobility_stage_g100_moto_quote_qa',
  'mobility_stage_g100_moto_book_qa',
  'mobility_stage_g100_moto_booking_receipt_qa',
  'mobility_stage_g100_moto_cancel_qa'
 ]);
 assert.deepEqual(names[0].params,{
  _passenger:u,_request:routeKey,_origin:'CENTRO_FIXTURE',
  _destination:'AEROPUERTO',_zone:'MOTO_TEST_ZONE',
  _distance:5000,_seconds:600});
 assert.throws(()=>repo.book({actorId:'bad',requestKey:bookingKey,quoteId}));
 assert.throws(()=>repo.quote({actorId:u,requestKey:routeKey,route:{
  ...trusted,originTag:'moto bypass'}}));
});
test('G101 real 127.0.0.1 HTTP router: MOTO is not confused with AUTO',async t=>{
 const {h}=fixture();
 const noop=async()=>({status:404,body:{error:'Not found'}});
 const server=createQoreRadarLoopbackTransport({
  riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
  deliveryHandler:noop,merchantHandler:noop,financeHandler:noop,
  safetyHandler:noop,merchantManagementHandler:noop,deliveryOfferHandler:noop,
  motoHandler:h
 });
 t.after(()=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve())));
 const base=await listenQoreRadarLoopback(server);
 const send=async(path,{method='GET',body,headers:extra={}}={})=>{
  const resp=await fetch(base+path,{method,headers:{...headers,
   ...(body===undefined?{}:{'content-type':'application/json'}),...extra},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:resp.status,data:await resp.json()};
 };
 assert.equal((await send(prefix+'/quotes',{
  method:'POST',body:quoteRequest.body})).status,200);
 assert.equal((await send(prefix+'/book',{
  method:'POST',body:bookRequest.body})).status,201);
 assert.equal((await send(prefix+'/bookings/'+bookingKey)).status,200);
 assert.equal((await send(prefix+'/bookings/'+bookingKey+'/cancel',{
  method:'POST',body:cancelRequest.body})).status,200);
 assert.equal((await send(prefix+'/bookings/'+bookingKey+'/cancellation')).data.financialState,'VOIDED_QA');
 assert.equal((await send(prefix+'/bookings/'+bookingKey+'?evil=1')).status,404);
 assert.equal((await send(prefix+'/quotes',{method:'POST',body:quoteRequest.body,
  headers:{origin:'https://evil.example'}})).status,403);
 assert.equal((await send('/v1/staging/rider/auto/bookings/'+bookingKey)).status,503);
});

test('G101 OpenAPI documents exact MOTO Passenger routes, isolated pricing and NO LIVE',()=>{
 const spec=JSON.parse(readFileSync(new URL('../docs/backend/openapi/movete-facil-staging.openapi.json',import.meta.url)));
 assert.match(spec.info.version,/^1\.0\.0-g\d+$/);
 assert.ok(Number(spec.info.version.split('-g')[1])>=101);
 for(const pathname of [
  '/v1/staging/rider/moto/quotes',
  '/v1/staging/rider/moto/book',
  '/v1/staging/rider/moto/bookings/{bookingKey}',
  '/v1/staging/rider/moto/bookings/{bookingKey}/cancel',
  '/v1/staging/rider/moto/bookings/{bookingKey}/cancellation'
 ]){
  const op=Object.values(spec.paths[pathname])[0];
  assert.equal(op['x-qore-runtime-wired'],false);
  assert.equal(op['x-qore-loopback-wired'],true);
  assert.equal(op['x-qore-external-staging-certified'],false);
  assert.deepEqual(op.security,[{BearerAuth:[]}]);
 }
 const q=spec.components.schemas.G101MotoQuote;
 const b=spec.components.schemas.G101MotoBooking;
 assert.equal(q.properties.commissionBps.const,1200);
 assert.equal(q.properties.subsidyBps.const,1000);
 assert.equal(q.properties.serviceKind.const,'MOTO_RIDE');
 assert.equal(b.properties.service.const,'moto_pasajero');
 assert.equal(b.properties.pspRefunded.const,false);
 assert.equal(b.properties.driverAssigned.const,false);
 for(const forbidden of ['driverId','deliveryId','acceptedDriver','commissionOverrideBps'])
  assert.equal(q.properties[forbidden],undefined);
});
