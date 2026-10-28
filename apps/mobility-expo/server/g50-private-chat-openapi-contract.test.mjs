import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const here=new URL('../docs/backend/',import.meta.url);
const spec=JSON.parse(readFileSync(new URL('openapi/movete-facil-staging.openapi.json',here)));
const sql=readFileSync(new URL('staging_only/G50_PRIVATE_SERVICE_CHAT_POSTGRES_CI_ONLY.sql',here),'utf8');
const assertSql=readFileSync(new URL('staging_only/G50_PRIVATE_SERVICE_CHAT_ASSERT_POSTGRES_CI_ONLY.sql',here),'utf8');
const workflow=readFileSync(new URL('../../../.github/workflows/mobility-g4-postgres-disposable.yml',import.meta.url),'utf8');
test('G50 contract is private, sealed, DTO-bound and never claims mounted live service',()=>{
 assert.ok(Number(spec.info.version.split('-g')[1])>=50);
 assert.equal(spec['x-qore-live-enabled'],false);
 assert.equal(spec['x-qore-g50-chat-runtime-wired'],false);
 for(const [route,methods] of [
  ['/v1/staging/chat/services/{serviceKind}/{serviceId}/conversation',['post']],
  ['/v1/staging/chat/conversations/{conversationId}/messages',['get','post']]
 ]){
  for(const method of methods){
   const op=spec.paths[route]?.[method];
   assert.ok(op,route+' '+method);
   assert.equal(op['x-qore-runtime-wired'],false);
   assert.equal(op['x-qore-qa-only'],true);
   assert.equal(op.responses.default.$ref,'#/components/responses/Error');
   for(const status of ['401','403','409','429','503'])
    assert.equal(op.responses[status].$ref,'#/components/responses/Error');
  }
 }
 for(const name of ['ChatOpenG50','ChatSendRequestG50','ChatMessageG50','ChatPageG50','ChatSentG50'])
  assert.equal(spec.components.schemas[name].additionalProperties,false);
 const request=spec.components.schemas.ChatSendRequestG50;
 assert.deepEqual(request.required,['requestKey','body']);
 assert.equal(request.properties.body.maxLength,500);
 const forbidden=['actorId','role','senderId','driverId','passengerId',
  'phone','email','amountPyg','storageUrl','jwt','sessionId'];
 for(const field of forbidden)assert.equal(request.properties[field],undefined);
 assert.equal(spec.components.schemas.ChatPageG50.properties.messages.maxItems,100);
});
test('G50 SQL revokes public/sdks, locks session and assignment at each operation',()=>{
 assert.match(sql,/G42_lock_session|g42_lock_session/);
 assert.match(sql,/FOR SHARE/);
 assert.match(sql,/REVOKE ALL ON public\.mobility_stage_g50_chat_threads/);
 assert.match(sql,/FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci/);
 assert.match(sql,/UNIQUE\(conversation_id,sender_id,request_key\)/);
 assert.match(sql,/CREATE UNIQUE INDEX mobility_stage_g50_one_active_thread/);
 assert.match(sql,/ON CONFLICT\(conversation_id,sender_id,request_key\) DO NOTHING/);
 assert.match(sql,/MERCHANT_ORDER/);
 assert.match(sql,/G5009/);
 assert.match(assertSql,/ROLLBACK;/);
 assert.match(assertSql,/stale conversation readable/);
 assert.match(workflow,/G50_PRIVATE_SERVICE_CHAT_POSTGRES_CI_ONLY.sql/);
 assert.match(workflow,/G50_PRIVATE_SERVICE_CHAT_ASSERT_POSTGRES_CI_ONLY.sql/);
});
