/**
 * G215 E2E GAP LAB. Unlike G202 (five original Client->Admin sources),
 * independently inspect each source's actual Driver/Courier/Recipient/Commerce
 * chain at the END of the SAME disposable PostgreSQL16 integration run.
 *
 * This is NOT a fake 5/5 success: "source green" and "completed E2E" are
 * different claims. Persist a machine-readable gap report for every run,
 * including a strict QA closure option for later certification.
 *
 * No secrets, real third-party services, legal KYC or payments are touched.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {validateHistoricalQaProgress} from './g226-historical-qa-progress-contract.mjs';

if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G215 requires the isolated CI PostgreSQL16 source chain');

const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const sourcePath='/tmp/qore-g202-five-original-journeys-qa.json';
const terminalRecheck=process.env.QORE_G215_RECHECK_AFTER_QA==='true';
const outputPath=terminalRecheck
 ?'/tmp/qore-g226-g215-after-committed-qa.json'
 :'/tmp/qore-g215-five-journey-e2e-readiness.json';
const sources=JSON.parse(readFileSync(sourcePath,'utf8'));
const kinds=['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE'];
assert.equal(sources.mode,'STAGING_DEMO_ONLY');
assert.equal(sources.productionEnabled,false);
assert.equal(sources.originalPostgresAndAdminReceipts,5);
assert.deepEqual(sources.services.map(s=>s.serviceKind),kinds);
const quote=x=>{assert(uuid.test(x));return "'"+x+"'::uuid";};
function query(statement){
 const out=execFileSync('psql',['-X','-q','-A','-t',
  '-v','ON_ERROR_STOP=1','-c',statement],{
   encoding:'utf8',timeout:15000,maxBuffer:500000,
   stdio:['ignore','pipe','pipe']
 });
 const body=out.trim().split('\n').at(-1)?.trim();
 return body&&body!=='null'?JSON.parse(body):null;
}
assert.equal(query("SELECT jsonb_build_object('database',current_database(),"+
 "'app',current_setting('application_name'))").database,'qore_disposable_chain');
const contexts={
 AUTO_RIDE:id=>query(`SELECT jsonb_build_object(
 'state',t.status::text,'revision',t.revision,
 'driverAssigned',t.driver_id IS NOT NULL,
 'acceptedOfferConfirmed',EXISTS(
  SELECT 1 FROM public.mobility_stage_auto_demo_offers o
  WHERE o.trip_id=t.id AND o.driver_id=t.driver_id
   AND o.status='accepted' AND o.decision_key IS NOT NULL
   AND o.decision_event_id IS NOT NULL),
 'completedEventConfirmed',EXISTS(
  SELECT 1 FROM public.mobility_stage_auto_demo_events e
  WHERE e.trip_id=t.id AND e.actor_id=t.driver_id
   AND e.next_status='completed'),
 'events',(SELECT count(*) FROM public.mobility_stage_auto_demo_events e
  WHERE e.trip_id=t.id),
 'routePersisted',EXISTS(
  SELECT 1 FROM public.mobility_stage_g72_auto_prequotes q
  JOIN public.mobility_stage_g73_auto_routes r ON r.id=q.route_id
  WHERE q.trip_id=t.id AND q.booking_key=t.request_key)
 ) FROM public.mobility_stage_auto_demo_trips t
 WHERE t.id=${quote(id)}`),
 MOTO_RIDE:id=>query(`SELECT jsonb_build_object(
 'state',t.status::text,'revision',t.revision,
 'driverAssigned',t.driver_id IS NOT NULL,
 'acceptedOfferConfirmed',EXISTS(
  SELECT 1 FROM public.mobility_stage_g118_moto_offers o
  WHERE o.trip_id=t.id AND o.id=t.accepted_offer_id
   AND o.driver_id=t.driver_id AND o.vehicle_id=t.vehicle_id
   AND o.status='accepted' AND o.decision_key IS NOT NULL),
 'completedEventConfirmed',EXISTS(
  SELECT 1 FROM public.mobility_stage_g118_moto_events e
  WHERE e.trip_id=t.id AND e.driver_id=t.driver_id
   AND e.to_state='completed'),
 'events',(SELECT count(*) FROM public.mobility_stage_g118_moto_events e
  WHERE e.trip_id=t.id),
 'quotePersisted',t.quote_id IS NOT NULL
 ) FROM public.mobility_stage_g100_moto_trips t
 WHERE t.id=${quote(id)}`),
 DELIVERY_AUTO:id=>delivery(id),
 DELIVERY_MOTO:id=>delivery(id),
 COMMERCE:id=>query(`SELECT jsonb_build_object(
 'state',o.status::text,'revision',o.revision,'merchantReady',o.status='ready',
 'deliveryId',o.delivery_id,
 'pricedLinkedDelivery',EXISTS(
  SELECT 1 FROM public.mobility_stage_deliveries d
  JOIN public.mobility_stage_g122_delivery_price_consents c
   ON c.delivery_id=d.id AND c.sender_id=d.sender_id
    AND c.vehicle_kind=d.requested_vehicle_kind
  WHERE d.id=o.delivery_id AND d.sender_id=o.buyer_id
    AND d.requested_vehicle_kind=o.requested_vehicle_kind),
 'courierCompleted',EXISTS(
  SELECT 1 FROM public.mobility_stage_deliveries d
  WHERE d.id=o.delivery_id AND d.status='delivered'
   AND d.courier_id IS NOT NULL AND d.proof_ref IS NOT NULL),
 'recipientConfirmed',EXISTS(
  SELECT 1 FROM public.mobility_stage_g187_recipient_confirmations rc
  WHERE rc.delivery_id=o.delivery_id
   AND rc.confirmation_key IS NOT NULL)
 ) FROM public.mobility_stage_merchant_orders o
 WHERE o.id=${quote(id)}`)
};
function delivery(id){
 return query(`SELECT jsonb_build_object(
 'state',d.status::text,'revision',d.revision,
 'vehicleKind',d.requested_vehicle_kind::text,
 'courierAssigned',d.courier_id IS NOT NULL,
 'priceConsentPersisted',EXISTS(
   SELECT 1 FROM public.mobility_stage_g122_delivery_price_consents c
   WHERE c.delivery_id=d.id AND c.sender_id=d.sender_id
    AND c.vehicle_kind=d.requested_vehicle_kind),
 'acceptedCustodyEvent',EXISTS(
   SELECT 1 FROM public.mobility_stage_delivery_events e
   WHERE e.delivery_id=d.id AND e.action='accept'
    AND e.actor_id=d.courier_id AND e.next_status='accepted'),
 'pickedUpEvent',EXISTS(
   SELECT 1 FROM public.mobility_stage_delivery_events e
   WHERE e.delivery_id=d.id AND e.action='pickup'
    AND e.actor_id=d.courier_id AND e.next_status='picked_up'),
 'deliveredEvent',EXISTS(
   SELECT 1 FROM public.mobility_stage_delivery_events e
   WHERE e.delivery_id=d.id AND e.action='deliver'
    AND e.actor_id=d.courier_id AND e.next_status='delivered'
    AND e.proof_ref=d.proof_ref),
 'verifiedProofConsumed',EXISTS(
   SELECT 1 FROM public.mobility_stage_g67_delivery_proofs p
   WHERE p.delivery_id=d.id AND p.courier_id=d.courier_id
   AND p.proof_ref=d.proof_ref AND p.consumed_at IS NOT NULL
   AND p.revoked_at IS NULL),
 'independentRecipientConfirmed',EXISTS(
   SELECT 1 FROM public.mobility_stage_g187_recipient_confirmations rc
   WHERE rc.delivery_id=d.id AND rc.sender_id=d.sender_id
   AND rc.recipient_id<>d.sender_id AND rc.recipient_id<>d.courier_id
   AND rc.confirmation_key IS NOT NULL
   AND rc.confirmed_delivery_revision>=4)
 ) FROM public.mobility_stage_deliveries d
 WHERE d.id=${quote(id)}`);
}
const services=sources.services.map(source=>{
 assert(uuid.test(source.originalServiceId));
 assert(uuid.test(source.originalRequestKey));
 assert.equal(source.clientToAdminSameOriginal,true);
 const state=contexts[source.serviceKind](source.originalServiceId);
 assert(state,'G215 original service was deleted: '+source.serviceKind);
 if(!terminalRecheck)assert.equal(state.state,source.status,
  'G215 source state changed after Admin receipt: '+source.serviceKind);
 // G226 deliberately allows only completed G223 deliveries with authentic
 // G5/G67/G187 evidence, never passenger resurrections or fake assignment.
 let steps;
 if(source.serviceKind.endsWith('_RIDE')){
  steps={
   originalBookingPersisted:true,
   routeOrQuotePersisted:
    source.serviceKind==='AUTO_RIDE'?state.routePersisted:state.quotePersisted,
   driverAccepted:state.driverAssigned&&state.acceptedOfferConfirmed,
   driverCompleted:state.state==='completed'&&state.completedEventConfirmed,
   originalAdminRead:true
  };
 }else if(source.serviceKind.startsWith('DELIVERY_')){
  assert.equal(state.vehicleKind,source.serviceKind.slice(9));
  steps={
   originalBookingPersisted:true,priceConsented:state.priceConsentPersisted,
   courierAccepted:state.courierAssigned&&state.acceptedCustodyEvent,
   courierPickedUp:state.pickedUpEvent,
   courierDelivered:state.state==='delivered'&&state.deliveredEvent
    &&state.verifiedProofConsumed,
   independentRecipientConfirmed:state.independentRecipientConfirmed,
   originalAdminRead:true
  };
 }else{
  assert.equal(state.deliveryId,source.linkedCommerceDeliveryId);
  steps={
   originalBookingPersisted:true,merchantReady:state.merchantReady,
   linkedPricedDelivery:state.pricedLinkedDelivery,
   courierDelivered:state.courierCompleted,
   independentRecipientConfirmed:state.recipientConfirmed,
   originalAdminRead:true
  };
 }
 const missing=Object.entries(steps).filter(([,value])=>value!==true)
  .map(([label])=>label);
 const qaJourneyClosed=missing.length===0;
 if(terminalRecheck){
  const admin=query(`SELECT to_jsonb(user_id::text) FROM
   public.mobility_stage_backoffice_roles WHERE role='admin'
   AND status='active'
   AND public.mobility_stage_g27_backoffice_role_of(user_id)='admin'
   ORDER BY user_id LIMIT 1`);
  assert(uuid.test(admin),'G226 independent Admin identity missing');
  const fns={
   AUTO_RIDE:'mobility_stage_g138_auto_trace_qa',
   MOTO_RIDE:'mobility_stage_g142_moto_trace_qa',
   DELIVERY_AUTO:'mobility_stage_g145_delivery_trace_qa',
   DELIVERY_MOTO:'mobility_stage_g145_delivery_trace_qa',
   COMMERCE:'mobility_stage_g146_commerce_trace_qa'
  };
  const receipt=query('SET ROLE service_role; SELECT public.'+
   fns[source.serviceKind]+'('+quote(admin)+','+
   quote(source.originalServiceId)+')::text');
  assert(validateHistoricalQaProgress(source,state,steps,receipt));
 }
 return {
  serviceKind:source.serviceKind,
  originalServiceId:source.originalServiceId,
  originalRequestKey:source.originalRequestKey,
  status:state.state,steps,missingQaSteps:missing,
  qaJourneyClosed,
  // No CI-only synthetic session, route, image or offer can prove these.
  commercialEndToEndCertified:false,
  unverifiedExternalAuthorities:[
   'REAL_PROVIDER_AUTH_AND_REVOCATION','LEGAL_DRIVER_AND_MUNICIPAL_PERMISSION',
   'LIVE_GPS_AND_ROUTE_EVIDENCE','REAL_HANDOFF_OR_RECIPIENT_DEVICE',
   'PSP_SANDBOX_SETTLEMENT_AND_RECONCILIATION'
  ]
 };
});
assert.deepEqual(services.map(x=>x.serviceKind),kinds);
const qaClosed=services.filter(x=>x.qaJourneyClosed).length;
const audit={
 name:'G215_FIVE_JOURNEY_E2E_GAP_LAB',
 mode:'ISOLATED_DISPOSABLE_POSTGRES16',productionEnabled:false,
 type:terminalRecheck
  ?'G226_INDEPENDENT_POST_COMMIT_HISTORIC_SOURCE_ADMIN_READBACK'
  :'INDEPENDENT_DATABASE_READBACK_AFTER_HTTP_CI',
 sourceAndAdminOriginalCount:services.length,
 qaJourneysCompleted:qaClosed,
 qaJourneysStillOpen:services.length-qaClosed,
 externallyCertifiedJourneys:0,
 geoapifyProviderStatus:'SEPARATE_G129_REAL_SMOKE_REQUIRES_GITHUB_SECRET',
 allFiveQaClosed:qaClosed===5,
 commercialLaunchAllowed:false,
 verdict:terminalRecheck
  ?qaClosed===3?'THREE_HISTORIC_CARGO_COMMERCE_QA_CLOSED_PASSENGERS_PENDING'
   :'G226_HISTORIC_QA_RECHECK_FAILED'
  :qaClosed===5?'FIVE_QA_CHAINS_CLOSED_EXTERNAL_GATES_PENDING'
   :'E2E_QA_CLOSURE_NOT_COMPLETE',
 services
};
writeFileSync(outputPath,JSON.stringify(audit,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({
 name:audit.name,verdict:audit.verdict,
 sourceAndAdminOriginalCount:audit.sourceAndAdminOriginalCount,
 qaJourneysCompleted:audit.qaJourneysCompleted,
 externallyCertifiedJourneys:audit.externallyCertifiedJourneys,
 missingQaSteps:services.map(s=>({kind:s.serviceKind,
  missing:s.missingQaSteps})),
 output:outputPath
}));
if(process.env.QORE_REQUIRE_FIVE_QA_CLOSURES==='true'&&qaClosed!==5){
 console.error('G215 strict QA E2E gate RED: '+(5-qaClosed)+
  ' original journeys do not yet have a complete same-ID lifecycle');
 process.exitCode=2;
}

if(terminalRecheck&&qaClosed!==3){
 console.error('G226 expected exactly 3/5 historic original sources closed: '+qaClosed);
 process.exitCode=3;
}
