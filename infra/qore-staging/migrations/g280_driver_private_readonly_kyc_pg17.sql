-- G280 — private Driver document status + current-license review gates.
-- Supabase PostgreSQL 17 STAGING candidate, NOT a KYC approval mechanism.
-- No writes, no synthetic documents, no LIVE/PSP. Server RPC only.
-- This migration must not be applied until PG16/17 CI, review and STAGING approval.
DO $guard$ BEGIN
 IF to_regnamespace('qore_stage_internal') IS NULL
 OR to_regclass('public.user_roles') IS NULL
 OR to_regclass('public.mobility_stage_driver_documents') IS NULL
 OR to_regclass('public.mobility_stage_driver_document_reviews') IS NULL
 OR to_regclass('public.mobility_driver_compliance') IS NULL
 OR to_regclass('public.mobility_stage_backoffice_roles') IS NULL
 THEN RAISE EXCEPTION 'G280 base schema unavailable; no DDL'; END IF;
END $guard$;

-- Returns a Driver's latest row for each of the eight document kinds, never
-- private object keys, bucket, hashes, bytes or another Driver's records.
CREATE FUNCTION qore_stage_internal.mobility_stage_read_driver_document_status(
 _driver_id uuid
) RETURNS TABLE(kind text,status text,submitted_at timestamptz,reviewed_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT DISTINCT ON (d.kind)
   d.kind::text,d.status::text,d.submitted_at,d.reviewed_at
 FROM public.mobility_stage_driver_documents d
 WHERE d.driver_id=$1 AND EXISTS (
  SELECT 1 FROM public.user_roles r
   WHERE r.user_id=$1 AND r.role='driver'::public.app_role)
 ORDER BY d.kind,d.submitted_at DESC,d.id DESC
$f$;

CREATE FUNCTION public.mobility_stage_read_driver_document_status(
 _driver_id uuid
) RETURNS TABLE(kind text,status text,submitted_at timestamptz,reviewed_at timestamptz)
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $f$
 SELECT x.kind,x.status,x.submitted_at,x.reviewed_at
 FROM qore_stage_internal.mobility_stage_read_driver_document_status($1) x
$f$;

-- READ-ONLY. True requires BOTH a current approved compliance record and a
-- reviewed approved license document, with active independently approved G27
-- backoffice reviewers. A native 'admin' role never counts as authorization.
-- Even true means license review ONLY, never Driver dispatch eligibility.
CREATE FUNCTION qore_stage_internal.mobility_stage_driver_current_license_approved(
 _driver_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT EXISTS (
 SELECT 1
 FROM public.mobility_driver_compliance c
 JOIN public.user_roles driver_role
   ON driver_role.user_id=c.driver_id
     AND driver_role.role='driver'::public.app_role
 JOIN public.mobility_stage_driver_documents d
   ON d.driver_id=c.driver_id
     AND d.kind='licencia'::public.mobility_stage_driver_document_kind
     AND d.status='approved'::public.mobility_stage_driver_document_status
     AND d.reviewed_at IS NOT NULL AND d.reviewer_id IS NOT NULL
 JOIN public.mobility_stage_driver_document_reviews review
   ON review.document_id=d.id
     AND review.reviewer_id=d.reviewer_id
     AND review.status='approved'::public.mobility_stage_driver_document_status
     AND review.reviewed_at=d.reviewed_at
 JOIN public.mobility_stage_backoffice_roles reviewer_role
   ON reviewer_role.user_id=review.reviewer_id
     AND reviewer_role.status='active'
     AND reviewer_role.role IN ('admin','owner')
     AND reviewer_role.approved_by IS NOT NULL
     AND reviewer_role.approved_by<>reviewer_role.user_id
 JOIN public.mobility_stage_backoffice_roles license_reviewer_role
   ON license_reviewer_role.user_id=c.license_verified_by
     AND license_reviewer_role.status='active'
     AND license_reviewer_role.role IN ('admin','owner')
     AND license_reviewer_role.approved_by IS NOT NULL
     AND license_reviewer_role.approved_by<>license_reviewer_role.user_id
 WHERE c.driver_id=$1
   AND c.driver_review_status='approved'::public.mobility_review_status
   AND c.license_valid_through>=CURRENT_DATE
   AND c.license_verified_at<=pg_catalog.clock_timestamp()
   AND c.license_verified_at>=review.reviewed_at
   AND d.submitted_at<=review.reviewed_at
   AND review.reviewer_id<>c.driver_id
   AND c.license_verified_by<>c.driver_id
 )
$f$;

CREATE FUNCTION public.mobility_stage_driver_current_license_approved(
 _driver_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $f$
 SELECT qore_stage_internal.mobility_stage_driver_current_license_approved($1)
$f$;

REVOKE ALL ON FUNCTION public.mobility_stage_read_driver_document_status(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION qore_stage_internal.mobility_stage_read_driver_document_status(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_driver_current_license_approved(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION qore_stage_internal.mobility_stage_driver_current_license_approved(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_read_driver_document_status(uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION qore_stage_internal.mobility_stage_read_driver_document_status(uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_driver_current_license_approved(uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION qore_stage_internal.mobility_stage_driver_current_license_approved(uuid)
 TO service_role;
