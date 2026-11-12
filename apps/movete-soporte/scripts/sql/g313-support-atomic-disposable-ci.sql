\set ON_ERROR_STOP on
-- G313 isolated integration QA. All users and cases below are fictitious.
-- G312 creates disposable PG16 Auth fixtures and proves baseline RLS.
\ir g312-support-disposable-ci.sql

-- Two columns exist in Supabase PG17 Auth but were not needed in G312 stub.
ALTER TABLE auth.users ADD COLUMN deleted_at timestamptz, ADD COLUMN banned_until timestamptz;
-- Do NOT grant service_role direct access to Supabase Auth private tables.
-- The trusted non-exposed private function owns privilege for checking and
-- locking AAL2/session rows without revealing the underlying Auth records.
DO $auth_least_privilege$ BEGIN
 IF has_table_privilege('service_role','auth.users','SELECT')
 OR has_table_privilege('service_role','auth.sessions','SELECT')
 OR has_table_privilege('service_role','auth.mfa_factors','SELECT')
 OR has_table_privilege('service_role','auth.sessions','UPDATE')
 THEN RAISE EXCEPTION 'G313 unexpected direct Auth privileges'; END IF;
END $auth_least_privilege$;

\ir ../../sql/g313-support-atomic-enqueue-draft.sql

DO $permissions$
BEGIN
 IF has_schema_privilege('authenticated','qore_support_private','USAGE')
 OR has_schema_privilege('anon','qore_support_private','USAGE')
 OR has_function_privilege('authenticated',
  'qore_support_private.mobility_stage_g313_enqueue_qa(uuid,uuid,uuid,text,text,uuid)','EXECUTE')
 OR has_function_privilege('anon',
  'qore_support_private.mobility_stage_g313_enqueue_qa(uuid,uuid,uuid,text,text,uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'qore_support_private.mobility_stage_g313_enqueue_qa(uuid,uuid,uuid,text,text,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G313 public RPC exposure'; END IF;
END $permissions$;

-- B active. A revoked by G312. Owner cannot impersonate B.
-- Caller roles can't invoke the server-only function even if they know IDs.
SET ROLE authenticated;
DO $browser$
DECLARE forbidden boolean:=false;
BEGIN
 BEGIN
  PERFORM qore_support_private.mobility_stage_g313_enqueue_qa(
   '33333333-3333-4333-8333-333333333333'::uuid,
   'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
   'ddddddd2-dddd-4ddd-8ddd-dddddddddddd'::uuid,
   'OPEN','ACKNOWLEDGE','eeeeeee2-eeee-4eee-8eee-eeeeeeeeeeee'::uuid);
 EXCEPTION WHEN insufficient_privilege THEN forbidden:=true;
 END;
 IF NOT forbidden THEN RAISE EXCEPTION 'G313 browser crossed private schema'; END IF;
END $browser$;
RESET ROLE;

-- Server-only request, validated against current Supabase-style Auth rows.
SET ROLE service_role;
DO $request$
DECLARE original uuid; replay uuid; duplicate_failed boolean:=false; count_after int;
BEGIN
 original:=qore_support_private.mobility_stage_g313_enqueue_qa(
   '33333333-3333-4333-8333-333333333333',
   'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'ddddddd2-dddd-4ddd-8ddd-dddddddddddd',
   'OPEN','ACKNOWLEDGE','eeeeeee2-eeee-4eee-8eee-eeeeeeeeeeee');
 replay:=qore_support_private.mobility_stage_g313_enqueue_qa(
   '33333333-3333-4333-8333-333333333333',
   'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'ddddddd2-dddd-4ddd-8ddd-dddddddddddd',
   'OPEN','ACKNOWLEDGE','eeeeeee2-eeee-4eee-8eee-eeeeeeeeeeee');
 IF original IS NULL OR replay IS DISTINCT FROM original THEN
  RAISE EXCEPTION 'G313 duplicate replay allocated new request'; END IF;
 SELECT count(*) INTO count_after
 FROM public.mobility_stage_support_action_requests
 WHERE agent_id='33333333-3333-4333-8333-333333333333';
 IF count_after<>1 THEN
  RAISE EXCEPTION 'G313 duplicate request inserted twice'; END IF;

 BEGIN
  PERFORM qore_support_private.mobility_stage_g313_enqueue_qa(
   '33333333-3333-4333-8333-333333333333',
   'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'ddddddd2-dddd-4ddd-8ddd-dddddddddddd',
   'OPEN','ESCALATE_SAFETY','eeeeeee2-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN SQLSTATE 'P3133' THEN duplicate_failed:=true;
 END;
 IF NOT duplicate_failed THEN
  RAISE EXCEPTION 'G313 idempotency key was reused for different action'; END IF;
END $request$;

DO $negative$
DECLARE blocked boolean;
BEGIN
 -- Assigned agent B cannot operate on A's ticket.
 blocked:=false;
 BEGIN
  PERFORM qore_support_private.mobility_stage_g313_enqueue_qa(
   '33333333-3333-4333-8333-333333333333',
   'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'ddddddd1-dddd-4ddd-8ddd-dddddddddddd',
   'OPEN','ACKNOWLEDGE','eeeeeee3-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN SQLSTATE 'P3131' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G313 foreign ticket accepted'; END IF;

 -- Agent B must explicitly claim unassigned queue using separate audited workflow.
 blocked:=false;
 BEGIN
  PERFORM qore_support_private.mobility_stage_g313_enqueue_qa(
   '33333333-3333-4333-8333-333333333333',
   'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'ddddddd3-dddd-4ddd-8ddd-dddddddddddd',
   'OPEN','ACKNOWLEDGE','eeeeeee4-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN SQLSTATE 'P3131' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G313 unassigned ticket processed'; END IF;

 -- Expired observation/version, and forbidden transition types.
 blocked:=false;
 BEGIN
  PERFORM qore_support_private.mobility_stage_g313_enqueue_qa(
   '33333333-3333-4333-8333-333333333333',
   'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'ddddddd2-dddd-4ddd-8ddd-dddddddddddd',
   'IN_PROGRESS','ACKNOWLEDGE','eeeeeee5-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN SQLSTATE 'P3131' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G313 stale status accepted'; END IF;
 blocked:=false;
 BEGIN
  PERFORM qore_support_private.mobility_stage_g313_enqueue_qa(
   '33333333-3333-4333-8333-333333333333',
   'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'ddddddd2-dddd-4ddd-8ddd-dddddddddddd',
   'OPEN','RESOLVE_INFORMATIONAL','eeeeeee5-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN SQLSTATE 'P3132' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G313 premature resolution was queued'; END IF;
 blocked:=false;
 BEGIN
  PERFORM qore_support_private.mobility_stage_g313_enqueue_qa(
   '33333333-3333-4333-8333-333333333333',
   'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'ddddddd2-dddd-4ddd-8ddd-dddddddddddd',
   'OPEN','PAYOUT','eeeeeee5-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN SQLSTATE 'P3132' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G313 financial action was queued'; END IF;

 -- Agent A was revoked during earlier G312 test.
 blocked:=false;
 BEGIN
  PERFORM qore_support_private.mobility_stage_g313_enqueue_qa(
   '22222222-2222-4222-8222-222222222222',
   'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'ddddddd1-dddd-4ddd-8ddd-dddddddddddd',
   'OPEN','ACKNOWLEDGE','eeeeeee5-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN SQLSTATE 'P3131' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G313 revoked agent accepted'; END IF;

 -- Owner cannot impersonate agent B, even with active AAL2 session.
 blocked:=false;
 BEGIN
  PERFORM qore_support_private.mobility_stage_g313_enqueue_qa(
   '11111111-1111-4111-8111-111111111111',
   'bbbbbbb3-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'ddddddd2-dddd-4ddd-8ddd-dddddddddddd',
   'OPEN','ACKNOWLEDGE','eeeeeee5-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN SQLSTATE 'P3131' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G313 owner inherited support'; END IF;
END $negative$;
RESET ROLE;

-- Test actual backend revocation AFTER first successful queue. When the
-- Auth session is expired, a replay must be DENIED even if key exists.
UPDATE auth.sessions SET not_after=now()-interval '1 second'
 WHERE id='bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
SET ROLE service_role;
DO $expired$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM qore_support_private.mobility_stage_g313_enqueue_qa(
   '33333333-3333-4333-8333-333333333333',
   'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'ddddddd2-dddd-4ddd-8ddd-dddddddddddd',
   'OPEN','ACKNOWLEDGE','eeeeeee2-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN SQLSTATE 'P3131' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G313 expired session replay accepted'; END IF;
END $expired$;
RESET ROLE;

UPDATE auth.sessions SET not_after=now()+interval '10 minutes'
 WHERE id='bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
UPDATE auth.mfa_factors SET status='unverified'
 WHERE user_id='33333333-3333-4333-8333-333333333333';
SET ROLE service_role;
DO $mfa$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM qore_support_private.mobility_stage_g313_enqueue_qa(
   '33333333-3333-4333-8333-333333333333',
   'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'ddddddd2-dddd-4ddd-8ddd-dddddddddddd',
   'OPEN','ACKNOWLEDGE','eeeeeee2-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN SQLSTATE 'P3131' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G313 unverified MFA replay accepted'; END IF;
END $mfa$;
RESET ROLE;

UPDATE auth.mfa_factors SET status='verified'
 WHERE user_id='33333333-3333-4333-8333-333333333333';
UPDATE public.mobility_stage_backoffice_roles SET status='revoked'
 WHERE user_id='11111111-1111-4111-8111-111111111111';
SET ROLE service_role;
DO $approver$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM qore_support_private.mobility_stage_g313_enqueue_qa(
   '33333333-3333-4333-8333-333333333333',
   'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'ddddddd2-dddd-4ddd-8ddd-dddddddddddd',
   'OPEN','ACKNOWLEDGE','eeeeeee2-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN SQLSTATE 'P3131' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G313 revoked approver still authorized'; END IF;
END $approver$;
RESET ROLE;

-- Assert immutability with the disposable database owner, never by
-- granting service_role extra direct access to private case rows.
DO $ticket_immutable$ BEGIN
 IF (SELECT status FROM public.mobility_stage_support_cases
     WHERE ticket_id='ddddddd2-dddd-4ddd-8ddd-dddddddddddd')<>'OPEN'
 THEN RAISE EXCEPTION 'G313 enqueuing illegally changed ticket status'; END IF;
END $ticket_immutable$;

\echo G313 PASS: private atomic enqueue, live session+MFA, no Owner, assignment+status lock, idempotency, zero ticket mutations, replay revocation, no LIVE.
