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

test('G4 AUTO-only passenger snapshots never expose even verified MOTO profiles',async()=>{
 const {handler}=fixture({
  loadOwnTrip:async()=>accepted,
  loadArrivalEvidence:async()=>({
   driverProfile:{...profile,vehicleKind:'MOTO'},location:gps,route
  })
 });
 const r=await handler(request());
 assert.equal(r.status,503);
 assert.doesNotMatch(JSON.stringify(r),/TEST999|-25.28|QORE Prueba/);
});

test('G23 Client v1: JWT-bound status DTO matches separate passenger app without a client-supplied owner',async()=>{
 const search=await fixture().handler(request());
 assert.equal(search.status,200);
 assert.equal(search.body.tripId,tripId);
 assert.equal(search.body.ownerId,passenger);
 assert.equal(search.body.revision,1);
 assert.equal(search.body.state,'searching');
 assert.equal(search.body.assignmentPersisted,false);
 assert.equal(search.body.driver,null);
 assert.equal(search.body.vehicle,null);
 assert.equal(search.body.location,null);
 assert.equal(search.body.etaMinutes,null);
 assert.equal(search.body.etaVerified,false);

 const assigned=await fixture({loadOwnTrip:async()=>accepted}).handler(request());
 assert.equal(assigned.status,200);
 assert.equal(assigned.body.tripId,tripId);
 assert.equal(assigned.body.ownerId,passenger);
 assert.equal(assigned.body.revision,2);
 assert.equal(assigned.body.state,'assigned');
 assert.equal(assigned.body.assignmentPersisted,true);
 assert.deepEqual(assigned.body.driver,{verified:true,displayName:'QORE Prueba'});
 assert.deepEqual(assigned.body.vehicle,{kind:'AUTO',plate:'TEST999'});
 assert.deepEqual(assigned.body.location,{
  latitude:gps.lat,longitude:gps.lng,observedAt:gps.capturedAtMs
 });
 assert.equal(assigned.body.gpsConsent,true);
 assert.equal(assigned.body.etaVerified,true);
 assert.equal(assigned.body.etaMinutes,4);
 assert.equal(assigned.body.commercialRidesEnabled,false);
});

test('G23 Client v1: stale/unconsented location, old trip owner, terminal and pickup hide private coordinates',async()=>{
 for(const stale of [
  {...gps,capturedAtMs:now-31_000},
  {...gps,consentGranted:false},
 ]){
  const result=await fixture({
   loadOwnTrip:async()=>accepted,
   loadArrivalEvidence:async()=>({driverProfile:profile,location:stale,route})
  }).handler(request());
  assert.equal(result.status,200);
  assert.equal(result.body.assignmentPersisted,true);
  assert.equal(result.body.location,null);
  assert.equal(result.body.gpsConsent,false);
  assert.equal(result.body.etaVerified,false);
  assert.equal(result.body.etaMinutes,null);
 }
 const pickup=await fixture({
  loadOwnTrip:async()=>({...accepted,status:'arriving',revision:3})
 }).handler(request());
 assert.equal(pickup.body.state,'arriving');
 assert.equal(pickup.body.assignmentPersisted,true);
 assert.equal(pickup.body.location,null);
 const completed=await fixture({
  loadOwnTrip:async()=>({...accepted,status:'completed',revision:4})
 }).handler(request());
 assert.equal(completed.body.state,'completed');
 assert.equal(completed.body.assignmentPersisted,false);
 assert.equal(completed.body.driver,null);
 assert.equal(completed.body.vehicle,null);
 assert.equal(completed.body.location,null);
 const foreign=await fixture({
  loadOwnTrip:async()=>({...accepted,passengerId:stranger})
 }).handler(request());
 assert.equal(foreign.status,404);
 assert.doesNotMatch(JSON.stringify(foreign),/TEST999|QORE Prueba|-25.28/);
});

test('G86 persistent AUTO assignment remains visible without claiming Driver identity or GPS',async()=>{
 for(const [state,revision,expectedState,eventState] of [
  ['accepted',2,'assigned','accepted'],
  ['arriving',3,'arriving','at_pickup'],
  ['in_progress',4,'in_progress','in_progress']
 ]){
  let reads=0;
  const {handler}=fixture({
   loadOwnTrip:async()=>({...accepted,status:state,revision}),
   loadArrivalEvidence:async()=>{reads++;throw Error('Third-party evidence offline');}
  });
  const response=await handler(request());
  assert.equal(response.status,200,state);
  assert.equal(reads,1);
  const x=response.body;
  assert.equal(x.tripId,tripId);
  assert.equal(x.ownerId,passenger);
  assert.equal(x.revision,revision);
  assert.equal(x.state,expectedState);
  assert.equal(x.assignmentPersisted,true);
  assert.equal(x.event.status,eventState);
  assert.equal(x.event.serverRevision,revision);
  assert.equal(x.event.acceptedDriver,null);
  assert.equal(x.event.tracking,null);
  assert.equal(x.driver,null);
  assert.equal(x.vehicle,null);
  assert.equal(x.gpsConsent,false);
  assert.equal(x.location,null);
  assert.equal(x.etaVerified,false);
  assert.equal(x.etaMinutes,null);
  assert.equal(x.locationVisible,false);
  assert.equal(x.deliveryConfirmed,false);
  assert.equal(x.commercialRidesEnabled,false);
  assert.doesNotMatch(JSON.stringify(x),/QORE Prueba|Toyota|TEST999|-25\.28|\b44444444-4444\b/);
 }
});
test('G86 cannot claim assignment on passenger mismatch, missing vehicle or ambiguous state',async()=>{
 let reads=0;
 for(const broken of [
  {...accepted,passengerId:stranger},
  {...accepted,vehicleId:null},
  {...accepted,status:'searching'},
 ]){
  const {handler}=fixture({
   loadOwnTrip:async()=>broken,
   loadArrivalEvidence:async()=>{reads++;throw Error('No GPS');}
  });
  const result=await handler(request());
  assert.equal(result.status,404);
 }
 assert.equal(reads,0);
});
test('G86 verified evidence contradiction still fails closed; only provider outage degrades gracefully',async()=>{
 for(const bad of [
  {driverProfile:{...profile,driverId:stranger},location:gps,route},
  {driverProfile:{...profile,vehicleKind:'MOTO'},location:gps,route},
  {driverProfile:null,location:gps,route},
 ]){
  const {handler}=fixture({loadOwnTrip:async()=>accepted,
   loadArrivalEvidence:async()=>bad});
  const x=await handler(request());
  assert.equal(x.status,503);
  assert.doesNotMatch(JSON.stringify(x),/TEST999|-25\.28/);
 }
});
