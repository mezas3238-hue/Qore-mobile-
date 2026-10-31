-- G264: Self-only STAGING backoffice role read for verified Admin Browser.
-- No table SELECT permission, no arbitrary user-id parameter, no role write.
-- The gateway G27 MUST continue to check authoritative role independently.
-- This RPC resolves the user_roles vs exclusive private backoffice registry
-- contradiction; no synthetic actors, no LIVE and no production authorization.
CREATE FUNCTION public.mobility_stage_g264_my_backoffice_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $g264$
 SELECT CASE WHEN auth.uid() IS NULL
   OR auth.jwt()->>'aal' IS DISTINCT FROM 'aal2'
   OR auth.role() IS DISTINCT FROM 'authenticated'
 THEN NULL::text
 ELSE (
  SELECT CASE WHEN count(*)=1
        AND min(br.role) IN ('admin','owner')
     THEN min(br.role)::text ELSE NULL::text END
  FROM public.mobility_stage_backoffice_roles br
  WHERE br.user_id=auth.uid()
   AND br.status='active'
   AND br.approved_by IS NOT NULL
   AND br.approved_by<>br.user_id
   AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id=br.user_id
   )
 )
 END;
$g264$;
REVOKE ALL ON FUNCTION public.mobility_stage_g264_my_backoffice_role()
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g264_my_backoffice_role()
 TO authenticated;
COMMENT ON FUNCTION public.mobility_stage_g264_my_backoffice_role()
 IS 'STAGING only: self AAL2 role disclosure from exclusive approved backoffice registry; no direct backoffice table privileges, no role grants, no commercial enablement.';
