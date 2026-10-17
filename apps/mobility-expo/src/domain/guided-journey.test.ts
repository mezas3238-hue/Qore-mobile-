import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceJourney,guideJourney,initialRideState,nextJourneyAction} from './guided-journey.ts';
import {rideReducer,formatGs} from './rides.ts';

test('E2E SIMULATED: rider requests -> demo driver accepts -> arrives -> starts -> completes -> illustrative receipt',()=>{
 let state=initialRideState;
 const steps=['request','accept','arrive','start','complete','receipt'];
 const actors=['pasajero','conductor','conductor','conductor','conductor','sistema-demo'];
 for(let i=0;i<steps.length;i++){
  const guide=guideJourney(state);
  assert.equal(guide.phase,steps[i]);
  assert.equal(guide.actor,actors[i]);
  assert.equal(guide.index,i);
  assert.equal(guide.commercialRidesEnabled,false);
  assert.equal(guide.paymentsEnabled,false);
  assert.equal(guide.usesRealGps,false);
  if(i!==steps.length-1){
   const next=advanceJourney(state);
   assert.notEqual(next,state,'Step must actually advance');
   assert.equal(next.rides.length,1,'One ride only');
   state=next;
  }
 }
 const ride=state.rides[0];
 assert.equal(ride.stage,'completed');
 assert.equal(ride.category,'economico');
 assert.equal(ride.driver?.plate,'DEMO-123');
 assert.ok(ride.quote.priceGs>0);
 assert.match(formatGs(ride.quote.priceGs),/^Gs\./);
 assert.equal(nextJourneyAction(state),null);
 assert.equal(advanceJourney(state),state,'receipt must not secretly charge/start new ride');
});
test('offline demo cannot accept ride while simulated driver is unavailable',()=>{
 let state=advanceJourney(initialRideState);
 state=rideReducer(state,{type:'availability',available:false});
 assert.equal(guideJourney(state).phase,'accept');
 assert.equal(nextJourneyAction(state),null);
 assert.equal(advanceJourney(state),state);
 state=rideReducer(state,{type:'availability',available:true});
 assert.equal(guideJourney(advanceJourney(state)).phase,'arrive');
});
test('user cancellation closes walkthrough without fake receipt and no new live trip',()=>{
 let state=advanceJourney(initialRideState);
 const pending=state.rides[0];
 state=rideReducer(state,{type:'cancel',id:pending.id});
 assert.equal(guideJourney(state).phase,'cancelled');
 assert.equal(guideJourney(state).paymentsEnabled,false);
 assert.equal(advanceJourney(state),state);
 state=rideReducer(state,{type:'reset'});
 assert.equal(guideJourney(state).phase,'request');
});
test('cannot skip required driver transitions by pressing guided button repeatedly out of order',()=>{
 let state=advanceJourney(initialRideState);
 const rideId=state.rides[0].id;
 assert.equal(rideReducer(state,{type:'complete',id:rideId}),state);
 assert.equal(rideReducer(state,{type:'start',id:rideId}),state);
 assert.equal(rideReducer(state,{type:'arrive',id:rideId}),state);
 assert.equal(guideJourney(state).phase,'accept');
 const progressed=advanceJourney(state);
 assert.equal(progressed.rides[0].stage,'accepted');
 assert.equal(guideJourney(progressed).phase,'arrive');
});
test('all stages are derived from SAME shared reducer state for passenger and driver views',()=>{
 const pending=advanceJourney(initialRideState);
 const accepted=rideReducer(pending,{type:'accept',id:pending.rides[0].id});
 assert.equal(guideJourney(accepted).phase,'arrive');
 const arrived=advanceJourney(accepted);
 const underway=advanceJourney(arrived);
 assert.equal(underway.rides[0].stage,'in_progress');
 const done=advanceJourney(underway);
 assert.equal(done.rides[0].stage,'completed');
 assert.equal(guideJourney(done).phase,'receipt');
});
