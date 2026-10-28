import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const spec=JSON.parse(readFileSync(new URL(
 '../docs/backend/openapi/movete-facil-staging.openapi.json',import.meta.url),'utf8'));
test('G44 two Buyer GETs are typed, auth-bound, and NOT wired',()=>{
 assert.ok(spec.info.version.startsWith('1.0.0-g'));
 for(const [path,schema] of [
  ['/v1/staging/buyer/branches','BuyerBranchPageG44'],
  ['/v1/staging/buyer/branches/{branchId}/catalog','BuyerCatalogPageG44']
 ]){
  const op=spec.paths[path]?.get;
  assert.ok(op,'missing '+path);
  assert.equal(op['x-qore-runtime-wired'],false);
  assert.equal(op['x-qore-qa-only'],true);
  assert.equal(op.responses['200'].content['application/json'].schema.$ref,
   '#/components/schemas/'+schema);
  for(const s of ['400','401','403','409','429','503'])
   assert.equal(op.responses[s].$ref,'#/components/responses/Error');
  assert.equal(spec.components.schemas[schema].additionalProperties,false);
  assert.equal(spec.components.schemas[schema].properties.items.maxItems,100);
  assert.ok(op.parameters.some(p=>p.name==='cursor'));
 }
 assert.equal(spec['x-qore-live-enabled'],false);
 assert.equal(spec.components.schemas.BuyerCatalogItemG44.additionalProperties,false);
 assert.deepEqual(spec.components.schemas.BuyerCatalogItemG44.properties.itemClass.enum,
  ['GENERAL','PHARMACY_OTC']);
 assert.equal(spec.components.schemas.BuyerCatalogPageG44.properties.orderEnabled.const,false);
 assert.equal(spec.components.schemas.BuyerCatalogPageG44.properties.eligibleByPolicy.const,false);
 assert.equal(spec.components.schemas.BuyerBranchPageG44.properties.orderEnabled.const,false);
 assert.equal(spec.components.schemas.BuyerCatalogPageG44.properties.nextCursor.oneOf.length,2);
});
