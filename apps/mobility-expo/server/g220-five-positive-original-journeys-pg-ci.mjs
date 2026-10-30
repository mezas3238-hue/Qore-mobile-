/**
 * G220: FIVE POSITIVE ORIGINAL-SOURCE QA LIFECYCLES in the SAME disposable
 * PostgreSQL 16 schema/CI revision. Each case uses a fresh or preexisting
 * original source and the actual Driver/Courier SQL state machine; ONLY its
 * otherwise-impossible legal Driver acceptance is synthetic, in ROLLBACK.
 *
 * QA facts are kept SEPARATE from G215's persistent same-five audit and
 * from external municipal permits, GPS, IdP, PSP and physical delivery.
 * Never count a cancelled old G202 trip as completed.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';

if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G220 refuses anything other than GitHub isolated disposable PostgreSQL16');
const gaps=JSON.parse(readFileSync('/tmp/qore-g215-five-journey-e2e-readiness.json','utf8'));
assert.equal(gaps.sourceAndAdminOriginalCount,5);
assert.equal(gaps.externallyCertifiedJourneys,0);
assert.deepEqual(gaps.services.map(s=>s.serviceKind),[
 'AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE']);

const suites=[
 {name:'passengers',path:
  'apps/mobility-expo/docs/backend/staging_only/G220_ORIGINAL_PASSENGER_AUTO_MOTO_COMPLETE_QA_ASSERT_POSTGRES_CI_ONLY.sql',
  kinds:['AUTO_RIDE','MOTO_RIDE'],proofs:[
   /G220 PASS AUTO_RIDE: fresh quoted\/booked original ID ([0-9a-f-]{36})/,
   /G220 PASS MOTO_RIDE: fresh quoted\/booked original ID ([0-9a-f-]{36})/]},
 {name:'deliveries',path:
  'apps/mobility-expo/docs/backend/staging_only/G216_VERIFIED_COMPLETED_DELIVERY_ADMIN_ASSERT_POSTGRES_CI_ONLY.sql',
  kinds:['DELIVERY_AUTO','DELIVERY_MOTO'],
  proofs:[/G216 PASS: original priced G122 AUTO\+MOTO/]},
 {name:'commerce',path:
  'apps/mobility-expo/docs/backend/staging_only/G218_COMMERCE_ORIGINAL_ORDER_LINKED_DELIVERY_RECIPIENT_ADMIN_ASSERT_POSTGRES_CI_ONLY.sql',
  kinds:['COMMERCE'],
  proofs:[/G218 PASS: SAME ORIGINAL G150 order and G5 linked delivery/]}
];
const services=[];
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
for(const suite of suites){
 const run=spawnSync('psql',['-X','-v','ON_ERROR_STOP=1','-f',suite.path],{
  encoding:'utf8',timeout:60000,maxBuffer:3000000
 });
 if(run.error)throw run.error;
 assert.equal(run.status,0,'G220 '+suite.name+' test failed: '+String(run.stderr).slice(-3500));
 const logs=String(run.stdout)+'\n'+String(run.stderr);
 for(const pattern of suite.proofs)
  assert(pattern.test(logs),'G220 '+suite.name+' did not prove its terminal source receipt');
 const ids=suite.proofs.map(re=>logs.match(re)?.[1]).filter(x=>uuid.test(x));
 if(suite.name==='passengers')assert.equal(ids.length,2);
 for(const kind of suite.kinds){
  services.push({
   serviceKind:kind,
   qaPositiveOriginalSameId:true,
   originalSourcePath:suite.path,
   positiveSourceCompletionEvidence:suite.name==='passengers'
    ?'G73_OR_G100_ORIGINAL_BOOKING_G177_OR_G213_DRIVER_G138_OR_G142_ADMIN'
    :suite.name==='deliveries'
    ?'G122_ORIGINAL_PRICE_G5_CUSTODY_G67_PROOF_G187_RECIPIENT_G216_ADMIN'
    :'G150_ORIGINAL_COMMERCE_G5_G67_G187_RECIPIENT_G146_G216_ADMIN',
   syntheticOnlyLegallyBlockedAcceptance:true,
   originalRideId:suite.name==='passengers'?ids[suite.kinds.indexOf(kind)]:null,
   rollbackPerformed:true,
   realMunicipalPermit:false,realGpsTrip:false,physicalServiceCertified:false,
   paymentSettlementCertified:false
  });
 }
 console.log('G220 positive suite PASS '+suite.name+': '+suite.kinds.join(', '));
}
assert.deepEqual(services.map(x=>x.serviceKind),[
 'AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE']);
assert.equal(services.filter(s=>s.qaPositiveOriginalSameId).length,5);
const output={
 name:'G220_FIVE_POSITIVE_ORIGINAL_SOURCE_QA_REPLAY',
 mode:'DISPOSABLE_PG16_ROLLBACK_ONLY',
 verdict:'FIVE_SYNTHETIC_ACCEPTANCE_QA_LIFECYCLES_PROVEN',
 qaPositiveJourneysWithSyntheticAcceptance:5,
 persistentG215SameFiveJourneysCompleted:gaps.qaJourneysCompleted,
 independentlyCertifiedRealWorldJourneys:0,
 productionEnabled:false,commercialLaunchAllowed:false,
 notes:'Distinct QA validation: DOES NOT rewrite G215 original cancelled/requested source status. Synthetic offer acceptance never proves a lawful dispatch. No real trips, municipal permits, provider GPS, recipient physical handoff or PSP settlement.',
 services
};
const path='/tmp/qore-g220-five-positive-qa-journeys.json';
writeFileSync(path,JSON.stringify(output,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({name:output.name,verdict:output.verdict,
 qaPositiveJourneysWithSyntheticAcceptance:5,
 persistentG215SameFiveJourneysCompleted:gaps.qaJourneysCompleted,
 independentlyCertifiedRealWorldJourneys:0,path}));
