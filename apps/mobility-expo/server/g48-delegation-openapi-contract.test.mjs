import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const spec=JSON.parse(readFileSync(new URL(
 '../docs/backend/openapi/movete-facil-staging.openapi.json',import.meta.url),'utf8'));
const sql=readFileSync(new URL(
 '../docs/backend/staging_only/G48_SCOPED_DB_DELEGATION_POSTGRES_CI_ONLY.sql',
 import.meta.url),'utf8');
const workflow=readFileSync(new URL(
 '../../../.github/workflows/mobility-g4-postgres-disposable.yml',
 import.meta.url),'utf8');

test('G48 documented read contracts are NEVER mounted, LIVE or a hidden proof issuer',()=>{
 assert.ok(Number(spec.info.version.split('-g')[1])>=48);
 assert.equal(spec['x-qore-live-enabled'],false);
 assert.equal(spec['x-qore-g48-gateway-role-login-enabled'],false);
 assert.equal(spec['x-qore-g48-runtime-wired'],false);
 assert.equal(spec['x-qore-g48-provider-to-db-proof-wired'],false);
 for(const [path,method,responseName,status] of [
  ['/v1/staging/driver/documents/status-g48','get','DriverStatusReceiptG48','200'],
  ['/v1/staging/driver/evidence/probe-g48','post','DriverEvidenceProbeReceiptG47','200'],
  ['/v1/staging/buyer/branches/{branchId}/catalog-g48','get','BuyerCatalogPageG48','200']
 ]){
  const op=spec.paths[path]?.[method];
  assert.ok(op,path);
  assert.equal(op['x-qore-runtime-wired'],false);
  assert.equal(op['x-qore-qa-only'],true);
  assert.equal(op['x-qore-owner-attestation-synthetic-only'],true);
  assert.equal(op.responses[status].content['application/json'].schema.$ref,
   '#/components/schemas/'+responseName);
  assert.deepEqual(op.responses.default,{$ref:'#/components/responses/Error'});
  assert.equal(spec.components.schemas[responseName].additionalProperties,false);
  for(const key of ['signedUrl','documentBytes','objectKey','sha256Hex',
   'storageBucket','actorId','role','ticket','providerJwt'])
   assert.equal(spec.components.schemas[responseName].properties[key],undefined,key);
 }
 for(const type of ['DriverStatusReceiptG48','BuyerCatalogPageG48']){
  const schema=spec.components.schemas[type];
  assert.equal(schema.properties.productionEnabled.const,false);
 }
 assert.equal(spec.components.schemas.BuyerCatalogPageG48.properties.orderEnabled.const,false);
 assert.equal(spec.components.schemas.BuyerCatalogPageG48.properties.eligibleByPolicy.const,false);
 assert.equal(spec.components.schemas.BuyerCatalogPageG48.properties.items.maxItems,100);
 assert.deepEqual(spec.components.schemas.DriverEvidenceProbeRequestG48.required,['leaseId']);
});
test('G48 role is NOLOGIN, only read-wrapper grants and DB owner alone can mint',()=>{
 assert.match(sql,/CREATE ROLE mobility_g48_gateway_ci NOLOGIN NOINHERIT/);
 assert.match(sql,/GRANT USAGE ON SCHEMA public TO mobility_g48_gateway_ci/);
 assert.match(sql,/CREATE TABLE public\.mobility_stage_g48_delegation_proofs/);
 assert.match(sql,/ticket_hash bytea PRIMARY KEY CHECK\(octet_length\(ticket_hash\)=32\)/);
 assert.match(sql,/pg_catalog\.sha256/);
 assert.match(sql,/mobility_stage_g42_lock_session/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.mobility_stage_g48_mint_owner_attested_qa/);
 assert.doesNotMatch(sql,/GRANT EXECUTE ON FUNCTION public\.mobility_stage_g48_mint_owner_attested_qa/);
 assert.doesNotMatch(sql,/GRANT SELECT ON public\.mobility_stage_g48_delegation_proofs/);
 assert.match(workflow,/G48_SCOPED_DB_DELEGATION_POSTGRES_CI_ONLY.sql/);
 assert.match(workflow,/G48_SCOPED_DB_DELEGATION_ASSERT_POSTGRES_CI_ONLY.sql/);
 assert.match(workflow,/g48-scoped-db-delegation-race-ci.py/);
});
