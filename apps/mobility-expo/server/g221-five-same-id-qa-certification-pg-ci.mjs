/**
 * G221 authoritative strict positive five-same-original-ID QA gate.
 * Rejects incomplete original Driver/Courier/Recipient/Admin evidence.
 * This is NOT a legal/commercial deployment certificate: every acceptance is
 * synthetic and the entire PostgreSQL database exists only inside CI.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G221 certification cannot target a non-disposable database');
const sources=JSON.parse(readFileSync('/tmp/qore-g202-five-original-journeys-qa.json','utf8'));
const audit=JSON.parse(readFileSync('/tmp/qore-g215-five-journey-e2e-readiness.json','utf8'));
const kinds=['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE'];
const q=sql=>execFileSync('psql',['-X','-q','-A','-t',
 '-v','ON_ERROR_STOP=1','-c',sql],{
 encoding:'utf8',timeout:15000,maxBuffer:1000000
}).trim().split('\n').at(-1)?.trim();
assert.equal(q("SELECT current_database() || ':' || current_setting('application_name')"),
 'qore_disposable_chain:qore_ci_disposable_chain');
assert.equal(q("SELECT count(*) FROM public.mobility_stage_g221_five_original_qa_sources"),'5');
assert.deepEqual(sources.services.map(x=>x.serviceKind),kinds);
assert.deepEqual(audit.services.map(x=>x.serviceKind),kinds);
assert.equal(sources.qaPositiveSameOriginalIds,5);
assert.equal(sources.syntheticAcceptedOnlyInDisposableCi,true);
assert.equal(audit.qaJourneysCompleted,5);
assert.equal(audit.allFiveQaClosed,true);
assert.equal(audit.qaJourneysStillOpen,0);
assert.equal(audit.externallyCertifiedJourneys,0);
assert.equal(audit.commercialLaunchAllowed,false);
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
for(let i=0;i<kinds.length;i++){
 const origin=sources.services[i],closure=audit.services[i];
 assert.equal(origin.originalServiceId,closure.originalServiceId);
 assert.equal(origin.originalRequestKey,closure.originalRequestKey);
 assert.equal(origin.status,closure.status);
 assert(uuid.test(origin.originalServiceId)&&uuid.test(origin.originalRequestKey));
 assert.equal(origin.qaJourneyClosedInDisposableSource,true);
 assert.equal(closure.qaJourneyClosed,true);
 assert.deepEqual(closure.missingQaSteps,[]);
 assert.equal(closure.commercialEndToEndCertified,false);
 assert.equal(origin.independentLegalApproval,false);
 assert.equal(origin.realFinalCustomerHandoff,false);
 assert.equal(origin.realPSPSettlement,false);
 assert(closure.unverifiedExternalAuthorities.length>=3);
}
assert.equal(new Set(audit.services.map(x=>x.originalServiceId)).size,5);
const certificate={
 name:'G221_FIVE_SAME_ORIGINAL_ID_QA_CLOSURES',
 mode:'DISPOSABLE_POSTGRES16_SYNTHETIC_ACCEPTANCE_COMMITTED_QA_ONLY',
 originalClientToAdminSameIds:5,
 originalDriverCourierCommerceStepsClosed:5,
 qaJourneysCompleted:5,
 externalLegalGpsIdpPspAndPhysicalServicesCertified:0,
 productionEnabled:false,
 commercialLaunchAllowed:false,
 reusableStagingApproval:false,
 verdict:'FIVE_QA_SAME_ORIGINAL_IDS_COMPLETE_EXTERNAL_RELEASE_BLOCKED',
 services:audit.services.map(s=>({
  serviceKind:s.serviceKind,originalServiceId:s.originalServiceId,
  bookingRequestKey:s.originalRequestKey,qaVerifiedSteps:s.steps,
  missingQaSteps:[],originalSameId:true,
  syntheticAcceptanceOnly:true,externallyCertified:false
 }))
};
const output='/tmp/qore-g221-five-same-id-e2e-certification.json';
writeFileSync(output,JSON.stringify(certificate,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({name:certificate.name,verdict:certificate.verdict,
 originalClientToAdminSameIds:5,qaJourneysCompleted:5,
 externalCertified:0,output}));
