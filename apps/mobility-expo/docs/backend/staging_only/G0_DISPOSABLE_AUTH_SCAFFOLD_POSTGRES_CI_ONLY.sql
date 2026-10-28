-- CI-only Supabase Auth stand-in. NEVER apply to any remote or real Supabase project.
-- The database must be qore_disposable_chain on localhost PostgreSQL 16.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'Refusing non-disposable full-chain scaffold'; END IF;
END $guard$;
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
-- Supabase service_role bypasses RLS; this fake role exists ONLY in disposable CI.
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $auth$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $auth$;
GRANT USAGE ON SCHEMA auth TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,service_role;
COMMIT;
