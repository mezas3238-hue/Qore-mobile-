import test from 'node:test';
import assert from 'node:assert/strict';
import {projectIncidentQueue,createIncidentQueueStore} from './incidents-overview.mjs';
const now=1800000000000,id='123e4567-e89b-42d3-a456-426614174006';
const row={incidentId:id,category:'SAFETY',severity:'CRITICAL',
 status:'OPEN',createdAt:now-1000,revision:2};
const feed={scope:'admin.incidents.read',revision:4,generatedAt:now-3000,
 expiresAt:now+30000,items:[row]};
test('admin puede leer solo metadatos mínimos sin reportes personales',()=>{
 const result=projectIncidentQueue(feed,{role:'admin',now});
 assert.deepEqual(Object.keys(result.items[0]).sort(),
  ['incidentId','category','severity','status','createdAt','revision'].sort());
 for(const role of ['owner','passenger','driver'])assert.equal(projectIncidentQueue(feed,{role,now}),null);
});
test('rechaza teléfono, datos personales, descripción y GPS accidental',()=>{
 for(const key of ['reporterId','phone','name','details','coordinates','documentUrl','vehiclePlate','sessionToken']){
  assert.equal(projectIncidentQueue({...feed,items:[{...row,[key]:'PRIVATE'}]},{role:'admin',now}),null,key);
 }
});
test('sin duplicados, valores enum y orden de revisión incorrectos',()=>{
 assert.equal(projectIncidentQueue({...feed,items:[row,row]},{role:'admin',now}),null);
 assert.equal(projectIncidentQueue({...feed,items:[{...row,severity:'EMERGENCY_SENT'}]},{role:'admin',now}),null);
 const store=createIncidentQueueStore({now:()=>now});
 assert.equal(store.replace(feed,'admin'),true);
 assert.equal(store.replace({...feed,revision:1},'admin'),false);
 assert.equal(store.current('admin'),null);
});
test('sin red o expiración no afirma casos abiertos en cero',()=>{
 let tick=now;const store=createIncidentQueueStore({now:()=>tick});
 store.replace(feed,'admin');tick=now+31000;
 assert.equal(store.current('admin'),null);
 store.replace({...feed,expiresAt:now+120000},'admin');
 assert.equal(store.current('owner'),null);
});

test('G28/A05 acepta 50 incidencias por página, rechaza 51 sin perder registros de otras páginas',()=>{
 const make=n=>({...row,incidentId:'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0')});
 const fifty=Array.from({length:50},(_,i)=>make(i+1));
 assert.equal(projectIncidentQueue({...feed,items:fifty,nextCursor:'Z'.repeat(44)},{role:'admin',now}).items.length,50);
 assert.equal(projectIncidentQueue({...feed,items:[...fifty,make(51)]},{role:'admin',now}),null);
});
