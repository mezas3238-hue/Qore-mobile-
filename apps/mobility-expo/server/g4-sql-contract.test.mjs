import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../docs/backend/staging_only/G4_PRIVATE_AUTO_OFFERS_POSTGRES_CI_ONLY.sql',import.meta.url),'utf8');
function fn(name){
 const start=sql.indexOf('CREATE FUNCTION public.'+name+'(');
 assert.notEqual(start,-1,'Missing SQL function '+name);
 const end=sql.indexOf('$body$;',start);
 assert.notEqual(end,-1,'Unclosed SQL function '+name);
 return sql.slice(start,end);
}
test('G4 acceptance locks trip before offer to serialize competing drivers',()=>{
 const body=fn('mobility_stage_auto_demo_accept_offer');
 const trip=body.indexOf('WHERE id=offered.trip_id FOR UPDATE');
 const offer=body.indexOf('WHERE id=_offer_id FOR UPDATE');
 assert.ok(trip>=0&&offer>trip,'Trip must be locked first');
 assert.match(body,/trip\.status<>'searching'/);
 assert.match(body,/WHERE id=trip\.id AND status='searching'/);
 assert.match(body,/SET status='withdrawn'/);
});
test('G4 acceptance checks offer ownership, expiry and idempotency',()=>{
 const body=fn('mobility_stage_auto_demo_accept_offer');
 assert.match(body,/offered\.driver_id<>_driver_id/);
 assert.match(body,/offered\.expires_at<=statement_timestamp\(\)/);
 assert.match(body,/offered\.decision_key<>_decision_key/);
 assert.match(body,/offered\.decision_key=_decision_key/);
 assert.match(body,/mobility_vehicle_preflight/);
});
test('G4 SQL remains isolated from client privileges',()=>{
 assert.match(sql,/POSTGRES 16 DISPOSABLE CI ONLY/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.mobility_stage_auto_demo_accept_offer/);
 assert.match(sql,/FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/TO service_role/);
});
