-- G198: lost-object chat AFTER a completed AUTO ride.
-- Separate from G50 live-service chat (never weaken its terminal write fence).
-- PG16 disposable CI only; no external IdP, LIVE, phone disclosure or PSP.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR to_regclass('public.mobility_stage_auto_demo_trips') IS NULL
 THEN RAISE EXCEPTION 'G198 needs G42 and G3 lifecycle' USING ERRCODE='P9801'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g198_lost_item_cases(
 case_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 trip_id uuid NOT NULL UNIQUE REFERENCES public.mobility_stage_auto_demo_trips(id),
 passenger_id uuid NOT NULL REFERENCES auth.users(id),
 driver_id uuid NOT NULL REFERENCES auth.users(id),
 state text NOT NULL DEFAULT 'OPEN' CHECK(state IN ('OPEN','CLOSED','BLOCKED')),
 opened_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 expires_at timestamptz NOT NULL,
 closed_at timestamptz,
 CHECK(passenger_id<>driver_id),
 CHECK(expires_at>opened_at AND expires_at<=opened_at+interval '7 days'),
 CHECK((state='OPEN' AND closed_at IS NULL) OR
 (state<>'OPEN' AND closed_at IS NOT NULL))
);
CREATE INDEX mobility_stage_g198_passenger_inbox
 ON public.mobility_stage_g198_lost_item_cases(passenger_id,opened_at DESC);
CREATE INDEX mobility_stage_g198_driver_inbox
 ON public.mobility_stage_g198_lost_item_cases(driver_id,opened_at DESC);
CREATE TABLE public.mobility_stage_g198_lost_item_messages(
 message_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 case_id uuid NOT NULL REFERENCES public.mobility_stage_g198_lost_item_cases(case_id),
 sender_id uuid NOT NULL REFERENCES auth.users(id),
 request_key uuid NOT NULL,
 body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 500 AND octet_length(body)<=2000),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 UNIQUE(case_id,sender_id,request_key)
);
CREATE INDEX mobility_stage_g198_history
 ON public.mobility_stage_g198_lost_item_messages(case_id,created_at,message_id);
ALTER TABLE public.mobility_stage_g198_lost_item_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g198_lost_item_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g198_lost_item_cases,
 public.mobility_stage_g198_lost_item_messages
 FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mobility_stage_g198_authorize_qa(
 _case uuid,_actor uuid,_session uuid,_iat_ms bigint,_write boolean
) RETURNS public.mobility_stage_g198_lost_item_cases
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE c public.mobility_stage_g198_lost_item_cases%ROWTYPE;
 r public.mobility_stage_auto_demo_trips%ROWTYPE; role_name text;
BEGIN
 IF _case IS NULL OR _actor IS NULL OR _session IS NULL OR _iat_ms IS NULL
 OR _write IS NULL OR NOT public.mobility_stage_g42_lock_session(
  _actor,_session,_iat_ms)
 THEN RAISE EXCEPTION 'G198 identity revoked' USING ERRCODE='P9802'; END IF;
 SELECT * INTO c FROM public.mobility_stage_g198_lost_item_cases
 WHERE case_id=_case FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G198 case unavailable' USING ERRCODE='P9804'; END IF;
 role_name:=CASE WHEN _actor=c.passenger_id THEN 'passenger'
  WHEN _actor=c.driver_id THEN 'driver' ELSE NULL END;
 IF role_name IS NULL OR
 (SELECT count(*) FROM public.user_roles WHERE user_id=_actor)<>1 OR
 NOT EXISTS(SELECT 1 FROM public.user_roles
  WHERE user_id=_actor AND role::text=role_name)
 THEN RAISE EXCEPTION 'G198 foreign participant' USING ERRCODE='P9803'; END IF;
 SELECT * INTO r FROM public.mobility_stage_auto_demo_trips
 WHERE id=c.trip_id FOR SHARE;
 IF NOT FOUND OR r.passenger_id IS DISTINCT FROM c.passenger_id OR
 r.driver_id IS DISTINCT FROM c.driver_id OR r.status<>'completed'
 THEN RAISE EXCEPTION 'G198 trip assignment changed' USING ERRCODE='P9804'; END IF;
 IF c.state='BLOCKED' OR (_write AND
  (c.state<>'OPEN' OR c.expires_at<=pg_catalog.clock_timestamp()))
 THEN RAISE EXCEPTION 'G198 contact closed' USING ERRCODE='P9805'; END IF;
 RETURN c;
END $f$;
CREATE FUNCTION public.mobility_stage_g198_open_case_qa(
 _passenger uuid,_session uuid,_iat_ms bigint,_trip uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE r public.mobility_stage_auto_demo_trips%ROWTYPE;
 c public.mobility_stage_g198_lost_item_cases%ROWTYPE;
BEGIN
 IF _passenger IS NULL OR _session IS NULL OR _iat_ms IS NULL OR _trip IS NULL
 OR NOT public.mobility_stage_g42_lock_session(_passenger,_session,_iat_ms)
 THEN RAISE EXCEPTION 'G198 passenger session revoked' USING ERRCODE='P9802'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=_passenger)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_passenger
  AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G198 Passenger-only opening' USING ERRCODE='P9803'; END IF;
 SELECT * INTO r FROM public.mobility_stage_auto_demo_trips
 WHERE id=_trip FOR SHARE;
 IF NOT FOUND OR r.passenger_id<>_passenger OR r.driver_id IS NULL
 OR r.driver_id=_passenger OR r.status<>'completed'
 OR r.changed_at IS NULL
 OR r.changed_at<pg_catalog.clock_timestamp()-interval '7 days'
 OR r.changed_at>pg_catalog.clock_timestamp()+interval '5 seconds'
 THEN RAISE EXCEPTION 'G198 original completed trip required'
 USING ERRCODE='P9804'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('g198/'||_trip::text,0));
 SELECT * INTO c FROM public.mobility_stage_g198_lost_item_cases
 WHERE trip_id=_trip FOR UPDATE;
 IF NOT FOUND THEN
  INSERT INTO public.mobility_stage_g198_lost_item_cases(
   trip_id,passenger_id,driver_id,expires_at)
  VALUES(_trip,_passenger,r.driver_id,
   LEAST(r.changed_at+interval '7 days',
     pg_catalog.clock_timestamp()+interval '7 days'))
  RETURNING * INTO c;
 END IF;
 IF c.passenger_id<>_passenger OR c.driver_id<>r.driver_id
 OR c.state='BLOCKED'
 THEN RAISE EXCEPTION 'G198 case no longer assigned'
 USING ERRCODE='P9804'; END IF;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','caseId',c.case_id,'tripId',r.id,
  'state',c.state,'expiresAtMs',
   floor(extract(epoch FROM c.expires_at)*1000)::bigint,
  'qaOnly',true,'productionEnabled',false);
END $f$;
CREATE FUNCTION public.mobility_stage_g198_send_message_qa(
 _case uuid,_actor uuid,_session uuid,_iat_ms bigint,
 _request uuid,_body text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE c public.mobility_stage_g198_lost_item_cases%ROWTYPE;
 m public.mobility_stage_g198_lost_item_messages%ROWTYPE;
BEGIN
 IF _request IS NULL OR _body IS NULL OR
 char_length(_body) NOT BETWEEN 1 AND 500 OR
 octet_length(_body)>2000 OR pg_catalog.btrim(_body)<>_body
 OR _body ~ '[[:cntrl:]]' OR
 _body ~* '(https?://|www\\.|[[:alnum:]_.+%-]+@[[:alnum:].-]+\\.[[:alpha:]]{2,})'
 OR _body ~ '([0-9][[:space:]().-]*){7,}'
 THEN RAISE EXCEPTION 'G198 private text only without contacts'
 USING ERRCODE='P9801'; END IF;
 c:=public.mobility_stage_g198_authorize_qa(
  _case,_actor,_session,_iat_ms,true);
 SELECT * INTO m FROM public.mobility_stage_g198_lost_item_messages
 WHERE case_id=_case AND sender_id=_actor AND request_key=_request FOR UPDATE;
 IF FOUND THEN
  IF m.body<>_body THEN RAISE EXCEPTION 'G198 replay conflict'
  USING ERRCODE='P9806'; END IF;
 ELSE
  IF (SELECT count(*) FROM public.mobility_stage_g198_lost_item_messages
      WHERE case_id=_case)>=60
  OR (SELECT count(*) FROM public.mobility_stage_g198_lost_item_messages
      WHERE case_id=_case AND sender_id=_actor
       AND created_at>pg_catalog.clock_timestamp()-interval '1 hour')>=10
  THEN RAISE EXCEPTION 'G198 contact rate limit' USING ERRCODE='P9807'; END IF;
  INSERT INTO public.mobility_stage_g198_lost_item_messages(
   case_id,sender_id,request_key,body)
  VALUES(_case,_actor,_request,_body) RETURNING * INTO m;
 END IF;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','caseId',_case,
  'messageId',m.message_id,'requestKey',m.request_key,
  'serverPersisted',true,'qaOnly',true,'productionEnabled',false);
END $f$;
CREATE FUNCTION public.mobility_stage_g198_read_case_qa(
 _case uuid,_actor uuid,_session uuid,_iat_ms bigint
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE c public.mobility_stage_g198_lost_item_cases%ROWTYPE;
 messages jsonb;
BEGIN
 c:=public.mobility_stage_g198_authorize_qa(
  _case,_actor,_session,_iat_ms,false);
 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'messageId',m.message_id,'senderRole',
   CASE WHEN m.sender_id=c.passenger_id THEN 'passenger' ELSE 'driver' END,
  'body',m.body,'createdAtMs',
   floor(extract(epoch FROM m.created_at)*1000)::bigint)
  ORDER BY m.created_at,m.message_id),'[]'::jsonb)
 INTO messages FROM
 (SELECT * FROM public.mobility_stage_g198_lost_item_messages
  WHERE case_id=_case ORDER BY created_at DESC,message_id DESC LIMIT 60) m;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','caseId',_case,'tripId',c.trip_id,
  'state',c.state,'canSend',(c.state='OPEN' AND c.expires_at>pg_catalog.clock_timestamp()),
  'expiresAtMs',floor(extract(epoch FROM c.expires_at)*1000)::bigint,
  'messages',messages,'qaOnly',true,'productionEnabled',false);
END $f$;
CREATE FUNCTION public.mobility_stage_g198_close_case_qa(
 _case uuid,_actor uuid,_session uuid,_iat_ms bigint,_block boolean
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE c public.mobility_stage_g198_lost_item_cases%ROWTYPE;
BEGIN
 c:=public.mobility_stage_g198_authorize_qa(
  _case,_actor,_session,_iat_ms,false);
 IF _block IS NULL THEN RAISE EXCEPTION 'G198 missing closure' USING ERRCODE='P9801'; END IF;
 IF c.state='BLOCKED' THEN RETURN true; END IF;
 UPDATE public.mobility_stage_g198_lost_item_cases
 SET state=CASE WHEN _block THEN 'BLOCKED' ELSE 'CLOSED' END,
 closed_at=pg_catalog.clock_timestamp()
 WHERE case_id=_case AND state='OPEN';
 RETURN true;
END $f$;
-- A Driver discovers cases ONLY by their own verified Auth identity. The
-- client cannot supply a passenger UUID or query any foreign Driver inbox.
CREATE FUNCTION public.mobility_stage_g198_driver_inbox_qa(
 _driver uuid,_session uuid,_iat_ms bigint
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE cases jsonb;
BEGIN
 IF _driver IS NULL OR _session IS NULL OR _iat_ms IS NULL OR
 NOT public.mobility_stage_g42_lock_session(_driver,_session,_iat_ms)
 THEN RAISE EXCEPTION 'G198 Driver inbox session denied' USING ERRCODE='P9802'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=_driver)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_driver
  AND role='driver'::public.app_role)
 THEN RAISE EXCEPTION 'G198 exclusive Driver inbox role required' USING ERRCODE='P9803'; END IF;
 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'caseId',c.case_id,'tripId',c.trip_id,'state',c.state,
  'expiresAtMs',floor(extract(epoch FROM c.expires_at)*1000)::bigint)
  ORDER BY c.opened_at DESC,c.case_id DESC),'[]'::jsonb)
 INTO cases FROM (
  SELECT c.* FROM public.mobility_stage_g198_lost_item_cases c
  JOIN public.mobility_stage_auto_demo_trips t ON t.id=c.trip_id
  WHERE c.driver_id=_driver AND t.driver_id=_driver
   AND t.passenger_id=c.passenger_id AND t.status='completed'
   AND c.state='OPEN' AND c.expires_at>pg_catalog.clock_timestamp()
  ORDER BY c.opened_at DESC,c.case_id DESC LIMIT 50
 ) c;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','driverId',_driver,'cases',cases,
  'qaOnly',true,'productionEnabled',false);
END $f$;
REVOKE ALL ON FUNCTION
 public.mobility_stage_g198_authorize_qa(uuid,uuid,uuid,bigint,boolean),
 public.mobility_stage_g198_open_case_qa(uuid,uuid,bigint,uuid),
 public.mobility_stage_g198_send_message_qa(uuid,uuid,uuid,bigint,uuid,text),
 public.mobility_stage_g198_read_case_qa(uuid,uuid,uuid,bigint),
 public.mobility_stage_g198_driver_inbox_qa(uuid,uuid,bigint),
 public.mobility_stage_g198_close_case_qa(uuid,uuid,uuid,bigint,boolean)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION
 public.mobility_stage_g198_open_case_qa(uuid,uuid,bigint,uuid),
 public.mobility_stage_g198_send_message_qa(uuid,uuid,uuid,bigint,uuid,text),
 public.mobility_stage_g198_read_case_qa(uuid,uuid,uuid,bigint),
 public.mobility_stage_g198_driver_inbox_qa(uuid,uuid,bigint),
 public.mobility_stage_g198_close_case_qa(uuid,uuid,uuid,bigint,boolean)
 TO service_role;
COMMIT;
