import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=JSON.parse(readFileSync(new URL('../docs/backend/openapi/movete-facil-staging.openapi.json',import.meta.url)));
const sql=readFileSync(new URL('../docs/backend/staging_only/G51_CHAT_INBOX_MONOTONIC_POSTGRES_CI_ONLY.sql',import.meta.url),'utf8');
const checked=readFileSync(new URL('../docs/backend/staging_only/G51_CHAT_INBOX_MONOTONIC_ASSERT_POSTGRES_CI_ONLY.sql',import.meta.url),'utf8');
const wf=readFileSync(new URL('../../../.github/workflows/mobility-g4-postgres-disposable.yml',import.meta.url),'utf8');
test('G51 matches B R13 inbox row exactly and never mounts endpoints',()=>{
 assert.equal(s.info.version,'1.0.0-g51');
 assert.equal(s['x-qore-live-enabled'],false);
 assert.equal(s['x-qore-g51-chat-inbox-runtime-wired'],false);
 const inbox=s.paths['/v1/staging/chat/conversations'].get;
 const receipt=s.paths['/v1/staging/chat/conversations/{conversationId}/read-receipt'].post;
 for(const operation of [inbox,receipt]){
  assert.equal(operation['x-qore-runtime-wired'],false);
  assert.equal(operation['x-qore-qa-only'],true);
  for(const code of ['400','401','403','409','429','503','default'])
   assert.deepEqual(operation.responses[code],{$ref:'#/components/responses/Error'});
 }
 assert.equal(inbox.responses['200'].content['application/json'].schema.$ref,
  '#/components/schemas/ChatInboxPageG51');
 assert.equal(receipt.responses['200'].content['application/json'].schema.$ref,
  '#/components/schemas/ChatReadReceiptG51');
 for(const name of ['ChatInboxRowG51','ChatInboxPageG51',
  'ChatReadReceiptRequestG51','ChatReadReceiptG51'])
  assert.equal(s.components.schemas[name].additionalProperties,false);
 assert.deepEqual(s.components.schemas.ChatInboxPageG51.required,[
  'ownerId','generatedAt','expiresAt','revision','items','nextCursor','productionEnabled'
 ]);
 assert.equal(s.components.schemas.ChatInboxPageG51.properties.items.maxItems,100);
 assert.deepEqual(s.components.schemas.ChatInboxRowG51.required,[
  'conversationId','serviceId','serviceKind','state','assignmentVerified',
  'counterpartRole','revision','unreadCount','updatedAt','canSend'
 ]);
 for(const forbidden of ['actorId','senderId','role','phone','email','jwt','ticket'])
  assert.equal(s.components.schemas.ChatReadReceiptRequestG51.properties[forbidden],undefined);
});
test('G51 SQL privileges and comprehensive disposable CI source chain',()=>{
 assert.match(sql,/CREATE TABLE public\.mobility_stage_g51_chat_activity/);
 assert.match(sql,/CREATE TABLE public\.mobility_stage_g51_chat_reads/);
 assert.match(sql,/CREATE TRIGGER g51_message_activity/);
 assert.match(sql,/mobility_stage_g42_lock_session/);
 assert.match(sql,/mobility_stage_g50_source/);
 assert.match(sql,/G5109/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
 assert.match(sql,/FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci/);
 assert.match(checked,/generate_series\(1,205\)/);
 assert.match(checked,/page_count<>3/);
 assert.match(checked,/ROLLBACK;/);
 assert.match(wf,/G51_CHAT_INBOX_MONOTONIC_POSTGRES_CI_ONLY.sql/);
 assert.match(wf,/G51_CHAT_INBOX_MONOTONIC_ASSERT_POSTGRES_CI_ONLY.sql/);
});
