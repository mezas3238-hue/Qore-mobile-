import test from 'node:test';
import assert from 'node:assert/strict';
import {projectRideDraftUi} from './ride-draft-ui-policy.mjs';
const check=x=>projectRideDraftUi(x);
test('R53 idle authenticated simple validated ride is only a local draft',()=>{
 const x=check({phase:'idle',operation:null,authenticated:true,validated:true,
  stopsCount:0,service:'economico'});
 assert.equal(x.ok,true);assert.equal(x.canPrepare,true);
 assert.equal(x.requestSent,false);assert.equal(x.driverAssigned,false);
 assert.equal(x.fareVerified,false);assert.equal(x.paymentCaptured,false);
});
test('R53 local ride must be authenticated and reviewed before prepare',()=>{
 assert.equal(check({authenticated:false,validated:true}).canPrepare,false);
 assert.equal(check({authenticated:true,validated:false}).canPrepare,false);
});
test('R53 additional waypoints never enable unsupported server request',()=>{
 for(const stopsCount of [1,2,8]){
  const x=check({authenticated:true,validated:true,stopsCount});
  assert.equal(x.ok,true);assert.equal(x.canPrepare,false);
  assert.match(x.status,/servidor todavía no admite/);
 }
});
test('R53 pending own ride cannot be edited and can only be discarded before submit',()=>{
 const x=check({phase:'ready',operation:'rideRequest',authenticated:true,
  validated:true,service:'confort'});
 assert.equal(x.editable,false);assert.equal(x.canReview,false);
 assert.equal(x.canPrepare,false);assert.equal(x.canDiscard,true);
 assert.match(x.status,/No se envió/);
});
test('R53 ready mutation for delivery fare or payment does not unlock ride controls',()=>{
 for(const operation of ['deliveryRequest','fareQuote','paymentAuthorize']){
  const x=check({phase:'ready',operation,authenticated:true,validated:true});
  assert.equal(x.ok,true);assert.equal(x.editable,false);
  assert.equal(x.canDiscard,false);assert.equal(x.canPrepare,false);
 }
});
test('R53 in flight, retryable, acknowledged and failed all block route and service',()=>{
 for(const phase of ['in_flight','retryable','acknowledged','failed']){
  const x=check({phase,operation:'rideRequest',authenticated:true,validated:true});
  assert.equal(x.ok,true);assert.equal(x.editable,false);
  assert.equal(x.canReview,false);assert.equal(x.canPrepare,false);
  assert.equal(x.canDiscard,false);
 }
});
test('R53 unknown phases, missing operations or malformed states fail closed',()=>{
 for(const phase of [undefined,null,'successful','sending','']){
  if(phase===undefined)continue;
  assert.equal(check({phase}).ok,false);
 }
 for(const operation of [undefined,null,'merchantOrder','invalid']){
  if(operation===undefined||operation===null)continue;
  assert.equal(check({phase:'ready',operation}).ok,false);
 }
 assert.equal(check({phase:'ready',operation:null}).ok,false);
 assert.equal(check({phase:'idle',operation:'rideRequest'}).ok,false);
});
test('R53 no negative, fractional or out-of-contract waypoint count',()=>{
 for(const stopsCount of [-1,9,1.5,NaN,Infinity]){
  assert.equal(check({stopsCount}).ok,false);
 }
});
test('R53 no motorcycle passenger or invalid ride service',()=>{
 for(const service of ['MOTO','uber-x','',null,5]){
  assert.equal(check({service}).ok,false);
 }
 for(const service of ['economico','confort','xl']){
  assert.equal(check({service}).ok,true);
 }
});
test('R53 UI announcement never repeats route, PII, request keys or identity',()=>{
 const secret='TELEFONO_0981000000';
 const x=check({phase:'idle',operation:null,
  pickup:secret,destination:secret,requestKey:secret,subject:secret});
 assert.equal(x.ok,true);assert.equal(x.status.includes(secret),false);
});
test('R53 malformed boolean values cannot grant permission',()=>{
 for(const authenticated of ['true',null,1]){
  assert.equal(check({authenticated,validated:true}).ok,false);
 }
 for(const validated of ['true',null,1]){
  assert.equal(check({authenticated:true,validated}).ok,false);
 }
});
test('R53 empty-state and pending-state messages never claim priced or dispatched',()=>{
 const a=check({});
 const b=check({phase:'failed',operation:'rideRequest'});
 assert.equal(a.driverAssigned,false);
 assert.equal(b.paymentCaptured,false);
 assert.doesNotMatch(a.status,/confirmado por servidor/);
 assert.doesNotMatch(b.status,/se envió un nuevo viaje/);
});
