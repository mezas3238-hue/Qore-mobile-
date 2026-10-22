import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL(
 '../docs/backend/staging_only/G8_SAFETY_OPERATIONS_POSTGRES_CI_ONLY.sql',
 import.meta.url),'utf8');
function fn(name){
 const start=sql.indexOf('CREATE FUNCTION public.'+name+'(');
 assert.notEqual(start,-1,'Missing SQL function '+name);
 const end=sql.indexOf('$body$;',start);
 assert.notEqual(end,-1,'Unclosed SQL function '+name);
 return sql.slice(start,end);
}
test('G8 stays CI-only, private and append-only',()=>{
 assert.match(sql,/POSTGRESQL 16 DISPOSABLE CI ONLY/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.doesNotMatch(sql,/GRANT (INSERT|UPDATE|DELETE).*authenticated/);
 assert.doesNotMatch(sql,/GRANT (UPDATE|DELETE) ON public\.mobility_stage_safety_incident_events/);
 assert.doesNotMatch(sql,/GRANT (UPDATE|DELETE) ON public\.mobility_stage_suspension_events/);
});
test('G8 derives participant access from durable ride, delivery and order',()=>{
 const body=fn('mobility_stage_safety_report');
 assert.match(body,/_reporter_id IN \(t\.passenger_id,t\.driver_id\)/);
 assert.match(body,/_reporter_id IN \(d\.sender_id,d\.courier_id\)/);
 assert.match(body,/o\.buyer_id=_reporter_id/);
 assert.match(body,/s\.merchant_id=o\.merchant_id/);
 assert.match(body,/SOS requires active mobility service/);
});
test('G8 admin actions recheck persisted admin role and reject free-form reason',()=>{
 for(const name of ['mobility_stage_safety_transition',
  'mobility_stage_suspension_apply','mobility_stage_suspension_lift']){
  const body=fn(name);
  assert.match(body,/role='admin'::public\.app_role/);
  assert.match(body,/\^\[A-Z\]\[A-Z0-9_\]\{2,39\}\$/);
 }
});
test('G8 suspension is enforced below HTTP on all money and service writes',()=>{
 const body=fn('mobility_stage_reject_suspended_operation');
 for(const table of ['mobility_stage_auto_demo_trips','mobility_stage_auto_demo_offers',
  'mobility_stage_deliveries','mobility_stage_merchant_orders',
  'mobility_stage_fare_quotes','mobility_stage_payment_intents'])
  assert.match(body,new RegExp(table));
 assert.match(sql,/BEFORE INSERT OR UPDATE ON public\.mobility_stage_deliveries/);
 assert.match(sql,/BEFORE INSERT ON public\.mobility_stage_payment_intents/);
});
