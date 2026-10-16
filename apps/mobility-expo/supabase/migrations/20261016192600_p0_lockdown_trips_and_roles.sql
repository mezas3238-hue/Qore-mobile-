-- QORE Mobility P0-SEC-001: reversible operational RPC lockdown.
-- 2026-10-16. Generated from actual pg_proc/pg_policies read-only metadata.
-- WARNING: execute only by authorized DB operator, with backup + environment review.
-- NO commercial trips, dispatch, GPS broadcasts or passenger payments.
-- Do NOT GRANT these functions to authenticated until gates G1-G6 are signed.
BEGIN;

-- Fail if a prerequisite disappears: transactional rollback rather than partial lockdown.
DO $guard$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n
 FROM pg_catalog.pg_proc p
 JOIN pg_catalog.pg_namespace s ON s.oid=p.pronamespace
 WHERE s.nspname='public'
   AND p.proname IN ('request_ride','accept_ride','advance_ride','cancel_ride',
     'set_driver_availability','get_nearby_requests','get_ride_counterpart','rate_ride');
 IF n <> 8 THEN
   RAISE EXCEPTION 'QORE Mobility lockdown expected 8 RPC functions; found %. No changes applied.',n;
 END IF;
END
$guard$;

-- All eight are unavailable to mobile clients and anonymous callers.
-- Retain service_role for controlled future backend administration only.
REVOKE EXECUTE ON FUNCTION public.request_ride(public.vehicle_category, text, double precision, double precision, text, double precision, double precision) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_ride(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.advance_ride(uuid, public.ride_status) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_ride(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_driver_availability(boolean, double precision, double precision) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_nearby_requests() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_ride_counterpart(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rate_ride(uuid, integer, text) FROM PUBLIC, anon, authenticated;

-- Original helpers had PUBLIC/anon EXECUTE, allowing role/provisioning lookups.
-- Restrict the subject to the current JWT principal. Policies that call
-- has_role(auth.uid(),'admin') still function; no cross-user role probing.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
 SELECT COALESCE(_user_id = auth.uid() AND EXISTS (
   SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
 ), false)
$function$;

CREATE OR REPLACE FUNCTION public.is_approved_driver(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
 SELECT COALESCE(_uid = auth.uid()
   AND public.has_role(_uid,'driver'::public.app_role)
   AND EXISTS (SELECT 1 FROM public.driver_applications
               WHERE user_id = _uid AND status = 'approved'::public.application_status),
 false)
$function$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_approved_driver(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
-- Preserve EXECUTE for authenticated to support existing server-protected RLS.
-- signup trigger will still execute as DB-owned trigger.
COMMIT;
