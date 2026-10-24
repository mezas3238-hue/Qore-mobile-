-- QORE Mobile G50 / A31 — private per-assignment chat, PostgreSQL 16 disposable QA ONLY.
-- NOT a production migration. Owner-only probes; never expose caller-provided UUIDs via HTTP.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR to_regclass('public.mobility_stage_auto_demo_trips') IS NULL
 OR to_regclass('public.mobility_stage_deliveries') IS NULL
 OR to_regclass('public.mobility_stage_merchant_orders') IS NULL
 THEN RAISE EXCEPTION 'G50 requires isolated PostgreSQL and G42/ride/delivery chain'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g50_chat_threads(
 conversation_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 service_kind text NOT NULL CHECK(service_kind IN('RIDE','DELIVERY','MERCHANT_ORDER')),
 service_id uuid NOT NULL,
 passenger_id uuid NOT NULL REFERENCES auth.users(id),
 driver_id uuid NOT NULL REFERENCES auth.users(id),
 state text NOT NULL DEFAULT 'ACTIVE' CHECK(state IN('ACTIVE','CLOSED')),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 closed_at timestamptz,
 CHECK(passenger_id<>driver_id),
 CHECK((state='ACTIVE' AND closed_at IS NULL) OR
       (state='CLOSED' AND closed_at IS NOT NULL))
);
CREATE UNIQUE INDEX mobility_stage_g50_one_active_thread
 ON public.mobility_stage_g50_chat_threads(service_kind,service_id)
 WHERE state='ACTIVE';
CREATE INDEX mobility_stage_g50_actor_inbox
 ON public.mobility_stage_g50_chat_threads(passenger_id,created_at,conversation_id);
CREATE INDEX mobility_stage_g50_driver_inbox
 ON public.mobility_stage_g50_chat_threads(driver_id,created_at,conversation_id);
CREATE TABLE public.mobility_stage_g50_chat_messages(
 seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 message_id uuid NOT NULL UNIQUE DEFAULT pg_catalog.gen_random_uuid(),
 conversation_id uuid NOT NULL REFERENCES public.mobility_stage_g50_chat_threads(conversation_id),
 sender_id uuid NOT NULL REFERENCES auth.users(id),
 request_key uuid NOT NULL,
 body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 500 AND octet_length(body)<=2000),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 UNIQUE(conversation_id,sender_id,request_key)
);
CREATE INDEX mobility_stage_g50_message_page
 ON public.mobility_stage_g50_chat_messages(conversation_id,seq);
ALTER TABLE public.mobility_stage_g50_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g50_chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g50_chat_threads,
 public.mobility_stage_g50_chat_messages
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci;

-- Always read the authoritative live assignment with a lock. Terminal service
-- may be read by the same participants but never written to. An old driver
-- loses access as soon as the assignment source changes.
CREATE FUNCTION public.mobility_stage_g50_source(_kind text,_service uuid)
RETURNS TABLE(passenger_id uuid,driver_id uuid,can_send boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF _kind='RIDE' THEN
  RETURN QUERY SELECT t.passenger_id,t.driver_id,
   t.status IN('accepted','arriving','in_progress')
   FROM public.mobility_stage_auto_demo_trips t WHERE t.id=_service
    AND t.driver_id IS NOT NULL
   FOR SHARE;
 ELSIF _kind='DELIVERY' THEN
  RETURN QUERY SELECT d.sender_id,d.courier_id,
   d.status IN('accepted','picked_up')
   FROM public.mobility_stage_deliveries d WHERE d.id=_service
    AND d.courier_id IS NOT NULL
   FOR SHARE;
 ELSIF _kind='MERCHANT_ORDER' THEN
  RETURN QUERY SELECT o.buyer_id,d.courier_id,
    (o.status='handed_to_courier' AND d.status IN('accepted','picked_up'))
   FROM public.mobility_stage_merchant_orders o
   JOIN public.mobility_stage_deliveries d ON d.id=o.delivery_id
   WHERE o.id=_service AND d.courier_id IS NOT NULL
   FOR SHARE OF o,d;
 END IF;
END $fn$;
CREATE FUNCTION public.mobility_stage_g50_authorize(
 _conversation uuid,_actor uuid,_session uuid,_iat bigint,_write boolean
) RETURNS public.mobility_stage_g50_chat_threads
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE thread public.mobility_stage_g50_chat_threads%ROWTYPE;
 src record; expected_role text;
BEGIN
 IF _conversation IS NULL OR _actor IS NULL OR _session IS NULL
 OR _iat IS NULL OR _write IS NULL
 OR NOT public.mobility_stage_g42_lock_session(_actor,_session,_iat)
 THEN RAISE EXCEPTION 'G50 session denied' USING ERRCODE='G5001'; END IF;
 SELECT * INTO thread FROM public.mobility_stage_g50_chat_threads
 WHERE conversation_id=_conversation;
 IF NOT FOUND OR thread.state<>'ACTIVE'
 THEN RAISE EXCEPTION 'G50 conversation not active' USING ERRCODE='G5004'; END IF;
 expected_role:=CASE WHEN _actor=thread.passenger_id THEN 'passenger'
  WHEN _actor=thread.driver_id THEN 'driver' ELSE NULL END;
 IF expected_role IS NULL
 OR (SELECT count(*) FROM public.user_roles WHERE user_id=_actor)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
    WHERE user_id=_actor AND role::text=expected_role)
 THEN RAISE EXCEPTION 'G50 not a current participant' USING ERRCODE='G5003'; END IF;
 SELECT * INTO src FROM public.mobility_stage_g50_source(
  thread.service_kind,thread.service_id);
 IF NOT FOUND OR src.passenger_id IS DISTINCT FROM thread.passenger_id
 OR src.driver_id IS DISTINCT FROM thread.driver_id
 THEN RAISE EXCEPTION 'G50 stale assignment' USING ERRCODE='G5003'; END IF;
 -- Acquire assignment source lock before thread lock (same order as OPEN),
 -- then re-check thread to prevent close/rotate between both reads.
 SELECT * INTO thread FROM public.mobility_stage_g50_chat_threads
  WHERE conversation_id=_conversation FOR SHARE;
 IF NOT FOUND OR thread.state<>'ACTIVE'
 OR src.passenger_id IS DISTINCT FROM thread.passenger_id
 OR src.driver_id IS DISTINCT FROM thread.driver_id
 THEN RAISE EXCEPTION 'G50 conversation rotated' USING ERRCODE='G5004'; END IF;
 IF _write AND NOT src.can_send
 THEN RAISE EXCEPTION 'G50 terminal service read-only' USING ERRCODE='G5004'; END IF;
 RETURN thread;
END $fn$;
-- Owner-only, synthetic Auth attestation. Concurrency serialized per service.
CREATE FUNCTION public.mobility_stage_g50_open_owner_qa(
 _kind text,_service uuid,_actor uuid,_session uuid,_iat bigint
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE src record; old_thread public.mobility_stage_g50_chat_threads%ROWTYPE;
 expected_role text;
BEGIN
 IF _kind NOT IN('RIDE','DELIVERY','MERCHANT_ORDER') OR _service IS NULL OR _actor IS NULL
 OR _session IS NULL OR _iat IS NULL
 OR NOT public.mobility_stage_g42_lock_session(_actor,_session,_iat)
 THEN RAISE EXCEPTION 'G50 session or service denied' USING ERRCODE='G5001'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('g50/'||_kind||'/'||_service::text,0));
 SELECT * INTO src FROM public.mobility_stage_g50_source(_kind,_service);
 IF NOT FOUND OR NOT src.can_send OR src.passenger_id=src.driver_id
 THEN RAISE EXCEPTION 'G50 service unavailable' USING ERRCODE='G5004'; END IF;
 expected_role:=CASE WHEN _actor=src.passenger_id THEN 'passenger'
  WHEN _actor=src.driver_id THEN 'driver' ELSE NULL END;
 IF expected_role IS NULL OR
  (SELECT count(*) FROM public.user_roles WHERE user_id=_actor)<>1 OR
  NOT EXISTS(SELECT 1 FROM public.user_roles
    WHERE user_id=_actor AND role::text=expected_role)
 THEN RAISE EXCEPTION 'G50 role denied' USING ERRCODE='G5003'; END IF;
 SELECT * INTO old_thread FROM public.mobility_stage_g50_chat_threads
  WHERE service_kind=_kind AND service_id=_service AND state='ACTIVE'
 FOR UPDATE;
 IF FOUND AND (old_thread.passenger_id<>src.passenger_id
   OR old_thread.driver_id<>src.driver_id) THEN
  UPDATE public.mobility_stage_g50_chat_threads
   SET state='CLOSED',closed_at=pg_catalog.clock_timestamp()
   WHERE conversation_id=old_thread.conversation_id;
  old_thread.conversation_id:=NULL;
 END IF;
 IF old_thread.conversation_id IS NULL THEN
  INSERT INTO public.mobility_stage_g50_chat_threads(
   service_kind,service_id,passenger_id,driver_id)
  VALUES(_kind,_service,src.passenger_id,src.driver_id)
  RETURNING * INTO old_thread;
 END IF;
 RETURN pg_catalog.jsonb_build_object(
  'conversationId',old_thread.conversation_id,'serviceKind',_kind,
  'serviceId',_service,'serverStored',true,'qaOnly',true);
END $fn$;
CREATE FUNCTION public.mobility_stage_g50_send_owner_qa(
 _conversation uuid,_actor uuid,_session uuid,_iat bigint,
 _request uuid,_body text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE thread public.mobility_stage_g50_chat_threads%ROWTYPE;
 message public.mobility_stage_g50_chat_messages%ROWTYPE;
BEGIN
 IF _request IS NULL OR _body IS NULL OR char_length(_body) NOT BETWEEN 1 AND 500
 OR octet_length(_body)>2000 OR btrim(_body)='' OR btrim(_body)<>_body OR
 pg_catalog.strpos(_body,'<')>0 OR pg_catalog.strpos(_body,'>')>0 OR
 _body ~ '[[:cntrl:]]' OR
 _body ~* '(https?://|www\.|[[:alnum:]_.+%-]+@[[:alnum:].-]+\.[[:alpha:]]{2,})' OR
 _body ~ '([0-9][[:space:]().-]*){7,}' OR
 EXISTS(SELECT 1 FROM pg_catalog.generate_series(8206,8207) AS code
  WHERE pg_catalog.strpos(_body,pg_catalog.chr(code))>0) OR
 EXISTS(SELECT 1 FROM pg_catalog.generate_series(8234,8238) AS code
  WHERE pg_catalog.strpos(_body,pg_catalog.chr(code))>0) OR
 EXISTS(SELECT 1 FROM pg_catalog.generate_series(8294,8297) AS code
  WHERE pg_catalog.strpos(_body,pg_catalog.chr(code))>0)
 THEN RAISE EXCEPTION 'G50 invalid message' USING ERRCODE='G5002'; END IF;
 thread:=public.mobility_stage_g50_authorize(_conversation,_actor,_session,_iat,true);
 INSERT INTO public.mobility_stage_g50_chat_messages(
  conversation_id,sender_id,request_key,body)
 VALUES(thread.conversation_id,_actor,_request,_body)
 ON CONFLICT(conversation_id,sender_id,request_key) DO NOTHING
 RETURNING * INTO message;
 IF NOT FOUND THEN
  SELECT * INTO message FROM public.mobility_stage_g50_chat_messages
   WHERE conversation_id=thread.conversation_id AND sender_id=_actor
    AND request_key=_request;
  IF NOT FOUND OR message.body<>_body THEN
   RAISE EXCEPTION 'G50 conflicting requestKey' USING ERRCODE='G5009'; END IF;
 END IF;
 RETURN pg_catalog.jsonb_build_object('conversationId',thread.conversation_id,
  'messageId',message.message_id,'seq',message.seq,
  'senderId',message.sender_id,'body',message.body,
  'createdAt',message.created_at,'serverStored',true,'qaOnly',true);
END $fn$;
CREATE FUNCTION public.mobility_stage_g50_page_owner_qa(
 _conversation uuid,_actor uuid,_session uuid,_iat bigint,
 _after bigint DEFAULT 0,_limit integer DEFAULT 50
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE thread public.mobility_stage_g50_chat_threads%ROWTYPE;
 payload jsonb; count_rows integer; next_seq bigint;
BEGIN
 IF _after IS NULL OR _after<0 OR _limit IS NULL OR _limit NOT BETWEEN 1 AND 100
 THEN RAISE EXCEPTION 'G50 invalid cursor/page' USING ERRCODE='G5002'; END IF;
 thread:=public.mobility_stage_g50_authorize(_conversation,_actor,_session,_iat,false);
 WITH page AS(
  SELECT seq,message_id,sender_id,body,created_at
   FROM public.mobility_stage_g50_chat_messages
   WHERE conversation_id=thread.conversation_id AND seq>_after
   ORDER BY seq LIMIT _limit+1
 ), visible AS(
  SELECT * FROM page ORDER BY seq LIMIT _limit
 )
 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'messageId',message_id,'seq',seq,'senderId',sender_id,'body',body,
  'createdAt',created_at,'serverStored',true) ORDER BY seq),'[]'::jsonb),
  (SELECT count(*) FROM page),
  (SELECT max(seq) FROM visible)
 INTO payload,count_rows,next_seq FROM visible;
 RETURN pg_catalog.jsonb_build_object(
  'conversationId',thread.conversation_id,'messages',payload,
  'nextAfter',COALESCE(next_seq,_after),'hasMore',count_rows>_limit,
  'qaOnly',true);
END $fn$;
-- Explicitly deny every HTTP/SDK role, including service_role and the G48 delegate.
REVOKE ALL ON FUNCTION public.mobility_stage_g50_source(text,uuid),
 public.mobility_stage_g50_authorize(uuid,uuid,uuid,bigint,boolean),
 public.mobility_stage_g50_open_owner_qa(text,uuid,uuid,uuid,bigint),
 public.mobility_stage_g50_send_owner_qa(uuid,uuid,uuid,bigint,uuid,text),
 public.mobility_stage_g50_page_owner_qa(uuid,uuid,uuid,bigint,bigint,integer)
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci;
COMMIT;
