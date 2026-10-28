-- G40 / A21 — trusted, minimal, owner-only incident receipts.
-- PostgreSQL 16 DISPOSABLE ONLY. No real reporting/dispatch/emergency service.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain' OR
 current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_safety_incidents') IS NULL
 OR to_regclass('public.mobility_stage_safety_incident_events') IS NULL
 OR to_regprocedure('public.mobility_stage_g38_acceptance_fence()') IS NULL
 THEN RAISE EXCEPTION 'G40 refuses non-disposable or incomplete G38 chain'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g40_report_receipt(
 _reporter uuid,_request_key uuid,_subject_kind public.mobility_stage_safety_subject,
 _subject_id uuid,_category public.mobility_stage_incident_category,
 _severity public.mobility_stage_incident_severity
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE
 created_incident_id uuid;
 receipt_id uuid;
 result jsonb;
 issue_message text;
BEGIN
 IF _reporter IS NULL OR _request_key IS NULL OR _subject_kind IS NULL
 OR _subject_id IS NULL OR _category IS NULL OR _severity IS NULL
 OR _category='SOS' OR _severity='CRITICAL'
 THEN RAISE EXCEPTION 'G40 emergency channel not certified or invalid report'
  USING ERRCODE='G4003'; END IF;
 BEGIN
  created_incident_id:=public.mobility_stage_safety_report(
   _reporter,_request_key,_subject_kind,_subject_id,_category,_severity);
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS issue_message=MESSAGE_TEXT;
  IF issue_message='Conflicting safety report replay'
  THEN RAISE EXCEPTION 'G40 incident idempotency conflict'
    USING ERRCODE='G4009'; END IF;
  RAISE;
 END;
 SELECT e.id INTO receipt_id
 FROM public.mobility_stage_safety_incident_events e
 WHERE e.request_key=_request_key AND e.incident_id=created_incident_id
 AND e.actor_id=_reporter AND e.action='report'
 AND e.next_status='open' AND e.incident_revision=1;
 IF receipt_id IS NULL THEN
  RAISE EXCEPTION 'G40 durable incident receipt missing'
   USING ERRCODE='G4003'; END IF;
 SELECT pg_catalog.jsonb_build_object(
  'incidentId',i.id,'receiptId',receipt_id,
  'state',i.status::text,'revision',i.revision,
  'createdAt',i.created_at,'observedAt',i.changed_at,
  'receiptStatus','RECEIVED_IN_QA_DATABASE_ONLY'
 ) INTO result
 FROM public.mobility_stage_safety_incidents i
 WHERE i.id=created_incident_id AND i.reporter_id=_reporter;
 IF result IS NULL THEN
  RAISE EXCEPTION 'G40 incident ownership evidence missing'
   USING ERRCODE='G4003'; END IF;
 RETURN result;
END $body$;

CREATE FUNCTION public.mobility_stage_g40_owner_incident_status(
 _reporter uuid,_incident_id uuid
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $body$
 SELECT pg_catalog.jsonb_build_object(
 'incidentId',i.id,'receiptId',e.id,'state',i.status::text,
 'revision',i.revision,'createdAt',i.created_at,
 'observedAt',i.changed_at,
 'receiptStatus','RECEIVED_IN_QA_DATABASE_ONLY'
 )
 FROM public.mobility_stage_safety_incidents i
 JOIN public.mobility_stage_safety_incident_events e
 ON e.incident_id=i.id AND e.action='report' AND e.incident_revision=1
 WHERE i.id=_incident_id AND i.reporter_id=_reporter
 LIMIT 1
$body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g40_report_receipt(
 uuid,uuid,public.mobility_stage_safety_subject,uuid,
 public.mobility_stage_incident_category,public.mobility_stage_incident_severity)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g40_owner_incident_status(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g40_report_receipt(
 uuid,uuid,public.mobility_stage_safety_subject,uuid,
 public.mobility_stage_incident_category,public.mobility_stage_incident_severity)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g40_owner_incident_status(uuid,uuid)
 TO service_role;
COMMIT;
