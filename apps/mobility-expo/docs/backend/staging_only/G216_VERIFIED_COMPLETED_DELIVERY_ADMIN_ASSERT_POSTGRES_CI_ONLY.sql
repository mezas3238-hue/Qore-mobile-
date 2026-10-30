-- G216 positive and forged-receipt tests. Synthetic legal acceptance is
-- fabricated by DB OWNER *inside rollback only*; subsequent G5 pickup,
-- G67 courier proof, G187 distinct-recipient confirmation and Admin G216
-- are genuine existing SQL operations on the SAME original G122 delivery ID.
-- Never interpret this as a real legal permit, physical handoff or payment.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g216_completed_delivery_trace_qa(uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G216 disposable completion lab missing'; END IF;
 IF has_function_privilege('anon',
  'public.mobility_stage_g216_completed_delivery_trace_qa(uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g216_completed_delivery_trace_qa(uuid,uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.mobility_stage_g216_completed_delivery_trace_qa(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G216 Admin proof SQL direct mobile access'; END IF;
END $guard$;
BEGIN;
DO $test$
DECLARE
 row record;
 admin_user uuid:='14500000-0000-4145-8145-000000000002';
 courier uuid;
 vehicle uuid;
 recipient uuid:='18700000-0000-4187-8187-000000000002';
 courier_session uuid;
 recipient_session uuid:='21600000-0000-4216-8216-000000000002';
 sender_session uuid;
 offer_id uuid; accepted_id uuid; proof uuid; event_key uuid; dto jsonb;
 iat bigint;
 count_ok integer:=0;
BEGIN
 IF public.mobility_stage_g27_backoffice_role_of(admin_user)<>'admin'
 THEN RAISE EXCEPTION 'G216 verified Admin missing'; END IF;
 iat:=(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint;
 INSERT INTO public.mobility_stage_g42_provider_session_grants
  (user_id,session_id,provider_confirmed_at,token_allowed_from,
   valid_until,evidence_kind)
 VALUES
   (recipient,recipient_session,pg_catalog.clock_timestamp()-interval '1 day',
   pg_catalog.clock_timestamp()-interval '1 minute',
   pg_catalog.clock_timestamp()+interval '1 hour',
   'QA_SYNTHETIC_PROVIDER_SESSION_ONLY');
 FOR row IN
  SELECT d.id,d.sender_id,d.requested_vehicle_kind
  FROM public.mobility_stage_deliveries d
  JOIN public.mobility_stage_g122_delivery_price_consents c
   ON c.delivery_id=d.id AND c.sender_id=d.sender_id
  WHERE d.status='requested' AND d.revision=1
   AND d.sender_id IN ('12200000-0000-4122-8122-000000000011'::uuid,
    '12200000-0000-4122-8122-000000000012'::uuid)
   AND d.requested_vehicle_kind IN ('AUTO','MOTO')
  ORDER BY d.requested_vehicle_kind
 LOOP
  IF row.requested_vehicle_kind='AUTO' THEN
   courier:='00000000-0000-4000-8000-000000000181'::uuid;
   vehicle:='00000000-0000-4000-8000-000000000184'::uuid;
  ELSE
   courier:='00000000-0000-4000-8000-000000000103'::uuid;
   vehicle:='00000000-0000-4000-8000-000000000104'::uuid;
  END IF;
  courier_session:=pg_catalog.gen_random_uuid();
  INSERT INTO public.mobility_stage_g42_provider_session_grants
   (user_id,session_id,provider_confirmed_at,token_allowed_from,
    valid_until,evidence_kind)
  VALUES(courier,courier_session,
    pg_catalog.clock_timestamp()-interval '1 day',
    pg_catalog.clock_timestamp()-interval '1 minute',
    pg_catalog.clock_timestamp()+interval '1 hour',
    'QA_SYNTHETIC_PROVIDER_SESSION_ONLY');
  sender_session:=pg_catalog.gen_random_uuid();
  INSERT INTO public.mobility_stage_g42_provider_session_grants
   (user_id,session_id,provider_confirmed_at,token_allowed_from,
    valid_until,evidence_kind)
  VALUES(row.sender_id,sender_session,
    pg_catalog.clock_timestamp()-interval '1 day',
    pg_catalog.clock_timestamp()-interval '1 minute',
    pg_catalog.clock_timestamp()+interval '1 hour',
    'QA_SYNTHETIC_PROVIDER_SESSION_ONLY');
  -- Original source without a courier MUST NOT pass a completed trace.
  IF public.mobility_stage_g216_completed_delivery_trace_qa(
   admin_user,row.id) IS NOT NULL
  THEN RAISE EXCEPTION 'G216 fabricated completed cargo from request'; END IF;
  -- QA ONLY: create one synthetic accepted offer after original price consent.
  -- No false municipal proof is minted; this fixture will be rolled back.
  offer_id:=pg_catalog.gen_random_uuid();
  INSERT INTO public.mobility_stage_delivery_offers
   (id,request_key,delivery_id,courier_id,vehicle_id,ttl_seconds,expires_at)
  VALUES(offer_id,pg_catalog.gen_random_uuid(),row.id,courier,vehicle,30,
   pg_catalog.clock_timestamp()+interval '30 seconds');
  -- QA synthetic pre-accept seed requires privileged owner bypass;
  -- ordinary runtime cannot do this, and all active G5/G67/G187 final
  -- transitions below retain their original source/role/session rules.
  ALTER TABLE public.mobility_stage_deliveries DISABLE TRIGGER USER;
  UPDATE public.mobility_stage_deliveries
    SET courier_id=courier,vehicle_id=vehicle,status='accepted',revision=2,
     changed_at=pg_catalog.clock_timestamp() WHERE id=row.id;
  ALTER TABLE public.mobility_stage_deliveries ENABLE TRIGGER USER;
  event_key:=pg_catalog.gen_random_uuid();
  INSERT INTO public.mobility_stage_delivery_events
   (request_key,delivery_id,actor_id,action,next_status,delivery_revision)
  VALUES(event_key,row.id,courier,'accept','accepted',2)
  RETURNING id INTO accepted_id;
  UPDATE public.mobility_stage_delivery_offers
   SET status='accepted',decision_key=event_key,decision_event_id=accepted_id
  WHERE id=offer_id;
  INSERT INTO public.mobility_stage_g36_driver_slots
   (driver_id,assignment_kind,assignment_id)
  VALUES(courier,'DELIVERY',row.id) ON CONFLICT (driver_id) DO UPDATE
   SET assignment_id=excluded.assignment_id;
  PERFORM public.mobility_stage_g187_bind_recipient_qa(
   row.sender_id,sender_session,iat,row.id,recipient,pg_catalog.gen_random_uuid());
  PERFORM public.mobility_stage_delivery_transition(
   row.id,courier,'pickup',pg_catalog.gen_random_uuid(),NULL);
  proof:=pg_catalog.gen_random_uuid();
  PERFORM public.mobility_stage_g67_register_proof_owner_qa(
   row.id,courier,courier_session,iat,proof,
   repeat('a',64),'image/jpeg',512,pg_catalog.clock_timestamp()+interval '10 minutes');
  PERFORM public.mobility_stage_delivery_transition(
   row.id,courier,'deliver',pg_catalog.gen_random_uuid(),proof);
  -- Courier delivery alone is not a recipient ACK or paid settlement.
  IF public.mobility_stage_g216_completed_delivery_trace_qa(
   admin_user,row.id) IS NOT NULL
  THEN RAISE EXCEPTION 'G216 accepted proof without independent recipient'; END IF;
  PERFORM public.mobility_stage_g187_confirm_received_qa(
   recipient,recipient_session,iat,row.id,pg_catalog.gen_random_uuid());
  dto:=public.mobility_stage_g216_completed_delivery_trace_qa(admin_user,row.id);
  IF dto IS NULL OR dto->>'serviceId'<>row.id::text
   OR dto->>'status'<>'delivered' OR (dto->>'revision')::int<>4
   OR dto->'assignment'->>'state'<>'QA_COMPLETED'
   OR dto->'assignment'->>'legalGate'<>'EXTERNAL_NOT_CERTIFIED'
   OR dto->>'productionEnabled'<>'false'
   OR dto->'ledger'<>'null'::jsonb
   OR jsonb_array_length(dto->'events')<>4
   OR dto->>'serviceKind'<>('DELIVERY_'||row.requested_vehicle_kind::text)
  THEN RAISE EXCEPTION 'G216 valid original cargo declined: %',dto; END IF;
  IF (dto->'events'->0)->>'status'<>'requested'
   OR (dto->'events'->1)->>'status'<>'accepted'
   OR (dto->'events'->2)->>'status'<>'picked_up'
   OR (dto->'events'->3)->>'status'<>'delivered'
  THEN RAISE EXCEPTION 'G216 source event order wrong'; END IF;
  IF public.mobility_stage_g216_completed_delivery_trace_qa(
   row.sender_id,row.id) IS NOT NULL
  THEN RAISE EXCEPTION 'G216 sender impersonated Admin'; END IF;
  -- Delete recipient ACK (inside rollback) and verify fail-closed again.
  UPDATE public.mobility_stage_g187_recipient_confirmations
   SET confirmation_key=NULL,confirmation_session=NULL,
    confirmed_at=NULL,confirmed_delivery_revision=NULL,revision=1
   WHERE delivery_id=row.id;
  IF public.mobility_stage_g216_completed_delivery_trace_qa(
   admin_user,row.id) IS NOT NULL
  THEN RAISE EXCEPTION 'G216 missing recipient ACK remained completed'; END IF;
  count_ok:=count_ok+1;
 END LOOP;
 IF count_ok<>2 THEN RAISE EXCEPTION 'G216 expected AUTO and MOTO priced sources, got %',count_ok; END IF;
 RAISE NOTICE 'G216 PASS: TWO original G122 IDs, QA synthetic private acceptance seeded in rollback, real G5 pickup+G67 attested deliver+G187 independent recipient -> Admin full 4-event original trace; false receipt denied; no legal/GPS/PSP claims';
END $test$;
ROLLBACK;
