import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const spec=JSON.parse(read('../docs/backend/openapi/movete-facil-staging.openapi.json'));
const sql=read('../docs/backend/staging_only/G57_ORDERED_VISIBLE_RECEIPTS_POSTGRES_CI_ONLY.sql');
const testSql=read('../docs/backend/staging_only/G57_ORDERED_VISIBLE_RECEIPTS_ASSERT_POSTGRES_CI_ONLY.sql');
const ci=read('../../../.github/workflows/mobility-g4-postgres-disposable.yml');
const race=read('./g57-ordered-visible-concurrency-ci.py');
test('G57 ordered read interface is OFF in HTTP and does not alter the sealed Cliente G52 DTO',()=>{
 assert.ok(Number(spec.info.version.split('-g')[1])>=57);
 assert.equal(spec['x-qore-g57-ordered-visible-runtime-wired'],false);
 assert.equal(spec['x-qore-live-enabled'],false);
 const h=spec.paths['/v1/staging/chat/services/{serviceKind}/{serviceId}/history-with-ordered-markers']?.get;
 const mark=spec.paths['/v1/staging/chat/conversations/{conversationId}/mark-visible-ordered']?.post;
 for(const op of [h,mark]){
  assert.ok(op);
  assert.equal(op['x-qore-runtime-wired'],false);
  assert.equal(op['x-qore-qa-only'],true);
  assert.deepEqual(op.security,[{BearerAuth:[]}]);
  for(const code of ['200','400','401','403','409','429','503','default'])
   assert.ok(op.responses[code],code);
 }
 assert.equal(h.responses['200'].content['application/json'].schema.$ref,
  '#/components/schemas/ChatHistoryWithOrderedMarkersG57');
 assert.equal(mark.responses['200'].content['application/json'].schema.$ref,
  '#/components/schemas/ChatMarkVisibleOrderedReceiptG57');
 assert.equal(mark.requestBody.content['application/json'].schema.$ref,
  '#/components/schemas/ChatMarkVisibleOrderedRequestG57');
 assert.deepEqual(spec.components.schemas.ChatHistoryWithOrderedMarkersG57.properties.page,
  {$ref:'#/components/schemas/ChatHistoryPageG52'});
 assert.equal(spec.components.schemas.ChatHistoryPageG52.properties.counterpartRole.const,'driver');
});
test('G57 receipt rejects arbitrary seq/actor/session; marker array is per incoming message',()=>{
 const defs=spec.components.schemas;
 for(const schema of ['ChatPerMessageReadMarkerG57','ChatHistoryWithOrderedMarkersG57',
  'ChatMarkVisibleOrderedRequestG57','ChatMarkVisibleOrderedReceiptG57'])
  assert.equal(defs[schema].additionalProperties,false,schema);
 assert.deepEqual(defs.ChatMarkVisibleOrderedRequestG57.required,['messageId','marker']);
 assert.deepEqual(defs.ChatMarkVisibleOrderedReceiptG57.required,
  ['conversationId','messageId','readConfirmed','qaOnly']);
 assert.equal(defs.ChatHistoryWithOrderedMarkersG57.properties.readMarkers.maxItems,100);
 assert.equal(defs.ChatPerMessageReadMarkerG57.properties.expiresAtMs.minimum,0);
 for(const key of ['seq','throughSeq','actorId','senderId','sessionId','role','readThrough']){
  assert.equal(defs.ChatMarkVisibleOrderedRequestG57.properties[key],undefined);
  assert.equal(defs.ChatMarkVisibleOrderedReceiptG57.properties[key],undefined);
 }
});
test('G57 privileges ban both old G54 raw-seq and G55 skip bypass, real racing CI required',()=>{
 assert.match(sql,/qore_disposable_chain/);
 assert.match(sql,/QA_G52_AUTHORIZED_PAGE_PER_DRIVER_MESSAGE/);
 assert.match(sql,/mobility_stage_g57_history_markers_qa/);
 assert.match(sql,/mobility_stage_g57_mark_visible_ordered_qa/);
 assert.match(sql,/G5708/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/mobility_stage_g54_mark_read_qa\(uuid,bigint\)/);
 assert.match(sql,/mobility_stage_g55_mark_viewed_qa\(uuid,uuid\)/);
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION/);
 assert.match(testSql,/G57 later visible message skipped unread earlier/);
 assert.match(testSql,/G57 legacy G55 skip bypass still exposed/);
 assert.match(testSql,/mobility_stage_g54_mark_read_qa/);
 assert.match(ci,/G57_ORDERED_VISIBLE_RECEIPTS_ASSERT_POSTGRES_CI_ONLY.sql/);
 assert.match(ci,/g57-ordered-visible-concurrency-ci.py/);
 assert.match(race,/SET LOCAL ROLE mobility_g49_chat_gateway_ci/);
 assert.match(race,/Barrier\(2\)/);
 assert.match(race,/G5708/);
 assert.match(race,/G5401/);
});
