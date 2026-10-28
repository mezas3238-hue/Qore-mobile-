#!/usr/bin/env bash
# Ephemeral PostgreSQL CI ONLY: two private couriers race for one delivery.
set -euo pipefail
: "$PGPASSWORD"
psql_cli() { psql -h localhost -p 5432 -U postgres -d qore_mobility_ci -X -qAt -v ON_ERROR_STOP=1 "$@"; }
delivery_id="$(psql_cli -c "SELECT id FROM public.mobility_stage_deliveries WHERE request_key='a1000000-0000-4000-8000-000000000002' AND status='requested'")"
offer_a="$(psql_cli -c "SELECT id FROM public.mobility_stage_delivery_offers WHERE request_key='a2000000-0000-4000-8000-000000000003' AND status='offered'")"
offer_b="$(psql_cli -c "SELECT id FROM public.mobility_stage_delivery_offers WHERE request_key='a2000000-0000-4000-8000-000000000004' AND status='offered'")"
if [[ ! "$delivery_id" =~ ^[0-9a-f-]{36}$ || ! "$offer_a" =~ ^[0-9a-f-]{36}$ || ! "$offer_b" =~ ^[0-9a-f-]{36}$ ]]; then
 echo "G10 private delivery race fixtures missing" >&2
 exit 1
fi
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
a="SET ROLE service_role; SELECT public.mobility_stage_delivery_accept_offer('$offer_a','11111111-1111-4111-8111-111111111111','a4000000-0000-4000-8000-000000000001');"
b="SET ROLE service_role; SELECT public.mobility_stage_delivery_accept_offer('$offer_b','44444444-4444-4444-8444-444444444444','a4000000-0000-4000-8000-000000000002');"
psql_cli -c "$a" >"$tmpdir/a.out" 2>&1 & pid_a=$!
psql_cli -c "$b" >"$tmpdir/b.out" 2>&1 & pid_b=$!
set +e
wait "$pid_a"; result_a=$?
wait "$pid_b"; result_b=$?
set -e
if ! { [[ "$result_a" -eq 0 && "$result_b" -ne 0 ]] ||
       [[ "$result_a" -ne 0 && "$result_b" -eq 0 ]]; }; then
 echo "FAIL: G10 delivery offer race expected exactly one winner" >&2
 exit 1
fi
psql_cli -c "
DO \$check\$
DECLARE d uuid:='$delivery_id'::uuid;
BEGIN
 IF (SELECT status FROM public.mobility_stage_deliveries WHERE id=d)<>'accepted'
 OR (SELECT revision FROM public.mobility_stage_deliveries WHERE id=d)<>2
 OR (SELECT count(*) FROM public.mobility_stage_delivery_events
     WHERE delivery_id=d AND next_status='accepted')<>1
 OR (SELECT count(*) FROM public.mobility_stage_delivery_offers
     WHERE delivery_id=d AND status='accepted')<>1
 OR (SELECT count(*) FROM public.mobility_stage_delivery_offers
     WHERE delivery_id=d AND status='withdrawn')<>1
 THEN RAISE EXCEPTION 'G10 delivery winner, loser or event state inconsistent'; END IF;
END \$check\$;"
echo "PASS: G10 two private courier offers, one SQL winner, one event and loser withdrawn."
