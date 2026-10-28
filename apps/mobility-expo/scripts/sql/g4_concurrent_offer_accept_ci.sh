#!/usr/bin/env bash
# Ephemeral CI PostgreSQL ONLY: different driver offers race for same fictitious AUTO trip.
set -euo pipefail
: "$PGPASSWORD"
psql_cli() { psql -h localhost -p 5432 -U postgres -d qore_mobility_ci -X -qAt -v ON_ERROR_STOP=1 "$@"; }
trip_id="$(psql_cli -c "SELECT id FROM public.mobility_stage_auto_demo_trips WHERE request_key='e1000000-0000-4000-8000-000000000010' AND status='searching'")"
offer_a="$(psql_cli -c "SELECT id FROM public.mobility_stage_auto_demo_offers WHERE request_key='e1000000-0000-4000-8000-000000000011' AND status='offered'")"
offer_b="$(psql_cli -c "SELECT id FROM public.mobility_stage_auto_demo_offers WHERE request_key='e1000000-0000-4000-8000-000000000012' AND status='offered'")"
if [[ ! "$trip_id" =~ ^[0-9a-f-]{36}$ || ! "$offer_a" =~ ^[0-9a-f-]{36}$ || ! "$offer_b" =~ ^[0-9a-f-]{36}$ ]]; then
 echo "G4 synthetic offer race fixtures missing" >&2
 exit 1
fi
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
a="SET ROLE service_role; SELECT public.mobility_stage_auto_demo_accept_offer('$offer_a','11111111-1111-4111-8111-111111111111','e2000000-0000-4000-8000-000000000011');"
b="SET ROLE service_role; SELECT public.mobility_stage_auto_demo_accept_offer('$offer_b','44444444-4444-4444-8444-444444444444','e2000000-0000-4000-8000-000000000012');"
psql_cli -c "$a" >"$tmpdir/a.out" 2>&1 & pid_a=$!
psql_cli -c "$b" >"$tmpdir/b.out" 2>&1 & pid_b=$!
set +e
wait "$pid_a"; result_a=$?
wait "$pid_b"; result_b=$?
set -e
if ! { [[ "$result_a" -eq 0 && "$result_b" -ne 0 ]] ||
       [[ "$result_a" -ne 0 && "$result_b" -eq 0 ]]; }; then
 echo "FAIL: G4 private offer race expected exactly one winner" >&2
 exit 1
fi
psql_cli -c "
DO \$check\$
DECLARE t uuid:='$trip_id'::uuid;
BEGIN
 IF (SELECT status FROM public.mobility_stage_auto_demo_trips WHERE id=t)<>'accepted'
 OR (SELECT revision FROM public.mobility_stage_auto_demo_trips WHERE id=t)<>2
 OR (SELECT count(*) FROM public.mobility_stage_auto_demo_events
      WHERE trip_id=t AND next_status='accepted')<>1
 OR (SELECT count(*) FROM public.mobility_stage_auto_demo_offers
      WHERE trip_id=t AND status='accepted')<>1
 OR (SELECT count(*) FROM public.mobility_stage_auto_demo_offers
      WHERE trip_id=t AND status='withdrawn')<>1
 THEN RAISE EXCEPTION 'G4 winner, loser and event state inconsistent'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_trips
    WHERE id=t AND (
      (driver_id='11111111-1111-4111-8111-111111111111'
         AND vehicle_id='55555555-5555-4555-8555-555555555555')
     OR (driver_id='44444444-4444-4444-8444-444444444444'
         AND vehicle_id='77777777-7777-4777-8777-777777777777')))
 THEN RAISE EXCEPTION 'Driver/vehicle mismatch in winning private offer'; END IF;
END \$check\$;"
echo "PASS: G4 two private offers, distinct drivers, one SQL acceptance and one event; loser withdrawn."
