/**
 * G221: Persist the five positive ORIGINAL-source QA service chains only in
 * GitHub's disposable PG16 database. G215 can then independently audit the
 * SAME ORIGINAL IDs through its normal SELECTs, rather than reading cancelled
 * rows while G220's good positive paths have been rolled back.
 *
 * This CI harness deliberately uses a QA-only synthetic accepted-offer seed
 * in the three already scientifically validated suites. It never overrides
 * legal dispatch controls in the application or any non-disposable database.
 * Their destructive adversarial tests still run unchanged separately in CI.
 * This QA database is destroyed when GitHub Actions ends.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G221 cannot persist any data outside disposable GitHub PG16');

const dir='apps/mobility-expo/docs/backend/staging_only/';
const sources=[
 ['AUTO_AND_MOTO_RIDES',
 'G220_ORIGINAL_PASSENGER_AUTO_MOTO_COMPLETE_QA_ASSERT_POSTGRES_CI_ONLY.sql',
 null],
 ['DELIVERY_AUTO_AND_MOTO',
 'G216_VERIFIED_COMPLETED_DELIVERY_ADMIN_ASSERT_POSTGRES_CI_ONLY.sql',
 ['  -- Forged/removed confirmation invalidates Admin proof without touching G5.',
  '  count_ok:=count_ok+1;']],
 ['ORIGINAL_COMMERCE_AND_G5',
 'G218_COMMERCE_ORIGINAL_ORDER_LINKED_DELIVERY_RECIPIENT_ADMIN_ASSERT_POSTGRES_CI_ONLY.sql',
 [' -- Even after complete G5 custody, absence of independent receipt FAILS CLOSED.',
  " RAISE NOTICE 'G218 PASS:"]]
];
const execute=(name,sql)=>{
 const run=spawnSync('psql',['-X','-v','ON_ERROR_STOP=1','-f','-'],{
  input:sql,encoding:'utf8',timeout:60000,maxBuffer:3000000
 });
 if(run.error)throw run.error;
 assert.equal(run.status,0,
  'G221 '+name+' SQL failed: '+String(run.stderr).slice(-4500));
 return String(run.stdout)+'\n'+String(run.stderr);
};
const probe=execute('database check',`SELECT
 (current_database()='qore_disposable_chain'
 AND current_setting('application_name')='qore_ci_disposable_chain')::text;`);
assert(/\btrue\b/.test(probe));
for(const [kind,filename,strip] of sources){
 const original=readFileSync(dir+filename,'utf8');
 let sql=original;
 assert(original.includes("current_database()")||
        original.includes('pg_catalog.current_database()'));
 assert(sql.includes('BEGIN;')&&sql.trimEnd().endsWith('ROLLBACK;'),
  'G221 expected a single verified isolated rollback suite: '+filename);
 const n=sql.match(/^ROLLBACK;$/gm)??[];
 assert.equal(n.length,1,'G221 refuses ambiguous transaction endings');
 assert(sql.includes('ALTER TABLE public.mobility_stage_')&&
        sql.includes('ENABLE TRIGGER USER'),
  'G221 requires full trigger restoration after the synthetic accepted fixture');
 if(strip){
  const [startToken,endToken]=strip;
  const start=sql.indexOf(startToken),end=sql.indexOf(endToken,start+startToken.length);
  assert(start>=0&&end>start,'G221 adversarial tamper block moved: '+filename);
  // The negative G216/G218 readback tests already passed earlier in this
  // same CI job without modifications. Preserve their positive G187 receipt
  // here rather than corrupt it before the independent G215 audit.
  sql=sql.slice(0,start)+
   ' -- G221: preserve verified independent recipient ACK for G215 readback.\n'+
   sql.slice(end);
 }
 sql=sql.replace(/ROLLBACK;\s*$/,'COMMIT;');
 assert(sql.trimEnd().endsWith('COMMIT;'),'G221 durable QA requires COMMIT');
 // Rewrite lab-only notice so its old ROLLBACK label is not misleading.
 sql=sql.replace(/rollback-only synthetic acceptance/g,'synthetic accepted QA commit in disposable PG16');
 sql=sql.replace(/in ROLLBACK/g,'in disposable PG16 CI');
 const out=execute(kind,sql);
 assert(/G22[018] PASS|G216 PASS|G218 PASS/.test(out),
  'G221 positive evidence missing for '+kind);
 console.log('G221 source QA durably completed in disposable PG16: '+kind);
}
const manifest=readFileSync(dir+
 'G221_FIVE_PERSISTED_ORIGINAL_QA_SOURCES_POSTGRES_CI_ONLY.sql','utf8');
assert(manifest.includes('external_legal_certified')&&manifest.includes('production_enabled'));
const report=execute('five-source manifest',manifest);
assert(report.includes('exactly five distinct original-source QA records'),
 'G221 source manifest did not independently validate all five');
console.log('G221 committed five QA source chains and immutable IDs in isolated PG16 only. External legal/GPS/PSP certification: 0/5.');
