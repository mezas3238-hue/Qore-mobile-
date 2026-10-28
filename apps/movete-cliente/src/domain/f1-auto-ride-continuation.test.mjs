import test from 'node:test';
import assert from 'node:assert/strict';
import {createF1AutoRideContinuation} from './f1-auto-ride-continuation.mjs';
const id=n=>'61610000-0000-4616-8616-'+String(n).padStart(12,'0');
const owner=id(1),trip=id(2),foreign=id(3);
const make=()=>({
 authenticated:true,privateViewRevision:5,
 account:{subject:owner,role:'passenger'},
 autoPrequote:{phase:'confirmed',tripId:trip},
 rideContinuation:{canVerify:true,tripId:trip,qaOnly:true,productionEnabled:false},
 tracking:{subscriptionActive:false,tripId:null,revision:null}
});
function scenario({initial=make(),changeOnRead=null,foreground=true}={}){
 let snap=initial,verifies=0,opened=[],errors=[],busy=[];
 const app=createF1AutoRideContinuation({
  readSnapshot:()=>snap,
  verifyRide:async()=>{
   verifies++;
   if(changeOnRead){snap=changeOnRead(snap);return {ok:true,tripId:trip};}
   snap={...snap,tracking:{subscriptionActive:true,tripId:trip,revision:2}};
   return {ok:true,tripId:trip};
  },
  isForeground:()=>foreground,onVerified:t=>opened.push(t),
  onFailure:e=>errors.push(e),onBusy:x=>busy.push(x)
 });
 return {app,set:x=>snap=x,get:()=>snap,verifies:()=>verifies,
  opened:()=>opened,errors:()=>errors,busy:()=>busy,
  setForeground:x=>foreground=x};
}
test('F1 one confirmed G73 booking produces one authorized status GET, then tracking',async()=>{
 const f=scenario();
 const result=await f.app.tryResume();
 assert.equal(result.ok,true);
 assert.deepEqual(f.opened(),[trip]);
 assert.equal(f.verifies(),1);
 assert.deepEqual(f.busy(),[true,false]);
 assert.equal((await f.app.tryResume()).ok,false);
 assert.equal(f.verifies(),1);
});
test('F1 no automatic GET for unsigned, unconfirmed, foreign, mismatched or expired scope',async()=>{
 const x=make();
 for(const bad of [
  {...x,authenticated:false},
  {...x,account:{...x.account,role:'driver'}},
  {...x,autoPrequote:{phase:'accepted',tripId:trip}},
  {...x,autoPrequote:{phase:'ambiguous',tripId:trip}},
  {...x,rideContinuation:{...x.rideContinuation,canVerify:false}},
  {...x,rideContinuation:{...x.rideContinuation,tripId:foreign}},
  {...x,rideContinuation:{...x.rideContinuation,qaOnly:false}},
  {...x,rideContinuation:{...x.rideContinuation,productionEnabled:true}},
  {...x,tracking:{subscriptionActive:true,tripId:trip,revision:2}},
  {...x,autoPrequote:{phase:'confirmed',tripId:'bad'}}
 ]){
  const f=scenario({initial:bad});
  assert.equal((await f.app.tryResume()).ok,false);
  assert.equal(f.verifies(),0);
  assert.deepEqual(f.opened(),[]);
 }
});
test('F1 late status GET cannot navigate after changed passenger, JWT or ride',async()=>{
 for(const changed of [
  s=>({...s,account:{role:'passenger',subject:foreign}}),
  s=>({...s,privateViewRevision:6}),
  s=>({...s,autoPrequote:{phase:'confirmed',tripId:foreign}}),
  s=>({...s,tracking:{subscriptionActive:true,tripId:foreign,revision:2}})
 ]){
  const f=scenario({changeOnRead:changed});
  assert.equal((await f.app.tryResume()).ok,false);
  assert.deepEqual(f.opened(),[]);
  assert.equal(f.verifies(),1);
 }
});
test('F1 offline and invalid GET cannot falsely open tracking or retry a booking',async()=>{
 let calls=0,opened=0,errors=0;
 const ctl=createF1AutoRideContinuation({
  readSnapshot:make,
  verifyRide:async()=>{calls++;throw Error('503 network unavailable');},
  onVerified:()=>opened++,onFailure:()=>errors++
 });
 assert.equal((await ctl.tryResume()).ok,false);
 assert.equal((await ctl.tryResume()).ok,false);
 assert.equal(calls,1);assert.equal(opened,0);assert.equal(errors,1);
});
test('F1 background does not attempt any GET; verified foreground read can resume',async()=>{
 const f=scenario({foreground:false});
 assert.equal((await f.app.tryResume()).code,'AUTO_CONTINUATION_BACKGROUND');
 assert.equal(f.verifies(),0);
 f.setForeground(true);
 assert.equal((await f.app.tryResume()).ok,true);
 assert.equal(f.verifies(),1);
});
test('F1 backgrounding midflight defers navigation even with same verified trip',async()=>{
 let done,readCount=0,opens=0,active=true;
 const pending=new Promise(resolve=>done=resolve);
 let snap=make();
 const ctl=createF1AutoRideContinuation({
  readSnapshot:()=>snap,isForeground:()=>active,
  verifyRide:async()=>{readCount++;await pending;
   snap={...snap,tracking:{subscriptionActive:true,tripId:trip,revision:2}};
   return {ok:true,tripId:trip};},
  onVerified:()=>opens++
 });
 const flight=ctl.tryResume();
 active=false;done();
 assert.equal((await flight).deferredNavigation,true);
 assert.equal(opens,0);assert.equal(readCount,1);
});
test('F1 unmount while awaiting status never navigates',async()=>{
 let done,navigations=0;
 const pending=new Promise(resolve=>done=resolve);
 let snap=make();
 const ctl=createF1AutoRideContinuation({
  readSnapshot:()=>snap,
  verifyRide:async()=>{await pending;
   snap={...snap,tracking:{subscriptionActive:true,tripId:trip,revision:2}};
   return {ok:true,tripId:trip};},
  onVerified:()=>navigations++
 });
 const flight=ctl.tryResume();
 ctl.close();done();
 assert.equal((await flight).code,'AUTO_CONTINUATION_CLOSED');
 assert.equal(navigations,0);
});
