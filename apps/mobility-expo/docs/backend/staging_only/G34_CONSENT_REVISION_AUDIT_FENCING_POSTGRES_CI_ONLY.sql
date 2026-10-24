-- G34: authoritative consent revision, change events, and G32 replay fencing.
-- PostgreSQL 16 DISPOSABLE CHAIN ONLY. No change to connected Supabase.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G34 refuses non-disposable PostgreSQL'; END IF;
 IF to_regclass('public.mobility_location_consents') IS NULL
 OR to_regprocedure('public.mobility_stage_g32_quarantine_signal(uuid,uuid,bigint,bigint,uuid,text,bigint,bigint)') IS NULL
 THEN RAISE EXCEPTION 'G34 requires G2 consent and G32 quarantine'; END IF;
END $guard$;
BEGIN;
ALTER TABLE public.mobility_location_consents
 ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK(revision>=1);

-- Event log never includes coordinates, access tokens or Driver demographics.
CREATE TABLE public.mobility_stage_g34_consent_audit (
 event_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 consent_revision bigint NOT NULL CHECK(consent_revision>=1),
 action text NOT NULL CHECK(action IN ('OPT_IN','REVOKE','RE_OPT_IN')),
 occurred_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 UNIQUE(driver_id,consent_revision)
);
ALTER TABLE public.mobility_stage_g34_consent_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g34_consent_audit
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.mobility_stage_g34_consent_audit TO service_role;

CREATE FUNCTION public.mobility_stage_g34_consent_revision_on_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF NEW.driver_id IS DISTINCT FROM OLD.driver_id
 THEN RAISE EXCEPTION 'G34 cannot transfer consent to another Driver'; END IF;
 IF NEW.opted_in_at IS NOT DISTINCT FROM OLD.opted_in_at
  AND NEW.revoked_at IS NOT DISTINCT FROM OLD.revoked_at
 THEN RAISE EXCEPTION 'G34 consent update requires state change'; END IF;
 IF OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NULL
   AND NEW.opted_in_at<=OLD.revoked_at
 THEN RAISE EXCEPTION 'G34 opt-in after revocation must be a new consent'; END IF;
 IF OLD.revision>=9223372036854775806
 THEN RAISE EXCEPTION 'G34 consent revision exhausted'; END IF;
 NEW.revision:=OLD.revision+1;
 NEW.recorded_at:=pg_catalog.clock_timestamp();
 RETURN NEW;
END $fn$;
CREATE TRIGGER mobility_stage_g34_bump_consent_revision
 BEFORE UPDATE ON public.mobility_location_consents
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g34_consent_revision_on_update();

CREATE FUNCTION public.mobility_stage_g34_log_consent_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 INSERT INTO public.mobility_stage_g34_consent_audit(
  driver_id,consent_revision,action)
 VALUES (NEW.driver_id,NEW.revision,
  CASE WHEN NEW.revoked_at IS NOT NULL THEN 'REVOKE'
       WHEN TG_OP='INSERT' THEN 'OPT_IN'
       ELSE 'RE_OPT_IN' END);
 RETURN NEW;
END $fn$;
CREATE TRIGGER mobility_stage_g34_consent_audit_append
 AFTER INSERT OR UPDATE ON public.mobility_location_consents
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g34_log_consent_change();

REVOKE ALL ON FUNCTION public.mobility_stage_g34_consent_revision_on_update()
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g34_log_consent_change()
 FROM PUBLIC,anon,authenticated,service_role;

-- G32 still performs server-attested JWT/consent/geo/location checks in Node.
-- This extra SQL fence makes revision from server-trusted consent load
-- match current immutable consent state under the row lock.
CREATE OR REPLACE FUNCTION public.mobility_stage_g32_quarantine_signal(
 _driver uuid,_event uuid,_sequence bigint,_captured_ms bigint,
 _zone uuid,_service text,_consent_revision bigint,_geometry_revision bigint
) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE
 at_now timestamptz:=pg_catalog.clock_timestamp();
 observed timestamptz;
 earlier public.mobility_stage_g32_signal_state%ROWTYPE;
 consent_opted_in timestamptz;
 consent_revoked timestamptz;
 consent_current_revision bigint;
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
 -- Lock the consent row AFTER the per-Driver fence, before accepting a
 -- signal. Concurrent revocation must commit before this check or wait
 -- for this atomic quarantine transaction to finish.
 SELECT c.opted_in_at,c.revoked_at,c.revision
  INTO consent_opted_in,consent_revoked,consent_current_revision
  FROM public.mobility_location_consents c
  WHERE c.driver_id=_driver FOR SHARE;
 IF NOT FOUND OR consent_opted_in IS NULL OR consent_revoked IS NOT NULL
 OR consent_opted_in>observed
 OR consent_current_revision IS DISTINCT FROM _consent_revision
 THEN RAISE EXCEPTION 'G32 consent withdrawn or revision invalid during write'
  USING ERRCODE='G3201'; END IF;
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


-- Previous G32 EXECUTE grants are preserved by CREATE OR REPLACE.
-- No browser role gets a new executable RPC, and no telemetry is promoted.
COMMIT;
