import test from 'node:test';
import assert from 'node:assert/strict';
import {createRiderPollingCoordinator} from './rider-polling.mjs';
import {createRiderStatusStore} from './rider-status.mjs';
const owner='123e4567-e89b-42d3-a456-426614174000';
const other='123e4567-e89b-42d3-a456-426614174001';
const tripId='123e4567-e89b-42d3-a456-426614174002';
const time=1000000;
const good=revision=>({
 tripId,ownerId:owner,revision,state:'assigned',assignmentPersisted:true,
 driver:{displayName:'Persona sintética',verified:true},
 vehicle:{kind:'AUTO',plate:'QA-000'},gpsConsent:true,
 location:{latitude:-25.3,longitude:-57.6,observedAt:time-1000},
 etaVerified:true,etaMinutes:4
});
function make(send=async()=>({ok:true,data:good(1)}),getSession=async()=>({subject:owner,role:'passenger'})){
 const store=createRiderStatusStore({now:()=>time});
 const p=createRiderPollingCoordinator({
  gateway:{send},getSession,store,now:()=>time
 });
 p.begin(tripId,owner);
 return p;
}
test('no hace fetch sin suscripción ni acepta IDs corruptos',async()=>{
 const p=createRiderPollingCoordinator({gateway:{send:async()=>{throw Error('should not run');}}});
 assert.equal((await p.tick()).code,'NO_ACTIVE_TRIP');
 assert.equal(p.begin('../../etc',owner).code,'INVALID_SUBSCRIPTION');
});
test('la revisión proviene de GET asociado al viaje y la sesión',async()=>{
 let args;
 const p=make(async(op,options)=>{args={op,options};return {ok:true,data:good(1)}});
 assert.equal((await p.tick()).ok,true);
 assert.deepEqual(args,{op:'rideStatus',options:{id:tripId}});
 assert.equal(p.snapshot().assignedDriver.plate,'QA-000');
 assert.equal(p.snapshot().etaMinutes,4);
 assert.equal(p.snapshot().liveEnabled,false);
});
test('dos ticks paralelos no emiten dos solicitudes',async()=>{
 let release;const wait=new Promise(resolve=>release=resolve);
 let hits=0;
 const p=make(async()=>{hits++;return wait;});
 const first=p.tick();
 assert.equal((await p.tick()).code,'POLL_IN_PROGRESS');
 await Promise.resolve();await Promise.resolve();
 assert.equal(hits,1);
 release({ok:true,data:good(1)});
 assert.equal((await first).ok,true);
});
test('R61 servidor con revisión menor bloquea refresco y borra GPS caducable',async()=>{
 let n=0;
 const p=make(async()=>({ok:true,data:good(n++===0?2:1)}));
 assert.equal((await p.tick()).ok,true);
 assert.ok(p.snapshot().position);
 const saved=p.snapshot().lastFetchedAt;
 assert.equal((await p.tick()).code,'STALE_SERVER_REVISION');
 assert.equal(p.snapshot().revision,2);
 assert.equal(p.snapshot().position,null);
 assert.equal(p.snapshot().etaMinutes,null);
 assert.equal(p.snapshot().lastFetchedAt,null);
 assert.equal(p.snapshot().lastError,'STALE_SERVER_REVISION');
 assert.equal(saved,time);
});
test('conexión perdida borra GPS/ETA inmediatamente',async()=>{
 const p=make();await p.tick();
 p.connectionLost();
 assert.equal(p.snapshot().position,null);
 assert.equal(p.snapshot().etaMinutes,null);
 assert.equal(p.snapshot().lastError,'OFFLINE');
});
test('cambio de cuenta hace clear de datos privados',async()=>{
 let current=owner;
 const p=make(undefined,async()=>({subject:current,role:'passenger'}));
 await p.tick();current=other;
 assert.equal((await p.tick()).code,'SESSION_CHANGED');
 assert.equal(p.snapshot().assignedDriver,null);
 assert.equal(p.snapshot().subscriptionActive,false);
});
test('403 o 401 en servidor termina tracking y oculta identidad',async()=>{
 for(const code of ['AUTH_REQUIRED','FORBIDDEN']){
  let n=0;
  const p=make(async()=>++n===1?{ok:true,data:good(1)}:{ok:false,code});
  await p.tick();
  assert.equal((await p.tick()).code,code);
  assert.equal(p.snapshot().assignedDriver,null);
  assert.equal(p.snapshot().subscriptionActive,false);
 }
});
test('usuario ajeno y viaje diferente no se aceptan',async()=>{
 for(const changes of [{ownerId:other},{tripId:other}]){
  const p=make(async()=>({ok:true,data:{...good(1),...changes}}));
  assert.equal((await p.tick()).code,'INVALID_SERVER_SNAPSHOT');
  assert.equal(p.snapshot().position,null);
 }
});
test('stop durante respuesta antigua impide reactivar GPS',async()=>{
 let release;const wait=new Promise(resolve=>release=resolve);
 const p=make(async()=>wait);
 const pending=p.tick();
 await Promise.resolve();await Promise.resolve();
 p.stop();
 release({ok:true,data:good(1)});
 assert.equal((await pending).code,'STALE_RESPONSE_IGNORED');
 assert.equal(p.snapshot().tripId,null);
});
test('500 y network failure retiran GPS sin fingir viaje terminado',async()=>{
 let n=0;
 const p=make(async()=>++n===1?{ok:true,data:good(1)}:{ok:false,code:'SERVICE_UNAVAILABLE'});
 await p.tick();
 assert.equal((await p.tick()).code,'SERVICE_UNAVAILABLE');
 assert.equal(p.snapshot().position,null);
 assert.equal(p.snapshot().state,'assigned');
});

test('R61 untrusted HTTP error never leaks identity, bearer or HTML to Tracking',async()=>{
 const poison=[
  'Bearer private-secret-passenger-token',
  'AUTH_REQUIRED\nPHONE:0981123456',
  '<img src=x onerror=alert(1)>',
  'STATUS_UNAVAILABLE PRIVATE_0981555000',
  'X'.repeat(10000),
  {message:'private-access-token'},
  null
 ];
 for(const malicious of poison){
  let reads=0;
  const p=make(async()=>++reads===1
   ?{ok:true,data:good(1)}:{ok:false,code:malicious});
  assert.equal((await p.tick()).ok,true);
  const result=await p.tick();
  assert.equal(result.code,'SERVER_UNAVAILABLE');
  assert.equal(p.snapshot().lastError,'SERVER_UNAVAILABLE');
  assert.equal(p.snapshot().position,null);
  assert.equal(p.snapshot().etaMinutes,null);
  assert.equal(JSON.stringify(p.snapshot()).includes('private'),false);
 }
});
test('R61 keep known HTTP errors for support without inventing status',async()=>{
 for(const code of ['STATUS_CONTRACT_PENDING','SERVICE_UNAVAILABLE',
  'NETWORK_OR_TIMEOUT','RATE_LIMITED','BAD_CONTENT_TYPE']){
  const p=make(async()=>({ok:false,code}));
  assert.equal((await p.tick()).code,code);
  assert.equal(p.snapshot().lastError,code);
  assert.equal(p.snapshot().lastFetchedAt,null);
 }
});
test('R61 matching revision is not a new event but does not replay a state',async()=>{
 const p=make(async()=>({ok:true,data:good(4)}));
 assert.equal((await p.tick()).applied,true);
 assert.equal((await p.tick()).applied,false);
 assert.equal(p.snapshot().revision,4);
 assert.equal(p.snapshot().state,'assigned');
});


test('F1 G3 full verified lifecycle searching→assigned→arriving→in_progress→completed',async()=>{
 const states=['searching','assigned','arriving','in_progress','completed'];
 let cursor=0;
 const p=make(async()=>({ok:true,data:{
  ...good(cursor+1),state:states[cursor],assignmentPersisted:cursor>0,
  revision:cursor+1
 }}));
 for(let i=0;i<states.length;i++){
  cursor=i;
  assert.equal((await p.tick()).ok,true,states[i]);
  assert.equal(p.snapshot().state,states[i]);
  assert.equal(p.snapshot().revision,i+1);
 }
 assert.equal(p.snapshot().assignedDriver,null);
 assert.equal(p.snapshot().position,null);
 assert.equal(p.snapshot().etaMinutes,null);
 assert.equal(p.snapshot().liveEnabled,false);
});
test('F1 G3 never reopens completed/cancelled or rewinds in-progress state',async()=>{
 for(const [first,next] of [
  ['completed','searching'],['completed','assigned'],
  ['cancelled','assigned'],['in_progress','arriving'],
  ['in_progress','cancelled'],['arriving','searching']
 ]){
  let current=good(10);current.state=first;
  const p=make(async()=>({ok:true,data:current}));
  assert.equal((await p.tick()).ok,true);
  current={...good(20),state:next};
  assert.equal((await p.tick()).code,'TRIP_STATE_CONFLICT',first+'→'+next);
  assert.equal(p.snapshot().state,first);
  assert.equal(p.snapshot().lastError,'TRIP_STATE_CONFLICT');
  assert.equal(p.snapshot().position,null);
  assert.equal(p.snapshot().etaMinutes,null);
 }
});
test('F1 G3 same revision with contradictory state cannot claim a new event',async()=>{
 let current=good(3);
 const p=make(async()=>({ok:true,data:current}));
 assert.equal((await p.tick()).ok,true);
 current={...good(3),state:'completed'};
 assert.equal((await p.tick()).code,'TRIP_STATE_CONFLICT');
 assert.equal(p.snapshot().state,'assigned');
 assert.equal(p.snapshot().lastFetchedAt,null);
});
test('F1 G3 skip a state only when revision advances enough for SQL transitions',async()=>{
 let current={...good(1),state:'searching'};
 const p=make(async()=>({ok:true,data:current}));
 await p.tick();
 current={...good(3),state:'arriving'};
 assert.equal((await p.tick()).ok,true);
 current={...good(4),state:'completed'};
 assert.equal((await p.tick()).code,'TRIP_STATE_CONFLICT');
 assert.equal(p.snapshot().state,'arriving');
 current={...good(5),state:'completed'};
 assert.equal((await p.tick()).ok,true);
 assert.equal(p.snapshot().state,'completed');
});
test('F1 G3 cancellation only before pickup remains terminal with no Driver/GPS',async()=>{
 for(const before of ['searching','assigned','arriving']){
  let current={...good(2),state:before};
  const p=make(async()=>({ok:true,data:current}));
  await p.tick();
  current={...good(3),state:'cancelled'};
  assert.equal((await p.tick()).ok,true,before);
  assert.equal(p.snapshot().state,'cancelled');
  assert.equal(p.snapshot().assignedDriver,null);
  assert.equal(p.snapshot().position,null);
  current={...good(4),state:'assigned'};
  assert.equal((await p.tick()).code,'TRIP_STATE_CONFLICT');
 }
});
