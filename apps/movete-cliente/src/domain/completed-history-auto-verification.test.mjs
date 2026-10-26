import test from 'node:test';
import assert from 'node:assert/strict';
import {claimCompletedHistoryAutoVerification as claim}
 from './completed-history-auto-verification.mjs';
const id=n=>'11000000-0000-4110-8110-'+String(n).padStart(12,'0');
const owner=id(1),trip=id(2);
const ready=()=>({
 authenticated:true,account:{subject:owner,role:'passenger'},
 privateViewRevision:4,
 tracking:{tripId:trip,state:'completed',revision:5,
  subscriptionActive:true,syncing:false},
 rideContinuation:{canVerify:true,tripId:trip,qaOnly:true,productionEnabled:false},
 completedRideHistory:{readReady:true,verified:false,verifying:false,tripId:trip}
});
test('F1/G110 claims only once per verified completed Passenger trip revision',()=>{
 const first=claim(ready());
 assert.equal(first.ok,true);
 assert.equal(claim(ready(),first.key).reason,'ALREADY_ATTEMPTED');
 assert.equal(claim({...ready(),privateViewRevision:5},first.key).ok,true);
 assert.equal(claim({...ready(),tracking:{...ready().tracking,
  tripId:id(3)},completedRideHistory:{...ready().completedRideHistory,
  tripId:id(3)},rideContinuation:{...ready().rideContinuation,tripId:id(3)}},
  first.key).ok,true);
 assert.equal(claim({...ready(),tracking:{...ready().tracking,revision:6}},
  first.key).ok,true);
});
test('F1/G110 no history call without current signed-in final G4 status',()=>{
 for(const view of [
  {...ready(),authenticated:false},
  {...ready(),account:{subject:owner,role:'driver'}},
  {...ready(),account:{subject:'wrong',role:'passenger'}},
  {...ready(),tracking:{...ready().tracking,state:'in_progress'}},
  {...ready(),tracking:{...ready().tracking,state:'cancelled'}},
  {...ready(),tracking:{...ready().tracking,state:'searching'}},
  {...ready(),tracking:{...ready().tracking,subscriptionActive:false}},
  {...ready(),tracking:{...ready().tracking,syncing:true}},
  {...ready(),tracking:{...ready().tracking,tripId:id(3)}},
  {...ready(),tracking:{...ready().tracking,revision:1}},
  {...ready(),rideContinuation:{...ready().rideContinuation,canVerify:false}},
  {...ready(),rideContinuation:{...ready().rideContinuation,tripId:id(3)}},
  {...ready(),completedRideHistory:{...ready().completedRideHistory,readReady:false}},
  {...ready(),completedRideHistory:{...ready().completedRideHistory,verified:true}},
  {...ready(),completedRideHistory:{...ready().completedRideHistory,verifying:true}},
  {...ready(),completedRideHistory:{...ready().completedRideHistory,tripId:id(3)}}
 ])assert.equal(claim(view).ok,false);
});
test('F1/G110 no retries after unknown server result, but separate manual read remains',()=>{
 const first=claim(ready());
 assert.equal(first.ok,true);
 assert.equal(claim(ready(),first.key).ok,false);
 assert(!first.key.includes('Bearer'));
 assert(!first.key.includes('token'));
});
