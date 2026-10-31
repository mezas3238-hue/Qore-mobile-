-- QORE G244: independently reviewed STAGING adaptation of existing G2
-- Never deploy on production; requires explicit project mrjzxftsdxzepzbcuids.
-- No synthetic credentials, approvals, trips, payments or public signup.
BEGIN;
DO $guard$
BEGIN
 IF to_regclass('public.mobility_location_consents') IS NOT NULL
 OR to_regprocedure('public.mobility_vehicle_preflight(uuid,uuid,public.mobility_service_kind)') IS NOT NULL
 OR to_regclass('public.mobility_vehicle_compliance') IS NULL
 OR to_regclass('public.mobility_driver_compliance') IS NULL
 THEN RAISE EXCEPTION 'G244 preflight prerequisites mismatch or already installed'; END IF;
END
$guard$;

-- Consent record exclusively maintained by a trusted backend following a
-- verified driver opt-in; not a direct client-writeable boolean.
CREATE TABLE public.mobility_location_consents (
  driver_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  opted_in_at timestamptz NOT NULL,
  revoked_at timestamptz,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (revoked_at IS NULL OR revoked_at >= opted_in_at)
);
ALTER TABLE public.mobility_location_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_location_consents FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.mobility_location_consents TO service_role;

-- SECURITY INVOKER deliberately keeps normal RLS/grants. Exposed only to
-- service_role, never to a mobile client or generic authenticated caller.
-- A preflight true is a *necessary*, NEVER SUFFICIENT, condition for a
-- future server-controlled assignment transaction.
CREATE FUNCTION public.mobility_vehicle_preflight(
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

REVOKE ALL ON FUNCTION public.mobility_vehicle_preflight(
  uuid,uuid,public.mobility_service_kind
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_vehicle_preflight(
  uuid,uuid,public.mobility_service_kind
) TO service_role;
COMMIT;
