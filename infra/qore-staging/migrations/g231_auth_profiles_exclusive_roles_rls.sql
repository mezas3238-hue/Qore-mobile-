-- G231: AUTH + RLS baseline for newly created QORE Supabase STAGING only.
-- Applied only to project mrjzxftsdxzepzbcuids (new, no users at baseline).
-- NO commercial dispatch, no payments, no public driver onboarding.
-- Source: existing reviewed G1 isolated baseline, with exclusive role and empty-project guard.
-- G1 ISOLATED SUPABASE STAGING BASELINE — NOT FOR EXISTING LOVABLE DATABASE.
-- Intended ONLY for a newly-provisioned, separately verified Supabase project.
-- Supabase provides auth.users and auth.uid(); never create auth.users in LIVE.
-- No paid trips, no maps, no payment tables and NO seeded administrator.
DO $guard$
BEGIN
 IF (SELECT count(*) FROM auth.users)<>0 OR
    to_regclass('public.profiles') IS NOT NULL OR
    to_regclass('public.user_roles') IS NOT NULL OR
    to_regclass('public.driver_locations') IS NOT NULL
 THEN RAISE EXCEPTION 'G231 requires fresh, empty, isolated STAGING project'; END IF;
END
$guard$;
CREATE TYPE public.app_role AS ENUM ('admin','driver','passenger');

CREATE TABLE public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_roles (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role public.app_role NOT NULL DEFAULT 'passenger',
 PRIMARY KEY(user_id,role),
 CONSTRAINT one_exclusive_primary_role_per_user UNIQUE(user_id)
);
CREATE TABLE public.driver_locations (
 driver_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 available boolean NOT NULL DEFAULT false,
 lat double precision, lng double precision,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((lat IS NULL AND lng IS NULL) OR
        (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180))
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.user_roles FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.driver_locations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.profiles,public.user_roles TO authenticated;
GRANT ALL ON public.profiles,public.user_roles,public.driver_locations TO service_role;
CREATE POLICY staging_own_profile_read ON public.profiles
 FOR SELECT TO authenticated USING (id=(SELECT auth.uid()));
CREATE POLICY staging_own_role_read ON public.user_roles
 FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));

-- Self-check prevents using SECURITY DEFINER to query other users' roles.
CREATE FUNCTION public.has_role(_uid uuid,_role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $f$
 SELECT COALESCE(_uid=auth.uid() AND EXISTS(
  SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role=_role
 ),false)
$f$;
REVOKE ALL ON FUNCTION public.has_role(uuid,public.app_role) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated,service_role;

-- A new Supabase Auth user becomes a PASSENGER only, not DRIVER/ADMIN.
-- Auth trigger is server-owned and cannot be invoked as an open RPC.
CREATE FUNCTION public.mobility_staging_handle_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
BEGIN
 INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
 INSERT INTO public.user_roles (user_id,role)
 VALUES (NEW.id,'passenger'::public.app_role) ON CONFLICT DO NOTHING;
 RETURN NEW;
END
$f$;
REVOKE ALL ON FUNCTION public.mobility_staging_handle_signup() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER mobility_staging_new_signup
 AFTER INSERT ON auth.users FOR EACH ROW
 EXECUTE FUNCTION public.mobility_staging_handle_signup();
