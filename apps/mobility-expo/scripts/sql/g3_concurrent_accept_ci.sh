#!/usr/bin/env bash
# CI-only ephemeral Postgres fixture, NEVER a commercial dispatch call.
set -euo pipefail
: "$PGPASSWORD"
psql_cli() {
  psql -h localhost -p 5432 -U postgres -d qore_mobility_ci -X -qAt -v ON_ERROR_STOP=1 "$@"
}
trip_id="$(psql_cli -c "SELECT id FROM public.mobility_stage_auto_demo_trips WHERE request_key='a1000000-0000-4000-8000-000000000004' AND status='searching'")"
if [[ ! "$trip_id" =~ ^[0-9a-f-]{36}$ ]]; then
 echo "G3 synthetic pending AUTO fixture missing" >&2
 exit 1
fi
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
sql_a="SET ROLE service_role; SELECT public.mobility_stage_auto_demo_accept('$trip_id','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555','a2000000-0000-4000-8000-000000000011');"
sql_b="SET ROLE service_role; SELECT public.mobility_stage_auto_demo_accept('$trip_id','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555','a2000000-0000-4000-8000-000000000012');"
psql_cli -c "$sql_a" >"$tmpdir/a.log" 2>&1 &
pid_a=$!
psql_cli -c "$sql_b" >"$tmpdir/b.log" 2>&1 &
pid_b=$!
set +e
wait "$pid_a"; status_a=$?
wait "$pid_b"; status_b=$?
set -e
if ! { [[ "$status_a" -eq 0 && "$status_b" -ne 0 ]] ||
       [[ "$status_a" -ne 0 && "$status_b" -eq 0 ]]; }; then
 echo "FAIL: expected exactly one SQL client winner (A=$status_a, B=$status_b)" >&2
 exit 1
fi
psql_cli -c "
DO \$check\$
DECLARE trip uuid:='$trip_id'::uuid;
BEGIN
 IF (SELECT status FROM public.mobility_stage_auto_demo_trips WHERE id=trip)<>'accepted'
 OR (SELECT revision FROM public.mobility_stage_auto_demo_trips WHERE id=trip)<>2
 OR (SELECT count(*) FROM public.mobility_stage_auto_demo_events
  WHERE trip_id=trip AND next_status='accepted')<>1
 THEN RAISE EXCEPTION 'Race accepted two drivers or duplicate event'; END IF;
END \$check\$;"
echo "PASS: G3 two competing SQL clients, exactly one fictional AUTO acceptance and one audit event."
