import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const spec=JSON.parse(read('../docs/backend/openapi/movete-facil-staging.openapi.json'));
const sql=read('../docs/backend/staging_only/G53_PASSENGER_CHAT_SEND_POSTGRES_CI_ONLY.sql');
const assertion=read('../docs/backend/staging_only/G53_PASSENGER_CHAT_SEND_ASSERT_POSTGRES_CI_ONLY.sql');
const workflow=read('../../../.github/workflows/mobility-g4-postgres-disposable.yml');
test('G53 HTTP is NOT mounted; Cliente B ACK and request schemas are exactly sealed',()=>{
 assert.ok(Number(spec.info.version.split('-g')[1])>=53);
 assert.equal(spec['x-qore-g53-passenger-chat-send-runtime-wired'],false);
 assert.equal(spec['x-qore-live-enabled'],false);
 const op=spec.paths['/v1/staging/chat/services/{serviceKind}/{serviceId}/conversations/{conversationId}/messages']?.post;
 assert.ok(op);
 assert.equal(op['x-qore-runtime-wired'],false);
 assert.equal(op['x-qore-qa-only'],true);
 assert.equal(op.responses['200'].content['application/json'].schema.$ref,
  '#/components/schemas/ChatPassengerStoredAckG53');
 for(const n of ['400','401','403','409','429','503','default'])
  assert.equal(op.responses[n].$ref,'#/components/responses/Error');
 const req=spec.components.schemas.ChatPassengerSendRequestG53;
 const ack=spec.components.schemas.ChatPassengerStoredAckG53;
 assert.equal(req.additionalProperties,false);
 assert.equal(ack.additionalProperties,false);
 assert.deepEqual(req.required,['requestKey','body']);
 assert.deepEqual(ack.required,['conversationId','serviceId','requestKey',
  'messageId','senderRole','body','createdAt','revision','serverStored']);
 assert.equal(ack.properties.senderRole.const,'passenger');
 assert.equal(ack.properties.serverStored.const,true);
 for(const forbidden of ['actorId','role','senderRole','subject',
  'sessionId','phone','email','storageUrl','jwt','actor'])
  assert.equal(req.properties[forbidden],undefined);
});
test('G53 SQL DB confirms persisted message ID and immutable G52 revision, no service privilege',()=>{
 assert.match(sql,/current_database\(\)<>'qore_disposable_chain'/);
 assert.match(sql,/mobility_stage_g50_authorize/);
 assert.match(sql,/mobility_stage_g50_send_owner_qa/);
 assert.match(sql,/mobility_stage_g52_message_versions/);
 assert.match(sql,/persisted\.message_revision/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
 assert.match(sql,/FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci/);
 assert.match(assertion,/G53 replay changed original durable ACK/);
 assert.match(assertion,/G53 revoked session replayed durable ACK/);
 assert.match(assertion,/ROLLBACK;/);
 assert.match(workflow,/G53_PASSENGER_CHAT_SEND_POSTGRES_CI_ONLY.sql/);
 assert.match(workflow,/G53_PASSENGER_CHAT_SEND_ASSERT_POSTGRES_CI_ONLY.sql/);
});
