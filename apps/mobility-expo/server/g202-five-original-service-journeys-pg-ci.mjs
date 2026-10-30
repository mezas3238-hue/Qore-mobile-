/**
 * G202: one disposable PostgreSQL, five ORIGINAL client source receipts, same
 * Admin-private service IDs. Never substitutes a synthetic Driver assignment,
 * municipal permit, paid PSP, GPS, handoff or completion.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain'||
 process.env.PGPORT!=='5432')
 throw Error('G202 refuses external and LIVE PostgreSQL');
function sql(q){
 const value=execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1',
 '-c',q],{encoding:'utf8',timeout:15000,maxBuffer:1000000,
 stdio:['ignore','pipe','pipe']});
 return value.trim().split('\n').at(-1)?.trim()??'';
}
function json(q){const raw=sql(q);return raw&&raw!=='null'?JSON.parse(raw):null;}
assert.equal(sql("SELECT (current_database()='qore_disposable_chain' "+
 "AND current_setting('application_name')='qore_ci_disposable_chain')::text"),'true');
const admin=sql("SELECT user_id::text FROM public.mobility_stage_backoffice_roles "+
 "WHERE role='admin' AND status='active' AND "+
 "public.mobility_stage_g27_backoffice_role_of(user_id)='admin' "+
 "ORDER BY user_id LIMIT 1");
assert(UUID.test(admin),'No independent verified Admin role');
const common="jsonb_build_object('id',s.id,'requestKey',s.request_key,"+
 "'status',s.status,'driverAssigned',false)";
const sources=[
 ['AUTO_RIDE','mobility_stage_g138_auto_trace_qa',
  "SELECT jsonb_build_object('id',t.id,'requestKey',t.request_key,"+
  "'status',t.status,'driverAssigned',false) "+
  "FROM public.mobility_stage_auto_demo_trips t "+
  "JOIN public.mobility_stage_g72_auto_prequotes q ON q.trip_id=t.id "+
  "AND q.booking_key=t.request_key AND q.passenger_id=t.passenger_id "+
  "AND q.route_id IS NOT NULL "+
  "JOIN public.mobility_stage_g93_auto_ledger l ON l.trip_id=t.id "+
  "AND l.booking_key=t.request_key AND l.quote_id=q.id "+
  "WHERE t.driver_id IS NULL AND t.status IN ('searching','cancelled') "+
  "ORDER BY t.created_at DESC LIMIT 1"],
 ['MOTO_RIDE','mobility_stage_g142_moto_trace_qa',
  "SELECT jsonb_build_object('id',t.id,'requestKey',t.booking_key,"+
  "'status',t.status,'driverAssigned',false) "+
  "FROM public.mobility_stage_g100_moto_trips t "+
  "JOIN public.mobility_stage_g100_moto_quotes q ON q.id=t.quote_id "+
  "AND q.passenger_id=t.passenger_id "+
  "WHERE t.status IN ('searching','cancelled') "+
  "AND (SELECT count(*) FROM public.mobility_stage_g100_moto_entries e "+
  "WHERE e.quote_id=q.id AND e.phase='reserve')=4 "+
  "ORDER BY t.created_at DESC LIMIT 1"],
 ...['AUTO','MOTO'].map(vehicle=>[
  'DELIVERY_'+vehicle,'mobility_stage_g145_delivery_trace_qa',
  "SELECT "+common+" FROM public.mobility_stage_deliveries s "+
  "JOIN public.mobility_stage_g122_delivery_price_consents c "+
  "ON c.delivery_id=s.id AND c.sender_id=s.sender_id "+
  "AND c.vehicle_kind=s.requested_vehicle_kind "+
  "JOIN public.mobility_stage_fare_quotes q ON q.id=c.quote_id "+
  "AND q.subject_id=s.id AND q.customer_id=s.sender_id "+
  "AND q.total_pyg=c.accepted_total_gs "+
  "WHERE s.requested_vehicle_kind='"+vehicle+"' AND s.courier_id IS NULL "+
  "AND s.status IN ('requested','cancelled') "+
  "ORDER BY s.created_at DESC LIMIT 1"
 ]),
 ['COMMERCE','mobility_stage_g146_commerce_trace_qa',
  "SELECT jsonb_build_object('id',o.id,'requestKey',o.request_key,"+
  "'status',o.status,'driverAssigned',false,'merchantReady',true,"+
  "'linkedDeliveryId',o.delivery_id) "+
  "FROM public.mobility_stage_merchant_orders o "+
  "JOIN public.mobility_stage_g45_order_receipts r ON "+
  "r.order_id=o.id AND r.request_key=o.request_key AND r.buyer_id=o.buyer_id "+
  "JOIN public.mobility_stage_deliveries d ON d.id=o.delivery_id "+
  "AND d.sender_id=o.buyer_id AND d.requested_vehicle_kind=o.requested_vehicle_kind "+
  "JOIN public.mobility_stage_g122_delivery_price_consents c ON "+
  "c.delivery_id=d.id AND c.sender_id=d.sender_id "+
  "AND c.vehicle_kind=d.requested_vehicle_kind "+
  "WHERE o.status='ready' AND o.revision=5 "+
  "ORDER BY o.created_at DESC LIMIT 1"]
];
// G221 supplies five positive SAME-ORIGINAL-ID rows COMMITTED only in the
// disposable CI database. Without G221, retain the conservative G202 base
// audit of five pending/cancelled sources exactly as before.
const positiveSameIdMode=sql("SELECT (to_regclass("+
 "'public.mobility_stage_g221_five_original_qa_sources') IS NOT NULL)::text")==='true';
const positiveQueries={
 AUTO_RIDE:"SELECT jsonb_build_object('id',t.id,'requestKey',t.request_key,"+
  "'status',t.status,'driverAssigned',t.driver_id IS NOT NULL) "+
  "FROM public.mobility_stage_g221_five_original_qa_sources m "+
  "JOIN public.mobility_stage_auto_demo_trips t ON t.id=m.service_id "+
  "AND t.request_key=m.request_key AND t.status::text=m.source_status "+
  "WHERE m.service_kind='AUTO_RIDE' AND t.status='completed' AND t.revision=5",
 MOTO_RIDE:"SELECT jsonb_build_object('id',t.id,'requestKey',t.booking_key,"+
  "'status',t.status,'driverAssigned',t.driver_id IS NOT NULL) "+
  "FROM public.mobility_stage_g221_five_original_qa_sources m "+
  "JOIN public.mobility_stage_g100_moto_trips t ON t.id=m.service_id "+
  "AND t.booking_key=m.request_key AND t.status=m.source_status "+
  "WHERE m.service_kind='MOTO_RIDE' AND t.status='completed' AND t.revision=5",
 DELIVERY_AUTO:"SELECT jsonb_build_object('id',d.id,'requestKey',d.request_key,"+
  "'status',d.status,'driverAssigned',d.courier_id IS NOT NULL) "+
  "FROM public.mobility_stage_g221_five_original_qa_sources m "+
  "JOIN public.mobility_stage_deliveries d ON d.id=m.service_id "+
  "AND d.request_key=m.request_key AND d.status::text=m.source_status "+
  "WHERE m.service_kind='DELIVERY_AUTO' AND d.status='delivered' "+
  "AND d.requested_vehicle_kind='AUTO' AND d.revision=4",
 DELIVERY_MOTO:"SELECT jsonb_build_object('id',d.id,'requestKey',d.request_key,"+
  "'status',d.status,'driverAssigned',d.courier_id IS NOT NULL) "+
  "FROM public.mobility_stage_g221_five_original_qa_sources m "+
  "JOIN public.mobility_stage_deliveries d ON d.id=m.service_id "+
  "AND d.request_key=m.request_key AND d.status::text=m.source_status "+
  "WHERE m.service_kind='DELIVERY_MOTO' AND d.status='delivered' "+
  "AND d.requested_vehicle_kind='MOTO' AND d.revision=4",
 COMMERCE:"SELECT jsonb_build_object('id',o.id,'requestKey',o.request_key,"+
  "'status',o.status,'driverAssigned',false,'merchantReady',true,"+
  "'linkedDeliveryId',o.delivery_id) "+
  "FROM public.mobility_stage_g221_five_original_qa_sources m "+
  "JOIN public.mobility_stage_merchant_orders o ON o.id=m.service_id "+
  "AND o.request_key=m.request_key AND o.status::text=m.source_status "+
  "AND o.delivery_id=m.linked_delivery_id "+
  "JOIN public.mobility_stage_deliveries d ON d.id=o.delivery_id "+
  "AND d.status='delivered' "+
  "WHERE m.service_kind='COMMERCE' AND o.status='ready' AND o.revision=5"
};
const results=[];
for(const [kind,baseFn,query] of sources){
 const source=json(positiveSameIdMode?positiveQueries[kind]:query);
 const fn=positiveSameIdMode&&kind.startsWith('DELIVERY_')
  ?'mobility_stage_g216_completed_delivery_trace_qa':baseFn;
 assert(source&&UUID.test(source.id)&&UUID.test(source.requestKey),
  kind+' missing original real PostgreSQL Client booking');
 const signature='public.'+fn+'(uuid,uuid)';
 assert.equal(sql("SELECT has_function_privilege('service_role','"+
  signature+"','EXECUTE')::text"),'true',kind+' Admin role source missing');
 assert.equal(sql("SELECT has_function_privilege('authenticated','"+
  signature+"','EXECUTE')::text"),'false',kind+' Admin SQL exposed');
 const trace=json("SET ROLE service_role; SELECT public."+fn+
  "('"+admin+"'::uuid,'"+source.id+"'::uuid)::text");
 assert(trace&&trace.mode==='STAGING_DEMO_ONLY'&&
  trace.viewerId===admin&&trace.serviceKind===kind&&
  trace.serviceId===source.id&&
  trace.bookingRequestKey===source.requestKey&&
  trace.serverPersisted===true&&trace.productionEnabled===false,
  kind+' Client / PostgreSQL / Admin original identity mismatch');
 assert.equal(trace.status,source.status,
  kind+' original source status diverged from Admin');
 const expectedState=positiveSameIdMode&&kind!=='COMMERCE'
  ?'QA_COMPLETED':'NOT_ASSIGNABLE';
 assert.equal(trace.assignment.state,expectedState,
  kind+' source-backed Admin completion state invalid');
 if(positiveSameIdMode&&kind!=='COMMERCE')
  assert.equal(trace.assignment.legalGate,'EXTERNAL_NOT_CERTIFIED',
   kind+' QA synthetic acceptance must never mean legal clearance');
 assert.notEqual(trace.assignment.legalGate,'CLEARED');
 results.push({
  serviceKind:kind,originalServiceId:source.id,
  originalRequestKey:source.requestKey,
  status:source.status,sourcePersisted:true,
  clientToAdminSameOriginal:true,
  merchantReady:source.merchantReady===true,
  linkedCommerceDeliveryId:source.linkedDeliveryId??null,
  realDriverOrCourierAccepted:false,
  syntheticQaAccepted:positiveSameIdMode&&source.driverAssigned===true,
  qaJourneyClosedInDisposableSource:positiveSameIdMode,
  realFinalCustomerHandoff:false,realPSPSettlement:false,
  independentLegalApproval:false,
  commercialEndToEndComplete:false
 });
}
assert.deepEqual(results.map(x=>x.serviceKind),[
 'AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE']);
const audit={
 name:'G202_FIVE_ORIGINAL_SERVICE_JOURNEYS',
 mode:'STAGING_DEMO_ONLY',productionEnabled:false,
 originalPostgresAndAdminReceipts:5,
 qaPositiveSameOriginalIds:positiveSameIdMode?5:0,
 syntheticAcceptedOnlyInDisposableCi:positiveSameIdMode,
 commerciallyCompletedEndToEndJourneys:0,
 externalIdpLegalGpsCourierAndPspPending:true,
 services:results
};
writeFileSync('/tmp/qore-g202-five-original-journeys-qa.json',
 JSON.stringify(audit,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify(audit));
console.log('G202 PASS original 5 Client→Admin persisted sources. Zero certified commercial closures; no synthetic Driver/PSP claim');
