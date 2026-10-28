-- G33 / G32.3: QA-only diagnostic aggregation of quarantined Driver signals.
-- This NEVER writes G31 availability observations or dispatch/rider data.
-- No GPS, Driver UUID, tracks, personal details or location evidence in result.
-- Disposable PostgreSQL 16 only. Requires G1/G3/G5/G27/G31/G32.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G33 aggregation refuses non-disposable database'; END IF;
 IF to_regclass('public.mobility_stage_g32_signal_quarantine') IS NULL
 OR to_regclass('public.mobility_stage_auto_demo_trips') IS NULL
 OR to_regclass('public.mobility_stage_deliveries') IS NULL
 OR to_regclass('public.mobility_stage_g31_zone_observations') IS NULL
 THEN RAISE EXCEPTION 'G33 missing source tables'; END IF;
END $guard$;

BEGIN;
CREATE INDEX mobility_stage_g33_qa_signal_zone_service_recent
 ON public.mobility_stage_g32_signal_quarantine(
 zone_id,service_kind,captured_at DESC,driver_id);

CREATE FUNCTION public.mobility_stage_g33_quarantined_zone_diagnostic(
 _admin uuid,_zone uuid,_service text,_anchor_ms bigint
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE
 out_doc jsonb;
BEGIN
 IF _admin IS NULL OR _zone IS NULL OR
 _service IS NULL OR _service NOT IN
 ('AUTO_RIDE','AUTO_DELIVERY','MOTO_DELIVERY') OR
 _anchor_ms IS NULL OR _anchor_ms NOT BETWEEN 0 AND 9999999999999
 OR _anchor_ms>floor(extract(epoch FROM clock_timestamp())*1000)::bigint
 OR _anchor_ms<floor(extract(epoch FROM clock_timestamp())*1000)::bigint-60000
 THEN RAISE EXCEPTION 'Invalid G33 diagnostic context' USING ERRCODE='G3301'; END IF;
 IF NOT public.mobility_stage_g27_backoffice_has_scope(
   _admin,'admin.zones.read')
 THEN RAISE EXCEPTION 'G33 requires exclusive Admin scope'
 USING ERRCODE='G3301'; END IF;
 IF NOT EXISTS (
 SELECT 1 FROM public.mobility_stage_g31_zone_coverage z
 WHERE z.zone_id=_zone AND z.service_kind=_service AND z.country_code='PY')
 THEN RAISE EXCEPTION 'Unknown QA zone/service' USING ERRCODE='G3301'; END IF;

 -- Use ONLY a Driver's global latest event, not every historical event.
 -- That guarantees cross-zone/service movement never counts twice.
 WITH latest AS (
  SELECT q.driver_id,q.captured_at,q.accepted_at
  FROM public.mobility_stage_g32_signal_state s
  JOIN public.mobility_stage_g32_signal_quarantine q
   ON q.event_id=s.last_event_id AND q.driver_id=s.driver_id
   AND q.sequence=s.last_sequence
  WHERE q.zone_id=_zone AND q.service_kind=_service
   AND q.captured_at>=pg_catalog.to_timestamp((_anchor_ms-30000)/1000.0)
   AND q.captured_at<=pg_catalog.to_timestamp(_anchor_ms/1000.0)
   AND q.accepted_at<=pg_catalog.to_timestamp(_anchor_ms/1000.0)
 ), filtered AS (
  SELECT l.driver_id,
   EXISTS (
    SELECT 1 FROM public.mobility_location_consents c
    WHERE c.driver_id=l.driver_id AND c.revoked_at IS NULL
      AND c.opted_in_at<=l.captured_at
   ) AND
   (SELECT count(*) FROM public.user_roles r
    WHERE r.user_id=l.driver_id)=1 AND
   EXISTS(SELECT 1 FROM public.user_roles r
    WHERE r.user_id=l.driver_id AND r.role='driver'::public.app_role) AND
   EXISTS(SELECT 1 FROM public.driver_locations loc
    WHERE loc.driver_id=l.driver_id AND loc.available=true
     AND loc.updated_at>=pg_catalog.to_timestamp((_anchor_ms-60000)/1000.0)
     AND loc.updated_at<=pg_catalog.to_timestamp(_anchor_ms/1000.0)) AND
   NOT EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_trips t
    WHERE t.driver_id=l.driver_id
     AND t.status IN ('accepted','arriving','in_progress')) AND
   NOT EXISTS(SELECT 1 FROM public.mobility_stage_deliveries d
    WHERE d.courier_id=l.driver_id
     AND d.status IN ('accepted','picked_up','disputed'))
   AS consented_idle_candidate
  FROM latest l
 )
 SELECT pg_catalog.jsonb_build_object(
  'zoneId',_zone,'serviceKind',_service,
  'source','QA_G32_QUARANTINE_ONLY',
  'observedAtMs',_anchor_ms,
  'quarantinedRecentSignals',count(*),
  'consentingIdleCandidates',
   count(*) FILTER(WHERE consented_idle_candidate),
  'availabilityConfirmed',false,
  'dispatchAuthorized',false,
  'publishedToG31',false,
  'productionEnabled',false
 ) INTO out_doc
 FROM filtered;
 RETURN out_doc;
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g33_quarantined_zone_diagnostic(
 uuid,uuid,text,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g33_quarantined_zone_diagnostic(
 uuid,uuid,text,bigint) TO service_role;
COMMIT;
