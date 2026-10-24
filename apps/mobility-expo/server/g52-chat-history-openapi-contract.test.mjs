import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const spec=JSON.parse(readFileSync(new URL('../docs/backend/openapi/movete-facil-staging.openapi.json',import.meta.url)));
const sql=readFileSync(new URL('../docs/backend/staging_only/G52_CHAT_HISTORY_KEYSET_POSTGRES_CI_ONLY.sql',import.meta.url),'utf8');
const checks=readFileSync(new URL('../docs/backend/staging_only/G52_CHAT_HISTORY_ASSERT_POSTGRES_CI_ONLY.sql',import.meta.url),'utf8');
const wf=readFileSync(new URL('../../../.github/workflows/mobility-g4-postgres-disposable.yml',import.meta.url),'utf8');
test('G52 aligns with Cliente B message history exactly, no active endpoint',()=>{
 assert.ok(Number(spec.info.version.split('-g')[1])>=52);
 assert.equal(spec['x-qore-g52-chat-history-runtime-wired'],false);
 const op=spec.paths['/v1/staging/chat/services/{serviceKind}/{serviceId}/messages']?.get;
 assert.ok(op);
 assert.equal(op['x-qore-runtime-wired'],false);
 assert.equal(op['x-qore-qa-only'],true);
 assert.equal(op.responses['200'].content['application/json'].schema.$ref,
 '#/components/schemas/ChatHistoryPageG52');
 for(const status of ['400','401','403','409','429','503','default'])
  assert.equal(op.responses[status].$ref,'#/components/responses/Error');
 assert.deepEqual(spec.components.schemas.ChatHistoryPageG52.required,[
 'conversationId','serviceId','serviceKind','ownerId','counterpartRole',
 'assignmentVerified','state','revision','generatedAt','expiresAt','messages',
 'nextCursor','canSend','productionEnabled']);
 assert.deepEqual(spec.components.schemas.ChatHistoryMessageG52.required,
 ['messageId','senderRole','body','createdAt','revision']);
 for(const schema of ['ChatHistoryPageG52','ChatHistoryMessageG52'])
  assert.equal(spec.components.schemas[schema].additionalProperties,false);
 assert.equal(spec.components.schemas.ChatHistoryPageG52.properties.messages.maxItems,100);
 assert.equal(spec.components.schemas.ChatHistoryPageG52.properties.nextCursor.maxLength,384);
 assert.equal(spec.components.schemas.ChatHistoryPageG52.properties.productionEnabled.const,false);
});
test('G52 PostgreSQL owner-only, 205-message history, G42 and CI remain guarded',()=>{
 assert.match(sql,/current_database\(\)<>'qore_disposable_chain'/);
 assert.match(sql,/mobility_stage_g50_authorize/);
 assert.match(sql,/CREATE TABLE public\.mobility_stage_g52_thread_versions/);
 assert.match(sql,/CREATE TRIGGER g52_message_version/);
 assert.match(sql,/FOR SHARE/);
 assert.match(sql,/G5209/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
 assert.match(sql,/FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci/);
 assert.match(checks,/FOR n IN 1\.\.205 LOOP/);
 assert.match(checks,/page_count<>3/);
 assert.match(checks,/ROLLBACK;/);
 assert.match(wf,/G52_CHAT_HISTORY_KEYSET_POSTGRES_CI_ONLY.sql/);
 assert.match(wf,/G52_CHAT_HISTORY_ASSERT_POSTGRES_CI_ONLY.sql/);
});
