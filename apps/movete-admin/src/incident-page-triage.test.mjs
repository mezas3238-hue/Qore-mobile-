import test from 'node:test';
import assert from 'node:assert/strict';
import {projectIncidentPageTriage} from './incident-page-triage.mjs';

const now=1800000000000;
const uuid=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const incident=(n,changes={})=>({
 incidentId:uuid(n),category:'SAFETY',severity:'MEDIUM',
 status:'OPEN',createdAt:now-n*1000,revision:n,...changes
});
const page=(items)=>({expiresAt:now+60000,items});
test('conteos y filtros se limitan a UNA página, sin total global',()=>{
 const q=page([
  incident(1,{severity:'CRITICAL'}),
  incident(2,{severity:'HIGH',status:'TRIAGED'}),
  incident(3,{severity:'CRITICAL',status:'CLOSED'}),
  incident(4,{severity:'LOW',status:'INVESTIGATING'})
 ]);
 const all=projectIncidentPageTriage(q,{now});
 assert.deepEqual(all.counts,{all:4,active:3,criticalActive:1});
 assert.equal(all.scope,'VISIBLE_PAGE_ONLY');
 assert.equal(all.noGlobalTotal,true);
 assert.equal(all.operationsAllowed,false);
 assert.equal(all.sosEnabled,false);
 assert.deepEqual(projectIncidentPageTriage(q,{now,filter:'CRITICAL_ACTIVE'}).items.map(x=>x.incidentId),[uuid(1)]);
 assert.equal(projectIncidentPageTriage(q,{now,filter:'ACTIVE'}).items.length,3);
});
test('prioridad conserva activos adelante y usa severidad y antigüedad como criterio local',()=>{
 const q=page([
  incident(1,{severity:'HIGH'}),
  incident(2,{severity:'CRITICAL',status:'RESOLVED'}),
  incident(3,{severity:'LOW'}),
  incident(4,{severity:'CRITICAL'}),
  incident(5,{severity:'CRITICAL'})
 ]);
 const rows=projectIncidentPageTriage(q,{now}).items;
 assert.deepEqual(rows.map(x=>x.incidentId),[uuid(5),uuid(4),uuid(1),uuid(3),uuid(2)]);
 assert.deepEqual(projectIncidentPageTriage(q,{now,order:'RECENT'}).items.map(x=>x.incidentId),
  [uuid(1),uuid(2),uuid(3),uuid(4),uuid(5)]);
});
test('rechaza PII extra, duplicados, campos desconocidos y tipo malformado',()=>{
 const q=page([incident(1)]);
 for(const field of ['name','phone','reporterId','gps','documentUrl','description','jwt'])
  assert.equal(projectIncidentPageTriage(page([{...incident(1),[field]:'private'}]),{now}),null,field);
 assert.equal(projectIncidentPageTriage(page([incident(1),incident(1)]),{now}),null);
 assert.equal(projectIncidentPageTriage(page([incident(1,{severity:'SOS_SENT'})]),{now}),null);
 assert.equal(projectIncidentPageTriage(page([incident(1,{createdAt:Infinity})]),{now}),null);
 assert.equal(projectIncidentPageTriage(page([incident(1,{revision:-1})]),{now}),null);
 assert.equal(projectIncidentPageTriage(q,{filter:'ALL_PLATFORM',now}),null);
 assert.equal(projectIncidentPageTriage(q,{order:'SERVER_PRIORITY',now}),null);
});
test('al vencer página descarta todo en vez de sugerir que no hay casos',()=>{
 assert.equal(projectIncidentPageTriage({expiresAt:now,items:[incident(1)]},{now}),null);
 assert.equal(projectIncidentPageTriage({expiresAt:now+1000,items:[incident(1)]},{now:now+1000}),null);
});
test('soporta 50 por página y no impone máximo global de registros',()=>{
 const fifty=Array.from({length:50},(_,i)=>incident(i+1));
 assert.equal(projectIncidentPageTriage(page(fifty),{now}).items.length,50);
 assert.equal(projectIncidentPageTriage(page([...fifty,incident(51)]),{now}),null);
 const second=Array.from({length:50},(_,i)=>incident(i+51));
 assert.equal(projectIncidentPageTriage(page(second),{now}).items.length,50);
});
test('proyección no expone referencia mutable de backend',()=>{
 const original=incident(1),result=projectIncidentPageTriage(page([original]),{now});
 original.status='CLOSED';
 assert.equal(result.items[0].status,'OPEN');
 assert.equal(Object.isFrozen(result.items[0]),true);
 assert.equal(Object.isFrozen(result.items),true);
});
test('lista sin casos no equivale a cero registros globales',()=>{
 const result=projectIncidentPageTriage(page([]),{now});
 assert.equal(result.counts.all,0);
 assert.equal(result.noGlobalTotal,true);
 assert.equal(result.scope,'VISIBLE_PAGE_ONLY');
});
