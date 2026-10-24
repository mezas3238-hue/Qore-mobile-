-- G20 KYC/license continuity gate for AUTO passenger rides and cargo courier offers.
-- PG16 DISPOSABLE CI ONLY. Apply only AFTER G17-G18 and historical assertions.
-- Replaces original preflight bodies preserving their G2/G5 checks, plus a
-- fail-closed condition on the latest reviewed Driver license evidence.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G20 refuses non-disposable database'; END IF;
END $guard$;
BEGIN;
-- SECURITY INVOKER, service_role only. Latest by same stable sort as G17.
-- A previous approved license never rescues a newly pending or rejected one.
CREATE FUNCTION public.mobility_stage_driver_current_license_approved(
 _driver_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $fn$
 SELECT COALESCE(
   _driver_id IS NOT NULL
   AND (SELECT count(*) FROM public.user_roles roles
        WHERE roles.user_id=_driver_id)=1
   AND EXISTS(SELECT 1 FROM public.user_roles roles
        WHERE roles.user_id=_driver_id
          AND roles.role='driver'::public.app_role)
   AND EXISTS(
    SELECT 1 FROM public.mobility_stage_driver_documents doc
    JOIN public.mobility_stage_driver_document_reviews audit
      ON audit.document_id=doc.id
     AND audit.reviewer_id=doc.reviewer_id
     AND audit.status='approved'::public.mobility_stage_driver_document_status
    WHERE doc.id=(
     SELECT d.id FROM public.mobility_stage_driver_documents d
      WHERE d.driver_id=_driver_id
        AND d.kind='licencia'::public.mobility_stage_driver_document_kind
      ORDER BY d.submitted_at DESC,d.id DESC LIMIT 1
    )
      AND doc.driver_id=_driver_id
      AND doc.kind='licencia'::public.mobility_stage_driver_document_kind
      AND doc.status='approved'::public.mobility_stage_driver_document_status
      AND doc.reviewer_id<>doc.driver_id
      AND doc.reviewed_at IS NOT NULL
      AND doc.reviewed_at>=doc.submitted_at
      AND doc.reviewed_at<=pg_catalog.clock_timestamp()
      AND (SELECT count(*) FROM public.user_roles reviewer
            WHERE reviewer.user_id=doc.reviewer_id)=1
      AND EXISTS(SELECT 1 FROM public.user_roles reviewer
       WHERE reviewer.user_id=doc.reviewer_id
         AND reviewer.role='admin'::public.app_role)
   ),false)
$fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_driver_current_license_approved(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_driver_current_license_approved(uuid)
 TO service_role;

-- Replace BOTH legacy preflight entry points; offer creation and acceptance
-- already call them, therefore a last-second KYC change cannot be bypassed.
-- The originals remain as additional necessary gates. Not LIVE eligibility.
CREATE OR REPLACE FUNCTION public.mobility_vehicle_preflight(
  _driver_id uuid, _vehicle_id uuid, _service public.mobility_service_kind
) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $function$
 SELECT COALESCE(EXISTS(
  SELECT 1
  FROM public.mobility_vehicles v
  JOIN public.mobility_driver_compliance dc ON dc.driver_id=v.driver_id
  JOIN public.mobility_vehicle_compliance vc ON vc.vehicle_id=v.id
  JOIN public.user_roles dr ON dr.user_id=v.driver_id AND dr.role='driver'::public.app_role
  JOIN public.user_roles d_reviewer ON d_reviewer.user_id=dc.license_verified_by
    AND d_reviewer.role='admin'::public.app_role
  JOIN public.user_roles v_reviewer ON v_reviewer.user_id=vc.reviewed_by
    AND v_reviewer.role='admin'::public.app_role
  JOIN public.driver_locations loc ON loc.driver_id=v.driver_id
  JOIN public.mobility_location_consents lc ON lc.driver_id=v.driver_id
  WHERE v.id=_vehicle_id AND v.driver_id=_driver_id AND v.service_kind=_service
    AND v.review_status='approved'::public.mobility_review_status
    AND dc.driver_review_status='approved'::public.mobility_review_status
    AND dc.license_verified_by<>v.driver_id AND vc.reviewed_by<>v.driver_id
    AND dc.license_valid_through>=CURRENT_DATE
    AND dc.license_verified_at<=now()
    AND vc.registration_valid_through>=CURRENT_DATE
    AND vc.insurance_valid_through>=CURRENT_DATE
    AND vc.inspection_valid_through>=CURRENT_DATE
    AND vc.municipal_authorization_valid_through>=CURRENT_DATE
    AND vc.paid_passenger_insurance_covered=true
    AND vc.registration_verified_at<=now()
    AND vc.insurance_verified_at<=now()
    AND vc.inspection_verified_at<=now()
    AND vc.municipal_authorization_verified_at<=now()
    AND vc.reviewed_at<=now()
    AND public.mobility_stage_driver_current_license_approved(v.driver_id)
    AND loc.available=true AND loc.lat BETWEEN -90 AND 90
    AND loc.lng BETWEEN -180 AND 180
    AND loc.updated_at >= now()-interval '120 seconds'
    AND loc.updated_at <= now()+interval '15 seconds'
    AND lc.revoked_at IS NULL AND lc.opted_in_at<=loc.updated_at
    AND (
      -- MOTO deliberately fails closed: no independently verified
      -- passenger-age and trip-zone authorizations are yet implemented.
      (v.vehicle_kind='AUTO'::public.mobility_vehicle_kind
       AND v.service_kind IN ('economico','confort','xl'))
      OR (false AND v.vehicle_kind='MOTO'::public.mobility_vehicle_kind
       AND vc.moto_helmets_verified=2
       AND vc.moto_reflective_vests_verified=2
       AND vc.moto_routes_authorized=true)
    )
 ),false)
$function$;

CREATE OR REPLACE FUNCTION public.mobility_stage_delivery_courier_preflight(
 _courier_id uuid,_vehicle_id uuid,_delivery_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $body$
 SELECT COALESCE(EXISTS(
  SELECT 1
  FROM public.mobility_stage_deliveries d
  JOIN public.mobility_vehicles v ON v.id=_vehicle_id AND v.driver_id=_courier_id
  JOIN public.mobility_stage_delivery_vehicle_clearance c ON c.vehicle_id=v.id
  JOIN public.mobility_driver_compliance dc ON dc.driver_id=v.driver_id
  JOIN public.user_roles ur ON ur.user_id=v.driver_id
    AND ur.role='driver'::public.app_role
  JOIN public.user_roles reviewer ON reviewer.user_id=c.reviewed_by
    AND reviewer.role='admin'::public.app_role
  JOIN public.driver_locations loc ON loc.driver_id=v.driver_id
  JOIN public.mobility_location_consents consent ON consent.driver_id=v.driver_id
  WHERE d.id=_delivery_id AND d.status='requested'
    AND d.sender_id<>_courier_id
    AND v.vehicle_kind=d.requested_vehicle_kind
    AND v.review_status NOT IN ('rejected','suspended')
    AND dc.driver_review_status='approved'
    AND dc.license_valid_through>=CURRENT_DATE
    AND c.delivery_authorized=true
    AND c.cargo_insurance_valid_through>=CURRENT_DATE
    AND c.reviewed_by<>_courier_id
    AND c.cargo_insurance_verified_at<=now() AND c.reviewed_at<=now()
    AND d.grams<=c.max_grams
    AND d.length_cm*d.width_cm*d.height_cm<=c.max_volume_cm3
    AND GREATEST(d.length_cm,d.width_cm,d.height_cm)<=c.max_edge_cm
    AND public.mobility_stage_driver_current_license_approved(v.driver_id)
    AND loc.available=true AND loc.updated_at>=now()-interval '120 seconds'
    AND loc.updated_at<=now()+interval '15 seconds'
    AND consent.revoked_at IS NULL AND consent.opted_in_at<=loc.updated_at
    AND NOT EXISTS(
     SELECT 1 FROM public.mobility_stage_auto_demo_trips trip
     WHERE trip.driver_id=_courier_id
       AND trip.status IN ('accepted','arriving','in_progress')
    )
    AND NOT EXISTS(
     SELECT 1 FROM public.mobility_stage_deliveries busy
     WHERE busy.courier_id=_courier_id AND busy.id<>d.id
       AND busy.status IN ('accepted','picked_up','disputed')
    )
 ),false)
$body$;
REVOKE ALL ON FUNCTION public.mobility_vehicle_preflight(
 uuid,uuid,public.mobility_service_kind) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_delivery_courier_preflight(
 uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_vehicle_preflight(
 uuid,uuid,public.mobility_service_kind) TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_delivery_courier_preflight(
 uuid,uuid,uuid) TO service_role;
COMMIT;
