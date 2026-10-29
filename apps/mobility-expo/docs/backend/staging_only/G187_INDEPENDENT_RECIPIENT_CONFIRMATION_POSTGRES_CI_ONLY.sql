-- G187: independent authenticated recipient confirmation AFTER G67 courier proof.
-- DISPOSABLE PG16 ONLY. Never run remotely, no PSP, no commercial delivery.
-- G5 'delivered' means courier proof committed, NOT recipient consent.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR to_regprocedure('public.mobility_stage_g67_proof_verified_owner_qa(uuid,uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G187 needs disposable G42 + G67' USING ERRCODE='P0001'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g187_recipient_confirmations(
 delivery_id uuid PRIMARY KEY REFERENCES public.mobility_stage_deliveries(id) ON DELETE RESTRICT,
 sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 binding_key uuid NOT NULL UNIQUE,
 bound_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 confirmation_key uuid UNIQUE,
 confirmation_session uuid,
 confirmed_at timestamptz,
 confirmed_delivery_revision bigint,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 CHECK(sender_id<>recipient_id),
 CHECK((confirmation_key IS NULL AND confirmation_session IS NULL
        AND confirmed_at IS NULL AND confirmed_delivery_revision IS NULL)
    OR (confirmation_key IS NOT NULL AND confirmation_session IS NOT NULL
        AND confirmed_at IS NOT NULL AND confirmed_delivery_revision>=4)),
 CHECK(confirmed_at IS NULL OR confirmed_at>=bound_at)
);
CREATE INDEX mobility_stage_g187_recipient_scope
 ON public.mobility_stage_g187_recipient_confirmations(recipient_id,delivery_id);
ALTER TABLE public.mobility_stage_g187_recipient_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g187_recipient_confirmations
 FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mobility_stage_g187_bind_recipient_qa(
 _sender uuid,_session uuid,_iat_ms bigint,_delivery uuid,
 _recipient uuid,_binding_key uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE d public.mobility_stage_deliveries%ROWTYPE;
 b public.mobility_stage_g187_recipient_confirmations%ROWTYPE;
BEGIN
 IF _sender IS NULL OR _session IS NULL OR _delivery IS NULL
 OR _recipient IS NULL OR _binding_key IS NULL OR _sender=_recipient
 OR _iat_ms IS NULL OR _iat_ms NOT BETWEEN 0 AND 9999999999999
 THEN RAISE EXCEPTION 'G187 invalid binding scope' USING ERRCODE='P8701'; END IF;
 IF NOT public.mobility_stage_g42_lock_session(_sender,_session,_iat_ms)
 THEN RAISE EXCEPTION 'G187 sender session revoked' USING ERRCODE='P8702'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=_sender)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
  WHERE user_id=_sender AND role='passenger'::public.app_role)
 OR (SELECT count(*) FROM public.user_roles WHERE user_id=_recipient)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
  WHERE user_id=_recipient AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G187 independent passenger identities required'
 USING ERRCODE='P8703'; END IF;
 SELECT * INTO d FROM public.mobility_stage_deliveries
 WHERE id=_delivery AND sender_id=_sender FOR UPDATE;
 IF NOT FOUND OR d.status NOT IN ('requested','accepted','picked_up')
 OR _recipient IS NOT DISTINCT FROM d.courier_id
 THEN RAISE EXCEPTION 'G187 recipient binding closed or unauthorized'
 USING ERRCODE='P8704'; END IF;
 SELECT * INTO b FROM public.mobility_stage_g187_recipient_confirmations
 WHERE delivery_id=_delivery FOR UPDATE;
 IF FOUND THEN
  IF b.sender_id<>_sender OR b.recipient_id<>_recipient
  OR b.binding_key<>_binding_key
  THEN RAISE EXCEPTION 'G187 recipient immutable binding conflict'
   USING ERRCODE='P8704'; END IF;
 ELSE
  INSERT INTO public.mobility_stage_g187_recipient_confirmations
  (delivery_id,sender_id,recipient_id,binding_key)
  VALUES (_delivery,_sender,_recipient,_binding_key);
 END IF;
 RETURN pg_catalog.jsonb_build_object(
 'mode','STAGING_DEMO_ONLY','deliveryId',_delivery,'bindingPersisted',true,
 'recipientConfirmed',false,'qaOnly',true,'productionEnabled',false);
END $f$;
CREATE FUNCTION public.mobility_stage_g187_confirm_received_qa(
 _recipient uuid,_session uuid,_iat_ms bigint,_delivery uuid,_event_key uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE d public.mobility_stage_deliveries%ROWTYPE;
 b public.mobility_stage_g187_recipient_confirmations%ROWTYPE;
BEGIN
 IF _recipient IS NULL OR _session IS NULL OR _delivery IS NULL
 OR _event_key IS NULL OR _iat_ms IS NULL
 OR _iat_ms NOT BETWEEN 0 AND 9999999999999
 THEN RAISE EXCEPTION 'G187 invalid recipient scope' USING ERRCODE='P8701'; END IF;
 IF NOT public.mobility_stage_g42_lock_session(_recipient,_session,_iat_ms)
 THEN RAISE EXCEPTION 'G187 recipient session revoked' USING ERRCODE='P8702'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=_recipient)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
  WHERE user_id=_recipient AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G187 independent recipient role required'
 USING ERRCODE='P8703'; END IF;
 SELECT * INTO d FROM public.mobility_stage_deliveries
 WHERE id=_delivery FOR UPDATE;
 SELECT * INTO b FROM public.mobility_stage_g187_recipient_confirmations
 WHERE delivery_id=_delivery AND recipient_id=_recipient FOR UPDATE;
 IF NOT FOUND OR b.sender_id IS DISTINCT FROM d.sender_id
 OR _recipient=d.sender_id OR _recipient IS NOT DISTINCT FROM d.courier_id
 THEN RAISE EXCEPTION 'G187 foreign recipient denied' USING ERRCODE='P8704'; END IF;
 IF b.confirmation_key IS NOT NULL THEN
  IF b.confirmation_key<>_event_key
  THEN RAISE EXCEPTION 'G187 second confirmation key denied' USING ERRCODE='P8704'; END IF;
 ELSE
  IF d.status<>'delivered' OR d.proof_ref IS NULL
  OR NOT public.mobility_stage_g67_proof_verified_owner_qa(
      d.id,d.courier_id,d.proof_ref)
  THEN RAISE EXCEPTION 'G187 courier proof not terminal and verified'
   USING ERRCODE='P8705'; END IF;
  UPDATE public.mobility_stage_g187_recipient_confirmations
  SET confirmation_key=_event_key,confirmation_session=_session,
   confirmed_at=pg_catalog.clock_timestamp(),
   confirmed_delivery_revision=d.revision,revision=revision+1
  WHERE delivery_id=_delivery AND confirmation_key IS NULL
  RETURNING * INTO b;
  IF NOT FOUND THEN RAISE EXCEPTION 'G187 confirmation race lost'
   USING ERRCODE='P8704'; END IF;
 END IF;
 RETURN pg_catalog.jsonb_build_object(
 'mode','STAGING_DEMO_ONLY','deliveryId',_delivery,
 'confirmationId',b.confirmation_key,'recipientConfirmed',true,
 'serverPersisted',true,'qaOnly',true,'productionEnabled',false,
 'paymentAuthorized',false);
END $f$;
CREATE FUNCTION public.mobility_stage_g187_sender_confirmation_status_qa(
 _sender uuid,_session uuid,_iat_ms bigint,_delivery uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE d public.mobility_stage_deliveries%ROWTYPE;
 b public.mobility_stage_g187_recipient_confirmations%ROWTYPE;
 recipient_ok boolean:=false;
BEGIN
 IF _sender IS NULL OR _session IS NULL OR _delivery IS NULL OR _iat_ms IS NULL
 OR _iat_ms NOT BETWEEN 0 AND 9999999999999
 THEN RAISE EXCEPTION 'G187 invalid sender read' USING ERRCODE='P8701'; END IF;
 IF NOT public.mobility_stage_g42_lock_session(_sender,_session,_iat_ms)
 THEN RAISE EXCEPTION 'G187 sender session revoked' USING ERRCODE='P8702'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=_sender)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
 WHERE user_id=_sender AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G187 sender role required' USING ERRCODE='P8703'; END IF;
 SELECT * INTO d FROM public.mobility_stage_deliveries
 WHERE id=_delivery AND sender_id=_sender FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G187 foreign delivery denied'
 USING ERRCODE='P8704'; END IF;
 SELECT * INTO b FROM public.mobility_stage_g187_recipient_confirmations
 WHERE delivery_id=_delivery;
 -- Confirmation history is immutable: a sender's later dispute or return
 -- NEVER erases the recipient's original receipt; settlement eligibility is
 -- independently denied once the delivery is disputed/returned.
 recipient_ok:=b.confirmation_key IS NOT NULL
 AND d.status IN ('delivered','disputed','returned')
 AND d.proof_ref IS NOT NULL
 AND public.mobility_stage_g67_proof_verified_owner_qa(
  d.id,d.courier_id,d.proof_ref);
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','deliveryId',d.id,'ownerId',_sender,
  'deliveryState',d.status::text,'revision',d.revision,
  'courierProofCommitted',d.proof_ref IS NOT NULL,
  'recipientBound',b.delivery_id IS NOT NULL,
  'recipientConfirmed',recipient_ok,
  'eligibleForSettlement',(recipient_ok AND d.status='delivered'),
  'paymentAuthorized',false,'qaOnly',true,'productionEnabled',false);
END $f$;
-- G190: authenticated recipient READ-ONLY recovery of a potentially
-- committed G187 ACK, never a new POST, PIN, dispatcher instruction or PSP.
-- It also records historical confirmation even after a sender dispute.
CREATE FUNCTION public.mobility_stage_g190_recipient_confirmation_status_qa(
 _recipient uuid,_session uuid,_iat_ms bigint,_delivery uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE d public.mobility_stage_deliveries%ROWTYPE;
 b public.mobility_stage_g187_recipient_confirmations%ROWTYPE;
 committed boolean:=false;
BEGIN
 IF _recipient IS NULL OR _session IS NULL OR _delivery IS NULL OR _iat_ms IS NULL
 OR _iat_ms NOT BETWEEN 0 AND 9999999999999
 THEN RAISE EXCEPTION 'G190 invalid recipient recovery scope'
 USING ERRCODE='P9001'; END IF;
 IF NOT public.mobility_stage_g42_lock_session(_recipient,_session,_iat_ms)
 THEN RAISE EXCEPTION 'G190 session revoked' USING ERRCODE='P9002'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=_recipient)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_recipient
  AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G190 exclusive recipient Passenger required'
 USING ERRCODE='P9003'; END IF;
 -- FOR SHARE serializes with G5 and G187 writes. The private recipient
 -- binding is checked in the SAME SQL statement to avoid foreign UUID reads.
 SELECT * INTO d FROM public.mobility_stage_deliveries
 WHERE id=_delivery FOR SHARE;
 SELECT * INTO b FROM public.mobility_stage_g187_recipient_confirmations
 WHERE delivery_id=_delivery AND recipient_id=_recipient
  AND sender_id=d.sender_id FOR SHARE;
 IF NOT FOUND OR _recipient=d.sender_id
 OR _recipient IS NOT DISTINCT FROM d.courier_id
 THEN RAISE EXCEPTION 'G190 foreign or unbound recipient denied'
 USING ERRCODE='P9004'; END IF;
 committed:=b.confirmation_key IS NOT NULL
  AND d.status IN ('delivered','disputed','returned')
  AND d.proof_ref IS NOT NULL
  AND public.mobility_stage_g67_proof_verified_owner_qa(
   d.id,d.courier_id,d.proof_ref);
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','deliveryId',d.id,
  'recipientConfirmed',committed,
  'confirmationId',CASE WHEN committed THEN b.confirmation_key ELSE NULL END,
  'deliveryState',d.status::text,'revision',d.revision,
  'eligibleForSettlement',(committed AND d.status='delivered'),
  'paymentAuthorized',false,'qaOnly',true,'productionEnabled',false);
END $f$;
REVOKE ALL ON FUNCTION public.mobility_stage_g190_recipient_confirmation_status_qa(
 uuid,uuid,bigint,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g190_recipient_confirmation_status_qa(
 uuid,uuid,bigint,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g187_bind_recipient_qa(
 uuid,uuid,bigint,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g187_confirm_received_qa(
 uuid,uuid,bigint,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g187_sender_confirmation_status_qa(
 uuid,uuid,bigint,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g187_bind_recipient_qa(
 uuid,uuid,bigint,uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g187_confirm_received_qa(
 uuid,uuid,bigint,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g187_sender_confirmation_status_qa(
 uuid,uuid,bigint,uuid) TO service_role;
COMMIT;
