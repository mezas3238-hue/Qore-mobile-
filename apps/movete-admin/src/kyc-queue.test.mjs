import test from 'node:test';
import assert from 'node:assert/strict';
import {projectKycQueue,createKycQueueStore} from './kyc-queue.mjs';
const id='123e4567-e89b-42d3-a456-426614174010';
const record={vehicleId:id,vehicleKind:'AUTO',applicationStatus:'pending',
 licenseStatus:'valid',insuranceStatus:'pending',inspectionStatus:'pending',reviewRevision:1};
const queue={scope:'admin.kyc.read',revision:2,generatedAt:1000,expiresAt:2000,items:[record]};
test('solo Admin recibe metadatos explícitos sin datos personales',()=>{
 const result=projectKycQueue(queue,{role:'admin',now:1100});
 assert.equal(result.items.length,1);
 assert.deepEqual(Object.keys(result.items[0]).sort(),
  ['vehicleId','vehicleKind','applicationStatus','licenseStatus','insuranceStatus','inspectionStatus','reviewRevision'].sort());
 assert.equal(projectKycQueue(queue,{role:'passenger',now:1100}),null);
 assert.equal(projectKycQueue(queue,{role:'driver',now:1100}),null);
});
test('rechaza claves de identidad y enlaces de documentación aunque los retorne servidor',()=>{
 for(const field of ['name','phone','cedula','imageUrl','documentUrl','email','ownerId']){
  const bad={...record,[field]:'confidencial'};
  assert.equal(projectKycQueue({...queue,items:[bad]},{role:'admin',now:1100}),null,field);
 }
 assert.equal(projectKycQueue({...queue,service_role:'secret'},{role:'admin',now:1100}),null);
});
test('caducidad, payload antiguo y revisiones inválidas provocan fallo cerrado',()=>{
 assert.equal(projectKycQueue(queue,{role:'admin',now:2000}),null);
 assert.equal(projectKycQueue({...queue,generatedAt:-500000},{role:'admin',now:1100}),null);
 assert.equal(projectKycQueue({...queue,revision:-1},{role:'admin',now:1100}),null);
 assert.equal(projectKycQueue({...queue,items:[{...record,reviewRevision:-1}]},{role:'admin',now:1100}),null);
});
test('no acepta vehículos duplicados ni estado MOTO pasajeros inventado',()=>{
 assert.equal(projectKycQueue({...queue,items:[record,record]},{role:'admin',now:1100}),null);
 assert.equal(projectKycQueue({...queue,items:[{...record,vehicleKind:'MOTO_PASSENGER'}]},{role:'admin',now:1100}),null);
});
test('la revocación en UI permite limpiar al cambiar sesión',()=>{
 let time=1100;
 const store=createKycQueueStore({now:()=>time});
 assert.equal(store.replace(queue,'admin'),true);
 assert.equal(store.current().items.length,1);
 store.clear();
 assert.equal(store.current(),null);
 store.replace(queue,'admin');time=2100;
 assert.equal(store.current(),null);
});

test('A05 limita a 50 la página, no a 50 el total de la plataforma',()=>{
 const createRecord=n=>({...record,vehicleId:'123e4567-e89b-42d3-a456-'+String(n+10).padStart(12,'0')});
 const rows=Array.from({length:50},(_,i)=>createRecord(i));
 const page={...queue,items:rows,nextCursor:'S'.repeat(44)};
 const data=projectKycQueue(page,{role:'admin',now:1100});
 assert.equal(data.items.length,50);
 assert.equal(data.nextCursor,'S'.repeat(44));
 assert.equal(projectKycQueue({...page,items:[...rows,createRecord(51)]},
  {role:'admin',now:1100}),null);
});
