-- QORE G232 / external Supabase STAGING: initial identity boundary ONLY.
-- Sovereign target: qore-mobile-staging (mrjzxftsdxzepzbcuids).
-- NEVER execute on production; no fixtures, no LIVE rides or public signups.
-- Independent operator verification of project ID / empty public schema required.
BEGIN;
DO $guard$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname = 'public')
    OR EXISTS (SELECT 1 FROM auth.users) THEN
  RAISE EXCEPTION 'QORE G232 requires an empty, isolated Supabase STAGING project';
 END IF;
END
$guard$;

CREATE TYPE public.app_role AS ENUM ('admin','driver','passenger');

CREATE TABLE public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);

-- Exactly one role per Auth identity, assigned ONLY by trusted server operators.
-- No client-side role elevation, default role, or public signup hook.
CREATE TABLE public.user_roles (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 role public.app_role NOT NULL,
 assigned_at timestamptz NOT NULL DEFAULT now()
);

-- GPS remains private to the server; public/native apps have no access.
CREATE TABLE public.driver_locations (
 driver_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 available boolean NOT NULL DEFAULT false,
 lat double precision,
 lng double precision,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT qore_driver_location_pair_and_range CHECK (
  (lat IS NULL AND lng IS NULL) OR
  (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180)
 )
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.profiles, public.user_roles, public.driver_locations
 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profiles, public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
 ON public.profiles, public.user_roles, public.driver_locations TO service_role;

CREATE POLICY qore_own_profile_read ON public.profiles
 FOR SELECT TO authenticated
 USING (id = (SELECT auth.uid()));
CREATE POLICY qore_own_role_read ON public.user_roles
 FOR SELECT TO authenticated
 USING (user_id = (SELECT auth.uid()));

-- No policy for native GPS reads or ANY client writes.
-- No SECURITY DEFINER function, trigger, payment or seed is installed.
COMMIT;
