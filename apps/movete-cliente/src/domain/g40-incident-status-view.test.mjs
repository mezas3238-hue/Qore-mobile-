import test from 'node:test';
import assert from 'node:assert/strict';
import {projectQaIncidentStatusView} from './g40-incident-status-view.mjs';
const T=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const receipt=(patch={})=>({
 incidentId:id(1),receiptId:id(2),state:'open',revision:1,
 createdAt:new Date(T-5000).toISOString(),
 observedAt:new Date(T-1000).toISOString(),
 receiptStatus:'RECEIVED_IN_QA_DATABASE_ONLY',...patch
});
const report=(patch={})=>({
 phase:'acknowledged',statusFresh:true,contractReady:true,
 qaDatabaseOnly:true,sosDispatched:false,operatorNotified:false,
 receipt:receipt(),...patch
});
const project=(raw=report(),options={})=>
 projectQaIncidentStatusView(raw,{authenticated:true,now:T,...options});

test('R41 presenta el recibo QA sin atribuir agente, caso comercial ni SOS',()=>{
 const p=project();
 assert.equal(p.verified,true);
 assert.equal(p.code,'QA_DATABASE_SNAPSHOT_ONLY');
 assert.equal(p.label,'Registrado en base de pruebas');
 assert.equal(p.receiptId,id(2));
 assert.equal(p.incidentId,id(1));
 for(const field of ['operatorNotified','sosDispatched',
  'merchantContacted','humanSupportConfirmed'])assert.equal(p[field],false);
 assert.equal(p.qaOnly,true);
 assert.equal(Object.isFrozen(p),true);
 assert.equal('contactEmail' in p,false);
});
test('R41 estados G40 son etiquetas QA, no una cronología inventada',()=>{
 for(const state of ['open','triaged','investigating','resolved','dismissed']){
  const result=project(report({receipt:receipt({state})}));
  assert.equal(result.verified,true);
  assert.match(result.label,/QA|base de pruebas/);
  assert.match(result.description,/QA/);
  assert.equal('events' in result,false);
  assert.equal('timeline' in result,false);
  assert.equal(result.humanSupportConfirmed,false);
 }
});
test('R41 no muestra estado sin cuenta, runtime certificado o permisos',()=>{
 assert.equal(project(report(),{authenticated:false}).code,'AUTH_REQUIRED');
 for(const patch of [
  {contractReady:false},{qaDatabaseOnly:false},
  {sosDispatched:true},{operatorNotified:true},
  {phase:'failed'},{phase:'checking'},{phase:'in_flight'},
  {statusFresh:false},{receipt:null}
 ]){
  const r=project(report(patch));
  assert.equal(r.verified,false);
  assert.equal(r.receiptId,null);
  assert.equal(r.incidentId,null);
 }
});
test('R41 TTL estricto 45 s y reloj adelantado bloquean estado',()=>{
 const p=report({receipt:receipt({
  createdAt:new Date(T-44000).toISOString(),
  observedAt:new Date(T-44000).toISOString()
 })});
 assert.equal(project(p).verified,true);
 assert.equal(project(p,{now:T+999}).verified,true);
 assert.equal(project(p,{now:T+1000}).code,'INCIDENT_STATUS_EXPIRED');
 const future=report({receipt:receipt({
  observedAt:new Date(T+1).toISOString()
 })});
 assert.equal(project(future).code,'INCIDENT_STATUS_EXPIRED');
});
test('R41 rechaza cambio de ID, estado o versión invalida',()=>{
 for(const patch of [
  {state:'operator_dispatched'},{state:'__proto__'},
  {state:'CRITICAL'},{revision:0},{revision:1.2},
  {receiptStatus:'RECEIVED_BY_SUPPORT'},{receiptId:'fake'},
  {incidentId:'https://example.test'},
  {ownerId:id(3)},
  {createdAt:'yesterday'},
  {observedAt:'2026-01-20'},
  {observedAt:'2027-00-00T00:00:00Z'}
 ]){
  const r=project(report({receipt:receipt(patch)}));
  assert.equal(r.verified,false,JSON.stringify(patch));
  assert.equal(r.receiptId,null);
 }
});
test('R41 timestamps invertidos/expirados y fecha de backend futura no son frescos',()=>{
 const bad=[
  receipt({createdAt:new Date(T).toISOString(),observedAt:new Date(T-1000).toISOString()}),
  receipt({createdAt:new Date(T+10).toISOString(),observedAt:new Date(T+20).toISOString()}),
  receipt({createdAt:new Date(T-60000).toISOString(),observedAt:new Date(T-50000).toISOString()})
 ];
 for(const value of bad){
  assert.equal(project(report({receipt:value})).verified,false);
 }
});
test('R41 fallos de sesión o datos malformados no filtran IDs o estados',()=>{
 for(const raw of [null,{},[],1,'fake',report({receipt:undefined})]){
  const r=project(raw);
  assert.equal(r.verified,false);
  assert.equal(r.receiptId,null);
  assert.equal(r.incidentId,null);
  assert.equal(r.operatorNotified,false);
 }
});
test('R41 no acepta booleanos true por coincidencia de nombres',()=>{
 for(const patch of [
  {statusFresh:1},{contractReady:'true'},
  {qaDatabaseOnly:'true'},{operatorNotified:null},{sosDispatched:null}
 ]){
  assert.equal(project(report(patch)).verified,false);
 }
});
test('R41 proyección acepta una revisión superior sin probar atención',()=>{
 const r=project(report({receipt:receipt({
  state:'investigating',revision:5
 })}));
 assert.equal(r.verified,true);
 assert.equal(r.revision,5);
 assert.equal(r.humanSupportConfirmed,false);
 assert.equal(r.merchantContacted,false);
});
test('R41 errores no exponen metadatos del recibo ni PII',()=>{
 const p=project(report({statusFresh:false,
  receipt:receipt({incidentId:id(8),receiptId:id(9)})}));
 assert.equal(JSON.stringify(p).includes(id(8)),false);
 assert.equal(JSON.stringify(p).includes(id(9)),false);
 assert.deepEqual(Object.keys(p).sort(),[
  'verified','code','label','description','receiptId','incidentId','revision',
  'observedAt','qaOnly','operatorNotified','sosDispatched',
  'merchantContacted','humanSupportConfirmed'].sort());
});
