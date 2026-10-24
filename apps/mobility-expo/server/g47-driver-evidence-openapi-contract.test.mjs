import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const spec=JSON.parse(readFileSync(new URL(
 '../docs/backend/openapi/movete-facil-staging.openapi.json',import.meta.url),'utf8'));
const sql=readFileSync(new URL(
 '../docs/backend/staging_only/G47_PRIVATE_DRIVER_EVIDENCE_LEASES_POSTGRES_CI_ONLY.sql',
 import.meta.url),'utf8');
test('G47 Driver document metadata access contracts never expose physical Storage or LIVE',()=>{
 assert.ok(Number(spec.info.version.split('-g')[1])>=47);
 assert.equal(spec['x-qore-live-enabled'],false);
 assert.equal(spec['x-qore-driver-evidence-storage-connected'],false);
 assert.equal(spec['x-qore-driver-evidence-signed-url-enabled'],false);
 for(const [url,input,output,status] of [
  ['/v1/staging/driver/evidence/leases-g47','DriverEvidenceLeaseRequestG47',
   'DriverEvidenceLeaseReceiptG47','201'],
  ['/v1/staging/driver/evidence/leases-g47/probe','DriverEvidenceProbeRequestG47',
   'DriverEvidenceProbeReceiptG47','200']
 ]){
  const op=spec.paths[url]?.post;
  assert.ok(op,url);
  assert.equal(op['x-qore-runtime-wired'],false);
  assert.equal(op['x-qore-qa-only'],true);
  assert.equal(op.requestBody.content['application/json'].schema.$ref,
   '#/components/schemas/'+input);
  assert.equal(op.responses[status].content['application/json'].schema.$ref,
   '#/components/schemas/'+output);
  assert.deepEqual(op.responses.default,{$ref:'#/components/responses/Error'});
  for(const code of ['400','401','403','409','410','429','503'])
   assert.deepEqual(op.responses[code],{$ref:'#/components/responses/Error'});
  assert.equal(spec.components.schemas[input].additionalProperties,false);
  assert.equal(spec.components.schemas[output].additionalProperties,false);
  for(const forbidden of ['signedUrl','url','objectKey','storageBucket','sha256Hex',
   'documentBytes','mimeType','byteSize','driverId','reviewerId']){
   assert.equal(spec.components.schemas[input].properties[forbidden],undefined);
   assert.equal(spec.components.schemas[output].properties[forbidden],undefined);
  }
  assert.equal(spec.components.schemas[output].properties.productionEnabled.const,false);
  assert.equal(spec.components.schemas[output].properties.signedUrlAvailable.const,false);
  assert.equal(spec.components.schemas[output].properties.documentBytesAvailable.const,false);
 }
 assert.equal(spec.components.schemas.DriverEvidenceLeaseReceiptG47.properties.storageConnected.const,false);
 assert.match(sql,/current_database\(\)<>'qore_disposable_chain'/);
 assert.match(sql,/REVOKE ALL ON public\.mobility_stage_driver_documents/);
 assert.match(sql,/mobility_stage_g42_lock_session/);
 assert.doesNotMatch(sql,/GRANT EXECUTE ON FUNCTION public\.mobility_stage_g47_issue_lease_qa/);
});
