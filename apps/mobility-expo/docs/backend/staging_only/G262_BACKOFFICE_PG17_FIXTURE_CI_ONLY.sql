-- G262 CI ONLY: disposable PostgreSQL 17 shape, no Supabase project and no
-- commercial data. This fixture is NEVER applied to hosted Supabase.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.user_roles(user_id uuid REFERENCES auth.users(id),role text NOT NULL);
CREATE TABLE public.mobility_stage_backoffice_roles(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 role text NOT NULL CHECK(role IN('admin','owner')),
 status text NOT NULL,
 revision bigint NOT NULL DEFAULT 1,
 approved_by uuid NOT NULL REFERENCES auth.users(id),
 approved_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_backoffice_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_roles,public.mobility_stage_backoffice_roles
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.user_roles,public.mobility_stage_backoffice_roles
 TO service_role;
CREATE FUNCTION public.mobility_stage_g42_session_active(uuid,uuid,bigint)
 RETURNS boolean LANGUAGE sql STABLE AS 'SELECT false';
REVOKE EXECUTE ON FUNCTION
 public.mobility_stage_g42_session_active(uuid,uuid,bigint)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION
 public.mobility_stage_g42_session_active(uuid,uuid,bigint) TO service_role;
