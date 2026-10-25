-- G80 F1 same-trip positive KYC / negative legal-dispatch gate.
-- Uses PostgreSQL 16 disposable QA ONLY. Never creates real driver evidence,
-- certified legal zones, payable rides, LIVE eligibility or deployment.
DO $preflight$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g71_valid_locked_dossier(uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g73_book(uuid,uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g75_admin_f1_receipt(uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g38_acceptance_fence()') IS NULL
 THEN RAISE EXCEPTION 'G80 disposable QA prerequisites missing'; END IF;
 IF EXISTS(SELECT 1 FROM public.mobility_stage_g31_zone_coverage
  WHERE eligible_by_policy IS TRUE)
 THEN RAISE EXCEPTION 'G80 unexpectedly has legally dispatchable zone'; END IF;
END $preflight$;
BEGIN;
SET LOCAL statement_timeout='90s';
-- Existing G71 synthetic Driver + eight-category attestor fixture was
-- deliberately invalidated by the preceding expiry/replacement attack suite.
-- Model independently reattested LATEST source documents within a rollback
-- transaction; this is not a real document scan or a Driver onboarding.
UPDATE public.mobility_vehicles SET review_status='approved'
 WHERE id='71710000-0000-4717-8717-000000000101'::uuid
 AND driver_id='00000000-0000-4000-8000-000000000181'::uuid;
WITH latest AS (
 SELECT DISTINCT ON (kind) kind::text AS kind, id
 FROM public.mobility_stage_driver_documents
 WHERE driver_id='00000000-0000-4000-8000-000000000181'::uuid
 ORDER BY kind,submitted_at DESC,id DESC
)
UPDATE public.mobility_stage_kyc_verified_evidence_qa e
SET source_document_id=latest.id,
 valid_until=pg_catalog.clock_timestamp()+interval '7 days',
 authenticity_verified=true,issuer_verified=true,malware_scan_passed=true,
 evidence_revision=e.evidence_revision+1,
 consent_for_face=CASE WHEN e.kind='rostro_selfie' THEN true ELSE false END,
 photo_received=CASE WHEN e.kind='rostro_selfie' THEN true ELSE false END,
 liveness_verified=CASE WHEN e.kind='rostro_selfie' THEN true ELSE false END,
 id_face_match_verified=CASE WHEN e.kind='rostro_selfie' THEN true ELSE false END
FROM latest
WHERE e.driver_id='00000000-0000-4000-8000-000000000181'::uuid
 AND e.vehicle_id='71710000-0000-4717-8717-000000000101'::uuid
 AND e.kind=latest.kind;
DO $verify_eight$
DECLARE
 d uuid:='00000000-0000-4000-8000-000000000181';
 v uuid:='71710000-0000-4717-8717-000000000101';
 BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_kyc_verified_evidence_qa
  WHERE driver_id=d AND vehicle_id=v)<>8
 OR NOT public.mobility_stage_g71_valid_locked_dossier(d,v)
 THEN RAISE EXCEPTION 'G80 synthetic latest eight documents not reverified'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_kyc_onboarding_decisions_qa
  WHERE driver_id=d AND vehicle_id=v
  AND decision='QA_ONBOARDING_APPROVED_NOT_COMMERCIAL')<>1
 THEN RAISE EXCEPTION 'G80 synthetic onboarding decision missing'; END IF;
END $verify_eight$;
INSERT INTO auth.users(id) VALUES
 ('80800000-0000-4808-8808-000000000001'),
 ('80800000-0000-4808-8808-000000000002'),
 ('80800000-0000-4808-8808-000000000003');
DELETE FROM public.user_roles WHERE user_id IN (
 '80800000-0000-4808-8808-000000000002'::uuid,
 '80800000-0000-4808-8808-000000000003'::uuid);
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
 VALUES('80800000-0000-4808-8808-000000000002','admin','active',
  '80800000-0000-4808-8808-000000000003');
SET LOCAL ROLE service_role;
DO $ride$
DECLARE
 passenger uuid:='80800000-0000-4808-8808-000000000001';
 administrator uuid:='80800000-0000-4808-8808-000000000002';
 driver uuid:='00000000-0000-4000-8000-000000000181';
 vehicle uuid:='71710000-0000-4717-8717-000000000101';
 route_key uuid:='80800000-0000-4808-8808-000000000010';
 quote_key uuid:='80800000-0000-4808-8808-000000000011';
 book_key uuid:='80800000-0000-4808-8808-000000000012';
 route_id uuid;quote_id uuid;trip_id uuid;receipt jsonb;
 initial_price bigint;denied boolean:=false;current_revision integer;
BEGIN
 route_id:=public.mobility_stage_g73_route(passenger,route_key,'economico',
  'CENTRO_FIXTURE','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 quote_id:=public.mobility_stage_g73_quote(passenger,route_id,quote_key);
 trip_id:=public.mobility_stage_g73_book(passenger,quote_id,book_key);
 receipt:=public.mobility_stage_g75_admin_f1_receipt(administrator,trip_id);
 initial_price:=(receipt->>'amountGs')::bigint;
 IF initial_price<=0 OR receipt->>'status'<>'searching'
 OR receipt->>'tripId'<>trip_id::text OR receipt->>'routeId'<>route_id::text
 OR receipt->>'quoteId'<>quote_id::text
 THEN RAISE EXCEPTION 'G80 F1 same-trip Admin baseline missing'; END IF;
 -- A current synthetic eight-doc dossier is NOT a legal-zone permission.
 -- The G38 trigger must refuse direct assignment, regardless of KYC.
 BEGIN
  UPDATE public.mobility_stage_auto_demo_trips
   SET driver_id=driver,vehicle_id=vehicle,
       status='accepted',revision=revision+1
   WHERE id=trip_id AND status='searching';
 EXCEPTION WHEN SQLSTATE 'G3801' THEN denied:=true; END;
 IF NOT denied THEN
  RAISE EXCEPTION 'G80 G38 accepted synthetic KYC without legal zone'; END IF;
 receipt:=public.mobility_stage_g75_admin_f1_receipt(administrator,trip_id);
 IF receipt->>'status'<>'searching'
 OR receipt->>'driverId' IS NOT NULL
 OR receipt->>'assignmentPersisted'<>'false'
 OR receipt->>'revision'<>'1'
 OR receipt->>'tripId'<>trip_id::text
 OR receipt->>'routeId'<>route_id::text
 OR receipt->>'quoteId'<>quote_id::text
 OR (receipt->>'amountGs')::bigint<>initial_price
 OR public.mobility_stage_g73_book(passenger,quote_id,book_key)<>trip_id
 OR (SELECT count(*) FROM public.mobility_stage_auto_demo_trips
  WHERE passenger_id=passenger AND request_key=book_key)<>1
 OR EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_events
  WHERE trip_id=trip_id)
 THEN RAISE EXCEPTION 'G80 legally blocked assignment changed same F1 ride'; END IF;
 RAISE NOTICE 'G80 PASS: 8 verified synthetic KYC docs, but legal G38 blocks Driver; same Client/Admin trip and fare intact';
END $ride$;
RESET ROLE;
ROLLBACK;
