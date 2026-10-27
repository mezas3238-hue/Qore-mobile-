import test from 'node:test';
import assert from 'node:assert/strict';
import {createG128GeoapifyCargoRoadResolver} from './g128-geoapify-cargo-road-resolver.mjs';
import {createG125CargoPricingContext} from './g125-cargo-pricing-context.mjs';
const at=1790000000000;
const sender='12800000-0000-4128-8128-000000000001';
const delivery='12800000-0000-4128-8128-000000000002';
const evidence='12800000-0000-4128-8128-000000000003';
const tollId='12800000-0000-4128-8128-000000000004';
const reservation='12800000-0000-4128-8128-000000000005';
const key='QA_FAKE_FREE_KEY_NOT_REAL_1234567890';
const ctx=vehicleKind=>({actorId:sender,deliveryId:delivery,vehicleKind,
 pickupTag:'PICKUP_EAST',deliveryTag:'DELIVERY_WEST'});
function make(kind,overrides={}){
 const calls=[],count={route:0,quota:0,toll:0};
 const coverage={source:'INDEPENDENT_COVERAGE_AUTHORITY',
  coverageVerified:true,...ctx(kind),evidenceId:evidence,revision:1,
  zoneTag:kind+'_ASUNCION',
  origin:{lat:-25.3000,lon:-57.6300},
  destination:{lat:-25.3100,lon:-57.6000},verifiedAtMs:at-1000,
  ...overrides.coverage};
 const toll={source:'INDEPENDENT_TOLL_AUTHORITY',tollsVerified:true,
  coverageEvidenceId:evidence,deliveryId:delivery,vehicleKind:kind,
  distanceMeters:5300,durationSeconds:690,tollsPyg:0,evidenceId:tollId,
  verifiedAtMs:at-1000,...overrides.toll};
 const response={ok:true,status:200,redirected:false,
  headers:{get:name=>name==='content-type'?'application/json':null},
  text:async()=>JSON.stringify(overrides.providerResponse??{
   results:[{distance:5300,time:689.2,distance_units:'Meters',toll:false}]})};
 const api=createG128GeoapifyCargoRoadResolver({
  freePlanApproved:true,apiKey:key,now:()=>at,
  resolveCoveredCargoCoordinates:async()=>coverage,
  reserveFreeQuota:async req=>{count.quota++;calls.push({quota:req});
   return {approved:true,durable:true,deliveryId:delivery,
    vehicleKind:kind,coverageEvidenceId:evidence,reservationId:reservation,
    ...overrides.quota};},
  verifyCargoTolls:async()=>{count.toll++;return toll;},
  request:async(url,opts)=>{count.route++;calls.push({url,opts});
   return overrides.http??response;}
 });
 return {api,calls,count,ctx:ctx(kind)};
}
test('G128 cannot be enabled without free-only authorization and quota adapter',()=>{
 assert.throws(()=>createG128GeoapifyCargoRoadResolver({apiKey:key,
  resolveCoveredCargoCoordinates:async()=>{},verifyCargoTolls:async()=>{},
  reserveFreeQuota:async()=>{}}),/not approved/);
 assert.throws(()=>createG128GeoapifyCargoRoadResolver({
  freePlanApproved:true,apiKey:key,resolveCoveredCargoCoordinates:async()=>{},
  verifyCargoTolls:async()=>{}
 }),/quota/);
});
test('G128 uses one drive road profile for AUTO and MOTO without live-traffic claim',async()=>{
 for(const kind of ['AUTO','MOTO']){
  const f=make(kind),route=await f.api(f.ctx);
  assert.equal(route.zoneTag,kind+'_ASUNCION');
  assert.equal(route.vehicleKind,kind);
  assert.equal(route.distanceMeters,5300);
  assert.equal(route.durationSeconds,690);
  assert.equal(route.trafficAware,true);
  assert.equal(route.liveTraffic,false);
  assert.equal(route.trafficModel,'APPROXIMATED_NOT_REALTIME');
  assert.deepEqual(f.count,{route:1,quota:1,toll:1});
  assert.equal(f.calls[0].quota.creditReservation,3);
  assert.equal(f.calls[0].quota.maxDailyCalls,100);
  const url=new URL(f.calls[1].url);
  assert.equal(url.origin,'https://api.geoapify.com');
  assert.equal(url.pathname,'/v1/routing');
  assert.equal(url.searchParams.get('mode'),'drive');
  assert.equal(url.searchParams.get('traffic'),'approximated');
  assert.equal(url.searchParams.get('format'),'json');
  assert.equal(url.searchParams.get('waypoints'),
   '-25.300000,-57.630000|-25.310000,-57.600000');
  assert.equal(f.calls[1].url.includes('PICKUP_EAST'),false);
  assert.equal(f.calls[1].url.includes(sender),false);
  const g125=createG125CargoPricingContext({
   enabled:true,now:()=>at,resolveVerifiedCargoRoute:f.api,
   loadSenderDelivery:async()=>({id:delivery,sender_id:sender,
    requested_vehicle_kind:kind,status:'requested',courier_id:null,
    pickup_tag:'PICKUP_EAST',delivery_tag:'DELIVERY_WEST'}),
   recordVerifiedRoute:async()=>({
    deliveryId:delivery,ownerId:sender,evidenceId:evidence,vehicleKind:kind,
    zoneTag:kind+'_ASUNCION',distanceMeters:5300,durationSeconds:690,
    tollsPyg:0,routingVerified:true,liveEnabled:false,serverPersisted:true})
  });
  const priced=await g125({actorId:sender,subjectId:delivery,
   fareMode:'DELIVERY',subjectKind:'DELIVERY'});
  assert.equal(priced.distanceMeters,5300);
 }
});
test('G128 wrong coverage and foreign subject rejected before free-credit reservation',async()=>{
 for(const bad of [{source:'CLIENT'},{actorId:tollId},
  {vehicleKind:'AUTO'},{origin:{lat:0,lon:0}},
  {verifiedAtMs:at-61000},{zoneTag:'AUTO_ASUNCION'},
  {coverageVerified:false}]){
  const f=make('MOTO',{coverage:bad});
  await assert.rejects(f.api(f.ctx),/coverage/);
  assert.equal(f.count.route,0);assert.equal(f.count.quota,0);
 }
});
test('G128 revoked free quota prevents provider calls',async()=>{
 for(const bad of [{approved:false},{durable:false},{vehicleKind:'AUTO'}]){
  const f=make('MOTO',{quota:bad});
  await assert.rejects(f.api(f.ctx),/quota/);
  assert.equal(f.count.route,0);
 }
});
test('G128 Geoapify invalid responses, overlength and peajes fail closed',async()=>{
 for(const p of [
  {results:[]},{results:[{distance:5300,time:10,distance_units:'Meters'},
   {distance:5200,time:20,distance_units:'Meters'}]},
  {results:[{distance:50001,time:690,distance_units:'Meters'}]},
  {results:[{distance:5300,time:690,distance_units:'Miles'}]}
 ]){
  const f=make('MOTO',{providerResponse:p});
  await assert.rejects(f.api(f.ctx));assert.equal(f.count.toll,0);
 }
 for(const toll of [{tollsVerified:false},{source:'CLIENT'},{tollsPyg:-1}]){
  const f=make('MOTO',{toll});await assert.rejects(f.api(f.ctx),/toll/);
 }
});
