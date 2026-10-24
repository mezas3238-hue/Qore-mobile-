import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL(
 '../docs/backend/staging_only/G10_PRIVATE_DELIVERY_OFFERS_POSTGRES_CI_ONLY.sql',
 import.meta.url),'utf8');
function fn(name){const start=sql.indexOf('CREATE FUNCTION public.'+name+'(');
 assert.notEqual(start,-1);const end=sql.indexOf('$body$;',start);assert.notEqual(end,-1);
 return sql.slice(start,end);}
test('G10 is disposable-only and keeps offer/outbox rows private',()=>{
 assert.match(sql,/POSTGRESQL 16 DISPOSABLE CI ONLY/);
 assert.match(sql,/mobility_stage_delivery_offers ENABLE ROW LEVEL SECURITY/);
 assert.doesNotMatch(sql,/GRANT SELECT[^;]*authenticated/);
 assert.doesNotMatch(sql,/GRANT (UPDATE|DELETE)[^;]*delivery_offer_outbox/);
});
test('offer creation rechecks persisted delivery, courier clearance and bounded fanout',()=>{
 const body=fn('mobility_stage_delivery_offer');
 assert.match(body,/WHERE id=_delivery_id FOR UPDATE/);
 assert.match(body,/mobility_stage_delivery_courier_preflight/);
 assert.match(body,/count\(\*\).*mobility_stage_delivery_offers/s);
 assert.match(body,/>=5/);
 assert.match(body,/mobility_stage_delivery_offer_outbox/);
});
test('acceptance locks shared delivery first, rechecks eligibility and withdraws losers',()=>{
 const body=fn('mobility_stage_delivery_accept_offer');
 const deliveryLock=body.indexOf('mobility_stage_deliveries');
 const offerLock=body.lastIndexOf('mobility_stage_delivery_offers',body.indexOf('FOR UPDATE',deliveryLock)+120);
 assert.ok(deliveryLock>=0&&offerLock>deliveryLock);
 assert.match(body,/mobility_stage_delivery_courier_preflight/);
 assert.match(body,/status='withdrawn'/);
 assert.match(body,/status='accepted',decision_key=_decision_key,decision_event_id=event_id/);
});
test('G10 removes the service-role direct delivery-ID acceptance shortcut',()=>{
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.mobility_stage_delivery_accept/);
 assert.match(sql,/FROM service_role/);
});
