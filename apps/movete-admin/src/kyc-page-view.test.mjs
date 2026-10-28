import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyKycEvidence,projectKycPageView,KYC_FILTERS} from './kyc-page-view.mjs';
const base={vehicleId:'123e4567-e89b-42d3-a456-426614174010',
 vehicleKind:'AUTO',applicationStatus:'pending',reviewRevision:2,
 licenseStatus:'valid',insuranceStatus:'pending',inspectionStatus:'valid'};
const sample=(n,fields={})=>({...base,...fields,
 vehicleId:'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0')});
test('documentación reportada válida o aprobada no habilita un vehículo',()=>{
 assert.equal(classifyKycEvidence(base),'PENDING');
 const approved={...base,applicationStatus:'approved',insuranceStatus:'valid'};
 assert.equal(classifyKycEvidence(approved),'REPORTED_VALID');
 assert.equal(projectKycPageView([approved]).operationalEligibilityConfirmed,false);
});
test('G29.1 respeta vencimiento real reportado: prioridad conservadora',()=>{
 assert.equal(classifyKycEvidence({...base,licenseStatus:'expired',insuranceStatus:'valid'}),'EXPIRED');
 assert.equal(classifyKycEvidence({...base,licenseStatus:'rejected',insuranceStatus:'missing'}),'REJECTED');
 assert.equal(classifyKycEvidence({...base,licenseStatus:'missing',insuranceStatus:'pending'}),'MISSING');
});
test('conteos y filtros muestran sólo la página, nunca total global',()=>{
 const rows=[sample(1,{licenseStatus:'expired'}),sample(2,{licenseStatus:'rejected'}),
  sample(3,{licenseStatus:'missing'}),sample(4,{licenseStatus:'pending'}),
  sample(5,{insuranceStatus:'valid'})];
 const all=projectKycPageView(rows);
 assert.equal(all.scope,'VISIBLE_PAGE_ONLY');assert.equal(all.counts.ALL,5);
 for(const filter of KYC_FILTERS.filter(x=>x!=='ALL')){
  const result=projectKycPageView(rows,{filter});
  assert.equal(result.visibleCount,1,filter);assert.equal(result.items[0].evidence,filter);
  assert.equal(result.counts.ALL,5);
 }
 assert.equal(projectKycPageView(rows,{filter:'AUTO_APPROVED'}),null);
});
test('50 por página sin techo acumulado entre 120 páginas QA',()=>{
 for(let i=0;i<120;i++){
  const rows=Array.from({length:50},(_,j)=>sample(i*50+j+1,{insuranceStatus:'valid'}));
  assert.equal(projectKycPageView(rows).items.length,50);
 }
 assert.equal(projectKycPageView(Array.from({length:51},(_,i)=>sample(i+1))),null);
});
test('PII, rol moto pasajero y valores ilegales quedan fuera',()=>{
 for(const bad of [{...base,driverName:'PII'},{...base,vehicleKind:'MOTO_PASSENGER'},
  {...base,licenseStatus:'approved'},{...base,reviewRevision:-1}]){
  assert.equal(classifyKycEvidence(bad),null);
  assert.equal(projectKycPageView([bad]),null);
 }
});
test('proyección inmutable usa sólo siete campos públicos del servidor',()=>{
 const input=Object.freeze({...base});
 const output=projectKycPageView([input]);
 assert.equal(output.items[0].vehicleId,input.vehicleId);
 assert.equal(Object.hasOwn(output.items[0],'documentUrl'),false);
 assert.equal(Object.isFrozen(output.items[0]),true);
 assert.equal(input.insuranceStatus,'pending');
});
