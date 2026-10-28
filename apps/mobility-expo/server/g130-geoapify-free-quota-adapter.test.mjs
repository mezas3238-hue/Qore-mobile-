import test from 'node:test';
import assert from 'node:assert/strict';
import {createG130GeoapifyFreeQuotaAdapter} from './g130-geoapify-free-quota-adapter.mjs';
import {createG128GeoapifyCargoRoadResolver} from './g128-geoapify-cargo-road-resolver.mjs';
const uuid=n=>'13000000-0000-4130-8130-'+String(n).padStart(12,'0');
const actorId=uuid(1),deliveryId=uuid(2),coverageEvidenceId=uuid(3);
const request={actorId,deliveryId,coverageEvidenceId,vehicleKind:'MOTO',
 provider:'GEOAPIFY_FREE',creditReservation:3,maxDailyCredits:300,maxDailyCalls:100};
const success={approved:true,durable:true,provider:'GEOAPIFY_FREE',
 deliveryId,vehicleKind:'MOTO',coverageEvidenceId,
 reservationId:uuid(4),reservedCredits:3};
const flags={enabled:true,ownerFreePlanApproved:true,postgresAtomicQuotaVerified:true};
test('G130 OFF without independent owner, Pg and adapter gates',async()=>{
 for(const patch of [
  {enabled:false},{ownerFreePlanApproved:false},
  {postgresAtomicQuotaVerified:false},{reserveInPostgres:null}
 ]){
  let n=0;
  const f=createG130GeoapifyFreeQuotaAdapter({...flags,
   reserveInPostgres:async()=>{n++;return success;},...patch});
  await assert.rejects(f(request),/not certified/);
  assert.equal(n,0);
 }
});
test('G130 exact original evidence key; only first persisted reservation approved',async()=>{
 let calls=0,used=false,seen=[];
 const f=createG130GeoapifyFreeQuotaAdapter({...flags,
  reserveInPostgres:async req=>{
   calls++;seen.push(req);
   if(used)return {...success,approved:false,
    reason:'ALREADY_RESERVED_NO_RETRY'};
   used=true;return success;
  }});
 const a=await f(request);
 assert.equal(a.approved,true);
 assert.equal(a.reservationId,uuid(4));
 const b=await f(request);
 assert.equal(b.approved,false);
 assert.equal(b.reason,'ALREADY_RESERVED_NO_RETRY');
 assert.equal(calls,2);
 assert(seen.every(x=>x.requestKey===coverageEvidenceId));
 assert.equal(Object.keys(seen[0]).length,5);
});
test('G130 refuses fabricated caps, foreign subject and wrong PG receipt',async()=>{
 let called=0;
 const f=createG130GeoapifyFreeQuotaAdapter({...flags,
  reserveInPostgres:async()=>{called++;return {...success,
   deliveryId:uuid(98)};}});
 for(const x of [
  {...request,creditReservation:1},{...request,maxDailyCredits:3000},
  {...request,maxDailyCalls:300},{...request,actorId:'forged'},
  {...request,unknown:true}
 ]){
  await assert.rejects(f(x),/invalid/);
 }
 assert.equal(called,0);
 await assert.rejects(f(request),/mismatched/);
 assert.equal(called,1);
});
test('G130 route HTTP is never called twice for same coverage evidence',async()=>{
 let reserved=0,http=0;
 const quota=createG130GeoapifyFreeQuotaAdapter({...flags,
  reserveInPostgres:async()=>{reserved++;
   return reserved===1?success:{...success,approved:false,
    reason:'ALREADY_RESERVED_NO_RETRY'};}});
 const now=1800000000000;
 const f=createG128GeoapifyCargoRoadResolver({
  freePlanApproved:true,apiKey:'QA_NOT_A_REAL_GEOAPIFY_KEY_1234',
  now:()=>now,reserveFreeQuota:quota,
  resolveCoveredCargoCoordinates:async({vehicleKind})=>({
   source:'INDEPENDENT_COVERAGE_AUTHORITY',coverageVerified:true,
   actorId,deliveryId,vehicleKind,pickupTag:'PICKUP_EAST',
   deliveryTag:'DELIVERY_WEST',evidenceId:coverageEvidenceId,
   revision:1,zoneTag:'MOTO_ASUNCION',
   origin:{lat:-25.3,lon:-57.63},
   destination:{lat:-25.31,lon:-57.6},verifiedAtMs:now-1000
  }),
  verifyCargoTolls:async()=>({
   source:'INDEPENDENT_TOLL_AUTHORITY',tollsVerified:true,
   deliveryId,vehicleKind:'MOTO',coverageEvidenceId,
   distanceMeters:5300,durationSeconds:690,tollsPyg:0,
   evidenceId:uuid(5),verifiedAtMs:now-1000
  }),
  request:async()=>{http++;return {
   ok:true,status:200,redirected:false,
   headers:{get:key=>key==='content-type'?'application/json':null},
   text:async()=>JSON.stringify({results:[{distance:5300,
    time:689.2,distance_units:'meters',toll:false}]})
  }; }
 });
 const payload={actorId,deliveryId,vehicleKind:'MOTO',
  pickupTag:'PICKUP_EAST',deliveryTag:'DELIVERY_WEST'};
 assert.equal((await f(payload)).routingVerified,true);
 await assert.rejects(f(payload),/quota/);
 assert.equal(reserved,2);
 assert.equal(http,1);
});
