import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const spec=JSON.parse(read('../docs/backend/openapi/movete-facil-staging.openapi.json'));
const sql=read('../docs/backend/staging_only/G57B_DRIVER_ORDERED_VISIBLE_POSTGRES_CI_ONLY.sql');
const tests=read('../docs/backend/staging_only/G57B_DRIVER_ORDERED_VISIBLE_ASSERT_POSTGRES_CI_ONLY.sql');
const ci=read('../../../.github/workflows/mobility-g4-postgres-disposable.yml');
const race=read('./g57b-driver-ordered-concurrency-ci.py');
test('G57B Driver-only endpoints OFF; do not change B history or Passenger G57 schema',()=>{
 assert.ok(Number(spec.info.version.split('-g')[1])>=57);
 assert.equal(spec['x-qore-live-enabled'],false);
 assert.equal(spec['x-qore-g57b-driver-ordered-visible-runtime-wired'],false);
 const h=spec.paths['/v1/staging/driver/chat/services/{serviceKind}/{serviceId}/conversations/{conversationId}/history-with-ordered-markers']?.get;
 const mark=spec.paths['/v1/staging/driver/chat/conversations/{conversationId}/mark-visible-ordered']?.post;
 for(const operation of [h,mark]){
  assert.ok(operation);
  assert.equal(operation['x-qore-runtime-wired'],false);
  assert.equal(operation['x-qore-qa-only'],true);
  assert.deepEqual(operation.security,[{BearerAuth:[]}]);
  for(const code of ['200','400','401','403','409','429','503','default'])
   assert.ok(operation.responses[code]);
 }
 assert.equal(h.responses['200'].content['application/json'].schema.$ref,
  '#/components/schemas/DriverChatOrderedHistoryG57B');
 assert.equal(mark.responses['200'].content['application/json'].schema.$ref,
  '#/components/schemas/DriverChatMarkVisibleOrderedReceiptG57B');
 assert.equal(spec.components.schemas.ChatHistoryPageG52.properties.counterpartRole.const,'driver');
 assert.equal(spec.components.schemas.DriverChatHistoryG56.properties.counterpartRole.const,'passenger');
});
test('G57B markers and ACK are exact and exclude forged sequence or actor/session',()=>{
 const defs=spec.components.schemas;
 for(const name of ['DriverChatOrderedHistoryG57B',
  'DriverChatMarkVisibleOrderedRequestG57B',
  'DriverChatMarkVisibleOrderedReceiptG57B'])
  assert.equal(defs[name].additionalProperties,false,name);
 assert.deepEqual(defs.DriverChatMarkVisibleOrderedRequestG57B.required,['messageId','marker']);
 assert.deepEqual(defs.DriverChatMarkVisibleOrderedReceiptG57B.required,
  ['conversationId','messageId','readConfirmed','qaOnly']);
 assert.equal(defs.DriverChatOrderedHistoryG57B.properties.readMarkers.maxItems,100);
 assert.equal(defs.DriverChatOrderedHistoryG57B.properties.page.$ref,
  '#/components/schemas/DriverChatHistoryG56');
 for(const bad of ['seq','throughSeq','sessionId','actorId','role','readThrough']){
  assert.equal(defs.DriverChatMarkVisibleOrderedRequestG57B.properties[bad],undefined);
  assert.equal(defs.DriverChatMarkVisibleOrderedReceiptG57B.properties[bad],undefined);
 }
});
test('G57B current Driver assignment, per-Passenger markers and delegated-only real PG16 CI',()=>{
 assert.match(sql,/qore_disposable_chain/);
 assert.match(sql,/mobility_stage_g56_history_qa/);
 assert.match(sql,/mobility_stage_g42_lock_session/);
 assert.match(sql,/mobility_stage_g50_source/);
 assert.match(sql,/G5718/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/mobility_stage_g51_mark_read_owner_qa/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
 assert.match(sql,/TO mobility_g56_driver_gateway_ci/);
 assert.match(tests,/SET LOCAL ROLE mobility_g56_driver_gateway_ci/);
 assert.match(tests,/G57B Driver skipped first unread Passenger message/);
 assert.match(tests,/G57B stale Driver still confirmed read/);
 assert.match(ci,/G57B_DRIVER_ORDERED_VISIBLE_POSTGRES_CI_ONLY.sql/);
 assert.match(ci,/G57B_DRIVER_ORDERED_VISIBLE_ASSERT_POSTGRES_CI_ONLY.sql/);
 assert.match(ci,/g57b-driver-ordered-concurrency-ci.py/);
 assert.ok(race.includes('Barrier(2)'));
 assert.match(race,/SET LOCAL ROLE mobility_g56_driver_gateway_ci/);
 assert.match(race,/G5718/);
 assert.match(race,/G5711/);
});
