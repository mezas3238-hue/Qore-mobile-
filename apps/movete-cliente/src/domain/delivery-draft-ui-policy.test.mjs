import test from 'node:test';
import assert from 'node:assert/strict';
import {projectDeliveryDraftUi} from './delivery-draft-ui-policy.mjs';
const project=changes=>projectDeliveryDraftUi(changes);
test('R52 editable only at idle; never enables real dispatch, payment or assignment',()=>{
 const x=project({phase:'idle',operation:null,authenticated:true,validated:true});
 assert.equal(x.ok,true);assert.equal(x.editable,true);
 assert.equal(x.canPrepare,true);assert.equal(x.requestSent,false);
 assert.equal(x.courierAssigned,false);assert.equal(x.paymentCaptured,false);
 assert.equal(x.serverPriceVerified,false);
});
test('R52 suppress prepare when not authenticated or not validated',()=>{
 assert.equal(project({authenticated:false,validated:true}).canPrepare,false);
 assert.equal(project({authenticated:true,validated:false}).canPrepare,false);
});
test('R52 restricted articles revoke prepare even with validation flag',()=>{
 const x=project({authenticated:true,validated:true,restricted:true});
 assert.equal(x.canPrepare,false);
 assert.equal(x.editable,true);
 assert.match(x.status,/No se puede preparar/);
});
test('R52 prepared own request is immutable and discardable only before send',()=>{
 const x=project({phase:'ready',operation:'deliveryRequest',validated:true,authenticated:true});
 assert.equal(x.canDiscard,true);
 assert.equal(x.editable,false);assert.equal(x.canPrepare,false);
 assert.match(x.status,/No fue enviado/);
});
test('R52 another operation ready locks delivery form without pretending it is a delivery draft',()=>{
 for(const operation of ['rideRequest','fareQuote','paymentAuthorize']){
  const x=project({phase:'ready',operation,validated:true,authenticated:true});
  assert.equal(x.editable,false);assert.equal(x.canDiscard,false);
  assert.doesNotMatch(x.status,/Borrador de envío preparado/);
 }
});
test('R52 all non-idle retry/ack/failure/in-flight phases lock all edits',()=>{
 for(const phase of ['in_flight','retryable','acknowledged','failed']){
  const x=project({phase,operation:'deliveryRequest',validated:true,authenticated:true});
  assert.equal(x.ok,true);assert.equal(x.editable,false);
  assert.equal(x.canPrepare,false);assert.equal(x.canReview,false);
  assert.equal(x.canDiscard,false);
 }
});
test('R52 no PII, request key, addresses or private data reflected in status',()=>{
 const secret='SECRET_PHONE_0981123456';
 const x=project({phase:'idle',operation:null,authenticated:false,
  pickup:secret,requestKey:secret,accountSubject:secret});
 assert.equal(x.ok,true);assert.equal(x.status.includes(secret),false);
});
test('R52 invalid mutation phases or operations fail closed',()=>{
 for(const phase of ['sending','success','unknown',null]){
  assert.equal(project({phase}).ok,false);
 }
 for(const operation of ['merchantOrder',false,'']){
  assert.equal(project({operation}).ok,false);
 }
 assert.equal(project({phase:'ready',operation:null}).ok,false);
 assert.equal(project({phase:'idle',operation:'deliveryRequest'}).ok,false);
});
test('R52 invalid vehicle or booleans never promise submission',()=>{
 for(const v of ['MOTO_PASSENGER',null,'TRUCK']){
  assert.equal(project({vehicleKind:v}).ok,false);
 }
 for(const validated of ['true',1,null]){
  assert.equal(project({validated}).ok,false);
 }
});
test('R52 status is informative but no confirmation or pricing',()=>{
 const x=project({authenticated:true,validated:true,vehicleKind:'AUTO'});
 assert.match(x.status,/precio y repartidor pendientes/i);
 assert.equal(x.requestSent,false);assert.equal(x.serverPriceVerified,false);
});
