-- G81: Positive same-trip OFFER + negative cross-actor/expiry/acceptance.
-- The row is synthetic, no real coverage permit/valid location proof.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g81_offer_booked_auto(uuid,uuid,uuid,uuid,uuid,integer)') IS NULL
 THEN RAISE EXCEPTION 'G81 wrong DB or function missing'; END IF;
 IF has_function_privilege('anon',
   'public.mobility_stage_g81_offer_booked_auto(uuid,uuid,uuid,uuid,uuid,integer)','EXECUTE')
 OR has_function_privilege('authenticated',
   'public.mobility_stage_g81_offer_booked_auto(uuid,uuid,uuid,uuid,uuid,integer)','EXECUTE')
 OR NOT has_function_privilege('service_role',
   'public.mobility_stage_g81_offer_booked_auto(uuid,uuid,uuid,uuid,uuid,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'G81 wrong role grants'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='90s';
-- Restore eight latest QA-only source attestations (G71 tests deliberately
-- left insurance pending). This does NOT verify anyone's real documents.
UPDATE public.mobility_vehicles SET review_status='approved'
 WHERE id='71710000-0000-4717-8717-000000000101'::uuid
 AND driver_id='00000000-0000-4000-8000-000000000181'::uuid;
WITH latest AS (
 SELECT DISTINCT ON (kind) kind::text AS kind,id
 FROM public.mobility_stage_driver_documents
 WHERE driver_id='00000000-0000-4000-8000-000000000181'::uuid
 ORDER BY kind,submitted_at DESC,id DESC
)
UPDATE public.mobility_stage_kyc_verified_evidence_qa e
 SET source_document_id=latest.id,
 valid_until=pg_catalog.clock_timestamp()+interval '7 days',
 authenticity_verified=true,issuer_verified=true,malware_scan_passed=true,
 evidence_revision=e.evidence_revision+1,
 consent_for_face=(e.kind='rostro_selfie'),
 photo_received=(e.kind='rostro_selfie'),
 liveness_verified=(e.kind='rostro_selfie'),
 id_face_match_verified=(e.kind='rostro_selfie')
 FROM latest
 WHERE e.driver_id='00000000-0000-4000-8000-000000000181'::uuid
 AND e.vehicle_id='71710000-0000-4717-8717-000000000101'::uuid
 AND e.kind=latest.kind;
-- G71's new dossier vehicle is distinct from the G20 compliance-tested
-- vehicle. Copy ONLY pre-existing synthetic and independently reviewed
-- compliance metadata within this ROLLBACK transaction; never spoof a live
-- insurer, municipality, or passenger trip.
INSERT INTO public.mobility_vehicle_compliance(
 vehicle_id,registration_valid_through,registration_verified_at,
 insurance_valid_through,insurance_verified_at,
 paid_passenger_insurance_covered,
 inspection_valid_through,inspection_verified_at,
 municipal_authorization_valid_through,municipal_authorization_verified_at,
 moto_helmets_verified,moto_reflective_vests_verified,moto_routes_authorized,
 reviewed_by,reviewed_at)
SELECT '71710000-0000-4717-8717-000000000101'::uuid,
 registration_valid_through,registration_verified_at,
 insurance_valid_through,insurance_verified_at,paid_passenger_insurance_covered,
 inspection_valid_through,inspection_verified_at,
 municipal_authorization_valid_through,municipal_authorization_verified_at,
 moto_helmets_verified,moto_reflective_vests_verified,moto_routes_authorized,
 reviewed_by,reviewed_at
FROM public.mobility_vehicle_compliance
WHERE vehicle_id='00000000-0000-4000-8000-000000000184'::uuid;
-- Earlier tests left the newest G17 license review pending. Restore it
-- through the existing auditable Admin-only review RPC in disposable QA,
-- never by changing the server's preflight or granting extra SQL privileges.
DO $review$
DECLARE
 doc uuid;
 admin uuid:='00000000-0000-4000-8000-000000000101';
 driver uuid:='00000000-0000-4000-8000-000000000181';
BEGIN
 IF NOT public.mobility_stage_driver_current_license_approved(driver) THEN
  SELECT id INTO doc FROM public.mobility_stage_driver_documents
  WHERE driver_id=driver AND kind='licencia'
  ORDER BY submitted_at DESC,id DESC LIMIT 1;
  IF doc IS NULL THEN RAISE EXCEPTION 'G81 missing latest QA license'; END IF;
  PERFORM public.mobility_stage_review_driver_document(
    doc,admin,true,'DOCUMENT_VALID',
    '81810000-0000-4818-8818-000000000020');
 END IF;
END $review$;
-- The earlier G32/G34 adversarial suites may have disabled location
-- availability/consent. Re-opt this synthetic fixture into QA and refresh
-- its synthetic location explicitly; never apply to a real Driver account.
UPDATE public.mobility_location_consents
 SET opted_in_at=pg_catalog.clock_timestamp()-interval '5 minutes',
 revoked_at=NULL
 WHERE driver_id='00000000-0000-4000-8000-000000000181'::uuid;
UPDATE public.driver_locations
 SET available=true, updated_at=pg_catalog.clock_timestamp()
 WHERE driver_id='00000000-0000-4000-8000-000000000181'::uuid;
INSERT INTO auth.users(id) VALUES
 ('81810000-0000-4818-8818-000000000001'),
 ('81810000-0000-4818-8818-000000000002'),
 ('81810000-0000-4818-8818-000000000003');
DELETE FROM public.user_roles WHERE user_id IN (
 '81810000-0000-4818-8818-000000000002'::uuid,
 '81810000-0000-4818-8818-000000000003'::uuid);
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
 VALUES('81810000-0000-4818-8818-000000000002',
 'admin','active','81810000-0000-4818-8818-000000000003');
DO $data$
DECLARE p uuid:='81810000-0000-4818-8818-000000000001';
 d uuid:='00000000-0000-4000-8000-000000000181';
 v uuid:='71710000-0000-4717-8717-000000000101';
 r uuid;q uuid;t uuid;
BEGIN
 IF NOT public.mobility_stage_g71_valid_locked_dossier(d,v)
 OR NOT public.mobility_vehicle_preflight(d,v,'economico')
 THEN RAISE EXCEPTION 'G81 disposable Driver QA preflight fixture unavailable: dossier %, preflight %, license %, vehicle compliance %, consent %, location %',
 public.mobility_stage_g71_valid_locked_dossier(d,v),
 public.mobility_vehicle_preflight(d,v,'economico'),
 public.mobility_stage_driver_current_license_approved(d),
 EXISTS(SELECT 1 FROM public.mobility_vehicle_compliance WHERE vehicle_id=v),
 EXISTS(SELECT 1 FROM public.mobility_location_consents WHERE driver_id=d AND revoked_at IS NULL),
 EXISTS(SELECT 1 FROM public.driver_locations WHERE driver_id=d AND available AND updated_at>pg_catalog.clock_timestamp()-interval '120 seconds'); END IF;
 r:=public.mobility_stage_g73_route(p,
 '81810000-0000-4818-8818-000000000010','economico',
 'CENTRO_FIXTURE','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 q:=public.mobility_stage_g73_quote(p,r,
 '81810000-0000-4818-8818-000000000011');
 t:=public.mobility_stage_g73_book(p,q,
 '81810000-0000-4818-8818-000000000012');
 IF t IS NULL THEN RAISE EXCEPTION 'G81 no G73 persisted booking'; END IF;
END $data$;
SET LOCAL ROLE service_role;
DO $bound$
DECLARE
 p uuid:='81810000-0000-4818-8818-000000000001';
 stranger uuid:='81810000-0000-4818-8818-000000000003';
 d uuid:='00000000-0000-4000-8000-000000000181';
 v uuid:='71710000-0000-4717-8717-000000000101';
 b uuid:='81810000-0000-4818-8818-000000000012';
 k uuid:='81810000-0000-4818-8818-000000000013';
 o uuid;o2 uuid;denied boolean; admin_receipt jsonb;
BEGIN
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g81_offer_booked_auto(
   stranger,b,d,v,k,15);
 EXCEPTION WHEN SQLSTATE 'P8101' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G81 allowed cross-user passenger'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g81_offer_booked_auto(
   p,'81810000-0000-4818-8818-000000000099',d,v,k,15);
 EXCEPTION WHEN SQLSTATE 'P8101' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G81 accepted fabricated trip/booking'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g81_offer_booked_auto(
   p,b,stranger,v,k,15);
 EXCEPTION WHEN SQLSTATE 'P7401' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G81 bypassed 8-document Driver KYC'; END IF;
 o:=public.mobility_stage_g81_offer_booked_auto(p,b,d,v,k,15);
 o2:=public.mobility_stage_g81_offer_booked_auto(p,b,d,v,k,15);
 IF o IS NULL OR o<>o2 THEN RAISE EXCEPTION 'G81 offer replay duplicated'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g81_offer_booked_auto(
   p,b,d,v,k,18);
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G81 conflicting TTL replay accepted'; END IF;
 -- Existing G38 legal/geofence proof veto cannot be bypassed by a G81 offer.
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_accept_offer(
   o,d,'81810000-0000-4818-8818-000000000014');
 EXCEPTION WHEN SQLSTATE 'G3801' OR SQLSTATE 'G3601' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G81 offer bypassed G38 legal assignment block'; END IF;
END $bound$;
RESET ROLE;
DO $verify$
DECLARE p uuid:='81810000-0000-4818-8818-000000000001';
 admin uuid:='81810000-0000-4818-8818-000000000002';
 b uuid:='81810000-0000-4818-8818-000000000012';
 d uuid:='00000000-0000-4000-8000-000000000181';
 v uuid:='71710000-0000-4717-8717-000000000101';
 receipt jsonb;trip uuid;num_offers integer;num_outbox integer;
BEGIN
 receipt:=public.mobility_stage_g73_booking_receipt(p,b);
 trip:=(receipt->>'tripId')::uuid;
 num_offers=(SELECT count(*) FROM public.mobility_stage_auto_demo_offers
  WHERE trip_id=trip AND driver_id=d AND vehicle_id=v);
 num_outbox=(SELECT count(*) FROM public.mobility_stage_auto_demo_push_outbox box
 JOIN public.mobility_stage_auto_demo_offers o ON o.id=box.offer_id
 WHERE o.trip_id=trip AND box.driver_id=d);
 IF num_offers<>1 OR num_outbox<>1 OR
  (SELECT status FROM public.mobility_stage_auto_demo_trips WHERE id=trip)<>'searching'
 OR (SELECT revision FROM public.mobility_stage_auto_demo_trips WHERE id=trip)<>1
 OR receipt->>'routeId' IS NULL OR receipt->>'quoteId' IS NULL
 OR (SELECT count(*) FROM public.mobility_stage_g72_auto_prequotes
 WHERE booking_key=b AND trip_id=trip)<>1
 THEN RAISE EXCEPTION 'G81 offer/outbox did not bind exactly one real G73 trip'; END IF;
 receipt:=public.mobility_stage_g75_admin_f1_receipt(admin,trip);
 IF receipt->>'tripId'<>trip::text OR receipt->>'status'<>'searching'
 OR receipt->>'driverId' IS NOT NULL OR receipt->>'assignmentPersisted'<>'false'
 THEN RAISE EXCEPTION 'G81 leaked an unaccepted Driver into Admin'; END IF;
 RAISE NOTICE 'G81 PASS: one booked G73 trip, private offer and outbox; KYC and legal fences remain';
END $verify$;
-- G85 must observe this already-offered G84/G81 trip, not create a second
-- offer or mutate Passenger state when the offline worker catches up.
SET LOCAL ROLE service_role;
DO $g85_reconcile$
DECLARE receipt jsonb;
BEGIN
 receipt:=public.mobility_stage_g85_run_one_dispatch_qa();
 IF receipt->>'status'<>'OFFERED' OR receipt->>'commercialEnabled'<>'false'
 OR NOT EXISTS(
  SELECT 1 FROM public.mobility_stage_poll_driver_auto_offers(
   '00000000-0000-4000-8000-000000000181') inbox
  WHERE inbox.offer_id=(receipt->>'offerId')::uuid)
 THEN RAISE EXCEPTION 'G85 failed to reconcile original private offer'; END IF;
END $g85_reconcile$;
DO $g82$
DECLARE
 p uuid:='81810000-0000-4818-8818-000000000001';
 foreign_user uuid:='81810000-0000-4818-8818-000000000003';
 driver uuid:='00000000-0000-4000-8000-000000000181';
 v uuid:='71710000-0000-4717-8717-000000000101';
 b uuid:='82820000-0000-4828-8828-000000000012';
 key uuid:='82820000-0000-4828-8828-000000000013';
 v_route uuid;v_quote uuid;v_trip uuid;candidate uuid;denied boolean;
BEGIN
 IF NOT has_function_privilege('service_role',
  'public.mobility_stage_g82_offer_first_eligible_auto_qa(uuid,uuid,uuid,integer)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g82_offer_first_eligible_auto_qa(uuid,uuid,uuid,integer)','EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_stage_g82_offer_first_eligible_auto_qa(uuid,uuid,uuid,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'G82 SQL candidate service privileges incorrect'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g82_offer_first_eligible_auto_qa(
   foreign_user,'81810000-0000-4818-8818-000000000012',
   '82820000-0000-4828-8828-000000000018',15);
 EXCEPTION WHEN SQLSTATE 'P8201' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G82 foreign booking selection allowed'; END IF;
 v_route:=public.mobility_stage_g73_route(p,
  '82820000-0000-4828-8828-000000000010','economico',
  'CENTRO_FIXTURE','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 v_quote:=public.mobility_stage_g73_quote(p,v_route,
  '82820000-0000-4828-8828-000000000011');
 -- The previous ride for p is still searching. A second active passenger
 -- booking must be refused. Cancel the previous one through G3 lifecycle,
 -- not direct DML (which G37 forbids).
 PERFORM public.mobility_stage_auto_demo_transition(
  (public.mobility_stage_g73_booking_receipt(p,
   '81810000-0000-4818-8818-000000000012')->>'tripId')::uuid,
  p,'cancelled','82820000-0000-4828-8828-000000000015');
 v_trip:=public.mobility_stage_g73_book(p,v_quote,b);
 candidate:=public.mobility_stage_g82_offer_first_eligible_auto_qa(p,b,key,30);
 IF candidate IS NULL THEN
  RAISE EXCEPTION 'G82 no QA eligible AUTO candidate, check G36 current Driver slot'; END IF;
 IF candidate<>public.mobility_stage_g82_offer_first_eligible_auto_qa(p,b,key,30)
 OR NOT EXISTS(
  SELECT 1 FROM public.mobility_stage_auto_demo_offers o
  JOIN public.mobility_stage_auto_demo_push_outbox outbox ON outbox.offer_id=o.id
  WHERE o.id=candidate AND o.trip_id=v_trip AND o.driver_id=driver
   AND o.vehicle_id=v AND o.status='offered' AND outbox.driver_id=driver)
 OR NOT EXISTS(
  SELECT 1 FROM public.mobility_stage_poll_driver_auto_offers(driver) inbox
  WHERE inbox.offer_id=candidate AND inbox.trip_id=v_trip)
 THEN RAISE EXCEPTION 'G82 private selected Driver offer/inbox diverged from G73 trip'; END IF;
 -- A different idempotency key cannot re-offer same trip to same Driver.
 IF public.mobility_stage_g82_offer_first_eligible_auto_qa(
  p,b,'82820000-0000-4828-8828-000000000016',30) IS NOT NULL
 THEN RAISE EXCEPTION 'G82 re-offered same Driver'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g82_offer_first_eligible_auto_qa(
   p,b,key,29);
 EXCEPTION WHEN SQLSTATE 'P8201' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G82 accepted conflicted TTL key'; END IF;
 -- G38 legal-zone gate still denies true assignment even with QA offer.
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_accept_offer(
   candidate,driver,'82820000-0000-4828-8828-000000000017');
 EXCEPTION WHEN SQLSTATE 'G3801' OR SQLSTATE 'G3601' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G82 bypassed G38 legal block'; END IF;
 IF EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_trips t
  WHERE t.id=v_trip AND (t.status<>'searching' OR t.driver_id IS NOT NULL))
 THEN RAISE EXCEPTION 'G82 unapproved Driver assignment persisted'; END IF;
 RAISE NOTICE 'G82 PASS: G73 booking to DB-selected G4 offer and G16 Driver inbox; no legal acceptance';
END $g82$;
RESET ROLE;
-- G87: prove expired offer re-arm on exactly the same committed G73 trip.
-- Existing G81/G82 fixture supplied a valid 8-document QA Driver; all
-- mutations in this assertion are ROLLBACK-only on disposable PG16.
DO $g87_guard$
BEGIN
 IF has_function_privilege('service_role',
  'public.mobility_stage_g87_dispatch_core_qa()','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g85_run_one_dispatch_qa()','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.mobility_stage_g85_run_one_dispatch_qa()','EXECUTE')
 THEN RAISE EXCEPTION 'G87 private worker grants are not isolated'; END IF;
END $g87_guard$;
SET LOCAL ROLE service_role;
DO $g87_original_offer$
DECLARE got jsonb;
BEGIN
 -- G87 first marks the old canceled trip CLOSED, then G85 reconciles the
 -- G82 offer already written for the next G73 booking.
 got:=public.mobility_stage_g85_run_one_dispatch_qa();
 IF got->>'status'<>'OFFERED' OR got->>'commercialEnabled'<>'false'
 OR (SELECT status FROM public.mobility_stage_g85_auto_dispatch_jobs
     WHERE booking_key='81810000-0000-4818-8818-000000000012')<>'CLOSED'
 OR (SELECT offer_id FROM public.mobility_stage_g85_auto_dispatch_jobs
     WHERE booking_key='82820000-0000-4828-8828-000000000012')
    IS DISTINCT FROM (got->>'offerId')::uuid
 THEN RAISE EXCEPTION 'G87 did not close canceled trip and reconcile active second offer'; END IF;
END $g87_original_offer$;
RESET ROLE;
-- Simulate wall-clock expiry without sleeping; never touch a live Driver.
DO $g87_expire_fixture$
DECLARE o uuid;
BEGIN
 SELECT offer_id INTO o FROM public.mobility_stage_g85_auto_dispatch_jobs
 WHERE booking_key='82820000-0000-4828-8828-000000000012';
 IF o IS NULL THEN RAISE EXCEPTION 'G87 missing original QA offer'; END IF;
 UPDATE public.mobility_stage_auto_demo_offers
 SET offered_at=pg_catalog.clock_timestamp()-interval '65 seconds',
     expires_at=pg_catalog.clock_timestamp()-interval '35 seconds'
 WHERE id=o;
END $g87_expire_fixture$;
SET LOCAL ROLE service_role;
DO $g87_rearm$
DECLARE before_key uuid;before_offer uuid;trip uuid;got jsonb;
BEGIN
 SELECT offer_key,offer_id,trip_id INTO before_key,before_offer,trip
 FROM public.mobility_stage_g85_auto_dispatch_jobs
 WHERE booking_key='82820000-0000-4828-8828-000000000012'
 AND status='OFFERED';
 IF before_offer IS NULL THEN RAISE EXCEPTION 'G87 no expired offered row'; END IF;
 got:=public.mobility_stage_g85_run_one_dispatch_qa();
 -- The one previously eligible Driver already received an offer. The G82
 -- unique-driver fence must not reoffer to the same person.
 IF got->>'status'<>'WAITING' OR got->>'tripId'<>trip::text
 OR got->>'offerId' IS NOT NULL
 OR NOT EXISTS(
  SELECT 1 FROM public.mobility_stage_g85_auto_dispatch_jobs j
  WHERE j.trip_id=trip AND j.status='WAITING' AND j.offer_id IS NULL
  AND j.offer_key<>before_key AND j.attempts=2
  AND j.next_attempt_at>pg_catalog.clock_timestamp())
 OR (SELECT count(*) FROM public.mobility_stage_auto_demo_offers
     WHERE trip_id=trip)<>1
 OR EXISTS(SELECT 1 FROM public.mobility_stage_poll_driver_auto_offers(
   '00000000-0000-4000-8000-000000000181') inbox
   WHERE inbox.offer_id=before_offer)
 OR (SELECT status FROM public.mobility_stage_auto_demo_trips
     WHERE id=trip)<>'searching'
 THEN RAISE EXCEPTION 'G87 expiry stuck job, repeated Driver, or forged trip assignment'; END IF;
 IF (public.mobility_stage_g85_run_one_dispatch_qa()->>'status')<>'IDLE'
 THEN RAISE EXCEPTION 'G87 bypassed retry backoff'; END IF;
 RAISE NOTICE 'G87 PASS: expired offer is not recycled; next Driver search waits with a new key';
END $g87_rearm$;
RESET ROLE;
ROLLBACK;
