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
