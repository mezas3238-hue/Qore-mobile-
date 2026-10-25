/**
 * G74 F1 server contract chain. One synthetic state authority backs both G73
 * booking and G4 passenger status. SQL G74 separately proves the same chain
 * against REAL disposable PG16 with RLS. No map key, driver, phone or LIVE.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreG73AutoGateway} from './g73-f1-auto-gateway.mjs';
import {createQoreRiderStatusGateway} from './g4-rider-status-gateway.mjs';
const id=n=>'74740000-0000-4747-8747-'+String(n).padStart(12,'0');
const passenger=id(1),outsider=id(2),routeId=id(3),quoteId=id(4),
 tripId=id(5),rKey=id(6),qKey=id(7),bKey=id(8);
const CLOCK=1800000000000;
const login=u=>'verified-qa-session-'+u.replaceAll('-','');
const headers=u=>({authorization:'Bearer '+login(u)});
function fixture({quoteExpiresAt=CLOCK+120000}={}){
 const state={trip:null,books:0,prices:0,routeCalls:0};
 const user=async token=>{
  const identity=[passenger,outsider].find(x=>login(x)===token);
  if(!identity)throw Error('Invalid actor');
  return {id:identity,email_confirmed_at:'2026-10-24T10:00:00Z',
   is_anonymous:false};
 };
 const role=async u=>u===passenger||u===outsider;
 const g73=createQoreG73AutoGateway({
  projectRef:'staging1234567890abcd',verifyAccessToken:user,
  authorizePassenger:role,allowRequest:()=>true,now:()=>CLOCK,
  resolveVerifiedRoute:async()=>{
   state.routeCalls++;
   return {routingVerified:true,coverageVerified:true,trafficAware:true,
    fallbackUsed:false,originTag:'CENTRO_FIXTURE',
    destinationTag:'AEROPUERTO',zoneTag:'ASUNCION_FIXTURE',
    distanceMeters:5000,durationSeconds:600,tollsPyg:0};
  },
  registerRoute:async p=>{
   assert.equal(p.actorId,passenger);assert.equal(p.requestKey,rKey);
   return routeId;
  },
  loadRoute:async()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
   ownerId:passenger,routeId,requestKey:rKey,service:'economico',
   routingVerified:true,expiresAt:CLOCK+240000}),
  quoteRoute:async p=>{
   assert.equal(p.actorId,passenger);assert.equal(p.routeId,routeId);
   assert.equal(p.requestKey,qKey);state.prices++;return quoteId;
  },
  loadQuote:async()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
   ownerId:passenger,routeId,quoteId,quoteRequestKey:qKey,
   fareMode:'AUTO',service:'economico',currency:'PYG',amountGs:15200,
   fareVersion:'qa-g73-f1',expiresAt:quoteExpiresAt,serverPriced:true,
   routingVerified:true,status:'QUOTED_QA'}),
  bookQuote:async p=>{
   if(p.actorId!==passenger||p.quoteId!==quoteId||p.requestKey!==bKey||
    quoteExpiresAt<=CLOCK)throw Error('Unauthorized or expired booking');
   if(!state.trip){
    state.books++;
    state.trip={id:tripId,passengerId:passenger,driverId:null,
     vehicleId:null,status:'searching',revision:1,trackingSequence:0};
   }
   return state.trip.id;
  },
  reconcileBooking:async p=>{
   if(p.actorId!==passenger||p.requestKey!==bKey||!state.trip)return null;
   return {mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
    ownerId:passenger,requestKey:bKey,quoteId,routeId,
    tripId:state.trip.id,revision:state.trip.revision,
    serverPersisted:true,status:'ACCEPTED_QA'};
  }
 });
 const rider=createQoreRiderStatusGateway({
  projectRef:'staging1234567890abcd',verifyAccessToken:user,
  authorizePassenger:role,allowRequest:()=>true,now:()=>CLOCK,
  loadOwnTrip:async({tripId:requested,passengerId:owner})=>
   state.trip?.id===requested&&state.trip?.passengerId===owner?state.trip:null,
  loadArrivalEvidence:async()=>{throw Error('No driver assigned or fake GPS');}
 });
 return {state,g73,rider};
}
const routeRequest=()=>({method:'POST',path:'/v1/staging/rider/auto/routes',
 headers:headers(passenger),
 body:{quoteRequestKey:rKey,origin:'Centro, Asunción',
  destination:'Aeropuerto, Asunción',service:'economico'}});
const quoteRequest=()=>({method:'POST',path:'/v1/staging/rider/auto/prequote',
 headers:headers(passenger),body:{requestKey:qKey,routeId}});
const bookRequest=()=>({method:'POST',path:'/v1/staging/rider/auto/book',
 headers:headers(passenger),body:{requestKey:bKey,quoteId,accepted:true}});
const bookingRead=who=>({method:'GET',path:'/v1/staging/rider/auto/bookings/'+bKey,
 headers:headers(who)});
const statusRead=who=>({method:'GET',path:'/v1/staging/rider/trips/'+tripId+'/status',
 headers:headers(who)});
test('G74 F1 route -> one prequote -> booking -> SAME G4 Passenger searching state',async()=>{
 const f=fixture();
 assert.equal((await f.rider(statusRead(passenger))).status,404,
  'status cannot exist before server persisted booking');
 const r=await f.g73(routeRequest());assert.equal(r.status,200);
 assert.equal(r.body.ownerId,passenger);
 const q=await f.g73(quoteRequest());assert.equal(q.status,200);
 assert.equal(q.body.amountGs,15200);
 const b=await f.g73(bookRequest());assert.equal(b.status,201);
 assert.equal(b.body.tripId,tripId);assert.equal(b.body.routeId,routeId);
 assert.equal(b.body.quoteId,quoteId);assert.equal(f.state.books,1);
 const status=await f.rider(statusRead(passenger));
 assert.equal(status.status,200);
 assert.deepEqual(Object.keys(status.body).sort(),[
  'tripId','ownerId','revision','state','assignmentPersisted',
  'driver','vehicle','gpsConsent','location','etaVerified','etaMinutes',
  'mode','commercialRidesEnabled','event','locationVisible','deliveryConfirmed'
 ].sort());
 assert.equal(status.body.state,'searching');assert.equal(status.body.revision,1);
 assert.equal(status.body.assignmentPersisted,false);
 assert.equal(status.body.driver,null);assert.equal(status.body.vehicle,null);
 assert.equal(status.body.location,null);assert.equal(status.body.etaMinutes,null);
 assert.equal(status.body.locationVisible,false);
 assert.equal(status.body.event.acceptedDriver,null);
 assert.equal(status.body.event.tracking,null);
 assert.equal(status.body.commercialRidesEnabled,false);
 assert.equal((await f.g73(bookRequest())).body.tripId,tripId);
 assert.equal(f.state.books,1,'replay cannot create second trip');
 assert.equal((await f.g73(bookingRead(passenger))).body.tripId,tripId);
 assert.equal(f.state.prices,1);
});
test('G74 F1 foreign Passenger cannot read own booking nor its G4 status',async()=>{
 const f=fixture();
 await f.g73(routeRequest());await f.g73(quoteRequest());
 await f.g73(bookRequest());
 assert.equal((await f.g73(bookingRead(outsider))).status,404);
 assert.equal((await f.rider(statusRead(outsider))).status,404);
 assert.equal((await f.rider(statusRead(passenger))).status,200);
});
test('G74 F1 no quote, wrong consent or expired quote never yields status',async()=>{
 for(const invalid of [false,true]){
  const f=fixture({quoteExpiresAt:invalid?CLOCK-1:CLOCK+120000});
  await f.g73(routeRequest());
  if(invalid)await f.g73(quoteRequest());
  const bad=await f.g73(bookRequest());
  assert.equal(bad.status,409);
  assert.equal(f.state.trip,null);
  assert.equal((await f.rider(statusRead(passenger))).status,404);
 }
 const f=fixture();
 await f.g73(routeRequest());await f.g73(quoteRequest());
 const wrong=await f.g73({...bookRequest(),body:{
  requestKey:bKey,quoteId,accepted:false}});
 assert.equal(wrong.status,400);
 assert.equal(f.state.trip,null);
});
