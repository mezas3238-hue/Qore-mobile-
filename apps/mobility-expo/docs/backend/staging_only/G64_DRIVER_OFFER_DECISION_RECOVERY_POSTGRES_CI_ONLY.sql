-- G64 / A53: immutable private Driver offer decision recovery after UNKNOWN HTTP.
-- PostgreSQL16 disposable CI ONLY. No remote service role or browser grant.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR to_regprocedure('public.mobility_stage_auto_demo_accept_offer(uuid,uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_delivery_accept_offer(uuid,uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G64 requires local G42 and durable G4/G10 decisions'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g64_reconcile_offer_decision_owner_qa(
 _kind text,_offer uuid,_actor uuid,_session uuid,
 _iat_ms bigint,_request_key uuid,_action text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER
 SET search_path=''
AS $fn$
DECLARE row_state record;
DECLARE canonical_kind text;
DECLARE stored_action text;
DECLARE persisted_id uuid;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G64 only disposable QA' USING ERRCODE='G6401'; END IF;
 IF _kind NOT IN('AUTO_RIDE','DELIVERY') OR _offer IS NULL
 OR _actor IS NULL OR _session IS NULL OR _request_key IS NULL
 OR _iat_ms IS NULL OR _action NOT IN('accept','decline')
 THEN RAISE EXCEPTION 'G64 malformed decision recovery' USING ERRCODE='G6402'; END IF;
 -- Hold the provider grant until DB COMMIT, stopping concurrent revocation.
 IF NOT public.mobility_stage_g42_lock_session(_actor,_session,_iat_ms)
 THEN RAISE EXCEPTION 'G64 session inactive/revoked' USING ERRCODE='G6403'; END IF;
 -- Recover only with one persisted exclusive Driver role, never phone claims.
 IF (SELECT count(*) FROM public.user_roles r WHERE r.user_id=_actor)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles r
  WHERE r.user_id=_actor AND r.role='driver'::public.app_role)
 THEN RAISE EXCEPTION 'G64 exclusive Driver role required'
 USING ERRCODE='G6404'; END IF;
 canonical_kind:=_kind;
 IF _kind='AUTO_RIDE' THEN
  SELECT driver_id AS owner_id,status::text AS decision_status,
   decision_key,decision_event_id,id INTO row_state
  FROM public.mobility_stage_auto_demo_offers
  WHERE id=_offer FOR SHARE;
 ELSE
  SELECT courier_id AS owner_id,status::text AS decision_status,
   decision_key,decision_event_id,id INTO row_state
  FROM public.mobility_stage_delivery_offers
  WHERE id=_offer FOR SHARE;
 END IF;
 IF NOT FOUND OR row_state.owner_id IS DISTINCT FROM _actor
 THEN RAISE EXCEPTION 'G64 offer not owned by verified Driver'
 USING ERRCODE='G6405'; END IF;
 -- While the original server transaction is not observed, this says NOTHING
 -- about rollback; retrySafe must remain false even after offer TTL expiry.
 IF row_state.decision_key IS NULL AND row_state.decision_status='offered' THEN
  RETURN pg_catalog.jsonb_build_object(
   'state','NOT_YET_OBSERVED','qaOnly',true,
   'productionEnabled',false,'retrySafe',false,'reconcileAgain',true);
 END IF;
 IF row_state.decision_key IS DISTINCT FROM _request_key
 OR row_state.decision_status IS DISTINCT FROM
  CASE WHEN _action='accept' THEN 'accepted' ELSE 'declined' END
 THEN RAISE EXCEPTION 'G64 different key, action or terminal decision'
 USING ERRCODE='G6406'; END IF;
 IF (_action='accept' AND row_state.decision_event_id IS NULL)
 OR (_action='decline' AND row_state.decision_event_id IS NOT NULL)
 THEN RAISE EXCEPTION 'G64 non-durable/malformed receipt'
 USING ERRCODE='G6407'; END IF;
 persisted_id:=CASE WHEN _action='accept' THEN row_state.decision_event_id
  ELSE row_state.id END;
 RETURN pg_catalog.jsonb_build_object(
  'state','COMMITTED','offerId',_offer,'requestKey',_request_key,
  'kind',canonical_kind,'action',_action,
  'outcome',CASE WHEN _action='accept' THEN 'accepted' ELSE 'declined' END,
  'receiptId',persisted_id,'serverPersisted',true,
  'liveEnabled',false,'pushDelivered',false,
  'qaOnly',true,'productionEnabled',false,
  'retrySafe',false,'reconcileAgain',false);
END $fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g64_reconcile_offer_decision_owner_qa(
 text,uuid,uuid,uuid,bigint,uuid,text)
 FROM PUBLIC,anon,authenticated,service_role,
 mobility_g48_gateway_ci,mobility_g49_chat_gateway_ci,
 mobility_g56_driver_gateway_ci,mobility_g58f_exchange_ci,
 mobility_g58f_definer_ci,mobility_g60c_definer_ci,mobility_g60c_execute_ci;
COMMIT;
