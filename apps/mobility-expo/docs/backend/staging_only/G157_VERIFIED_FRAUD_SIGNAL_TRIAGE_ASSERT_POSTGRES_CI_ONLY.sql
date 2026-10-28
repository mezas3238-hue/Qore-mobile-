-- G157 on SAME genuine G155 Buyer HTTP/PG16 delivery rating, not fake alerts.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g157_admin_review_queue_qa(uuid,integer)') IS NULL
 THEN RAISE EXCEPTION 'G157 disposable review workflow required'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='30s';
DO $baseline$
DECLARE report_count int; all_reviews int; x record;
BEGIN
 SELECT count(*) INTO report_count FROM public.mobility_stage_g157_fraud_signals;
 SELECT count(*) INTO all_reviews FROM public.mobility_stage_g155_verified_ratings;
 IF report_count<>1 OR all_reviews<>4
 THEN RAISE EXCEPTION 'G157 must inherit one genuine alleged fraud report from four G155 reviews, found %, %',
  report_count,all_reviews; END IF;
 IF EXISTS(
  SELECT 1 FROM public.mobility_stage_g157_fraud_signals s
  LEFT JOIN public.mobility_stage_g155_verified_ratings r ON r.id=s.source_rating_id
  WHERE r.id IS NULL OR r.rated_kind<>s.rated_kind OR r.rated_id<>s.rated_id
   OR r.service_kind<>s.service_kind OR r.service_id<>s.service_id
   OR r.reviewer_id<>s.reporter_id
   OR r.incident_code NOT IN('SUSPECTED_FRAUD','SAFETY')
 ) THEN RAISE EXCEPTION 'G157 source provenance is forged'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.mobility_stage_g157_fraud_signals s
  JOIN public.mobility_stage_g155_verified_ratings r ON r.id=s.source_rating_id
  JOIN public.mobility_stage_deliveries d ON d.id=r.service_id
  JOIN public.mobility_stage_g67_delivery_proofs p
   ON p.delivery_id=d.id AND p.proof_ref=d.proof_ref
   AND p.courier_id=d.courier_id
  WHERE r.incident_code='SUSPECTED_FRAUD'
   AND r.service_kind='DELIVERY_AUTO' AND r.rated_kind='COURIER'
   AND d.status='delivered' AND p.consumed_at IS NOT NULL
   AND p.revoked_at IS NULL
 ) THEN RAISE EXCEPTION 'G157 original G67 cargo proof not bound'; END IF;
 IF EXISTS(
  SELECT 1 FROM public.mobility_stage_g157_fraud_signals s
  JOIN public.mobility_stage_g155_verified_ratings r ON r.id=s.source_rating_id
  WHERE r.incident_code IS NULL OR r.incident_code='OTHER')
 THEN RAISE EXCEPTION 'G157 incorrectly treats ordinary star ratings as fraud'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger
  WHERE tgrelid='public.mobility_stage_g155_verified_ratings'::regclass
   AND tgname='mobility_stage_g157_verified_rating_signal' AND tgenabled='O')
 THEN RAISE EXCEPTION 'G157 new verified signals are not automatically captured'; END IF;
END $baseline$;

-- Fixture admin identity is isolated in rollback; never a production grant.
INSERT INTO auth.users(id) VALUES
 ('15700000-0000-4157-8157-000000000001'),
 ('15700000-0000-4157-8157-000000000002')
ON CONFLICT DO NOTHING;
DELETE FROM public.user_roles
 WHERE user_id IN ('15700000-0000-4157-8157-000000000001',
                   '15700000-0000-4157-8157-000000000002');
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
VALUES
 ('15700000-0000-4157-8157-000000000001','admin','active',
  '00000000-0000-4000-8000-000000000101'),
 ('15700000-0000-4157-8157-000000000002','owner','active',
  '00000000-0000-4000-8000-000000000101');

DO $deny$
BEGIN
 IF has_table_privilege('anon','public.mobility_stage_g157_fraud_signals','SELECT')
 OR has_table_privilege('authenticated','public.mobility_stage_g157_fraud_signals','SELECT')
 OR has_table_privilege('service_role','public.mobility_stage_g157_fraud_signals','SELECT')
 OR has_table_privilege('authenticated','public.mobility_stage_g157_fraud_signals','INSERT')
 OR has_table_privilege('service_role','public.mobility_stage_g157_fraud_signals','UPDATE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g157_admin_review_queue_qa(uuid,integer)','EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_stage_g157_capture_verified_report()','EXECUTE')
 OR has_function_privilege('service_role',
  'public.mobility_stage_g157_capture_verified_report()','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.mobility_stage_g157_admin_review_queue_qa(uuid,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'G157 signal table/trigger/admin grants leaked'; END IF;
END $deny$;

SET LOCAL ROLE service_role;
DO $admin$
DECLARE data jsonb; blocked boolean:=false; row0 jsonb;
BEGIN
 data:=public.mobility_stage_g157_admin_review_queue_qa(
  '15700000-0000-4157-8157-000000000001',50);
 IF data->>'qaOnly'<>'true' OR data->>'productionEnabled'<>'false'
 OR data->>'automaticSuspension'<>'false'
 OR data->>'dispatchPenaltyApplied'<>'false'
 OR data->>'findingEstablished'<>'false'
 OR pg_catalog.jsonb_array_length(data->'items')<>1
 THEN RAISE EXCEPTION 'G157 Admin output must be private no-punishment QA'; END IF;
 row0:=data->'items'->0;
 IF row0->>'ratedKind'<>'COURIER'
 OR row0->>'reviewTier'<>'SINGLE_SOURCE_REVIEW'
 OR (row0->>'recentReports')::int<>1
 OR (row0->>'independentReporters')::int<>1
 OR (row0->>'distinctServices')::int<>1
 OR row0->>'allegationOnly'<>'true'
 THEN RAISE EXCEPTION 'G157 one G67 rating must not become confirmed fraud'; END IF;
 IF data::text LIKE '%reporterId%' OR data::text LIKE '%stars%'
  OR data::text LIKE '%SUSPECTED_FRAUD%' OR data::text LIKE '%token%'
 THEN RAISE EXCEPTION 'G157 private reporter information leaked'; END IF;
 BEGIN
  PERFORM public.mobility_stage_g157_admin_review_queue_qa(
   '15700000-0000-4157-8157-000000000002',50);
 EXCEPTION WHEN SQLSTATE 'P1572' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G157 Owner cannot impersonate Admin'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_g157_admin_review_queue_qa(
   'b6670000-0000-4667-8667-000000000001',50);
 EXCEPTION WHEN SQLSTATE 'P1572' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G157 reporter cannot see investigation queue'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_g157_admin_review_queue_qa(
   '15700000-0000-4157-8157-000000000001',1);
 EXCEPTION WHEN SQLSTATE 'P1572' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G157 unbounded queue bypass'; END IF;
END $admin$;
RESET ROLE;
ROLLBACK;
DO $done$ BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_g157_fraud_signals)<>1
 THEN RAISE EXCEPTION 'G157 test accidentally mutated real verified alerts'; END IF;
 RAISE NOTICE 'G157 PASS: original completed G67 cargo -> G155 real Buyer report -> private Admin-only fraud review; no PII, fabricated signal, rating sanctions or auto-dispatch punishment';
END $done$;
