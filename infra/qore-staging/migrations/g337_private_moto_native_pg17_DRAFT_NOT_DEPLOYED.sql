-- G337 | STAGING PostgreSQL 17 | MOTO PASSENGER NATIVE PROPOSAL | DRAFT ONLY
-- NEVER apply without explicit Owner approval, backup, rollback review,
-- independent G42 session/KYC verification and legal driver authorization.
-- This is NOT the G100 PostgreSQL 16 CI_ONLY fixture. All tables are new,
-- private PG17-owned structures. No Driver assignment, PSP, LIVE or fake Owner.
-- Caller: server-only service_role after G101 verified Passenger/route.
BEGIN;
DO $guard$ BEGIN
 IF pg_catalog.current_setting('server_version_num')::integer < 170000
  OR pg_catalog.to_regnamespace('qore_stage_internal') IS NULL
  OR pg_catalog.to_regclass('auth.users') IS NULL
  OR pg_catalog.to_regclass('public.user_roles') IS NULL
  OR pg_catalog.to_regclass('public.mobility_stage_fare_rules') IS NULL
  OR pg_catalog.to_regclass('public.mobility_stage_backoffice_roles') IS NULL
  OR pg_catalog.to_regtype('public.app_role') IS NULL
  OR pg_catalog.to_regtype('public.mobility_stage_fare_mode') IS NULL
  OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='service_role')
  OR pg_catalog.to_regclass('qore_stage_internal.g337_moto_quotes') IS NOT NULL
  OR pg_catalog.to_regclass('qore_stage_internal.g337_moto_trips') IS NOT NULL
  OR pg_catalog.to_regclass('public.mobility_stage_g100_moto_quotes') IS NOT NULL
 THEN RAISE EXCEPTION 'G337 incompatible PG17 STAGING or already installed' USING ERRCODE='P3370';
 END IF;
END $guard$;

CREATE TABLE qore_stage_internal.g337_moto_quotes(
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 fare_rule_id uuid NOT NULL REFERENCES public.mobility_stage_fare_rules(id) ON DELETE RESTRICT,
 origin_tag text NOT NULL CHECK (origin_tag ~ '^[A-Z_]{3,40}$'),
 destination_tag text NOT NULL CHECK (destination_tag ~ '^[A-Z_]{3,40}$'),
 zone_tag text NOT NULL CHECK (zone_tag ~ '^[A-Z_]{3,40}$'),
 distance_meters integer NOT NULL CHECK(distance_meters BETWEEN 1 AND 500000),
 duration_seconds integer NOT NULL CHECK(duration_seconds BETWEEN 1 AND 86400),
 amount_pyg integer NOT NULL CHECK(amount_pyg BETWEEN 1 AND 100000000),
 commission_bps integer NOT NULL CHECK(commission_bps BETWEEN 1000 AND 3000),
 commission_pyg integer NOT NULL,
 subsidy_pyg integer NOT NULL,
 customer_pyg integer NOT NULL,
 driver_pyg integer NOT NULL,
 platform_pyg integer NOT NULL,
 quoted_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 expires_at timestamptz NOT NULL,
 CONSTRAINT g337_moto_distinct_zones CHECK(origin_tag<>destination_tag),
 CONSTRAINT g337_moto_fare_balanced CHECK(
  commission_pyg BETWEEN 0 AND amount_pyg AND
  subsidy_pyg BETWEEN 0 AND commission_pyg AND
  customer_pyg=amount_pyg-subsidy_pyg AND
  driver_pyg=amount_pyg-commission_pyg AND
  platform_pyg=commission_pyg-subsidy_pyg AND
  customer_pyg=driver_pyg+platform_pyg)
);
CREATE INDEX g337_moto_quotes_owner_key ON qore_stage_internal.g337_moto_quotes(passenger_id,request_key);

CREATE TABLE qore_stage_internal.g337_moto_trips(
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 quote_id uuid NOT NULL UNIQUE REFERENCES qore_stage_internal.g337_moto_quotes(id) ON DELETE RESTRICT,
 booking_key uuid NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'searching' CHECK(status IN ('searching','cancelled')),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision IN (1,2)),
 cancel_key uuid UNIQUE,
 cancel_event_id uuid UNIQUE,
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 changed_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 CONSTRAINT g337_moto_cancellation_state CHECK(
 (status='searching' AND revision=1 AND cancel_key IS NULL AND cancel_event_id IS NULL) OR
 (status='cancelled' AND revision=2 AND cancel_key IS NOT NULL AND cancel_event_id IS NOT NULL))
);
CREATE INDEX g337_moto_trips_owner_booking ON qore_stage_internal.g337_moto_trips(passenger_id,booking_key);
-- G338: a Passenger cannot hold two searching MOTO reservations.
-- Partial UNIQUE is the durable concurrency authority, including two
-- independent SQL transactions racing with different booking UUIDs.
-- Cancellation frees the slot; historical cancelled trips remain immutable.
CREATE UNIQUE INDEX g338_moto_one_active_passenger
 ON qore_stage_internal.g337_moto_trips(passenger_id)
 WHERE status='searching';

-- Simulated QA accruals, NOT PSP money, disbursements or collected funds.
CREATE TABLE qore_stage_internal.g337_moto_ledger(
 trip_id uuid NOT NULL REFERENCES qore_stage_internal.g337_moto_trips(id) ON DELETE RESTRICT,
 event text NOT NULL CHECK(event IN ('BOOK','REVERSE')),
 operation_key uuid NOT NULL,
 sequence smallint NOT NULL CHECK(sequence BETWEEN 1 AND 3),
 account text NOT NULL CHECK(account IN ('CUSTOMER_RECEIVABLE','DRIVER_PAYABLE','PLATFORM_CLEARING')),
 side text NOT NULL CHECK(side IN ('DEBIT','CREDIT')),
 amount_pyg integer NOT NULL CHECK(amount_pyg BETWEEN 0 AND 100000000),
 recorded_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 PRIMARY KEY(trip_id,event,sequence),
 UNIQUE(trip_id,operation_key,sequence)
);

ALTER TABLE qore_stage_internal.g337_moto_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE qore_stage_internal.g337_moto_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE qore_stage_internal.g337_moto_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON qore_stage_internal.g337_moto_quotes,
 qore_stage_internal.g337_moto_trips,qore_stage_internal.g337_moto_ledger
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION qore_stage_internal.g337_moto_quote_receipt(
 _passenger uuid,_request uuid
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,
  'ownerId',q.passenger_id,'serviceKind','MOTO_RIDE','service','moto_pasajero',
  'quoteId',q.id,'quoteRequestKey',q.request_key,
  'campaignId',q.fare_rule_id,'currency','PYG',
  'amountGs',q.amount_pyg,'commissionBps',q.commission_bps,'subsidyBps',1000,
  'customerPaysGs',q.customer_pyg,'customerSubsidyGs',q.subsidy_pyg,
  'driverReceivesGs',q.driver_pyg,'platformRetainsGs',q.platform_pyg,
  'expiresAt',pg_catalog.floor(extract(epoch FROM q.expires_at)*1000)::bigint,
  'driverAssigned',false,'pspCollected',false,'serverPersisted',true)
 FROM qore_stage_internal.g337_moto_quotes q
 WHERE q.passenger_id=_passenger AND q.request_key=_request
  AND q.expires_at>pg_catalog.clock_timestamp()
$f$;

CREATE FUNCTION qore_stage_internal.g337_moto_trip_receipt(
 _passenger uuid,_booking uuid
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,'ownerId',t.passenger_id,
  'serviceKind','MOTO_RIDE','service','moto_pasajero',
  'bookingKey',t.booking_key,'quoteId',q.id,'tripId',t.id,
  'tripState',t.status,'tripRevision',t.revision,
  'cancellationKey',t.cancel_key,'cancellationEventId',t.cancel_event_id,
  'currency','PYG','amountGs',q.amount_pyg,
  'customerPaysGs',q.customer_pyg,'customerSubsidyGs',q.subsidy_pyg,
  'driverReceivesGs',q.driver_pyg,'platformRetainsGs',q.platform_pyg,
  'commissionBps',q.commission_bps,'subsidyBps',1000,
  'financialState',CASE WHEN t.status='cancelled' THEN 'VOIDED_QA' ELSE 'RESERVED_QA' END,
  'reversalEntriesBalanced',CASE WHEN t.status='cancelled'
   THEN (SELECT pg_catalog.count(*)=3 AND
     COALESCE(pg_catalog.sum(CASE WHEN l.side='DEBIT' THEN l.amount_pyg
      ELSE -l.amount_pyg END),1)=0
     FROM qore_stage_internal.g337_moto_ledger l
     WHERE l.trip_id=t.id AND l.event='REVERSE' AND l.operation_key=t.cancel_key)
   ELSE false END,
  'driverAssigned',false,'pspCollected',false,'pspRefunded',false,
  'serverPersisted',true)
 FROM qore_stage_internal.g337_moto_trips t
 JOIN qore_stage_internal.g337_moto_quotes q
  ON q.id=t.quote_id AND q.passenger_id=t.passenger_id
 WHERE t.passenger_id=_passenger AND t.booking_key=_booking
  AND (SELECT pg_catalog.count(*)=3 AND
     COALESCE(pg_catalog.sum(CASE WHEN l.side='DEBIT' THEN l.amount_pyg
      ELSE -l.amount_pyg END),1)=0
   FROM qore_stage_internal.g337_moto_ledger l
   WHERE l.trip_id=t.id AND l.event='BOOK' AND l.operation_key=t.booking_key)
$f$;

CREATE FUNCTION qore_stage_internal.g337_moto_status(
 _passenger uuid,_booking uuid
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,'ownerId',t.passenger_id,
  'bookingKey',t.booking_key,'tripId',t.id,'serviceKind','MOTO_RIDE',
  'tripState',t.status,'tripRevision',t.revision,
  'driverAssigned',false,'driverIdentityExposed',false,
  'gpsVerified',false,'etaAvailable',false,
  'commissionBps',q.commission_bps,'subsidyBps',1000,'amountGs',q.amount_pyg,
  'customerPaysGs',q.customer_pyg,'customerSubsidyGs',q.subsidy_pyg,
  'financialState',CASE WHEN t.status='cancelled' THEN 'VOIDED_QA' ELSE 'RESERVED_QA' END,
  'pspCollected',false,'serverPersisted',true)
 FROM qore_stage_internal.g337_moto_trips t
 JOIN qore_stage_internal.g337_moto_quotes q
  ON q.id=t.quote_id AND q.passenger_id=t.passenger_id
 WHERE t.passenger_id=_passenger AND t.booking_key=_booking
  AND qore_stage_internal.g337_moto_trip_receipt(_passenger,_booking) IS NOT NULL
$f$;

CREATE FUNCTION qore_stage_internal.g337_moto_quote(
 _passenger uuid,_request uuid,_origin text,_destination text,_zone text,
 _distance integer,_seconds integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE
 fare public.mobility_stage_fare_rules%ROWTYPE;
 prior qore_stage_internal.g337_moto_quotes%ROWTYPE;
 created uuid;
 at timestamptz := pg_catalog.clock_timestamp();
 amount numeric;
 commission numeric;
 subsidy numeric;
BEGIN
 IF _passenger IS NULL OR _request IS NULL
  OR _origin IS NULL OR _origin !~ '^[A-Z_]{3,40}$'
  OR _destination IS NULL OR _destination !~ '^[A-Z_]{3,40}$'
  OR _origin=_destination OR _zone IS NULL OR _zone !~ '^[A-Z_]{3,40}$'
  OR _distance IS NULL OR _distance NOT BETWEEN 1 AND 500000
  OR _seconds IS NULL OR _seconds NOT BETWEEN 1 AND 86400
  OR (SELECT pg_catalog.count(*) FROM public.user_roles r WHERE r.user_id=_passenger)<>1
  OR NOT EXISTS (SELECT 1 FROM public.user_roles r
    JOIN auth.users u ON u.id=r.user_id
    WHERE r.user_id=_passenger AND r.role='passenger'::public.app_role
     AND (u.email_confirmed_at IS NOT NULL OR u.phone_confirmed_at IS NOT NULL))
 THEN RAISE EXCEPTION 'G337 invalid Passenger or independent MOTO route input'
  USING ERRCODE='P3371'; END IF;

 SELECT * INTO prior FROM qore_stage_internal.g337_moto_quotes WHERE request_key=_request FOR UPDATE;
 IF FOUND THEN
  IF prior.passenger_id<>_passenger OR prior.origin_tag<>_origin OR
   prior.destination_tag<>_destination OR prior.zone_tag<>_zone OR
   prior.distance_meters<>_distance OR prior.duration_seconds<>_seconds OR
   prior.expires_at<=at
  THEN RAISE EXCEPTION 'G337 quote idempotency conflict' USING ERRCODE='P3372'; END IF;
  RETURN qore_stage_internal.g337_moto_quote_receipt(_passenger,_request);
 END IF;

 SELECT f.* INTO fare FROM public.mobility_stage_fare_rules f
 JOIN public.mobility_stage_backoffice_roles b
  ON b.user_id=f.approved_by AND b.role='owner' AND b.status='active'
 WHERE f.mode='MOTO'::public.mobility_stage_fare_mode
  AND f.zone_tag=_zone AND f.active IS TRUE
  AND f.valid_from<=at AND f.valid_until>at
 ORDER BY f.valid_from DESC,f.approved_at DESC,f.id DESC LIMIT 1;
 IF NOT FOUND OR fare.commission_bps NOT BETWEEN 1000 AND 3000
  OR fare.base_pyg<0 OR fare.per_km_pyg<0 OR fare.per_minute_pyg<0
  OR fare.minimum_pyg<1
 THEN RAISE EXCEPTION 'G337 approved Owner MOTO fare unavailable' USING ERRCODE='P3373'; END IF;

 amount:=GREATEST(fare.minimum_pyg::numeric,
  fare.base_pyg::numeric+
  pg_catalog.ceil(fare.per_km_pyg::numeric*_distance/1000)+
  pg_catalog.ceil(fare.per_minute_pyg::numeric*_seconds/60));
 IF amount NOT BETWEEN 1 AND 100000000
 THEN RAISE EXCEPTION 'G337 fare outside PYG bounds' USING ERRCODE='P3374'; END IF;
 commission:=pg_catalog.floor((amount*fare.commission_bps+5000)/10000);
 subsidy:=pg_catalog.floor((amount*1000+5000)/10000);
 INSERT INTO qore_stage_internal.g337_moto_quotes(
  request_key,passenger_id,fare_rule_id,origin_tag,destination_tag,zone_tag,
  distance_meters,duration_seconds,amount_pyg,commission_bps,
  commission_pyg,subsidy_pyg,customer_pyg,driver_pyg,platform_pyg,expires_at)
 VALUES(_request,_passenger,fare.id,_origin,_destination,_zone,
  _distance,_seconds,amount::integer,fare.commission_bps,
  commission::integer,subsidy::integer,
  (amount-subsidy)::integer,(amount-commission)::integer,
  (commission-subsidy)::integer,at+interval '5 minutes')
 ON CONFLICT(request_key) DO NOTHING RETURNING id INTO created;
 IF created IS NULL THEN
  SELECT * INTO prior FROM qore_stage_internal.g337_moto_quotes
   WHERE request_key=_request;
  IF NOT FOUND OR prior.passenger_id<>_passenger OR
   prior.origin_tag<>_origin OR prior.destination_tag<>_destination OR
   prior.zone_tag<>_zone OR prior.distance_meters<>_distance OR
   prior.duration_seconds<>_seconds OR prior.expires_at<=pg_catalog.clock_timestamp()
  THEN RAISE EXCEPTION 'G337 concurrent quote conflict' USING ERRCODE='P3372'; END IF;
 END IF;
 RETURN qore_stage_internal.g337_moto_quote_receipt(_passenger,_request);
END $f$;

CREATE FUNCTION qore_stage_internal.g337_moto_book(
 _passenger uuid,_quote uuid,_booking uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE q qore_stage_internal.g337_moto_quotes%ROWTYPE;
 t qore_stage_internal.g337_moto_trips%ROWTYPE;
 created uuid;
BEGIN
 IF _passenger IS NULL OR _quote IS NULL OR _booking IS NULL
 THEN RAISE EXCEPTION 'G337 invalid booking reference' USING ERRCODE='P3375'; END IF;
 SELECT * INTO t FROM qore_stage_internal.g337_moto_trips
  WHERE booking_key=_booking FOR UPDATE;
 IF FOUND THEN
  IF t.passenger_id<>_passenger OR t.quote_id<>_quote
  THEN RAISE EXCEPTION 'G337 booking owner mismatch' USING ERRCODE='P3375'; END IF;
  RETURN qore_stage_internal.g337_moto_trip_receipt(_passenger,_booking);
 END IF;
 SELECT * INTO q FROM qore_stage_internal.g337_moto_quotes
  WHERE id=_quote AND passenger_id=_passenger FOR UPDATE;
 IF NOT FOUND OR q.expires_at<=pg_catalog.clock_timestamp()
 THEN RAISE EXCEPTION 'G337 absent or expired priced MOTO quote' USING ERRCODE='P3375'; END IF;
 INSERT INTO qore_stage_internal.g337_moto_trips(passenger_id,quote_id,booking_key)
 VALUES(_passenger,_quote,_booking)
 ON CONFLICT DO NOTHING RETURNING id INTO created;
 IF created IS NULL THEN
  SELECT * INTO t FROM qore_stage_internal.g337_moto_trips
   WHERE booking_key=_booking;
  IF NOT FOUND OR t.passenger_id<>_passenger OR t.quote_id<>_quote
  THEN RAISE EXCEPTION 'G337 quote already booked with conflicting key'
   USING ERRCODE='P3375'; END IF;
 ELSE
  INSERT INTO qore_stage_internal.g337_moto_ledger
    (trip_id,event,operation_key,sequence,account,side,amount_pyg) VALUES
    (created,'BOOK',_booking,1,'CUSTOMER_RECEIVABLE','DEBIT',q.customer_pyg),
    (created,'BOOK',_booking,2,'DRIVER_PAYABLE','CREDIT',q.driver_pyg),
    (created,'BOOK',_booking,3,'PLATFORM_CLEARING','CREDIT',q.platform_pyg);
 END IF;
 RETURN qore_stage_internal.g337_moto_trip_receipt(_passenger,_booking);
END $f$;

CREATE FUNCTION qore_stage_internal.g337_moto_cancel(
 _passenger uuid,_booking uuid,_decision uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE t qore_stage_internal.g337_moto_trips%ROWTYPE;
 q qore_stage_internal.g337_moto_quotes%ROWTYPE;
BEGIN
 IF _passenger IS NULL OR _booking IS NULL OR _decision IS NULL
 THEN RAISE EXCEPTION 'G337 invalid cancellation' USING ERRCODE='P3376'; END IF;
 SELECT * INTO t FROM qore_stage_internal.g337_moto_trips
  WHERE booking_key=_booking AND passenger_id=_passenger FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G337 unowned booking' USING ERRCODE='P3376'; END IF;
 IF t.status='cancelled' THEN
  IF t.cancel_key<>_decision
  THEN RAISE EXCEPTION 'G337 cancellation nonce conflict' USING ERRCODE='P3376'; END IF;
  RETURN qore_stage_internal.g337_moto_trip_receipt(_passenger,_booking);
 END IF;
 IF t.status<>'searching'
 THEN RAISE EXCEPTION 'G337 cannot cancel active Driver MOTO service' USING ERRCODE='P3376'; END IF;
 SELECT * INTO q FROM qore_stage_internal.g337_moto_quotes WHERE id=t.quote_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'G337 lost original fare source' USING ERRCODE='P3376'; END IF;
 UPDATE qore_stage_internal.g337_moto_trips
 SET status='cancelled',revision=2,cancel_key=_decision,
  cancel_event_id=pg_catalog.gen_random_uuid(),
  changed_at=pg_catalog.clock_timestamp()
 WHERE id=t.id;
 INSERT INTO qore_stage_internal.g337_moto_ledger
  (trip_id,event,operation_key,sequence,account,side,amount_pyg) VALUES
  (t.id,'REVERSE',_decision,1,'CUSTOMER_RECEIVABLE','CREDIT',q.customer_pyg),
  (t.id,'REVERSE',_decision,2,'DRIVER_PAYABLE','DEBIT',q.driver_pyg),
  (t.id,'REVERSE',_decision,3,'PLATFORM_CLEARING','DEBIT',q.platform_pyg);
 RETURN qore_stage_internal.g337_moto_trip_receipt(_passenger,_booking);
END $f$;

-- PUBLIC-SCHEMA INVOKER WRAPPERS ARE SERVICE_ROLE ONLY, NOT MOBILE API CALLS.
CREATE FUNCTION public.mobility_stage_g100_moto_quote_qa(
 _passenger uuid,_request uuid,_origin text,_destination text,_zone text,
 _distance integer,_seconds integer
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $f$
 SELECT qore_stage_internal.g337_moto_quote($1,$2,$3,$4,$5,$6,$7)
$f$;
CREATE FUNCTION public.mobility_stage_g100_moto_book_qa(
 _passenger uuid,_quote uuid,_booking uuid
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $f$
 SELECT qore_stage_internal.g337_moto_book($1,$2,$3)
$f$;
CREATE FUNCTION public.mobility_stage_g100_moto_booking_receipt_qa(
 _passenger uuid,_booking uuid
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $f$
 SELECT qore_stage_internal.g337_moto_trip_receipt($1,$2)
$f$;
CREATE FUNCTION public.mobility_stage_g118_moto_status_qa(
 _passenger uuid,_booking uuid
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $f$
 SELECT qore_stage_internal.g337_moto_status($1,$2)
$f$;
CREATE FUNCTION public.mobility_stage_g100_moto_cancel_qa(
 _passenger uuid,_booking uuid,_decision uuid
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $f$
 SELECT qore_stage_internal.g337_moto_cancel($1,$2,$3)
$f$;

-- Revoke ONLY new functions; never alter ACL of pre-existing PG17 RPCs.
REVOKE ALL ON FUNCTION
 qore_stage_internal.g337_moto_quote_receipt(uuid,uuid),
 qore_stage_internal.g337_moto_trip_receipt(uuid,uuid),
 qore_stage_internal.g337_moto_status(uuid,uuid),
 qore_stage_internal.g337_moto_quote(uuid,uuid,text,text,text,integer,integer),
 qore_stage_internal.g337_moto_book(uuid,uuid,uuid),
 qore_stage_internal.g337_moto_cancel(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION
 public.mobility_stage_g100_moto_quote_qa(uuid,uuid,text,text,text,integer,integer),
 public.mobility_stage_g100_moto_book_qa(uuid,uuid,uuid),
 public.mobility_stage_g100_moto_booking_receipt_qa(uuid,uuid),
 public.mobility_stage_g118_moto_status_qa(uuid,uuid),
 public.mobility_stage_g100_moto_cancel_qa(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA qore_stage_internal TO service_role;
GRANT EXECUTE ON FUNCTION
 qore_stage_internal.g337_moto_quote_receipt(uuid,uuid),
 qore_stage_internal.g337_moto_trip_receipt(uuid,uuid),
 qore_stage_internal.g337_moto_status(uuid,uuid),
 qore_stage_internal.g337_moto_quote(uuid,uuid,text,text,text,integer,integer),
 qore_stage_internal.g337_moto_book(uuid,uuid,uuid),
 qore_stage_internal.g337_moto_cancel(uuid,uuid,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION
 public.mobility_stage_g100_moto_quote_qa(uuid,uuid,text,text,text,integer,integer),
 public.mobility_stage_g100_moto_book_qa(uuid,uuid,uuid),
 public.mobility_stage_g100_moto_booking_receipt_qa(uuid,uuid),
 public.mobility_stage_g118_moto_status_qa(uuid,uuid),
 public.mobility_stage_g100_moto_cancel_qa(uuid,uuid,uuid)
 TO service_role;

COMMENT ON FUNCTION public.mobility_stage_g100_moto_quote_qa(uuid,uuid,text,text,text,integer,integer)
 IS 'G337 PG17 native DRAFT MOTO: trusted server-side route/Owner tariff only; no Driver, LIVE, PSP or real payment. Requires external verified session at G101 gateway.';
COMMIT;
