import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreG72AutoGateway} from './g72-f1-auto-gateway.mjs';
const actor='72720000-0000-4727-8727-000000000001';
const key='72720000-0000-4727-8727-000000000011';
const prekey='72720000-0000-4727-8727-000000000010';
const quote='72720000-0000-4727-8727-000000000013';
const trip='72720000-0000-4727-8727-000000000014';
const headers={authorization:'Bearer '+'x'.repeat(40)};
const input={method:'POST',path:'/v1/staging/rider/auto/prequote',headers,
 body:{requestKey:prekey,origin:'Panteon, Asuncion',
  destination:'Aeropuerto, Asuncion',service:'economico'}};
const price={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:actor,
 quoteId:quote,requestKey:prekey,fareMode:'AUTO',service:'economico',
 originTag:'PANTEON',destinationTag:'AEROPUERTO',zoneTag:'ASUNCION_FIXTURE',
 amountGs:15200,subtotalGs:15200,commissionGs:1520,providerGs:13680,
 fareVersion:'g72-qa-auto-v1',expiresAt:new Date(1700000300000).toISOString(),
 serverPriced:true,serverPersisted:true,bookingId:null};
const receipt={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:actor,requestKey:key,operation:'rideRequest',
 serviceId:trip,revision:1,serverPersisted:true,status:'ACCEPTED_QA'};
function build(options={}){
 const calls=[];
 const h=createQoreG72AutoGateway({
  projectRef:'staging1234567890abcd',
  verifyAccessToken:async()=>({id:actor,is_anonymous:false,
   email_confirmed_at:'2026-10-24T00:00:00Z'}),
  authorizePassenger:async()=>true,allowRequest:()=>true,now:()=>1700000000000,
  resolveVerifiedRoute:async x=>{
   calls.push(['route',x]);
   return {routingVerified:true,trafficAware:true,fallbackUsed:false,
    originTag:'PANTEON',destinationTag:'AEROPUERTO',zoneTag:'ASUNCION_FIXTURE',
    distanceMeters:5000,durationSeconds:600,tollsPyg:0};
  },
  prequoteFare:async x=>{calls.push(['prequote',x]);return quote;},
  loadQuote:async()=>price,bookQuote:async x=>{calls.push(['book',x]);return trip;},
  reconcileBooking:async x=>{calls.push(['reconcile',x]);return receipt;},
  ...options
 });
 return {h,calls};
}
test('F1 explicit route->price->accepted booking->GET shares one SQL receipt',async()=>{
 const {h,calls}=build();
 const q=await h(input);
 assert.equal(q.status,201);assert.equal(q.body.amountGs,15200);
 assert.equal(calls[1][1].distanceMeters,5000);
 assert.equal(await h({method:'POST',path:'/v1/staging/rider/auto/book',
  headers,body:{quoteId:quote,requestKey:key,accepted:true}}).then(x=>x.status),201);
 const ack=await h({method:'GET',path:'/v1/staging/rider/auto/bookings/'+key,headers});
 assert.equal(ack.status,200);assert.deepEqual(ack.body,receipt);
});
test('no accepted:true, injected money, route fallback or arbitrary owner',async()=>{
 const {h}=build({resolveVerifiedRoute:async()=>({routingVerified:false})});
 assert.equal((await h(input)).status,409);
 for(const body of [{quoteId:quote,requestKey:key,accepted:false},
  {quoteId:quote,requestKey:key,accepted:true,amountGs:1}]){
  assert.equal((await h({method:'POST',path:'/v1/staging/rider/auto/book',headers,body})).status,400);
 }
 assert.equal((await h({...input,body:{...input.body,ownerId:actor}})).status,400);
});
test('private reconciliation and malformed, foreign or missing receipts fail closed',async()=>{
 const {h}=build({reconcileBooking:async()=>null});
 assert.equal((await h({method:'GET',path:'/v1/staging/rider/auto/bookings/'+key,headers})).status,404);
 const f=build({reconcileBooking:async()=>({...receipt,ownerId:quote})});
 assert.equal((await f.h({method:'GET',path:'/v1/staging/rider/auto/bookings/'+key,headers})).status,409);
 const no=build({authorizePassenger:async()=>false});
 assert.equal((await no.h(input)).status,403);
 assert.equal((await no.h({...input,headers:{}})).status,401);
});
test('provider absent makes prequote fail closed and never creates trip',async()=>{
 let called=false;
 const {h}=build({resolveVerifiedRoute:async()=>{throw Error('route unavailable');},
  prequoteFare:async()=>{called=true;return quote;}});
 assert.equal((await h(input)).status,409);
 assert.equal(called,false);
});
