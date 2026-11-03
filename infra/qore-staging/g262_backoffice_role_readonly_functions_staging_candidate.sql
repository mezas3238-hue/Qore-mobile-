-- G262: private read-only backoffice authorization RPCs for isolated QORE
-- Supabase STAGING mrjzxftsdxzepzbcuids (PostgreSQL 17).
-- Never run in LIVE. No automatic Owner/Admin grants, roles or fake sessions.
-- Source must be reviewed before applying. This script performs DDL only.
--
-- WARNING: no login creates backoffice authority; approval is independently
-- controlled. A native role (passenger/driver/admin) prevents backoffice use.
-- Backend must verify the real Auth session + G42 and Admin MFA AAL2 before
-- invoking these RPCs; _user alone is not an authentication proof.
BEGIN;
DO $guard$
BEGIN
 IF current_setting('server_version_num')::integer < 170000
    OR to_regclass('public.mobility_stage_backoffice_roles') IS NULL
    OR to_regclass('public.user_roles') IS NULL
    OR to_regclass('auth.users') IS NULL
    OR to_regprocedure('public.mobility_stage_g42_session_active(uuid,uuid,bigint)') IS NULL
    OR to_regprocedure('public.mobility_stage_g27_backoffice_role_of(uuid)') IS NOT NULL
    OR to_regprocedure('public.mobility_stage_g27_backoffice_has_scope(uuid,text)') IS NOT NULL
    OR (SELECT count(*) FROM auth.users) <> 0
 THEN
  RAISE EXCEPTION 'G262 refuses unverified/occupied STAGING or existing G27';
 END IF;
 IF NOT has_table_privilege('service_role',
     'public.mobility_stage_backoffice_roles','SELECT')
    OR NOT has_table_privilege('service_role','public.user_roles','SELECT')
 THEN RAISE EXCEPTION 'G262 requires existing restricted service-only reads';
 END IF;
END $guard$;

-- SECURITY INVOKER: never elevate arbitrary callers through SECURITY DEFINER.
-- Only server-side service_role has EXECUTE; public Data API cannot invoke.
CREATE FUNCTION public.mobility_stage_g27_backoffice_role_of(_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $f$
 SELECT br.role
 FROM public.mobility_stage_backoffice_roles br
 WHERE br.user_id = _user AND br.status = 'active'
   AND br.approved_by <> br.user_id
   AND NOT EXISTS (
    SELECT 1 FROM public.user_roles native_role
    WHERE native_role.user_id = _user
   )
 LIMIT 1
$f$;

CREATE FUNCTION public.mobility_stage_g27_backoffice_has_scope(
 _user uuid, _scope text
) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $f$
 SELECT COALESCE(EXISTS (
  SELECT 1 FROM public.mobility_stage_backoffice_roles br
  WHERE br.user_id = _user AND br.status = 'active'
   AND br.approved_by <> br.user_id
   AND NOT EXISTS(
    SELECT 1 FROM public.user_roles native_role
    WHERE native_role.user_id = _user
   )
   AND (
    (br.role = 'admin' AND _scope IN (
     'admin.kyc.read', 'admin.zones.read',
     'admin.incidents.read', 'admin.audit.read'
    ))
    OR (br.role = 'owner' AND _scope = 'owner.finance.read')
   )
 ),false)
$f$;

REVOKE ALL ON FUNCTION public.mobility_stage_g27_backoffice_role_of(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g27_backoffice_has_scope(uuid,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g27_backoffice_role_of(uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g27_backoffice_has_scope(uuid,text)
 TO service_role;
COMMIT;
