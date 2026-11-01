import test from 'node:test';
import assert from 'node:assert/strict';
import {DRIVER_OFFLINE_QA_CHECKS,buildDriverOfflineQaChecklist}
 from './driver-offline-qa-checklist.mjs';
test('initial QA report has only six ephemeral boolean checks',()=>{
 const a=buildDriverOfflineQaChecklist();
 assert.equal(a.total,6);assert.equal(a.count,0);
 assert.equal(a.certified,false);
 assert.equal(a.entries.every(x=>!x.observed),true);
});
test('six human observations still cannot certify legal Driver or KYC',()=>{
 const a=buildDriverOfflineQaChecklist(
  Object.fromEntries(DRIVER_OFFLINE_QA_CHECKS.map(k=>[k,true])));
 assert.equal(a.count,6);assert.equal(a.certified,false);
 assert.equal(a.driverEligible,false);assert.equal(a.mayDispatch,false);
 assert.equal(JSON.stringify(a).includes('ocr_text'),false);
});
test('unknown keys, PII and malformed values invalidate entire checklist',()=>{
 for(const raw of [null,[],{permission_prompt:'true'},
  {plate:'ABCD123'},{identityNumber:'123'}, {ocr_consistent:1}]){
  const a=buildDriverOfflineQaChecklist(raw);
  assert.equal(a.valid,false);assert.equal(a.count,0);
 }
});
