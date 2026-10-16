-- G2 STAGING-ONLY DESIGN — NEVER APPLY TO LOVABLE PRODUCTION.
-- Not in supabase/migrations: require isolated staging, backup, legal/security review.
-- Requires auth.users, public.has_role and service_role from verified Supabase schema.
BEGIN;
CREATE TYPE public.mobility_vehicle_kind AS ENUM ('AUTO','MOTO');
CREATE TYPE public.mobility_service_kind AS ENUM ('economico','confort','xl','moto_pasajero');
CREATE TYPE public.mobility_review_status AS ENUM ('pending','approved','rejected','suspended');

-- Inventory/application: clients may READ own rows, never WRITE or approve.
CREATE TABLE public.mobility_vehicles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 vehicle_kind public.mobility_vehicle_kind NOT NULL,
 service_kind public.mobility_service_kind NOT NULL,
 country_code text NOT NULL DEFAULT 'PY' CHECK (country_code ~ '^[A-Z]{2}$'),
 municipality_code text NOT NULL CHECK (char_length(municipality_code) BETWEEN 2 AND 60),
 plate_normalized text NOT NULL CHECK (plate_normalized ~ '^[A-Z0-9-]{4,12}$'),
 brand text NOT NULL CHECK (char_length(trim(brand)) BETWEEN 2 AND 80),
 model text NOT NULL CHECK (char_length(trim(model)) BETWEEN 1 AND 80),
 manufacture_year integer NOT NULL CHECK (manufacture_year BETWEEN 1995 AND 2100),
 passenger_capacity integer NOT NULL CHECK (passenger_capacity BETWEEN 1 AND 8),
 review_status public.mobility_review_status NOT NULL DEFAULT 'pending',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(country_code,plate_normalized),
 CONSTRAINT compatible_kind_service_capacity CHECK (
  (vehicle_kind='AUTO' AND service_kind IN ('economico','confort','xl') AND
   ((service_kind='xl' AND passenger_capacity>=6)
    OR (service_kind='confort' AND passenger_capacity>=3)
    OR (service_kind='economico' AND passenger_capacity>=3)))
  OR (vehicle_kind='MOTO' AND service_kind='moto_pasajero' AND passenger_capacity=1)
 )
);
CREATE INDEX mobility_vehicles_driver_status_idx
 ON public.mobility_vehicles(driver_id,review_status);

-- Verifiers are always trusted backend reviewers, NEVER client booleans.
CREATE TABLE public.mobility_driver_compliance (
 driver_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
 license_class text NOT NULL CHECK (char_length(trim(license_class)) BETWEEN 1 AND 40),
 license_valid_through date NOT NULL,
 license_verified_at timestamptz NOT NULL,
 license_verified_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 driver_review_status public.mobility_review_status NOT NULL DEFAULT 'pending',
 last_reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mobility_vehicle_compliance (
 vehicle_id uuid PRIMARY KEY REFERENCES public.mobility_vehicles(id) ON DELETE RESTRICT,
 registration_valid_through date NOT NULL,
 registration_verified_at timestamptz NOT NULL,
 insurance_valid_through date NOT NULL,
 insurance_verified_at timestamptz NOT NULL,
 paid_passenger_insurance_covered boolean NOT NULL DEFAULT false,
 inspection_valid_through date NOT NULL,
 inspection_verified_at timestamptz NOT NULL,
 municipal_authorization_valid_through date NOT NULL,
 municipal_authorization_verified_at timestamptz NOT NULL,
 moto_helmets_verified integer NOT NULL DEFAULT 0 CHECK (moto_helmets_verified BETWEEN 0 AND 2),
 moto_routes_authorized boolean NOT NULL DEFAULT false,
 reviewed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 reviewed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mobility_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_driver_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_vehicle_compliance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_vehicles FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.mobility_driver_compliance FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.mobility_vehicle_compliance FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.mobility_vehicles TO authenticated;
GRANT ALL ON public.mobility_vehicles TO service_role;
GRANT ALL ON public.mobility_driver_compliance TO service_role;
GRANT ALL ON public.mobility_vehicle_compliance TO service_role;
CREATE POLICY mobility_vehicles_own_or_admin_read
 ON public.mobility_vehicles FOR SELECT TO authenticated
 USING (driver_id=auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role));
-- No user INSERT/UPDATE/DELETE; no approval RPC, no operational ride RPC.
-- Existing public.rides / public.vehicles remain untouched.
COMMIT;
