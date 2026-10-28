import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const spec=JSON.parse(read('../docs/backend/openapi/movete-facil-staging.openapi.json'));
const sql=read('../docs/backend/staging_only/G56B_DRIVER_SCOPED_INBOX_POSTGRES_CI_ONLY.sql');
const assertions=read('../docs/backend/staging_only/G56B_DRIVER_SCOPED_INBOX_ASSERT_POSTGRES_CI_ONLY.sql');
const ci=read('../../../.github/workflows/mobility-g4-postgres-disposable.yml');
test('G56B no HTTP route mounted: Driver inbox has bearer auth, errors, no total cap',()=>{
 assert.ok(Number(spec.info.version.split('-g')[1])>=56);
 assert.equal(spec['x-qore-g56b-driver-inbox-runtime-wired'],false);
 assert.equal(spec['x-qore-live-enabled'],false);
 const op=spec.paths['/v1/staging/driver/chat/conversations']?.get;
 assert.ok(op);
 assert.equal(op['x-qore-runtime-wired'],false);
 assert.equal(op['x-qore-qa-only'],true);
 assert.deepEqual(op.security,[{BearerAuth:[]}]);
 for(const status of ['200','400','401','403','409','429','503','default'])
  assert.ok(op.responses[status]);
 assert.equal(op.responses['200'].content['application/json'].schema.$ref,
  '#/components/schemas/DriverChatInboxPageG56B');
 assert.equal(op.parameters[0].name,'cursor');
 assert.equal(op.parameters[1].schema.maximum,100);
});
test('G56B closed schemas carry only Driver-scoped metadata; no PII or SQL seq',()=>{
 const p=spec.components.schemas.DriverChatInboxPageG56B;
 const row=spec.components.schemas.DriverChatInboxRowG56B;
 assert.equal(p.additionalProperties,false);
 assert.equal(row.additionalProperties,false);
 assert.deepEqual(p.required,['ownerId','revision','generatedAt','expiresAt','items',
  'nextCursor','productionEnabled','qaOnly']);
 assert.equal(p.properties.items.maxItems,100);
 assert.equal(p.properties.nextCursor.maxLength,2048);
 assert.equal(p.properties.productionEnabled.const,false);
 assert.equal(row.properties.counterpartRole.const,'passenger');
 assert.equal(row.properties.assignmentVerified.const,true);
 assert.equal(row.properties.canSend.const,true);
 assert.equal(row.properties.unreadCount.minimum,0);
 for(const secret of ['seq','beforeMs','nextPosition','email','phone','body',
  'passengerId','sessionId','serviceRoleKey','throughSeq']){
  assert.equal(p.properties[secret],undefined);
  assert.equal(row.properties[secret],undefined);
 }
 assert.equal(spec.components.schemas.ChatHistoryPageG52.properties.counterpartRole.const,'driver');
 assert.equal(spec.components.schemas.DriverChatHistoryG56.properties.counterpartRole.const,'passenger');
});
test('G56B PG16 NOLOGIN Role SQL privilege, triggers and 205-record keyset test are gated',()=>{
 assert.match(sql,/qore_disposable_chain/);
 assert.match(sql,/mobility_g56_driver_gateway_ci/);
 assert.match(sql,/mobility_stage_g42_lock_session/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/FOR SHARE/);
 assert.match(sql,/unread_count/);
 assert.match(sql,/src.driver_id=t.driver_id/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
 assert.match(assertions,/generate_series\(1,205\)/);
 assert.match(assertions,/SET LOCAL ROLE mobility_g56_driver_gateway_ci/);
 assert.match(assertions,/G56B leaked reassigned service/);
 assert.match(assertions,/ROLLBACK;/);
 assert.match(ci,/G56B_DRIVER_SCOPED_INBOX_POSTGRES_CI_ONLY.sql/);
 assert.match(ci,/G56B_DRIVER_SCOPED_INBOX_ASSERT_POSTGRES_CI_ONLY.sql/);
});
