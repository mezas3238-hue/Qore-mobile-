/**
 * G220: five independently original, ROLLBACK-ISOLATED QA journeys within
 * ONE complete disposable PG16 GitHub Actions schema chain.
 *
 * Distinct verdicts: 5/5 scenario functionality != G215 original-source
 * persistence across a rollback != 0/5 legal/IdP/GPS/PSP certification.
 * A pass requires reexecuting every genuine SQL state transition, SQL
 * privilege check and independent Admin projection; NO echo-only flags.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G220 will never run against remote or LIVE PostgreSQL');
const ROOT='apps/mobility-expo/docs/backend/staging_only/';
const suites=[
 {file:'G216_VERIFIED_COMPLETED_DELIVERY_ADMIN_ASSERT_POSTGRES_CI_ONLY.sql',
  marker:'G216 PASS: original priced G122 AUTO+MOTO',
  kinds:['DELIVERY_AUTO','DELIVERY_MOTO'],originalSource:'G122 original fare and request ID',
  stages:['source','synthetic accepted fixture','G5 pickup',
   'G67 courier delivery','G187 distinct recipient','G216 Admin']},
 {file:'G218_COMMERCE_ORIGINAL_ORDER_LINKED_DELIVERY_RECIPIENT_ADMIN_ASSERT_POSTGRES_CI_ONLY.sql',
  marker:'G218 PASS: SAME ORIGINAL G150 order',
  kinds:['COMMERCE'],originalSource:'G45 original order + G150 same linked priced delivery',
  stages:['source','G150 merchant ready','synthetic accepted fixture',
   'G5 pickup','G67 courier delivery','G187 distinct recipient','G216+G217 Admin']},
 {file:'G219_ORIGINAL_AUTO_MOTO_FIVE_STAGE_RIDES_POSTGRES_CI_ONLY.sql',
  marker:'G219 QA 2/2: NEW real G73+G93 AUTO and G100 MOTO Client booking',
  kinds:['AUTO_RIDE','MOTO_RIDE'],
  originalSource:'G73+G93 AUTO booking and G100 MOTO original ledger',
  stages:['original route and priced booking','synthetic accepted fixture',
   'G3 or G118 Driver arriving','Driver in_progress',
   'Driver completed','G138 or G142 Admin']}
];
const output=[];
for(const s of suites){
 const result=spawnSync('psql',['-X','-v','ON_ERROR_STOP=1',
  '-f',ROOT+s.file],{env:process.env,encoding:'utf8',
  timeout:90000,maxBuffer:1000000});
 if(result.error||result.status!==0){
  console.error('G220 FAIL-CLOSED '+s.file+' status='+result.status);
  console.error((result.stderr??'').slice(-1900));
  throw Error('G220 source-backed complete QA suite failed: '+s.file);
 }
 assert.equal((result.stderr.match(new RegExp(
  s.marker.replace(/[.*+?^\x24{}()|[\]\\]/g,'\\$&'),'g'))??[]).length,1,
  'G220 expected ONE source-backed SQL RAISE NOTICE success: '+s.file);
 assert(s.kinds.length>=1&&s.kinds.length<=2);
 assert(s.stages.length>=5&&s.stages.includes('synthetic accepted fixture'),
  'G220 stages must identify only explicitly synthetic legal accept');
 for(const serviceKind of s.kinds)output.push({
  serviceKind,rollbackOnly:true,isolatedOriginalIdConfirmed:true,
  legalAcceptance:'EXPLICIT_DB_OWNER_SYNTHETIC_PREACCEPT_NO_PUBLIC_RPC',
  originalSource:s.originalSource,
  stages:s.stages,finalIndependentAdminReceipt:true,
  externalGpsOrIdentityCertified:false,pspAuthorized:false,
  commerciallyCertified:false
 });
}
const order=['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE'];
output.sort((a,b)=>order.indexOf(a.serviceKind)-order.indexOf(b.serviceKind));
assert.deepEqual(output.map(x=>x.serviceKind),order);
const g215=JSON.parse(readFileSync(
 '/tmp/qore-g215-five-journey-e2e-readiness.json','utf8'));
assert.equal(g215.productionEnabled,false);
assert.equal(g215.sourceAndAdminOriginalCount,5);
assert.equal(g215.externallyCertifiedJourneys,0);
assert.equal(g215.qaJourneysCompleted,0,
 'G220 must never relabel ROLLBACK QA as persistent original G215 closure');
const report={
 name:'G220_FIVE_INDEPENDENT_ROLLBACK_QA_JOURNEYS',
 mode:'ISOLATED_PG16_MULTI_TRANSACTION',
 verdict:'5_OF_5_ISOLATED_QA_SCENARIOS_COMPLETED_ONLY',
 rollbackIsolatedQaScenariosPassed:5,
 persistentG215SameOriginalSourcesCompleted:g215.qaJourneysCompleted,
 allFiveSameCommittedOriginalSources:false,
 originalClientToAdminPersistedSources:5,
 externallyCertifiedJourneys:0,commercialLaunchAllowed:false,
 noSyntheticLegalProviderApproval:true,
 limitations:['Each source is original WITHIN its own rollback scenario',
  'G215 separate persisted sources remain incomplete',
  'No external municipal license GPS device IdP or paid PSP'],
 scenarios:output
};
writeFileSync('/tmp/qore-g220-five-rollback-qa-journeys.json',
 JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({name:report.name,verdict:report.verdict,
 rollbackIsolatedQaScenariosPassed:report.rollbackIsolatedQaScenariosPassed,
 persistentG215SameOriginalSourcesCompleted:report.persistentG215SameOriginalSourcesCompleted,
 externallyCertifiedJourneys:0,scenarios:order}));
