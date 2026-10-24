-- G59B/A48: Driver sender-only UNKNOWN COMMIT reconciliation, QA ONLY.
-- No change to Client B; no public API or carrier, no automatic replay.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g59_reconcile_passenger_owner_qa(text,uuid,uuid,uuid,uuid,bigint,uuid,text)') IS NULL
 OR to_regprocedure('public.mobility_stage_g56_send_qa(uuid,uuid,text)') IS NULL
 THEN RAISE EXCEPTION 'G59B requires disposable G59/G56'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g59b_reconcile_driver_owner_qa(
 _kind text,_service uuid,_conversation uuid,_driver uuid,_session uuid,
 _iat bigint,_request uuid,_body text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE thread public.mobility_stage_g50_chat_threads%ROWTYPE;
 current_source record; persisted record; current_revision bigint;
BEGIN
 IF _kind IS NULL OR _kind NOT IN('RIDE','DELIVERY','MERCHANT_ORDER')
 OR _service IS NULL OR _conversation IS NULL OR _driver IS NULL
 OR _session IS NULL OR _iat IS NULL OR _request IS NULL
 OR _body IS NULL OR pg_catalog.char_length(_body) NOT BETWEEN 1 AND 500
 OR pg_catalog.octet_length(_body)>2000 OR pg_catalog.btrim(_body)<>_body
 THEN RAISE EXCEPTION 'G59B malformed Driver reconciliation'
 USING ERRCODE='G5912'; END IF;
 -- G50_auth holds the provider grant (G42 FOR SHARE) until COMMIT,
 -- verifies exactly one Driver role and fresh same-assignment source.
 thread:=public.mobility_stage_g50_authorize(
  _conversation,_driver,_session,_iat,false);
 IF thread.driver_id IS DISTINCT FROM _driver
 OR thread.service_kind IS DISTINCT FROM _kind
 OR thread.service_id IS DISTINCT FROM _service
 THEN RAISE EXCEPTION 'G59B wrong Driver/service/conversation'
 USING ERRCODE='G5913'; END IF;
 SELECT * INTO current_source
 FROM public.mobility_stage_g50_source(_kind,_service);
 IF NOT FOUND OR current_source.driver_id IS DISTINCT FROM _driver
 OR current_source.passenger_id IS DISTINCT FROM thread.passenger_id
 OR NOT current_source.can_send
 THEN RAISE EXCEPTION 'G59B Driver no longer assigned'
 USING ERRCODE='G5914'; END IF;
 SELECT revision INTO current_revision
 FROM public.mobility_stage_g52_thread_versions
 WHERE conversation_id=_conversation FOR SHARE;
 IF NOT FOUND OR current_revision<1
 THEN RAISE EXCEPTION 'G59B unversioned chat' USING ERRCODE='G5915'; END IF;
 SELECT m.message_id,m.sender_id,m.request_key,m.body,m.created_at,
  v.revision AS original_revision INTO persisted
 FROM public.mobility_stage_g50_chat_messages m
 JOIN public.mobility_stage_g52_message_versions v
 ON v.message_id=m.message_id AND v.conversation_id=m.conversation_id
 WHERE m.conversation_id=_conversation AND m.sender_id=_driver
  AND m.request_key=_request;
 IF NOT FOUND THEN
  RETURN pg_catalog.jsonb_build_object(
   'state','NOT_YET_OBSERVED','serverStored',false,
   'retrySafe',false,'reconcileAgain',true,
   'productionEnabled',false,'qaOnly',true);
 END IF;
 IF persisted.body IS DISTINCT FROM _body
 THEN RAISE EXCEPTION 'G59B same requestKey, different body'
 USING ERRCODE='G5919'; END IF;
 IF persisted.original_revision IS NULL OR persisted.original_revision<2
 OR persisted.original_revision>current_revision
 THEN RAISE EXCEPTION 'G59B persisted revision unavailable'
 USING ERRCODE='G5915'; END IF;
 RETURN pg_catalog.jsonb_build_object(
  'state','COMMITTED','serverStored',true,
  'retrySafe',false,'reconcileAgain',false,
  'productionEnabled',false,'qaOnly',true,
  'latestRevision',current_revision,
  'historyRefreshRequired',current_revision>persisted.original_revision,
  'ack',pg_catalog.jsonb_build_object(
    'conversationId',_conversation,'serviceId',_service,
    'requestKey',persisted.request_key,'messageId',persisted.message_id,
    'senderRole','driver','body',persisted.body,
    'createdAt',floor(extract(epoch FROM persisted.created_at)*1000)::bigint,
    'revision',persisted.original_revision,'serverStored',true));
END $fn$;
REVOKE ALL ON FUNCTION
 public.mobility_stage_g59b_reconcile_driver_owner_qa(
 text,uuid,uuid,uuid,uuid,bigint,uuid,text)
 FROM PUBLIC,anon,authenticated,service_role,
 mobility_g48_gateway_ci,mobility_g49_chat_gateway_ci,
 mobility_g56_driver_gateway_ci,mobility_g58f_exchange_ci,
 mobility_g58f_definer_ci;
COMMIT;
