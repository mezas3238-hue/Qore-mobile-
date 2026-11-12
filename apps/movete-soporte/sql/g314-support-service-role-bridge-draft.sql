-- G314 — Supabase Edge private bridge for support action intents.
-- DRAFT ONLY, NOT INSTALLED. This wrapper is intentionally visible at
-- public RPC *only to the service_role* used by the trusted Edge Function.
-- NEVER grant authenticated/anon/PUBLIC direct EXECUTE.
-- G313 independently enforces current agent status, AAL2/session,
-- assignment, state and idempotency in a single transaction.
CREATE OR REPLACE FUNCTION public.mobility_stage_g314_enqueue_action_qa(
 p_actor uuid,
 p_session uuid,
 p_ticket uuid,
 p_expected_status text,
 p_action text,
 p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $g314$
DECLARE
  _request uuid;
BEGIN
  IF p_actor IS NULL OR p_session IS NULL OR p_ticket IS NULL OR
     p_expected_status IS NULL OR p_action IS NULL OR
     p_idempotency_key IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P3131',MESSAGE='G314 access denied';
  END IF;

  _request:=qore_support_private.mobility_stage_g313_enqueue_qa(
   p_actor,p_session,p_ticket,p_expected_status,p_action,p_idempotency_key
  );
  RETURN pg_catalog.jsonb_build_object(
   'request_id',_request,
   'ticket_id',p_ticket,
   'action',p_action,
   'outcome','QUEUED'
  );
END
$g314$;
REVOKE ALL ON FUNCTION public.mobility_stage_g314_enqueue_action_qa(
 uuid,uuid,uuid,text,text,uuid
) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g314_enqueue_action_qa(
 uuid,uuid,uuid,text,text,uuid
) TO service_role;
