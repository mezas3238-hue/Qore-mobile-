import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreG73AutoGateway} from './g73-f1-auto-gateway.mjs';
const actor='73730000-0000-4737-8737-000000000001';
const stranger='73730000-0000-4737-8737-000000000009';
const routeKey='73730000-0000-4737-8737-000000000010';
const routeId='73730000-0000-4737-8737-000000000014';
const quoteKey='73730000-0000-4737-8737-000000000011';
const quoteId='73730000-0000-4737-8737-000000000015';
const bookKey='73730000-0000-4737-8737-000000000012';
const tripId='73730000-0000-4737-8737-000000000016';
const time=1900000000000;
const headers={authorization:'Bearer '+ 'x'.repeat(40)};
const route={routeId,ownerId:actor,quoteRequestKey:routeKey,
 origin:'Panteón',destination:'Aeropuerto',service:'economico',
 routingVerified:true,coverageVerified:true,expiresAt:time+300000,
 source:'SERVER_VERIFIED_ROUTE',status:'ROUTE_VERIFIED_QA'};
const backendRoute={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:actor,routeId,requestKey:routeKey,service:'economico',routingVerified:true,
 expiresAt:time+300000};
const quote={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:actor,routeId,quoteId,quoteRequestKey:quoteKey,
 fareMode:'AUTO',service:'economico',currency:'PYG',amountGs:15200,
 fareVersion:'g72-qa-auto-v1',expiresAt:time+120000,serverPriced:true,
 routingVerified:true,status:'QUOTED_QA'};
const book={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:actor,requestKey:bookKey,quoteId,routeId,tripId,revision:1,
 serverPersisted:true,status:'ACCEPTED_QA'};
const request=(path,body,method='POST')=>({method,path,headers,body});
function fixture(patch={}){
 const calls=[];
 const app=createQoreG73AutoGateway({
  projectRef:'staging1234567890abcd',now:()=>time,
  verifyAccessToken:async()=>({id:actor,is_anonymous:false,email_confirmed_at:'2026-10-24T00:00:00Z'}),
  authorizePassenger:async()=>true,allowRequest:()=>true,
  resolveVerifiedRoute:async x=>{calls.push('routing');return {
   routingVerified:true,coverageVerified:true,trafficAware:true,fallbackUsed:false,
   originTag:'PANTEON',destinationTag:'AEROPUERTO',zoneTag:'ASUNCION_FIXTURE',
   distanceMeters:5000,durationSeconds:600,tollsPyg:0};},
  registerRoute:async x=>{calls.push('route');return routeId;},
  loadRoute:async()=>backendRoute,
  quoteRoute:async x=>{calls.push('quote');return quoteId;},
  loadQuote:async()=>quote,
  bookQuote:async x=>{calls.push('book');return tripId;},
  reconcileBooking:async x=>{calls.push('reconcile');return book;},
  ...patch
 });
 return {app,calls};
}
test('G73 F1 route -> exact B quote -> explicit book -> owner GET reconciles same ride',async()=>{
 const {app,calls}=fixture();
 const a=await app(request('/v1/staging/rider/auto/routes',{
  quoteRequestKey:routeKey,origin:'Panteón',destination:'Aeropuerto',service:'economico'}));
 assert.equal(a.status,200);assert.deepEqual(a.body,route);
 const q=await app(request('/v1/staging/rider/auto/prequote',{
  requestKey:quoteKey,routeId}));
 assert.equal(q.status,200);assert.deepEqual(q.body,quote);
 const b=await app(request('/v1/staging/rider/auto/book',{
  requestKey:bookKey,quoteId,accepted:true}));
 assert.equal(b.status,201);assert.deepEqual(b.body,book);
 const rec=await app(request('/v1/staging/rider/auto/bookings/'+bookKey,null,'GET'));
 assert.equal(rec.status,200);assert.deepEqual(rec.body,book);
 assert.deepEqual(calls,['routing','route','quote','book','reconcile','reconcile']);
});
test('G73 no forged cost, no route fallback, no inactive consent or extra payload',async()=>{
 let calls=0;
 const {app}=fixture({resolveVerifiedRoute:async()=>({routingVerified:false}),
  registerRoute:async()=>{calls++;return routeId;}});
 assert.equal((await app(request('/v1/staging/rider/auto/routes',{
  quoteRequestKey:routeKey,origin:'Panteón',destination:'Aeropuerto',service:'economico'}))).status,409);
 assert.equal(calls,0);
 for(const payload of [
  {quoteRequestKey:routeKey,origin:'Panteón',destination:'Aeropuerto',service:'economico',amountGs:1},
  {quoteRequestKey:routeKey,origin:'Panteón',destination:'Aeropuerto',service:'moto_pasajero'},
  {quoteRequestKey:routeKey,origin:'Panteón',destination:'Panteón',service:'economico'}
 ])assert.equal((await app(request('/v1/staging/rider/auto/routes',payload))).status,400);
 for(const payload of [{requestKey:bookKey,quoteId,accepted:false},
 {requestKey:bookKey,quoteId,accepted:true,priceGs:12000}]){
  assert.equal((await app(request('/v1/staging/rider/auto/book',payload))).status,400);
 }
});
test('G73 foreign receipt, rotated token and malformed quote fail closed',async()=>{
 const other=fixture({loadQuote:async()=>({...quote,ownerId:stranger})});
 assert.equal((await other.app(request('/v1/staging/rider/auto/prequote',{
  requestKey:quoteKey,routeId}))).status,409);
 const rec=fixture({reconcileBooking:async()=>({...book,ownerId:stranger})});
 assert.equal((await rec.app(request('/v1/staging/rider/auto/bookings/'+bookKey,null,'GET'))).status,409);
 const missing=fixture({reconcileBooking:async()=>null});
 assert.equal((await missing.app(request('/v1/staging/rider/auto/bookings/'+bookKey,null,'GET'))).status,404);
 const unauthorized=fixture({authorizePassenger:async()=>false});
 assert.equal((await unauthorized.app(request('/v1/staging/rider/auto/bookings/'+bookKey,null,'GET'))).status,403);
 assert.equal((await unauthorized.app({method:'GET',path:'/v1/staging/rider/auto/bookings/'+bookKey,headers:{}})).status,401);
});
