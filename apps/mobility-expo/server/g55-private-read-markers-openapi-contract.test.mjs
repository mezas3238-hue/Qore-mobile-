import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const spec=JSON.parse(read('../docs/backend/openapi/movete-facil-staging.openapi.json'));
const sql=read('../docs/backend/staging_only/G55_SERVER_ISSUED_READ_MARKERS_POSTGRES_CI_ONLY.sql');
const assertions=read('../docs/backend/staging_only/G55_SERVER_ISSUED_READ_MARKERS_ASSERT_POSTGRES_CI_ONLY.sql');
const ci=read('../../../.github/workflows/mobility-g4-postgres-disposable.yml');
test('G55 keeps original sealed B G52 DTO, exposes only offline sidecar and explicit visible receipt',()=>{
 assert.ok(Number(spec.info.version.split('-g')[1])>=55);
 assert.equal(spec['x-qore-live-enabled'],false);
 assert.equal(spec['x-qore-g55-server-issued-read-marker-runtime-wired'],false);
 const history=spec.paths['/v1/staging/chat/services/{serviceKind}/{serviceId}/history-with-read-marker']?.get;
 const read=spec.paths['/v1/staging/chat/conversations/{conversationId}/mark-visible']?.post;
 for(const operation of [history,read]){
  assert.ok(operation);
  assert.equal(operation['x-qore-runtime-wired'],false);
  assert.equal(operation['x-qore-qa-only'],true);
 }
 assert.equal(history.responses['200'].content['application/json'].schema.$ref,
  '#/components/schemas/ChatHistoryWithMarkerG55');
 assert.equal(read.responses['200'].content['application/json'].schema.$ref,
  '#/components/schemas/ChatMarkVisibleReceiptG55');
 assert.deepEqual(spec.components.schemas.ChatHistoryWithMarkerG55.required,
  ['page','readMarker','qaOnly','productionEnabled']);
 assert.equal(spec.components.schemas.ChatHistoryWithMarkerG55.properties.page.$ref,
  '#/components/schemas/ChatHistoryPageG52');
 assert.deepEqual(spec.components.schemas.ChatMarkVisibleRequestG55.required,['marker']);
 assert.deepEqual(spec.components.schemas.ChatMarkVisibleReceiptG55.required,
  ['conversationId','messageId','readConfirmed','qaOnly']);
 for(const n of ['ChatHistoryWithMarkerG55','ChatReadMarkerG55',
  'ChatMarkVisibleRequestG55','ChatMarkVisibleReceiptG55'])
  assert.equal(spec.components.schemas[n].additionalProperties,false);
 for(const f of ['seq','throughSeq','senderId','actorId','sessionId'])
  assert.equal(spec.components.schemas.ChatMarkVisibleRequestG55.properties[f],undefined);
});
test('G55 requires real G52 page, G54 session ticket and scoped PG16 delegated role, no SDK privilege',()=>{
 assert.match(sql,/current_database\(\)<>'qore_disposable_chain'/);
 assert.match(sql,/mobility_stage_g49_history_qa/);
 assert.match(sql,/mobility_stage_g54_consume_qa/);
 assert.match(sql,/mobility_stage_g51_mark_read_owner_qa/);
 assert.match(sql,/senderRole'='driver'/);
 assert.match(sql,/message_seq bigint NOT NULL/);
 assert.match(sql,/history_revision bigint NOT NULL/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/mobility_stage_g55_read_markers ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/FROM PUBLIC,anon,authenticated,service_role/);
 assert.match(sql,/TO mobility_g49_chat_gateway_ci/);
 assert.match(assertions,/SET LOCAL ROLE mobility_g49_chat_gateway_ci/);
 assert.match(assertions,/G55 marker alone confirmed read/);
 assert.match(assertions,/G55 revoked session marked read/);
 assert.match(assertions,/ROLLBACK;/);
 assert.match(ci,/G55_SERVER_ISSUED_READ_MARKERS_POSTGRES_CI_ONLY.sql/);
 assert.match(ci,/G55_SERVER_ISSUED_READ_MARKERS_ASSERT_POSTGRES_CI_ONLY.sql/);
});
