import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const spec=JSON.parse(readFileSync(new URL(
 '../docs/backend/openapi/movete-facil-staging.openapi.json',import.meta.url),'utf8'));
const migration=readFileSync(new URL(
 '../docs/backend/staging_only/G46_MERCHANT_COMMERCE_PRIVILEGE_LOCKDOWN_POSTGRES_CI_ONLY.sql',
 import.meta.url),'utf8');
const ci=readFileSync(new URL('../../../.github/workflows/mobility-g4-postgres-disposable.yml',import.meta.url),'utf8');
test('G46 merchant cutover remains blocked while privilege closure is only in disposable PostgreSQL',()=>{
 assert.ok(Number(spec.info.version.split('-g')[1])>=46);
 assert.equal(spec['x-qore-live-enabled'],false);
 assert.equal(spec['x-qore-merchant-commerce-promotion-authorized'],false);
 assert.equal(spec['x-qore-merchant-runtime-ready'],false);
 assert.equal(spec['x-qore-g46-database-privilege-lockdown-ci-only'],true);
 for(const [path,method] of [
  ['/v1/staging/buyer/branches','get'],
  ['/v1/staging/buyer/branches/{branchId}/catalog','get'],
  ['/v1/staging/buyer/orders/reservations-g45','post'],
  ['/v1/staging/buyer/orders/{orderId}/cancel-reservation-g45','post']
 ]){
  const op=spec.paths[path]?.[method];
  assert.ok(op,path);
  assert.equal(op['x-qore-runtime-wired'],false,path);
  assert.equal(op['x-qore-qa-only'],true,path);
 }
 assert.match(migration,/current_database\(\)<>'qore_disposable_chain'/);
 assert.match(migration,/FROM PUBLIC,anon,authenticated,service_role/);
 assert.match(ci,/G46_MERCHANT_COMMERCE_PRIVILEGE_LOCKDOWN_POSTGRES_CI_ONLY.sql/);
 assert.match(ci,/G46_MERCHANT_COMMERCE_PRIVILEGE_ASSERT_POSTGRES_CI_ONLY.sql/);
});
