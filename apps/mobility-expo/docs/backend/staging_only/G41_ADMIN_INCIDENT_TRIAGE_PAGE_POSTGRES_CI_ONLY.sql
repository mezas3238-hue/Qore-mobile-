-- G41 / A22 — genuine global Admin severity/status triage; PG16 disposable ONLY.
-- The query filters BEFORE page limits; order is CRITICAL > HIGH > MEDIUM > LOW,
-- then created_at DESC, UUID DESC. 50/page is NOT a global record limit.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g28_admin_incident_page(uuid,bigint,text,integer)') IS NULL
 THEN RAISE EXCEPTION 'G41 refuses non-disposable/incomplete G28 chain'; END IF;
END $guard$;
BEGIN;
CREATE INDEX mobility_stage_g41_incident_triage_severity_status
 ON public.mobility_stage_safety_incidents(severity,status,created_at DESC,id DESC);

CREATE FUNCTION public.mobility_stage_g41_admin_incident_triage_page(
 _actor uuid,_anchor_ms bigint,_after text,_limit integer,
 _severity text,_status text
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE result jsonb;
BEGIN
 IF _actor IS NULL OR _anchor_ms IS NULL
 OR _anchor_ms NOT BETWEEN 0 AND 9999999999999
 OR _anchor_ms>floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint
 OR _limit IS DISTINCT FROM 50
 OR (_after IS NOT NULL AND _after !~ '^[1-4][0-9]{13}[0-9a-f]{32}$')
 OR (_severity IS NOT NULL AND _severity NOT IN('CRITICAL','HIGH','MEDIUM','LOW'))
 OR (_status IS NOT NULL AND _status NOT IN('OPEN','TRIAGED','INVESTIGATING','RESOLVED','CLOSED'))
 THEN RAISE EXCEPTION 'G41 invalid filtered queue parameters' USING ERRCODE='G4101'; END IF;
 IF NOT public.mobility_stage_g27_backoffice_has_scope(_actor,'admin.incidents.read')
 THEN RAISE EXCEPTION 'G41 exclusive active Admin required' USING ERRCODE='G4101'; END IF;

 WITH candidates AS (
  SELECT i.id,i.subject_kind,i.category,i.severity,i.status,i.revision,
   floor(extract(epoch FROM i.created_at)*1000)::bigint AS ms,
   CASE i.severity
    WHEN 'CRITICAL' THEN '4' WHEN 'HIGH' THEN '3'
    WHEN 'MEDIUM' THEN '2' ELSE '1' END AS priority
  FROM public.mobility_stage_safety_incidents i
  WHERE i.created_at<=pg_catalog.to_timestamp(_anchor_ms/1000.0)
   AND (_severity IS NULL OR i.severity::text=_severity)
   AND (_status IS NULL OR (
      CASE WHEN i.status='dismissed' THEN 'CLOSED'
       ELSE upper(i.status::text) END)=_status)
 ), keyed AS (
  SELECT *,priority||pg_catalog.lpad(ms::text,13,'0')||
   pg_catalog.replace(id::text,'-','') AS keyset
  FROM candidates
 ), bounded AS (
  SELECT * FROM keyed
  WHERE _after IS NULL OR keyset<_after
  ORDER BY keyset DESC LIMIT 51
 ), visible AS (
  SELECT * FROM bounded ORDER BY keyset DESC LIMIT 50
 )
 SELECT pg_catalog.jsonb_build_object(
  'revision',COALESCE((SELECT max(revision) FROM visible),0),
  'hasMore',(SELECT count(*)>50 FROM bounded),
  'items',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'incidentId',id,
   'category',CASE WHEN category IN('SOS','SAFETY') THEN 'SAFETY'
     WHEN subject_kind='RIDE' THEN 'RIDE'
     WHEN subject_kind='DELIVERY' THEN 'DELIVERY' ELSE 'OTHER' END,
   'severity',upper(severity::text),
   'status',CASE WHEN status='dismissed' THEN 'CLOSED'
     ELSE upper(status::text) END,
   'createdAt',ms,'revision',revision
  ) ORDER BY keyset DESC) FROM visible),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g41_admin_incident_triage_page(
 uuid,bigint,text,integer,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g41_admin_incident_triage_page(
 uuid,bigint,text,integer,text,text) TO service_role;
COMMIT;
