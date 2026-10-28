import test from 'node:test';
import assert from 'node:assert/strict';
import {createG112ScopedAutoDispatchRepository as create}
 from './g112-scoped-auto-dispatch-repository.mjs';
const u=x=>'11200000-0000-4112-8112-'+String(x).padStart(12,'0');
const input={passengerId:u(1),bookingKey:u(2),tripId:u(3)};
test('G112 backend sends only the verified Passenger+booking+trip SQL scope',async()=>{
 const calls=[];
 const repo=create({rpc:async (name,args)=>{
  calls.push({name,args});
  return {data:{mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
   status:'WAITING',tripId:input.tripId,offerId:null},error:null};
 }});
 assert.equal((await repo.runForBooking(input)).status,'WAITING');
 assert.deepEqual(calls,[{
  name:'mobility_stage_g112_run_booked_auto_dispatch_qa',
  args:{_passenger_id:input.passengerId,_booking_key:input.bookingKey,
   _trip_id:input.tripId}
 }]);
});
test('G112 fails closed for bad identity, missing RPC and LIVE-like return',async()=>{
 assert.throws(()=>create());
 let calls=0;
 const repo=create({rpc:async()=>{
  calls++;return {data:{mode:'LIVE',commercialEnabled:true},error:null};
 }});
 await assert.rejects(repo.runForBooking(input));
 for(const bad of [
  {...input,bookingKey:'invalid'},{...input,passengerId:null},
  {...input,tripId:'invalid'}])
  await assert.rejects(repo.runForBooking(bad));
 assert.equal(calls,1);
});
