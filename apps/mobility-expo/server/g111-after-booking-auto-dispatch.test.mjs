import test from 'node:test';
import assert from 'node:assert/strict';
import {createG111AfterBookingAutoDispatch as create}
 from './g111-after-booking-auto-dispatch.mjs';
const id=n=>'11100000-0000-4111-8111-'+String(n).padStart(12,'0');
const passenger=id(1),bookingKey=id(2),tripId=id(3),other=id(4);
const input={passengerId:passenger,bookingKey,tripId};
function receipt({state='SEARCHING_DRIVER',attempts=0,actor=passenger,
 key=bookingKey,trip=tripId}={}){return {
 mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:actor,
 bookingKey:key,tripId:trip,tripState:'searching',
 dispatchState:state,attempts,
 offerPendingAcceptance:state==='OFFER_PENDING'
};}
const response=(status='WAITING',id=tripId)=>({
 mode:'STAGING_DEMO_ONLY',commercialEnabled:false,status,tripId:id,
 offerId:status==='OFFERED'?other:null
});
function build({statuses=[receipt(),receipt({state:'RETRY_PENDING',attempts:1})],
 result=response(),error=false}={}){
 let reads=0,workers=0;
 const runner=create({environment:'isolated_staging',qaOnly:true,
  liveEnabled:false,readPrivateDispatchStatus:async scope=>{
   assert.deepEqual(scope,{actorId:passenger,requestKey:bookingKey});
   return statuses[Math.min(reads++,statuses.length-1)];
  },runOneDueDispatch:async()=>{workers++;
   if(error)throw Error('SQL worker disconnected');
   return result;
  }});
 return {runner,reads:()=>reads,workers:()=>workers};
}
test('G111 real G85 WAITING advances only the owner-scoped G73 booking once',async()=>{
 const x=build();
 const result=await x.runner.dispatchBookedAuto(input);
 assert.deepEqual(result,{ok:true,dispatchState:'RETRY_PENDING',
  attemptExecuted:true,qaOnly:true,productionEnabled:false});
 assert.equal(x.reads(),2);assert.equal(x.workers(),1);
 assert(!JSON.stringify(result).includes(passenger));
 assert(!JSON.stringify(result).includes(other));
});
test('G111 private offer is NOT a confirmed Driver acceptance',async()=>{
 const x=build({statuses:[receipt(),
  receipt({state:'OFFER_PENDING',attempts:1})],
  result:response('OFFERED')});
 const r=await x.runner.dispatchBookedAuto(input);
 assert.equal(r.ok,true);assert.equal(r.dispatchState,'OFFER_PENDING');
 assert.equal(r.attemptExecuted,true);
 assert(!Object.hasOwn(r,'driverId'));
 assert(!Object.hasOwn(r,'offerId'));
});
test('G111 idempotent booking never triggers second worker',async()=>{
 for(const state of ['RETRY_PENDING','OFFER_PENDING','SEARCH_EXHAUSTED','CLOSED']){
  const x=build({statuses:[receipt({state})]});
  const r=await x.runner.dispatchBookedAuto(input);
  assert.equal(r.ok,true);assert.equal(r.attemptExecuted,false);
  assert.equal(x.workers(),0);assert.equal(x.reads(),1);
 }
});
test('G111 rejects owner misbinding and false SQL outcomes',async()=>{
 for(const status of [
  receipt({actor:other}),receipt({trip:other}),receipt({key:other}),
  {...receipt(),productionEnabled:true},null
 ]){
  const x=build({statuses:[status]});
  const r=await x.runner.dispatchBookedAuto(input);
  assert.equal(r.ok,false);assert.equal(x.workers(),0);
 }
 for(const result of [response('WAITING',other),
  response('OFFERED',other),{...response(),commercialEnabled:true},
  {mode:'STAGING_DEMO_ONLY',commercialEnabled:false,status:'OFFERED',
   tripId,offerId:null}]){
  const x=build({result});
  assert.equal((await x.runner.dispatchBookedAuto(input)).ok,false);
 }
});
test('G111 never claims dispatch success when G85 worker or G90 read fails',async()=>{
 const x=build({error:true});
 assert.deepEqual((await x.runner.dispatchBookedAuto(input)).reason,
  'WORKER_UNCERTAIN_RECONCILE_G90');
 const missed=build({statuses:[receipt(),receipt()]});
 assert.deepEqual((await missed.runner.dispatchBookedAuto(input)).reason,
  'BACKOFF_NOT_PERSISTED');
 const wrong=build({statuses:[receipt(),
  receipt({state:'OFFER_PENDING',attempts:1})]});
 assert.deepEqual((await wrong.runner.dispatchBookedAuto(input)).reason,
  'BACKOFF_NOT_PERSISTED');
});
test('G111 Driver or mobile cannot override private booking actor',async()=>{
 const x=build();
 for(const invalid of [
  {...input,passengerId:'invalid'}, {...input,bookingKey:other,tripId:'wrong'},
  {...input,tripId:passenger},{...input,passengerId:null}
 ]){
  assert.equal((await x.runner.dispatchBookedAuto(invalid)).ok,false);
 }
 assert.equal(x.workers(),0);assert.equal(x.reads(),0);
 assert.throws(()=>create());
});
