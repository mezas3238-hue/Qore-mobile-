import test from 'node:test';
import assert from 'node:assert/strict';
import {createF1FocusedTrackingSync} from './f1-focused-tracking-sync.mjs';

const id=n=>'f1111111-1111-4111-8111-'+String(n).padStart(12,'0');
const subject=id(1),trip=id(2);
const fresh=()=>({
 authenticated:true,account:{subject,role:'passenger'},privateViewRevision:3,
 rideContinuation:{canVerify:true,tripId:trip,qaOnly:true,productionEnabled:false},
 tracking:{subscriptionActive:true,tripId:trip,state:'searching',syncing:false}
});
function harness({initial=fresh(),sync=async()=>({ok:true})}={}){
 let state=initial,hits=0,schedules=0,cancels=0,interval=null;
 const syncTracking=async()=>{hits++;return sync();};
 const loop=createF1FocusedTrackingSync({
  readSnapshot:()=>state,syncTracking,
  schedule:(cb,ms)=>{schedules++;assert.equal(ms,12000);
   interval={cb,cancelled:false};return interval;},
  cancel:item=>{cancels++;item.cancelled=true;}
 });
 const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
 return {loop,setState:next=>state=next,view:()=>state,
  hits:()=>hits,schedules:()=>schedules,cancels:()=>cancels,
  fire:async()=>{if(interval&&!interval.cancelled)await interval.cb();await flush();},
  flush,wasCancelled:()=>interval?.cancelled===true};
}
test('F1 no booking/certification, unknown passenger, or inactive trip means zero timer and zero GET',()=>{
 for(const bad of [
  {...fresh(),authenticated:false},
  {...fresh(),account:{subject,role:'driver'}},
  {...fresh(),rideContinuation:{...fresh().rideContinuation,canVerify:false}},
  {...fresh(),rideContinuation:{...fresh().rideContinuation,productionEnabled:true}},
  {...fresh(),rideContinuation:{...fresh().rideContinuation,tripId:id(3)}},
  {...fresh(),tracking:{...fresh().tracking,subscriptionActive:false}},
  {...fresh(),tracking:{...fresh().tracking,tripId:null}},
  {...fresh(),tracking:{...fresh().tracking,state:'completed'}},
  {...fresh(),tracking:{...fresh().tracking,state:'cancelled'}},
  {...fresh(),tracking:{...fresh().tracking,state:'failed'}}
 ]){
  const h=harness({initial:bad});
  assert.equal(h.loop.start().code,'TRACKING_NOT_CERTIFIED');
  assert.equal(h.hits(),0);
  assert.equal(h.schedules(),0);
 }
});
test('F1 focus starts exactly one authorized GET and scheduled server re-reads',async()=>{
 const h=harness();
 assert.equal(h.loop.start().ok,true);
 assert.equal(h.loop.isActive(),true);
 assert.equal(h.schedules(),1);
 await h.flush();
 assert.equal(h.hits(),1);
 await h.fire();assert.equal(h.hits(),2);
 await h.fire();assert.equal(h.hits(),3);
 assert.equal(h.schedules(),1);
 assert.equal(h.loop.start().code,'TRACKING_ALREADY_FOCUSED');
 h.loop.stop();
 assert.equal(h.cancels(),1);
 await h.fire();assert.equal(h.hits(),3);
});
test('F1 blur cancels scheduled reads while a GET may still be outstanding',async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve;});
 const h=harness({sync:()=>pending});
 h.loop.start();await h.flush();assert.equal(h.hits(),1);
 await h.fire();assert.equal(h.hits(),1,'overlapping GET forbidden');
 h.loop.stop();assert.equal(h.wasCancelled(),true);
 release({ok:true});await h.flush();
 assert.equal(h.loop.isActive(),false);
 await h.fire();assert.equal(h.hits(),1);
});
test('F1 a completed ride automatically clears interval and never retries after completion',async()=>{
 const h=harness({sync:async()=>{h.setState({...fresh(),
  tracking:{...fresh().tracking,state:'completed'}});return {ok:true};}});
 h.loop.start();await h.flush();
 assert.equal(h.hits(),1);
 assert.equal(h.loop.isActive(),false);
 assert.equal(h.wasCancelled(),true);
 await h.fire();assert.equal(h.hits(),1);
});
test('F1 same account with new JWT privacy epoch cancels previous trip polling',async()=>{
 const h=harness();h.loop.start();await h.flush();
 h.setState({...fresh(),privateViewRevision:4});
 await h.fire();
 assert.equal(h.loop.isActive(),false);
 assert.equal(h.hits(),1);
 assert.equal(h.wasCancelled(),true);
});
test('F1 changed Passenger or trip ID cannot continue old background timer',async()=>{
 for(const changed of [
  {...fresh(),account:{subject:id(9),role:'passenger'}},
  {...fresh(),tracking:{...fresh().tracking,tripId:id(8)}},
  {...fresh(),tracking:{...fresh().tracking,subscriptionActive:false}},
  {...fresh(),rideContinuation:{...fresh().rideContinuation,canVerify:false}}
 ]){
  const h=harness();h.loop.start();await h.flush();
  h.setState(changed);await h.fire();
  assert.equal(h.hits(),1);
  assert.equal(h.loop.isActive(),false);
 }
});
test('F1 503/offline errors never imply completed and allow new read while foreground remains valid',async()=>{
 let errors=0;
 const h=harness({sync:async()=>{errors++;return {ok:false,code:'SERVICE_UNAVAILABLE'};}});
 h.loop.start();await h.flush();assert.equal(h.hits(),1);
 assert.equal(h.loop.isActive(),true);
 await h.fire();assert.equal(h.hits(),2);
 assert.equal(errors,2);
 h.loop.stop();
});
test('F1 reject unsafe frequency and invalid configuration',()=>{
 for(const intervalMs of [0,100,1000,7999,60001,NaN,null]){
  assert.throws(()=>createF1FocusedTrackingSync({
   readSnapshot:fresh,syncTracking:async()=>{},intervalMs
  }));
 }
 assert.throws(()=>createF1FocusedTrackingSync({readSnapshot:null}));
});
