import test from 'node:test';
import assert from 'node:assert/strict';
import {createG81BookedAutoOfferRepository} from './g81-f1-booking-offer-repository.mjs';
const passengerId='81810000-0000-4818-8818-000000000001';
const driverId='00000000-0000-4000-8000-000000000181';
const bookingKey='81810000-0000-4818-8818-000000000012';
const vehicleId='71710000-0000-4717-8717-000000000101';
const offerKey='81810000-0000-4818-8818-000000000013';
const input={passengerId,driverId,bookingKey,vehicleId,offerKey,ttlSeconds:15};
test('G81 resolves G73 booking in SQL rather than accepting a client tripId',async()=>{
 const calls=[];
 const db={rpc:async(name,args)=>{
  calls.push({name,args});
  return {data:offerKey,error:null};
 }};
 const adapter=createG81BookedAutoOfferRepository(db);
 assert.deepEqual(await adapter.offerBookedAuto(input),{
  offerId:offerKey,pushDelivered:false,commercialRidesEnabled:false
 });
 assert.deepEqual(calls,[{
  name:'mobility_stage_g81_offer_booked_auto',
  args:{_passenger_id:passengerId,_booking_key:bookingKey,
   _driver_id:driverId,_vehicle_id:vehicleId,_offer_key:offerKey,_ttl_seconds:15}
 }]);
});
test('G81 fails closed on invalid identities, forged trip, TTL and DB failures',async()=>{
 let called=false;
 const adapter=createG81BookedAutoOfferRepository({
  rpc:async()=>{called=true;return {data:null,error:{message:'denied'}}}
 });
 for(const args of [
  {...input,tripId:bookingKey},
  {...input,passengerId:driverId},
  {...input,bookingKey:'bad'},
  {...input,ttlSeconds:31},
  {...input,ttlSeconds:0}
 ])await assert.rejects(adapter.offerBookedAuto(args));
 assert.equal(called,false,'Invalid or extra fields must never reach SQL');
 await assert.rejects(adapter.offerBookedAuto(input),/SQL offer denied/);
 await assert.rejects(createG81BookedAutoOfferRepository({
  rpc:async()=>({data:13,error:null})
 }).offerBookedAuto(input),/SQL offer denied/);
});
