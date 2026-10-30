/**
 * G223 — Durable five-original-source evidence, in disposable PostgreSQL16.
 *
 * Capture is committed, then verification runs in a NEW psql connection after
 * G220 has performed ROLLBACK-only simulations. This does NOT complete trips,
 * grant an offer, verify identity/GPS/legal/PSP, or certify LIVE readiness.
 * G215 continues to own the truthful completed-source count.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const G223_KINDS=Object.freeze([
 'AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE'
]);
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const sourceFile='/tmp/qore-g202-five-original-journeys-qa.json';
const gapFile='/tmp/qore-g215-five-journey-e2e-readiness.json';
const outputFile='/tmp/qore-g223-persisted-original-id-audit.json';

export function validatedManifest(sources,readiness){
 assert.equal(sources.mode,'STAGING_DEMO_ONLY');
 assert.equal(sources.productionEnabled,false);
 assert.equal(sources.originalPostgresAndAdminReceipts,5);
 assert.equal(readiness.mode,'ISOLATED_DISPOSABLE_POSTGRES16');
 assert.equal(readiness.productionEnabled,false);
 assert.equal(readiness.sourceAndAdminOriginalCount,5);
 assert.equal(readiness.externallyCertifiedJourneys,0);
 assert.equal(readiness.commercialLaunchAllowed,false);
 assert.equal(readiness.qaJourneysCompleted+readiness.qaJourneysStillOpen,5);
 assert.deepEqual(sources.services.map(x=>x.serviceKind),G223_KINDS);
 assert.deepEqual(readiness.services.map(x=>x.serviceKind),G223_KINDS);
 const ids=new Set(),requests=new Set(),items=[];
 for(let i=0;i<G223_KINDS.length;i++){
  const s=sources.services[i],g=readiness.services[i];
  assert(UUID.test(s.originalServiceId),'G223 source UUID absent');
  assert(UUID.test(s.originalRequestKey),'G223 booking UUID absent');
  assert(!ids.has(s.originalServiceId),'G223 repeated service ID');
  assert(!requests.has(s.originalRequestKey),'G223 repeated booking request');
  ids.add(s.originalServiceId);requests.add(s.originalRequestKey);
  assert.equal(s.clientToAdminSameOriginal,true);
  assert.equal(s.sourcePersisted,true);
  assert.equal(s.originalServiceId,g.originalServiceId,'G223 substituted service ID');
  assert.equal(s.originalRequestKey,g.originalRequestKey,'G223 substituted booking key');
  assert.equal(s.status,g.status,'G223 source state drift');
  assert.equal(s.commercialEndToEndComplete,false);
  assert.equal(g.commercialEndToEndCertified,false);
  assert.equal(g.qaJourneyClosed,g.missingQaSteps.length===0);
  assert(typeof s.status==='string'&&/^[a-z_]+$/.test(s.status));
  const linkedDeliveryId=s.serviceKind==='COMMERCE'?s.linkedCommerceDeliveryId:null;
  if(s.serviceKind==='COMMERCE')assert(UUID.test(linkedDeliveryId));
  items.push({
   serviceKind:s.serviceKind,originalServiceId:s.originalServiceId,
   originalRequestKey:s.originalRequestKey,
   stateAtCapture:s.status,linkedCommerceDeliveryId:linkedDeliveryId??null
  });
 }
 assert.equal(readiness.services.filter(x=>x.qaJourneyClosed).length,
  readiness.qaJourneysCompleted,'G223 count mismatches G215 sources');
 return Object.freeze(items.map(x=>Object.freeze(x)));
}

export function digestManifest(items){
 return createHash('sha256').update(JSON.stringify(items)).digest('hex');
}

export function verifyCheckpoint({expected,dbRows,postReadbacks,guard}){
 assert.deepEqual(dbRows,expected,'G223 committed ledger changed after ROLLBACK');
 assert.equal(postReadbacks.length,5);
 assert.equal(guard.db,'qore_disposable_chain');
 assert.equal(guard.app,'qore_ci_disposable_chain');
 assert.equal(guard.g38Auto,true,'G223 G38 AUTO trigger inactive');
 assert.equal(guard.g38Delivery,true,'G223 G38 delivery trigger inactive');
 assert.equal(guard.motoMunicipalAuthorized,0,'G223 fake MOTO municipal authorization');
 assert.equal(guard.eligibleZoneCount,0,'G223 synthetic G38 zone became legally eligible');
 assert.equal(guard.syntheticActorsPersisted,0,'G223 rollback fixture leaked to auth.users');
 assert.equal(guard.serviceRoleCanWriteManifest,false,'G223 private ledger writable');
 for(let i=0;i<expected.length;i++){
  const source=expected[i],readback=postReadbacks[i];
  assert.equal(readback.serviceKind,source.serviceKind);
  assert.equal(readback.serviceId,source.originalServiceId);
  assert.equal(readback.bookingRequestKey,source.originalRequestKey);
  assert.equal(readback.status,source.stateAtCapture);
  assert.equal(readback.mode,'STAGING_DEMO_ONLY');
  assert.equal(readback.serverPersisted,true);
  assert.equal(readback.productionEnabled,false);
 }
 return true;
}
function guardLocal(){
 if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
  process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
  process.env.PGAPPNAME!=='qore_ci_disposable_chain')
  throw Error('G223 refuses non-disposable PostgreSQL (never remote/LIVE)');
}
function psql(statement){
 const out=execFileSync('psql',['-X','-q','-A','-t',
  '-v','ON_ERROR_STOP=1','-c',statement],{
  encoding:'utf8',timeout:30000,maxBuffer:400000
 });
 return out.trim().split('\n').at(-1)?.trim()??'';
}
function sqlJson(statement){
 const raw=psql(statement);
 return raw&&raw!=='null'?JSON.parse(raw):null;
}
function literal(s){
 assert(typeof s==='string');
 return "'"+s.replaceAll("'","''")+"'";
}
function quotedUuid(s){
 assert(UUID.test(s));return literal(s)+'::uuid';
}
const ADMIN_SQL="SELECT user_id::text FROM public.mobility_stage_backoffice_roles "+
 "WHERE role='admin' AND status='active' "+
 "AND public.mobility_stage_g27_backoffice_role_of(user_id)='admin' "+
 "ORDER BY user_id LIMIT 1";
function manifestQuery(){
 return "SELECT COALESCE(jsonb_agg(jsonb_build_object("+
  "'serviceKind',service_kind,"+
  "'originalServiceId',original_service_id::text,"+
  "'originalRequestKey',original_request_key::text,"+
  "'stateAtCapture',state_at_capture,"+
  "'linkedCommerceDeliveryId',linked_delivery_id::text)"+
  " ORDER BY position),'[]'::jsonb)::text "+
  "FROM public.mobility_stage_g223_original_manifest_ci";
}
function createLedger(items,digest){
 const values=items.map((s,i)=>'('+(i+1)+','+literal(s.serviceKind)+','+
  quotedUuid(s.originalServiceId)+','+quotedUuid(s.originalRequestKey)+','+
  literal(s.stateAtCapture)+','+
  (s.linkedCommerceDeliveryId?quotedUuid(s.linkedCommerceDeliveryId):'NULL')+','+
  literal(digest)+')').join(',\n');
 const script=`
BEGIN;
DO \$guard\$ BEGIN
 IF current_database()<>'qore_disposable_chain' OR
 current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G223 is disposable only'; END IF;
END \$guard\$;
CREATE TABLE public.mobility_stage_g223_original_manifest_ci (
 position integer PRIMARY KEY CHECK(position BETWEEN 1 AND 5),
 service_kind text NOT NULL UNIQUE CHECK(service_kind IN
 ('AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE')),
 original_service_id uuid NOT NULL UNIQUE,
 original_request_key uuid NOT NULL UNIQUE,
 state_at_capture text NOT NULL,
 linked_delivery_id uuid,
 digest_sha256 text NOT NULL CHECK(digest_sha256 ~ '^[0-9a-f]{64}$'),
 captured_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.mobility_stage_g223_original_manifest_ci ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g223_original_manifest_ci
 FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mobility_stage_g223_immutable_ci()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS \$body\$
BEGIN
 RAISE EXCEPTION 'G223 committed original-source manifest is immutable';
END \$body\$;
REVOKE ALL ON FUNCTION public.mobility_stage_g223_immutable_ci()
 FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER mobility_stage_g223_no_update
 BEFORE UPDATE OR DELETE ON public.mobility_stage_g223_original_manifest_ci
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g223_immutable_ci();
INSERT INTO public.mobility_stage_g223_original_manifest_ci(
 position,service_kind,original_service_id,original_request_key,
 state_at_capture,linked_delivery_id,digest_sha256)
VALUES ${values};
DO \$verify\$ BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_g223_original_manifest_ci)<>5
 OR (SELECT count(DISTINCT digest_sha256)
     FROM public.mobility_stage_g223_original_manifest_ci)<>1
 THEN RAISE EXCEPTION 'G223 five original IDs not durably recorded'; END IF;
END \$verify\$;
COMMIT;`;
 psql(script);
}
function readback(kind,id,admin){
 const fn=kind==='AUTO_RIDE'?'mobility_stage_g138_auto_trace_qa':
  kind==='MOTO_RIDE'?'mobility_stage_g142_moto_trace_qa':
  kind==='COMMERCE'?'mobility_stage_g146_commerce_trace_qa':
  'mobility_stage_g145_delivery_trace_qa';
 return sqlJson('SET ROLE service_role; SELECT public.'+fn+
  '('+quotedUuid(admin)+','+quotedUuid(id)+')::text');
}
function inspectGuards(){
 return sqlJson(`SELECT jsonb_build_object(
 'db',current_database(),'app',current_setting('application_name'),
 'g38Auto',EXISTS(SELECT 1 FROM pg_trigger WHERE
 tgrelid='public.mobility_stage_auto_demo_trips'::regclass AND
 tgname='mobility_stage_g38_auto_acceptance' AND tgenabled IN('O','A')),
 'g38Delivery',EXISTS(SELECT 1 FROM pg_trigger WHERE
 tgrelid='public.mobility_stage_deliveries'::regclass AND
 tgname='mobility_stage_g38_delivery_acceptance' AND tgenabled IN('O','A')),
 'motoMunicipalAuthorized',(SELECT count(*)::int FROM
 public.mobility_stage_g118_moto_legal_zones WHERE independently_authorized),
 'eligibleZoneCount',(SELECT count(*)::int FROM
 public.mobility_stage_g31_zone_coverage WHERE eligible_by_policy),
 'syntheticActorsPersisted',(SELECT count(*)::int FROM auth.users
 WHERE left(id::text,8) IN ('21600000','21800000','21900000','22000000')),
 'serviceRoleCanWriteManifest',has_table_privilege('service_role',
 'public.mobility_stage_g223_original_manifest_ci','INSERT'))::text`);
}
function main(){
 guardLocal();
 const sources=JSON.parse(readFileSync(sourceFile,'utf8'));
 const readiness=JSON.parse(readFileSync(gapFile,'utf8'));
 const items=validatedManifest(sources,readiness);
 const digest=digestManifest(items);
 const action=process.argv[2];
 if(action==='capture'){
  assert.equal(psql('SELECT current_database()'),'qore_disposable_chain');
  createLedger(items,digest);
  const actual=sqlJson(manifestQuery());
  assert.deepEqual(actual,items,'G223 capture differs from committed rows');
  console.log('G223 CAPTURE 5/5 original IDs committed in disposable PG16; completion unchanged');
  return;
 }
 if(action!=='verify')throw Error('Usage: g223-original-id-ledger-pg-ci.mjs capture|verify');
 const rows=sqlJson(manifestQuery());
 const stored=psql('SELECT min(digest_sha256) FROM public.mobility_stage_g223_original_manifest_ci');
 assert.equal(stored,digest);
 const admin=psql(ADMIN_SQL);
 assert(UUID.test(admin),'G223 independent Admin identity missing');
 const readbacks=items.map(s=>readback(s.serviceKind,s.originalServiceId,admin));
 verifyCheckpoint({expected:items,dbRows:rows,postReadbacks:readbacks,
  guard:inspectGuards()});
 const report={
  name:'G223_FIVE_ORIGINAL_IDS_CROSS_SESSION_PERSISTENCE',
  mode:'DISPOSABLE_PG16_ONLY',
  manifestSha256:digest,
  verifiedOriginalSources:5,
  verifiedReadbacksAfterG220Rollback:5,
  sourceStateUnchangedAfterRollback:true,
  qaJourneysCompleted:readiness.qaJourneysCompleted,
  externalIdentitiesLegalGpsPspCertified:0,
  productionEnabled:false,commercialLaunchAllowed:false,
  verdict:'ORIGINAL_IDENTITY_PERSISTENCE_PROVEN_NO_QA_COMPLETION_CLAIM',
  originalIds:items
 };
 writeFileSync(outputFile,JSON.stringify(report,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({name:report.name,verdict:report.verdict,
  verifiedOriginalSources:5,qaJourneysCompleted:report.qaJourneysCompleted}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 main();
