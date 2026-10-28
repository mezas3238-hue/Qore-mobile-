-- G29 A05.4 — source-backed AUTO-only Admin KYC review queue.
-- Disposable PostgreSQL 16 ONLY; never run on connected Supabase.
-- G2 base vehicles+revision, G17 private evidence, G27 exclusive Auth.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G29 KYC refuses non-disposable PostgreSQL'; END IF;
 IF to_regclass('public.mobility_vehicles') IS NULL
 OR to_regclass('public.mobility_stage_driver_documents') IS NULL
 OR to_regclass('public.mobility_stage_backoffice_roles') IS NULL
 OR NOT EXISTS(
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='mobility_vehicles' AND column_name='revision')
 THEN RAISE EXCEPTION 'G29 needs real G2 revision, G17 documents and G27 authority'; END IF;
END $guard$;
BEGIN;
CREATE INDEX mobility_stage_g29_kyc_pending_desc
 ON public.mobility_vehicles(id DESC)
 WHERE vehicle_kind='AUTO' AND review_status='pending';

CREATE FUNCTION public.mobility_stage_g29_admin_kyc_page(
 _actor uuid,_anchor_ms bigint,_after text,_limit integer
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE result jsonb;
BEGIN
 IF _actor IS NULL OR _anchor_ms IS NULL
  OR _anchor_ms NOT BETWEEN 0 AND 9999999999999
  OR _anchor_ms>floor(extract(epoch FROM clock_timestamp())*1000)::bigint
  OR _limit IS DISTINCT FROM 50
  OR (_after IS NOT NULL AND _after !~ '^[0-9a-f]{32}$')
 THEN RAISE EXCEPTION 'Invalid G29 read arguments' USING ERRCODE='G2901'; END IF;

 IF NOT public.mobility_stage_g27_backoffice_has_scope(_actor,'admin.kyc.read')
 THEN RAISE EXCEPTION 'Exclusive active Admin KYC permission required'
  USING ERRCODE='G2901'; END IF;

 -- Pending AUTO applications only. G2 MOTO is explicitly PASSENGER, not
 -- MOTO_DELIVERY, so it MUST NOT be relabelled or silently approved.
 -- G17 evidence statuses are source truth; G2 compliance is needed
 -- before 'approved' evidence can truthfully become 'valid'.
 -- No date verification => pending, expired dates => expired.
 WITH selected AS (
  SELECT v.id,v.driver_id,v.revision,
   pg_catalog.replace(v.id::text,'-','') AS keyset
  FROM public.mobility_vehicles v
  WHERE v.vehicle_kind='AUTO' AND v.review_status='pending'
   AND v.created_at<=pg_catalog.to_timestamp(_anchor_ms/1000.0)
   AND (_after IS NULL OR pg_catalog.replace(v.id::text,'-','')<_after)
  ORDER BY v.id DESC LIMIT 51
 ), bounded AS (
  SELECT * FROM selected ORDER BY keyset DESC LIMIT 50
 ), review AS (
  SELECT v.id,v.revision,v.keyset,
   CASE
    WHEN license.status='approved'
     AND dc.license_valid_through<CURRENT_DATE THEN 'expired'
    WHEN license.status='approved'
     AND dc.driver_review_status='approved'
     AND dc.license_valid_through>=CURRENT_DATE
     AND dc.license_verified_at<=pg_catalog.clock_timestamp()
     AND dc.license_verified_by<>v.driver_id THEN 'valid'
    WHEN license.status='approved' THEN 'pending'
    ELSE license.status END AS license_status,
   CASE
    WHEN insurance.status='approved'
     AND vc.insurance_valid_through<CURRENT_DATE THEN 'expired'
    WHEN insurance.status='approved'
     AND vc.insurance_valid_through>=CURRENT_DATE
     AND vc.insurance_verified_at<=pg_catalog.clock_timestamp()
     AND vc.paid_passenger_insurance_covered=true
     AND vc.reviewed_by<>v.driver_id THEN 'valid'
    WHEN insurance.status='approved' THEN 'pending'
    ELSE insurance.status END AS insurance_status,
   CASE
    WHEN inspection.status='approved'
     AND vc.inspection_valid_through<CURRENT_DATE THEN 'expired'
    WHEN inspection.status='approved'
     AND vc.inspection_valid_through>=CURRENT_DATE
     AND vc.inspection_verified_at<=pg_catalog.clock_timestamp()
     AND vc.reviewed_by<>v.driver_id THEN 'valid'
    WHEN inspection.status='approved' THEN 'pending'
    ELSE inspection.status END AS inspection_status
  FROM bounded v
  LEFT JOIN public.mobility_driver_compliance dc ON dc.driver_id=v.driver_id
  LEFT JOIN public.mobility_vehicle_compliance vc ON vc.vehicle_id=v.id
  LEFT JOIN LATERAL (
   SELECT d.status::text AS status
   FROM public.mobility_stage_driver_documents d
   WHERE d.driver_id=v.driver_id AND d.kind='licencia'
   ORDER BY d.submitted_at DESC,d.id DESC LIMIT 1
  ) license ON true
  LEFT JOIN LATERAL (
   SELECT d.status::text AS status
   FROM public.mobility_stage_driver_documents d
   WHERE d.driver_id=v.driver_id AND d.kind='seguro'
   ORDER BY d.submitted_at DESC,d.id DESC LIMIT 1
  ) insurance ON true
  LEFT JOIN LATERAL (
   SELECT d.status::text AS status
   FROM public.mobility_stage_driver_documents d
   WHERE d.driver_id=v.driver_id AND d.kind='inspeccion'
   ORDER BY d.submitted_at DESC,d.id DESC LIMIT 1
  ) inspection ON true
 )
 SELECT pg_catalog.jsonb_build_object(
  'revision',COALESCE((SELECT max(revision) FROM review),0),
  'hasMore',(SELECT count(*)>50 FROM selected),
  'items',COALESCE((
   SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'vehicleId',id,'vehicleKind','AUTO','applicationStatus','pending',
    'licenseStatus',COALESCE(license_status,'missing'),
    'insuranceStatus',COALESCE(insurance_status,'missing'),
    'inspectionStatus',COALESCE(inspection_status,'missing'),
    'reviewRevision',revision
   ) ORDER BY keyset DESC)
   FROM review
  ),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END $body$;

REVOKE ALL ON FUNCTION public.mobility_stage_g29_admin_kyc_page(uuid,bigint,text,integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g29_admin_kyc_page(uuid,bigint,text,integer)
 TO service_role;
COMMIT;
