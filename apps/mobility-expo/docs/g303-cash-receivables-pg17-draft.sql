-- G303 PG17 schema proposal, NOT INSTALLED IN SUPABASE.
-- Never interpret creation of these tables as live cash collection authorization.
-- Driver physically holds ALL paper cash. QORE records only commission receivable.
CREATE TABLE IF NOT EXISTS public.mobility_stage_g303_cash_receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_kind text NOT NULL CHECK(service_kind IN
    ('AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO')),
  booking_id uuid NOT NULL,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  owner_rule_version text NOT NULL CHECK(length(owner_rule_version) BETWEEN 8 AND 120),
  verified_cash_receipt_ref text NOT NULL UNIQUE
    CHECK(length(verified_cash_receipt_ref) BETWEEN 8 AND 120),
  physically_collected_pyg bigint NOT NULL CHECK(physically_collected_pyg BETWEEN 1 AND 100000000),
  driver_net_pyg bigint NOT NULL CHECK(driver_net_pyg BETWEEN 0 AND 100000000),
  commission_receivable_pyg bigint NOT NULL CHECK(commission_receivable_pyg BETWEEN 0 AND 100000000),
  state text NOT NULL DEFAULT 'PENDING_QA'
    CHECK(state IN ('PENDING_QA','DISPUTED_QA','SETTLED_QA','REVERSED_QA')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT g303_cash_distinct_parties CHECK (customer_id<>driver_id),
  CONSTRAINT g303_cash_accounted CHECK
    (physically_collected_pyg=driver_net_pyg+commission_receivable_pyg),
  CONSTRAINT g303_cash_unique_booking UNIQUE(service_kind,booking_id)
);
ALTER TABLE public.mobility_stage_g303_cash_receivables ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g303_cash_receivables FROM PUBLIC,anon,authenticated;

-- Digital earning offset is a different transaction, and MUST NOT
-- be a bank debit. No settlement can offset a cash receivable twice.
CREATE TABLE IF NOT EXISTS public.mobility_stage_g303_cash_offsets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_receivable_id uuid NOT NULL REFERENCES public.mobility_stage_g303_cash_receivables(id)
    ON DELETE RESTRICT,
  digital_settlement_id uuid NOT NULL,
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  policy_version text NOT NULL CHECK(length(policy_version) BETWEEN 8 AND 120),
  offset_pyg bigint NOT NULL CHECK(offset_pyg BETWEEN 0 AND 100000000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT g303_one_offset_per_digital_settlement UNIQUE(digital_settlement_id),
  CONSTRAINT g303_no_repeat_receivable_per_settlement UNIQUE(cash_receivable_id,digital_settlement_id)
);
ALTER TABLE public.mobility_stage_g303_cash_offsets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g303_cash_offsets FROM PUBLIC,anon,authenticated;
CREATE INDEX IF NOT EXISTS g303_cash_receivable_by_driver
 ON public.mobility_stage_g303_cash_receivables(driver_id,created_at DESC);
-- CRITICAL IMPLEMENTATION NOTE: sums of offsets vs outstanding receivables,
-- money already paid via external collectors, refund/chargeback corrections,
-- authentication, commission rate, cash receipt consent and Owner policy
-- cannot be enforced by DDL constraints alone.
-- Future private writer: SQL transaction + locks + idempotent signed receipts,
-- never apply on user/client supplied cash confirmation only.
-- Not in Railway or Supabase migration list, no real payment operations.
