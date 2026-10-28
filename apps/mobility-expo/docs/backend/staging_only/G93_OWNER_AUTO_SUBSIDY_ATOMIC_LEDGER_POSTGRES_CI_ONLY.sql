-- G93 F1: subsidio Owner AUTO_RIDE, PostgreSQL 16 DESECHABLE QA ONLY.
-- No remote migration, PSP, LIVE discount, or authorized commercial campaign.
-- Reuses G73/G72/G3: the booking UPDATE atomically inserts a ledger or aborts.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g73_book(uuid,uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g27_backoffice_role_of(uuid)') IS NULL
 THEN RAISE EXCEPTION 'G93 requires disposable G73 and G27'; END IF;
END $guard$;
BEGIN;

CREATE TABLE public.mobility_stage_g93_ride_campaigns (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 service_kind text NOT NULL CHECK(service_kind IN ('AUTO_RIDE','MOTO_RIDE')),
 rule_version text NOT NULL CHECK(rule_version ~ '^[A-Za-z0-9._-]{1,48}$'),
 approved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 active boolean NOT NULL DEFAULT false,
 begins_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 duration_days smallint NOT NULL CHECK(duration_days IN (60,90)),
 extension_decision_id uuid,
 extension_approved_at timestamptz,
 CHECK(ends_at=begins_at+duration_days*interval '1 day'),
 CHECK((duration_days=60 AND extension_decision_id IS NULL AND extension_approved_at IS NULL)
    OR (duration_days=90 AND extension_decision_id IS NOT NULL
        AND extension_approved_at IS NOT NULL
        AND extension_approved_at>=begins_at AND extension_approved_at<ends_at))
);
CREATE UNIQUE INDEX mobility_stage_g93_one_active_campaign_per_ride
 ON public.mobility_stage_g93_ride_campaigns(service_kind) WHERE active;
ALTER TABLE public.mobility_stage_g93_ride_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g93_ride_campaigns
 FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE public.mobility_stage_g93_auto_quote_terms (
 quote_id uuid PRIMARY KEY
  REFERENCES public.mobility_stage_g72_auto_prequotes(id) ON DELETE RESTRICT,
 passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 campaign_id uuid NOT NULL
  REFERENCES public.mobility_stage_g93_ride_campaigns(id) ON DELETE RESTRICT,
 service_kind text NOT NULL DEFAULT 'AUTO_RIDE' CHECK(service_kind='AUTO_RIDE'),
 original_fare_gs integer NOT NULL CHECK(original_fare_gs BETWEEN 1 AND 100000000),
 commission_gs integer NOT NULL CHECK(commission_gs BETWEEN 0 AND 100000000),
 commission_bps integer NOT NULL CHECK(commission_bps BETWEEN 1000 AND 3000),
 commission_version integer NOT NULL CHECK(commission_version>0),
 subsidy_gs integer NOT NULL CHECK(subsidy_gs BETWEEN 0 AND 100000000),
 customer_pays_gs integer NOT NULL CHECK(customer_pays_gs BETWEEN 0 AND 100000000),
 driver_receives_gs integer NOT NULL CHECK(driver_receives_gs BETWEEN 0 AND 100000000),
 platform_retains_gs integer NOT NULL CHECK(platform_retains_gs BETWEEN 0 AND 100000000),
 CHECK(customer_pays_gs=original_fare_gs-subsidy_gs),
 CHECK(driver_receives_gs=original_fare_gs-commission_gs),
 CHECK(platform_retains_gs=commission_gs-subsidy_gs),
 CHECK(customer_pays_gs=driver_receives_gs+platform_retains_gs)
);
CREATE TABLE public.mobility_stage_g93_auto_ledger (
 quote_id uuid PRIMARY KEY REFERENCES public.mobility_stage_g93_auto_quote_terms(quote_id),
 booking_key uuid NOT NULL UNIQUE,
 trip_id uuid NOT NULL UNIQUE REFERENCES public.mobility_stage_auto_demo_trips(id),
 passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 original_fare_gs integer NOT NULL,
 customer_pays_gs integer NOT NULL,
 subsidy_gs integer NOT NULL,
 driver_receives_gs integer NOT NULL,
 nominal_commission_gs integer NOT NULL,
 platform_retains_gs integer NOT NULL,
 booked_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 CHECK(customer_pays_gs>=0 AND subsidy_gs>=0 AND driver_receives_gs>=0
   AND nominal_commission_gs>=0 AND platform_retains_gs>=0),
 CHECK(customer_pays_gs+subsidy_gs=original_fare_gs),
 CHECK(driver_receives_gs+nominal_commission_gs=original_fare_gs),
 CHECK(platform_retains_gs=nominal_commission_gs-subsidy_gs),
 CHECK(customer_pays_gs=driver_receives_gs+platform_retains_gs)
);
CREATE TABLE public.mobility_stage_g93_auto_ledger_entries (
 quote_id uuid NOT NULL REFERENCES public.mobility_stage_g93_auto_ledger(quote_id),
 account text NOT NULL CHECK(account IN
  ('customer_clearing','customer_subsidy_expense',
   'driver_payable','platform_nominal_commission')),
 side text NOT NULL CHECK(side IN ('debit','credit')),
 amount_gs integer NOT NULL CHECK(amount_gs>=0),
 PRIMARY KEY(quote_id,account)
);
ALTER TABLE public.mobility_stage_g93_auto_quote_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g93_auto_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g93_auto_ledger_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g93_auto_quote_terms FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_g93_auto_ledger FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_g93_auto_ledger_entries FROM PUBLIC,anon,authenticated,service_role;

-- A receipt deliberately separate from B's existing 15-field G73 quote.
CREATE FUNCTION public.mobility_stage_g93_terms_receipt_qa(
 _passenger_id uuid,_quote_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,
  'ownerId',t.passenger_id,'quoteId',t.quote_id,'campaignId',c.id,
  'serviceKind',t.service_kind,'currency','PYG','originalFareGs',t.original_fare_gs,
  'commissionBps',t.commission_bps,'subsidyBps',1000,
  'nominalCommissionGs',t.commission_gs,'customerSubsidyGs',t.subsidy_gs,
  'customerPaysGs',t.customer_pays_gs,
  'driverReceivesGs',t.driver_receives_gs,
  'platformRetainsGs',t.platform_retains_gs,
  'fareVersion',f.rule_key,
  'expiresAt',floor(extract(epoch from LEAST(q.expires_at,c.ends_at))*1000)::bigint,
  'serverPersisted',true)
 FROM public.mobility_stage_g93_auto_quote_terms t
 JOIN public.mobility_stage_g93_ride_campaigns c ON c.id=t.campaign_id
 JOIN public.mobility_stage_g72_auto_prequotes q ON q.id=t.quote_id
 JOIN public.mobility_stage_fare_rules f ON f.id=q.rule_id
 WHERE t.passenger_id=_passenger_id AND t.quote_id=_quote_id
   AND q.passenger_id=t.passenger_id AND q.trip_id IS NULL
   AND q.expires_at>pg_catalog.clock_timestamp()
   AND c.active AND c.begins_at<=pg_catalog.clock_timestamp()
   AND c.ends_at>pg_catalog.clock_timestamp()
   AND public.mobility_stage_g27_backoffice_role_of(c.approved_by)='owner'
$f$;

CREATE FUNCTION public.mobility_stage_g93_preview_auto_qa(
 _passenger_id uuid,_quote_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE q public.mobility_stage_g72_auto_prequotes%ROWTYPE;
 c public.mobility_stage_g93_ride_campaigns%ROWTYPE;
 t public.mobility_stage_g93_auto_quote_terms%ROWTYPE;
 policy public.mobility_stage_g116_commission_policy%ROWTYPE;
 nominal bigint; subsidy bigint;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _passenger_id IS NULL OR _quote_id IS NULL
 THEN RAISE EXCEPTION 'G93 synthetic-only private preview' USING ERRCODE='P9301'; END IF;
 SELECT * INTO q FROM public.mobility_stage_g72_auto_prequotes
 WHERE id=_quote_id AND passenger_id=_passenger_id FOR UPDATE;
 IF NOT FOUND OR q.route_id IS NULL OR q.trip_id IS NOT NULL
 OR q.expires_at<=pg_catalog.clock_timestamp()
 OR NOT EXISTS(SELECT 1 FROM public.mobility_stage_g73_auto_routes r
   WHERE r.id=q.route_id AND r.passenger_id=_passenger_id
   AND r.expires_at>pg_catalog.clock_timestamp())
 THEN RAISE EXCEPTION 'G93 invalid/expired owned G73 quote' USING ERRCODE='P9301'; END IF;
 SELECT * INTO c FROM public.mobility_stage_g93_ride_campaigns
 WHERE service_kind='AUTO_RIDE' AND active
 AND begins_at<=pg_catalog.clock_timestamp() AND ends_at>pg_catalog.clock_timestamp()
 FOR SHARE;
 IF NOT FOUND OR public.mobility_stage_g27_backoffice_role_of(c.approved_by) IS DISTINCT FROM 'owner'
 THEN RAISE EXCEPTION 'G93 no verified Owner campaign' USING ERRCODE='P9301'; END IF;
 -- Previously disclosed terms survive subsequent policy changes.
 SELECT * INTO t FROM public.mobility_stage_g93_auto_quote_terms WHERE quote_id=q.id;
 IF FOUND THEN
  IF t.passenger_id<>_passenger_id OR t.campaign_id<>c.id
   OR t.original_fare_gs<>q.total_pyg
  THEN RAISE EXCEPTION 'G116 conflicting immutable AUTO quote'
   USING ERRCODE='P9301'; END IF;
  RETURN public.mobility_stage_g93_terms_receipt_qa(_passenger_id,_quote_id);
 END IF;
 SELECT * INTO policy FROM public.mobility_stage_g116_commission_policy
 WHERE service_kind='AUTO_RIDE' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G116 AUTO policy unavailable'
 USING ERRCODE='P9301'; END IF;
 nominal:=(q.total_pyg::bigint*policy.commission_bps+5000)/10000;
 subsidy:=(q.total_pyg::bigint*1000+5000)/10000;
 INSERT INTO public.mobility_stage_g93_auto_quote_terms(
 quote_id,passenger_id,campaign_id,original_fare_gs,commission_gs,subsidy_gs,
 commission_bps,commission_version,customer_pays_gs,driver_receives_gs,platform_retains_gs)
 VALUES(q.id,q.passenger_id,c.id,q.total_pyg,nominal,subsidy,
 policy.commission_bps,policy.version,q.total_pyg-subsidy,q.total_pyg-nominal,nominal-subsidy)
 ON CONFLICT(quote_id) DO NOTHING;
 SELECT * INTO t FROM public.mobility_stage_g93_auto_quote_terms WHERE quote_id=q.id;
 IF t.campaign_id<>c.id OR t.passenger_id<>q.passenger_id
 OR t.original_fare_gs<>q.total_pyg OR t.commission_gs<>nominal OR t.subsidy_gs<>subsidy
 OR t.commission_bps<>policy.commission_bps OR t.commission_version<>policy.version
 THEN RAISE EXCEPTION 'G93 replay changed fixed quote terms' USING ERRCODE='P9301'; END IF;
 RETURN public.mobility_stage_g93_terms_receipt_qa(_passenger_id,_quote_id);
END $f$;

-- One immutable booking UPDATE; trigger executes in the SAME PG transaction
-- as G72 booking and all G3 state writes. Any ledger exception rolls all back.
CREATE FUNCTION public.mobility_stage_g93_on_auto_book_qa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE t public.mobility_stage_g93_auto_quote_terms%ROWTYPE;
 c public.mobility_stage_g93_ride_campaigns%ROWTYPE;
 stamp timestamptz:=pg_catalog.clock_timestamp();
BEGIN
 IF NEW.trip_id IS NULL OR OLD.trip_id IS NOT NULL THEN RETURN NEW; END IF;
 SELECT * INTO t FROM public.mobility_stage_g93_auto_quote_terms WHERE quote_id=NEW.id;
 IF NOT FOUND THEN
  IF EXISTS(SELECT 1 FROM public.mobility_stage_g93_ride_campaigns
     WHERE service_kind='AUTO_RIDE' AND active
     AND begins_at<=stamp AND ends_at>stamp)
  THEN RAISE EXCEPTION 'G93 campaign requires subsidy disclosure before booking'
    USING ERRCODE='P9301'; END IF;
  RETURN NEW; -- No campaign is authorized: prior QA G73 behavior unchanged.
 END IF;
 SELECT * INTO c FROM public.mobility_stage_g93_ride_campaigns WHERE id=t.campaign_id;
 IF NOT FOUND OR NOT c.active OR c.service_kind<>'AUTO_RIDE'
 OR c.begins_at>stamp OR c.ends_at<=stamp
 OR public.mobility_stage_g27_backoffice_role_of(c.approved_by) IS DISTINCT FROM 'owner'
 OR t.passenger_id<>NEW.passenger_id OR t.original_fare_gs<>NEW.total_pyg
 OR NEW.booking_key IS NULL OR NEW.trip_id IS NULL
 OR t.commission_gs<>(NEW.total_pyg::bigint*t.commission_bps+5000)/10000
 OR t.subsidy_gs<>(NEW.total_pyg::bigint*1000+5000)/10000
 THEN RAISE EXCEPTION 'G93 unverified subsidy ledger terms' USING ERRCODE='P9301'; END IF;
 INSERT INTO public.mobility_stage_g93_auto_ledger(
 quote_id,booking_key,trip_id,passenger_id,original_fare_gs,
 customer_pays_gs,subsidy_gs,driver_receives_gs,
 nominal_commission_gs,platform_retains_gs)
 VALUES(t.quote_id,NEW.booking_key,NEW.trip_id,t.passenger_id,t.original_fare_gs,
 t.customer_pays_gs,t.subsidy_gs,t.driver_receives_gs,
 t.commission_gs,t.platform_retains_gs);
 INSERT INTO public.mobility_stage_g93_auto_ledger_entries(quote_id,account,side,amount_gs)
 VALUES
 (t.quote_id,'customer_clearing','debit',t.customer_pays_gs),
 (t.quote_id,'customer_subsidy_expense','debit',t.subsidy_gs),
 (t.quote_id,'driver_payable','credit',t.driver_receives_gs),
 (t.quote_id,'platform_nominal_commission','credit',t.commission_gs);
 RETURN NEW;
END $f$;
CREATE TRIGGER mobility_stage_g93_auto_booking_atomic_ledger
 AFTER UPDATE OF trip_id ON public.mobility_stage_g72_auto_prequotes
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g93_on_auto_book_qa();

CREATE FUNCTION public.mobility_stage_g93_settlement_receipt_qa(
 _passenger_id uuid,_booking_key uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,
  'ownerId',l.passenger_id,'tripId',l.trip_id,'bookingKey',l.booking_key,
  'quoteId',l.quote_id,'originalFareGs',l.original_fare_gs,
  'customerPaysGs',l.customer_pays_gs,'customerSubsidyGs',l.subsidy_gs,
  'driverReceivesGs',l.driver_receives_gs,
  'nominalCommissionGs',l.nominal_commission_gs,
  'platformRetainsGs',l.platform_retains_gs,'currency','PYG',
  'serverPersisted',true,'entriesPersisted',
  (SELECT count(*)=4 AND COALESCE(sum(CASE WHEN e.side='debit' THEN e.amount_gs ELSE -e.amount_gs END),1)=0
   FROM public.mobility_stage_g93_auto_ledger_entries e WHERE e.quote_id=l.quote_id))
 FROM public.mobility_stage_g93_auto_ledger l
 JOIN public.mobility_stage_g72_auto_prequotes q
   ON q.id=l.quote_id AND q.booking_key=l.booking_key AND q.trip_id=l.trip_id
 WHERE l.passenger_id=_passenger_id AND l.booking_key=_booking_key
$f$;
REVOKE ALL ON FUNCTION public.mobility_stage_g93_terms_receipt_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g93_preview_auto_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g93_settlement_receipt_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g93_on_auto_book_qa()
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g93_terms_receipt_qa(uuid,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g93_preview_auto_qa(uuid,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g93_settlement_receipt_qa(uuid,uuid)
 TO service_role;
COMMIT;
