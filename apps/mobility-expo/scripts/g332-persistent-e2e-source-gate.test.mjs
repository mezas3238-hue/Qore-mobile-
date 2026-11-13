import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {checkG332CiOnlySources} from './g332-persistent-e2e-source-gate.mjs';
const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const load=p=>readFileSync(resolve(root,p),'utf8');
const listMigrations=()=>readdirSync(resolve(root,'infra/qore-staging/migrations'));
test('G332 all missing persistent E2E objects have CI-only provenance; never certify external runs',()=>{
 const r=checkG332CiOnlySources();
 assert.equal(r.code,'PASS_CI_ONLY_SOURCES_ISOLATED',r.issues.join(', '));
 assert.equal(r.safeToApplyCiFixtures,false);
 assert.equal(r.safeToCertifyExternalE2E,false);
 assert.equal(r.missingObjects,17);
 assert.deepEqual(r.countByArea,{ADMIN:5,AUTO:2,COMMERCE:1,DELIVERY:1,DRIVER:3,JOURNEY:2,MOTO:3});
});
test('G332 refuses corrupted fixtures without disposable DB guard',()=>{
 const r=checkG332CiOnlySources({listMigrations,load:p=>
  p.includes('G72_F1_AUTO_PREQUOTE_BOOKING_POSTGRES_CI_ONLY.sql')
   ?'CREATE TABLE public.mobility_stage_g72_auto_prequotes(id uuid);'
   :load(p)});
 assert.equal(r.code,'FAIL_CI_ONLY_DEPENDENCY_PROVENANCE');
 assert(r.issues.includes('UNGUARDED_CI_SQL:mobility_stage_g72_auto_prequotes'));
});
test('G332 rejects promotion of synthetic G100 table into official PG17 migrations',()=>{
 const pretend='g999_accidental_copy.sql';
 const r=checkG332CiOnlySources({
  listMigrations:()=>[...listMigrations(),pretend],
  load:p=>p.endsWith('/'+pretend)
   ?'CREATE TABLE public.mobility_stage_g100_moto_trips (id uuid);'
   :load(p)
 });
 assert.equal(r.code,'FAIL_CI_ONLY_DEPENDENCY_PROVENANCE');
 assert(r.issues.includes('UNREVIEWED_PG16_PROMOTION:'+pretend+':mobility_stage_g100_moto_trips'));
});

test('G333 catches quoted names, quoted schema, non-public schema and newlines',()=>{
 const cases=[
  'CREATE TABLE "public"."mobility_stage_g100_moto_trips" (id uuid);',
  'CREATE TABLE IF NOT EXISTS public . "mobility_stage_g100_moto_trips" (id uuid);',
  'CREATE UNLOGGED TABLE staging.mobility_stage_g100_moto_trips (id uuid);',
  'CREATE TABLE "mobility_stage_g100_moto_trips" (id uuid);',
  'CREATE OR REPLACE FUNCTION "public"."mobility_stage_g75_admin_f1_receipt"(id uuid) RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;',
  'CREATE FUNCTION private_schema . "mobility_stage_g75_admin_f1_receipt"(id uuid) RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;'
 ];
 for(let i=0;i<cases.length;i++){
  const pretend='g999_quoted_'+i+'.sql';
  const r=checkG332CiOnlySources({
   listMigrations:()=>[...listMigrations(),pretend],
   load:p=>p.endsWith('/'+pretend)?cases[i]:load(p)
  });
  const name=i<4?'mobility_stage_g100_moto_trips':'mobility_stage_g75_admin_f1_receipt';
  assert.ok(r.issues.includes('UNREVIEWED_PG16_PROMOTION:'+pretend+':'+name),
   cases[i]+' :: '+r.issues.join(','));
  assert.equal(r.safeToCertifyExternalE2E,false);
 }
});
test('G333 ignores DDL text in comments but refuses copied CI_ONLY fixtures',()=>{
 const pretend='g999_safety_comments.sql';
 const comments='-- CREATE TABLE public.mobility_stage_g100_moto_trips (id uuid);\n'+
  '/* CREATE FUNCTION public.mobility_stage_g75_admin_f1_receipt() RETURNS void */\nSELECT 1;';
 const clean=checkG332CiOnlySources({
  listMigrations:()=>[...listMigrations(),pretend],
  load:p=>p.endsWith('/'+pretend)?comments:load(p)
 });
 assert.equal(clean.code,'PASS_CI_ONLY_SOURCES_ISOLATED',clean.issues.join(','));
 const copied=checkG332CiOnlySources({
  listMigrations:()=>[...listMigrations(),pretend],
  load:p=>p.endsWith('/'+pretend)
   ?'-- POSTGRES_CI_ONLY\n-- qore_disposable_chain\nSELECT 1;'
   :load(p)
 });
 assert.ok(copied.issues.includes('COPIED_CI_ONLY_FIXTURE:'+pretend));
});
