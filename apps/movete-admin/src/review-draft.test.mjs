import test from 'node:test';
import assert from 'node:assert/strict';
import {TRAINING_CASES,createReviewDraft} from './review-draft.mjs';
const key='123e4567-e89b-42d3-a456-426614174000';
const valid={requestKey:key,vehicleId:TRAINING_CASES[0].id,approve:false,reason:'Documento pendiente de validación'};
test('casos QA no tienen nombre, DNI, matrícula o URL privada',()=>{
 for(const row of TRAINING_CASES)assert.deepEqual(Object.keys(row).sort(),
  ['id','label','vehicleKind','documentLabel'].sort());
});
test('crear decisión local no la envía ni declara aprobada',()=>{
 const result=createReviewDraft(valid);
 assert.equal(result.ok,true);
 assert.equal(result.submitted,false);
 assert.equal(result.localOnly,true);
});
test('vehículo desconocido y rol falso son inválidos',()=>{
 assert.equal(createReviewDraft({...valid,vehicleId:key}).ok,false);
 assert.equal(createReviewDraft({...valid,approve:'admin'}).ok,false);
});
test('motivo corto, correo y teléfono se bloquean',()=>{
 assert.equal(createReviewDraft({...valid,reason:'corto'}).ok,false);
 assert.equal(createReviewDraft({...valid,reason:'Enviar a user@example.com urgente'}).ok,false);
 assert.equal(createReviewDraft({...valid,reason:'Llamar al +595 981 123 456 hoy'}).ok,false);
});
