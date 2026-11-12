-- G320 Support: atomic unassigned-ticket claim + append-only claim audit.
-- DRAFT/STAGING QA only. Depends on G301 and G312 tables.
-- No migrations applied to hosted Supabase and no LIVE operations.
--
-- IMPORTANT: this is a private service RPC, not a public action.
-- Caller MUST be the trusted server, which has validated the token using
-- Supabase Auth getUser. Actor and session are NEVER taken from user input.

CREATE TABLE IF NOT EXISTS public.mobility_stage_support_claim_events (
  claim_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.mobility_stage_support_cases(ticket_id) ON DELETE RESTRICT,
  agent_id uuid NOT NULL REFERENCES public.mobility_stage_support_agents(user_id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mobility_g320_claim_ticket_once UNIQUE(ticket_id),
  CONSTRAINT mobility_g320_claim_request_once UNIQUE(agent_id,ticket_id,idempotency_key)
);
ALTER TABLE public.mobility_stage_support_claim_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_support_claim_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_support_claim_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.mobility_stage_support_claim_events TO service_role;
-- No client, staff, or service_role UPDATE/DELETE.
-- Administrative SQL repair must undergo separate audit.

CREATE SCHEMA IF NOT EXISTS qore_support_private;
REVOKE ALL ON SCHEMA qore_support_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA qore_support_private TO service_role;

CREATE OR REPLACE FUNCTION qore_support_private.mobility_stage_g320_claim_qa(
 _actor uuid,_session uuid,_ticket uuid,_idempotency_key uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $g320$
DECLARE
 _approved uuid;
 _claimed_agent uuid;
 _status text;
 _priority text;
 _previous uuid;
 _new uuid;
BEGIN
 IF _actor IS NULL OR _session IS NULL OR _ticket IS NULL OR _idempotency_key IS NULL
 THEN RAISE EXCEPTION USING ERRCODE='P3201',MESSAGE='G320 access denied'; END IF;

 -- Existing authority rows are locked through commit, as in G313.
 -- Owner approval never automatically grants Owner the Support role.
 SELECT sa.user_id INTO _approved
 FROM public.mobility_stage_support_agents AS sa
 JOIN public.mobility_stage_backoffice_roles AS owner_role
   ON owner_role.user_id=sa.approved_by
 JOIN auth.users AS usr ON usr.id=sa.user_id
 JOIN auth.sessions AS sess ON sess.user_id=usr.id AND sess.id=_session
 JOIN auth.mfa_factors AS factor
   ON factor.id=sess.factor_id AND factor.user_id=usr.id
 WHERE sa.user_id=_actor AND sa.status='active'
   AND sa.approved_by<>sa.user_id
   AND owner_role.role='owner' AND owner_role.status='active'
   AND owner_role.approved_by<>owner_role.user_id
   AND usr.is_anonymous IS NOT TRUE
   AND usr.deleted_at IS NULL
   AND (usr.banned_until IS NULL OR usr.banned_until<=now())
   AND (usr.email_confirmed_at IS NOT NULL OR usr.phone_confirmed_at IS NOT NULL)
   AND sess.aal::text='aal2'
   AND (sess.not_after IS NULL OR sess.not_after>now())
   AND factor.factor_type::text='totp' AND factor.status::text='verified'
   AND NOT EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id=usr.id)
   AND NOT EXISTS(
      SELECT 1 FROM public.mobility_stage_backoffice_roles br WHERE br.user_id=usr.id
   )
 FOR SHARE OF sa,owner_role,usr,sess,factor;
 IF _approved IS DISTINCT FROM _actor
 THEN RAISE EXCEPTION USING ERRCODE='P3201',MESSAGE='G320 access denied'; END IF;

 -- A row lock on the ticket is the serialization point. Two agents cannot
 -- both claim a ticket even if their reads began simultaneously.
 SELECT assigned_support_id,status,priority
 INTO _claimed_agent,_status,_priority
 FROM public.mobility_stage_support_cases
 WHERE ticket_id=_ticket
 FOR UPDATE;
 IF NOT FOUND OR _status IS DISTINCT FROM 'OPEN' OR
    _priority IS NULL OR _priority NOT IN ('NORMAL','HIGH')
 THEN RAISE EXCEPTION USING ERRCODE='P3201',MESSAGE='G320 access denied'; END IF;

 IF _claimed_agent IS NOT NULL THEN
   IF _claimed_agent IS DISTINCT FROM _actor
   THEN RAISE EXCEPTION USING ERRCODE='P3201',MESSAGE='G320 access denied'; END IF;

   SELECT claim_id INTO _previous
   FROM public.mobility_stage_support_claim_events
   WHERE ticket_id=_ticket AND agent_id=_actor
     AND idempotency_key=_idempotency_key;
   IF _previous IS NULL THEN
     RAISE EXCEPTION USING ERRCODE='P3202',MESSAGE='G320 previously claimed';
   END IF;
   RETURN _previous;
 END IF;

 -- Both write effects are in the same transaction, so an audit failure
 -- rolls back the assignment as well.
 UPDATE public.mobility_stage_support_cases
 SET assigned_support_id=_actor,updated_at=now()
 WHERE ticket_id=_ticket AND assigned_support_id IS NULL AND status='OPEN';
 IF NOT FOUND
 THEN RAISE EXCEPTION USING ERRCODE='P3201',MESSAGE='G320 access denied'; END IF;

 INSERT INTO public.mobility_stage_support_claim_events(ticket_id,agent_id,idempotency_key)
 VALUES (_ticket,_actor,_idempotency_key)
 RETURNING claim_id INTO _new;

 RETURN _new;
END
$g320$;
REVOKE ALL ON FUNCTION qore_support_private.mobility_stage_g320_claim_qa(
 uuid,uuid,uuid,uuid
) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION qore_support_private.mobility_stage_g320_claim_qa(
 uuid,uuid,uuid,uuid
) TO service_role;

-- This public RPC is only callable with the trusted service_role key held
-- in the Edge Function runtime. It is never exposed to signed-in users.
CREATE OR REPLACE FUNCTION public.mobility_stage_g320_claim_ticket_qa(
 p_actor uuid,p_session uuid,p_ticket uuid,p_idempotency_key uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $g320bridge$
DECLARE
 v_id uuid;
BEGIN
 v_id:=qore_support_private.mobility_stage_g320_claim_qa(
  p_actor,p_session,p_ticket,p_idempotency_key);
 RETURN pg_catalog.jsonb_build_object(
   'claim_id',v_id,'ticket_id',p_ticket,'outcome','CLAIMED');
END
$g320bridge$;
REVOKE ALL ON FUNCTION public.mobility_stage_g320_claim_ticket_qa(
 uuid,uuid,uuid,uuid
) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g320_claim_ticket_qa(
 uuid,uuid,uuid,uuid
) TO service_role;
