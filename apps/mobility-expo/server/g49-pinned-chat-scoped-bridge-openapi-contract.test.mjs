import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(new URL(x,import.meta.url),'utf8');
const openapi=JSON.parse(read('../docs/backend/openapi/movete-facil-staging.openapi.json'));
const sql=read('../docs/backend/staging_only/G49_SCOPED_CHAT_AUTH_BRIDGE_POSTGRES_CI_ONLY.sql');
const checks=read('../docs/backend/staging_only/G49_SCOPED_CHAT_AUTH_BRIDGE_ASSERT_POSTGRES_CI_ONLY.sql');
const ci=read('../../../.github/workflows/mobility-g4-postgres-disposable.yml');
test('G49 JWT-bound chat broker is internal and does NOT enable production or mount HTTP',()=>{
 assert.equal(openapi['x-qore-live-enabled'],false);
 assert.equal(openapi['x-qore-g49-provider-chat-bridge-runtime-wired'],false);
 assert.equal(openapi['x-qore-g49-scoped-chat-role'],'mobility_g49_chat_gateway_ci');
 assert.equal(openapi['x-qore-g49-qa-issuer-and-grants-synthetic-only'],true);
 for(const op of [
  openapi.paths['/v1/staging/chat/services/{serviceKind}/{serviceId}/messages']?.get,
  openapi.paths['/v1/staging/chat/services/{serviceKind}/{serviceId}/conversations/{conversationId}/messages']?.post,
  openapi.paths['/v1/staging/chat/conversations']?.get
 ]){
  assert.ok(op);assert.equal(op['x-qore-runtime-wired'],false);
 }
});
test('G49 NOLOGIN no raw tables, no public/SDK mint, wrapper-only role and disposable gate',()=>{
 assert.match(sql,/current_database\(\)<>'qore_disposable_chain'/);
 assert.match(sql,/CREATE ROLE mobility_g49_chat_gateway_ci NOLOGIN NOINHERIT/);
 assert.match(sql,/CREATE TABLE public\.mobility_stage_g49_chat_tickets/);
 assert.match(sql,/ticket_hash bytea PRIMARY KEY/);
 assert.match(sql,/operation IN\('CHAT_OPEN','CHAT_HISTORY','CHAT_SEND'\)/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/mobility_stage_g42_lock_session/);
 assert.match(sql,/mobility_stage_g50_authorize/);
 assert.match(sql,/mobility_stage_g53_passenger_send_owner_qa/);
 assert.match(sql,/mobility_stage_g52_history_owner_qa/);
 assert.match(sql,/FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci,/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION[\s\S]*TO mobility_g49_chat_gateway_ci/);
 assert.match(checks,/G49 delegate can bypass capability/);
 assert.match(checks,/G49 role no longer authorized|G49 revoked session after mint/);
 assert.match(checks,/ROLLBACK;/);
 assert.match(ci,/G49_SCOPED_CHAT_AUTH_BRIDGE_POSTGRES_CI_ONLY.sql/);
 assert.match(ci,/G49_SCOPED_CHAT_AUTH_BRIDGE_ASSERT_POSTGRES_CI_ONLY.sql/);
});
