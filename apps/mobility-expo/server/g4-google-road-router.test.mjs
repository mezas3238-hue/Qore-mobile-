import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleTrafficMatrixRouter} from './g4-google-road-router.mjs';

const key='mock-server-private-google-routes-key-NOT-REAL';
const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
const origins=[{driverId:a,lat:-25.29,lng:-57.6},{driverId:b,lat:-25.32,lng:-57.61}];
const destination={lat:-25.282,lng:-57.635};
const call={origins,destination,service:'economico',trafficAware:true};
const fake=(rows,now=2_000_000)=>{
 let requestInfo;
 return {
  router:createGoogleTrafficMatrixRouter({apiKey:key,now:()=>now,
   request:async(url,opt)=>{
    requestInfo={url,opt};
    return {ok:true,json:async()=>rows};
   }}),
  read:()=>requestInfo,
 };
};
test('sends Google v2 drive matrix with traffic awareness and explicit status+fallback field mask',async()=>{
 const t=fake([{originIndex:0,destinationIndex:0,status:{},condition:'ROUTE_EXISTS',
  distanceMeters:2137,duration:'361.5s'}]);
 const result=await t.router(call);
 assert.deepEqual(result,[{driverId:a,provider:'VERIFIED_ROAD_ROUTER',trafficAware:true,
  fallbackUsed:false,calculatedAtMs:2_000_000,roadMeters:2137,etaSeconds:362}]);
 const {url,opt}=t.read();
 assert.equal(url,'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix');
 assert.equal(opt.method,'POST');
 assert.equal(opt.headers['X-Goog-FieldMask'],
  'originIndex,destinationIndex,status,condition,distanceMeters,duration,fallbackInfo');
 assert.equal(opt.headers['X-Goog-Api-Key'],key);
 assert.equal(opt.redirect,'error');
 const payload=JSON.parse(opt.body);
 assert.equal(payload.routingPreference,'TRAFFIC_AWARE');
 assert.equal(payload.travelMode,'DRIVE');
 assert.equal(payload.origins.length,2);
 assert.equal(payload.destinations[0].waypoint.location.latLng.latitude,destination.lat);
 assert.equal(payload.origins[0].waypoint.location.latLng.longitude,origins[0].lng);
 assert.doesNotMatch(JSON.stringify(result),/mock-server-private-google-routes-key/);
});
test('rejects traffic fallback, provider errors, missing routes and invalid durations',async()=>{
 const good={originIndex:0,destinationIndex:0,condition:'ROUTE_EXISTS',
  distanceMeters:1000,duration:'150s',status:{}};
 for(const bad of [
  {...good,fallbackInfo:{routingMode:'TRAFFIC_UNAWARE'}},
  {...good,status:{code:7,message:'unauthorized'}},
  {...good,condition:'ROUTE_NOT_FOUND'},
  {...good,duration:'NaNs'},
  {...good,distanceMeters:-1},
  {...good,duration:'25000s'}
 ]){
  assert.deepEqual(await fake([bad]).router(call),[]);
 }
});
test('out-of-order valid rows map back to verified driver IDs without mixing identities',async()=>{
 const rows=[
  {originIndex:1,destinationIndex:0,condition:'ROUTE_EXISTS',
   distanceMeters:800,duration:'120s'},
  {originIndex:0,destinationIndex:0,condition:'ROUTE_EXISTS',
   distanceMeters:1900,duration:'300s'}
 ];
 const result=await fake(rows).router(call);
 assert.deepEqual(result.map(x=>x.driverId),[b,a]);
});
test('duplicate matrix indices, oversized responses and invalid query inputs fail closed',async()=>{
 const row={originIndex:0,destinationIndex:0,condition:'ROUTE_EXISTS',
  distanceMeters:1000,duration:'100s'};
 await assert.rejects(fake([row,row]).router(call));
 await assert.rejects(fake([row,row,row]).router(call));
 for(const overrides of [
  {trafficAware:false},{service:'moto_pasajero'}, {destination:{lat:200,lng:500}},
  {origins:[...origins,origins[0]]}, {origins:[]},
  {origins:Array.from({length:21},(_,i)=>({...origins[0],driverId:String(i)}))}
 ]){
  await assert.rejects(fake([row]).router({...call,...overrides}));
 }
});
test('failing router network cannot be misrepresented as a real ETA',async()=>{
 const router=createGoogleTrafficMatrixRouter({apiKey:key,
  request:async()=>({ok:false,status:403})});
 await assert.rejects(router(call),/unavailable/);
 assert.throws(()=>createGoogleTrafficMatrixRouter({apiKey:'public'}));
});
