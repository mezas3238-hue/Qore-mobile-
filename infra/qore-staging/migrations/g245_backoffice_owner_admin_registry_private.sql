-- G245: independent Admin/Owner authority registry, based on G27 shape.
-- STRUCTURE ONLY. No browser grants, no role-upgrade RPC, no bootstrap owner,
-- no implicit privilege from native passenger/admin/driver or user_metadata.
DO $guard$
BEGIN
 IF to_regclass('public.user_roles') IS NULL OR
    to_regclass('public.mobility_stage_backoffice_roles') IS NOT NULL
 THEN RAISE EXCEPTION 'G245 requires isolated native roles, absent backoffice registry'; END IF;
END $guard$;
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
REVOKE ALL ON public.mobility_stage_backoffice_roles FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.mobility_stage_backoffice_roles TO service_role;
CREATE POLICY staging_backoffice_read_denied
 ON public.mobility_stage_backoffice_roles
 FOR SELECT TO authenticated USING (false);
-- G27 role lookup / AAL2 / provider revocation NOT INSTALLED. Before activation,
-- review the G231 Auth signup trigger (defaults to passenger). An Admin/Owner
-- MUST have a separate verified identity with no public.user_roles membership,
-- approved independently by an authorized operator, never by self-service.
