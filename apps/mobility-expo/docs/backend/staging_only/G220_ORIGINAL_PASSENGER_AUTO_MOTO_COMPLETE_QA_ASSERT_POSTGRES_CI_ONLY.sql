-- G220: positive fresh original G73 AUTO and G100 MOTO passenger bookings
-- across quote/book -> synthetic QA accepted offer (never municipal/legal
-- approval) -> ORIGINAL G177/G213 Driver transitions -> G138/G142 Admin.
-- The entire disposable PG16 transaction ROLLBACKS. All post-acceptance
-- transitions use the existing functions; no fake terminal events.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g73_book(uuid,uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g177_driver_auto_step_qa(uuid,uuid,bigint,uuid,text,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g213_moto_driver_step_qa(uuid,uuid,bigint,uuid,bigint,text,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g142_moto_trace_qa(uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G220 requires disposable original ride chain'; END IF;
END $guard$;
BEGIN;
CREATE TEMP TABLE g220_ride_source(
 kind text PRIMARY KEY, ride_id uuid NOT NULL, booking_key uuid NOT NULL,
 passenger_id uuid NOT NULL,driver_id uuid NOT NULL,vehicle_id uuid NOT NULL,
 session_id uuid NOT NULL,quote_id uuid NOT NULL
) ON COMMIT DROP;
INSERT INTO auth.users(id) VALUES
 ('22000000-0000-4220-8220-000000000011'::uuid),
 ('22000000-0000-4220-8220-000000000012'::uuid),
 ('22000000-0000-4220-8220-000000000013'::uuid),
 ('22000000-0000-4220-8220-000000000014'::uuid);
DELETE FROM public.user_roles WHERE user_id IN(
 '22000000-0000-4220-8220-000000000013'::uuid,
 '22000000-0000-4220-8220-000000000014'::uuid);
INSERT INTO public.user_roles(user_id,role) VALUES
 ('22000000-0000-4220-8220-000000000013'::uuid,'driver'),
 ('22000000-0000-4220-8220-000000000014'::uuid,'driver');
-- G222: the original G73/G72 AUTO quote is governed by the owner-reviewed
-- G93 price rule. Give this ROLLBACK-only Owner an explicit test campaign,
-- rather than ignoring the quote-time financial authority. This does NOT
-- approve an external price, PSP capture, municipal license or LIVE dispatch.
INSERT INTO auth.users(id)
 VALUES ('22000000-0000-4220-8220-000000000015'::uuid);
DELETE FROM public.user_roles
 WHERE user_id='22000000-0000-4220-8220-000000000015'::uuid;
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
 VALUES('22000000-0000-4220-8220-000000000015'::uuid,'owner','active',
 '22000000-0000-4220-8220-000000000015'::uuid);
INSERT INTO public.mobility_stage_g93_ride_campaigns(
 id,service_kind,rule_version,approved_by,active,begins_at,ends_at,duration_days)
VALUES('22000000-0000-4220-8220-000000000025'::uuid,'AUTO_RIDE',
 'G222_OWNER_TEST_PRICE_ONLY',
 '22000000-0000-4220-8220-000000000015'::uuid,true,
 pg_catalog.transaction_timestamp()-interval '1 hour',
 pg_catalog.transaction_timestamp()+interval '59 days',60);
INSERT INTO public.mobility_vehicles(
 id,driver_id,vehicle_kind,service_kind,country_code,municipality_code,
 plate_normalized,brand,model,manufacture_year,passenger_capacity,review_status)
 VALUES
 ('22000000-0000-4220-8220-000000000023'::uuid,
  '22000000-0000-4220-8220-000000000013'::uuid,
  'AUTO','economico','PY','ASUNCION','QOR220A','QORE','QA',2025,4,'approved'),
 ('22000000-0000-4220-8220-000000000024'::uuid,
  '22000000-0000-4220-8220-000000000014'::uuid,
  'MOTO','moto_pasajero','PY','ASUNCION','QOR220M','QORE','QA',2025,1,'approved');
DO $booking$
DECLARE
 pa uuid:='22000000-0000-4220-8220-000000000011'::uuid;
 pm uuid:='22000000-0000-4220-8220-000000000012'::uuid;
 da uuid:='22000000-0000-4220-8220-000000000013'::uuid;
 dm uuid:='22000000-0000-4220-8220-000000000014'::uuid;
 ba uuid:='22000000-0000-4220-8220-000000000031'::uuid;
 bm uuid:='22000000-0000-4220-8220-000000000032'::uuid;
 route uuid;quote uuid;trip uuid; m_quote jsonb; m_trip jsonb;
BEGIN
 -- QA synthetic route is not Geoapify real-provider evidence.
 route:=public.mobility_stage_g73_route(
  pa,'22000000-0000-4220-8220-000000000041'::uuid,
  'economico','PANTEON','AEROPUERTO','ASUNCION_FIXTURE',5400,720,0);
 quote:=public.mobility_stage_g73_quote(
  pa,route,'22000000-0000-4220-8220-000000000042'::uuid);
 trip:=public.mobility_stage_g73_book(pa,quote,ba);
 IF trip IS NULL OR public.mobility_stage_g73_booking_receipt(pa,ba)->>
  'tripId'<>trip::text
 THEN RAISE EXCEPTION 'G220 original G73 AUTO booking/price not persisted'; END IF;
 INSERT INTO pg_temp.g220_ride_source VALUES(
  'AUTO_RIDE',trip,ba,pa,da,
  '22000000-0000-4220-8220-000000000023'::uuid,
  '22000000-0000-4220-8220-000000000051'::uuid,quote);
 m_quote:=public.mobility_stage_g100_moto_quote_qa(
  pm,'22000000-0000-4220-8220-000000000043'::uuid,
  'CENTRO_QA','AEROPUERTO_QA','MOTO_TEST_ZONE',5000,600);
 quote:=(m_quote->>'quoteId')::uuid;
 m_trip:=public.mobility_stage_g100_moto_book_qa(pm,quote,bm);
 trip:=(m_trip->>'tripId')::uuid;
 IF trip IS NULL OR m_trip->>'tripState'<>'searching'
 THEN RAISE EXCEPTION 'G220 original G100 MOTO booking/ledger failed'; END IF;
 INSERT INTO pg_temp.g220_ride_source VALUES(
  'MOTO_RIDE',trip,bm,pm,dm,
  '22000000-0000-4220-8220-000000000024'::uuid,
  '22000000-0000-4220-8220-000000000052'::uuid,quote);
 -- Verify no cancelled ride is resurrected. Both are freshly requested.
 IF EXISTS(SELECT 1 FROM pg_temp.g220_ride_source q
  LEFT JOIN public.mobility_stage_auto_demo_trips a
   ON a.id=q.ride_id AND q.kind='AUTO_RIDE'
  LEFT JOIN public.mobility_stage_g100_moto_trips m
   ON m.id=q.ride_id AND q.kind='MOTO_RIDE'
  WHERE (q.kind='AUTO_RIDE' AND (a.status<>'searching' OR a.revision<>1))
   OR (q.kind='MOTO_RIDE' AND (m.status<>'searching' OR m.revision<>1)))
 THEN RAISE EXCEPTION 'G220 not original fresh searching trips'; END IF;
END $booking$;

-- G38/G71 and municipal MOTO acceptance remain CLOSED for ordinary callers.
-- Simulate only that externally blocked acceptance in disposable rollback,
-- never through the owner-only G205 or G118 legal-gated acceptance RPC.
ALTER TABLE public.mobility_stage_auto_demo_offers DISABLE TRIGGER USER;
ALTER TABLE public.mobility_stage_auto_demo_trips DISABLE TRIGGER USER;
DO $seed_auto$
DECLARE s record; offer uuid; event uuid; decision uuid;
BEGIN
 SELECT * INTO s FROM pg_temp.g220_ride_source WHERE kind='AUTO_RIDE';
 offer:=pg_catalog.gen_random_uuid();
 decision:=pg_catalog.gen_random_uuid();
 INSERT INTO public.mobility_stage_auto_demo_offers(
  id,request_key,trip_id,driver_id,vehicle_id,ttl_seconds,expires_at)
 VALUES(offer,pg_catalog.gen_random_uuid(),s.ride_id,s.driver_id,
  s.vehicle_id,30,pg_catalog.clock_timestamp()+interval '30 seconds');
 UPDATE public.mobility_stage_auto_demo_trips SET status='accepted',revision=2,
  driver_id=s.driver_id,vehicle_id=s.vehicle_id
 WHERE id=s.ride_id AND status='searching';
 IF NOT FOUND THEN RAISE EXCEPTION 'G220 fresh AUTO accepted fixture conflicted'; END IF;
 INSERT INTO public.mobility_stage_auto_demo_events(
  request_key,trip_id,actor_id,next_status,trip_revision)
 VALUES(decision,s.ride_id,s.driver_id,'accepted',2)
 RETURNING id INTO event;
 UPDATE public.mobility_stage_auto_demo_offers SET
  status='accepted',decision_key=decision,decision_event_id=event
 WHERE id=offer;
 INSERT INTO public.mobility_stage_g36_driver_slots(
  driver_id,assignment_kind,assignment_id)
 VALUES(s.driver_id,'AUTO_RIDE',s.ride_id);
END $seed_auto$;
ALTER TABLE public.mobility_stage_auto_demo_offers ENABLE TRIGGER USER;
ALTER TABLE public.mobility_stage_auto_demo_trips ENABLE TRIGGER USER;

DO $seed_moto$
DECLARE s record; offer uuid;
BEGIN
 SELECT * INTO s FROM pg_temp.g220_ride_source WHERE kind='MOTO_RIDE';
 offer:=pg_catalog.gen_random_uuid();
 INSERT INTO public.mobility_stage_g118_moto_offers(
  id,trip_id,driver_id,vehicle_id,request_key,status,decision_key,
  created_at,expires_at)
 VALUES(offer,s.ride_id,s.driver_id,s.vehicle_id,pg_catalog.gen_random_uuid(),
  'accepted',pg_catalog.gen_random_uuid(),pg_catalog.clock_timestamp(),
  pg_catalog.clock_timestamp()+interval '30 minutes');
 UPDATE public.mobility_stage_g100_moto_trips
 SET driver_id=s.driver_id,vehicle_id=s.vehicle_id,
  accepted_offer_id=offer,status='accepted',revision=2,
  updated_at=pg_catalog.clock_timestamp()
 WHERE id=s.ride_id AND status='searching';
 IF NOT FOUND THEN RAISE EXCEPTION 'G220 fresh MOTO acceptance fixture conflicted'; END IF;
END $seed_moto$;

-- From HERE every original trigger is active, and all three Driver
-- transitions per ride must use the actual G42-locked source functions.
DO $complete$
DECLARE s record; adm uuid; stage text; action text; i integer; receipt jsonb;
 iat bigint; g177 uuid; moto jsonb;
BEGIN
 SELECT user_id INTO adm FROM public.mobility_stage_backoffice_roles
 WHERE role='admin' AND status='active'
 AND public.mobility_stage_g27_backoffice_role_of(user_id)='admin'
 ORDER BY user_id LIMIT 1;
 IF adm IS NULL THEN RAISE EXCEPTION 'G220 independent Admin missing'; END IF;
 FOR s IN SELECT * FROM pg_temp.g220_ride_source ORDER BY kind LOOP
  INSERT INTO public.mobility_stage_g42_provider_session_grants(
   user_id,session_id,provider_confirmed_at,token_allowed_from,
   valid_until,evidence_kind)
  VALUES(s.driver_id,s.session_id,
   pg_catalog.clock_timestamp()-interval '1 day',
   pg_catalog.clock_timestamp()-interval '1 minute',
   pg_catalog.clock_timestamp()+interval '1 hour',
   'QA_SYNTHETIC_PROVIDER_SESSION_ONLY');
  iat:=(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint;
  FOR i IN 1..3 LOOP
   stage:=(ARRAY['arriving','in_progress','completed'])[i];
   IF s.kind='AUTO_RIDE' THEN
    action:=(ARRAY['arrive','pickup','complete'])[i];
    g177:=public.mobility_stage_g177_driver_auto_step_qa(
     s.driver_id,s.session_id,iat,s.ride_id,action,pg_catalog.gen_random_uuid());
    IF g177 IS NULL THEN RAISE EXCEPTION 'G220 AUTO original Driver step % failed',action; END IF;
   ELSE
    moto:=public.mobility_stage_g213_moto_driver_step_qa(
     s.driver_id,s.session_id,iat,s.booking_key,
     i+1,stage,pg_catalog.gen_random_uuid());
    IF moto->>'tripState'<>stage
    THEN RAISE EXCEPTION 'G220 MOTO original Driver step % failed',stage; END IF;
   END IF;
  END LOOP;
  receipt:=CASE s.kind WHEN 'AUTO_RIDE' THEN
   public.mobility_stage_g138_auto_trace_qa(adm,s.ride_id)
   ELSE public.mobility_stage_g142_moto_trace_qa(adm,s.ride_id) END;
  IF receipt IS NULL
    OR receipt->>'serviceId'<>s.ride_id::text
    OR receipt->>'bookingRequestKey'<>s.booking_key::text
    OR receipt->>'quoteId'<>s.quote_id::text
    OR receipt->>'serviceKind'<>s.kind
    OR receipt->>'status'<>'completed'
    OR (receipt->>'revision')::int<>5
    OR receipt->'assignment'->>'state'<>'QA_COMPLETED'
    OR receipt->'assignment'->>'legalGate'<>'EXTERNAL_NOT_CERTIFIED'
    OR receipt->>'productionEnabled'<>'false'
    OR receipt->'ledger'->>'reconciliationStatus'<>'PENDING'
    OR pg_catalog.jsonb_array_length(receipt->'events')<>5
  THEN RAISE EXCEPTION 'G220 original % Driver-to-Admin final receipt invalid: %',
   s.kind,receipt; END IF;
  IF (receipt->'events'->0)->>'status'<>'searching'
   OR (receipt->'events'->1)->>'status'<>'assigned'
   OR (receipt->'events'->2)->>'status'<>'arriving'
   OR (receipt->'events'->3)->>'status'<>'in_progress'
   OR (receipt->'events'->4)->>'status'<>'completed'
  THEN RAISE EXCEPTION 'G220 original Driver events are not five ordered phases'; END IF;
  IF (CASE s.kind WHEN 'AUTO_RIDE' THEN
   public.mobility_stage_g138_auto_trace_qa(s.passenger_id,s.ride_id)
   ELSE public.mobility_stage_g142_moto_trace_qa(s.passenger_id,s.ride_id)
  END) IS NOT NULL
  THEN RAISE EXCEPTION 'G220 passenger impersonated Admin'; END IF;
  RAISE NOTICE 'G220 PASS %: fresh quoted/booked original ID % -> synthetic accepted QA -> 3 source Driver steps -> independent Admin five original events; legal/GPS/PSP external',s.kind,s.ride_id;
 END LOOP;
END $complete$;
ROLLBACK;
