/**
 * G225: disposable-CI COMMIT three original G223 cargo/commerce sources,
 * then independent private Admin readback in fresh PostgreSQL sessions.
 * G224 has committed two DIFFERENT fresh passenger booking originals.
 * Synthetic acceptance is not municipal/real-world authorization.
 */
import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const D='apps/mobility-expo/docs/backend/staging_only/';
const files=[
 D+'G225_COMMITTED_G122_CARGO_TWO_ORIGINALS_DISPOSABLE_ONLY.sql',
 D+'G225_COMMITTED_G150_COMMERCE_DELIVERY_DISPOSABLE_ONLY.sql'
];
export function verifyThreeCompleted({sources,cargoRows,commerceRows,
 cargoProofs,commerceProof,linkedCargoProof,guard,rides}){
 const byKind=Object.fromEntries(sources.map(x=>[x.serviceKind,x]));
 assert.equal(sources.length,5);
 assert.deepEqual(cargoRows.map(x=>x.serviceKind),
  ['DELIVERY_AUTO','DELIVERY_MOTO']);
 assert.equal(cargoRows.length,2);
 assert.equal(commerceRows.length,1);
 assert.equal(rides.length,2);
 assert.deepEqual(rides.map(x=>x.serviceKind),['AUTO_RIDE','MOTO_RIDE']);
 assert.equal(guard.db,'qore_disposable_chain');
 assert.equal(guard.app,'qore_ci_disposable_chain');
 assert.equal(guard.g38Auto,true);
 assert.equal(guard.g38Delivery,true);
 assert.equal(guard.deliveryTriggersDisabled,0);
 assert.equal(guard.authorizedSyntheticZones,0);
 assert.equal(guard.municipalMotoAuthorized,0);
 assert.equal(guard.authenticatedCanRead,false);
 const initialStates=['requested','requested'];
 for(let i=0;i<2;i++){
  const row=cargoRows[i],src=byKind[row.serviceKind],trace=cargoProofs[i];
  assert(src&&trace,'G225 cargo original and Admin missing');
  assert(UUID.test(row.originalServiceId));
  assert.equal(src.originalServiceId,row.originalServiceId);
  assert.equal(src.originalRequestKey,row.originalRequestKey);
  assert.equal(src.status,initialStates[i]);
  assert.equal(row.simulatedOfferAuthority,'SYNTHETIC_QA_ONLY_NO_LEGAL_PROOF');
  assert.equal(row.productionEnabled,false);
  assert.equal(trace.serviceKind,row.serviceKind);
  assert.equal(trace.serviceId,row.originalServiceId);
  assert.equal(trace.bookingRequestKey,row.originalRequestKey);
  assert.equal(trace.status,'delivered');
  assert.equal(trace.revision,4);
  assert.equal(trace.serverPersisted,true);
  assert.equal(trace.productionEnabled,false);
  assert.equal(trace.assignment?.state,'QA_COMPLETED');
  assert.equal(trace.assignment?.legalGate,'EXTERNAL_NOT_CERTIFIED');
  assert.equal(trace.ledger,null);
  assert.deepEqual(trace.events.map(x=>x.status),
   ['requested','accepted','picked_up','delivered']);
 }
 const com=commerceRows[0],src=byKind.COMMERCE,trace=commerceProof;
 assert.equal(com.originalOrderId,src.originalServiceId);
 assert.equal(com.originalOrderRequestKey,src.originalRequestKey);
 assert.equal(com.originalDeliveryId,src.linkedCommerceDeliveryId);
 assert.equal(com.simulatedOfferAuthority,'SYNTHETIC_QA_ONLY_NO_LEGAL_PROOF');
 assert.equal(com.productionEnabled,false);
 assert.equal(src.status,'ready');
 assert.equal(trace.serviceId,com.originalOrderId);
 assert.equal(trace.bookingRequestKey,com.originalOrderRequestKey);
 assert.equal(trace.deliveryId,com.originalDeliveryId);
 assert.equal(trace.status,'ready');
 assert.equal(trace.revision,5);
 assert.equal(trace.serverPersisted,true);
 assert.equal(trace.productionEnabled,false);
 assert.equal(trace.assignment?.state,'NOT_ASSIGNABLE');
 assert.equal(trace.assignment?.legalGate,'G38_BLOCKED');
 assert.equal(trace.ledger,null);
 assert.equal(linkedCargoProof.serviceKind,'DELIVERY_MOTO');
 assert.equal(linkedCargoProof.serviceId,com.originalDeliveryId);
 assert.equal(linkedCargoProof.bookingRequestKey,com.originalDeliveryRequestKey);
 assert.equal(linkedCargoProof.status,'delivered');
 assert.equal(linkedCargoProof.revision,4);
 assert.equal(linkedCargoProof.assignment?.state,'QA_COMPLETED');
 assert.equal(linkedCargoProof.productionEnabled,false);
 assert.deepEqual(linkedCargoProof.events.map(x=>x.status),
  ['requested','accepted','picked_up','delivered']);
 const allIds=[...rides.map(x=>x.originalTripId),
  ...cargoRows.map(x=>x.originalServiceId),com.originalOrderId];
 assert.equal(new Set(allIds).size,5,'G225 duplicate source or replacement');
 return true;
}
function assertLocal(){
 if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G225 refuses remote/non-disposable database');
}
function run(q){
 return execFileSync('psql',['-X','-q','-A','-t',
  '-v','ON_ERROR_STOP=1','-c',q],{
  encoding:'utf8',timeout:30000,maxBuffer:700000
 }).trim().split('\n').at(-1)?.trim();
}
function j(q){const x=run(q);return x&&x!=='null'?JSON.parse(x):null;}
function u(s){assert(UUID.test(s));return "'"+s+"'::uuid";}
function readAdmin(admin,source,kind){
 const fn=kind==='COMMERCE'?'mobility_stage_g146_commerce_trace_qa':
  'mobility_stage_g216_completed_delivery_trace_qa';
 return j('SET ROLE service_role; SELECT public.'+fn+
  '('+u(admin)+','+u(source)+')::text');
}
function orderedRows(table,columns,order){
 return j('SELECT COALESCE(jsonb_agg(jsonb_build_object('+
  columns.map(([name,col])=>"'"+name+"',"+col).join(',')+
  ') ORDER BY '+order+'),'+"'[]'::jsonb)::text FROM public."+table);
}
function guard(){
 return j(`SELECT jsonb_build_object(
 'db',current_database(),'app',current_setting('application_name'),
 'g38Auto',EXISTS(SELECT 1 FROM pg_trigger WHERE
 tgrelid='public.mobility_stage_auto_demo_trips'::regclass AND
 tgname='mobility_stage_g38_auto_acceptance' AND tgenabled IN('O','A')),
 'g38Delivery',EXISTS(SELECT 1 FROM pg_trigger WHERE
 tgrelid='public.mobility_stage_deliveries'::regclass AND
 tgname='mobility_stage_g38_delivery_acceptance' AND tgenabled IN('O','A')),
 'deliveryTriggersDisabled',(SELECT count(*)::int FROM pg_trigger
 WHERE tgrelid IN('public.mobility_stage_delivery_offers'::regclass,
 'public.mobility_stage_deliveries'::regclass)
 AND NOT tgisinternal AND tgenabled NOT IN('O','A')),
 'authorizedSyntheticZones',(SELECT count(*)::int FROM
 public.mobility_stage_g31_zone_coverage WHERE eligible_by_policy),
 'municipalMotoAuthorized',(SELECT count(*)::int FROM
 public.mobility_stage_g118_moto_legal_zones WHERE independently_authorized),
 'authenticatedCanRead',
 has_table_privilege('authenticated',
  'public.mobility_stage_g225_cargo_receipts_ci','SELECT') OR
 has_table_privilege('authenticated',
  'public.mobility_stage_g225_commerce_receipt_ci','SELECT'))::text`);
}
function main(){
 assertLocal();
 const gaps=JSON.parse(readFileSync(
  '/tmp/qore-g215-five-journey-e2e-readiness.json','utf8'));
 assert.equal(gaps.qaJourneysCompleted,0);
 const sources=JSON.parse(readFileSync(
  '/tmp/qore-g202-five-original-journeys-qa.json','utf8')).services;
 const g224=JSON.parse(readFileSync(
  '/tmp/qore-g224-two-committed-qa-rides.json','utf8'));
 assert.equal(g224.freshOriginalPassengerRidesCompletedAndCommitted,2);
 for(const file of files){
  const cmd=spawnSync('psql',['-X','-v','ON_ERROR_STOP=1','-f',file],
   {encoding:'utf8',timeout:60000,maxBuffer:5000000});
  if(cmd.error)throw cmd.error;
  assert.equal(cmd.status,0,'G225 '+file+' failed: '+cmd.stderr.slice(-5000));
  console.log('G225 COMMIT '+file);
 }
 const cargoRows=orderedRows('mobility_stage_g225_cargo_receipts_ci',[
  ['serviceKind','service_kind'],['originalServiceId','original_service_id::text'],
  ['originalRequestKey','original_request_key::text'],
  ['simulatedOfferAuthority','simulated_offer_authority'],
  ['productionEnabled','production_enabled']
 ],'service_kind');
 const commerceRows=orderedRows('mobility_stage_g225_commerce_receipt_ci',[
  ['originalOrderId','original_order_id::text'],
  ['originalOrderRequestKey','original_order_request_key::text'],
  ['originalDeliveryId','original_delivery_id::text'],
  ['originalDeliveryRequestKey','original_delivery_request_key::text'],
  ['simulatedOfferAuthority','simulated_offer_authority'],
  ['productionEnabled','production_enabled']
 ],'service_kind');
 const admin=run("SELECT user_id::text FROM public.mobility_stage_backoffice_roles "+
  "WHERE role='admin' AND status='active' "+
  "AND public.mobility_stage_g27_backoffice_role_of(user_id)='admin' "+
  "ORDER BY user_id LIMIT 1");
 assert(UUID.test(admin));
 const cargoProofs=cargoRows.map(x=>readAdmin(admin,x.originalServiceId,'CARGO'));
 const com=commerceRows[0];
 const commerceProof=readAdmin(admin,com.originalOrderId,'COMMERCE');
 const linkedCargoProof=readAdmin(admin,com.originalDeliveryId,'CARGO');
 const rides=orderedRows('mobility_stage_g224_fresh_rides_ci',[
  ['serviceKind','service_kind'],
  ['originalTripId','original_trip_id::text']
 ],'service_kind');
 verifyThreeCompleted({sources,cargoRows,commerceRows,cargoProofs,
  commerceProof,linkedCargoProof,guard:guard(),rides});
 const result={
  name:'G225_FIVE_QA_ORIGINAL_JOURNEYS_COMMITTED_CROSS_SESSION',
  mode:'ISOLATED_DISPOSABLE_POSTGRES16_ONLY',
  verdict:'FIVE_QA_COMPLETED_TWO_FRESH_RIDES_THREE_HISTORIC_ORIGINALS',
  fiveDistinctOriginalIdsCommitted:5,
  twoFreshPassengerOriginsPersisted:2,
  threeG223OriginalCargoCommerceCompleted:3,
  olderG215PassengerSourcesStillOpenOrCancelled:2,
  originalG215PreMutationAuditClosed:0,
  independentAdminCompletedReceipts:5,
  legalMunicipalGpsIdpPspCertified:0,
  syntheticQaAcceptanceOnly:true,productionEnabled:false,
  commercialLaunchAllowed:false,
  sources:[...rides.map(s=>({kind:s.serviceKind,id:s.originalTripId,
   origin:'G224_NEW_CLIENT_BOOKING'})),
   ...cargoRows.map(s=>({kind:s.serviceKind,id:s.originalServiceId,
    origin:'G223_ORIGINAL_CLIENT_SOURCE'})),
   {kind:'COMMERCE',id:com.originalOrderId,
    origin:'G223_ORIGINAL_BUYER_ORDER'}]
 };
 writeFileSync('/tmp/qore-g225-five-committed-qa-originals.json',
  JSON.stringify(result,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({name:result.name,verdict:result.verdict,
  fiveDistinctOriginalIdsCommitted:5,
  threeG223OriginalCargoCommerceCompleted:3,
  commercialLaunchAllowed:false}));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])main();
