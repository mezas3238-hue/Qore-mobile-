-- QORE 238: persistent STAGING STRUCTURE ONLY; no CI guard/functions/fixtures.
-- Reviewed source definitions: G3_AUTO_DEMO_TRIP_CONTRACT_POSTGRES_CI_ONLY.sql, G4_PRIVATE_AUTO_OFFERS_POSTGRES_CI_ONLY.sql.
-- These tables are NOT authorization to execute real trips, delivery, payment or PSP.
-- No direct mobile Data API read/write. G42 IdP, real test identities and
-- independent secure RPC/trigger validation are required before operations.
DO $staging$
BEGIN
 IF to_regclass('public.mobility_vehicles') IS NULL OR to_regclass('public.mobility_stage_auto_demo_trips') IS NOT NULL OR
 (SELECT count(*) FROM auth.users)<>0
 THEN RAISE EXCEPTION 'g238_auto_passenger_private_offers_structure: requires isolated empty QORE STAGING prerequisites'; END IF;
END $staging$;

CREATE TYPE public.mobility_stage_trip_status AS ENUM
 ('searching','accepted','arriving','in_progress','completed','cancelled');

CREATE TABLE public.mobility_stage_auto_demo_trips (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 driver_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
 vehicle_id uuid REFERENCES public.mobility_vehicles(id) ON DELETE RESTRICT,
 service public.mobility_service_kind NOT NULL
   CHECK(service IN ('economico','confort','xl')),
 origin_tag text NOT NULL CHECK (origin_tag ~ '^[A-Z_]{3,40}$'),
 destination_tag text NOT NULL CHECK (destination_tag ~ '^[A-Z_]{3,40}$'),
 status public.mobility_stage_trip_status NOT NULL DEFAULT 'searching',
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 changed_at timestamptz NOT NULL DEFAULT now(),
 CHECK (origin_tag<>destination_tag),
 CHECK (
 (status='searching' AND driver_id IS NULL AND vehicle_id IS NULL)
 OR (status IN ('accepted','arriving','in_progress','completed') AND driver_id IS NOT NULL AND vehicle_id IS NOT NULL)
 OR (status='cancelled')
 )
);

CREATE UNIQUE INDEX mobility_stage_one_active_passenger
 ON public.mobility_stage_auto_demo_trips(passenger_id)
 WHERE status IN ('searching','accepted','arriving','in_progress');

CREATE UNIQUE INDEX mobility_stage_one_active_driver
 ON public.mobility_stage_auto_demo_trips(driver_id)
 WHERE driver_id IS NOT NULL AND status IN ('accepted','arriving','in_progress');

CREATE TABLE public.mobility_stage_auto_demo_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 trip_id uuid NOT NULL REFERENCES public.mobility_stage_auto_demo_trips(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 next_status public.mobility_stage_trip_status NOT NULL CHECK(next_status<>'searching'),
 trip_revision bigint NOT NULL CHECK(trip_revision>1),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(trip_id,trip_revision)
);

CREATE TYPE public.mobility_stage_offer_state AS ENUM
 ('offered','declined','accepted','withdrawn');

CREATE TABLE public.mobility_stage_auto_demo_offers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 trip_id uuid NOT NULL
   REFERENCES public.mobility_stage_auto_demo_trips(id) ON DELETE RESTRICT,
 driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 vehicle_id uuid NOT NULL REFERENCES public.mobility_vehicles(id) ON DELETE RESTRICT,
 status public.mobility_stage_offer_state NOT NULL DEFAULT 'offered',
 ttl_seconds integer NOT NULL CHECK(ttl_seconds BETWEEN 5 AND 30),
 offered_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 decision_key uuid UNIQUE,
 decision_event_id uuid
   REFERENCES public.mobility_stage_auto_demo_events(id) ON DELETE RESTRICT,
 UNIQUE(trip_id,driver_id),
 CHECK(expires_at>offered_at),
 CHECK (
 (status IN ('offered','withdrawn') AND decision_key IS NULL AND decision_event_id IS NULL)
 OR (status='declined' AND decision_key IS NOT NULL AND decision_event_id IS NULL)
 OR (status='accepted' AND decision_key IS NOT NULL AND decision_event_id IS NOT NULL)
 )
);

CREATE TABLE public.mobility_stage_auto_demo_push_outbox (
 offer_id uuid PRIMARY KEY
   REFERENCES public.mobility_stage_auto_demo_offers(id) ON DELETE RESTRICT,
 driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 accepted_for_processing_at timestamptz,
 receipt_confirmed_at timestamptz
);

ALTER TABLE public.mobility_stage_auto_demo_trips ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_auto_demo_trips FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_auto_demo_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_auto_demo_events FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_auto_demo_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_auto_demo_offers FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_auto_demo_push_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_auto_demo_push_outbox FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_auto_demo_trips TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_auto_demo_events TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_auto_demo_offers TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_auto_demo_push_outbox TO service_role;

CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_auto_demo_trips
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_auto_demo_events
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_auto_demo_offers
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_auto_demo_push_outbox
 FOR SELECT TO authenticated USING (false);
