import test from 'node:test';
import assert from 'node:assert/strict';
import {createG329PinnedAutoRepository} from './g329-pinned-route-repository.mjs';
const now=1794500000000;
const actorId='32900000-0000-4329-8329-000000000001';
const requestKey='32900000-0000-4329-8329-000000000002';
const routeId='32900000-0000-4329-8329-000000000003';
const evidenceId='32900000-0000-4329-8329-000000000004';
const p={
 actorId,requestKey,service:'economico',originTag:'HERNANDARIAS',
 destinationTag:'CIUDAD_DEL_ESTE',zoneTag:'AUTO_ALTO_PARANA',
 distanceMeters:5000,durationSeconds:620,tollsPyg:0,pinEvidenceId:evidenceId,
 pickupPoint:{latitude:-25.4061,longitude:-54.6302},
 dropoffPoint:{latitude:-25.5092,longitude:-54.6115},
 verifiedAtMs:now-1000
};
const receipt={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:actorId,routeId,requestKey,service:'economico',
 routingVerified:true,expiresAt:now+600000,
 pinEvidenceId:evidenceId,pinBound:true};
function fixture(overrides={}){
 const queries=[];
 const repo=createG329PinnedAutoRepository({
  enabled:true,now:()=>now,
  client:{rpc:async(name,args)=>{queries.push({name,args});
   if(name==='mobility_stage_g329_route_pinned')
    return {data:routeId,error:null};
   return {data:receipt,error:null};
  }},
  ...overrides
 });
 return {repo,queries};
}
test('G329 server-only SQL maps exact evidence to private RPC, never logs',async()=>{
 const x=fixture();
 assert.equal(await x.repo.registerPinnedRoute(p),routeId);
 assert.equal(x.queries.length,1);
 assert.equal(x.queries[0].name,'mobility_stage_g329_route_pinned');
 assert.equal(x.queries[0].args._pin_evidence_id,evidenceId);
 assert.equal(x.queries[0].args._pickup_latitude,p.pickupPoint.latitude);
 assert.equal(x.queries[0].args._verified_at_ms,p.verifiedAtMs);
 assert.equal(Object.hasOwn(x.queries[0].args,'amountGs'),false);
});
test('G329 owner-scoped route receipt is exact and immutable',async()=>{
 const x=fixture(),r=await x.repo.loadPinnedRoute({
  actorId,routeId,pinEvidenceId:evidenceId});
 assert.deepEqual(r,receipt);
 assert.equal(Object.isFrozen(r),true);
 assert.equal(x.queries[0].name,'mobility_stage_g329_route_pinned_receipt');
 assert.deepEqual(x.queries[0].args,{_passenger_id:actorId,_route_id:routeId});
});
test('G329 fails closed when no verified independent evidence or modes disabled',async()=>{
 const x=fixture();
 for(const bad of [
  {...p,verifiedAtMs:now-61000},
  {...p,pickupPoint:{latitude:0,longitude:0}},
  {...p,pickupPoint:{latitude:'-25.4061',longitude:-54.6302}},
  {...p,dropoffPoint:p.pickupPoint},
  {...p,originTag:'UNTRUSTED0'},
  {...p,distanceMeters:0},
  {...p,pinEvidenceId:'fake'},
  {...p,driverId:actorId,amountGs:5,service:'moto_pasajero'}
 ])await assert.rejects(x.repo.registerPinnedRoute(bad));
 assert.equal(x.queries.length,0);
 const off=createG329PinnedAutoRepository({client:{rpc:async()=>{throw Error('must not call');}}});
 await assert.rejects(off.registerPinnedRoute(p),/not enabled/);
 await assert.rejects(off.loadPinnedRoute({actorId,routeId}),/not enabled/);
});
test('G329 denies wrong actor/evidence, leaked fields and malformed SQL response',async()=>{
 for(const patch of [
  {ownerId:requestKey},{pinEvidenceId:requestKey},
  {pinBound:false},{commercialEnabled:true},{routeId:requestKey},
  {expiresAt:now-1},{amountGs:123},{routingVerified:false}
 ]){
  const x=fixture({client:{rpc:async()=>({data:{...receipt,...patch},error:null})}});
  await assert.rejects(x.repo.loadPinnedRoute({actorId,routeId,pinEvidenceId:evidenceId}));
 }
 const x=fixture({client:{rpc:async()=>({data:null,error:{message:'private SQL'}})}});
 await assert.rejects(x.repo.loadPinnedRoute({actorId,routeId}),/private database unavailable/);
});
