-- G96: canceled G73 trip must not have open G85 queue, valid G4 offers,
-- late ACKs or Driver acceptance. All synthetic identities rollback.
BEGIN;
SET LOCAL statement_timeout='90s';
INSERT INTO auth.users(id) VALUES
 ('96960000-0000-4969-8969-000000000001'),
 ('96960000-0000-4969-8969-000000000002'),
 ('96960000-0000-4969-8969-000000000003');
DELETE FROM public.user_roles
 WHERE user_id='96960000-0000-4969-8969-000000000002';
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
 VALUES('96960000-0000-4969-8969-000000000002','owner','active',
 '96960000-0000-4969-8969-000000000002');
INSERT INTO public.mobility_stage_g93_ride_campaigns(
 id,service_kind,rule_version,approved_by,active,begins_at,ends_at,duration_days)
 VALUES('96960000-0000-4969-8969-000000000020','AUTO_RIDE',
 'PY_AUTO_60_G96','96960000-0000-4969-8969-000000000002',true,
 pg_catalog.transaction_timestamp()-interval '1 hour',
 pg_catalog.transaction_timestamp()-interval '1 hour'+interval '60 days',60);

-- Restore existing synthetic G71 dossier for private G81 OFFER only.
-- Do not touch production, geofence G38 or insurer/municipal attestations.
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
INSERT INTO public.mobility_vehicle_compliance(
 vehicle_id,registration_valid_through,registration_verified_at,
 insurance_valid_through,insurance_verified_at,paid_passenger_insurance_covered,
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
DO $license$
DECLARE doc uuid; d uuid:='00000000-0000-4000-8000-000000000181';
BEGIN
 IF NOT public.mobility_stage_driver_current_license_approved(d) THEN
  SELECT id INTO doc FROM public.mobility_stage_driver_documents
  WHERE driver_id=d AND kind='licencia' ORDER BY submitted_at DESC,id DESC LIMIT 1;
  IF doc IS NULL THEN RAISE EXCEPTION 'G96 cannot find synthetic license'; END IF;
  PERFORM public.mobility_stage_review_driver_document(doc,
   '00000000-0000-4000-8000-000000000101',true,'DOCUMENT_VALID',
   '96960000-0000-4969-8969-000000000021');
 END IF;
END $license$;
UPDATE public.mobility_location_consents
 SET opted_in_at=pg_catalog.clock_timestamp()-interval '5 minutes',
 revoked_at=NULL WHERE driver_id='00000000-0000-4000-8000-000000000181';
UPDATE public.driver_locations
 SET available=true,updated_at=pg_catalog.clock_timestamp()
 WHERE driver_id='00000000-0000-4000-8000-000000000181';

DO $f1$
DECLARE
 p uuid:='96960000-0000-4969-8969-000000000001';
 d uuid:='00000000-0000-4000-8000-000000000181';
 v uuid:='71710000-0000-4717-8717-000000000101';
 b uuid:='96960000-0000-4969-8969-000000000012';
 rt uuid;qt uuid;trip uuid;o uuid;x jsonb;denied boolean:=false;
 ack boolean;
BEGIN
 IF NOT public.mobility_stage_g71_valid_locked_dossier(d,v)
 OR NOT public.mobility_vehicle_preflight(d,v,'economico')
 THEN RAISE EXCEPTION 'G96 synthetic QA Driver cannot offer'; END IF;
 rt:=public.mobility_stage_g73_route(p,
 '96960000-0000-4969-8969-000000000010','economico',
 'CENTRO_FIXTURE','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 qt:=public.mobility_stage_g73_quote(p,rt,
 '96960000-0000-4969-8969-000000000011');
 PERFORM public.mobility_stage_g93_preview_auto_qa(p,qt);
 trip:=public.mobility_stage_g73_book(p,qt,b);
 o:=public.mobility_stage_g81_offer_booked_auto(
  p,b,d,v,'96960000-0000-4969-8969-000000000014',30);
 IF NOT public.mobility_stage_g96_push_still_eligible_qa(o,d)
 OR public.mobility_stage_g90_passenger_dispatch_status_qa(p,b)
  ->>'dispatchState'<>'OFFER_PENDING'
 THEN RAISE EXCEPTION 'G96 offered dispatch not eligible before cancel'; END IF;
 -- Claim the exact fixture offer WITHOUT claiming another suite's job.
 UPDATE public.mobility_stage_auto_demo_push_outbox
 SET claimed_at=pg_catalog.clock_timestamp(),
  claimed_by='96960000-0000-4969-8969-000000000030'::uuid
 WHERE offer_id=o AND claimed_at IS NULL;
 x:=public.mobility_stage_g95_cancel_booked_auto_qa(
  p,b,'96960000-0000-4969-8969-000000000013');
 IF x->>'tripId'<>trip::text OR x->>'financialState'<>'VOIDED_QA'
 OR x->>'reversalEntriesBalanced'<>'true'
 OR (SELECT status FROM public.mobility_stage_g85_auto_dispatch_jobs
    WHERE booking_key=b)<>'CLOSED'
 OR (SELECT offer_id FROM public.mobility_stage_g85_auto_dispatch_jobs
    WHERE booking_key=b) IS NOT NULL
 OR (SELECT status FROM public.mobility_stage_auto_demo_offers
    WHERE id=o)<>'withdrawn'
 OR public.mobility_stage_g96_push_still_eligible_qa(o,d)
 OR public.mobility_stage_g90_passenger_dispatch_status_qa(p,b)
    ->>'dispatchState'<>'CLOSED'
 THEN RAISE EXCEPTION 'G96 stale Driver offer/queue after cancellation %',x; END IF;
 -- A push ALREADY claimed may never receive an ACK once trip canceled.
 BEGIN
  SELECT public.mobility_stage_ack_auto_demo_push(
  '96960000-0000-4969-8969-000000000030',o,'ticketG96TEST0001')
  INTO ack;
 EXCEPTION WHEN SQLSTATE 'P9601' THEN denied:=true; END;
 IF NOT denied OR
  (SELECT accepted_for_processing_at FROM public.mobility_stage_auto_demo_push_outbox
   WHERE offer_id=o) IS NOT NULL
 THEN RAISE EXCEPTION 'G96 canceled Driver notification got late ACK'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_accept_offer(
   o,d,'96960000-0000-4969-8969-000000000015');
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G96 canceled offer accepted by Driver'; END IF;
 IF public.mobility_stage_g95_cancel_booked_auto_qa(p,b,
  '96960000-0000-4969-8969-000000000013')<>x
 OR (SELECT count(*) FROM public.mobility_stage_g94_auto_voids WHERE trip_id=trip)<>1
 OR (SELECT count(*) FROM public.mobility_stage_auto_demo_events
  WHERE trip_id=trip AND next_status='cancelled')<>1
 THEN RAISE EXCEPTION 'G96 cancel replay duplicated financial or event state'; END IF;
 RAISE NOTICE 'G96 PASS: cancellation withdrew Driver offer, closed G85, denied claimed push ACK and Driver accept';
END $f1$;

DO $grants$
BEGIN
 IF has_function_privilege('authenticated',
 'public.mobility_stage_g96_push_still_eligible_qa(uuid,uuid)','EXECUTE')
 OR has_function_privilege('anon',
 'public.mobility_stage_g96_push_still_eligible_qa(uuid,uuid)','EXECUTE')
 OR has_function_privilege('service_role',
 'public.mobility_stage_g96_cancel_dispatch_fence_qa()','EXECUTE')
 OR NOT has_function_privilege('service_role',
 'public.mobility_stage_g96_push_still_eligible_qa(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G96 private dispatch privileges leaked'; END IF;
END $grants$;
ROLLBACK;
