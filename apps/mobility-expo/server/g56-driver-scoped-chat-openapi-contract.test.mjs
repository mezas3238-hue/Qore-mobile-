import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const spec=JSON.parse(read('../docs/backend/openapi/movete-facil-staging.openapi.json'));
const chain=read('../../../.github/workflows/mobility-g4-postgres-disposable.yml');
const sql=read('../docs/backend/staging_only/G56_DRIVER_SCOPED_CHAT_POSTGRES_CI_ONLY.sql');
const py=read('./g56-driver-scoped-chat-concurrency-ci.py');
const base='/v1/staging/driver/chat/services/{serviceKind}/{serviceId}';
test('G56 OpenAPI is Driver-only, offline and fail-closed with public error responses',()=>{
 assert.ok(Number(spec.info.version.split('-g')[1])>=56);
 assert.equal(spec['x-qore-g56-driver-chat-runtime-wired'],false);
 const ops=[
  spec.paths[base+'/conversation']?.post,
  spec.paths[base+'/conversations/{conversationId}/messages']?.get,
  spec.paths[base+'/conversations/{conversationId}/messages']?.post
 ];
 for(const o of ops){
  assert.ok(o,'missing Driver route');
  assert.equal(o['x-qore-runtime-wired'],false);
  assert.equal(o['x-qore-qa-only'],true);
  assert.deepEqual(o.security,[{BearerAuth:[]}]);
  for(const status of ['200','400','401','403','409','429','503','default'])
   assert.ok(o.responses[status],status);
  assert.equal(o.parameters[0].name,'serviceKind');
  assert.equal(o.parameters[1].name,'serviceId');
 }
 const [open,history,send]=ops;
 assert.equal(open.responses['200'].content['application/json'].schema.$ref,
  '#/components/schemas/DriverChatOpenG56');
 assert.equal(history.responses['200'].content['application/json'].schema.$ref,
  '#/components/schemas/DriverChatHistoryG56');
 assert.equal(send.responses['200'].content['application/json'].schema.$ref,
  '#/components/schemas/DriverChatStoredAckG56');
 assert.equal(send.requestBody.content['application/json'].schema.$ref,
  '#/components/schemas/DriverChatSendRequestG56');
 assert.ok(history.parameters.some(x=>x.name==='cursor'&&x.schema.maxLength===2048));
 assert.ok(history.parameters.some(x=>x.name==='limit'&&x.schema.maximum===100));
});
test('G56 distinct schemas prevent forged actor, internal seq, fake ACK and B-G52 drift',()=>{
 const s=spec.components.schemas;
 for(const key of ['DriverChatOpenG56','DriverChatSendRequestG56',
  'DriverChatStoredAckG56','DriverChatHistoryG56'])
  assert.equal(s[key].additionalProperties,false,key);
 assert.deepEqual(s.DriverChatSendRequestG56.required,['requestKey','body']);
 assert.equal(s.DriverChatStoredAckG56.properties.senderRole.const,'driver');
 assert.equal(s.DriverChatStoredAckG56.properties.serverStored.const,true);
 assert.equal(s.DriverChatHistoryG56.properties.counterpartRole.const,'passenger');
 assert.equal(s.DriverChatHistoryG56.properties.productionEnabled.const,false);
 assert.equal(s.DriverChatHistoryG56.properties.nextCursor.maxLength,2048);
 for(const forbidden of ['seq','beforeSeq','nextPosition','sessionId','actorId','throughSeq']){
  assert.equal(s.DriverChatHistoryG56.properties[forbidden],undefined);
  assert.equal(s.DriverChatSendRequestG56.properties[forbidden],undefined);
 }
 assert.equal(s.ChatHistoryPageG52.properties.counterpartRole.const,'driver');
 assert.deepEqual(s.ChatHistoryPageG52.required,[
  'conversationId','serviceId','serviceKind','ownerId','counterpartRole',
  'assignmentVerified','state','revision','generatedAt','expiresAt',
  'messages','nextCursor','canSend','productionEnabled'
 ]);
});
test('G56 runs SQL assertion and two-session delegated role test only in disposable DB',()=>{
 assert.match(sql,/qore_disposable_chain/);
 assert.match(sql,/CREATE ROLE mobility_g56_driver_gateway_ci NOLOGIN/);
 assert.match(sql,/mobility_stage_g42_lock_session/);
 assert.match(chain,/G56_DRIVER_SCOPED_CHAT_POSTGRES_CI_ONLY.sql/);
 assert.match(chain,/G56_DRIVER_SCOPED_CHAT_ASSERT_POSTGRES_CI_ONLY.sql/);
 assert.match(chain,/g56-driver-scoped-chat-concurrency-ci.py/);
 assert.match(py,/SET LOCAL ROLE mobility_g56_driver_gateway_ci/);
 assert.match(py,/Barrier\(2\)/);
 assert.match(py,/G5605/);
});
