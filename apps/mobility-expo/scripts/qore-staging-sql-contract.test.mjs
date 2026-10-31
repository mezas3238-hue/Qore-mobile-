import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/staging_sql/qore_staging_identity_baseline.sql',import.meta.url),'utf8');
test('G232 only installs identity baseline on an empty isolated STAGING target',()=>{
 assert.match(sql,/EXISTS \(SELECT 1 FROM pg_catalog\.pg_tables WHERE schemaname = 'public'\)/);
 assert.match(sql,/EXISTS \(SELECT 1 FROM auth\.users\)/);
 assert.match(sql,/CREATE TABLE public\.profiles/);
 assert.match(sql,/CREATE TABLE public\.user_roles/);
 assert.match(sql,/CREATE TABLE public\.driver_locations/);
 assert.match(sql,/CREATE TYPE public\.app_role AS ENUM \('admin','driver','passenger'\)/);
 assert.doesNotMatch(sql,/CREATE TRIGGER|CREATE FUNCTION|SECURITY DEFINER/i);
 assert.doesNotMatch(sql,/\bINSERT INTO\b|\bCOPY\b|\bDROP\b|\bTRUNCATE\b/i);
});
test('G232 row security and scoped owner-only Auth views; no client writes or GPS',()=>{
 for(const table of ['profiles','user_roles','driver_locations'])
  assert.match(sql,new RegExp('ALTER TABLE public\\.'+table+' ENABLE ROW LEVEL SECURITY'));
 assert.match(sql,/REVOKE ALL ON public\.profiles, public\.user_roles, public\.driver_locations/);
 assert.match(sql,/GRANT SELECT ON public\.profiles, public\.user_roles TO authenticated/);
 assert.match(sql,/FOR SELECT TO authenticated/);
 assert.match(sql,/id = \(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/user_id = \(SELECT auth\.uid\(\)\)/);
 assert.doesNotMatch(sql,/CREATE POLICY[^;]*driver_locations/i);
 assert.doesNotMatch(sql,/GRANT .*\b(INSERT|UPDATE|DELETE)\b.* TO authenticated/i);
 assert.doesNotMatch(sql,/\bCI_ONLY\b/);
});
