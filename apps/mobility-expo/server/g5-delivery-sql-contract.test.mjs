import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL(
 '../docs/backend/staging_only/G5_DELIVERY_CUSTODY_POSTGRES_CI_ONLY.sql',
 import.meta.url),'utf8');

function fn(name){
 const start=sql.indexOf('CREATE FUNCTION public.'+name+'(');
 assert.notEqual(start,-1,'Missing SQL function '+name);
 const end=sql.indexOf('$body$;',start);
 assert.notEqual(end,-1,'Unclosed SQL function '+name);
 return sql.slice(start,end);
}

test('G5 stays CI-only, server-write-only and participant-readable',()=>{
 assert.match(sql,/POSTGRESQL 16 DISPOSABLE CI ONLY/);
 assert.match(sql,/ALTER TABLE public\.mobility_stage_deliveries ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/USING\(sender_id=auth\.uid\(\) OR courier_id=auth\.uid\(\)\)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.mobility_stage_delivery_request/);
 assert.match(sql,/FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/GRANT SELECT ON public\.mobility_stage_deliveries TO authenticated/);
 assert.doesNotMatch(sql,/GRANT (INSERT|UPDATE|DELETE).*authenticated/);
});

test('G5 courier preflight enforces cargo clearance, GPS and no active ride',()=>{
 const body=fn('mobility_stage_delivery_courier_preflight');
 assert.match(body,/c\.delivery_authorized=true/);
 assert.match(body,/c\.cargo_insurance_valid_through>=CURRENT_DATE/);
 assert.match(body,/loc\.updated_at>=now\(\)-interval '120 seconds'/);
 assert.match(body,/trip\.status IN \('accepted','arriving','in_progress'\)/);
 assert.match(body,/busy\.status IN \('accepted','picked_up','disputed'\)/);
 assert.match(body,/d\.grams<=c\.max_grams/);
});

test('G5 acceptance locks the delivery and state transition requires proof',()=>{
 const accept=fn('mobility_stage_delivery_accept');
 const transition=fn('mobility_stage_delivery_transition');
 assert.match(accept,/WHERE id=_delivery_id FOR UPDATE/);
 assert.match(accept,/WHERE id=_delivery_id AND status='requested'/);
 assert.match(transition,/WHERE id=_delivery_id FOR UPDATE/);
 assert.match(transition,/AND _proof_ref IS NOT NULL THEN 'delivered'/);
 assert.match(transition,/WHEN _actor_id=d\.sender_id AND _action='dispute'/);
 assert.match(transition,/WHEN _actor_id=d\.courier_id AND _action='return'/);
});

test('G5 permits only explicitly modeled non-controlled categories',()=>{
 assert.match(sql,/\('DOCUMENTS','PARCEL','GROCERIES','PHARMACY_OTC','RESTAURANT'\)/);
 assert.doesNotMatch(sql,/PHARMACY_CONTROLLED|WEAPONS|ALCOHOL/);
 assert.match(sql,/CHECK\(restricted_item_declared=false\)/);
});
