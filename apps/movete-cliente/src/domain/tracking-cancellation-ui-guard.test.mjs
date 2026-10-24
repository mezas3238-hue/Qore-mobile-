import test from 'node:test';
import assert from 'node:assert/strict';
import {guardTrackingCancellationUiAction} from './tracking-cancellation-ui-guard.mjs';
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const create=({phase='idle',state='assigned',revision=4,tripId=id(1),
 subject=id(2),privateViewRevision=5,requestKey=null,contractReady=true,
 authenticated=true,syncing=false,subscriptionActive=true}={})=>({
 authenticated,account:{subject,role:'passenger'},privateViewRevision,
 tracking:{state,revision,tripId,syncing,subscriptionActive},
 cancellation:{phase,tripId:phase==='idle'?null:tripId,
  requestKey,contractReady}
});
const same=(x,y=x,action='prepare')=>
 guardTrackingCancellationUiAction(x,y,{action});
test('R54 allows local confirmation only on current server-authorized ride',()=>{
 const x=create();
 const r=same(x);
 assert.equal(r.ok,true);assert.equal(r.tripId,id(1));
 assert.equal(r.cancellationSent,false);assert.equal(r.refundConfirmed,false);
 assert.equal(r.driverAssignedByUi,false);
});
test('R54 rejects logout, role changes, different subject and JWT revision',()=>{
 const x=create();
 for(const changes of [
  {authenticated:false},{subject:id(99)},{privateViewRevision:6}
 ])assert.equal(same(x,create(changes)).code,'CANCEL_SESSION_CHANGED');
 const driver=create();
 driver.account.role='driver';
 assert.equal(same(x,driver).code,'CANCEL_SESSION_CHANGED');
});
test('R54 different trip id, status or revision rejects previous screen',()=>{
 const old=create();
 for(const changed of [{tripId:id(3)},{state:'arriving'},{revision:5}]){
  assert.equal(same(old,create(changed)).code,'CANCEL_TRACKING_CHANGED');
 }
});
test('R54 lost assignment, finalized trip, sync pending and wrong trip ID block UI',()=>{
 const old=create();
 for(const changed of [
  {state:'completed'},{state:'cancelled'},{state:'in_progress'},
  {syncing:true},{subscriptionActive:false},{tripId:null},
  {revision:0}
 ])assert.equal(same(old,create(changed)).ok,false);
});
test('R54 cancellation prepare idle never creates a request before backend',()=>{
 const x=create();
 assert.equal(same(x,x,'prepare').ok,true);
 assert.equal(same(x,x,'submit').code,'CANCEL_OPERATION_CHANGED');
 assert.equal(same(x,x,'retry').code,'CANCEL_OPERATION_CHANGED');
});
test('R54 ready cancellation allows submit only with same trip and request key',()=>{
 const x=create({phase:'ready',requestKey:id(4)});
 assert.equal(same(x,x,'submit').ok,true);
 assert.equal(same(x,x,'prepare').ok,true);
 assert.equal(same(x,x,'retry').code,'CANCEL_OPERATION_CHANGED');
 assert.equal(same(x,create({phase:'ready',requestKey:id(5)}),'submit').code,
  'CANCEL_OPERATION_CHANGED');
});
test('R54 retryable requires exact original idempotency key',()=>{
 const x=create({phase:'retryable',requestKey:id(5)});
 assert.equal(same(x,x,'retry').ok,true);
 assert.equal(same(x,x,'submit').ok,false);
 assert.equal(same(x,create({phase:'retryable',requestKey:id(8)}),'retry').ok,false);
});
test('R54 rejected contract, mutation transitions or obsolete phase fail closed',()=>{
 const x=create({phase:'ready',requestKey:id(4)});
 assert.equal(same(x,create({phase:'ready',requestKey:id(4),
  contractReady:false}),'submit').ok,false);
 assert.equal(same(x,create({phase:'retryable',requestKey:id(4)}),'submit').ok,false);
});
test('R54 missing or non-UUID request key never authorizes submission',()=>{
 for(const requestKey of [null,'bad','../../private']) {
  const x=create({phase:'ready',requestKey});
  assert.equal(same(x,x,'submit').ok,false);
 }
});
test('R54 unsupported action, missing actor and malformed DTO never authorize',()=>{
 const x=create();
 for(const action of ['delete','refund','cancelRide',null]){
  assert.equal(guardTrackingCancellationUiAction(x,x,{action}).ok,false);
 }
 for(const broken of [null,undefined,false,[],{}]) {
  assert.equal(same(broken,x).ok,false);
  assert.equal(same(x,broken).ok,false);
 }
});
test('R54 stale idle request fields must never bypass the known phase',()=>{
 const x=create();
 const altered=create();altered.cancellation.requestKey=id(6);
 assert.equal(same(x,altered).code,'CANCEL_OPERATION_CHANGED');
});
test('R54 no accidental PII echo or refund guarantees',()=>{
 const x=create();
 x.tracking.assignedDriver={name:'PRIVADO',plate:'ABC123'};
 const result=same(x);
 assert.equal(result.ok,true);
 assert.equal(JSON.stringify(result).includes('PRIVADO'),false);
 assert.equal(result.refundConfirmed,false);
});
