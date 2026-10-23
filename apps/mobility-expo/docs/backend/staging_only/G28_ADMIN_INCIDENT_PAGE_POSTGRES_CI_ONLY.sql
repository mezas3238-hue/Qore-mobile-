-- G28 A05.3: genuine source-of-truth INCIDENTS read model for Admin QA.
-- PostgreSQL 16 disposable_chain ONLY. No production, no remote database.
-- Dependencies: G1/G3/G5/G6/G7/G8 and G27 authority functions.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain' OR
    current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G28 incidents refuses non-disposable database'; END IF;
 IF to_regclass('public.mobility_stage_safety_incidents') IS NULL OR
    to_regclass('public.mobility_stage_backoffice_roles') IS NULL
 THEN RAISE EXCEPTION 'G28 requires verified real G8 and G27 tables'; END IF;
END $guard$;

BEGIN;
-- The keyset uses millisecond precision, as does the B Admin DTO; UUID is
-- its tie-breaker even when SQL timestamps have 6 decimal places.
-- This partial-purpose index improves owner-independent queue scans;
-- no total-record cap or OFFSET is permitted.
CREATE INDEX mobility_stage_g28_incident_queue_desc
 ON public.mobility_stage_safety_incidents(created_at DESC,id DESC);

CREATE FUNCTION public.mobility_stage_g28_admin_incident_page(
 _actor uuid,_anchor_ms bigint,_after text,_limit integer
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE
 response jsonb;
BEGIN
 IF _actor IS NULL OR _anchor_ms IS NULL OR
    _anchor_ms NOT BETWEEN 0 AND 9999999999999 OR
    _anchor_ms > floor(extract(epoch FROM clock_timestamp())*1000)::bigint OR
    _limit IS DISTINCT FROM 50 OR
    (_after IS NOT NULL AND _after !~ '^[0-9]{13}[0-9a-f]{32}$')
 THEN RAISE EXCEPTION 'Invalid G28 read arguments' USING ERRCODE='G2801'; END IF;

 -- This is a second DB guard after verified JWT/MFA/scope in the Node
 -- gateway. Only service_role can EXECUTE the RPC. No browser role can
 -- query all incidents, even with a forged actor ID.
 IF NOT public.mobility_stage_g27_backoffice_has_scope(_actor,'admin.incidents.read')
 THEN RAISE EXCEPTION 'No active exclusive Admin scope' USING ERRCODE='G2801'; END IF;

 WITH keyed AS (
  SELECT i.id,i.subject_kind,i.category,i.severity,i.status,i.revision,
   floor(extract(epoch FROM i.created_at)*1000)::bigint AS ms
  FROM public.mobility_stage_safety_incidents AS i
  WHERE i.created_at <= pg_catalog.to_timestamp(_anchor_ms/1000.0)
 ), ordered AS (
  SELECT *,
   pg_catalog.lpad(ms::text,13,'0') ||
     pg_catalog.replace(id::text,'-','') AS keyset
  FROM keyed
 ), bounded AS (
  SELECT * FROM ordered
  WHERE _after IS NULL OR keyset < _after
  ORDER BY keyset DESC LIMIT 51
 ), visible AS (
  SELECT * FROM bounded ORDER BY keyset DESC LIMIT 50
 )
 SELECT pg_catalog.jsonb_build_object(
  'revision',COALESCE((SELECT max(revision) FROM visible),0),
  'hasMore',(SELECT count(*)>50 FROM bounded),
  'items',COALESCE(
   (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'incidentId',id,
    'category',CASE
      WHEN category IN ('SOS','SAFETY') THEN 'SAFETY'
      WHEN subject_kind='RIDE' THEN 'RIDE'
      WHEN subject_kind='DELIVERY' THEN 'DELIVERY'
      ELSE 'OTHER' END,
    'severity',upper(severity::text),
    'status',CASE WHEN status='dismissed' THEN 'CLOSED'
       ELSE upper(status::text) END,
    'createdAt',ms,
    'revision',revision
   ) ORDER BY keyset DESC) FROM visible),
    '[]'::jsonb)
 ) INTO response;

 RETURN response;
END $body$;

REVOKE ALL ON FUNCTION public.mobility_stage_g28_admin_incident_page(
 uuid,bigint,text,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g28_admin_incident_page(
 uuid,bigint,text,integer) TO service_role;
COMMIT;
