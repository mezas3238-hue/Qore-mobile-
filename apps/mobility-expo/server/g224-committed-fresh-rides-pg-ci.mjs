/**
 * G224: commits freshly booked AUTO+MOTO synthetic-acceptance QA rides, then
 * READS BOTH back through a distinct PostgreSQL connection & private Admin.
 * This does NOT advance G215's historically selected original five sources.
 * The DB is discarded with the Actions job; NEVER run against staging/LIVE.
 */
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const names=['AUTO_RIDE','MOTO_RIDE'];
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const out='/tmp/qore-g224-two-committed-qa-rides.json';
const sqlfile='apps/mobility-expo/docs/backend/staging_only/'+
 'G224_COMMITTED_FRESH_AUTO_MOTO_POSTGRES_DISPOSABLE_ONLY.sql';

export function validateIndependentReceipts(rows,receipts,originalSources,guard){
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(x=>x.serviceKind),names);
 assert.equal(new Set(rows.map(x=>x.originalTripId)).size,2);
 assert.equal(new Set(rows.map(x=>x.originalBookingKey)).size,2);
 assert.equal(originalSources.length,5,'G224 changed G223 original source count');
 assert.equal(guard.db,'qore_disposable_chain');
 assert.equal(guard.app,'qore_ci_disposable_chain');
 assert.equal(guard.g38Auto,true);
 assert.equal(guard.g38Delivery,true);
 assert.equal(guard.autoTriggerBypass,0,'G224 left triggers disabled after COMMIT');
 assert.equal(guard.authorizedSyntheticZones,0);
 assert.equal(guard.municipalAuthorizedMotoZones,0);
 assert.equal(guard.unauthorizedQaTableRead,false);
 for(const row of rows){
  assert(uuid.test(row.originalTripId));
  assert(uuid.test(row.originalBookingKey));
  assert(uuid.test(row.originalQuoteId));
  assert(uuid.test(row.originalPassengerId));
  assert(uuid.test(row.qaDriverId));
  assert.equal(row.acceptanceAuthority,'SYNTHETIC_QA_ONLY_NO_LEGAL_PROOF');
  assert.equal(row.productionEnabled,false);
  assert(!originalSources.includes(row.originalTripId),
   'G224 must not resurrect an existing cancelled G202 source');
  const receipt=receipts.find(x=>x?.serviceKind===row.serviceKind);
  assert(receipt,'G224 Admin receipt missing '+row.serviceKind);
  assert.equal(receipt.serviceId,row.originalTripId);
  assert.equal(receipt.bookingRequestKey,row.originalBookingKey);
  assert.equal(receipt.quoteId,row.originalQuoteId);
  assert.equal(receipt.status,'completed');
  assert.equal(receipt.revision,5);
  assert.equal(receipt.serverPersisted,true);
  assert.equal(receipt.mode,'STAGING_DEMO_ONLY');
  assert.equal(receipt.productionEnabled,false);
  assert.equal(receipt.assignment?.state,'QA_COMPLETED');
  assert.equal(receipt.assignment?.legalGate,'EXTERNAL_NOT_CERTIFIED');
  assert.equal(receipt.ledger?.reconciliationStatus,'PENDING');
  assert.deepEqual(receipt.events.map(x=>x.status),
   ['searching','assigned','arriving','in_progress','completed']);
  assert.equal(receipt.events.length,5);
 }
 return true;
}
function localOnly(){
 if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
  process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
  process.env.PGAPPNAME!=='qore_ci_disposable_chain')
  throw Error('G224 ONLY isolated disposable GitHub PostgreSQL16');
}
function psql(q){
 const output=execFileSync('psql',['-X','-q','-A','-t',
  '-v','ON_ERROR_STOP=1','-c',q],{
  encoding:'utf8',timeout:30000,maxBuffer:600000
 });
 return output.trim().split('\n').at(-1)?.trim()??'';
}
function json(q){return JSON.parse(psql(q));}
function U(s){assert(uuid.test(s));return "'"+s+"'::uuid";}
function queryRows(){
 return json(`SELECT coalesce(jsonb_agg(jsonb_build_object(
 'serviceKind',service_kind,
 'originalTripId',original_trip_id::text,
 'originalBookingKey',original_booking_key::text,
 'originalQuoteId',original_quote_id::text,
 'originalPassengerId',original_passenger_id::text,
 'qaDriverId',qa_driver_id::text,
 'acceptanceAuthority',acceptance_authority,
 'productionEnabled',production_enabled)
 ORDER BY service_kind),'[]'::jsonb)::text
 FROM public.mobility_stage_g224_fresh_rides_ci`);
}
function guards(){
 return json(`SELECT jsonb_build_object(
 'db',current_database(),'app',current_setting('application_name'),
 'g38Auto',EXISTS(SELECT 1 FROM pg_trigger WHERE
  tgrelid='public.mobility_stage_auto_demo_trips'::regclass AND
  tgname='mobility_stage_g38_auto_acceptance' AND tgenabled IN('O','A')),
 'g38Delivery',EXISTS(SELECT 1 FROM pg_trigger WHERE
  tgrelid='public.mobility_stage_deliveries'::regclass AND
  tgname='mobility_stage_g38_delivery_acceptance' AND tgenabled IN('O','A')),
 'autoTriggerBypass',(SELECT count(*)::int FROM pg_trigger
  WHERE tgrelid IN(
   'public.mobility_stage_auto_demo_trips'::regclass,
   'public.mobility_stage_auto_demo_offers'::regclass)
   AND NOT tgisinternal AND tgenabled NOT IN('O','A')),
 'authorizedSyntheticZones',(SELECT count(*)::int FROM
  public.mobility_stage_g31_zone_coverage WHERE eligible_by_policy),
 'municipalAuthorizedMotoZones',(SELECT count(*)::int FROM
  public.mobility_stage_g118_moto_legal_zones WHERE independently_authorized),
 'unauthorizedQaTableRead',has_table_privilege('authenticated',
  'public.mobility_stage_g224_fresh_rides_ci','SELECT'))::text`);
}
function originalIds(){
 return json(`SELECT jsonb_agg(original_service_id::text
  ORDER BY position)::text FROM
  public.mobility_stage_g223_original_manifest_ci`);
}
function originalSourceStates(){
 return json(`SELECT jsonb_agg(jsonb_build_object(
 'serviceKind',s.service_kind,'id',s.original_service_id,
 'state',s.state_at_capture,
 'current',CASE s.service_kind WHEN 'AUTO_RIDE' THEN
 (SELECT status::text FROM public.mobility_stage_auto_demo_trips
  WHERE id=s.original_service_id)
 WHEN 'MOTO_RIDE' THEN
 (SELECT status::text FROM public.mobility_stage_g100_moto_trips
  WHERE id=s.original_service_id)
 WHEN 'COMMERCE' THEN
 (SELECT status::text FROM public.mobility_stage_merchant_orders
  WHERE id=s.original_service_id)
 ELSE
 (SELECT status::text FROM public.mobility_stage_deliveries
  WHERE id=s.original_service_id) END)
 ORDER BY position)::text
 FROM public.mobility_stage_g223_original_manifest_ci s`);
}
function main(){
 localOnly();
 const original=JSON.parse(readFileSync('/tmp/qore-g215-five-journey-e2e-readiness.json','utf8'));
 assert.equal(original.qaJourneysCompleted,0);
 const run=spawnSync('psql',['-X','-v','ON_ERROR_STOP=1','-f',sqlfile],{
  encoding:'utf8',timeout:60000,maxBuffer:3000000
 });
 if(run.error)throw run.error;
 assert.equal(run.status,0,'G224 SQL failed: '+String(run.stderr).slice(-4500));
 const logs=run.stdout+'\n'+run.stderr;
 assert(logs.includes('G224 PASS AUTO_RIDE'));
 assert(logs.includes('G224 PASS MOTO_RIDE'));
 const rows=queryRows();
 const ids=originalIds();
 const adm=psql("SELECT user_id::text FROM public.mobility_stage_backoffice_roles "+
  "WHERE role='admin' AND status='active' "+
  "AND public.mobility_stage_g27_backoffice_role_of(user_id)='admin' "+
  "ORDER BY user_id LIMIT 1");
 assert(uuid.test(adm));
 const receipts=rows.map(row=>json('SET ROLE service_role; SELECT public.'+
  (row.serviceKind==='AUTO_RIDE'?'mobility_stage_g138_auto_trace_qa':
   'mobility_stage_g142_moto_trace_qa')+
  '('+U(adm)+','+U(row.originalTripId)+')::text'));
 const guard=guards();
 validateIndependentReceipts(rows,receipts,ids,guard);
 const stateReadback=originalSourceStates();
 assert.equal(stateReadback.length,5);
 for(const s of stateReadback)assert.equal(s.state,s.current,
  'G224 altered G223 original source '+s.serviceKind);
 const output={
  name:'G224_TWO_FRESH_ORIGINAL_PASSENGER_RIDES_COMMITTED_QA',
  mode:'ISOLATED_DISPOSABLE_POSTGRES16_ONLY',verdict:'TWO_FRESH_QA_RIDES_PERSISTED',
  freshOriginalPassengerRidesCompletedAndCommitted:2,
  independentAdminReadbacks:2,
  unchangedG223HistoricalSourceIds:5,
  historicalG215FiveJourneysClosed:original.qaJourneysCompleted,
  legalMunicipalGpsIdpPspCertified:0,
  acceptanceAuthority:'SYNTHETIC_QA_ONLY_NO_LEGAL_PROOF',
  productionEnabled:false,commercialLaunchAllowed:false,
  receipts:rows.map(x=>({serviceKind:x.serviceKind,
   tripId:x.originalTripId,originalBookingKey:x.originalBookingKey,
   adminStatus:'completed',originalFiveUnchanged:true}))
 };
 writeFileSync(out,JSON.stringify(output,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({name:output.name,verdict:output.verdict,
  freshOriginalPassengerRidesCompletedAndCommitted:2,
  historicalG215FiveJourneysClosed:original.qaJourneysCompleted}));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])main();
