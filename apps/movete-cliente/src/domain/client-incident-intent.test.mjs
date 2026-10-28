import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareG40IncidentIntent,INCIDENT_SERVICE_OPTIONS,
 INCIDENT_CATEGORY_OPTIONS,INCIDENT_SEVERITY_OPTIONS} from './client-incident-intent.mjs';
const uuid='123e4567-e89b-42d3-a456-426614174020';
const key='123e4567-e89b-42d3-a456-426614174021';
const valid={subjectKind:'RIDE',subjectId:uuid,category:'QUALITY',severity:'LOW'};
test('preparación G40 produce cinco campos exactos, sin PII ni SOS',()=>{
 const r=prepareG40IncidentIntent(valid,()=>key);
 assert.equal(r.ok,true);
 assert.deepEqual(r.body,{requestKey:key,...valid});
 assert.equal(r.submitted,false);assert.equal(r.sosDispatched,false);
 assert.equal(r.operatorNotified,false);
 assert.equal(Object.isFrozen(r.body),true);
});
test('servicios incluyen viaje y ambas clases de entrega',()=>{
 assert.deepEqual(INCIDENT_SERVICE_OPTIONS.map(x=>x.code),
  ['RIDE','DELIVERY','MERCHANT_ORDER']);
});
test('severidad crítica y emergencia no pueden seleccionarse',()=>{
 assert.deepEqual(INCIDENT_SEVERITY_OPTIONS.map(x=>x.code),['LOW','MEDIUM','HIGH']);
 assert.equal(INCIDENT_CATEGORY_OPTIONS.some(x=>x.code==='SOS'),false);
 for(const severity of ['CRITICAL','SOS','MEDICAL_EMERGENCY'])
  assert.equal(prepareG40IncidentIntent({...valid,severity},()=>key).ok,false);
});
test('entrada inválida se rechaza ANTES de generar clave',()=>{
 let calls=0;const gen=()=>{calls++;return key;};
 for(const body of [
  {...valid,subjectId:'not-a-uuid'},{...valid,subjectId:''},
  {...valid,subjectKind:'PASSENGER_MOTORCYCLE'},
  {...valid,category:'PAYMENT'},{...valid,severity:'CRITICAL'}
 ])assert.equal(prepareG40IncidentIntent(body,gen).ok,false);
 assert.equal(calls,0);
});
test('sin CSPRNG nunca inventa una requestKey',()=>{
 assert.equal(prepareG40IncidentIntent(valid,null).ok,false);
 assert.equal(prepareG40IncidentIntent(valid,()=> 'not-a-v4').ok,false);
 assert.equal(prepareG40IncidentIntent(valid,()=>{throw Error('no native random');}).ok,false);
});
test('no transmite nombre, teléfono, descripción o coordenadas',()=>{
 const r=prepareG40IncidentIntent({...valid,description:'Información sensible',phone:'0981000000'},
  ()=>key);
 assert.equal(r.ok,true);
 assert.equal(Object.hasOwn(r.body,'description'),false);
 assert.equal(Object.hasOwn(r.body,'phone'),false);
 assert.equal(Object.hasOwn(r.body,'latitude'),false);
});
