import test from 'node:test';
import assert from 'node:assert/strict';
import {createRiderStatusStore} from './rider-status.mjs';
const owner='123e4567-e89b-42d3-a456-426614174000',other='123e4567-e89b-42d3-a456-426614174001';
const trip='123e4567-e89b-42d3-a456-426614174002',moment=100000;
const make=(revision,state,more={})=>({
 tripId:trip,ownerId:owner,revision,state,assignmentPersisted:true,
 driver:{displayName:'Conductor ficticio',verified:true},
 vehicle:{kind:'AUTO',plate:'QA-000'},gpsConsent:true,
 location:{latitude:-25.3,longitude:-57.6,observedAt:moment-1000},
 etaVerified:true,etaMinutes:7,...more
});
test('no inventa datos de conductor antes de aceptación',()=>{
 const store=createRiderStatusStore({now:()=>moment});
 assert.equal(store.ingest(make(1,'searching'),owner),true);
 assert.equal(store.current().assignedDriver,null);
 assert.equal(store.current().position,null);
 assert.equal(store.current().etaMinutes,null);
});
test('aceptación persistida y perfil verificado permiten visualización acotada',()=>{
 const store=createRiderStatusStore({now:()=>moment});
 assert.equal(store.ingest(make(1,'assigned'),owner),true);
 assert.equal(store.current().assignedDriver.plate,'QA-000');
 assert.equal(store.current().etaMinutes,7);
});
test('revision anterior o repetida no revierte estado',()=>{
 const store=createRiderStatusStore({now:()=>moment});
 store.ingest(make(3,'in_progress'),owner);
 assert.equal(store.ingest(make(2,'searching'),owner),false);
 assert.equal(store.ingest(make(3,'cancelled'),owner),false);
 assert.equal(store.current().state,'in_progress');
});
test('otro titular limpia estado y no expone GPS',()=>{
 const store=createRiderStatusStore({now:()=>moment});
 store.ingest(make(1,'assigned'),owner);
 assert.equal(store.ingest(make(2,'assigned',{ownerId:other}),owner),false);
 assert.equal(store.current().assignedDriver,null);
 assert.equal(store.current().position,null);
});
test('no expone patente o GPS si no hay aceptación persistida',()=>{
 const store=createRiderStatusStore({now:()=>moment});
 store.ingest(make(1,'assigned',{assignmentPersisted:false}),owner);
 assert.equal(store.current().assignedDriver,null);
 assert.equal(store.current().etaMinutes,null);
});
test('MOTO como viaje pasajero AUTO, conductor no verificado y sin permiso GPS se ocultan',()=>{
 for(const modification of [{vehicle:{kind:'MOTO',plate:'QA-000'}},{driver:{displayName:'QA',verified:false}},{gpsConsent:false}]){
  const store=createRiderStatusStore({now:()=>moment});
  store.ingest(make(1,'assigned',modification),owner);
  assert.equal(store.current().position,null);
 }
});
test('GPS viejo y ETA no verificada nunca se dibujan',()=>{
 const store=createRiderStatusStore({now:()=>moment});
 store.ingest(make(1,'arriving',{location:{latitude:-25.3,longitude:-57.6,observedAt:moment-35000}}),owner);
 assert.equal(store.current().position,null);
 const otherStore=createRiderStatusStore({now:()=>moment});
 otherStore.ingest(make(1,'arriving',{etaVerified:false}),owner);
 assert.equal(otherStore.current().etaMinutes,null);
});
test('cierre retira GPS, ficha y ETA',()=>{
 const store=createRiderStatusStore({now:()=>moment});
 store.ingest(make(1,'arriving'),owner);
 store.ingest(make(2,'completed'),owner);
 assert.equal(store.current().assignedDriver,null);
 assert.equal(store.current().position,null);
});
test('frescura se recalcula con reloj, aunque no lleguen nuevos eventos',()=>{
 let time=moment;
 const store=createRiderStatusStore({now:()=>time});
 store.ingest(make(1,'arriving'),owner);
 assert.ok(store.current().position);
 time=moment+30001;
 assert.equal(store.current().position,null);
 assert.equal(store.current().etaMinutes,null);
});
test('sin red limpia inmediatamente ubicación pero retiene estado persistido',()=>{
 const store=createRiderStatusStore({now:()=>moment});
 store.ingest(make(1,'assigned'),owner);
 store.networkLost();
 assert.equal(store.current().state,'assigned');
 assert.equal(store.current().position,null);
 assert.equal(store.current().etaMinutes,null);
});
test('logout o cambio de viaje no mezcla cuentas',()=>{
 const store=createRiderStatusStore({now:()=>moment});
 store.ingest(make(1,'assigned'),owner);
 assert.equal(store.ingest(make(2,'assigned',{tripId:other}),owner),false);
 assert.equal(store.current().tripId,null);
 store.ingest(make(1,'assigned'),owner);
 store.clear();
 assert.equal(store.current().state,'idle');
});
