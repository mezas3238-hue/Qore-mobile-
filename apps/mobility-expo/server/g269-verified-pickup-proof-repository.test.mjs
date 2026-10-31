import test from 'node:test';
import assert from 'node:assert/strict';
import {createG269VerifiedPickupProofRepository} from './g269-verified-pickup-proof-repository.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const scope={
 passengerId:id(101),bookingKey:id(201),tripId:id(202),driverId:id(103),
 vehicleId:id(303),proofKey:id(401)
};
const at=Date.parse('2026-10-31T18:00:00Z');
const proof={routingVerified:true,coverageVerified:true,fallbackUsed:false,
 trafficAware:true,provider:'GEOAPIFY',passengerId:scope.passengerId,
 bookingKey:scope.bookingKey,proofKey:scope.proofKey,
 tripId:scope.tripId,driverId:scope.driverId,vehicleId:scope.vehicleId,
 pickupRoadMeters:2300,verifiedAtMs:at-5000};
function make(patch={},extra={}){
 const calls=[],resolved=[];
 const r=createG269VerifiedPickupProofRepository({
  db:{rpc:async (name,args)=>{
   calls.push({name,args});
   return extra.error?{data:null,error:{message:'private'}}:
    {data:id(500),error:null};}},
  resolveVerifiedRoadPickup:async p=>{
   resolved.push(p);return {...proof,...patch};
  },
  now:()=>at
 });
 return {r,calls,resolved};
}
test('G269 attested candidate stores real verified road distance, never client GPS estimates',async()=>{
 const f=make();
 assert.deepEqual(await f.r.registerCandidate(scope),
 {id:id(500),mode:'STAGING_DEMO_ONLY',qaOnly:true,commercialEnabled:false});
 assert.equal(f.resolved.length,1);
 assert.equal(f.calls.length,1);
 assert.deepEqual(f.calls[0],{
  name:'mobility_stage_g269_register_pickup_road_proof',
  args:{_passenger_id:scope.passengerId,_booking_key:scope.bookingKey,
   _trip_id:scope.tripId,_driver_id:scope.driverId,
   _vehicle_id:scope.vehicleId,_proof_key:scope.proofKey,
   _provider:'GEOAPIFY',_pickup_road_meters:2300,
   _verified_at:new Date(at-5000).toISOString()}
 });
});
test('G269 never stores untrusted provider, fallback, stale or mismatched identity',async()=>{
 const changes=[
  {routingVerified:false},{coverageVerified:false},{fallbackUsed:true},
  {trafficAware:false},{provider:'STRAIGHT_LINE'},
  {passengerId:id(102)},{bookingKey:id(555)},
  {proofKey:id(444)},{bookingKey:undefined},{proofKey:undefined},
  {tripId:id(666)},{driverId:id(104)},
  {vehicleId:id(304)},{pickupRoadMeters:0},
  {pickupRoadMeters:50001},{pickupRoadMeters:2.5},
  {verifiedAtMs:at-31000},{verifiedAtMs:at+2100}
 ];
 for(const p of changes){
  const t=make(p);
  await assert.rejects(t.r.registerCandidate(scope));
  assert.equal(t.calls.length,0,JSON.stringify(p));
 }
});
test('G269 rejects forged or extra request fields before invoking external route provider',async()=>{
 const t=make();
 for(const bad of [
  {...scope,passengerId:'bad'},
  {...scope,driverId:scope.passengerId},
  {...scope,meters:300},
  {...scope,provider:'GOOGLE_MAPS'},
  {...scope,proofKey:null}
 ]){
  await assert.rejects(t.r.registerCandidate(bad));
 }
 assert.equal(t.resolved.length,0);
});
test('G269 SQL provider failure and production intent fail closed',async()=>{
 await assert.rejects(make({}, {error:true}).r.registerCandidate(scope));
 assert.throws(()=>createG269VerifiedPickupProofRepository({
  qaOnly:true,liveEnabled:true,db:{rpc(){}},
  resolveVerifiedRoadPickup:async()=>proof
 }));
});
