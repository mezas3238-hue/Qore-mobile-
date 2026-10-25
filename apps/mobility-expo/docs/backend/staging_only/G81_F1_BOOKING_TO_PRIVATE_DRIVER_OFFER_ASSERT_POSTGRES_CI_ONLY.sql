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
-- No location is invented: only update timestamp if existing synthetic
-- fixture is available; eligibility still depends on every preflight.
UPDATE public.driver_locations SET updated_at=pg_catalog.clock_timestamp()
 WHERE driver_id='00000000-0000-4000-8000-000000000181'::uuid
 AND available=true;
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
 THEN RAISE EXCEPTION 'G81 disposable Driver QA preflight fixture unavailable'; END IF;
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
ROLLBACK;
