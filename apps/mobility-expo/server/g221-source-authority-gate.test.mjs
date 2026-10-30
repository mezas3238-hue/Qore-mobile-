import test from 'node:test';
import assert from 'node:assert/strict';
import {buildG221Evidence,G221_KINDS} from './g221-source-authority-gate-pg-ci.mjs';
function fixture(){
 const services=G221_KINDS.map((serviceKind,i)=>({
  serviceKind,originalServiceId:'22000000-0000-4220-8220-'+String(i+1).padStart(12,'0'),
  originalRequestKey:'22100000-0000-4221-8221-'+String(i+1).padStart(12,'0'),
  status:serviceKind==='COMMERCE'?'ready':'searching',
  clientToAdminSameOriginal:true
 }));
 const original=s=>({
  serviceKind:s.serviceKind,originalServiceId:s.originalServiceId,
  originalRequestKey:s.originalRequestKey,status:s.status,
  missingQaSteps:['driverAccepted'],qaJourneyClosed:false,
  commercialEndToEndCertified:false
 });
 return {
  sources:{mode:'STAGING_DEMO_ONLY',productionEnabled:false,
   originalPostgresAndAdminReceipts:5,services},
  readiness:{productionEnabled:false,sourceAndAdminOriginalCount:5,
   qaJourneysCompleted:0,qaJourneysStillOpen:5,
   externallyCertifiedJourneys:0,commercialLaunchAllowed:false,
   services:services.map(original)},
  rollback:{rollbackIsolatedQaScenariosPassed:5,commercialLaunchAllowed:false,
   externallyCertifiedJourneys:0,persistentG215SameOriginalSourcesCompleted:0,
   allFiveSameCommittedOriginalSources:false,
   scenarios:services.map(s=>({
    serviceKind:s.serviceKind,rollbackOnly:true,
    isolatedOriginalIdConfirmed:true,finalIndependentAdminReceipt:true,
    commerciallyCertified:false,pspAuthorized:false,
    externalGpsOrIdentityCertified:false
   }))},
  db:{g38AutoTrigger:true,g38DeliveryTrigger:true,
   g38PolicyEligibleCount:0,g118MunicipalAuthorizedCount:0,
   qaFixtureUserLeaks:0,publicCanInvokeG38:false,publicCanInvokeG118:false}
 };
}
test('G221 preserves 5/5 rollback success without inventing persistent completions',()=>{
 const report=buildG221Evidence(fixture());
 assert.equal(report.verdict,'ORIGINAL_PERSISTENT_E2E_STILL_OPEN');
 assert.equal(report.originalPersistedQaClosed,0);
 assert.equal(report.independentlyReplayedRollbackQaPassed,5);
 assert.equal(report.commercialLaunchAllowed,false);
 assert.equal(report.g38AndG118FailClosed,true);
});
test('G221 detects source ID substitution and G215 count manipulation',()=>{
 const a=fixture();a.readiness.services[2].originalServiceId=
  'ffffffff-ffff-4fff-8fff-ffffffffffff';
 assert.throws(()=>buildG221Evidence(a),/substituted/);
 const b=fixture();b.readiness.qaJourneysCompleted=5;
 b.readiness.qaJourneysStillOpen=0;
 b.rollback.persistentG215SameOriginalSourcesCompleted=5;
 assert.throws(()=>buildG221Evidence(b),/disagree/);
});
test('G221 refuses inactive G38, fabricated municipal status or leaked fixture',()=>{
 for(const [key,value] of [
  ['g38AutoTrigger',false],['g38DeliveryTrigger',false],
  ['g38PolicyEligibleCount',1],['g118MunicipalAuthorizedCount',1],
  ['qaFixtureUserLeaks',1],['publicCanInvokeG118',true],
  ['publicCanInvokeG38',true]
 ]){
  const f=fixture();f.db[key]=value;
  assert.throws(()=>buildG221Evidence(f),key);
 }
});
test('G221 supports legitimate future partial QA closure without calling it LIVE',()=>{
 const f=fixture();
 f.readiness.services[0].missingQaSteps=[];
 f.readiness.services[0].qaJourneyClosed=true;
 f.readiness.qaJourneysCompleted=1;
 f.readiness.qaJourneysStillOpen=4;
 f.rollback.persistentG215SameOriginalSourcesCompleted=1;
 const evidence=buildG221Evidence(f);
 assert.equal(evidence.originalPersistedQaClosed,1);
 assert.equal(evidence.externallyCertified,0);
 assert.equal(evidence.commercialLaunchAllowed,false);
});
