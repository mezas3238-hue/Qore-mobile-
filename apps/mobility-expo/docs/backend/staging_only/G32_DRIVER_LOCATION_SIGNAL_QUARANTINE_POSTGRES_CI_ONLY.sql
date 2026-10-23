-- G32 A05.5 — Driver location signal QUARANTINE, not a ride-dispatch feed.
-- Disposable PostgreSQL 16 only. NEVER apply to remote Supabase.
-- Requires real G1/G2 location consent, G18 exclusive Driver and G31 zone catalog.
-- The trusted Node gate must verify JWT/integrity/geofence/eligibility first.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain' OR
   current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G32 refuses non-disposable PostgreSQL'; END IF;
 IF to_regclass('public.mobility_location_consents') IS NULL OR
    to_regclass('public.mobility_stage_g31_zone_coverage') IS NULL
 THEN RAISE EXCEPTION 'G32 missing location consent or G31 catalog'; END IF;
END $guard$;

BEGIN;
CREATE TABLE public.mobility_stage_g32_signal_state(
 driver_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
 last_sequence bigint NOT NULL CHECK(last_sequence>=1),
 last_captured_at timestamptz NOT NULL,
 last_event_id uuid NOT NULL
);
CREATE TABLE public.mobility_stage_g32_signal_quarantine (
 event_id uuid PRIMARY KEY,
 driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 sequence bigint NOT NULL CHECK(sequence>=1),
 captured_at timestamptz NOT NULL,
 accepted_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 zone_id uuid NOT NULL,
 service_kind text NOT NULL,
 consent_revision bigint NOT NULL CHECK(consent_revision>=1),
 geometry_revision bigint NOT NULL CHECK(geometry_revision>=1),
 source_kind text NOT NULL DEFAULT 'QA_QUARANTINE_UNTRUSTED_FOR_DISPATCH'
  CHECK(source_kind='QA_QUARANTINE_UNTRUSTED_FOR_DISPATCH'),
 FOREIGN KEY(zone_id,service_kind)
   REFERENCES public.mobility_stage_g31_zone_coverage(zone_id,service_kind)
   ON DELETE RESTRICT,
 UNIQUE(driver_id,sequence)
);
CREATE INDEX mobility_stage_g32_signal_driver_time
 ON public.mobility_stage_g32_signal_quarantine(driver_id,captured_at DESC);
ALTER TABLE public.mobility_stage_g32_signal_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g32_signal_quarantine ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g32_signal_state
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_g32_signal_quarantine
 FROM PUBLIC,anon,authenticated,service_role;
-- Only a backend-owned service_role can call ingest. All rows remain private.
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_g32_signal_state TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_g32_signal_quarantine TO service_role;

CREATE FUNCTION public.mobility_stage_g32_quarantine_signal(
 _driver uuid,_event uuid,_sequence bigint,_captured_ms bigint,
 _zone uuid,_service text,_consent_revision bigint,_geometry_revision bigint
) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE
 at_now timestamptz:=pg_catalog.clock_timestamp();
 observed timestamptz;
 earlier public.mobility_stage_g32_signal_state%ROWTYPE;
BEGIN
 IF _driver IS NULL OR _event IS NULL OR _zone IS NULL
 OR _sequence IS NULL OR _sequence<1
 OR _captured_ms IS NULL OR _captured_ms NOT BETWEEN 0 AND 9999999999999
 OR _consent_revision IS NULL OR _consent_revision<1
 OR _geometry_revision IS NULL OR _geometry_revision<1
 OR _service IS NULL OR _service NOT IN
    ('AUTO_RIDE','AUTO_DELIVERY','MOTO_DELIVERY')
 THEN RAISE EXCEPTION 'Invalid G32 signal' USING ERRCODE='G3201'; END IF;
 observed:=pg_catalog.to_timestamp(_captured_ms/1000.0);
 IF observed < at_now-interval '30 seconds' OR
    observed > at_now+interval '5 seconds'
 THEN RAISE EXCEPTION 'G32 stale/future signal' USING ERRCODE='G3201'; END IF;
 IF (SELECT count(*) FROM public.user_roles r WHERE r.user_id=_driver)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles r
    WHERE r.user_id=_driver AND r.role='driver'::public.app_role)
 OR NOT EXISTS(SELECT 1 FROM public.mobility_location_consents c
    WHERE c.driver_id=_driver
    AND c.revoked_at IS NULL AND c.opted_in_at<=observed)
 THEN RAISE EXCEPTION 'G32 Driver identity/consent unavailable'
   USING ERRCODE='G3201'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.mobility_stage_g31_zone_coverage c
    WHERE c.zone_id=_zone AND c.service_kind=_service AND c.country_code='PY')
 THEN RAISE EXCEPTION 'G32 zone/service not enrolled in QA catalog'
   USING ERRCODE='G3201'; END IF;
 -- No live eligibility or geometry proof is produced by SQL. This only
 -- fences persisted quarantine signals after independent Node verification.
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('qore:g32:driver:'||_driver::text,0));
 SELECT * INTO earlier FROM public.mobility_stage_g32_signal_state
  WHERE driver_id=_driver FOR UPDATE;
 IF FOUND AND (_sequence<=earlier.last_sequence OR
    observed<earlier.last_captured_at)
 THEN RAISE EXCEPTION 'G32 replay, reordered sequence or rollback timestamp'
    USING ERRCODE='G3201'; END IF;
 IF EXISTS(SELECT 1 FROM public.mobility_stage_g32_signal_quarantine
   WHERE event_id=_event)
 THEN RAISE EXCEPTION 'G32 duplicate event' USING ERRCODE='G3201'; END IF;
 INSERT INTO public.mobility_stage_g32_signal_quarantine
  (event_id,driver_id,sequence,captured_at,zone_id,service_kind,
   consent_revision,geometry_revision)
 VALUES(_event,_driver,_sequence,observed,_zone,_service,
  _consent_revision,_geometry_revision);
 INSERT INTO public.mobility_stage_g32_signal_state
  (driver_id,last_sequence,last_captured_at,last_event_id)
 VALUES(_driver,_sequence,observed,_event)
 ON CONFLICT(driver_id) DO UPDATE SET
  last_sequence=EXCLUDED.last_sequence,
  last_captured_at=EXCLUDED.last_captured_at,
  last_event_id=EXCLUDED.last_event_id;
 RETURN _event;
END $body$;

REVOKE ALL ON FUNCTION public.mobility_stage_g32_quarantine_signal(
 uuid,uuid,bigint,bigint,uuid,text,bigint,bigint)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g32_quarantine_signal(
 uuid,uuid,bigint,bigint,uuid,text,bigint,bigint) TO service_role;
COMMIT;
