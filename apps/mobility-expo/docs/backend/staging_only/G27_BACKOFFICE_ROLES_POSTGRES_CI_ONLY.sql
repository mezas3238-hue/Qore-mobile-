-- G27 A04.2: Admin/Owner authority registry for disposable PostgreSQL QA ONLY.
-- No remote STAGING, no Supabase deploy, no privileged browser Auth and NO LIVE.
-- Owner finance is not Admin KYC, nor an inherited form of native "admin".
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain' OR
  current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G27 backoffice authority refuses non-disposable DB'; END IF;
 IF to_regclass('public.mobility_stage_backoffice_roles') IS NOT NULL
 THEN RAISE EXCEPTION 'G27 backoffice schema already applied'; END IF;
END $guard$;

BEGIN;
CREATE TABLE public.mobility_stage_backoffice_roles (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
 role text NOT NULL CHECK(role IN ('admin','owner')),
 status text NOT NULL DEFAULT 'pending'
  CHECK(status IN ('pending','active','suspended')),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 approved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 approved_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
ALTER TABLE public.mobility_stage_backoffice_roles ENABLE ROW LEVEL SECURITY;
-- No public, anon, authenticated or generic service_role can write role grants.
REVOKE ALL ON public.mobility_stage_backoffice_roles
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.mobility_stage_backoffice_roles TO service_role;
CREATE POLICY mobility_stage_backoffice_service_read
 ON public.mobility_stage_backoffice_roles FOR SELECT TO service_role USING(true);

-- Small SECURITY DEFINER functions can see BOTH backoffice and native roles
-- under RLS. They are callable ONLY by the trusted backend's service_role.
-- Any passenger/driver/native admin assignment makes backoffice authority
-- invalid; this prevents ambiguous dual-role identities during migration.
CREATE FUNCTION public.mobility_stage_g27_backoffice_role_of(_user uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $safe$
 SELECT br.role
 FROM public.mobility_stage_backoffice_roles AS br
 WHERE br.user_id=_user AND br.status='active'
  AND NOT EXISTS(
   SELECT 1 FROM public.user_roles AS native
   WHERE native.user_id=_user
  )
 LIMIT 1
$safe$;

CREATE FUNCTION public.mobility_stage_g27_backoffice_has_scope(
 _user uuid,_scope text
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $safe$
 SELECT COALESCE(EXISTS(
  SELECT 1 FROM public.mobility_stage_backoffice_roles AS br
  WHERE br.user_id=_user AND br.status='active'
   AND NOT EXISTS(
    SELECT 1 FROM public.user_roles AS native
    WHERE native.user_id=_user
   )
   AND (
    (br.role='admin' AND _scope IN
     ('admin.kyc.read','admin.zones.read',
      'admin.incidents.read','admin.audit.read'))
    OR
    (br.role='owner' AND _scope='owner.finance.read')
   )
 ),false)
$safe$;

REVOKE ALL ON FUNCTION public.mobility_stage_g27_backoffice_role_of(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g27_backoffice_has_scope(uuid,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g27_backoffice_role_of(uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g27_backoffice_has_scope(uuid,text)
 TO service_role;
COMMIT;
