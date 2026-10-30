/**
 * G221: independent, fail-closed boundary audit for the five-source E2E lab.
 *
 * G220's 5/5 rollback scenarios MUST NOT silently re-label G202/G215 source
 * records as committed completions. G38/G118 must remain active and unmintable
 * in this disposable database; fixture users must disappear after rollback.
 *
 * This is an executable safety/readiness gate, NOT a production certificate.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const G221_KINDS=Object.freeze([
 'AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE'
]);
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function buildG221Evidence({sources,readiness,rollback,db}){
 assert.equal(sources.mode,'STAGING_DEMO_ONLY');
 assert.equal(sources.productionEnabled,false);
 assert.equal(sources.originalPostgresAndAdminReceipts,5);
 assert.equal(readiness.productionEnabled,false);
 assert.equal(readiness.sourceAndAdminOriginalCount,5);
 assert.equal(readiness.externallyCertifiedJourneys,0);
 assert.equal(readiness.commercialLaunchAllowed,false);
 assert.equal(readiness.qaJourneysCompleted+readiness.qaJourneysStillOpen,5);
 assert.equal(rollback.rollbackIsolatedQaScenariosPassed,5);
 assert.equal(rollback.commercialLaunchAllowed,false);
 assert.equal(rollback.externallyCertifiedJourneys,0);
 assert.equal(rollback.persistentG215SameOriginalSourcesCompleted,
  readiness.qaJourneysCompleted);
 assert.equal(rollback.allFiveSameCommittedOriginalSources,false);
 assert.equal(db.g38AutoTrigger,true,'G38 AUTO acceptance guard was disabled');
 assert.equal(db.g38DeliveryTrigger,true,'G38 DELIVERY acceptance guard was disabled');
 assert.equal(db.g38PolicyEligibleCount,0,'G38 test zone promoted to legal eligibility');
 assert.equal(db.g118MunicipalAuthorizedCount,0,'G118 synthetic municipal authorization');
 assert.equal(db.qaFixtureUserLeaks,0,'A rollback-only identity survived the lab');
 assert.equal(db.publicCanInvokeG38,false,'G38 private trigger function exposed');
 assert.equal(db.publicCanInvokeG118,false,'G118 private MOTO accept exposed');
 assert.deepEqual(sources.services.map(x=>x.serviceKind),G221_KINDS);
 assert.deepEqual(readiness.services.map(x=>x.serviceKind),G221_KINDS);
 assert.deepEqual(rollback.scenarios.map(x=>x.serviceKind),G221_KINDS);
 const result=G221_KINDS.map((kind,i)=>{
  const source=sources.services[i],current=readiness.services[i];
  const qa=rollback.scenarios[i];
  assert(UUID.test(source.originalServiceId));
  assert(UUID.test(source.originalRequestKey));
  assert.equal(current.originalServiceId,source.originalServiceId,
   'G215 silently substituted a different original service ID');
  assert.equal(current.originalRequestKey,source.originalRequestKey,
   'G215 silently substituted a different original request key');
  assert.equal(current.status,source.status,'G215 changed source after Admin audit');
  assert.equal(source.clientToAdminSameOriginal,true);
  assert.equal(qa.rollbackOnly,true);
  assert.equal(qa.isolatedOriginalIdConfirmed,true);
  assert.equal(qa.finalIndependentAdminReceipt,true);
  assert.equal(qa.commerciallyCertified,false);
  assert.equal(qa.pspAuthorized,false);
  assert.equal(qa.externalGpsOrIdentityCertified,false);
  assert(Array.isArray(current.missingQaSteps));
  assert.equal(current.qaJourneyClosed,current.missingQaSteps.length===0);
  assert.equal(current.commercialEndToEndCertified,false);
  return {
   serviceKind:kind,originalServiceId:source.originalServiceId,
   originalRequestKey:source.originalRequestKey,
   state:current.status,committedOriginalQaClosed:current.qaJourneyClosed,
   unresolved:current.missingQaSteps,
   independentlyReplayedRollbackQaPassed:true,
   externallyAuthorized:false
  };
 });
 assert.equal(result.filter(x=>x.committedOriginalQaClosed).length,
  readiness.qaJourneysCompleted,'G215 summary and same-ID service rows disagree');
 return {
  name:'G221_SOURCE_AUTHORITY_AND_NO_LEAK_GATE',
  mode:'LOCAL_POSTGRES16_QA_ONLY',
  verdict:readiness.qaJourneysCompleted===5
   ?'FIVE_SAME_ORIGINAL_QA_CLOSED_BUT_NOT_COMMERCIAL'
   :'ORIGINAL_PERSISTENT_E2E_STILL_OPEN',
  originalPersistedQaClosed:readiness.qaJourneysCompleted,
  independentlyReplayedRollbackQaPassed:5,
  externallyCertified:0,commercialLaunchAllowed:false,
  g38AndG118FailClosed:true,
  rollbackIdentitiesNotPersisted:true,
  sourceSelectionLimitation:
   'G202 currently samples only unassigned searching/cancelled ride/cargo sources; this sampler cannot select completed ones',
  requiredEngineering:
   'Track five explicitly identified original bookings through gated test-identity dispatch and use those IDs for independent G215 terminal readback; never alter cancelled production-origin records or bypass G38/G118',
  services:result
 };
}

const SQL=[
 'SELECT jsonb_build_object(',
 "'g38AutoTrigger',EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t",
 " WHERE t.tgrelid='public.mobility_stage_auto_demo_trips'::regclass",
 " AND t.tgname='mobility_stage_g38_auto_acceptance'",
 " AND NOT t.tgisinternal AND t.tgenabled IN ('O','A')),",
 "'g38DeliveryTrigger',EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t",
 " WHERE t.tgrelid='public.mobility_stage_deliveries'::regclass",
 " AND t.tgname='mobility_stage_g38_delivery_acceptance'",
 " AND NOT t.tgisinternal AND t.tgenabled IN ('O','A')),",
 "'g38PolicyEligibleCount',(SELECT count(*)::int",
 " FROM public.mobility_stage_g31_zone_coverage WHERE eligible_by_policy IS TRUE),",
 "'g118MunicipalAuthorizedCount',(SELECT count(*)::int",
 " FROM public.mobility_stage_g118_moto_legal_zones",
 " WHERE independently_authorized IS TRUE),",
 "'qaFixtureUserLeaks',(SELECT count(*)::int FROM auth.users",
 " WHERE left(id::text,8) IN ('21900000','21800000','21600000')),",
 "'publicCanInvokeG38',(",
 " has_function_privilege('authenticated',",
 " 'public.mobility_stage_g38_acceptance_fence()','EXECUTE') OR",
 " has_function_privilege('anon',",
 " 'public.mobility_stage_g38_acceptance_fence()','EXECUTE')),",
 "'publicCanInvokeG118',(",
 " has_function_privilege('authenticated',",
 " 'public.mobility_stage_g118_moto_accept_qa(uuid,uuid,uuid)','EXECUTE') OR",
 " has_function_privilege('anon',",
 " 'public.mobility_stage_g118_moto_accept_qa(uuid,uuid,uuid)','EXECUTE'))",
 ')'
].join(' ');

function databaseEvidence(){
 const out=execFileSync('psql',['-X','-q','-A','-t',
  '-v','ON_ERROR_STOP=1','-c',SQL],{
  encoding:'utf8',timeout:15000,maxBuffer:100000
 });
 return JSON.parse(out.trim().split('\n').at(-1));
}
function main(){
 if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
  process.env.PGPORT!=='5432'||
  process.env.PGDATABASE!=='qore_disposable_chain'||
  process.env.PGAPPNAME!=='qore_ci_disposable_chain')
  throw Error('G221 refuses to inspect remote or production databases');
 const load=p=>JSON.parse(readFileSync(p,'utf8'));
 const evidence=buildG221Evidence({
  sources:load('/tmp/qore-g202-five-original-journeys-qa.json'),
  readiness:load('/tmp/qore-g215-five-journey-e2e-readiness.json'),
  rollback:load('/tmp/qore-g220-five-rollback-qa-journeys.json'),
  db:databaseEvidence()
 });
 writeFileSync('/tmp/qore-g221-source-authority-gate.json',
  JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({
  name:evidence.name,verdict:evidence.verdict,
  originalPersistedQaClosed:evidence.originalPersistedQaClosed,
  rollbackQaPassed:evidence.independentlyReplayedRollbackQaPassed,
  g38AndG118FailClosed:evidence.g38AndG118FailClosed
 }));
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)
 main();
