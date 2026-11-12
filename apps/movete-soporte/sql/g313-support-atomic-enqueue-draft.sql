-- G313 — support action outbox: session-bound, assignment-bound, atomic
-- DRAFT ONLY. Depends on G301 and G312. Do NOT apply to hosted PG17
-- until explicit integration review, Auth privileges and STAGING QA.
-- In particular, this never updates a ticket nor sends any message.

CREATE SCHEMA IF NOT EXISTS qore_support_private;
REVOKE ALL ON SCHEMA qore_support_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA qore_support_private TO service_role;

CREATE OR REPLACE FUNCTION qore_support_private.mobility_stage_g313_enqueue_qa(
  _actor uuid,
  _session uuid,
  _ticket uuid,
  _expected_status text,
  _action text,
  _idempotency_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
-- EXCEPTIONAL trusted private SECURITY DEFINER: must inspect and lock
-- Supabase Auth sessions and MFA atomically without granting service_role
-- broad UPDATE or SELECT on Auth private tables. Private non-exposed schema,
-- EXECUTE only service_role, exact actor/session/assignment checks below.
SECURITY DEFINER
SET search_path = ''
AS $g313$
DECLARE
  _approved uuid;
  _status text;
  _assigned uuid;
  _previous uuid;
  _previous_action text;
  _previous_status text;
  _new uuid;
BEGIN
  -- The trusted caller MUST validate the actual JWT with Supabase Auth,
  -- obtain the user id from getUser, and extract session_id from that JWT.
  -- No untrusted browser is allowed to call this function.
  IF _actor IS NULL OR _session IS NULL OR _ticket IS NULL OR
     _idempotency_key IS NULL OR _expected_status IS NULL OR
     _action IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P3131',MESSAGE='G313 access denied';
  END IF;

  -- Check role and live Supabase Auth session inside this same transaction.
  -- Lock existing authority rows so suspension/revocation cannot race
  -- ahead of the enqueued request commit. No inherited Owner/Admin role.
  SELECT sa.user_id INTO _approved
  FROM public.mobility_stage_support_agents AS sa
  JOIN public.mobility_stage_backoffice_roles AS owner_role
    ON owner_role.user_id=sa.approved_by
  JOIN auth.users AS usr
    ON usr.id=sa.user_id
  JOIN auth.sessions AS sess
    ON sess.user_id=usr.id AND sess.id=_session
  JOIN auth.mfa_factors AS factor
    ON factor.id=sess.factor_id AND factor.user_id=usr.id
  WHERE sa.user_id=_actor
    AND sa.status='active' AND sa.approved_by<>sa.user_id
    AND owner_role.role='owner' AND owner_role.status='active'
    AND owner_role.approved_by<>owner_role.user_id
    AND usr.is_anonymous IS NOT TRUE
    AND usr.deleted_at IS NULL
    AND (usr.email_confirmed_at IS NOT NULL OR
         usr.phone_confirmed_at IS NOT NULL)
    AND (usr.banned_until IS NULL OR usr.banned_until<=now())
    AND sess.aal::text='aal2'
    AND (sess.not_after IS NULL OR sess.not_after>now())
    AND factor.factor_type::text='totp'
    AND factor.status::text='verified'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles AS ur WHERE ur.user_id=usr.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.mobility_stage_backoffice_roles AS conflict
      WHERE conflict.user_id=usr.id
    )
  FOR SHARE OF sa, owner_role, usr, sess, factor;

  IF _approved IS DISTINCT FROM _actor THEN
    RAISE EXCEPTION USING ERRCODE='P3131',MESSAGE='G313 access denied';
  END IF;

  -- Exclusive lock on the ticket serializes action-request races and
  -- enforces the assignment and observed status at database commit time.
  SELECT c.status,c.assigned_support_id INTO _status,_assigned
  FROM public.mobility_stage_support_cases AS c
  WHERE c.ticket_id=_ticket
  FOR UPDATE;

  -- Generic denial avoids revealing existence of another employee's case.
  IF _assigned IS DISTINCT FROM _actor OR
     _status IS DISTINCT FROM _expected_status OR
     _status NOT IN ('OPEN','IN_PROGRESS','WAITING_CUSTOMER','ESCALATED') THEN
    RAISE EXCEPTION USING ERRCODE='P3131',MESSAGE='G313 access denied';
  END IF;

  -- No "resolve" or "request information" shortcut from an unhandled case.
  IF NOT (
       (_action='ACKNOWLEDGE' AND _status='OPEN')
    OR (_action='REQUEST_INFORMATION' AND _status='IN_PROGRESS')
    OR (_action='ESCALATE_SAFETY' AND _status IN ('OPEN','IN_PROGRESS'))
    OR (_action='ESCALATE_FINANCE' AND _status IN ('OPEN','IN_PROGRESS'))
    OR (_action='RESOLVE_INFORMATIONAL'
        AND _status IN ('IN_PROGRESS','WAITING_CUSTOMER'))
  ) THEN
    RAISE EXCEPTION USING ERRCODE='P3132',MESSAGE='G313 action/state mismatch';
  END IF;

  SELECT r.request_id,r.action,r.expected_status
  INTO _previous,_previous_action,_previous_status
  FROM public.mobility_stage_support_action_requests AS r
  WHERE r.agent_id=_actor AND r.ticket_id=_ticket
    AND r.idempotency_key=_idempotency_key
  FOR SHARE;

  IF _previous IS NOT NULL THEN
    IF _previous_action IS DISTINCT FROM _action OR
       _previous_status IS DISTINCT FROM _expected_status THEN
      RAISE EXCEPTION USING ERRCODE='P3133',
        MESSAGE='G313 idempotency key reused for different action';
    END IF;
    RETURN _previous;
  END IF;

  INSERT INTO public.mobility_stage_support_action_requests
     (ticket_id,agent_id,action,expected_status,idempotency_key)
  VALUES
     (_ticket,_actor,_action,_expected_status,_idempotency_key)
  RETURNING request_id INTO _new;

  RETURN _new;
END
$g313$;

REVOKE ALL ON FUNCTION qore_support_private.mobility_stage_g313_enqueue_qa(
  uuid,uuid,uuid,text,text,uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION qore_support_private.mobility_stage_g313_enqueue_qa(
  uuid,uuid,uuid,text,text,uuid
) TO service_role;
