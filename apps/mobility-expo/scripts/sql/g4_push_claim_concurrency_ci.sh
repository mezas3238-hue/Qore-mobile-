#!/usr/bin/env bash
# Disposable Postgres CI ONLY. Two independent workers race one fictional offer.
set -euo pipefail
: "$PGPASSWORD"
pg() { psql -h localhost -p 5432 -U postgres -d qore_mobility_ci -X -qAt -v ON_ERROR_STOP=1 "$@"; }
offer="$(pg -c "SELECT id FROM public.mobility_stage_auto_demo_offers WHERE request_key='f1000000-0000-4000-8000-000000000006'")"
if [[ ! "$offer" =~ ^[0-9a-f-]{36}$ ]];then echo "Missing G4 push fixture" >&2;exit 1;fi
w1='f3000000-0000-4000-8000-000000000001'
w2='f3000000-0000-4000-8000-000000000002'
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
pg -c "SET ROLE service_role; SELECT COALESCE((SELECT offer_id::text FROM public.mobility_stage_claim_auto_demo_push('$w1')),'NONE')" > "$tmp/one" 2>&1 &
p1=$!
pg -c "SET ROLE service_role; SELECT COALESCE((SELECT offer_id::text FROM public.mobility_stage_claim_auto_demo_push('$w2')),'NONE')" > "$tmp/two" 2>&1 &
p2=$!
wait "$p1"
wait "$p2"
a="$(cat "$tmp/one")"; b="$(cat "$tmp/two")"
if ! { [[ "$a" == "$offer" && "$b" == "NONE" ]] || [[ "$b" == "$offer" && "$a" == "NONE" ]];};then
 echo "FAIL: two workers claimed same offer or neither claimed" >&2
 exit 1
fi
winner="$w1"
if [[ "$b" == "$offer" ]];then winner="$w2";fi
pg -c "
DO \$check\$
BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_auto_demo_push_outbox
      WHERE offer_id='$offer'::uuid AND claimed_at IS NOT NULL
       AND claimed_by='$winner'::uuid AND accepted_for_processing_at IS NULL)<>1
 THEN RAISE EXCEPTION 'Private outbox race produced wrong claimed-by audit'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_auto_demo_push_outbox
      WHERE offer_id='$offer'::uuid)<>1
 THEN RAISE EXCEPTION 'A claimed offer duplicated queue entries'; END IF;
END \$check\$;"
echo "PASS: G4 private push outbox two concurrent SQL workers, exactly one claim and no duplicate."
