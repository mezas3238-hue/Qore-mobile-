-- G216 two real priced G122 original service IDs through G5 custody, G67
-- consumed proof, independent G187 recipient, Admin G216. ROLLBACK ONLY.
-- Explicit synthetic PRE-ACCEPTED setup by disposable PG owner, NOT a real
-- legal authorization, an accepted offer by an independently verified Driver,
-- a live route, physical handoff or financial settlement.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regprocedure('public.mobility_stage_g216_completed_delivery_trace_qa(uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G216 non-disposable or incomplete source'; END IF;
 IF pg_catalog.has_function_privilege('anon',
   'public.mobility_stage_g216_completed_delivery_trace_qa(uuid,uuid)','EXECUTE')
 OR pg_catalog.has_function_privilege('authenticated',
   'public.mobility_stage_g216_completed_delivery_trace_qa(uuid,uuid)','EXECUTE')
 OR NOT pg_catalog.has_function_privilege('service_role',
   'public.mobility_stage_g216_completed_delivery_trace_qa(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G216 completed projection exposed to mobile SDK'; END IF;
END $guard$;
BEGIN;
CREATE TEMP TABLE g216_fixture(
 delivery_id uuid PRIMARY KEY, sender_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('AUTO','MOTO')),
 courier uuid NOT NULL, vehicle uuid NOT NULL,
 sender_session uuid NOT NULL, courier_session uuid NOT NULL,
 recipient uuid NOT NULL, recipient_session uuid NOT NULL
) ON COMMIT DROP;

-- These two DDL statements occur OUTSIDE a DO/function because PostgreSQL
-- refuses table ALTER while an open cursor is reading the same relation.
-- Both original immutable legal fences are restored BEFORE all G5/G67/G187
-- runtime transitions are executed. Entire transaction ROLLBACKS below.
ALTER TABLE public.mobility_stage_delivery_offers DISABLE TRIGGER USER;
ALTER TABLE public.mobility_stage_deliveries DISABLE TRIGGER USER;
-- The historical MOTO courier is already assigned elsewhere in G5. Use
-- one new QA actor with a matching vehicle inside this ROLLBACK transaction.
INSERT INTO auth.users(id) VALUES ('21600000-0000-4216-8216-000000000103'::uuid);
DELETE FROM public.user_roles
 WHERE user_id='21600000-0000-4216-8216-000000000103'::uuid;
INSERT INTO public.user_roles(user_id,role)
 VALUES ('21600000-0000-4216-8216-000000000103'::uuid,'driver');
INSERT INTO public.mobility_vehicles
 (id,driver_id,vehicle_kind,service_kind,country_code,
  municipality_code,plate_normalized,brand,model,manufacture_year,
  passenger_capacity,review_status)
 VALUES ('21600000-0000-4216-8216-000000000104'::uuid,
 '21600000-0000-4216-8216-000000000103'::uuid,
 'MOTO','moto_pasajero','PY','ASUNCION','QOR216M','QORE','QA',2025,1,'approved');
DO $seed$
DECLARE
 row record; courier uuid; vehicle uuid;
 recipient uuid:='18700000-0000-4187-8187-000000000002'::uuid;
 recipient_session uuid:='21600000-0000-4216-8216-000000000002'::uuid;
 cs uuid; ss uuid; offer uuid; event uuid; decision uuid;
 count_ok int:=0;
BEGIN
 INSERT INTO public.mobility_stage_g42_provider_session_grants(
  user_id,session_id,provider_confirmed_at,token_allowed_from,
  valid_until,evidence_kind)
 VALUES(recipient,recipient_session,
  pg_catalog.clock_timestamp()-interval '1 day',
  pg_catalog.clock_timestamp()-interval '1 minute',
  pg_catalog.clock_timestamp()+interval '1 hour',
  'QA_SYNTHETIC_PROVIDER_SESSION_ONLY');
 FOR row IN
  SELECT d.id,d.sender_id,d.requested_vehicle_kind
  FROM public.mobility_stage_deliveries d
  JOIN public.mobility_stage_g122_delivery_price_consents c
   ON c.delivery_id=d.id AND c.sender_id=d.sender_id
  WHERE d.status='requested' AND d.revision=1
   AND d.sender_id IN (
    '12200000-0000-4122-8122-000000000011'::uuid,
    '12200000-0000-4122-8122-000000000012'::uuid)
  ORDER BY d.requested_vehicle_kind
 LOOP
  -- This is a pre-accepted HISTORICAL QA fixture, not a new offer.
  -- G122 original price consent remains immutable although its quote TTL
  -- has expired in the elapsed CI chain. Never relax the live G123 fence.
  IF NOT EXISTS(
   SELECT 1 FROM public.mobility_stage_g122_delivery_price_consents c
   JOIN public.mobility_stage_fare_quotes q ON q.id=c.quote_id
    AND q.subject_id=row.id AND q.customer_id=row.sender_id
    AND q.total_pyg=c.accepted_total_gs
    AND q.provider_pyg+q.commission_pyg=q.total_pyg
   WHERE c.delivery_id=row.id AND c.sender_id=row.sender_id
    AND c.vehicle_kind=row.requested_vehicle_kind
    AND q.quoted_at<=c.confirmed_at
  ) THEN RAISE EXCEPTION 'G216 original G122 fare and consent missing'; END IF;
  IF row.requested_vehicle_kind='AUTO' THEN
   courier:='00000000-0000-4000-8000-000000000181'::uuid;
   vehicle:='00000000-0000-4000-8000-000000000184'::uuid;
  ELSE
   courier:='21600000-0000-4216-8216-000000000103'::uuid;
   vehicle:='21600000-0000-4216-8216-000000000104'::uuid;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.mobility_vehicles v
   WHERE v.id=vehicle AND v.driver_id=courier
    AND v.vehicle_kind=row.requested_vehicle_kind)
  THEN RAISE EXCEPTION 'G216 fixture courier and source vehicle mismatch'; END IF;
  cs:=pg_catalog.gen_random_uuid();ss:=pg_catalog.gen_random_uuid();
  INSERT INTO public.mobility_stage_g42_provider_session_grants(
   user_id,session_id,provider_confirmed_at,token_allowed_from,
   valid_until,evidence_kind)
  VALUES
   (courier,cs,pg_catalog.clock_timestamp()-interval '1 day',
    pg_catalog.clock_timestamp()-interval '1 minute',
    pg_catalog.clock_timestamp()+interval '1 hour',
    'QA_SYNTHETIC_PROVIDER_SESSION_ONLY'),
   (row.sender_id,ss,pg_catalog.clock_timestamp()-interval '1 day',
    pg_catalog.clock_timestamp()-interval '1 minute',
    pg_catalog.clock_timestamp()+interval '1 hour',
    'QA_SYNTHETIC_PROVIDER_SESSION_ONLY');
  offer:=pg_catalog.gen_random_uuid();decision:=pg_catalog.gen_random_uuid();
  INSERT INTO public.mobility_stage_delivery_offers(
   id,request_key,delivery_id,courier_id,vehicle_id,ttl_seconds,expires_at)
  VALUES(offer,pg_catalog.gen_random_uuid(),row.id,courier,vehicle,30,
   pg_catalog.clock_timestamp()+interval '30 seconds');
  UPDATE public.mobility_stage_deliveries
   SET courier_id=courier,vehicle_id=vehicle,status='accepted',revision=2,
    changed_at=pg_catalog.clock_timestamp()
   WHERE id=row.id;
  INSERT INTO public.mobility_stage_delivery_events(
   request_key,delivery_id,actor_id,action,next_status,delivery_revision)
  VALUES(decision,row.id,courier,'accept','accepted',2)
  RETURNING id INTO event;
  UPDATE public.mobility_stage_delivery_offers SET status='accepted',
   decision_key=decision,decision_event_id=event WHERE id=offer;
  INSERT INTO public.mobility_stage_g36_driver_slots(
    driver_id,assignment_kind,assignment_id)
  VALUES(courier,'DELIVERY',row.id);
  INSERT INTO pg_temp.g216_fixture VALUES(
   row.id,row.sender_id,row.requested_vehicle_kind::text,courier,vehicle,
   ss,cs,recipient,recipient_session);
  count_ok:=count_ok+1;
 END LOOP;
 IF count_ok<>2 THEN RAISE EXCEPTION 'G216 expected exactly 2 G122 originals, got %',count_ok; END IF;
END $seed$;
ALTER TABLE public.mobility_stage_delivery_offers ENABLE TRIGGER USER;
ALTER TABLE public.mobility_stage_deliveries ENABLE TRIGGER USER;

-- With ALL immutable triggers active, execute the original G5/G67/G187
-- functions. No test inserts a fake courier proof or a fake recipient ACK.
DO $exercise$
DECLARE
 source record; proof uuid; dto jsonb; iat bigint;
 adm uuid:='14500000-0000-4145-8145-000000000002'::uuid;
 count_ok int:=0;
BEGIN
 IF public.mobility_stage_g27_backoffice_role_of(adm)<>'admin'
 THEN RAISE EXCEPTION 'G216 independent Admin missing'; END IF;
 iat:=(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint;
 FOR source IN SELECT * FROM pg_temp.g216_fixture ORDER BY kind LOOP
  IF public.mobility_stage_g216_completed_delivery_trace_qa(
   adm,source.delivery_id) IS NOT NULL
  THEN RAISE EXCEPTION 'G216 pre-picked-up fixture claimed completion'; END IF;
  PERFORM public.mobility_stage_g187_bind_recipient_qa(
   source.sender_id,source.sender_session,iat,source.delivery_id,
   source.recipient,pg_catalog.gen_random_uuid());
  PERFORM public.mobility_stage_delivery_transition(
   source.delivery_id,source.courier,'pickup',pg_catalog.gen_random_uuid(),NULL);
  proof:=pg_catalog.gen_random_uuid();
  PERFORM public.mobility_stage_g67_register_proof_owner_qa(
   source.delivery_id,source.courier,source.courier_session,iat,
   proof,repeat('a',64),'image/jpeg',512,
   pg_catalog.clock_timestamp()+interval '10 minutes');
  PERFORM public.mobility_stage_delivery_transition(
   source.delivery_id,source.courier,'deliver',
   pg_catalog.gen_random_uuid(),proof);
  IF public.mobility_stage_g216_completed_delivery_trace_qa(
   adm,source.delivery_id) IS NOT NULL
  THEN RAISE EXCEPTION 'G216 courier photo substituted recipient ACK'; END IF;
  PERFORM public.mobility_stage_g187_confirm_received_qa(
   source.recipient,source.recipient_session,iat,
   source.delivery_id,pg_catalog.gen_random_uuid());
  dto:=public.mobility_stage_g216_completed_delivery_trace_qa(adm,source.delivery_id);
  IF dto IS NULL OR dto->>'serviceId'<>source.delivery_id::text
   OR dto->>'serviceKind'<>'DELIVERY_'||source.kind
   OR dto->>'status'<>'delivered' OR (dto->>'revision')::integer<>4
   OR dto->'assignment'->>'state'<>'QA_COMPLETED'
   OR dto->'assignment'->>'legalGate'<>'EXTERNAL_NOT_CERTIFIED'
   OR dto->>'productionEnabled'<>'false'
   OR dto->'ledger'<>'null'::jsonb
   OR jsonb_array_length(dto->'events')<>4
  THEN RAISE EXCEPTION 'G216 authentic G5/G67/G187 chain not recognized: %',dto; END IF;
  IF (dto->'events'->0)->>'status'<>'requested'
   OR (dto->'events'->1)->>'status'<>'accepted'
   OR (dto->'events'->2)->>'status'<>'picked_up'
   OR (dto->'events'->3)->>'status'<>'delivered'
  THEN RAISE EXCEPTION 'G216 original custody timeline out of order'; END IF;
  IF public.mobility_stage_g216_completed_delivery_trace_qa(
   source.sender_id,source.delivery_id) IS NOT NULL
  THEN RAISE EXCEPTION 'G216 customer impersonated Admin'; END IF;
  -- Forged/removed confirmation invalidates Admin proof without touching G5.
  UPDATE public.mobility_stage_g187_recipient_confirmations
   SET confirmation_key=NULL,confirmation_session=NULL,confirmed_at=NULL,
    confirmed_delivery_revision=NULL,revision=1
  WHERE delivery_id=source.delivery_id;
  IF public.mobility_stage_g216_completed_delivery_trace_qa(
   adm,source.delivery_id) IS NOT NULL
  THEN RAISE EXCEPTION 'G216 missing original recipient ACK accepted'; END IF;
  count_ok:=count_ok+1;
 END LOOP;
 IF count_ok<>2 THEN RAISE EXCEPTION 'G216 did not prove both original vehicle kinds'; END IF;
 RAISE NOTICE 'G216 PASS: original priced G122 AUTO+MOTO, rollback-only synthetic acceptance, actual G5/G67/G187 finish, private Admin proof; no external GPS/legal/PSP';
END $exercise$;
ROLLBACK;
