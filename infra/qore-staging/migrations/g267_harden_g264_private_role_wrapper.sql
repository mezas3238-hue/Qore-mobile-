-- G267: security review hardening for G264.
-- Move privileged table inspection out of exposed public Data API.
-- public wrapper is SECURITY INVOKER. Private definer exposes only own
-- verified AAL2 role to authenticated, no parameter or arbitrary UUID.
-- Never create user, alter native roles or enable LIVE.
CREATE SCHEMA IF NOT EXISTS qore_backoffice_private;
REVOKE ALL ON SCHEMA qore_backoffice_private FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION qore_backoffice_private.g264_self_role_strict()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $private$
 SELECT CASE WHEN auth.uid() IS NULL OR
   auth.jwt()->>'aal' IS DISTINCT FROM 'aal2' OR
   auth.role() IS DISTINCT FROM 'authenticated'
 THEN NULL::text
 ELSE (
  SELECT CASE WHEN COUNT(*)=1 AND MIN(br.role) IN ('admin','owner')
   THEN MIN(br.role)::text ELSE NULL::text END
  FROM public.mobility_stage_backoffice_roles br
  WHERE br.user_id=auth.uid() AND br.status='active'
   AND br.approved_by IS NOT NULL AND br.approved_by<>br.user_id
   AND NOT EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id=br.user_id)
 )
 END;
$private$;
REVOKE ALL ON FUNCTION qore_backoffice_private.g264_self_role_strict()
 FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA qore_backoffice_private TO authenticated;
GRANT EXECUTE ON FUNCTION qore_backoffice_private.g264_self_role_strict()
 TO authenticated;
CREATE OR REPLACE FUNCTION public.mobility_stage_g264_my_backoffice_role()
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=''
AS $public$
 SELECT qore_backoffice_private.g264_self_role_strict();
$public$;
REVOKE ALL ON FUNCTION public.mobility_stage_g264_my_backoffice_role()
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g264_my_backoffice_role()
 TO authenticated;
COMMENT ON FUNCTION public.mobility_stage_g264_my_backoffice_role()
 IS 'STAGING self-only AAL2/Admin role API: SECURITY INVOKER narrow wrapper to unexposed private definer. No native role grants.';
COMMENT ON FUNCTION qore_backoffice_private.g264_self_role_strict()
 IS 'STAGING private AAL2-only self role; NEVER expose qore_backoffice_private via PostgREST API schemas.';
