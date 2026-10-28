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
test('MOTO_RIDE sin prueba legal y revisiones duplicadas no pasan',()=>{
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
 const rows=['AUTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO'].map(serviceKind=>({
  ...row,serviceKind
 }));
 const result=projectZoneOverview({...data,items:rows},{role:'admin',now});
 assert.equal(result.items.length,3);
 assert.deepEqual(result.items.map(x=>x.serviceKind),
  ['AUTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO']);
 assert.equal(result.items.every(x=>x.availabilityConfirmed===false),true);
});

test('A05 limita a 50 la página, no a 50 el total de la plataforma',()=>{
 const createRecord=n=>({...row,zoneId:'123e4567-e89b-42d3-a456-'+String(n+30).padStart(12,'0')});
 const rows=Array.from({length:50},(_,i)=>createRecord(i));
 const page={...data,items:rows,nextCursor:'S'.repeat(44)};
 const projected=projectZoneOverview(page,{role:'admin',now});
 assert.equal(projected.items.length,50);
 assert.equal(projected.nextCursor,'S'.repeat(44));
 assert.equal(projectZoneOverview({...page,items:[...rows,createRecord(51)]},
  {role:'admin',now}),null);
});


test('D acepta cinco servicios separados en la misma zona sin mezclar pasajeros y entregas',()=>{
 const rows=[
  {...row,serviceKind:'AUTO_RIDE'},
  {...row,serviceKind:'MOTO_RIDE',legalGate:'CLEARED'},
  {...row,serviceKind:'DELIVERY_AUTO'},
  {...row,serviceKind:'DELIVERY_MOTO'},
  {...row,serviceKind:'COMMERCE',merchantEligibilityVerified:true}
 ];
 const result=projectZoneOverview({...data,items:rows},{role:'admin',now});
 assert(result);
 assert.deepEqual(result.items.map(i=>i.serviceKind),[
  'AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE'
 ]);
 assert.equal(result.items[1].legalGate,'CLEARED');
 assert.equal(result.items[4].merchantEligibilityVerified,true);
 assert.equal(result.items[4].onDutyVehicles,null);
 assert.equal(result.items[4].availabilityConfirmed,false);
});
test('D bloquea MOTO_RIDE sin autorización legal propia de pasajeros',()=>{
 for(const state of [undefined,'G38_BLOCKED','G71_BLOCKED','UNVERIFIED',
  'DELIVERY_CLEARED']){
  const item={...row,serviceKind:'MOTO_RIDE',legalGate:state};
  assert.equal(projectZoneOverview({...data,items:[item]},{role:'admin',now}),null);
 }
 const blocked={...row,serviceKind:'MOTO_RIDE',legalGate:'G71_BLOCKED',
  eligibleByPolicy:false};
 const view=projectZoneOverview({...data,items:[blocked]},{role:'admin',now});
 assert.equal(view.items[0].legalGate,'G71_BLOCKED');
 assert.equal(view.items[0].onDutyVehicles,null);
 assert.equal(view.items[0].availabilityConfirmed,false);
 assert.equal(projectZoneOverview({...data,items:[{
  ...row,serviceKind:'MOTO_RIDE',legalGate:'CLEARED',coverageStatus:'PAUSED'
 }]},{role:'admin',now}),null);
});
test('D no infiere comercio por el número de repartidores en línea',()=>{
 for(const entry of [
  {...row,serviceKind:'COMMERCE'},
  {...row,serviceKind:'COMMERCE',merchantEligibilityVerified:false},
  {...row,serviceKind:'COMMERCE',merchantEligibilityVerified:true,
   coverageStatus:'PAUSED'}
 ]){
  assert.equal(projectZoneOverview({...data,items:[entry]},{role:'admin',now}),null);
 }
 const blocked={...row,serviceKind:'COMMERCE',merchantEligibilityVerified:false,
  eligibleByPolicy:false};
 const view=projectZoneOverview({...data,items:[blocked]},{role:'admin',now});
 assert.equal(view.items[0].onDutyVehicles,null);
 assert.equal(view.items[0].availabilityFresh,false);
 assert.equal(view.items[0].eligibleByPolicy,false);
});
test('D mantiene prueba de elegibilidad exclusiva por modalidad',()=>{
 for(const serviceKind of ['AUTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO']){
  assert.equal(projectZoneOverview({...data,items:[{
   ...row,serviceKind,legalGate:'CLEARED'
  }]},{role:'admin',now}),null);
  assert.equal(projectZoneOverview({...data,items:[{
   ...row,serviceKind,merchantEligibilityVerified:true
  }]},{role:'admin',now}),null);
 }
});

test('D coverage consumes the exact canonical five-service IDs used by Owner commissions',()=>{
 const rows=['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE'].map(kind=>({
  ...row,serviceKind:kind,...(kind==='MOTO_RIDE'?{legalGate:'CLEARED'}:{}),
  ...(kind==='COMMERCE'?{merchantEligibilityVerified:true}:{})
 }));
 const projected=projectZoneOverview({...data,items:rows},{role:'admin',now});
 assert.deepEqual(projected.items.map(i=>i.serviceKind),rows.map(i=>i.serviceKind));
 for(const legacy of ['AUTO_DELIVERY','MOTO_DELIVERY']){
  assert.equal(projectZoneOverview({...data,items:[{...row,serviceKind:legacy}]},{role:'admin',now}),null);
 }
});
