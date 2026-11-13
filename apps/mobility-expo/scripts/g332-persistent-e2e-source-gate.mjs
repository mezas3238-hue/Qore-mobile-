/**
 * G332: strict offline provenance gate for missing G261 persistent E2E
 * dependencies. CI-only PG16 schemas are never an install plan for PG17.
 * Runs without GitHub/Supabase/Railway credentials or network access.
 */
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const fixtureDir='apps/mobility-expo/docs/backend/staging_only';
const missing=[
 // G261 live PG17 check reported these 7 tables absent in current staging.
 ['AUTO','table','mobility_stage_g72_auto_prequotes','G72_F1_AUTO_PREQUOTE_BOOKING_POSTGRES_CI_ONLY.sql'],
 ['AUTO','table','mobility_stage_g93_auto_ledger','G93_OWNER_AUTO_SUBSIDY_ATOMIC_LEDGER_POSTGRES_CI_ONLY.sql'],
 ['COMMERCE','table','mobility_stage_g45_order_receipts','G45_BUYER_ORDER_STOCK_FENCE_POSTGRES_CI_ONLY.sql'],
 ['DELIVERY','table','mobility_stage_g122_delivery_price_consents','G122_DELIVERY_VEHICLE_FARE_CONSENT_POSTGRES_CI_ONLY.sql'],
 ['MOTO','table','mobility_stage_g100_moto_entries','G100_MOTO_PASSENGER_QUOTE_BOOK_CANCEL_LEDGER_POSTGRES_CI_ONLY.sql'],
 ['MOTO','table','mobility_stage_g100_moto_quotes','G100_MOTO_PASSENGER_QUOTE_BOOK_CANCEL_LEDGER_POSTGRES_CI_ONLY.sql'],
 ['MOTO','table','mobility_stage_g100_moto_trips','G100_MOTO_PASSENGER_QUOTE_BOOK_CANCEL_LEDGER_POSTGRES_CI_ONLY.sql'],
 // G261 live PG17 check reported these 10 functions absent.
 ['ADMIN','function','mobility_stage_g138_auto_trace_qa','G138_ORIGINAL_AUTO_ADMIN_TRACE_POSTGRES_CI_ONLY.sql'],
 ['ADMIN','function','mobility_stage_g142_moto_trace_qa','G142_ORIGINAL_MOTO_ADMIN_TRACE_POSTGRES_CI_ONLY.sql'],
 ['ADMIN','function','mobility_stage_g145_delivery_trace_qa','G145_ORIGINAL_DELIVERY_ADMIN_TRACE_POSTGRES_CI_ONLY.sql'],
 ['ADMIN','function','mobility_stage_g146_commerce_trace_qa','G146_ORIGINAL_COMMERCE_ADMIN_TRACE_POSTGRES_CI_ONLY.sql'],
 ['ADMIN','function','mobility_stage_g75_admin_f1_receipt','G75_F1_ADMIN_RIDE_VERIFICATION_POSTGRES_CI_ONLY.sql'],
 ['DRIVER','function','mobility_stage_g169_driver_moto_status_qa','G169_DRIVER_MOTO_OWNER_READ_POSTGRES_CI_ONLY.sql'],
 ['DRIVER','function','mobility_stage_g189_driver_moto_current_qa','G189_DRIVER_MOTO_CURRENT_BOOKING_POSTGRES_CI_ONLY.sql'],
 ['DRIVER','function','mobility_stage_g213_moto_driver_step_qa','G213_MOTO_DRIVER_G42_TRANSACTION_FENCE_POSTGRES_CI_ONLY.sql'],
 ['JOURNEY','function','mobility_stage_g198_open_case_qa','G198_POST_RIDE_LOST_ITEMS_CHAT_POSTGRES_CI_ONLY.sql'],
 ['JOURNEY','function','mobility_stage_g200_open_case_qa','G200_POST_MOTO_LOST_ITEMS_CHAT_POSTGRES_CI_ONLY.sql']
];
// G334: Exact, reviewed PG17 source from G333 #152. This is NOT a filename
// exception. Any byte change invalidates the review and fails closed; the blob
// identity is the Git SHA-1 blob content ID, not a caller-controlled label.
// Do not extend this allowlist to synthetic G72/G93 or any other CI-only object.
const nativeG75File='g333_private_admin_auto_f1_receipt_pg17_DRAFT.sql';
const nativeG75Blob='a9e058ea78e39001cfbf570af0905f7458bd90ea';
const blobSha=sql=>createHash('sha1')
 .update('blob '+Buffer.byteLength(sql,'utf8'))
 .update(Buffer.from([0]))
 .update(sql,'utf8').digest('hex');
const read=p=>readFileSync(resolve(root,p),'utf8');
export function checkG332CiOnlySources({
 load=read, listMigrations=()=>readdirSync(resolve(root,'infra/qore-staging/migrations'))
}={}){
 const issues=[];
 const g261=load('infra/qore-staging/g261_five_journeys_persistent_pg17_readiness_readonly.sql');
 const names=new Set(),stats=new Map();
 for(const [area,kind,name,fixture] of missing){
  if(names.has(name))issues.push('DUPLICATE_ENTRY:'+name);
  names.add(name);stats.set(area,(stats.get(area)??0)+1);
  if(!g261.includes("'"+name+"'"))issues.push('NOT_IN_CANONICAL_G261:'+name);
  if(!fixture.endsWith('_CI_ONLY.sql'))issues.push('NOT_CI_ONLY:'+name);
  let source;
  try{source=load(fixtureDir+'/'+fixture);}
  catch{issues.push('MISSING_FIXTURE:'+name);continue;}
  if(!source.includes('qore_disposable_chain')||
   !source.includes('current_database()')||
   !source.includes('application_name'))
   issues.push('UNGUARDED_CI_SQL:'+name);
  if(!source.includes(name))
   issues.push('FIXTURE_MISMATCH:'+name);
 }
 for(const f of listMigrations().filter(x=>x.endsWith('.sql'))){
  const sql=load('infra/qore-staging/migrations/'+f);
  const reviewedNativeG75=f===nativeG75File&&blobSha(sql)===nativeG75Blob;
  // G333: CI-only fixture guard and CREATE might be pasted into a persistent
  // migration with quoted SQL identifiers or a non-public schema. Reject ALL.
  if(/qore_disposable_chain/i.test(sql)&&
   /(?:POSTGRES_)?CI_ONLY/i.test(sql))
   issues.push('COPIED_CI_ONLY_FIXTURE:'+f);
  // Comments are not executable DDL; strip those to avoid false alarms.
  // Do NOT strip quoted SQL function bodies: dynamic CREATE also needs review.
  const statements=sql.replace(/\/\*[\s\S]*?\*\/|--[^\r\n]*/g,' ');
  const ident='(?:"(?:[^"]|"")*"|[a-z_][a-z0-9_$]*)';
  for(const [_,kind,name] of missing){
   // Quoted public."name", "public"."name", and other_schema.name are
   // PostgreSQL identifiers too. One optional schema with whitespace around
   // dot is accepted; IF NOT EXISTS and CREATE OR REPLACE are supported.
   const target='(?:"'+name+'"|'+name+')';
   const definition='\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?'+
    '(?:(?:TEMP|TEMPORARY|UNLOGGED)\\s+)?'+
    (kind==='table'?'TABLE':'FUNCTION')+
    '\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?'+
    '(?:'+ident+'\\s*\\.\\s*)?'+target+
    '(?=\\s|\\(|;|$)';
   if(new RegExp(definition,'i').test(statements)&&
      !(reviewedNativeG75&&kind==='function'&&
        name==='mobility_stage_g75_admin_f1_receipt'))
    issues.push('UNREVIEWED_PG16_PROMOTION:'+f+':'+name);
  }
 }
 if(missing.length!==17||[...names].length!==17)
  issues.push('INCORRECT_G261_CATALOG');
 return Object.freeze({
  code:issues.length?'FAIL_CI_ONLY_DEPENDENCY_PROVENANCE':'PASS_CI_ONLY_SOURCES_ISOLATED',
  safeToApplyCiFixtures:false,
  safeToCertifyExternalE2E:false,
  missingObjects:missing.length,
  countByArea:Object.fromEntries([...stats].sort(([a],[b])=>a.localeCompare(b))),
  issues:Object.freeze(issues)
 });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const r=checkG332CiOnlySources();
 process.stdout.write(JSON.stringify(r)+'\n');
 if(r.issues.length)process.exitCode=1;
}
