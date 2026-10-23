-- G30 A05.4: Admin-only read model of existing append-only OPERATIVE events.
-- Disposable PostgreSQL 16 only; no remote data or production.
-- Sources: G8 incident moderation and suspensions + G2 vehicle reviews.
-- IMPORTANT: merchant/tariff/commission events are NOT in this subset.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G30 refuses non-disposable PostgreSQL'; END IF;
 IF to_regclass('public.mobility_stage_safety_incident_events') IS NULL
 OR to_regclass('public.mobility_stage_suspension_events') IS NULL
 OR to_regclass('public.mobility_vehicle_review_audit') IS NULL
 OR to_regclass('public.mobility_stage_backoffice_roles') IS NULL
 THEN RAISE EXCEPTION 'G30 requires source-backed G2/G8 and G27'; END IF;
END $guard$;
BEGIN;
CREATE INDEX mobility_stage_g30_safety_audit_key
 ON public.mobility_stage_safety_incident_events(recorded_at DESC,id DESC);
CREATE INDEX mobility_stage_g30_suspension_audit_key
 ON public.mobility_stage_suspension_events(recorded_at DESC,id DESC);
CREATE INDEX mobility_stage_g30_vehicle_audit_key
 ON public.mobility_vehicle_review_audit(reviewed_at DESC,id DESC);

CREATE FUNCTION public.mobility_stage_g30_admin_audit_page(
 _actor uuid,_anchor_ms bigint,_after text,_limit integer
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE result jsonb;
BEGIN
 IF _actor IS NULL OR _anchor_ms IS NULL OR
  _anchor_ms NOT BETWEEN 0 AND 9999999999999 OR
  _anchor_ms>floor(extract(epoch FROM clock_timestamp())*1000)::bigint OR
  _limit IS DISTINCT FROM 50 OR
  (_after IS NOT NULL AND _after !~ '^[0-9]{13}[0-9a-f]{32}$')
 THEN RAISE EXCEPTION 'Invalid G30 audit arguments' USING ERRCODE='G3001'; END IF;
 IF NOT public.mobility_stage_g27_backoffice_has_scope(_actor,'admin.audit.read')
 THEN RAISE EXCEPTION 'Exclusive active Admin audit permission required'
  USING ERRCODE='G3001'; END IF;

 -- Source tables are append-only for service_role. Never expose actor UUID,
 -- user account, reason code, incident description, vehicle plate or PII.
 WITH source_events AS (
  SELECT i.id,i.recorded_at AS occurred_at,
   i.incident_revision AS revision,
   'INCIDENT_TRIAGE'::text AS operation,'INCIDENT'::text AS target_kind,
   'CONFIRMED'::text AS outcome
  FROM public.mobility_stage_safety_incident_events i
  WHERE i.action IN ('triage','investigate','resolve','dismiss')
  UNION ALL
  SELECT v.id,v.reviewed_at,v.vehicle_revision,
   'KYC_REVIEW'::text,'VEHICLE'::text,'CONFIRMED'::text
  FROM public.mobility_vehicle_review_audit v
  UNION ALL
  SELECT s.id,s.recorded_at,s.suspension_revision,
   CASE WHEN s.action='apply' THEN 'ACCOUNT_SUSPEND'::text
    ELSE 'ACCOUNT_RESTORE'::text END,
   'ACCOUNT'::text,'CONFIRMED'::text
  FROM public.mobility_stage_suspension_events s
 ), keyed AS (
  SELECT id,revision,operation,target_kind,outcome,
   floor(extract(epoch FROM occurred_at)*1000)::bigint AS ms,
   pg_catalog.lpad(
    floor(extract(epoch FROM occurred_at)*1000)::bigint::text,13,'0'
   )||pg_catalog.replace(id::text,'-','') AS keyset
  FROM source_events
  WHERE occurred_at<=pg_catalog.to_timestamp(_anchor_ms/1000.0)
 ), candidate AS (
  SELECT * FROM keyed
  WHERE _after IS NULL OR keyset<_after
  ORDER BY keyset DESC LIMIT 51
 ), visible AS (
  SELECT * FROM candidate ORDER BY keyset DESC LIMIT 50
 )
 SELECT pg_catalog.jsonb_build_object(
  'revision',COALESCE((SELECT max(revision) FROM visible),0),
  'hasMore',(SELECT count(*)>50 FROM candidate),
  'items',COALESCE((
   SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'eventId',id,'actorRole','admin','operation',operation,
    'targetKind',target_kind,'outcome',outcome,
    'occurredAt',ms,'revision',revision
   ) ORDER BY keyset DESC) FROM visible
  ),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g30_admin_audit_page(uuid,bigint,text,integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g30_admin_audit_page(uuid,bigint,text,integer)
 TO service_role;
COMMIT;
