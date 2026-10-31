-- QORE 241: persistent STAGING STRUCTURE ONLY; no CI guards/functions/fixtures.
-- Reviewed from: G7_FARES_SIMULATED_PAYMENTS_POSTGRES_CI_ONLY.sql.
-- Data API deny by default: only Commerce staff self-membership is read-only.
-- KYC/municipality/G42 provider, courier proof, PSP and external sessions NO_GO.
DO $staging$
BEGIN
 IF to_regclass('public.mobility_stage_merchant_orders') IS NULL OR to_regclass('public.mobility_stage_fare_rules') IS NOT NULL OR
 (SELECT count(*) FROM auth.users)<>0
 THEN RAISE EXCEPTION 'g241_simulated_finance_immutable_ledger_structure: requires isolated empty QORE STAGING prerequisites'; END IF;
END $staging$;

CREATE TYPE public.mobility_stage_fare_mode AS ENUM
 ('AUTO','MOTO','DELIVERY','MERCHANT_DELIVERY');

CREATE TYPE public.mobility_stage_fare_subject AS ENUM
 ('RIDE','DELIVERY','MERCHANT_ORDER');

CREATE TYPE public.mobility_stage_payment_method AS ENUM
 ('SIMULATED_CASH','SIMULATED_CARD');

CREATE TYPE public.mobility_stage_payment_status AS ENUM
 ('authorized','captured','refunded','cancelled');

CREATE TABLE public.mobility_stage_fare_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 rule_key text NOT NULL UNIQUE CHECK(rule_key ~ '^[a-zA-Z0-9._-]{1,48}$'),
 mode public.mobility_stage_fare_mode NOT NULL,
 zone_tag text NOT NULL CHECK(zone_tag ~ '^[A-Z_]{3,40}$'),
 base_pyg integer NOT NULL CHECK(base_pyg BETWEEN 0 AND 1000000),
 per_km_pyg integer NOT NULL CHECK(per_km_pyg BETWEEN 0 AND 100000),
 per_minute_pyg integer NOT NULL CHECK(per_minute_pyg BETWEEN 0 AND 20000),
 minimum_pyg integer NOT NULL CHECK(minimum_pyg BETWEEN 0 AND 1000000),
 commission_bps integer NOT NULL CHECK(commission_bps BETWEEN 0 AND 3000),
 valid_from timestamptz NOT NULL,
 valid_until timestamptz NOT NULL,
 active boolean NOT NULL DEFAULT false,
 approved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 approved_at timestamptz NOT NULL,
 CHECK(valid_until>valid_from),
 CHECK(approved_at<=valid_from)
);

CREATE UNIQUE INDEX mobility_stage_one_active_fare_rule
 ON public.mobility_stage_fare_rules(mode,zone_tag)
 WHERE active=true;

CREATE TABLE public.mobility_stage_fare_quotes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 rule_id uuid NOT NULL REFERENCES public.mobility_stage_fare_rules(id) ON DELETE RESTRICT,
 mode public.mobility_stage_fare_mode NOT NULL,
 subject_kind public.mobility_stage_fare_subject NOT NULL,
 subject_id uuid NOT NULL,
 distance_meters integer NOT NULL CHECK(distance_meters BETWEEN 0 AND 500000),
 duration_seconds integer NOT NULL CHECK(duration_seconds BETWEEN 0 AND 86400),
 base_pyg integer NOT NULL CHECK(base_pyg BETWEEN 0 AND 1000000),
 distance_charge_pyg integer NOT NULL CHECK(distance_charge_pyg BETWEEN 0 AND 50000000),
 time_charge_pyg integer NOT NULL CHECK(time_charge_pyg BETWEEN 0 AND 28800000),
 minimum_pyg integer NOT NULL CHECK(minimum_pyg BETWEEN 0 AND 1000000),
 subtotal_pyg integer NOT NULL CHECK(subtotal_pyg BETWEEN 0 AND 100000000),
 tolls_pyg integer NOT NULL CHECK(tolls_pyg BETWEEN 0 AND 1000000),
 total_pyg integer NOT NULL CHECK(total_pyg BETWEEN 0 AND 100000000),
 commission_bps integer NOT NULL CHECK(commission_bps BETWEEN 0 AND 3000),
 commission_pyg integer NOT NULL CHECK(commission_pyg BETWEEN 0 AND 100000000),
 provider_pyg integer NOT NULL CHECK(provider_pyg BETWEEN 0 AND 100000000),
 quoted_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 CHECK(total_pyg=subtotal_pyg+tolls_pyg),
 CHECK(provider_pyg+commission_pyg=total_pyg),
 CHECK(expires_at>quoted_at),
 UNIQUE(subject_kind,subject_id,request_key)
);

CREATE TABLE public.mobility_stage_payment_intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 quote_id uuid NOT NULL UNIQUE REFERENCES public.mobility_stage_fare_quotes(id) ON DELETE RESTRICT,
 customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 method public.mobility_stage_payment_method NOT NULL,
 amount_pyg integer NOT NULL CHECK(amount_pyg BETWEEN 0 AND 100000000),
 status public.mobility_stage_payment_status NOT NULL DEFAULT 'authorized',
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 authorized_at timestamptz NOT NULL DEFAULT now(),
 changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.mobility_stage_payment_operations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 payment_id uuid NOT NULL REFERENCES public.mobility_stage_payment_intents(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 action text NOT NULL CHECK(action IN ('capture','refund','cancel')),
 next_status public.mobility_stage_payment_status NOT NULL,
 payment_revision bigint NOT NULL CHECK(payment_revision>1),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(payment_id,payment_revision)
);

CREATE TABLE public.mobility_stage_ledger_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 payment_id uuid NOT NULL REFERENCES public.mobility_stage_payment_intents(id) ON DELETE RESTRICT,
 operation_id uuid NOT NULL REFERENCES public.mobility_stage_payment_operations(id) ON DELETE RESTRICT,
 event text NOT NULL CHECK(event IN ('capture','refund')),
 sequence smallint NOT NULL CHECK(sequence BETWEEN 1 AND 3),
 account text NOT NULL CHECK(account IN
  ('synthetic_cash_clearing','synthetic_provider_payable','synthetic_platform_commission')),
 side text NOT NULL CHECK(side IN ('debit','credit')),
 amount_pyg integer NOT NULL CHECK(amount_pyg BETWEEN 0 AND 100000000),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(payment_id,event,sequence)
);

ALTER TABLE public.mobility_stage_fare_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_fare_rules FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_fare_quotes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_fare_quotes FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_payment_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_payment_intents FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_payment_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_payment_operations FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_ledger_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_ledger_entries FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT,INSERT ON public.mobility_stage_fare_rules TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_fare_quotes TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_payment_intents TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_payment_operations TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_ledger_entries TO service_role;

CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_fare_rules
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_fare_quotes
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_payment_intents
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_payment_operations
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_ledger_entries
 FOR SELECT TO authenticated USING (false);
