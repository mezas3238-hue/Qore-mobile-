-- G100 MOTO_RIDE: dedicated passenger booking + provisional Owner discount ledger.
-- No AUTO SQL/table reuse; no DELIVERY courier, legal Driver assignment,
-- PSP charge/refund, or real route/tariff authority. Disposable PG16 CI ONLY.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_fare_rules') IS NULL
 OR to_regclass('public.mobility_stage_g93_ride_campaigns') IS NULL
 OR to_regprocedure('public.mobility_stage_g27_backoffice_role_of(uuid)') IS NULL
 THEN RAISE EXCEPTION 'G100 exclusively disposable G7/G93/G27 chain'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g100_moto_quotes(
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 service public.mobility_service_kind NOT NULL DEFAULT 'moto_pasajero'
  CHECK(service='moto_pasajero'),
 origin_tag text NOT NULL CHECK(origin_tag ~ '^[A-Z_]{3,40}$'),
 destination_tag text NOT NULL CHECK(destination_tag ~ '^[A-Z_]{3,40}$'),
 zone_tag text NOT NULL CHECK(zone_tag ~ '^[A-Z_]{3,40}$'),
 distance_meters integer NOT NULL CHECK(distance_meters BETWEEN 0 AND 500000),
 duration_seconds integer NOT NULL CHECK(duration_seconds BETWEEN 0 AND 86400),
 rule_id uuid NOT NULL REFERENCES public.mobility_stage_fare_rules(id),
 campaign_id uuid NOT NULL REFERENCES public.mobility_stage_g93_ride_campaigns(id),
 fare_gs integer NOT NULL CHECK(fare_gs BETWEEN 1 AND 100000000),
 commission_bps integer NOT NULL CHECK(commission_bps BETWEEN 1000 AND 3000),
 commission_version integer NOT NULL CHECK(commission_version>0),
 nominal_commission_gs integer NOT NULL CHECK(nominal_commission_gs>=0),
 subsidy_gs integer NOT NULL CHECK(subsidy_gs>=0),
 driver_receives_gs integer NOT NULL CHECK(driver_receives_gs>=0),
 platform_retains_gs integer NOT NULL CHECK(platform_retains_gs>=0),
 customer_pays_gs integer NOT NULL CHECK(customer_pays_gs>=0),
 quoted_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 expires_at timestamptz NOT NULL,
 CHECK(expires_at>quoted_at),
 CHECK(nominal_commission_gs=(fare_gs::bigint*commission_bps+5000)/10000),
 CHECK(subsidy_gs=(fare_gs::bigint*1000+5000)/10000),
 CHECK(driver_receives_gs+nominal_commission_gs=fare_gs),
 CHECK(customer_pays_gs+subsidy_gs=fare_gs),
 CHECK(platform_retains_gs=nominal_commission_gs-subsidy_gs),
 CHECK(driver_receives_gs+platform_retains_gs=customer_pays_gs)
);
CREATE TABLE public.mobility_stage_g100_moto_trips(
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 booking_key uuid NOT NULL UNIQUE,
 quote_id uuid NOT NULL UNIQUE REFERENCES public.mobility_stage_g100_moto_quotes(id),
 passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 service public.mobility_service_kind NOT NULL DEFAULT 'moto_pasajero'
  CHECK(service='moto_pasajero'),
 status text NOT NULL DEFAULT 'searching' CHECK(status IN ('searching','cancelled')),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision IN (1,2)),
 cancellation_key uuid UNIQUE,
 cancellation_event_id uuid UNIQUE,
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 CHECK((status='searching' AND revision=1 AND cancellation_key IS NULL AND cancellation_event_id IS NULL)
 OR(status='cancelled' AND revision=2 AND cancellation_key IS NOT NULL AND cancellation_event_id IS NOT NULL))
);
CREATE UNIQUE INDEX mobility_stage_g100_one_active_moto_passenger
 ON public.mobility_stage_g100_moto_trips(passenger_id)
 WHERE status='searching';
CREATE TABLE public.mobility_stage_g100_moto_entries(
 quote_id uuid NOT NULL REFERENCES public.mobility_stage_g100_moto_quotes(id),
 phase text NOT NULL CHECK(phase IN ('reserve','reverse')),
 account text NOT NULL CHECK(account IN
 ('customer_clearing','customer_subsidy_expense','driver_payable','platform_nominal_commission')),
 side text NOT NULL CHECK(side IN ('debit','credit')),
 amount_gs integer NOT NULL CHECK(amount_gs>=0),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 PRIMARY KEY(quote_id,phase,account)
);
ALTER TABLE public.mobility_stage_g100_moto_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g100_moto_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g100_moto_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g100_moto_quotes FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_g100_moto_trips FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_g100_moto_entries FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.mobility_stage_g100_moto_quote_receipt_qa(_passenger uuid,_quote uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,'ownerId',q.passenger_id,
  'serviceKind','MOTO_RIDE','service','moto_pasajero','quoteId',q.id,
  'quoteRequestKey',q.request_key,'campaignId',q.campaign_id,
  'currency','PYG','amountGs',q.fare_gs,
  'commissionBps',q.commission_bps,'subsidyBps',1000,
  'customerPaysGs',q.customer_pays_gs,'customerSubsidyGs',q.subsidy_gs,
  'driverReceivesGs',q.driver_receives_gs,'platformRetainsGs',q.platform_retains_gs,
  'expiresAt',floor(extract(epoch from q.expires_at)*1000)::bigint,
  'driverAssigned',false,'pspCollected',false,'serverPersisted',true)
 FROM public.mobility_stage_g100_moto_quotes q
 WHERE q.id=$2 AND q.passenger_id=$1
$f$;

CREATE FUNCTION public.mobility_stage_g100_moto_quote_qa(
 _passenger uuid,_request uuid,_origin text,_destination text,_zone text,
 _distance integer,_seconds integer)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE
 old public.mobility_stage_g100_moto_quotes%ROWTYPE;
 fare public.mobility_stage_fare_rules%ROWTYPE;
 campaign public.mobility_stage_g93_ride_campaigns%ROWTYPE;
 policy public.mobility_stage_g116_commission_policy%ROWTYPE;
 amount bigint; nominal bigint; subsidy bigint; new_id uuid;
BEGIN
 IF current_database()<>'qore_disposable_chain' OR
 current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _passenger IS NULL OR _request IS NULL
 OR _origin !~ '^[A-Z_]{3,40}$' OR _destination !~ '^[A-Z_]{3,40}$'
 OR _origin=_destination OR _zone !~ '^[A-Z_]{3,40}$'
 OR _distance NOT BETWEEN 0 AND 500000 OR _seconds NOT BETWEEN 0 AND 86400
 OR (SELECT count(*) FROM public.user_roles WHERE user_id=_passenger)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
   WHERE user_id=_passenger AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G100 invalid passenger or route attestations' USING ERRCODE='P1001'; END IF;
 SELECT * INTO old FROM public.mobility_stage_g100_moto_quotes
 WHERE request_key=_request;
 IF FOUND THEN
  IF ROW(old.passenger_id,old.origin_tag,old.destination_tag,old.zone_tag,
     old.distance_meters,old.duration_seconds) IS DISTINCT FROM
    ROW(_passenger,_origin,_destination,_zone,_distance,_seconds)
   THEN RAISE EXCEPTION 'G100 quote replay conflict' USING ERRCODE='P1001'; END IF;
  RETURN public.mobility_stage_g100_moto_quote_receipt_qa(_passenger,old.id);
 END IF;
 SELECT * INTO fare FROM public.mobility_stage_fare_rules
 WHERE mode='MOTO' AND zone_tag=_zone AND active
 AND valid_from<=pg_catalog.clock_timestamp() AND valid_until>pg_catalog.clock_timestamp()
;
 IF NOT FOUND THEN RAISE EXCEPTION 'G100 MOTO fare not independently approved'
 USING ERRCODE='P1001'; END IF;
 SELECT * INTO campaign FROM public.mobility_stage_g93_ride_campaigns
 WHERE service_kind='MOTO_RIDE' AND active
 AND begins_at<=pg_catalog.clock_timestamp() AND ends_at>pg_catalog.clock_timestamp();
 IF NOT FOUND OR public.mobility_stage_g27_backoffice_role_of(campaign.approved_by)
 IS DISTINCT FROM 'owner'
 THEN RAISE EXCEPTION 'G100 Owner MOTO campaign not authorized'
 USING ERRCODE='P1001'; END IF;
 amount:=GREATEST(fare.minimum_pyg,
  fare.base_pyg::bigint+(_distance::bigint*fare.per_km_pyg+500)/1000
  +(_seconds::bigint*fare.per_minute_pyg+30)/60);
 IF amount NOT BETWEEN 1 AND 100000000
 THEN RAISE EXCEPTION 'G100 fare invalid' USING ERRCODE='P1001'; END IF;
 SELECT * INTO policy FROM public.mobility_stage_g116_commission_policy
 WHERE service_kind='MOTO_RIDE' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G116 MOTO policy unavailable'
 USING ERRCODE='P1001'; END IF;
 nominal:=(amount*policy.commission_bps+5000)/10000;
 subsidy:=(amount*1000+5000)/10000;
 INSERT INTO public.mobility_stage_g100_moto_quotes(
  request_key,passenger_id,origin_tag,destination_tag,zone_tag,
  distance_meters,duration_seconds,rule_id,campaign_id,
  fare_gs,commission_bps,commission_version,nominal_commission_gs,subsidy_gs,
  driver_receives_gs,platform_retains_gs,customer_pays_gs,expires_at)
 VALUES(_request,_passenger,_origin,_destination,_zone,
  _distance,_seconds,fare.id,campaign.id,amount,policy.commission_bps,policy.version,nominal,subsidy,
  amount-nominal,nominal-subsidy,amount-subsidy,
  pg_catalog.clock_timestamp()+interval '5 minutes')
 ON CONFLICT(request_key) DO NOTHING RETURNING id INTO new_id;
 IF new_id IS NULL THEN
  SELECT * INTO old FROM public.mobility_stage_g100_moto_quotes
   WHERE request_key=_request;
  IF NOT FOUND OR ROW(old.passenger_id,old.origin_tag,old.destination_tag,old.zone_tag,
   old.distance_meters,old.duration_seconds) IS DISTINCT FROM
   ROW(_passenger,_origin,_destination,_zone,_distance,_seconds)
  THEN RAISE EXCEPTION 'G100 concurrent quote replay conflict' USING ERRCODE='P1001'; END IF;
  new_id:=old.id;
 END IF;
 RETURN public.mobility_stage_g100_moto_quote_receipt_qa(_passenger,new_id);
END $f$;

CREATE FUNCTION public.mobility_stage_g100_moto_booking_receipt_qa(
 _passenger uuid,_booking uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
DECLARE t public.mobility_stage_g100_moto_trips%ROWTYPE;
 q public.mobility_stage_g100_moto_quotes%ROWTYPE;
 reservations integer; reversals integer;
BEGIN
 SELECT * INTO t FROM public.mobility_stage_g100_moto_trips
 WHERE passenger_id=_passenger AND booking_key=_booking;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO q FROM public.mobility_stage_g100_moto_quotes
 WHERE id=t.quote_id AND passenger_id=_passenger;
 IF NOT FOUND THEN RAISE EXCEPTION 'G100 booking quote detached' USING ERRCODE='P1001'; END IF;
 SELECT count(*) INTO reservations FROM public.mobility_stage_g100_moto_entries
 WHERE quote_id=q.id AND phase='reserve';
 SELECT count(*) INTO reversals FROM public.mobility_stage_g100_moto_entries
 WHERE quote_id=q.id AND phase='reverse';
 IF reservations<>4 OR (t.status='cancelled' AND reversals<>4)
  OR (t.status='searching' AND reversals<>0)
  OR EXISTS(SELECT 1 FROM public.mobility_stage_g100_moto_entries r
   LEFT JOIN public.mobility_stage_g100_moto_entries v
    ON v.quote_id=r.quote_id AND v.account=r.account AND v.phase='reverse'
   WHERE r.quote_id=q.id AND r.phase='reserve' AND t.status='cancelled'
    AND (v.side=r.side OR v.amount_gs<>r.amount_gs OR v.account IS NULL))
 THEN RAISE EXCEPTION 'G100 provisional moto ledger inconsistent' USING ERRCODE='P1001'; END IF;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,'ownerId',_passenger,
  'serviceKind','MOTO_RIDE','service','moto_pasajero',
  'bookingKey',t.booking_key,'quoteId',q.id,'tripId',t.id,
  'tripState',t.status,'tripRevision',t.revision,
  'cancellationKey',t.cancellation_key,'cancellationEventId',t.cancellation_event_id,
  'currency','PYG','amountGs',q.fare_gs,
  'customerPaysGs',q.customer_pays_gs,'customerSubsidyGs',q.subsidy_gs,
  'driverReceivesGs',q.driver_receives_gs,'platformRetainsGs',q.platform_retains_gs,
  'commissionBps',q.commission_bps,'subsidyBps',1000,
  'financialState',CASE WHEN t.status='cancelled' THEN 'VOIDED_QA' ELSE 'RESERVED_QA' END,
  'reversalEntriesBalanced',(t.status='cancelled' AND reversals=4),
  'driverAssigned',false,'pspCollected',false,'pspRefunded',false,
  'serverPersisted',true);
END $f$;

CREATE FUNCTION public.mobility_stage_g100_moto_book_qa(
 _passenger uuid,_quote uuid,_booking uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE q public.mobility_stage_g100_moto_quotes%ROWTYPE;
 prior public.mobility_stage_g100_moto_trips%ROWTYPE;
 trip uuid;
BEGIN
 IF current_database()<>'qore_disposable_chain' OR
 current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _passenger IS NULL OR _quote IS NULL OR _booking IS NULL
 OR (SELECT count(*) FROM public.user_roles WHERE user_id=_passenger)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_passenger
 AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G100 invalid booking actor' USING ERRCODE='P1001'; END IF;
 SELECT * INTO q FROM public.mobility_stage_g100_moto_quotes WHERE id=_quote FOR UPDATE;
 IF NOT FOUND OR q.passenger_id<>_passenger
 THEN RAISE EXCEPTION 'G100 quote absent or foreign' USING ERRCODE='P1001'; END IF;
 SELECT * INTO prior FROM public.mobility_stage_g100_moto_trips WHERE booking_key=_booking;
 IF FOUND THEN
  IF prior.passenger_id<>_passenger OR prior.quote_id<>_quote
  THEN RAISE EXCEPTION 'G100 booking key replay conflict' USING ERRCODE='P1001'; END IF;
  RETURN public.mobility_stage_g100_moto_booking_receipt_qa(_passenger,_booking);
 END IF;
 IF EXISTS(SELECT 1 FROM public.mobility_stage_g100_moto_trips WHERE quote_id=q.id)
 OR q.expires_at<=pg_catalog.clock_timestamp()
 OR NOT EXISTS(SELECT 1 FROM public.mobility_stage_g93_ride_campaigns c
   WHERE c.id=q.campaign_id AND c.service_kind='MOTO_RIDE'
   AND c.active AND c.begins_at<=pg_catalog.clock_timestamp()
   AND c.ends_at>pg_catalog.clock_timestamp()
   AND public.mobility_stage_g27_backoffice_role_of(c.approved_by)='owner')
 OR NOT EXISTS(SELECT 1 FROM public.mobility_stage_fare_rules f
  WHERE f.id=q.rule_id AND f.mode='MOTO'
  AND f.active AND f.valid_until>pg_catalog.clock_timestamp())
 OR EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_trips a
   WHERE a.passenger_id=_passenger AND a.status IN
   ('searching','accepted','arriving','in_progress'))
 THEN RAISE EXCEPTION 'G100 not eligible for booked MOTO' USING ERRCODE='P1001'; END IF;
 INSERT INTO public.mobility_stage_g100_moto_trips(booking_key,quote_id,passenger_id)
 VALUES(_booking,_quote,_passenger) RETURNING id INTO trip;
 INSERT INTO public.mobility_stage_g100_moto_entries(quote_id,phase,account,side,amount_gs)
 VALUES
  (_quote,'reserve','customer_clearing','debit',q.customer_pays_gs),
  (_quote,'reserve','customer_subsidy_expense','debit',q.subsidy_gs),
  (_quote,'reserve','driver_payable','credit',q.driver_receives_gs),
  (_quote,'reserve','platform_nominal_commission','credit',q.nominal_commission_gs);
 RETURN public.mobility_stage_g100_moto_booking_receipt_qa(_passenger,_booking);
END $f$;

CREATE FUNCTION public.mobility_stage_g100_moto_cancel_qa(
 _passenger uuid,_booking uuid,_decision uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE t public.mobility_stage_g100_moto_trips%ROWTYPE;
BEGIN
 IF current_database()<>'qore_disposable_chain' OR
 current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _passenger IS NULL OR _booking IS NULL OR _decision IS NULL
 OR (SELECT count(*) FROM public.user_roles WHERE user_id=_passenger)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_passenger
 AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G100 invalid passenger cancellation' USING ERRCODE='P1001'; END IF;
 SELECT * INTO t FROM public.mobility_stage_g100_moto_trips
 WHERE booking_key=_booking AND passenger_id=_passenger FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G100 booking not found for actor' USING ERRCODE='P1001'; END IF;
 IF t.status='cancelled' THEN
  IF t.cancellation_key<>_decision THEN RAISE EXCEPTION 'G100 conflicting cancellation'
   USING ERRCODE='P1001'; END IF;
  RETURN public.mobility_stage_g100_moto_booking_receipt_qa(_passenger,_booking);
 END IF;
 IF t.status<>'searching'
 THEN RAISE EXCEPTION 'G100 lifecycle cannot cancel' USING ERRCODE='P1001'; END IF;
 UPDATE public.mobility_stage_g100_moto_trips
 SET status='cancelled',revision=2,cancellation_key=_decision,
 cancellation_event_id=pg_catalog.gen_random_uuid(),
 updated_at=pg_catalog.clock_timestamp()
 WHERE id=t.id;
 INSERT INTO public.mobility_stage_g100_moto_entries
 (quote_id,phase,account,side,amount_gs)
 SELECT quote_id,'reverse',account,
  CASE WHEN side='debit' THEN 'credit' ELSE 'debit' END,amount_gs
 FROM public.mobility_stage_g100_moto_entries
 WHERE quote_id=t.quote_id AND phase='reserve';
 RETURN public.mobility_stage_g100_moto_booking_receipt_qa(_passenger,_booking);
END $f$;
REVOKE ALL ON FUNCTION public.mobility_stage_g100_moto_quote_receipt_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g100_moto_quote_qa(uuid,uuid,text,text,text,integer,integer)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g100_moto_booking_receipt_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g100_moto_book_qa(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g100_moto_cancel_qa(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g100_moto_quote_receipt_qa(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g100_moto_quote_qa(uuid,uuid,text,text,text,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g100_moto_booking_receipt_qa(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g100_moto_book_qa(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g100_moto_cancel_qa(uuid,uuid,uuid) TO service_role;
COMMIT;
