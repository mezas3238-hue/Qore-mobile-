import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreRiderStatusGateway} from './g4-rider-status-gateway.mjs';
const ref='staging1234567890abcd';
const tripId='11111111-1111-4111-8111-111111111111';
const passenger='22222222-2222-4222-8222-222222222222';
const stranger='33333333-3333-4333-8333-333333333333';
const driver='44444444-4444-4444-8444-444444444444';
const vehicle='55555555-5555-4555-8555-555555555555';
const bearer='a'.repeat(60);
const now=200_000;
const trip={id:tripId,passengerId:passenger,driverId:null,vehicleId:null,
 status:'searching',revision:1,trackingSequence:0};
const profile={driverId:driver,vehicleId:vehicle,
 verifiedForDisplay:true,displayName:'QORE Prueba',vehicleKind:'AUTO',
 vehicleModel:'Toyota Vitz',plate:'TEST999',rating:4.9,color:'gris'};
const gps={lat:-25.28,lng:-57.60,consentGranted:true,available:true,
 capturedAtMs:now-2_000,accuracyMeters:20};
const route={driverId:driver,provider:'VERIFIED_ROAD_ROUTER',
 trafficAware:true,fallbackUsed:false,calculatedAtMs:now-1_000,
 roadMeters:1250,etaSeconds:240};
const request=(headers={authorization:'Bearer '+bearer},body)=>({
 method:'GET',path:'/v1/staging/rider/trips/'+tripId+'/status',
 headers,...(body===undefined?{}:{body})
});
function fixture(overrides={}){
 const observed={};
 const handler=createQoreRiderStatusGateway({
  projectRef:ref,now:()=>now,
  verifyAccessToken:async token=>{observed.jwt=token;return {
   id:passenger,email_confirmed_at:'2026-10-17T10:00:00Z',is_anonymous:false}},
  authorizePassenger:async id=>{observed.roleActor=id;return true},
  allowRequest:()=>true,
  loadOwnTrip:async params=>{observed.query=params;return trip},
  loadArrivalEvidence:async params=>{observed.evidence=params;return {
   driverProfile:profile,location:gps,route
  }},
  ...overrides
 });
 return {handler,observed};
}
const accepted={...trip,driverId:driver,vehicleId:vehicle,
 status:'accepted',revision:2,trackingSequence:1};
test('searching: never calls GPS loader or publishes available driver identity',async()=>{
 let calls=0;
 const {handler,observed}=fixture({loadArrivalEvidence:async()=>{calls++;throw Error('private')}});
 const result=await handler(request());
 assert.equal(result.status,200);
 assert.equal(observed.jwt,bearer);
 assert.equal(observed.roleActor,passenger);
 assert.deepEqual(observed.query,{tripId,passengerId:passenger});
 assert.equal(calls,0);
 assert.equal(result.body.event.status,'searching');
 assert.equal(result.body.event.acceptedDriver,null);
 assert.equal(result.body.event.tracking,null);
 assert.equal(result.body.locationVisible,false);
 assert.equal(result.body.commercialRidesEnabled,false);
});
test('driver only appears after authoritative SQL accepted with verified vehicle and traffic road ETA',async()=>{
 const {handler,observed}=fixture({loadOwnTrip:async()=>accepted});
 const result=await handler(request());
 assert.equal(result.status,200);
 assert.equal(result.body.event.source,'server');
 assert.equal(result.body.event.serverRevision,2);
 assert.equal(result.body.event.trackingSequence,1);
 assert.equal(result.body.event.acceptedDriver.name,'QORE Prueba');
 assert.equal(result.body.event.acceptedDriver.plate,'TEST999');
 assert.equal(result.body.event.tracking.etaSeconds,240);
 assert.equal(result.body.event.tracking.roadMeters,1250);
 assert.equal(result.body.locationVisible,true);
 assert.equal(result.body.deliveryConfirmed,false);
 assert.equal(observed.evidence.includeLocation,true);
 assert.equal(observed.evidence.driverId,driver);
 assert.doesNotMatch(JSON.stringify(result),/auth_token|password|phone|email/);
});
test('foreign passenger cannot read trip, not even driver name or location',async()=>{
 let loaded=0;
 const {handler}=fixture({loadOwnTrip:async()=>({...accepted,passengerId:stranger}),
  loadArrivalEvidence:async()=>{loaded++;return {driverProfile:profile,location:gps,route}}});
 const result=await handler(request());
 assert.equal(result.status,404);
 assert.equal(loaded,0);
 assert.doesNotMatch(JSON.stringify(result),/TEST999|QORE Prueba|-25.28/);
});
test('driver role and anonymous/unconfirmed JWT rejected before SQL query',async()=>{
 let db=0;
 for(const overrides of [
  {verifyAccessToken:async()=>({id:passenger})},
  {verifyAccessToken:async()=>({id:passenger,is_anonymous:true,email_confirmed_at:'now'})},
  {verifyAccessToken:async()=>{throw Error('Auth secret')}},
 ]){
  const {handler}=fixture({...overrides,loadOwnTrip:async()=>{db++;return accepted}});
  const result=await handler(request());
  assert.equal(result.status,401);
 }
 const nonpassenger=fixture({authorizePassenger:async()=>false,
  loadOwnTrip:async()=>{db++;return accepted}});
 assert.equal((await nonpassenger.handler(request())).status,403);
 const outage=fixture({authorizePassenger:async()=>{throw Error('private db connection')},
  loadOwnTrip:async()=>{db++;return accepted}});
 assert.equal((await outage.handler(request())).status,503);
 assert.equal(db,0);
});
test('GPS or traffic expired: verified driver remains visible, ETA/location hidden',async()=>{
 for(const evidence of [
  {driverProfile:profile,location:{...gps,capturedAtMs:now-31_000},route},
  {driverProfile:profile,location:gps,route:{...route,trafficAware:false}},
  {driverProfile:profile,location:gps,route:null},
  {driverProfile:profile,location:{...gps,consentGranted:false},route},
 ]){
  const {handler}=fixture({loadOwnTrip:async()=>accepted,
   loadArrivalEvidence:async()=>evidence});
  const result=await handler(request());
  assert.equal(result.status,200);
  assert.equal(result.body.event.acceptedDriver.plate,'TEST999');
  assert.equal(result.body.event.tracking,null);
  assert.equal(result.body.locationVisible,false);
 }
});
test('at pickup and in-progress: do not request or expose approach GPS/ETA',async()=>{
 for(const status of ['arriving','in_progress']){
  const {handler,observed}=fixture({
   loadOwnTrip:async()=>({...accepted,status,revision:3}),
   loadArrivalEvidence:async params=>{
    observed.evidence=params;return {driverProfile:profile,location:gps,route}
   },
  });
  const result=await handler(request());
  assert.equal(result.status,200);
  assert.equal(result.body.event.status,status==='arriving'?'at_pickup':'in_progress');
  assert.equal(result.body.event.tracking,null);
  assert.equal(observed.evidence.includeLocation,false);
 }
});
test('terminal completion and cancellation: never query GPS and never retain driver details',async()=>{
 for(const status of ['completed','cancelled']){
  let calls=0;
  const {handler}=fixture({
   loadOwnTrip:async()=>({...accepted,status,revision:5}),
   loadArrivalEvidence:async()=>{calls++;throw Error('must not read GPS')}
  });
  const result=await handler(request());
  assert.equal(result.status,200);
  assert.equal(calls,0);
  assert.equal(result.body.event.acceptedDriver,null);
  assert.equal(result.body.event.tracking,null);
 }
});
test('unverified profile, swapped assigned vehicle, or contradictory trip state fail closed',async()=>{
 for(const evidence of [
  {driverProfile:{...profile,verifiedForDisplay:false},location:gps,route},
  {driverProfile:{...profile,vehicleId:stranger},location:gps,route},
  {driverProfile:{...profile,driverId:stranger},location:gps,route},
 ]){
  const {handler}=fixture({loadOwnTrip:async()=>accepted,
   loadArrivalEvidence:async()=>evidence});
  const r=await handler(request());
  assert.equal(r.status,503);
  assert.doesNotMatch(JSON.stringify(r),/TEST999|QORE Prueba|-25.28/);
 }
 const invalid=fixture({loadOwnTrip:async()=>({...accepted,status:'searching'})});
 assert.equal((await invalid.handler(request())).status,404);
});
test('limiter, incorrect clock and missing adapters never leak data',async()=>{
 const limiter=fixture({allowRequest:()=>Promise.resolve(true)});
 assert.equal((await limiter.handler(request())).status,429);
 const broken=fixture({allowRequest:()=>{throw Error('private')}});
 assert.equal((await broken.handler(request())).status,503);
 const clock=fixture({now:()=>NaN});
 assert.equal((await clock.handler(request())).status,503);
 const args={projectRef:ref,
  verifyAccessToken:async()=>({}),authorizePassenger:async()=>true,
  loadOwnTrip:async()=>trip,loadArrivalEvidence:async()=>({}),allowRequest:()=>true};
 assert.throws(()=>createQoreRiderStatusGateway({...args,projectRef:'qdqrlgzlotnfdxzpacxs'}));
 for(const key of ['verifyAccessToken','authorizePassenger','loadOwnTrip','loadArrivalEvidence','allowRequest']){
  assert.throws(()=>createQoreRiderStatusGateway({...args,[key]:null}));
 }
});
