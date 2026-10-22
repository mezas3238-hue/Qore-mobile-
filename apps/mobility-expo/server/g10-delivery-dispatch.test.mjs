import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchPrivateDeliveryOffers} from './g10-delivery-dispatch.mjs';
const delivery='11111111-1111-4111-8111-111111111111';
const a='22222222-2222-4222-8222-222222222222';
const b='33333333-3333-4333-8333-333333333333';
const va='44444444-4444-4444-8444-444444444444';
const vb='55555555-5555-4555-8555-555555555555';
const key='66666666-6666-4666-8666-666666666666';
const offer='77777777-7777-4777-8777-777777777777';
const now=100_000;
const candidate=(courierId,vehicleId,idleSeconds=0)=>({courierId,vehicleId,
 vehicleKind:'MOTO',idleSeconds,location:{lat:-25.3,lng:-57.6,
 consentGranted:true,available:true,capturedAtMs:99_000,accuracyMeters:10}});
const base=overrides=>({deliveryId:delivery,vehicleKind:'MOTO',
 pickup:{lat:-25.31,lng:-57.61},nowMs:now,candidates:[candidate(a,va),candidate(b,vb,1200)],
 checkEligibility:async()=>true,
 calculateRoutes:async()=>[
  {courierId:a,provider:'VERIFIED_ROAD_ROUTER',trafficAware:true,fallbackUsed:false,
   calculatedAtMs:99_500,roadMeters:2000,etaSeconds:300},
  {courierId:b,provider:'VERIFIED_ROAD_ROUTER',trafficAware:true,fallbackUsed:false,
   calculatedAtMs:99_500,roadMeters:2100,etaSeconds:305}],
 issueRequestKey:async()=>key,
 createOffer:async()=>({ok:true,liveEnabled:false,offerId:offer}),...overrides});
test('ranks eligible AUTO/MOTO couriers with bounded fairness and persists private offers',async()=>{
 const created=[];
 let n=0;
 const result=await dispatchPrivateDeliveryOffers(base({
  issueRequestKey:async()=>n++===0?key:'88888888-8888-4888-8888-888888888888',
  createOffer:async input=>{created.push(input);return {ok:true,liveEnabled:false,
   offerId:created.length===1?offer:'99999999-9999-4999-8999-999999999999'};}
 }));
 assert.equal(result.ok,true);
 assert.equal(result.liveEnabled,false);
 assert.equal(result.offers[0].courierId,b,'bounded idle fairness changes close ETA ranking');
 assert.equal(result.offers[0].pushDelivered,false);
 assert.equal(created.length,2);
 assert.equal(created[0].ttlSeconds,30);
});
test('filters stale, mismatched, duplicate and server-ineligible candidates',async()=>{
 let routed;
 const stale={...candidate(a,va),location:{...candidate(a,va).location,capturedAtMs:1}};
 const wrong={...candidate(b,vb),vehicleKind:'AUTO'};
 const result=await dispatchPrivateDeliveryOffers(base({candidates:[stale,wrong,
  candidate(a,va),candidate(a,vb)],checkEligibility:async({vehicleId})=>vehicleId===va,
  calculateRoutes:async input=>{routed=input.origins;return [{courierId:a,
   provider:'VERIFIED_ROAD_ROUTER',trafficAware:true,fallbackUsed:false,
   calculatedAtMs:99_500,roadMeters:1000,etaSeconds:120}];}}));
 assert.equal(result.ok,true);assert.deepEqual(routed,[{courierId:a,lat:-25.3,lng:-57.6}]);
 assert.equal(result.offers.length,1);
});
test('fails closed on forged routing rows, duplicate rows or malformed persistence receipt',async()=>{
 for(const calculateRoutes of [
  async()=>[{courierId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}],
  async()=>[{courierId:a},{courierId:a}],
 ])assert.equal((await dispatchPrivateDeliveryOffers(base({calculateRoutes}))).ok,false);
 assert.equal((await dispatchPrivateDeliveryOffers(base({
  createOffer:async()=>({ok:true,liveEnabled:true,offerId:offer})}))).ok,false);
});
test('rejects LIVE-like or unbounded inputs before calling providers',async()=>{
 let calls=0;
 for(const overrides of [{vehicleKind:'BICYCLE'},{maxOffers:6},{ttlSeconds:46},
  {candidates:new Array(301).fill(candidate(a,va))},{pickup:{lat:91,lng:0}}]){
  const result=await dispatchPrivateDeliveryOffers(base({...overrides,
   calculateRoutes:async()=>{calls++;return [];}}));
  assert.equal(result.ok,false);
 }
 assert.equal(calls,0);
});
