import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDeliveryForm,DELIVERY_CATEGORIES} from './delivery-form.mjs';
const sample={pickup:'Centro Asunción',destination:'Villa Morra',vehicleKind:'MOTO',grams:3500,
 lengthCm:30,widthCm:15,heightCm:12,category:'PARCEL',restrictedItemDeclared:false};
test('categorías exactas del catálogo OpenAPI',()=>{
 assert.deepEqual(DELIVERY_CATEGORIES.map(c=>c.code).sort(),
  ['DOCUMENTS','PARCEL','GROCERIES','RESTAURANT','PHARMACY_OTC'].sort());
});
test('formulario válido solo prepara borrador local',()=>{
 const out=validateDeliveryForm(sample);
 assert.equal(out.ok,true);assert.equal(out.grams,3500);
});
test('rechaza restricciones y tipos desconocidos',()=>{
 assert.equal(validateDeliveryForm({...sample,restrictedItemDeclared:true}).ok,false);
 assert.equal(validateDeliveryForm({...sample,category:'PRESCRIPTION'}).ok,false);
});
test('reject out of bounds weight and dimensions',()=>{
 assert.equal(validateDeliveryForm({...sample,grams:11000}).ok,false);
 assert.equal(validateDeliveryForm({...sample,lengthCm:0}).ok,false);
 assert.equal(validateDeliveryForm({...sample,widthCm:201}).ok,false);
 assert.equal(validateDeliveryForm({...sample,heightCm:1.5}).ok,false);
});
