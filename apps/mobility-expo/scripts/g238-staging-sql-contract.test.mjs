import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const files=['g238_verified_driver_preflight.sql','g239_private_auto_original_identity.sql','g240_private_auto_offer_fence.sql'];
const sql=files.map(x=>readFileSync(new URL('../supabase/staging_sql/'+x,import.meta.url),'utf8'));
test('G238 stage-only preflight requires genuine compliance and revocable GPS consent',()=>{
 const s=sql[0];
 for(const term of ['CREATE TABLE public.mobility_location_consents','mobility_driver_compliance','mobility_vehicle_compliance','mobility_location_consents','license_valid_through','municipal_authorization_valid_through','paid_passenger_insurance_covered=true','loc.updated_at >= now()-interval \'120 seconds\'','lc.revoked_at IS NULL'])
  assert(s.includes(term),term);
 assert(s.includes("OR (false AND v.vehicle_kind='MOTO'"),'passenger MOTO remains blocked');
 assert.match(s,/REVOKE ALL ON FUNCTION public\.mobility_vehicle_preflight[\s\S]*FROM PUBLIC,anon,authenticated/);
 assert.match(s,/GRANT EXECUTE ON FUNCTION public\.mobility_vehicle_preflight[\s\S]*TO service_role/);
});
test('G239 original trip IDs cannot bypass driver offers',()=>{
 const s=sql[1];
 for(const table of ['mobility_stage_auto_demo_trips','mobility_stage_auto_demo_events'])
  assert(s.includes('CREATE TABLE public.'+table));
 assert(s.includes('UNIQUE(trip_id,trip_revision)'));
 assert(s.includes('WHERE status IN (\'searching\',\'accepted\',\'arriving\',\'in_progress\')'));
 assert.match(s,/REVOKE EXECUTE ON FUNCTION public\.mobility_stage_auto_demo_accept\([\s\S]*FROM service_role/);
 assert.match(s,/CREATE POLICY mobility_stage_trip_own_read[\s\S]*passenger_id=auth\.uid\(\) OR driver_id=auth\.uid\(\)/);
});
test('G240 one-winner locked trip offers, strict server-only RPC and no clients',()=>{
 const s=sql[2];
 for(const table of ['mobility_stage_auto_demo_offers','mobility_stage_auto_demo_push_outbox'])
  assert(s.includes('CREATE TABLE public.'+table));
 assert(s.includes('FOR UPDATE') && s.includes('decision_key') && s.includes('expires_at<=statement_timestamp()'));
 assert.match(s,/REVOKE ALL ON FUNCTION public\.mobility_stage_auto_demo_accept_offer\([\s\S]*FROM PUBLIC,anon,authenticated/);
 assert.match(s,/GRANT EXECUTE ON FUNCTION public\.mobility_stage_auto_demo_accept_offer\([\s\S]*TO service_role/);
});
test('all three migrations are isolated and revocation-first, no fake privileges',()=>{
 for(const s of sql){
  assert.match(s,/BEGIN;/);
  assert.match(s,/COMMIT;/);
  assert.match(s,/RAISE EXCEPTION 'G2(38|39|40)/);
  assert.doesNotMatch(s,/\bCREATE USER\b|\bCREATE ROLE\b|\bSECURITY DEFINER\b|\bTRUNCATE\b|\bDROP TABLE\b/i);
  assert.doesNotMatch(s,/GRANT\s+(ALL|INSERT|UPDATE|DELETE)[^;]*\bTO (anon|authenticated)\b/i);
 }
});
