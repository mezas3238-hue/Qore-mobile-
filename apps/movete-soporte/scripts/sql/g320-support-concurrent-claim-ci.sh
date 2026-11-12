#!/usr/bin/env bash
# G320: actual concurrent claims against disposable Postgres16 container.
# Run only AFTER g320-support-claim-disposable-ci.sql installs fixtures.
set -euo pipefail
psql -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
UPDATE auth.sessions SET not_after=now()+interval '1 hour',aal='aal2'
 WHERE id IN ('bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
UPDATE public.mobility_stage_support_agents SET status='active'
 WHERE user_id IN (
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333');
SQL
winner_log=$(mktemp)
loser_log=$(mktemp)
trap 'rm -f "$winner_log" "$loser_log"' EXIT
# The first actor will hold the ticket FOR UPDATE lock until COMMIT,
# forcing the other transaction to contend with the same ticket row.
psql -X -qAt -v ON_ERROR_STOP=1 >"$winner_log" 2>&1 <<'SQL' &
BEGIN;
SET ROLE service_role;
SELECT public.mobility_stage_g320_claim_ticket_qa(
 '33333333-3333-4333-8333-333333333333',
 'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'ddddddd4-dddd-4ddd-8ddd-dddddddddddd',
 'eeeee005-eeee-4eee-8eee-eeeeeeeeeeee');
SELECT pg_sleep(2);
COMMIT;
SQL
winner_pid=$!
sleep .35
set +e
psql -X -qAt -v ON_ERROR_STOP=1 >"$loser_log" 2>&1 <<'SQL'
BEGIN;
SET ROLE service_role;
SELECT public.mobility_stage_g320_claim_ticket_qa(
 '22222222-2222-4222-8222-222222222222',
 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'ddddddd4-dddd-4ddd-8ddd-dddddddddddd',
 'eeeee006-eeee-4eee-8eee-eeeeeeeeeeee');
COMMIT;
SQL
loser_code=$?
wait "$winner_pid"
winner_code=$?
set -e
if [[ "$winner_code" -ne 0 || "$loser_code" -eq 0 ]]; then
 echo 'G320 concurrent claim failed: expected first success, second denied'
 exit 1
fi
# Do not expose SQL text from untrusted exceptions in UI/logs.
grep -q 'G320 access denied' "$loser_log" || {
 echo 'G320 second contender was not denied by ticket assignment gate'
 exit 1
}
psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $assert$
BEGIN
 IF (SELECT COUNT(*) FROM public.mobility_stage_support_claim_events
      WHERE ticket_id='ddddddd4-dddd-4ddd-8ddd-dddddddddddd')<>1
 OR (SELECT assigned_support_id FROM public.mobility_stage_support_cases
      WHERE ticket_id='ddddddd4-dddd-4ddd-8ddd-dddddddddddd')
    IS DISTINCT FROM '33333333-3333-4333-8333-333333333333'::uuid
 THEN RAISE EXCEPTION 'G320 two agents won same ticket'; END IF;
END $assert$;
SQL
echo 'G320 CONCURRENT PASS: competing agents, one winner, exactly one immutable audit event.'
