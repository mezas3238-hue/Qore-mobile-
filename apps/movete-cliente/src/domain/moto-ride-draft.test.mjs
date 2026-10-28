import test from 'node:test';
import assert from 'node:assert/strict';
import {MOTO_PASSENGER_SERVICE,reviewMotoRideDraft} from './moto-ride-draft.mjs';
test('MOTO passenger route is not MOTO delivery and cannot dispatch or price locally',()=>{
 assert.equal(MOTO_PASSENGER_SERVICE,'MOTO_RIDE');
 const x=reviewMotoRideDraft({origin:'Centro de Asunción',destination:'Villa Morra',
  safetyAcknowledged:true});
 assert.deepEqual(x,{ok:true,serviceKind:'MOTO_RIDE',
  origin:'Centro de Asunción',destination:'Villa Morra',canBook:false,
  qaOnly:true,productionEnabled:false});
 assert.equal(Object.hasOwn(x,'amountGs'),false);
 assert.equal(Object.hasOwn(x,'driverId'),false);
 assert.equal(Object.hasOwn(x,'quoteId'),false);
 assert.equal(Object.isFrozen(x),true);
});
test('MOTO local review fails closed for unsafe or incomplete intent',()=>{
 for(const request of [
  {},{origin:'Centro',destination:'Centro',safetyAcknowledged:true},
  {origin:'  Centro',destination:'Aeropuerto',safetyAcknowledged:true},
  {origin:'Centro',destination:'Aeropuerto',safetyAcknowledged:false},
  {origin:'Centro',destination:'Aeropuerto',safetyAcknowledged:'true'},
  {origin:'Centro',destination:'Aeropuerto'+String.fromCharCode(10)+'Otra',safetyAcknowledged:true},
  {origin:'Centro',destination:'X'.repeat(121),safetyAcknowledged:true},
  {origin:'CENTRO',destination:'centro',safetyAcknowledged:true}
 ]){
  const result=reviewMotoRideDraft(request);
  assert.equal(result.ok,false);
  assert.equal(result.canBook,false);
  assert.equal(Object.hasOwn(result,'serviceKind'),false);
 }
});
