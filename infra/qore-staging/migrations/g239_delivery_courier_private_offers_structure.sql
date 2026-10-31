-- QORE 239: persistent STAGING STRUCTURE ONLY; no CI guard/functions/fixtures.
-- Reviewed source definitions: G5_DELIVERY_CUSTODY_POSTGRES_CI_ONLY.sql, G10_PRIVATE_DELIVERY_OFFERS_POSTGRES_CI_ONLY.sql.
-- These tables are NOT authorization to execute real trips, delivery, payment or PSP.
-- No direct mobile Data API read/write. G42 IdP, real test identities and
-- independent secure RPC/trigger validation are required before operations.
DO $staging$
BEGIN
 IF to_regclass('public.mobility_stage_auto_demo_offers') IS NULL OR to_regclass('public.mobility_stage_deliveries') IS NOT NULL OR
 (SELECT count(*) FROM auth.users)<>0
 THEN RAISE EXCEPTION 'g239_delivery_courier_private_offers_structure: requires isolated empty QORE STAGING prerequisites'; END IF;
END $staging$;

CREATE TYPE public.mobility_stage_delivery_status AS ENUM
 ('requested','accepted','picked_up','delivered','disputed','returned','cancelled');

CREATE TYPE public.mobility_stage_delivery_category AS ENUM
 ('DOCUMENTS','PARCEL','GROCERIES','PHARMACY_OTC','RESTAURANT');

CREATE TABLE public.mobility_stage_delivery_vehicle_clearance (
 vehicle_id uuid PRIMARY KEY REFERENCES public.mobility_vehicles(id) ON DELETE RESTRICT,
 delivery_authorized boolean NOT NULL DEFAULT false,
 cargo_insurance_valid_through date NOT NULL,
 cargo_insurance_verified_at timestamptz NOT NULL,
 max_grams integer NOT NULL CHECK(max_grams BETWEEN 1 AND 100000),
 max_volume_cm3 integer NOT NULL CHECK(max_volume_cm3 BETWEEN 1 AND 1000000),
 max_edge_cm integer NOT NULL CHECK(max_edge_cm BETWEEN 1 AND 200),
 reviewed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 reviewed_at timestamptz NOT NULL,
 CHECK(cargo_insurance_verified_at<=reviewed_at)
);

CREATE TABLE public.mobility_stage_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 courier_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
 vehicle_id uuid REFERENCES public.mobility_vehicles(id) ON DELETE RESTRICT,
 requested_vehicle_kind public.mobility_vehicle_kind NOT NULL,
 category public.mobility_stage_delivery_category NOT NULL,
 grams integer NOT NULL CHECK(grams BETWEEN 1 AND 100000),
 length_cm integer NOT NULL CHECK(length_cm BETWEEN 1 AND 200),
 width_cm integer NOT NULL CHECK(width_cm BETWEEN 1 AND 200),
 height_cm integer NOT NULL CHECK(height_cm BETWEEN 1 AND 200),
 pickup_tag text NOT NULL CHECK(pickup_tag ~ '^[A-Z_]{3,40}$'),
 delivery_tag text NOT NULL CHECK(delivery_tag ~ '^[A-Z_]{3,40}$'),
 restricted_item_declared boolean NOT NULL DEFAULT false,
 status public.mobility_stage_delivery_status NOT NULL DEFAULT 'requested',
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 proof_ref uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 changed_at timestamptz NOT NULL DEFAULT now(),
 CHECK(pickup_tag<>delivery_tag),
 CHECK(restricted_item_declared=false),
 CHECK(
  (status='requested' AND courier_id IS NULL AND vehicle_id IS NULL AND proof_ref IS NULL)
  OR (status IN ('accepted','picked_up') AND courier_id IS NOT NULL
      AND vehicle_id IS NOT NULL AND proof_ref IS NULL)
  OR (status='cancelled' AND proof_ref IS NULL
      AND ((courier_id IS NULL AND vehicle_id IS NULL)
       OR (courier_id IS NOT NULL AND vehicle_id IS NOT NULL)))
  OR (status IN ('delivered','disputed','returned') AND courier_id IS NOT NULL
      AND vehicle_id IS NOT NULL AND proof_ref IS NOT NULL)
 )
);

CREATE UNIQUE INDEX mobility_stage_one_active_delivery_sender
 ON public.mobility_stage_deliveries(sender_id)
 WHERE status IN ('requested','accepted','picked_up','disputed');

CREATE UNIQUE INDEX mobility_stage_one_active_delivery_courier
 ON public.mobility_stage_deliveries(courier_id)
 WHERE courier_id IS NOT NULL AND status IN ('accepted','picked_up','disputed');

CREATE TABLE public.mobility_stage_delivery_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 delivery_id uuid NOT NULL REFERENCES public.mobility_stage_deliveries(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 action text NOT NULL CHECK(action IN ('accept','pickup','deliver','dispute','return','cancel')),
 next_status public.mobility_stage_delivery_status NOT NULL,
 delivery_revision bigint NOT NULL CHECK(delivery_revision>1),
 proof_ref uuid,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(delivery_id,delivery_revision)
);

CREATE TABLE public.mobility_stage_delivery_offers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 delivery_id uuid NOT NULL
  REFERENCES public.mobility_stage_deliveries(id) ON DELETE RESTRICT,
 courier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 vehicle_id uuid NOT NULL REFERENCES public.mobility_vehicles(id) ON DELETE RESTRICT,
 status public.mobility_stage_offer_state NOT NULL DEFAULT 'offered',
 ttl_seconds integer NOT NULL CHECK(ttl_seconds BETWEEN 5 AND 45),
 offered_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 expires_at timestamptz NOT NULL,
 decision_key uuid UNIQUE,
 decision_event_id uuid
  REFERENCES public.mobility_stage_delivery_events(id) ON DELETE RESTRICT,
 UNIQUE(delivery_id,courier_id),
 CHECK(expires_at>offered_at),
 CHECK(
  (status IN ('offered','withdrawn') AND decision_key IS NULL AND decision_event_id IS NULL)
  OR (status='declined' AND decision_key IS NOT NULL AND decision_event_id IS NULL)
  OR (status='accepted' AND decision_key IS NOT NULL AND decision_event_id IS NOT NULL)
 )
);

CREATE TABLE public.mobility_stage_delivery_offer_outbox (
 offer_id uuid PRIMARY KEY
  REFERENCES public.mobility_stage_delivery_offers(id) ON DELETE RESTRICT,
 courier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 accepted_for_processing_at timestamptz,
 receipt_confirmed_at timestamptz
);

ALTER TABLE public.mobility_stage_delivery_vehicle_clearance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_delivery_vehicle_clearance FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_deliveries FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_delivery_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_delivery_events FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_delivery_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_delivery_offers FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_delivery_offer_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_delivery_offer_outbox FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_delivery_vehicle_clearance TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_deliveries TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_delivery_events TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_delivery_offers TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_delivery_offer_outbox TO service_role;

CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_delivery_vehicle_clearance
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_deliveries
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_delivery_events
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_delivery_offers
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_delivery_offer_outbox
 FOR SELECT TO authenticated USING (false);
