import test from 'node:test';
import assert from 'node:assert/strict';
import {createG115LocalQaAutoDispatchRuntime as create}
 from './g115-local-qa-auto-dispatch-runtime.mjs';
const passenger='11500000-0000-4115-8115-000000000001';
const bookingKey='11500000-0000-4115-8115-000000000002';
const tripId='11500000-0000-4115-8115-000000000003';
function setup(foreign=false){
 let attempts=0,one=0,due=0,cb,stops=0;
 const rpc=[];
 const client={rpc:async(name,input)=>{
  rpc.push({name,input});
  if(name==='mobility_stage_g112_run_booked_auto_dispatch_qa'){
   one++;attempts++;
   return {data:{mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
    status:'WAITING',tripId,offerId:null},error:null};
  }
  if(name==='mobility_stage_g113_run_due_auto_batch_qa'){
   due++;return {data:{mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
    processed:1,waiting:1,offered:0,closed:0,exhausted:0},error:null};
  }
  throw Error('Unapproved SQL');
 }};
 const service=create({environment:'isolated_staging',qaOnly:true,
  liveEnabled:false,client,intervalMs:30000,maxJobs:2,
  readPrivateDispatchStatus:async()=>({
   mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
   ownerId:foreign?tripId:passenger,bookingKey,tripId,tripState:'searching',
   dispatchState:attempts?'RETRY_PENDING':'SEARCHING_DRIVER',
   attempts,offerPendingAcceptance:false
  }),
  schedule:(f,ms)=>{assert.equal(ms,30000);cb=f;return {unref(){}};},
  cancel:()=>{stops++;}
 });
 return {service,rpc,one:()=>one,due:()=>due,fire:()=>cb?.(),stops:()=>stops};
}
const settle=async s=>{for(let i=0;i<12&&s.snapshot().busy;i++)
 await new Promise(r=>setImmediate(r));assert.equal(s.snapshot().busy,false);};
test('G115 local G73->G111->G112 and timed G113 SQL run and stop',async()=>{
 const f=setup(),scope={passengerId:passenger,bookingKey,tripId};
 const first=await f.service.dispatchBookedAuto(scope);
 assert.equal(first.ok,true);assert.equal(first.dispatchState,'RETRY_PENDING');
 assert.equal((await f.service.dispatchBookedAuto(scope)).attemptExecuted,false);
 assert.equal(f.one(),1);
 assert.deepEqual(f.rpc[0],{name:'mobility_stage_g112_run_booked_auto_dispatch_qa',
  input:{_passenger_id:passenger,_booking_key:bookingKey,_trip_id:tripId}});
 assert.equal(f.service.start(),true);await settle(f.service);
 assert.equal(f.due(),1);assert.equal(f.service.snapshot().successes,1);
 f.fire();await settle(f.service);assert.equal(f.due(),2);
 assert.deepEqual(f.rpc.at(-1),{
  name:'mobility_stage_g113_run_due_auto_batch_qa',input:{_limit:2}
 });
 f.service.stop();f.fire();await settle(f.service);
 assert.equal(f.due(),2);assert.equal(f.stops(),1);
 assert.equal(f.service.snapshot().productionEnabled,false);
});
test('G115 denies wrong Passenger and unsafe runtime modes',async()=>{
 const wrong=setup(true);
 assert.equal((await wrong.service.dispatchBookedAuto({
  passengerId:passenger,bookingKey,tripId})).reason,
  'UNVERIFIED_PERSISTED_BOOKING');
 assert.equal(wrong.one(),0);
 const normal=setup();
 assert.equal((await normal.service.dispatchBookedAuto({
  passengerId:'spoof',bookingKey,tripId})).reason,'UNVERIFIED_BOOKING_SCOPE');
 const client={rpc:async()=>({})},readPrivateDispatchStatus=async()=>({});
 for(const bad of [{liveEnabled:true},{qaOnly:false},
  {environment:'production'},{client:null},{readPrivateDispatchStatus:null}]){
  assert.throws(()=>create({environment:'isolated_staging',qaOnly:true,
   liveEnabled:false,client,readPrivateDispatchStatus,...bad}));
 }
});
