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
