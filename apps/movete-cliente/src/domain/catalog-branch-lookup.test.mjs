import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareCatalogBranchLookup,isSelectedCatalogBranchCurrent} from './catalog-branch-lookup.mjs';
const valid='123e4567-e89b-42d3-a456-426614174001';
test('normaliza UUID autorizado sin copiar texto libre ni información personal',()=>{
 const r=prepareCatalogBranchLookup(valid.toUpperCase());
 assert.deepEqual(r,{ok:true,branchId:valid,noNetwork:true});
 assert.equal(Object.isFrozen(r),true);
});
test('rechaza teléfonos, correos, GPS, texto libre, rutas y URLs sin invocar red',()=>{
 for(const invalid of [
  null,123,'','Asunción centro','0981123456','foo@example.com',
  '-25.3011,-57.6009','https://example.org/merchant', '../admin',
  valid+'?extra=1',' '+valid,valid+' ','0'.repeat(37),{},
 ]){
  const r=prepareCatalogBranchLookup(invalid);
  assert.equal(r.ok,false,String(invalid));
  assert.equal(r.code,'INVALID_BRANCH');
 }
});
test('la selección solo autoriza un identificador, nunca garantiza cobertura o stock',()=>{
 const r=prepareCatalogBranchLookup(valid);
 assert.equal(r.ok,true);
 assert.equal(Object.hasOwn(r,'stockUnits'),false);
 assert.equal(Object.hasOwn(r,'coveredByZone'),false);
 assert.equal(Object.hasOwn(r,'checkoutEnabled'),false);
});

test('precios de sucursal solo aparecen con selección UUID coincidente',()=>{
 const other='123e4567-e89b-42d3-a456-426614174099';
 assert.equal(isSelectedCatalogBranchCurrent(valid,valid),true);
 assert.equal(isSelectedCatalogBranchCurrent(valid.toUpperCase(),valid),true);
 assert.equal(isSelectedCatalogBranchCurrent(other,valid),false);
 for(const candidate of ['','123','  '+valid,null,'correo@example.com'])
  assert.equal(isSelectedCatalogBranchCurrent(candidate,valid),false);
 assert.equal(isSelectedCatalogBranchCurrent(valid,null),false);
});
