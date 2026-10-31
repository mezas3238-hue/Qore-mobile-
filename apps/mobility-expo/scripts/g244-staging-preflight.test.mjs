import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/staging_sql/g244_driver_eligibility_preflight.sql',import.meta.url),'utf8');
test('G244 only deploys on matching, non-duplicated staging prerequisites',()=>{
 assert(sql.includes("to_regclass('public.mobility_location_consents') IS NOT NULL"));
 assert(sql.includes("to_regclass('public.mobility_vehicle_compliance') IS NULL"));
 assert(sql.includes("to_regclass('public.mobility_driver_compliance') IS NULL"));
 assert(sql.includes("RAISE EXCEPTION 'G244"));
 assert(sql.includes("BEGIN;") && sql.includes("COMMIT;"));
});
test('G244 eligibility requires verified licensing, municipality, insurance and consent',()=>{
 for(const condition of [
  'CREATE TABLE public.mobility_location_consents',
  'ALTER TABLE public.mobility_location_consents ENABLE ROW LEVEL SECURITY',
  "license_valid_through>=CURRENT_DATE",
  "insurance_valid_through>=CURRENT_DATE",
  "municipal_authorization_valid_through>=CURRENT_DATE",
  "paid_passenger_insurance_covered=true",
  "loc.updated_at >= now()-interval '120 seconds'",
  "lc.revoked_at IS NULL",
  "loc.available=true",
  "AND dr.role='driver'::public.app_role",
  "v_reviewer.role='admin'::public.app_role"
 ])assert(sql.includes(condition),condition);
 assert(sql.includes("(false AND v.vehicle_kind='MOTO'"),'MOTO passengers stay blocked');
});
test('G244 is only callable by backend service_role, no public write grants or SECURITY DEFINER',()=>{
 assert(sql.includes("LANGUAGE sql STABLE SECURITY INVOKER"));
 assert(sql.includes("FROM PUBLIC,anon,authenticated"));
 assert(sql.includes("TO service_role"));
 assert(!sql.includes("SECURITY DEFINER"));
 assert(!sql.includes("TO anon;"));
 assert(!sql.includes("TO authenticated;"));
 assert(!sql.includes("CI_ONLY"));
});
