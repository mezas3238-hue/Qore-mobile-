-- G94: F1 AUTO passenger cancellation voids G93 provisional financial
-- obligations atomically. PostgreSQL16 disposable QA ONLY, never live money.
-- No fake Driver acceptance, no PSP refund/capture, no remote installation.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regclass('public.mobility_stage_g93_auto_ledger') IS NULL
 OR pg_catalog.to_regprocedure('public.mobility_stage_auto_demo_transition(uuid,uuid,public.mobility_stage_trip_status,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G94 requires disposable G93/G3 chain'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g94_auto_voids (
 quote_id uuid PRIMARY KEY REFERENCES public.mobility_stage_g93_auto_ledger(quote_id)
  ON DELETE RESTRICT,
 trip_id uuid NOT NULL UNIQUE REFERENCES public.mobility_stage_auto_demo_trips(id)
  ON DELETE RESTRICT,
 booking_key uuid NOT NULL UNIQUE,
 passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 voided_revision bigint NOT NULL CHECK(voided_revision>=2),
 voided_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
CREATE TABLE public.mobility_stage_g94_auto_void_entries (
 quote_id uuid NOT NULL REFERENCES public.mobility_stage_g94_auto_voids(quote_id)
  ON DELETE RESTRICT,
 account text NOT NULL CHECK(account IN
  ('customer_clearing','customer_subsidy_expense',
   'driver_payable','platform_nominal_commission')),
 side text NOT NULL CHECK(side IN ('debit','credit')),
 amount_gs integer NOT NULL CHECK(amount_gs BETWEEN 0 AND 100000000),
 PRIMARY KEY(quote_id,account)
);
ALTER TABLE public.mobility_stage_g94_auto_voids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g94_auto_void_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g94_auto_voids
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_g94_auto_void_entries
 FROM PUBLIC,anon,authenticated,service_role;

-- This is a trigger on the REAL G3 trip mutation, not a second cancellation
-- endpoint. The existing G3 transition enforces allowed actor/status order,
-- serialization FOR UPDATE and requestKey replay; all financial reversals
-- roll back alongside the trip update if any prerequisite is unbalanced.
CREATE FUNCTION public.mobility_stage_g94_void_cancelled_auto_qa()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE
 ledger public.mobility_stage_g93_auto_ledger%ROWTYPE;
 n integer; debit_total bigint; credit_total bigint;
BEGIN
 IF TG_OP<>'UPDATE' OR TG_TABLE_SCHEMA<>'public'
 OR TG_TABLE_NAME<>'mobility_stage_auto_demo_trips'
 THEN RAISE EXCEPTION 'G94 invalid trigger origin' USING ERRCODE='P9401'; END IF;
 IF NEW.status<>'cancelled' OR OLD.status='cancelled' THEN RETURN NEW; END IF;
 SELECT * INTO ledger FROM public.mobility_stage_g93_auto_ledger l
 WHERE l.trip_id=NEW.id AND l.passenger_id=NEW.passenger_id
 AND l.booking_key=NEW.request_key FOR UPDATE;
 IF NOT FOUND THEN RETURN NEW; END IF; -- campaign not installed at booking.
 IF NEW.revision<>OLD.revision+1 OR ledger.quote_id IS NULL OR
 NEW.driver_id IS DISTINCT FROM OLD.driver_id OR
 NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
 THEN RAISE EXCEPTION 'G94 cancellation state mismatch' USING ERRCODE='P9401'; END IF;
 SELECT count(*),
  COALESCE(sum(CASE WHEN side='debit' THEN amount_gs ELSE 0 END),0),
  COALESCE(sum(CASE WHEN side='credit' THEN amount_gs ELSE 0 END),0)
 INTO n,debit_total,credit_total
 FROM public.mobility_stage_g93_auto_ledger_entries e WHERE e.quote_id=ledger.quote_id;
 IF n<>4 OR debit_total<>ledger.original_fare_gs OR
 credit_total<>ledger.original_fare_gs OR NOT EXISTS(
   SELECT 1 FROM public.mobility_stage_g93_auto_ledger_entries e
   WHERE e.quote_id=ledger.quote_id AND e.account='customer_clearing'
    AND e.side='debit' AND e.amount_gs=ledger.customer_pays_gs)
 OR NOT EXISTS(
   SELECT 1 FROM public.mobility_stage_g93_auto_ledger_entries e
   WHERE e.quote_id=ledger.quote_id AND e.account='customer_subsidy_expense'
    AND e.side='debit' AND e.amount_gs=ledger.subsidy_gs)
 OR NOT EXISTS(
   SELECT 1 FROM public.mobility_stage_g93_auto_ledger_entries e
   WHERE e.quote_id=ledger.quote_id AND e.account='driver_payable'
    AND e.side='credit' AND e.amount_gs=ledger.driver_receives_gs)
 OR NOT EXISTS(
   SELECT 1 FROM public.mobility_stage_g93_auto_ledger_entries e
   WHERE e.quote_id=ledger.quote_id AND e.account='platform_nominal_commission'
    AND e.side='credit' AND e.amount_gs=ledger.nominal_commission_gs)
 THEN RAISE EXCEPTION 'G94 original booking ledger corrupt' USING ERRCODE='P9401'; END IF;

 INSERT INTO public.mobility_stage_g94_auto_voids(
 quote_id,trip_id,booking_key,passenger_id,voided_revision)
 VALUES(ledger.quote_id,NEW.id,ledger.booking_key,ledger.passenger_id,NEW.revision);

 INSERT INTO public.mobility_stage_g94_auto_void_entries(quote_id,account,side,amount_gs)
 SELECT e.quote_id,e.account,
 CASE e.side WHEN 'debit' THEN 'credit' ELSE 'debit' END,
 e.amount_gs FROM public.mobility_stage_g93_auto_ledger_entries e
 WHERE e.quote_id=ledger.quote_id;
 RETURN NEW;
END $f$;
CREATE TRIGGER mobility_stage_g94_auto_cancelled_finance
 AFTER UPDATE OF status ON public.mobility_stage_auto_demo_trips
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g94_void_cancelled_auto_qa();

-- Private, owned reconciliation: no customer PII, payment capture or refund.
-- "RESERVED_QA" is NOT collected cash. "COMPLETED_UNSETTLED_QA" explicitly
-- requires a future certified PSP + verified real Driver journey.
CREATE FUNCTION public.mobility_stage_g94_auto_financial_state_qa(
 _passenger_id uuid,_booking_key uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,
  'ownerId',l.passenger_id,'bookingKey',l.booking_key,
  'tripId',l.trip_id,'quoteId',l.quote_id,
  'tripState',t.status::text,'tripRevision',t.revision,
  'financialState',CASE
    WHEN t.status='cancelled' AND v.quote_id IS NOT NULL THEN 'VOIDED_QA'
    WHEN t.status='cancelled' THEN 'RECONCILIATION_ERROR_QA'
    WHEN t.status='completed' THEN 'COMPLETED_UNSETTLED_QA'
    ELSE 'RESERVED_QA' END,
  'customerPaysGs',l.customer_pays_gs,
  'driverReceivesGs',l.driver_receives_gs,
  'customerSubsidyGs',l.subsidy_gs,
  'platformRetainsGs',l.platform_retains_gs,
  'originalEntriesBalanced',
  (SELECT count(*)=4 AND COALESCE(sum(
    CASE WHEN e.side='debit' THEN e.amount_gs ELSE -e.amount_gs END),1)=0
   FROM public.mobility_stage_g93_auto_ledger_entries e
   WHERE e.quote_id=l.quote_id),
  'reversalEntriesBalanced',
  (v.quote_id IS NOT NULL AND
   (SELECT count(*)=4 AND COALESCE(sum(
    CASE WHEN e.side='debit' THEN e.amount_gs ELSE -e.amount_gs END),1)=0
    FROM public.mobility_stage_g94_auto_void_entries e
    WHERE e.quote_id=l.quote_id)),
  'pspCollected',false,'pspRefunded',false,'serverPersisted',true)
 FROM public.mobility_stage_g93_auto_ledger l
 JOIN public.mobility_stage_auto_demo_trips t
   ON t.id=l.trip_id AND t.passenger_id=l.passenger_id
   AND t.request_key=l.booking_key
 LEFT JOIN public.mobility_stage_g94_auto_voids v
   ON v.quote_id=l.quote_id AND v.trip_id=l.trip_id
 WHERE l.passenger_id=_passenger_id AND l.booking_key=_booking_key
 LIMIT 1
$f$;

REVOKE ALL ON FUNCTION public.mobility_stage_g94_void_cancelled_auto_qa()
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g94_auto_financial_state_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g94_auto_financial_state_qa(uuid,uuid)
 TO service_role;
COMMIT;
