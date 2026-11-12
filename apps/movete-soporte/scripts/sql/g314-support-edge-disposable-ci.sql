\set ON_ERROR_STOP on
-- G314 disposable database acceptance test; NEVER execute hosted PG17.
\ir g313-support-atomic-disposable-ci.sql

-- G313 tested revoking Owner approval. Restore fixture so the new
-- authenticated staff request can succeed in this isolated database.
UPDATE public.mobility_stage_backoffice_roles SET status='active'
 WHERE user_id='11111111-1111-4111-8111-111111111111';
\ir ../../sql/g314-support-service-role-bridge-draft.sql

DO $privs$ BEGIN
 IF has_function_privilege('authenticated',
  'public.mobility_stage_g314_enqueue_action_qa(uuid,uuid,uuid,text,text,uuid)','EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_stage_g314_enqueue_action_qa(uuid,uuid,uuid,text,text,uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.mobility_stage_g314_enqueue_action_qa(uuid,uuid,uuid,text,text,uuid)','EXECUTE')
 OR has_table_privilege('service_role','auth.sessions','SELECT')
 OR has_table_privilege('service_role','auth.users','SELECT')
 THEN RAISE EXCEPTION 'G314 public RPC/grant exposure'; END IF;
END $privs$;

-- A mobile/browser client cannot execute the privileged RPC, regardless
-- of any known ticket UUID or forged user claims.
SET ROLE authenticated;
DO $client$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g314_enqueue_action_qa(
   '33333333-3333-4333-8333-333333333333',
   'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'ddddddd2-dddd-4ddd-8ddd-dddddddddddd',
   'OPEN','ESCALATE_SAFETY',
   'eeeeeee6-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G314 authenticated bypass'; END IF;
END $client$;
RESET ROLE;

SET ROLE anon;
DO $anon$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g314_enqueue_action_qa(
   '33333333-3333-4333-8333-333333333333',
   'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'ddddddd2-dddd-4ddd-8ddd-dddddddddddd',
   'OPEN','ESCALATE_SAFETY',
   'eeeeeee6-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G314 anon bypass'; END IF;
END $anon$;
RESET ROLE;

-- The trusted Edge Function alone can use the service role RPC.
-- G313 verifies session, MFA, role and assignment inside that transaction.
SET ROLE service_role;
DO $server$
DECLARE
 receipt jsonb; repeat_receipt jsonb; blocked boolean;
BEGIN
 receipt:=public.mobility_stage_g314_enqueue_action_qa(
  '33333333-3333-4333-8333-333333333333',
  'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'ddddddd2-dddd-4ddd-8ddd-dddddddddddd',
  'OPEN','ESCALATE_SAFETY',
  'eeeeeee6-eeee-4eee-8eee-eeeeeeeeeeee');
 repeat_receipt:=public.mobility_stage_g314_enqueue_action_qa(
  '33333333-3333-4333-8333-333333333333',
  'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'ddddddd2-dddd-4ddd-8ddd-dddddddddddd',
  'OPEN','ESCALATE_SAFETY',
  'eeeeeee6-eeee-4eee-8eee-eeeeeeeeeeee');
 IF receipt IS DISTINCT FROM repeat_receipt
   OR receipt->>'outcome'<>'QUEUED'
   OR receipt->>'action'<>'ESCALATE_SAFETY'
   OR receipt->>'ticket_id'<>'ddddddd2-dddd-4ddd-8ddd-dddddddddddd'
   OR (receipt->>'request_id')::uuid IS NULL
   OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(receipt))<>4
 THEN RAISE EXCEPTION 'G314 malformed or non-idempotent receipt'; END IF;

 -- Only 2 requests for agent B (prior G313 ACK + new G314 safety).
 IF (SELECT count(*) FROM public.mobility_stage_support_action_requests
  WHERE agent_id='33333333-3333-4333-8333-333333333333')<>2
 THEN RAISE EXCEPTION 'G314 double write occurred'; END IF;

 -- Even the trusted service role cannot violate the G313 ticket gate.
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_g314_enqueue_action_qa(
   '33333333-3333-4333-8333-333333333333',
   'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'ddddddd1-dddd-4ddd-8ddd-dddddddddddd',
   'OPEN','ACKNOWLEDGE',
   'eeeeeee7-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN SQLSTATE 'P3131' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G314 agent escaped assignment gate'; END IF;

 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_g314_enqueue_action_qa(
   '11111111-1111-4111-8111-111111111111',
   'bbbbbbb3-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'ddddddd2-dddd-4ddd-8ddd-dddddddddddd',
   'OPEN','ACKNOWLEDGE',
   'eeeeeee7-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN SQLSTATE 'P3131' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G314 Owner inherited staff privileges'; END IF;
END $server$;
RESET ROLE;

-- A suddenly revoked staff agent loses access even with previously
-- accepted JWT/session and a replay key.
UPDATE public.mobility_stage_support_agents SET status='revoked'
 WHERE user_id='33333333-3333-4333-8333-333333333333';
SET ROLE service_role;
DO $revoked$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g314_enqueue_action_qa(
   '33333333-3333-4333-8333-333333333333',
   'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'ddddddd2-dddd-4ddd-8ddd-dddddddddddd',
   'OPEN','ESCALATE_SAFETY',
   'eeeeeee6-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN SQLSTATE 'P3131' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G314 revoked agent replay succeeded'; END IF;
END $revoked$;
RESET ROLE;
\echo G314 PASS: service-only bridge, Auth AAL2 checks, 4-field receipt, revoked-role replay deny, no client EXECUTE, no money/LIVE.
