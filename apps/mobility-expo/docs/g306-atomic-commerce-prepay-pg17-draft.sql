-- G306 DRAFT ONLY: NOT INSTALLED IN SUPABASE OR RAILWAY.
-- This is an isolated PG16 testable precursor to a genuine PSP adapter.
-- DO NOT run in LIVE without provider signature, chargeback, TTL, legal
-- settlement and G173 session authority having passed external review.
CREATE SCHEMA IF NOT EXISTS qore_stage_internal;
CREATE TABLE IF NOT EXISTS qore_stage_internal.mobility_stage_g306_prepaid_receipts (
  order_id uuid PRIMARY KEY REFERENCES public.mobility_stage_merchant_orders(id) ON DELETE RESTRICT,
  quote_id uuid NOT NULL REFERENCES public.mobility_stage_fare_quotes(id) ON DELETE RESTRICT,
  buyer_id uuid NOT NULL,
  provider text NOT NULL CHECK(length(provider) BETWEEN 8 AND 120),
  psp_payment_ref text NOT NULL UNIQUE CHECK(length(psp_payment_ref) BETWEEN 8 AND 120),
  provider_event_ref text NOT NULL UNIQUE CHECK(length(provider_event_ref) BETWEEN 8 AND 120),
  payment_method text NOT NULL CHECK(payment_method IN ('CARD','QR','BANK_TRANSFER')),
  provider_state text NOT NULL CHECK(provider_state IN ('CAPTURED','SETTLED','REFUNDED','CHARGEBACK')),
  currency text NOT NULL DEFAULT 'PYG' CHECK(currency='PYG'),
  captured_pyg bigint NOT NULL CHECK(captured_pyg BETWEEN 1 AND 100000000),
  signed_callback_verified boolean NOT NULL CHECK(signed_callback_verified = true),
  independent_lookup_verified boolean NOT NULL CHECK(independent_lookup_verified = true),
  captured_at timestamptz NOT NULL,
  revoked_at timestamptz,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT g306_payment_rail_state CHECK(
    (payment_method='CARD' AND provider_state IN ('CAPTURED','SETTLED','REFUNDED','CHARGEBACK')) OR
    (payment_method IN ('QR','BANK_TRANSFER') AND provider_state IN ('SETTLED','REFUNDED','CHARGEBACK')))
);
ALTER TABLE qore_stage_internal.mobility_stage_g306_prepaid_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON qore_stage_internal.mobility_stage_g306_prepaid_receipts
 FROM PUBLIC,anon,authenticated;
-- Server-role only: actual PSP collector needs independently verified
-- identity, signature, provider status and duplicate-event reconciliation.
GRANT SELECT,INSERT,UPDATE ON qore_stage_internal.mobility_stage_g306_prepaid_receipts TO service_role;
GRANT USAGE ON SCHEMA qore_stage_internal TO service_role;

-- SECURITY INVOKER. NEVER public / authenticated; caller is service_role
-- with separately verified G173 staff identity and private provider attestation.
-- Locks original merchant order FIRST, then the unique prepaid proof.
-- The underlying original G173 SQL mutation runs in this SAME transaction.
CREATE OR REPLACE FUNCTION qore_stage_internal.mobility_stage_g306_prepaid_transition_qa(
 _actor uuid,_session uuid,_iat bigint,_order uuid,_action text,_request uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
SET lock_timeout = '3s'
AS $g306$
DECLARE
 o record;
 p record;
 q record;
BEGIN
 IF current_user <> 'service_role' OR _actor IS NULL OR _session IS NULL OR
   _iat IS NULL OR _request IS NULL OR _order IS NULL OR
   _action NOT IN ('confirm','start_preparing','ready','hand_to_courier') THEN
  RAISE EXCEPTION 'G306 merchant mutation actor/action forbidden' USING ERRCODE='P3061';
 END IF;

 SELECT id,buyer_id,subtotal_pyg,status,created_at INTO o
 FROM public.mobility_stage_merchant_orders
 WHERE id=_order FOR UPDATE;
 IF NOT FOUND OR o.status::text IN ('cancelled','delivered') THEN
  RAISE EXCEPTION 'G306 original Merchant order invalid' USING ERRCODE='P3062';
 END IF;

 SELECT order_id,quote_id,buyer_id,provider_state,payment_method,
        captured_pyg,currency,captured_at,revoked_at,
        signed_callback_verified,independent_lookup_verified
 INTO p
 FROM qore_stage_internal.mobility_stage_g306_prepaid_receipts
 WHERE order_id=_order FOR UPDATE;
 IF NOT FOUND OR p.buyer_id<>o.buyer_id OR p.currency<>'PYG' OR
   p.revoked_at IS NOT NULL OR
   p.signed_callback_verified IS DISTINCT FROM true OR
   p.independent_lookup_verified IS DISTINCT FROM true OR
   (p.payment_method='CARD' AND p.provider_state NOT IN ('CAPTURED','SETTLED')) OR
   (p.payment_method IN ('QR','BANK_TRANSFER') AND p.provider_state<>'SETTLED') THEN
  RAISE EXCEPTION 'G306 no valid nonreversed PSP prepayment' USING ERRCODE='P3063';
 END IF;

 SELECT id,customer_id,subject_id,subject_kind,total_pyg,expires_at INTO q
 FROM public.mobility_stage_fare_quotes
 WHERE id=p.quote_id;
 IF NOT FOUND OR q.customer_id<>o.buyer_id OR q.subject_id<>o.id OR
   q.subject_kind::text<>'MERCHANT_ORDER' OR q.total_pyg < 0 OR
   o.subtotal_pyg<=0 OR
   o.subtotal_pyg::bigint+q.total_pyg::bigint<>p.captured_pyg OR
   p.captured_at<o.created_at OR p.captured_at>q.expires_at THEN
  RAISE EXCEPTION 'G306 order/quote/payment mismatch' USING ERRCODE='P3064';
 END IF;

 -- Original G173 verifies independently attested Merchant staff/G42 session,
 -- expected event sequence, request-key idempotency and original row mutation.
 -- All locks above persist until G173 commits; no check-then-act gap.
 RETURN public.mobility_stage_g173_merchant_transition_qa(
  _actor,_session,_iat,_order,_action,_request
 );
END
$g306$;

REVOKE ALL ON FUNCTION
 qore_stage_internal.mobility_stage_g306_prepaid_transition_qa(
  uuid,uuid,bigint,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION
 qore_stage_internal.mobility_stage_g306_prepaid_transition_qa(
  uuid,uuid,bigint,uuid,text,uuid) TO service_role;
-- Note: G305 HTTP gate stays active. Do not add a public HTTP path to this
-- function until provider integration, whole-order atomic checks and G173 are
-- independently installed & tested on the current PG17 staging schema.
