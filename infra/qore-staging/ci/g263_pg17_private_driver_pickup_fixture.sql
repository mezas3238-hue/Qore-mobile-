-- G263 disposable PostgreSQL17 fixture, NEVER external Supabase.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA qore_private;
REVOKE ALL ON SCHEMA qore_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA qore_private TO service_role;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id));
CREATE TYPE public.app_role AS ENUM ('admin','driver','passenger');
CREATE TABLE public.user_roles(
 user_id uuid NOT NULL REFERENCES auth.users(id),
 role public.app_role NOT NULL,
 UNIQUE(user_id,role)
);
CREATE FUNCTION public.mobility_stage_g42_lock_session(
 _user uuid,_session uuid,_iat_ms bigint)
 RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path='' AS $f$
BEGIN
 IF _iat_ms IS NULL OR _iat_ms<1 THEN RETURN false; END IF;
 RETURN EXISTS(SELECT 1 FROM auth.sessions s
  WHERE s.id=_session AND s.user_id=_user FOR SHARE);
END $f$;
REVOKE EXECUTE ON FUNCTION
 public.mobility_stage_g42_lock_session(uuid,uuid,bigint)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION
 public.mobility_stage_g42_lock_session(uuid,uuid,bigint) TO service_role;
