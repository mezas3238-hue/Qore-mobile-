-- QORE 240: persistent STAGING STRUCTURE ONLY; no CI guards/functions/fixtures.
-- Reviewed from: G6_MERCHANT_ORDERS_POSTGRES_CI_ONLY.sql, G9_MERCHANT_MANAGEMENT_POSTGRES_CI_ONLY.sql.
-- Data API deny by default: only Commerce staff self-membership is read-only.
-- KYC/municipality/G42 provider, courier proof, PSP and external sessions NO_GO.
DO $staging$
BEGIN
 IF to_regclass('public.mobility_stage_deliveries') IS NULL OR to_regclass('public.mobility_stage_merchants') IS NOT NULL OR
 (SELECT count(*) FROM auth.users)<>0
 THEN RAISE EXCEPTION 'g240_commerce_orders_staff_catalog_structure: requires isolated empty QORE STAGING prerequisites'; END IF;
END $staging$;

CREATE TYPE public.mobility_stage_merchant_kind AS ENUM
 ('SUPERMARKET','PHARMACY','RESTAURANT','RETAIL','OTHER');

CREATE TYPE public.mobility_stage_merchant_status AS ENUM
 ('pending','approved','suspended');

CREATE TYPE public.mobility_stage_merchant_staff_role AS ENUM
 ('owner','manager','picker');

CREATE TYPE public.mobility_stage_catalog_class AS ENUM
 ('GENERAL','PHARMACY_OTC');

CREATE TYPE public.mobility_stage_order_status AS ENUM
 ('requested','confirmed','preparing','ready','handed_to_courier','delivered','cancelled');

CREATE TABLE public.mobility_stage_merchants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 onboarding_key uuid NOT NULL UNIQUE,
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 kind public.mobility_stage_merchant_kind NOT NULL,
 display_tag text NOT NULL CHECK(display_tag ~ '^[A-Z_]{3,40}$'),
 status public.mobility_stage_merchant_status NOT NULL DEFAULT 'pending',
 reviewed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
   OR (status IN ('approved','suspended') AND reviewed_by IS NOT NULL
       AND reviewed_at IS NOT NULL))
);

CREATE TABLE public.mobility_stage_merchant_staff (
 merchant_id uuid NOT NULL REFERENCES public.mobility_stage_merchants(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 staff_role public.mobility_stage_merchant_staff_role NOT NULL,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(merchant_id,user_id)
);

CREATE TABLE public.mobility_stage_merchant_branches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 merchant_id uuid NOT NULL REFERENCES public.mobility_stage_merchants(id) ON DELETE RESTRICT,
 branch_tag text NOT NULL CHECK(branch_tag ~ '^[A-Z_]{3,40}$'),
 pickup_tag text NOT NULL CHECK(pickup_tag ~ '^[A-Z_]{3,40}$'),
 active boolean NOT NULL DEFAULT true,
 accepting_orders boolean NOT NULL DEFAULT false,
 preparation_minutes integer NOT NULL CHECK(preparation_minutes BETWEEN 1 AND 180),
 UNIQUE(merchant_id,branch_tag)
);

CREATE TABLE public.mobility_stage_catalog_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 branch_id uuid NOT NULL REFERENCES public.mobility_stage_merchant_branches(id) ON DELETE RESTRICT,
 sku text NOT NULL CHECK(sku ~ '^[A-Z0-9_-]{2,40}$'),
 item_tag text NOT NULL CHECK(item_tag ~ '^[A-Z0-9_]{2,50}$'),
 item_class public.mobility_stage_catalog_class NOT NULL DEFAULT 'GENERAL',
 unit_price_pyg integer NOT NULL CHECK(unit_price_pyg BETWEEN 100 AND 10000000),
 unit_grams integer NOT NULL CHECK(unit_grams BETWEEN 1 AND 50000),
 stock_units integer NOT NULL CHECK(stock_units BETWEEN 0 AND 1000000),
 active boolean NOT NULL DEFAULT true,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 UNIQUE(branch_id,sku)
);

CREATE TABLE public.mobility_stage_merchant_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 merchant_id uuid NOT NULL REFERENCES public.mobility_stage_merchants(id) ON DELETE RESTRICT,
 branch_id uuid NOT NULL REFERENCES public.mobility_stage_merchant_branches(id) ON DELETE RESTRICT,
 requested_vehicle_kind public.mobility_vehicle_kind NOT NULL,
 items_request jsonb NOT NULL,
 subtotal_pyg integer NOT NULL CHECK(subtotal_pyg BETWEEN 100 AND 50000000),
 status public.mobility_stage_order_status NOT NULL DEFAULT 'requested',
 delivery_id uuid UNIQUE REFERENCES public.mobility_stage_deliveries(id) ON DELETE RESTRICT,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 changed_at timestamptz NOT NULL DEFAULT now(),
 CHECK(jsonb_typeof(items_request)='array'),
 CHECK((status IN ('requested','confirmed','preparing','cancelled') AND delivery_id IS NULL)
   OR status='ready'
   OR (status IN ('handed_to_courier','delivered') AND delivery_id IS NOT NULL))
);

CREATE UNIQUE INDEX mobility_stage_one_active_merchant_order_buyer
 ON public.mobility_stage_merchant_orders(buyer_id)
 WHERE status IN ('requested','confirmed','preparing','ready','handed_to_courier');

CREATE TABLE public.mobility_stage_merchant_order_lines (
 order_id uuid NOT NULL REFERENCES public.mobility_stage_merchant_orders(id) ON DELETE RESTRICT,
 item_id uuid NOT NULL REFERENCES public.mobility_stage_catalog_items(id) ON DELETE RESTRICT,
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 999),
 unit_price_pyg integer NOT NULL CHECK(unit_price_pyg BETWEEN 100 AND 10000000),
 line_total_pyg integer NOT NULL CHECK(line_total_pyg BETWEEN 100 AND 50000000),
 unit_grams integer NOT NULL CHECK(unit_grams BETWEEN 1 AND 50000),
 PRIMARY KEY(order_id,item_id),
 CHECK(line_total_pyg=quantity*unit_price_pyg)
);

CREATE TABLE public.mobility_stage_merchant_order_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 order_id uuid NOT NULL REFERENCES public.mobility_stage_merchant_orders(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 action text NOT NULL CHECK(action IN
  ('confirm','start_preparing','ready','cancel','attach_delivery','hand_to_courier','complete')),
 next_status public.mobility_stage_order_status NOT NULL,
 order_revision bigint NOT NULL CHECK(order_revision>1),
 delivery_id uuid REFERENCES public.mobility_stage_deliveries(id) ON DELETE RESTRICT,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id,order_revision)
);

CREATE UNIQUE INDEX mobility_stage_one_merchant_per_owner
 ON public.mobility_stage_merchants(owner_id);

CREATE TABLE public.mobility_stage_merchant_management_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 merchant_id uuid NOT NULL REFERENCES public.mobility_stage_merchants(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 action text NOT NULL CHECK(action IN
  ('request','approve','suspend','branch_create','branch_update','item_create','item_update')),
 entity_kind text NOT NULL CHECK(entity_kind IN ('MERCHANT','BRANCH','ITEM')),
 entity_id uuid NOT NULL,
 parameters jsonb NOT NULL CHECK(jsonb_typeof(parameters)='object'),
 recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mobility_stage_merchants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_merchants FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_merchant_staff ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_merchant_staff FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_merchant_branches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_merchant_branches FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_catalog_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_catalog_items FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_merchant_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_merchant_orders FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_merchant_order_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_merchant_order_lines FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_merchant_order_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_merchant_order_events FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_merchant_management_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_merchant_management_events FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_merchants TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_merchant_staff TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_merchant_branches TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_catalog_items TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_merchant_orders TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_merchant_order_lines TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_merchant_order_events TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_merchant_management_events TO service_role;

CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_merchants
 FOR SELECT TO authenticated USING (false);
-- Only authenticated staff can discover their OWN active merchant association.
GRANT SELECT ON public.mobility_stage_merchant_staff TO authenticated;
CREATE POLICY staging_staff_own_active_membership ON public.mobility_stage_merchant_staff
 FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()) AND active=true);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_merchant_branches
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_catalog_items
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_merchant_orders
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_merchant_order_lines
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_merchant_order_events
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_merchant_management_events
 FOR SELECT TO authenticated USING (false);
