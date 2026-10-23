import test from 'node:test';
import assert from 'node:assert/strict';
import {projectZoneOverview,createZoneOverviewStore} from './zone-overview.mjs';
const now=1800000000000;
const id='123e4567-e89b-42d3-a456-426614174010';
const row={zoneId:id,municipality:'San Lorenzo',serviceKind:'AUTO_RIDE',
 coverageStatus:'ACTIVE',eligibleByPolicy:true,onDutyVehicles:12,availabilityObservedAt:now-3000};
const data={scope:'admin.zones.read',revision:2,generatedAt:now-5000,
 expiresAt:now+30000,items:[row]};
test('admin ve cobertura sin afirmar disponibilidad real',()=>{
 const result=projectZoneOverview(data,{role:'admin',now});
 assert.equal(result.items[0].onDutyVehicles,12);
 assert.equal(result.items[0].availabilityConfirmed,false);
 assert.equal(result.items[0].coverageStatus,'ACTIVE');
 assert.equal(projectZoneOverview(data,{role:'owner',now}),null);
 assert.equal(projectZoneOverview(data,{role:'passenger',now}),null);
});
test('cobertura ACTIVE con cero vehículos no se interpreta como oferta',()=>{
 const result=projectZoneOverview({...data,items:[{...row,onDutyVehicles:0}]},{role:'admin',now});
 assert.equal(result.items[0].onDutyVehicles,0);
 assert.equal(result.items[0].availabilityConfirmed,false);
});
test('GPS y capacidad envejecida desaparecen por separado de cobertura',()=>{
 const result=projectZoneOverview({...data,items:[{...row,availabilityObservedAt:now-70000}]},{role:'admin',now});
 assert.equal(result.items[0].coverageStatus,'ACTIVE');
 assert.equal(result.items[0].onDutyVehicles,null);
 assert.equal(result.items[0].availabilityFresh,false);
});
test('se rechazan datos privados y operaciones LIVE en DTO',()=>{
 for(const field of ['driverName','driverPhone','coordinates','driverIds','commissionRate','service_role']){
  const result=projectZoneOverview({...data,items:[{...row,[field]:'PRIVATE'}]},{role:'admin',now});
  assert.equal(result,null,field);
 }
});
test('moto pasajeros y revision duplicada no pasan',()=>{
 assert.equal(projectZoneOverview({...data,items:[{...row,serviceKind:'MOTO_RIDE'}]},{role:'admin',now}),null);
 assert.equal(projectZoneOverview({...data,items:[row,row]},{role:'admin',now}),null);
});
test('TTL caducado y cambios de rol limpian el store',()=>{
 let tick=now;
 const store=createZoneOverviewStore({now:()=>tick});
 assert.equal(store.replace(data,'admin'),true);
 assert.equal(store.current('admin').items.length,1);
 assert.equal(store.current('owner'),null);
 assert.equal(store.current('admin'),null);
 store.replace(data,'admin');tick=now+31000;
 assert.equal(store.current('admin'),null);
});
test('revisión obsoleta se rechaza sin restaurar datos viejos',()=>{
 const store=createZoneOverviewStore({now:()=>now});
 assert.equal(store.replace(data,'admin'),true);
 assert.equal(store.replace({...data,revision:1},'admin'),false);
 assert.equal(store.current('admin'),null);
});

test('conductores en línea dejan de mostrarse después de 60 segundos sin nueva lectura',()=>{
 let tick=now;
 const store=createZoneOverviewStore({now:()=>tick});
 const source={...data,expiresAt:now+180000};
 store.replace(source,'admin');
 assert.equal(store.current('admin').items[0].onDutyVehicles,12);
 tick=now+61000;
 assert.equal(store.current('admin').items[0].onDutyVehicles,null);
 assert.equal(store.current('admin').items[0].availabilityFresh,false);
 assert.equal(store.current('admin').items[0].coverageStatus,'ACTIVE');
});

test('una misma zona admite automóvil, autoenvío y motoenvío sin colisión de registros',()=>{
 const rows=['AUTO_RIDE','AUTO_DELIVERY','MOTO_DELIVERY'].map(serviceKind=>({
  ...row,serviceKind
 }));
 const result=projectZoneOverview({...data,items:rows},{role:'admin',now});
 assert.equal(result.items.length,3);
 assert.deepEqual(result.items.map(x=>x.serviceKind),
  ['AUTO_RIDE','AUTO_DELIVERY','MOTO_DELIVERY']);
 assert.equal(result.items.every(x=>x.availabilityConfirmed===false),true);
});

test('A05 limita a 50 la página, no a 50 el total de la plataforma',()=>{
 const createRecord=n=>({...row,zoneId:'123e4567-e89b-42d3-a456-'+String(n+30).padStart(12,'0')});
 const rows=Array.from({length:50},(_,i)=>createRecord(i));
 const page={...data,items:rows,nextCursor:'S'.repeat(44)};
 const data=projectZoneOverview(page,{role:'admin',now});
 assert.equal(data.items.length,50);
 assert.equal(data.nextCursor,'S'.repeat(44));
 assert.equal(projectZoneOverview({...page,items:[...rows,createRecord(51)]},
  {role:'admin',now}),null);
});
