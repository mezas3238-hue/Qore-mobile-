-- G35 / A05.8 — private QA evidence readiness, NEVER dispatch authorization.
-- PostgreSQL 16 disposable ONLY. Requires G1/G2/G3/G5/G17/G20/G27/G31/G32/G34.
-- This diagnostic answers a concrete gap in G33: IDLE != KYC/INSURANCE.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G35 refuses non-disposable PostgreSQL'; END IF;
 IF to_regprocedure('public.mobility_stage_driver_current_license_approved(uuid)') IS NULL
 OR to_regclass('public.mobility_stage_delivery_vehicle_clearance') IS NULL
 OR to_regclass('public.mobility_stage_g32_signal_state') IS NULL
 OR NOT EXISTS (SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='mobility_location_consents'
  AND column_name='revision')
 THEN RAISE EXCEPTION 'G35 requires KYC G20, cargo G5, G32 and consent G34'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g35_driver_documentary_diagnostic(
 _admin uuid,_driver uuid,_zone uuid,_service text,_anchor_ms bigint
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE
 at_time timestamptz;
 signal_recent boolean:=false;
 consent_current boolean:=false;
 idle boolean:=false;
 vehicle_reviewed boolean:=false;
 policy boolean:=false;
 observed_license boolean:=false;
 evidence boolean:=false;
BEGIN
 IF _admin IS NULL OR _driver IS NULL OR _zone IS NULL OR
 _service IS NULL OR _service NOT IN
 ('AUTO_RIDE','AUTO_DELIVERY','MOTO_DELIVERY') OR
 _anchor_ms IS NULL OR _anchor_ms NOT BETWEEN 0 AND 9999999999999 OR
 _anchor_ms>floor(extract(epoch FROM clock_timestamp())*1000)::bigint OR
 _anchor_ms<floor(extract(epoch FROM clock_timestamp())*1000)::bigint-60000
 THEN RAISE EXCEPTION 'G35 invalid diagnostic context' USING ERRCODE='G3501'; END IF;
 IF NOT public.mobility_stage_g27_backoffice_has_scope(_admin,'admin.zones.read')
 THEN RAISE EXCEPTION 'G35 exclusive Admin zone permission required'
 USING ERRCODE='G3501'; END IF;

 at_time:=pg_catalog.to_timestamp(_anchor_ms/1000.0);
 SELECT z.eligible_by_policy INTO policy
 FROM public.mobility_stage_g31_zone_coverage z
 WHERE z.zone_id=_zone AND z.service_kind=_service AND z.country_code='PY';
 IF NOT FOUND THEN RAISE EXCEPTION 'G35 zone/service absent' USING ERRCODE='G3501'; END IF;
 -- QA-only G31 policy is false by CHECK: never permit LIVE by matching a
 -- synthetic vehicle, consent or geofence alone.
 IF policy IS DISTINCT FROM false THEN
 RAISE EXCEPTION 'G35 refuses enabled commercial zone' USING ERRCODE='G3501'; END IF;

 -- Only the globally newest G32 event may count, even across a new zone.
 SELECT EXISTS (
 SELECT 1 FROM public.mobility_stage_g32_signal_state s
 JOIN public.mobility_stage_g32_signal_quarantine q
  ON q.driver_id=s.driver_id AND q.event_id=s.last_event_id
  AND q.sequence=s.last_sequence
 WHERE s.driver_id=_driver AND q.zone_id=_zone AND q.service_kind=_service
  AND q.captured_at BETWEEN (at_time-interval '30 seconds') AND at_time
  AND q.accepted_at<=at_time
 ) INTO signal_recent;

 -- Current consent must correspond to newest event's stored revision;
 -- a later withdrawal + re-opt-in invalidates earlier signals.
 SELECT EXISTS(
 SELECT 1 FROM public.mobility_location_consents c
 JOIN public.mobility_stage_g32_signal_state s ON s.driver_id=c.driver_id
 JOIN public.mobility_stage_g32_signal_quarantine q
  ON q.event_id=s.last_event_id AND q.driver_id=s.driver_id
 WHERE c.driver_id=_driver AND c.revoked_at IS NULL
  AND c.opted_in_at<=q.captured_at
  AND c.revision=q.consent_revision
 ) INTO consent_current;

 SELECT (
  (SELECT count(*) FROM public.user_roles r WHERE r.user_id=_driver)=1
  AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=_driver
    AND r.role='driver'::public.app_role)
  AND EXISTS(SELECT 1 FROM public.driver_locations loc
   WHERE loc.driver_id=_driver AND loc.available=true
   AND loc.updated_at BETWEEN at_time-interval '60 seconds' AND at_time)
  AND NOT EXISTS (SELECT 1 FROM public.mobility_stage_auto_demo_trips t
   WHERE t.driver_id=_driver
    AND t.status IN ('accepted','arriving','in_progress'))
  AND NOT EXISTS (SELECT 1 FROM public.mobility_stage_deliveries d
   WHERE d.courier_id=_driver
    AND d.status IN ('accepted','picked_up','disputed'))
 ) INTO idle;

 observed_license:=public.mobility_stage_driver_current_license_approved(_driver)
 AND EXISTS(SELECT 1 FROM public.mobility_driver_compliance dc
  JOIN public.user_roles reviewer ON reviewer.user_id=dc.license_verified_by
   AND reviewer.role='admin'::public.app_role
  WHERE dc.driver_id=_driver
   AND dc.driver_review_status='approved'
   AND dc.license_valid_through>=CURRENT_DATE
   AND dc.license_verified_at<=at_time
   AND dc.license_verified_by<>_driver
   AND (SELECT count(*) FROM public.user_roles rr
      WHERE rr.user_id=dc.license_verified_by)=1);

 IF observed_license THEN
  IF _service='AUTO_RIDE' THEN
   SELECT EXISTS(
    SELECT 1 FROM public.mobility_vehicles v
    WHERE v.driver_id=_driver AND v.vehicle_kind='AUTO'
      AND v.service_kind IN ('economico','confort','xl')
      AND public.mobility_vehicle_preflight(_driver,v.id,v.service_kind)
   ) INTO vehicle_reviewed;
  ELSE
   SELECT EXISTS(
    SELECT 1 FROM public.mobility_vehicles v
    JOIN public.mobility_stage_delivery_vehicle_clearance c
      ON c.vehicle_id=v.id
    JOIN public.user_roles reviewer ON reviewer.user_id=c.reviewed_by
      AND reviewer.role='admin'::public.app_role
    WHERE v.driver_id=_driver
     AND v.country_code='PY'
     AND v.vehicle_kind=CASE _service WHEN 'AUTO_DELIVERY'
        THEN 'AUTO'::public.mobility_vehicle_kind
        ELSE 'MOTO'::public.mobility_vehicle_kind END
     AND v.review_status NOT IN ('rejected','suspended')
     AND c.delivery_authorized=true
     AND c.cargo_insurance_valid_through>=CURRENT_DATE
     AND c.cargo_insurance_verified_at<=at_time
     AND c.reviewed_at<=at_time AND c.reviewed_by<>_driver
     AND (SELECT count(*) FROM public.user_roles rr
       WHERE rr.user_id=c.reviewed_by)=1
   ) INTO vehicle_reviewed;
  END IF;
 END IF;

 evidence:=signal_recent AND consent_current AND idle AND vehicle_reviewed;
 RETURN pg_catalog.jsonb_build_object(
  'source','QA_G35_DOCUMENTARY_DIAGNOSTIC_ONLY',
  'hasFreshQuarantinedSignal',signal_recent,
  'hasCurrentLocationConsent',consent_current,
  'freeOfActiveAssignments',idle,
  'vehicleDocumentEvidenceReviewed',vehicle_reviewed,
  'candidateEvidenceComplete',evidence,
  'zoneEligibleByPolicy',false,
  'availabilityConfirmed',false,
  'dispatchAuthorized',false,
  'productionEnabled',false
 );
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g35_driver_documentary_diagnostic(
 uuid,uuid,uuid,text,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g35_driver_documentary_diagnostic(
 uuid,uuid,uuid,text,bigint) TO service_role;
COMMIT;
