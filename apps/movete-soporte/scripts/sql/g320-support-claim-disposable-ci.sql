\set ON_ERROR_STOP on
-- G320 SQL acceptance on disposable PG16 (never real Supabase).
\ir g314-support-edge-disposable-ci.sql

-- Undo synthetic revocation in G314 for two test agents and a valid Owner.
UPDATE public.mobility_stage_support_agents SET status='active'
 WHERE user_id IN (
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333');
UPDATE public.mobility_stage_backoffice_roles SET status='active'
 WHERE user_id='11111111-1111-4111-8111-111111111111';
UPDATE auth.sessions SET not_after=now()+interval '1 hour'
 WHERE id IN ('bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

INSERT INTO public.mobility_stage_support_cases
(ticket_id,case_code,requester_user_id,assigned_support_id,category,summary,status,priority)
VALUES
('ddddddd4-dddd-4ddd-8ddd-dddddddddddd','MF-2026-004',
 '44444444-4444-4444-8444-444444444444',
 NULL,'CUENTA','Cuenta de prueba sin asignar','OPEN','NORMAL'),
('ddddddd5-dddd-4ddd-8ddd-dddddddddddd','MF-2026-005',
 '44444444-4444-4444-8444-444444444444',
 NULL,'OTRO','Alerta crítica debe escalarse','OPEN','CRITICAL');
\ir ../../sql/g320-support-atomic-claim-draft.sql

DO $permissions$ BEGIN
 IF has_table_privilege('authenticated','public.mobility_stage_support_claim_events','SELECT')
 OR has_table_privilege('authenticated','public.mobility_stage_support_claim_events','INSERT')
 OR has_table_privilege('anon','public.mobility_stage_support_claim_events','SELECT')
 OR has_table_privilege('service_role','public.mobility_stage_support_claim_events','UPDATE')
 OR has_table_privilege('service_role','public.mobility_stage_support_claim_events','DELETE')
 OR has_function_privilege('authenticated',
   'public.mobility_stage_g320_claim_ticket_qa(uuid,uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('anon',
   'public.mobility_stage_g320_claim_ticket_qa(uuid,uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
   'qore_support_private.mobility_stage_g320_claim_qa(uuid,uuid,uuid,uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role',
   'public.mobility_stage_g320_claim_ticket_qa(uuid,uuid,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G320 permission leak'; END IF;
END $permissions$;

SET ROLE authenticated;
DO $browser$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g320_claim_ticket_qa(
   '22222222-2222-4222-8222-222222222222',
   'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'ddddddd3-dddd-4ddd-8ddd-dddddddddddd',
   'eeeeeee8-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G320 browser called privileged claim'; END IF;
END $browser$;
RESET ROLE;

SET ROLE service_role;
DO $claim$
DECLARE
 receipt jsonb; again jsonb; rejected boolean; count_claims int;
BEGIN
 receipt:=public.mobility_stage_g320_claim_ticket_qa(
  '22222222-2222-4222-8222-222222222222',
  'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'ddddddd3-dddd-4ddd-8ddd-dddddddddddd',
  'eeeeeee8-eeee-4eee-8eee-eeeeeeeeeeee');
 again:=public.mobility_stage_g320_claim_ticket_qa(
  '22222222-2222-4222-8222-222222222222',
  'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'ddddddd3-dddd-4ddd-8ddd-dddddddddddd',
  'eeeeeee8-eeee-4eee-8eee-eeeeeeeeeeee');
 IF receipt IS DISTINCT FROM again OR receipt->>'outcome'<>'CLAIMED'
   OR (SELECT COUNT(*) FROM pg_catalog.jsonb_object_keys(receipt))<>3
 THEN RAISE EXCEPTION 'G320 idempotent claim or receipt failed'; END IF;
 SELECT count(*) INTO count_claims
 FROM public.mobility_stage_support_claim_events
 WHERE ticket_id='ddddddd3-dddd-4ddd-8ddd-dddddddddddd';
 IF count_claims<>1 THEN RAISE EXCEPTION 'G320 duplicate claim event'; END IF;

 -- A second agent cannot acquire an already claimed case.
 rejected:=false;
 BEGIN
 PERFORM public.mobility_stage_g320_claim_ticket_qa(
  '33333333-3333-4333-8333-333333333333',
  'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'ddddddd3-dddd-4ddd-8ddd-dddddddddddd',
  'eeeeeee9-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN SQLSTATE 'P3201' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G320 cross-agent double claim'; END IF;

 -- Same agent cannot mint a fresh event with a changed key.
 rejected:=false;
 BEGIN
 PERFORM public.mobility_stage_g320_claim_ticket_qa(
  '22222222-2222-4222-8222-222222222222',
  'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'ddddddd3-dddd-4ddd-8ddd-dddddddddddd',
  'eeeee001-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN SQLSTATE 'P3202' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G320 duplicate claim different key'; END IF;

 rejected:=false;
 BEGIN
 PERFORM public.mobility_stage_g320_claim_ticket_qa(
  '33333333-3333-4333-8333-333333333333',
  'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'ddddddd5-dddd-4ddd-8ddd-dddddddddddd',
  'eeeee002-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN SQLSTATE 'P3201' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G320 critical case could be claimed'; END IF;

 rejected:=false;
 BEGIN
 PERFORM public.mobility_stage_g320_claim_ticket_qa(
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbb3-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'ddddddd4-dddd-4ddd-8ddd-dddddddddddd',
  'eeeee003-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN SQLSTATE 'P3201' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G320 Owner inherited Support'; END IF;
END $claim$;
RESET ROLE;

DO $assert$
BEGIN
 IF (SELECT assigned_support_id FROM public.mobility_stage_support_cases
    WHERE ticket_id='ddddddd3-dddd-4ddd-8ddd-dddddddddddd')
    IS DISTINCT FROM '22222222-2222-4222-8222-222222222222'::uuid
 OR (SELECT assigned_support_id FROM public.mobility_stage_support_cases
    WHERE ticket_id='ddddddd4-dddd-4ddd-8ddd-dddddddddddd') IS NOT NULL
 OR (SELECT assigned_support_id FROM public.mobility_stage_support_cases
    WHERE ticket_id='ddddddd5-dddd-4ddd-8ddd-dddddddddddd') IS NOT NULL
 OR (SELECT COUNT(*) FROM public.mobility_stage_support_claim_events)<>1
 THEN RAISE EXCEPTION 'G320 assignment/audit mismatch'; END IF;
END $assert$;

-- AAL1 and expired sessions cannot claim; live server state wins.
UPDATE auth.sessions SET aal='aal1'
 WHERE id='bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
SET ROLE service_role;
DO $aal1$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
 PERFORM public.mobility_stage_g320_claim_ticket_qa(
  '33333333-3333-4333-8333-333333333333',
  'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'ddddddd4-dddd-4ddd-8ddd-dddddddddddd',
  'eeeee004-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN SQLSTATE 'P3201' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G320 AAL1 claim allowed'; END IF;
END $aal1$;
RESET ROLE;
UPDATE auth.sessions SET aal='aal2',not_after=now()-interval '1 second'
 WHERE id='bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
SET ROLE service_role;
DO $expired$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
 PERFORM public.mobility_stage_g320_claim_ticket_qa(
  '33333333-3333-4333-8333-333333333333',
  'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'ddddddd4-dddd-4ddd-8ddd-dddddddddddd',
  'eeeee004-eeee-4eee-8eee-eeeeeeeeeeee');
 EXCEPTION WHEN SQLSTATE 'P3201' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G320 expired session claim allowed'; END IF;
END $expired$;
RESET ROLE;

\echo G320 PASS: private atomic claim, AAL2, Owner deny, critical deny, event uniqueness, retry idempotency, no client rights, no LIVE.
