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
test('estado atrasado no revive conductor ni mapa',async()=>{
 let n=0;
 const p=make(async()=>({ok:true,data:good(n++===0?2:1)}));
 await p.tick();
 assert.equal((await p.tick()).applied,false);
 assert.equal(p.snapshot().revision,2);
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
