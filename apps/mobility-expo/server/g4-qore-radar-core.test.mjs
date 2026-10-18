import test from 'node:test';
import assert from 'node:assert/strict';
import {
 G4_LIVE_TRIPS_ENABLED,freshVerifiedLocation,discoverQoreDrivers,
 makePrivateDriverPush,buildQoreArrivalSnapshot,
} from './g4-qore-radar-core.mjs';

const at=2_000_000;
const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
const x='33333333-3333-4333-8333-333333333333';
const ride='44444444-4444-4444-8444-444444444444';
const offer='55555555-5555-4555-8555-555555555555';
const passenger='66666666-6666-4666-8666-666666666666';
const pickup={lat:-25.28,lng:-57.63};
const gps={lat:-25.29,lng:-57.57,available:true,consentGranted:true,capturedAtMs:at-5_000,accuracyMeters:15};
const candidates=[
 {driverId:a,vehicleId:x,kind:'AUTO',location:gps,idleSeconds:0},
 {driverId:b,vehicleId:ride,kind:'AUTO',location:{...gps,lat:-25.30},idleSeconds:12000}
];
const route=(driverId,etaSeconds,roadMeters=1800)=>({
 driverId,etaSeconds,roadMeters,calculatedAtMs:at-1000,
 provider:'VERIFIED_ROAD_ROUTER',trafficAware:true,fallbackUsed:false
});
const discover=options=>discoverQoreDrivers({
 service:'economico',pickup,nowMs:at,candidates,
 checkCompliance:async()=>true,
 calculateRoutes:async()=>[route(a,340),route(b,380,2300)],
 ...options
});
const driverProfile={driverId:a,verifiedForDisplay:true,displayName:'Prueba Conductor',
 vehicleKind:'AUTO',vehicleModel:'Toyota Vitz',plate:'TEST999',rating:4.8,color:'blanco'};
const snapshot=o=>buildQoreArrivalSnapshot({
 tripId:ride,passengerId:passenger,requesterId:passenger,
 tripStatus:'accepted',assignedDriverId:a,driverProfile,
 location:gps,route:route(a,340),nowMs:at,revision:3,...o
});
test('QORE Radar ranks only verified AUTO with actual trusted road ETA; fair waiting is capped',async()=>{
 let checked=0,called;
 const res=await discover({
  checkCompliance:async()=>{checked++;return true;},
  calculateRoutes:async args=>{called=args;return [route(a,340),route(b,380,2300)]}
 });
 assert.equal(res.ok,true);
 assert.equal(res.commercialRidesEnabled,false);
 assert.equal(res.offers.length,2);
 assert.equal(res.offers[0].driverId,b,'bounded wait bonus may break near-tie');
 assert.equal(res.offers[0].routeDistanceMeters,2300);
 assert.equal(res.offers[0].routeEtaSeconds,380);
 assert.equal(res.offers[1].driverId,a);
 assert.equal(checked,2);
 assert.equal(called.trafficAware,true);
 assert.deepEqual(called.destination,pickup);
 assert.ok(!('location' in res.offers[0]));
 assert.ok(!('driverName' in res.offers[0]));
 assert.equal(G4_LIVE_TRIPS_ENABLED,false);
});
test('never admits MOTO, revoked consent, old GPS, GPS inaccurate, duplicate identity or failing preflight',async()=>{
 let called;
 const list=[
  {...candidates[0],kind:'MOTO'},
  {...candidates[0],location:{...gps,consentGranted:false}},
  {...candidates[0],location:{...gps,capturedAtMs:at-40_000}},
  {...candidates[0],location:{...gps,accuracyMeters:200}},
  {...candidates[0],location:{...gps,available:false}},
  {...candidates[0],kind:'AUTO'},
  {...candidates[0],driverId:b,vehicleId:ride},
 ];
 const res=await discover({
  candidates:list,
  checkCompliance:async p=>p.driverId===b,
  calculateRoutes:async args=>{called=args;return [route(b,300)]},
 });
 assert.equal(res.ok,true);
 assert.equal(res.offers.length,1);
 assert.equal(res.offers[0].driverId,b);
 assert.equal(called.origins.length,1);
});
test('bad/missing routing, traffic unaware, fallback, stale route or bogus matrices fail closed for ETA',async()=>{
 for(const broken of [
  {...route(a,300),trafficAware:false},
  {...route(a,300),fallbackUsed:true},
  {...route(a,300),provider:'STRAIGHT_LINE'},
  {...route(a,300),calculatedAtMs:at-25000},
  {...route(a,300),roadMeters:-1},
  {...route(a,300),etaSeconds:NaN},
 ]){
  const res=await discover({candidates:[candidates[0]],
   calculateRoutes:async()=>[broken]});
  assert.equal(res.ok,true);
  assert.deepEqual(res.offers,[],JSON.stringify(broken));
 }
 const fail=await discover({calculateRoutes:async()=>{throw Error('private vendor key')}});
 assert.equal(fail.ok,false);
 assert.doesNotMatch(JSON.stringify(fail),/vendor key/);
});
test('no compliant drivers avoids routing provider call entirely',async()=>{
 let called=0;
 const res=await discover({checkCompliance:async()=>false,
  calculateRoutes:async()=>{called++;return[]}});
 assert.equal(res.ok,true);
 assert.deepEqual(res.offers,[]);
 assert.equal(called,0);
});
test('malformed input, huge candidate list and MOTO service are closed',async()=>{
 for(const opt of [
  {service:'moto_pasajero'}, {pickup:{lat:999,lng:20}},
  {candidates:Array.from({length:301},()=>candidates[0])},
  {maxOffers:0},{maxOffers:6},{calculateRoutes:null}
 ]){
  const r=await discover(opt);
  assert.equal(r.ok,false);
  assert.equal(r.commercialRidesEnabled,false);
 }
});
test('private Expo push payload contains only expiring offer references and no GPS/PII',()=>{
 const result=makePrivateDriverPush({rideId:ride,offerId:offer,driverId:a,
  expiresAtMs:at+15_000,nowMs:at});
 assert.equal(result.ok,true);
 assert.equal(result.recipientDriverId,a);
 assert.equal(result.message.data.offerId,offer);
 assert.equal(result.commercialRidesEnabled,false);
 assert.doesNotMatch(JSON.stringify(result),/-25\.29|-57\.57|passengerName|passengerPhone|pickupLatitude/);
 assert.deepEqual(Object.keys(result.message.data).sort(),['kind','offerId','rideId']);
});
test('expired, oversized and missing-reference private push offers are rejected',()=>{
 for(const params of [
  {rideId:ride,offerId:offer,driverId:a,expiresAtMs:at-1,nowMs:at},
  {rideId:ride,offerId:offer,driverId:a,expiresAtMs:at+31_000,nowMs:at},
  {rideId:ride,offerId:'not-a-uuid',driverId:a,expiresAtMs:at+15_000,nowMs:at},
 ]){
  assert.equal(makePrivateDriverPush(params).ok,false);
 }
});
test('passenger sees verified AUTO car and precise trusted road ETA only while driver approaching',()=>{
 const r=snapshot();
 assert.equal(r.ok,true);
 assert.equal(r.trackingAvailable,true);
 assert.equal(r.roadMeters,1800);
 assert.equal(r.etaSeconds,340);
 assert.deepEqual(r.location,{lat:gps.lat,lng:gps.lng});
 assert.equal(r.driver.name,'Prueba Conductor');
 assert.equal(r.driver.plate,'TEST999');
 assert.equal(r.driver.photoUrl,null,'never leak raw file URLs');
 assert.equal(r.etaSource,'VERIFIED_ROAD_ROUTER_TRAFFIC_AWARE');
 assert.equal(r.commercialRidesEnabled,false);
});
test('GPS revoked, stale, inaccurate, offline, or routing untrusted → show no countdown/position',()=>{
 const bads=[
  {location:{...gps,capturedAtMs:at-31_000}},
  {location:{...gps,accuracyMeters:110}},
  {location:{...gps,consentGranted:false}},
  {location:{...gps,available:false}},
  {route:{...route(a,340),trafficAware:false}},
  {route:{...route(a,340),fallbackUsed:true}},
  {route:{...route(a,340),etaSeconds:-1}},
  {route:null}
 ];
 for(const options of bads){
  const res=snapshot(options);
  assert.equal(res.ok,true);
  assert.equal(res.trackingAvailable,false,JSON.stringify(options));
  assert.equal(res.etaSeconds,null);
  assert.equal(res.roadMeters,null);
  assert.equal(res.location,null);
  assert.match(res.message,/temporalmente no disponible/);
 }
});
test('unauthorized passenger and profile not verified cannot see even vehicle details',()=>{
 for(const obj of [
  {requesterId:b},
  {driverProfile:{...driverProfile,verifiedForDisplay:false}},
  {driverProfile:{...driverProfile,plate:'invalid plate'}},
  {tripStatus:'searching'},
 ]){
  const res=snapshot(obj);
  assert.equal(res.ok,false);
  assert.equal(res.commercialRidesEnabled,false);
  assert.equal(JSON.stringify(res).includes('TEST999'),false);
 }
});
test('after pickup or completed/cancelled: no ETA and no tracking retained',()=>{
 for(const status of ['arriving','in_progress','completed','cancelled']){
  const res=snapshot({tripStatus:status});
  assert.equal(res.ok,true);
  assert.equal(res.trackingAvailable,false);
  assert.equal(res.location,null);
  assert.equal(res.etaSeconds,null);
  if(status==='completed'||status==='cancelled')assert.equal(res.driver,null);
 }
});
test('rejects duplicate or ambiguous provider rows rather than leaking inconsistent ETA',async()=>{
 const res=await discover({candidates:[candidates[0]],
  calculateRoutes:async()=>[route(a,200),route(a,250)]});
 assert.equal(res.ok,false);
});
test('GPS 30-second freshness and 75m accuracy are explicit boundaries',()=>{
 assert.equal(freshVerifiedLocation({...gps,capturedAtMs:at-30_000,accuracyMeters:75},at),true);
 assert.equal(freshVerifiedLocation({...gps,capturedAtMs:at-30_001},at),false);
 assert.equal(freshVerifiedLocation({...gps,capturedAtMs:at+10_001},at),false);
});

test('fanout never exceeds five offers even if caller requests more',async()=>{
 const rejected=await discover({maxOffers:6});
 assert.equal(rejected.ok,false);
 assert.deepEqual(rejected.commercialRidesEnabled,false);
 const permitted=await discover({maxOffers:5});
 assert.equal(permitted.ok,true);
 assert.ok(permitted.offers.length<=5);
});

test('more than 20 eligible drivers are routed in bounded batches without dropping candidates',async()=>{
 const many=Array.from({length:21},(_,i)=>({
  ...candidates[0],driverId:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,
  vehicleId:x,idleSeconds:0
 }));
 const sizes=[];
 const result=await discover({candidates:many,maxOffers:5,
  calculateRoutes:async({origins})=>{
   sizes.push(origins.length);
   return origins.map(o=>route(o.driverId,300));
  }
 });
 assert.equal(result.ok,true);
 assert.deepEqual(sizes,[20,1]);
 assert.equal(result.offers.length,5);
});

test('foreign driver IDs returned by routing provider invalidate discovery',async()=>{
 const result=await discover({candidates:[candidates[0]],
  calculateRoutes:async()=>[route(b,150)]});
 assert.equal(result.ok,false);
 assert.deepEqual(result.commercialRidesEnabled,false);
 assert.ok(!('offers' in result));
});

test('cross-batch route identity injection fails closed even when driver is eligible globally',async()=>{
 const many=Array.from({length:21},(_,i)=>({
  ...candidates[0],driverId:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,
  vehicleId:x,idleSeconds:0
 }));
 let calls=0;
 const result=await discover({candidates:many,maxOffers:5,
  calculateRoutes:async({origins})=>{
   calls++;
   if(calls===1)return [route(many[20].driverId,150)];
   return origins.map(o=>route(o.driverId,150));
  }
 });
 assert.equal(result.ok,false);
 assert.equal(result.commercialRidesEnabled,false);
 assert.equal(calls,1);
});
