import test from 'node:test';
import assert from 'node:assert/strict';
import {projectBookingRecoveryUi} from './booking-recovery-ui.mjs';
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const view=(patch={},mutation={})=>({
 authenticated:true,account:{role:'passenger',subject:id(1)},
 privateViewRevision:4,bookingRecovery:{readReady:false,productionEnabled:false},
 mutation:{phase:'failed',operation:'rideRequest',requestKey:id(7),
  error:'NETWORK_OR_TIMEOUT',...mutation},...patch
});
const check=(display=view(),current=display,operation='rideRequest')=>
 projectBookingRecoveryUi(display,current,{operation});
test('R58 ambiguous ride is visible and NEVER offers repeat POST',()=>{
 const s=check();
 assert.equal(s.ok,true);assert.equal(s.visible,true);
 assert.equal(s.canRead,false);assert.equal(s.postReplayAllowed,false);
 assert.match(s.message,/No generes otra solicitud/);
 assert.match(s.message,/servidor autorizado/);
});
test('R58 read button requires independent certified read gate in both snapshots',()=>{
 const ready=view({bookingRecovery:{readReady:true,productionEnabled:false}});
 assert.equal(check(ready).canRead,true);
 assert.match(check(ready).actionLabel,/sin reenviar/);
 assert.equal(check(view(),ready).canRead,false);
 assert.equal(check(ready,view()).canRead,false);
});
test('R58 never prints requestKey or private error content',()=>{
 const x=view({},{error:'PRIVATE_PHONE_0981888999'});
 const projected=check(x);
 assert.equal(projected.ok,true);
 assert.equal(JSON.stringify(projected).includes(id(7)),false);
 assert.equal(JSON.stringify(projected).includes('PRIVATE_PHONE'),false);
});
test('R58 restricts recovery to same trip or delivery operation and key',()=>{
 const x=view();
 assert.equal(check(x,view({}, {operation:'deliveryRequest'})).ok,false);
 assert.equal(check(x,view({}, {requestKey:id(9)})).ok,false);
 assert.equal(check(x,x,'deliveryRequest').ok,false);
});
test('R58 logout, new account, Driver role or JWT rotation invalidates an open button',()=>{
 const shown=view({bookingRecovery:{readReady:true,productionEnabled:false}});
 const changed=[
  view({authenticated:false}),view({account:{role:'passenger',subject:id(2)}}),
  view({account:{role:'driver',subject:id(1)}}),
  view({privateViewRevision:5})
 ];
 for(const current of changed)assert.equal(check(shown,current).code,'SESSION_CHANGED');
});
test('R58 phase transitions invalidate stale button before touch',()=>{
 const shown=view({bookingRecovery:{readReady:true,productionEnabled:false}});
 for(const phase of ['in_flight','acknowledged','ready','retryable','idle']){
  assert.equal(check(shown,view({bookingRecovery:{readReady:true,productionEnabled:false}},
   {phase})).ok,false);
 }
});
test('R58 in-flight state is informative, no read or double submit',()=>{
 const x=view({}, {phase:'in_flight'});
 const p=check(x);
 assert.equal(p.ok,true);assert.equal(p.canRead,false);
 assert.equal(p.postReplayAllowed,false);
 assert.match(p.message,/procesando o consultando/);
});
test('R58 acknowledged QA does not claim assignment or commercial booking',()=>{
 const x=view({}, {phase:'acknowledged'});
 const p=check(x);
 assert.equal(p.ok,true);assert.equal(p.canRead,false);
 assert.match(p.message,/no significa/);
 assert.equal(p.productionEnabled,false);
});
test('R58 delivery uses delivery copy but never licenses passenger motorcycles',()=>{
 const x=view({}, {operation:'deliveryRequest'});
 const p=check(x,x,'deliveryRequest');
 assert.equal(p.ok,true);assert.match(p.message,/envío/);
 assert.equal(p.postReplayAllowed,false);
});
test('R58 invalid key or untrusted operation cannot authorize recovery',()=>{
 const x=view({}, {requestKey:'../../other'});
 assert.equal(check(x).ok,false);
 for(const bad of ['merchantOrder','paymentAuthorize','MOTO_PASSENGER',null]){
  assert.equal(check(view(),view(),bad).ok,false);
 }
});
test('R58 invalid or missing snapshots always fail closed',()=>{
 const x=view();
 for(const bad of [null,undefined,{},[],false]){
  assert.equal(check(bad,x).ok,false);
  assert.equal(check(x,bad).ok,false);
 }
});
test('R58 flagged production mode is never eligible for read action',()=>{
 const x=view({bookingRecovery:{readReady:true,productionEnabled:true}});
 assert.equal(check(x).ok,true);
 assert.equal(check(x).canRead,false);
});
