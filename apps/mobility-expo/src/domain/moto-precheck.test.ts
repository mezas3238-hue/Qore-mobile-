import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyMotoPrecheck,evaluateMotoPrecheck,MOTO_PRECHECK_ITEMS,type MotoPrecheckField} from './moto-precheck.ts';

test('moto precheck starts with eight missing declarations and no authorization',()=>{
 const result=evaluateMotoPrecheck(emptyMotoPrecheck());
 assert.equal(result.missing.length,8);
 assert.equal(result.declaredReadyForReview,false);
 assert.equal(result.commercialTripsAllowed,false);
 assert.equal(result.decision,'RESEARCH_ONLY');
});
test('all declared documents NEVER approve commercial transport or accept real passengers',()=>{
 const answers=emptyMotoPrecheck();
 for(const item of MOTO_PRECHECK_ITEMS)answers[item.key]=true;
 const result=evaluateMotoPrecheck(answers);
 assert.deepEqual(result.missing,[]);
 assert.equal(result.declaredReadyForReview,true);
 assert.equal(result.commercialTripsAllowed,false);
 assert.equal(result.decision,'RESEARCH_ONLY');
 assert.match(result.notice,/faltan autorización legal/i);
});
test('insurance and municipal permit are independently mandatory for a precheck',()=>{
 const answers=emptyMotoPrecheck();
 for(const item of MOTO_PRECHECK_ITEMS)answers[item.key]=true;
 for(const key of ['paidPassengerInsuranceEvidence','municipalCommercialPermitEvidence'] as MotoPrecheckField[]){
  const failed=evaluateMotoPrecheck({...answers,[key]:false});
  assert.equal(failed.declaredReadyForReview,false);
  assert.equal(failed.commercialTripsAllowed,false);
  assert.equal(failed.missing.length,1);
 }
});
test('helmets and reflective vests are separate requirements',()=>{
 const answers=emptyMotoPrecheck();
 for(const item of MOTO_PRECHECK_ITEMS)answers[item.key]=true;
 for(const key of ['twoCertifiedHelmets','twoReflectiveVests'] as MotoPrecheckField[]){
  const result=evaluateMotoPrecheck({...answers,[key]:false});
  assert.equal(result.missing.length,1);
  assert.equal(result.commercialTripsAllowed,false);
 }
});
test('undefined, string or numeric answers do not silently pass',()=>{
 const answers=emptyMotoPrecheck();
 const unsafe={...answers} as Record<string,unknown>;
 unsafe['licenseClassEvidence']='true';
 unsafe['inspectionEvidence']=1;
 const result=evaluateMotoPrecheck(unsafe as ReturnType<typeof emptyMotoPrecheck>);
 assert.equal(result.missing.length,8);
});
