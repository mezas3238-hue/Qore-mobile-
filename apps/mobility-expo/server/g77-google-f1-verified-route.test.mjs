import test from 'node:test';
import assert from 'node:assert/strict';
import {createG77GoogleF1VerifiedRoute} from './g77-google-f1-verified-route.mjs';
const passenger='77770000-0000-4777-8777-000000000001';
const secret='QA_TAG_SECRET_PRIVATE_32_BYTES_NOT_FOR_DEPLOYMENT';
const key='qa-google-server-key-not-real-1234567';
const clock=1900000000000;
const fromId='ChIJG77PYOriginPointAAAAA';
const toId='ChIJG77PYDestinationPointAA';
const intent={actorId:passenger,origin:'Centro, Asunción',
 destination:'Aeropuerto, Luque',service:'economico'};
const response=x=>({
 ok:true,status:200,redirected:false,
 headers:{get:name=>name==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(x)
});
const geo=(id,lat,lon,patch={})=>({results:[{
  placeId:id,granularity:'ROOFTOP',
  postalAddress:{regionCode:'PY'},
  location:{latitude:lat,longitude:lon},
  ...patch
 }]});
const defaultRoad={routes:[{distanceMeters:11250,duration:'985.4s'}]};
function fixture({origin=geo(fromId,-25.29,-57.63),
 destination=geo(toId,-25.28,-57.52),road=defaultRoad,
 coverageOverride={},tollOverride={},elapsed=0,enabled=true,billingApproved=true}={}){
 let requests=[],zoneCalls=0,tollCalls=0,step=0;
 const request=async(url,init)=>{
  requests.push({url,init});
  if(url.startsWith('https://geocode.googleapis.com/v4/geocode/address/'))
   return response(++step===1?origin:destination);
  if(url==='https://routes.googleapis.com/directions/v2:computeRoutes')
   return response(road);
  throw Error('Unexpected external hostname');
 };
 const authorizeCoverage=async({from,to,service})=>{
  zoneCalls++;return {verified:true,approved:true,country:'PY',service,
   zoneTag:'ASUNCION_APPROVED_ZONE',originPlaceId:from.placeId,
   destinationPlaceId:to.placeId,revision:2,...coverageOverride};
 };
 const verifyTolls=async({originPlaceId,destinationPlaceId,zoneTag,distanceMeters})=>{
  tollCalls++;return {verified:true,originPlaceId,destinationPlaceId,
   zoneTag,distanceMeters,tollsPyg:0,...tollOverride};
 };
 const create=(changes={})=>createG77GoogleF1VerifiedRoute({
  enabled,billingApproved,apiKey:key,tagSecret:secret,
  now:()=>clock+elapsed,request,authorizeCoverage,verifyTolls,...changes
 });
 return {create,requests,counts:()=>({zoneCalls,tollCalls})};
}
test('G77 OFF by default: cannot call paid provider without explicit billing approval, server secret and zone+toll authority',()=>{
 const f=fixture();
 for(const extra of [{enabled:false},{billingApproved:false},
  {apiKey:'not-secret'},{tagSecret:'short'},
  {authorizeCoverage:null},{verifyTolls:null}]){
  assert.throws(()=>f.create(extra));
 }
 assert.equal(f.requests.length,0,'no paid API request may occur');
});
test('G77 Google v4 geocodes two real addresses, Routes v2 TRAFFIC_AWARE, G73 exact anonymous receipt',async()=>{
 const f=fixture(),out=await f.create()(intent);
 assert.equal(out.routingVerified,true);
 assert.equal(out.coverageVerified,true);
 assert.equal(out.trafficAware,true);assert.equal(out.fallbackUsed,false);
 assert.equal(out.distanceMeters,11250);
 assert.equal(out.durationSeconds,986);
 assert.equal(out.tollsPyg,0,'zero only after independent toll authority');
 assert.equal(out.zoneTag,'ASUNCION_APPROVED_ZONE');
 assert.match(out.originTag,/^LOC_[A-P]{32}$/);
 assert.match(out.destinationTag,/^LOC_[A-P]{32}$/);
 assert.notEqual(out.originTag,out.destinationTag);
 assert.equal(Object.keys(out).length,10);
 assert.deepEqual(f.counts(),{zoneCalls:1,tollCalls:1});
 assert.equal(f.requests.length,3);
 assert.equal(f.requests[0].init.method,'GET');
 assert.equal(f.requests[1].init.method,'GET');
 assert.equal(f.requests[2].init.method,'POST');
 assert(f.requests[0].url.includes('regionCode=PY'));
 assert.equal(f.requests[2].init.headers['X-Goog-FieldMask'],
  'routes.distanceMeters,routes.duration,fallbackInfo');
 assert.equal(f.requests[2].init.headers['X-Goog-Api-Key'],key);
 const roadRequest=JSON.parse(f.requests[2].init.body);
 assert.equal(roadRequest.routingPreference,'TRAFFIC_AWARE');
 assert.equal(roadRequest.travelMode,'DRIVE');
 assert.equal(roadRequest.origin.placeId,fromId);
 assert.equal(roadRequest.destination.placeId,toId);
 assert.equal(JSON.stringify(out).includes(fromId),false);
 assert.equal(JSON.stringify(out).includes(key),false);
 assert.equal(JSON.stringify(out).includes(intent.origin),false);
});
test('G77 rejects ambiguous, foreign, imprecise or identical geocodes before routing or price',async()=>{
 const foreign=geo(fromId,-25.29,-57.63,{postalAddress:{regionCode:'BR'}});
 const coarse=geo(fromId,-25.29,-57.63,{granularity:'APPROXIMATE'});
 for(const origin of [
  {results:[]},geo(fromId,-25.29,-57.63,{granularity:null}),
  {results:[geo(fromId,-25.29,-57.63).results[0],geo(toId,-25.28,-57.62).results[0]]},
  foreign,coarse,geo(fromId,10,-57.63)
 ]){
  const f=fixture({origin});
  await assert.rejects(f.create()(intent));
  assert.equal(f.requests.filter(x=>x.init.method==='POST').length,0);
  assert.deepEqual(f.counts(),{zoneCalls:0,tollCalls:0});
 }
 const same=fixture({destination:geo(fromId,-25.28,-57.52)});
 await assert.rejects(same.create()(intent));
 assert.equal(same.requests.length,2);
});
test('G77 rejects fallback, missing or duplicated routes and invalid traffic, without zone or toll call',async()=>{
 for(const road of [
  {routes:[]},{routes:[defaultRoad.routes[0],defaultRoad.routes[0]]},
  {...defaultRoad,fallbackInfo:{reason:'SERVER_ERROR'}},
  {routes:[{...defaultRoad.routes[0],distanceMeters:-1}]},
  {routes:[{...defaultRoad.routes[0],duration:'NaNs'}]},
  {routes:[{...defaultRoad.routes[0],fallbackInfo:{reason:'LATENCY_EXCEEDED'}}]}
 ]){
  const f=fixture({road});
  await assert.rejects(f.create()(intent));
  assert.deepEqual(f.counts(),{zoneCalls:0,tollCalls:0});
 }
});
test('G77 no independent coverage authority, unsupported zone or service forces rejection and no tolls',async()=>{
 for(const coverageOverride of [
  {verified:false},{approved:false},{country:'BR'},{service:'xl'},
  {zoneTag:'unverified-zone'},{originPlaceId:toId},
  {destinationPlaceId:fromId},{revision:0}
 ]){
  const f=fixture({coverageOverride});
  await assert.rejects(f.create()(intent));
  assert.deepEqual(f.counts(),{zoneCalls:1,tollCalls:0});
 }
});
test('G77 toll source missing or inconsistent never implies zero, never creates a route',async()=>{
 for(const tollOverride of [
  {verified:false},{tollsPyg:null},{tollsPyg:-1},
  {tollsPyg:0.5},{zoneTag:'OTHER_REGION'},
  {originPlaceId:toId},{distanceMeters:100}
 ]){
  const f=fixture({tollOverride});
  await assert.rejects(f.create()(intent));
  assert.deepEqual(f.counts(),{zoneCalls:1,tollCalls:1});
 }
});
test('G77 service, actor, address and clock scope validation before any paid provider call',async()=>{
 for(const override of [
  {actorId:'fake'},{service:'moto_pasajero'},
  {origin:' '},{origin:' Centro'},{destination:intent.origin}
 ]){
  const f=fixture();
  await assert.rejects(f.create()({...intent,...override}));
  assert.equal(f.requests.length,0);
 }
 const f=fixture();
 await assert.rejects(f.create({now:()=>-1})(intent));
 assert.equal(f.requests.length,0);
});
test('G77 absent provider HTTP errors or slow evidence cannot be certified',async()=>{
 const f=fixture({elapsed:0});
 const make=f.create({
  request:async()=>({ok:false,status:429}),
 });
 await assert.rejects(make(intent));
 const late=fixture();
 let i=0;
 const slow=late.create({now:()=>clock+(i++===0?0:16000)});
 await assert.rejects(slow(intent));
});
