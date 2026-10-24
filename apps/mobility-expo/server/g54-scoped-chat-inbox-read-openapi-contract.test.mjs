import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const spec=JSON.parse(read('../docs/backend/openapi/movete-facil-staging.openapi.json'));
const sql=read('../docs/backend/staging_only/G54_SCOPED_CHAT_INBOX_READ_POSTGRES_CI_ONLY.sql');
const assertions=read('../docs/backend/staging_only/G54_SCOPED_CHAT_INBOX_READ_ASSERT_POSTGRES_CI_ONLY.sql');
const workflow=read('../../../.github/workflows/mobility-g4-postgres-disposable.yml');
test('G54 leaves G51 inbox/read-receipt private HTTP contracts OFF',()=>{
 assert.ok(Number(spec.info.version.split('-g')[1])>=54);
 assert.equal(spec['x-qore-live-enabled'],false);
 assert.equal(spec['x-qore-g54-scoped-inbox-read-runtime-wired'],false);
 for(const op of [
  spec.paths['/v1/staging/chat/conversations']?.get,
  spec.paths['/v1/staging/chat/conversations/{conversationId}/read-receipt']?.post
 ]){
  assert.ok(op);
  assert.equal(op['x-qore-g54-scoped-sql-delegation'],true);
  assert.equal(op['x-qore-runtime-wired'],false);
  assert.equal(op['x-qore-qa-only'],true);
 }
 for(const n of ['ChatReadReceiptG54','ChatReadReceiptRequestG54'])
  assert.equal(spec.components.schemas[n].additionalProperties,false);
 assert.deepEqual(spec.components.schemas.ChatReadReceiptG54.required,
  ['conversationId','readThrough','qaOnly']);
 assert.deepEqual(spec.components.schemas.ChatReadReceiptRequestG54.required,
  ['throughSeq']);
 assert.equal(spec.components.schemas.ChatReadReceiptG54.properties.qaOnly.const,true);
});
test('G54 PG16 gates owner mint, SHA256 one-use tickets and role-executed least-privilege wrappers',()=>{
 assert.match(sql,/current_database\(\)<>'qore_disposable_chain'/);
 assert.match(sql,/CREATE TABLE public\.mobility_stage_g54_chat_receipt_tickets/);
 assert.match(sql,/ticket_hash bytea PRIMARY KEY/);
 assert.match(sql,/operation IN\('CHAT_INBOX','CHAT_READ'\)/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/mobility_stage_g42_lock_session/);
 assert.match(sql,/mobility_stage_g50_authorize/);
 assert.match(sql,/mobility_stage_g51_passenger_inbox_owner_qa/);
 assert.match(sql,/mobility_stage_g51_mark_read_owner_qa/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION[\s\S]*TO mobility_g49_chat_gateway_ci/);
 assert.match(assertions,/SET LOCAL ROLE mobility_g49_chat_gateway_ci/);
 assert.match(assertions,/G54 accepted future watermark/);
 assert.match(assertions,/G54 revoked session used inbox/);
 assert.match(assertions,/ROLLBACK;/);
 assert.match(workflow,/G54_SCOPED_CHAT_INBOX_READ_POSTGRES_CI_ONLY.sql/);
 assert.match(workflow,/G54_SCOPED_CHAT_INBOX_READ_ASSERT_POSTGRES_CI_ONLY.sql/);
});
