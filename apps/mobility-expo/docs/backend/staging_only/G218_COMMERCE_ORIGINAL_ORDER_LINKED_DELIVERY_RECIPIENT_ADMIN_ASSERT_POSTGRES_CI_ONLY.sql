-- G218 original COMMERCE integration: G139/G148/G150 merchant order has an
-- immutable G5/MOTO delivery already price-consented by its real QA Buyer.
-- In one ROLLBACK-only transaction, synthesize ONLY the legally unavailable
-- original courier acceptance, THEN reenable every runtime SQL trigger and
-- exercise existing G5 pickup -> G67 consumed courier proof -> independent
-- G187 recipient ACK -> G216 cargo Admin -> G217 commerce Admin.
-- No real merchant delivery, legal permit, GPS, PSP, or LIVE is inferred.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g154_merchant_dispatch_ready_qa(uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g216_completed_delivery_trace_qa(uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g146_commerce_trace_qa(uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G218 refuses non-disposable or incomplete original COMMERCE chain'; END IF;
 IF has_function_privilege('anon',
  'public.mobility_stage_g216_completed_delivery_trace_qa(uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g216_completed_delivery_trace_qa(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G218 private Admin delivery projection leaked'; END IF;
END $guard$;
BEGIN;
CREATE TEMP TABLE g218_case (
 order_id uuid NOT NULL, delivery_id uuid NOT NULL,
 order_request_key uuid NOT NULL, delivery_request_key uuid NOT NULL,
 buyer_id uuid NOT NULL, quote_id uuid NOT NULL,
 courier_id uuid NOT NULL, vehicle_id uuid NOT NULL,
 recipient_id uuid NOT NULL, buyer_session uuid NOT NULL,
 courier_session uuid NOT NULL, recipient_session uuid NOT NULL
) ON COMMIT DROP;
DO $original$
DECLARE o record; ship record;
BEGIN
 SELECT id,request_key,buyer_id,delivery_id,requested_vehicle_kind,
  status,revision INTO o
 FROM public.mobility_stage_merchant_orders
 WHERE request_key='13800000-0000-4138-8138-000000000242'::uuid;
 IF o.id IS NULL OR o.delivery_id IS NULL OR o.status<>'ready'
 OR o.revision<>5 OR o.requested_vehicle_kind<>'MOTO'
 THEN RAISE EXCEPTION 'G218 original G150 linked ready order unavailable'; END IF;
 SELECT d.id,d.request_key,d.sender_id,d.status,d.revision,
  c.quote_id,c.confirmed_at INTO ship
 FROM public.mobility_stage_deliveries d
 JOIN public.mobility_stage_g122_delivery_price_consents c
  ON c.delivery_id=d.id AND c.sender_id=d.sender_id
  AND c.vehicle_kind=d.requested_vehicle_kind
 WHERE d.id=o.delivery_id;
 IF ship.id IS NULL OR ship.status<>'requested' OR ship.revision<>1
 OR ship.sender_id<>o.buyer_id OR
 NOT public.mobility_stage_g154_merchant_dispatch_ready_qa(ship.id)
 THEN RAISE EXCEPTION 'G218 original G154 verified merchant ready and buyer fare absent'; END IF;
 INSERT INTO pg_temp.g218_case VALUES (
  o.id,ship.id,o.request_key,ship.request_key,o.buyer_id,ship.quote_id,
  '21800000-0000-4218-8218-000000000103'::uuid,
  '21800000-0000-4218-8218-000000000104'::uuid,
  '18700000-0000-4187-8187-000000000002'::uuid,
  '21800000-0000-4218-8218-000000000111'::uuid,
  '21800000-0000-4218-8218-000000000112'::uuid,
  '21800000-0000-4218-8218-000000000113'::uuid);
 IF public.mobility_stage_g216_completed_delivery_trace_qa(
   '14500000-0000-4145-8145-000000000002'::uuid,ship.id) IS NOT NULL
 THEN RAISE EXCEPTION 'G218 requested cargo was falsely completed'; END IF;
END $original$;

-- Rooted in the PREEXISTING G150 order/delivery, never a test-only order.
-- Only the offer and accepted state are QA synthetic, with DB-owner DDL.
-- Trigger restoration is mandatory before G5/G67/G187 transitions.
ALTER TABLE public.mobility_stage_delivery_offers DISABLE TRIGGER USER;
ALTER TABLE public.mobility_stage_deliveries DISABLE TRIGGER USER;
INSERT INTO auth.users(id)
 VALUES('21800000-0000-4218-8218-000000000103'::uuid);
DELETE FROM public.user_roles
 WHERE user_id='21800000-0000-4218-8218-000000000103'::uuid;
INSERT INTO public.user_roles(user_id,role)
 VALUES('21800000-0000-4218-8218-000000000103'::uuid,'driver');
INSERT INTO public.mobility_vehicles(
 id,driver_id,vehicle_kind,service_kind,country_code,municipality_code,
 plate_normalized,brand,model,manufacture_year,passenger_capacity,review_status)
 VALUES('21800000-0000-4218-8218-000000000104'::uuid,
 '21800000-0000-4218-8218-000000000103'::uuid,
 'MOTO','moto_pasajero','PY','ASUNCION','QOR218M','QORE','QA',2025,1,'approved');
DO $fixture$
DECLARE s record; offer uuid; decision uuid; event uuid; admin_id uuid;
BEGIN
 SELECT * INTO s FROM pg_temp.g218_case;
 admin_id:='14500000-0000-4145-8145-000000000002'::uuid;
 IF public.mobility_stage_g146_commerce_trace_qa(admin_id,s.order_id) IS NULL
 THEN RAISE EXCEPTION 'G218 original Commerce Admin proof missing BEFORE handoff'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.mobility_vehicles v
  WHERE v.id=s.vehicle_id AND v.driver_id=s.courier_id
   AND v.vehicle_kind='MOTO')
 THEN RAISE EXCEPTION 'G218 synthetic courier vehicle mismatch'; END IF;
 INSERT INTO public.mobility_stage_g42_provider_session_grants(
  user_id,session_id,provider_confirmed_at,token_allowed_from,
  valid_until,evidence_kind)
 SELECT actor,session,pg_catalog.clock_timestamp()-interval '1 day',
  pg_catalog.clock_timestamp()-interval '1 minute',
  pg_catalog.clock_timestamp()+interval '1 hour',
  'QA_SYNTHETIC_PROVIDER_SESSION_ONLY'
 FROM (VALUES(s.buyer_id,s.buyer_session),
  (s.courier_id,s.courier_session),
  (s.recipient_id,s.recipient_session)) t(actor,session);
 offer:=pg_catalog.gen_random_uuid();
 decision:=pg_catalog.gen_random_uuid();
 INSERT INTO public.mobility_stage_delivery_offers(
  id,request_key,delivery_id,courier_id,vehicle_id,ttl_seconds,expires_at)
 VALUES(offer,pg_catalog.gen_random_uuid(),s.delivery_id,
  s.courier_id,s.vehicle_id,30,
  pg_catalog.clock_timestamp()+interval '30 seconds');
 UPDATE public.mobility_stage_deliveries
 SET courier_id=s.courier_id,vehicle_id=s.vehicle_id,status='accepted',
  revision=2,changed_at=pg_catalog.clock_timestamp()
 WHERE id=s.delivery_id AND status='requested' AND revision=1;
 IF NOT FOUND THEN RAISE EXCEPTION 'G218 pre-accepted original G5 conflicted'; END IF;
 INSERT INTO public.mobility_stage_delivery_events(
  request_key,delivery_id,actor_id,action,next_status,delivery_revision)
 VALUES(decision,s.delivery_id,s.courier_id,'accept','accepted',2)
 RETURNING id INTO event;
 UPDATE public.mobility_stage_delivery_offers
 SET status='accepted',decision_key=decision,decision_event_id=event
 WHERE id=offer;
 INSERT INTO public.mobility_stage_g36_driver_slots(
  driver_id,assignment_kind,assignment_id)
 VALUES(s.courier_id,'DELIVERY',s.delivery_id);
END $fixture$;
ALTER TABLE public.mobility_stage_delivery_offers ENABLE TRIGGER USER;
ALTER TABLE public.mobility_stage_deliveries ENABLE TRIGGER USER;

DO $real_qa$
DECLARE
 s record; adm uuid:='14500000-0000-4145-8145-000000000002'::uuid;
 iat bigint; proof uuid; cargo jsonb; commerce jsonb;
 before_cargo jsonb;
BEGIN
 SELECT * INTO s FROM pg_temp.g218_case;
 iat:=(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint;
 -- The original accepted courier is a REAL recorded QA source state,
 -- not proof of physical handoff or legal authority. Both Admin reads stay
 -- available continuously, with the correct progress state.
 before_cargo:=public.mobility_stage_g219_active_delivery_trace_qa(adm,s.delivery_id);
 IF before_cargo IS NULL OR before_cargo->>'status'<>'accepted'
  OR before_cargo->'assignment'->>'state'<>'QA_ACCEPTED'
  OR pg_catalog.jsonb_array_length(before_cargo->'events')<>2
  OR public.mobility_stage_g146_commerce_trace_qa(adm,s.order_id) IS NULL
 THEN RAISE EXCEPTION 'G219 original commerce courier acceptance not source-visible'; END IF;
 PERFORM public.mobility_stage_g187_bind_recipient_qa(
  s.buyer_id,s.buyer_session,iat,s.delivery_id,
  s.recipient_id,pg_catalog.gen_random_uuid());
 PERFORM public.mobility_stage_delivery_transition(
  s.delivery_id,s.courier_id,'pickup',pg_catalog.gen_random_uuid(),NULL);
 before_cargo:=public.mobility_stage_g219_active_delivery_trace_qa(adm,s.delivery_id);
 IF before_cargo IS NULL OR before_cargo->>'status'<>'picked_up'
  OR (before_cargo->>'revision')::integer<>3
  OR pg_catalog.jsonb_array_length(before_cargo->'events')<>3
  OR public.mobility_stage_g146_commerce_trace_qa(adm,s.order_id) IS NULL
 THEN RAISE EXCEPTION 'G219 picked-up original courier chain unavailable'; END IF;
 proof:=pg_catalog.gen_random_uuid();
 PERFORM public.mobility_stage_g67_register_proof_owner_qa(
  s.delivery_id,s.courier_id,s.courier_session,iat,proof,
  repeat('b',64),'image/jpeg',512,
  pg_catalog.clock_timestamp()+interval '10 minutes');
 PERFORM public.mobility_stage_delivery_transition(
  s.delivery_id,s.courier_id,'deliver',pg_catalog.gen_random_uuid(),proof);
 before_cargo:=public.mobility_stage_g216_completed_delivery_trace_qa(adm,s.delivery_id);
 IF before_cargo IS NOT NULL OR
  public.mobility_stage_g146_commerce_trace_qa(adm,s.order_id) IS NOT NULL
 THEN RAISE EXCEPTION 'G218 Courier proof alone falsely completed original commerce'; END IF;
 PERFORM public.mobility_stage_g187_confirm_received_qa(
  s.recipient_id,s.recipient_session,iat,s.delivery_id,
  pg_catalog.gen_random_uuid());
 IF public.mobility_stage_g219_active_delivery_trace_qa(adm,s.delivery_id) IS NOT NULL
 THEN RAISE EXCEPTION 'G219 active projection leaked into completed delivery'; END IF;
 cargo:=public.mobility_stage_g216_completed_delivery_trace_qa(adm,s.delivery_id);
 commerce:=public.mobility_stage_g146_commerce_trace_qa(adm,s.order_id);
 IF cargo IS NULL OR commerce IS NULL
  OR cargo->>'serviceId'<>s.delivery_id::text
  OR cargo->>'bookingRequestKey'<>s.delivery_request_key::text
  OR cargo->>'quoteId'<>s.quote_id::text
  OR cargo->>'status'<>'delivered'
  OR cargo->'assignment'->>'state'<>'QA_COMPLETED'
  OR cargo->'assignment'->>'legalGate'<>'EXTERNAL_NOT_CERTIFIED'
  OR pg_catalog.jsonb_array_length(cargo->'events')<>4
  OR commerce->>'serviceId'<>s.order_id::text
  OR commerce->>'bookingRequestKey'<>s.order_request_key::text
  OR commerce->>'deliveryId'<>s.delivery_id::text
  OR commerce->>'status'<>'ready'
  OR (commerce->>'revision')::integer<>5
  OR commerce->'assignment'->>'state'<>'NOT_ASSIGNABLE'
  OR commerce->'assignment'->>'legalGate'<>'G38_BLOCKED'
  OR commerce->'ledger'<>'null'::jsonb
  OR cargo->'ledger'<>'null'::jsonb
  OR commerce->>'productionEnabled'<>'false'
  OR cargo->>'productionEnabled'<>'false'
 THEN RAISE EXCEPTION 'G218 original Commerce and courier independent Admin provenance failed: %, %',
  commerce,cargo; END IF;
 IF (cargo->'events'->0)->>'status'<>'requested'
 OR (cargo->'events'->1)->>'status'<>'accepted'
 OR (cargo->'events'->2)->>'status'<>'picked_up'
 OR (cargo->'events'->3)->>'status'<>'delivered'
 OR public.mobility_stage_g146_commerce_trace_qa(s.buyer_id,s.order_id)
  IS NOT NULL
 THEN RAISE EXCEPTION 'G218 false courier events or Buyer impersonated Admin'; END IF;
 -- Even after complete G5 custody, absence of independent receipt FAILS CLOSED.
 UPDATE public.mobility_stage_g187_recipient_confirmations
 SET confirmation_key=NULL,confirmation_session=NULL,
  confirmed_at=NULL,confirmed_delivery_revision=NULL,revision=1
 WHERE delivery_id=s.delivery_id;
 IF public.mobility_stage_g216_completed_delivery_trace_qa(adm,s.delivery_id)
  IS NOT NULL
 OR public.mobility_stage_g146_commerce_trace_qa(adm,s.order_id)
  IS NOT NULL
 THEN RAISE EXCEPTION 'G218 removed G187 receipt did not invalidate both Admin projections'; END IF;
 RAISE NOTICE 'G218 PASS: SAME ORIGINAL G150 order and G5 linked delivery, QA synthetic accepted courier in ROLLBACK, real G5 pickup/G67 consumed proof/G187 recipient -> two Admin original projections, no PSP/GPS/legal certification';
END $real_qa$;
ROLLBACK;
