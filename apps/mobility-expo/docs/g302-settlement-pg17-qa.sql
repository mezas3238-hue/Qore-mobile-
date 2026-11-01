-- G302 POSTGRESQL17 SCHEMA DRAFT. NOT INSTALLED. NO REAL PAYMENT OPERATIONS.
-- Future worker must commit exactly-once only after independently verified
-- PSP settlement, booking completion and Driver beneficiary eligibility.
CREATE TABLE IF NOT EXISTS public.mobility_stage_g302_payout_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_kind text NOT NULL CHECK (service_kind IN
    ('AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO')),
  booking_id uuid NOT NULL,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  provider_payment_ref text NOT NULL CHECK
    (char_length(provider_payment_ref) BETWEEN 8 AND 120),
  provider_event_ref text NOT NULL CHECK
    (char_length(provider_event_ref) BETWEEN 8 AND 120),
  verified_rule_version text NOT NULL CHECK
    (char_length(verified_rule_version) BETWEEN 8 AND 120),
  customer_paid_pyg bigint NOT NULL CHECK (customer_paid_pyg BETWEEN 1 AND 100000000),
  driver_payable_pyg bigint NOT NULL CHECK (driver_payable_pyg BETWEEN 0 AND 100000000),
  commission_gross_pyg bigint NOT NULL CHECK (commission_gross_pyg BETWEEN 0 AND 100000000),
  processor_fee_pyg bigint NOT NULL CHECK (processor_fee_pyg BETWEEN 0 AND 100000000),
  platform_net_pyg bigint NOT NULL CHECK (platform_net_pyg BETWEEN 0 AND 100000000),
  state text NOT NULL DEFAULT 'READY_QA' CHECK (state IN
    ('READY_QA','ON_HOLD_QA','PAID_QA_SIMULATED','REVERSED_QA_SIMULATED')),
  payout_provider_ref text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT g302_distinct_actors CHECK (customer_id<>driver_id),
  CONSTRAINT g302_balanced_split CHECK (
    customer_paid_pyg=driver_payable_pyg+commission_gross_pyg
    AND commission_gross_pyg=processor_fee_pyg+platform_net_pyg),
  CONSTRAINT g302_unique_booking UNIQUE(service_kind,booking_id),
  CONSTRAINT g302_unique_psp_payment UNIQUE(provider_payment_ref),
  CONSTRAINT g302_unique_provider_event UNIQUE(provider_event_ref)
);
ALTER TABLE public.mobility_stage_g302_payout_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g302_payout_intents FROM PUBLIC,anon,authenticated;
-- No direct client policy, no client grants, no stored bank number/card number.
-- A privileged future writer must validate PSP webhook signatures, use
-- transactional idempotency/locks, and reconcile payout acknowledgements.
-- Unknown provider outcome = HOLD + QUERY PROVIDER, never blind retry.
-- This SQL alone does not create an automated payout worker or PSP integration.
