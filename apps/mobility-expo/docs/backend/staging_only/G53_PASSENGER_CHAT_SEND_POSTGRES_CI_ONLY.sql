-- G53 / A34 - Passenger chat send ACK bound to committed G50 message + G52 revision.
-- This is disposable PostgreSQL QA. Owner-only functions MUST NOT be mounted.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g52_history_owner_qa(uuid,uuid,uuid,bigint,bigint,bigint,integer)') IS NULL
 OR to_regprocedure('public.mobility_stage_g50_send_owner_qa(uuid,uuid,uuid,bigint,uuid,text)') IS NULL
 THEN RAISE EXCEPTION 'G53 requires isolated G50/G52 chain'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g53_passenger_send_owner_qa(
 _kind text,_service uuid,_conversation uuid,_actor uuid,_session uuid,
 _iat bigint,_request uuid,_body text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE t public.mobility_stage_g50_chat_threads%ROWTYPE;
 receipt jsonb; persisted record;
BEGIN
 IF _kind IS NULL OR _kind NOT IN('RIDE','DELIVERY','MERCHANT_ORDER') OR _service IS NULL
 OR _conversation IS NULL OR _actor IS NULL OR _session IS NULL
 OR _iat IS NULL OR _request IS NULL OR _body IS NULL
 THEN RAISE EXCEPTION 'G53 invalid send contract' USING ERRCODE='G5302'; END IF;
 -- This function is exclusively for Cliente Passenger. Driver will get a
 -- separate actor-scoped contract; never let the browser choose senderRole.
 t:=public.mobility_stage_g50_authorize(
  _conversation,_actor,_session,_iat,true);
 IF t.passenger_id<>_actor
 THEN RAISE EXCEPTION 'G53 requires current Passenger' USING ERRCODE='G5303'; END IF;
 IF t.service_kind<>_kind OR t.service_id<>_service
 THEN RAISE EXCEPTION 'G53 pinned service mismatch' USING ERRCODE='G5304'; END IF;
 receipt:=public.mobility_stage_g50_send_owner_qa(
  _conversation,_actor,_session,_iat,_request,_body);
 -- The trigger G52 assigns a version transactionally. Replays recover
 -- the ORIGINAL immutable revision, not the newest high-water mark.
 SELECT m.message_id,m.sender_id,m.body,m.created_at,m.request_key,
  v.revision AS message_revision INTO persisted
 FROM public.mobility_stage_g50_chat_messages m
 JOIN public.mobility_stage_g52_message_versions v
  ON v.message_id=m.message_id AND v.conversation_id=m.conversation_id
 WHERE m.message_id=(receipt->>'messageId')::uuid
 AND m.conversation_id=_conversation;
 IF NOT FOUND OR persisted.sender_id IS DISTINCT FROM _actor
 OR persisted.request_key IS DISTINCT FROM _request
 OR persisted.body IS DISTINCT FROM _body
 OR persisted.message_revision IS NULL
 THEN RAISE EXCEPTION 'G53 untrusted persisted message' USING ERRCODE='G5305'; END IF;
 RETURN pg_catalog.jsonb_build_object(
  'conversationId',_conversation,'serviceId',_service,
  'requestKey',persisted.request_key,'messageId',persisted.message_id,
  'senderRole','passenger','body',persisted.body,
  'createdAt',floor(extract(epoch FROM persisted.created_at)*1000)::bigint,
  'revision',persisted.message_revision,'serverStored',true);
END $fn$;
REVOKE ALL ON FUNCTION
 public.mobility_stage_g53_passenger_send_owner_qa(text,uuid,uuid,uuid,uuid,bigint,uuid,text)
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci;
COMMIT;
