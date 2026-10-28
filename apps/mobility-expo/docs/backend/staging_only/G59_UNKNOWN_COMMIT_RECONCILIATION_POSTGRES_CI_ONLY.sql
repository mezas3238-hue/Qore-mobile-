-- G59 / A47: reconcile UNKNOWN HTTP/COMMIT outcome without repeat SEND.
-- Disposable PostgreSQL16 QA only; privileged fixture, NOT an HTTP RPC.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g53_passenger_send_owner_qa(text,uuid,uuid,uuid,uuid,bigint,uuid,text)') IS NULL
 OR to_regclass('public.mobility_stage_g52_message_versions') IS NULL
 OR to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 THEN RAISE EXCEPTION 'G59 refuses non-disposable or incomplete chat chain'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g59_reconcile_passenger_owner_qa(
 _kind text,_service uuid,_conversation uuid,_actor uuid,_session uuid,
 _iat bigint,_request uuid,_body text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE thread public.mobility_stage_g50_chat_threads%ROWTYPE;
 current_source record;
 saved record; current_revision bigint;
BEGIN
 IF _kind IS NULL OR _kind NOT IN('RIDE','DELIVERY','MERCHANT_ORDER')
 OR _service IS NULL OR _conversation IS NULL OR _actor IS NULL
 OR _session IS NULL OR _iat IS NULL OR _request IS NULL
 OR _body IS NULL OR pg_catalog.char_length(_body) NOT BETWEEN 1 AND 500
 OR pg_catalog.octet_length(_body)>2000 OR pg_catalog.btrim(_body)<>_body
 THEN RAISE EXCEPTION 'G59 malformed reconciliation scope'
 USING ERRCODE='G5902'; END IF;
 -- This holds the G42 session row through COMMIT and rechecks the CURRENT
 -- service participants. Never return a receipt to a rotated Driver.
 thread:=public.mobility_stage_g50_authorize(
  _conversation,_actor,_session,_iat,false);
 IF thread.passenger_id IS DISTINCT FROM _actor
 OR thread.service_kind IS DISTINCT FROM _kind
 OR thread.service_id IS DISTINCT FROM _service
 THEN RAISE EXCEPTION 'G59 role, conversation or service mismatch'
 USING ERRCODE='G5903'; END IF;
 SELECT * INTO current_source FROM public.mobility_stage_g50_source(
  _kind,_service);
 IF NOT FOUND OR current_source.passenger_id IS DISTINCT FROM _actor
 OR current_source.driver_id IS DISTINCT FROM thread.driver_id
 OR NOT current_source.can_send
 THEN RAISE EXCEPTION 'G59 service not currently active'
 USING ERRCODE='G5904'; END IF;
 -- G52 lock synchronizes stable currentVersion against concurrent send.
 -- Original message revision is never replaced with the high watermark.
 SELECT revision INTO current_revision
 FROM public.mobility_stage_g52_thread_versions
 WHERE conversation_id=_conversation FOR SHARE;
 IF NOT FOUND OR current_revision<1 THEN
  RAISE EXCEPTION 'G59 missing version authority' USING ERRCODE='G5905'; END IF;
 SELECT m.message_id,m.sender_id,m.request_key,m.body,m.created_at,
  v.revision AS original_revision
 INTO saved FROM public.mobility_stage_g50_chat_messages m
 JOIN public.mobility_stage_g52_message_versions v ON
  v.message_id=m.message_id AND v.conversation_id=m.conversation_id
 WHERE m.conversation_id=_conversation AND m.sender_id=_actor
  AND m.request_key=_request;
 IF NOT FOUND THEN
  -- Absence at this instant IS NOT rollback evidence. A competing sender
  -- may COMMIT after this read; caller must not silently replay.
  RETURN pg_catalog.jsonb_build_object(
   'state','NOT_YET_OBSERVED','serverStored',false,
   'retrySafe',false,'reconcileAgain',true,'qaOnly',true,
   'productionEnabled',false);
 END IF;
 IF saved.body IS DISTINCT FROM _body THEN
  RAISE EXCEPTION 'G59 conflicting requestKey payload'
  USING ERRCODE='G5909'; END IF;
 IF saved.original_revision IS NULL OR saved.original_revision<2
  OR current_revision<saved.original_revision
 THEN RAISE EXCEPTION 'G59 corrupt persisted revision'
 USING ERRCODE='G5905'; END IF;
 RETURN pg_catalog.jsonb_build_object(
  'state','COMMITTED','serverStored',true,'retrySafe',false,
  'reconcileAgain',false,'qaOnly',true,'productionEnabled',false,
  'latestRevision',current_revision,
  'historyRefreshRequired',current_revision>saved.original_revision,
  'ack',pg_catalog.jsonb_build_object(
   'conversationId',_conversation,'serviceId',_service,
   'requestKey',saved.request_key,'messageId',saved.message_id,
   'senderRole','passenger','body',saved.body,
   'createdAt',floor(extract(epoch FROM saved.created_at)*1000)::bigint,
   'revision',saved.original_revision,'serverStored',true)
 );
END $fn$;
-- Owner-only. Even service_role and existing chat NOLOGIN gateways cannot
-- invoke this synthetic function directly; it is NOT routed in OpenAPI.
REVOKE ALL ON FUNCTION
 public.mobility_stage_g59_reconcile_passenger_owner_qa(
  text,uuid,uuid,uuid,uuid,bigint,uuid,text)
 FROM PUBLIC,anon,authenticated,service_role,
 mobility_g48_gateway_ci,mobility_g49_chat_gateway_ci,
 mobility_g56_driver_gateway_ci,mobility_g58f_exchange_ci,
 mobility_g58f_definer_ci;
COMMIT;
