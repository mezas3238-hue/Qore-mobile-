import test from 'node:test';
import assert from 'node:assert/strict';
import {createG125CargoPricingContext} from './g125-cargo-pricing-context.mjs';
const S='12500000-0000-4125-8125-000000000001';
const D='12500000-0000-4125-8125-000000000002';
const E='12500000-0000-4125-8125-000000000003';
const now=1790000000000;
const row={id:D,sender_id:S,requested_vehicle_kind:'MOTO',
 status:'requested',courier_id:null,pickup_tag:'PICKUP_EAST',
 delivery_tag:'DELIVERY_WEST'};
const proof={source:'INDEPENDENT_ROAD_ROUTING_AUTHORITY',
 coverageVerified:true,routingVerified:true,tollsVerified:true,
 trafficAware:true,fallbackUsed:false,actorId:S,deliveryId:D,
 vehicleKind:'MOTO',pickupTag:'PICKUP_EAST',deliveryTag:'DELIVERY_WEST',
 evidenceId:E,zoneTag:'MOTO_ASUNCION',distanceMeters:5000,
 durationSeconds:700,tollsPyg:0,verifiedAtMs:now-1000,expiresAtMs:now+59000};
const params={actorId:S,fareMode:'DELIVERY',subjectKind:'DELIVERY',subjectId:D};
const ack={deliveryId:D,ownerId:S,evidenceId:E,vehicleKind:'MOTO',
 zoneTag:'MOTO_ASUNCION',distanceMeters:5000,durationSeconds:700,
 tollsPyg:0,routingVerified:true,liveEnabled:false,serverPersisted:true};
function fixture({delivery=row,route=proof,registered=ack}={}){
 let providerCalls=0,registerCalls=0;
 const resolve=createG125CargoPricingContext({
  enabled:true,now:()=>now,loadSenderDelivery:async()=>delivery,
  resolveVerifiedCargoRoute:async()=>{providerCalls++;return route;},
  recordVerifiedRoute:async()=>{registerCalls++;return registered;}
 });
 return {resolve,providerCalls:()=>providerCalls,registerCalls:()=>registerCalls};
}
test('G125 refuses cargo pricing without explicit trusted route provider',()=>{
 assert.throws(()=>createG125CargoPricingContext({
  enabled:false,loadSenderDelivery:async()=>row,
  resolveVerifiedCargoRoute:async()=>proof,recordVerifiedRoute:async()=>ack
 }),/not approved/);
});
test('G125 wrong sender/vehicle state never calls route authority',async()=>{
 for(const delivery of [null,{...row,sender_id:E},
  {...row,status:'accepted'},{...row,courier_id:E}]){
  const f=fixture({delivery});
  await assert.rejects(f.resolve(params));
  assert.equal(f.providerCalls(),0);assert.equal(f.registerCalls(),0);
 }
});
test('G125 wrong vehicle, forged metrics or expired provider proof denied',async()=>{
 for(const route of [{...proof,source:'CLIENT'},
  {...proof,actorId:E},{...proof,vehicleKind:'AUTO'},
  {...proof,zoneTag:'AUTO_ASUNCION'},
  {...proof,coverageVerified:false},{...proof,tollsVerified:false},
  {...proof,verifiedAtMs:now-60001},{...proof,expiresAtMs:now},
  {...proof,distanceMeters:0},{...proof,fallbackUsed:true}]){
  const f=fixture({route});
  await assert.rejects(f.resolve(params));assert.equal(f.registerCalls(),0);
 }
 const fail=fixture({registered:{...ack,vehicleKind:'AUTO'}});
 await assert.rejects(fail.resolve(params),/SQL route/);
 const ok=fixture();
 assert.deepEqual(await ok.resolve(params),{zoneTag:'MOTO_ASUNCION',
  distanceMeters:5000,durationSeconds:700,tollsPyg:0,
  trafficAware:true,fallbackUsed:false});
 assert.equal(ok.providerCalls(),1);assert.equal(ok.registerCalls(),1);
});
