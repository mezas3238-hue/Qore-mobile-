import test from 'node:test';
import assert from 'node:assert/strict';
import {projectAutoPrequoteScreen} from './f1-auto-prequote-screen-policy.mjs';
const now=1800000000000;
const quote={quoteId:'f1000000-0000-4100-8100-000000000004',
 amountGs:19500,currency:'PYG',fareVersion:'auto-qa-v1',expiresAt:now+120000};
const project=(phase,overrides={})=>projectAutoPrequoteScreen({
 now,authenticated:true,mutationPhase:'idle',
 prequote:{phase,quote,quoteAvailable:true,bookingAvailable:true,
 canAccept:phase==='quoted',canReserve:phase==='accepted',
 requiresReconciliation:phase==='ambiguous'},...overrides
});
test('default F1 UI is locked against unsupported or unknown backend states',()=>{
 const empty=projectAutoPrequoteScreen({now});
 assert.equal(empty.quote,null);assert.equal(empty.canAccept,false);
 assert.equal(empty.canReserve,false);assert.equal(empty.canEditRoute,false);
 const idle=project('idle');
 assert.equal(idle.canEditRoute,true);
 assert.equal(idle.amountLabel,null);
});
test('quote UI reveals only trusted PYG amount and requires separate explicit consent',()=>{
 const shown=project('quoted');
 assert.equal(shown.amountLabel,'Gs. 19.500');
 assert.equal(shown.canAccept,true);assert.equal(shown.canReserve,false);
 assert.equal(shown.canEditRoute,false);
 const approved=project('accepted');
 assert.equal(approved.canAccept,false);assert.equal(approved.canReserve,true);
 assert.equal(approved.canEditRoute,false);
});
test('an in-flight or ambiguous booking never allows route change, replay or local discard',()=>{
 for(const phase of ['sending','ambiguous','confirmed']){
  const ui=project(phase);
  assert.equal(ui.canEditRoute,false);
  assert.equal(ui.canReserve,false);
  assert.equal(ui.canDiscard,false);
 }
 assert.equal(project('ambiguous').canReconcile,true);
 assert.equal(project('sending').amountLabel,'Gs. 19.500');
});
test('no price/consent if quote is expired, non-PYG, unverified or session absent',()=>{
 for(const value of [
  {...quote,expiresAt:now},
  {...quote,currency:'USD'},
  {...quote,amountGs:0},
  {...quote,amountGs:19500.1},
  {...quote,quoteId:'not-a-uuid'}
 ]){
  const result=project('quoted',{prequote:{
   phase:'quoted',quote:value,quoteAvailable:true,bookingAvailable:true,
   canAccept:true,canReserve:true}});
  assert.equal(result.amountLabel,null);
  assert.equal(result.canAccept,false);
 }
 assert.equal(project('quoted',{authenticated:false}).canAccept,false);
 assert.equal(project('accepted',{mutationPhase:'prepared'}).canReserve,false);
 assert.equal(project('quoted',{prequote:{phase:'quoted',quote,quoteAvailable:false,
 bookingAvailable:true,canAccept:true,canReserve:true}}).amountLabel,null);
});
test('discard possible only before transport, and booking needs backend certification',()=>{
 assert.equal(project('ready').canDiscard,true);
 assert.equal(project('accepted').canDiscard,true);
 assert.equal(project('expired').canEditRoute,true);
 assert.equal(project('failed').canDiscard,true);
 const blocked=project('accepted',{prequote:{phase:'accepted',quote,
 quoteAvailable:true,bookingAvailable:false,canAccept:false,canReserve:false}});
 assert.equal(blocked.canReserve,false);
});
