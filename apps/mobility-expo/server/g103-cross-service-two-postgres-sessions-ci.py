#!/usr/bin/env python3
"""G103 QA only: two actual PostgreSQL transactions race to book AUTO or
MOTO for the same Passenger, then prove the losing service can book after
the winning trip is canceled. No remote DB or commercial provider."""
import concurrent.futures
import json
import os
import re
import subprocess
import threading
import time

assert os.environ.get("PGDATABASE") == "qore_disposable_chain"
assert os.environ.get("PGHOST") == "localhost"
assert os.environ.get("PGAPPNAME") == "qore_ci_disposable_chain"
assert re.fullmatch(r"[0-9]{4,5}", os.environ.get("PGPORT", ""))
UID = re.compile(r"^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$", re.I)
OWNER = "10310000-0000-4103-8103-000000000002"
CAMPAIGN = "10310000-0000-4103-8103-000000000020"


def uid(n):
    return f"10310000-0000-4103-8103-{n:012d}"


def query(statement, *, okay=True):
    result = subprocess.run(
        ["psql", "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-c", statement],
        encoding="utf-8", capture_output=True, timeout=20, check=False,
    )
    if okay and result.returncode:
        raise AssertionError(f"PostgreSQL QA failed: {result.stderr[:650]}")
    return result


def result_text(statement):
    lines = query(statement).stdout.strip().splitlines()
    return lines[-1].strip() if lines else ""


def service_expr(expr):
    return result_text("SET ROLE service_role; SELECT " + expr + ";")


def sql_uuid(s):
    assert UID.fullmatch(s), f"Invalid PG UUID {s!r}"
    return "'" + s + "'"


def seed():
    users = [OWNER, uid(1), uid(2)]
    assert result_text("SELECT (current_database()='qore_disposable_chain' "
                       "AND current_setting('application_name')="
                       "'qore_ci_disposable_chain')::text;") == "true"
    query("INSERT INTO auth.users(id) VALUES " +
          ",".join("(" + sql_uuid(user) + ")" for user in users) + ";"
          "DELETE FROM public.user_roles WHERE user_id=" + sql_uuid(OWNER) + ";"
          "INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)"
          " VALUES(" + sql_uuid(OWNER) + ",'owner','active'," + sql_uuid(OWNER) + ");"
          "UPDATE public.mobility_stage_g93_ride_campaigns SET active=false "
          "WHERE service_kind='MOTO_RIDE' AND active;"
          "INSERT INTO public.mobility_stage_fare_rules"
          "(rule_key,mode,zone_tag,base_pyg,per_km_pyg,per_minute_pyg,"
          "minimum_pyg,commission_bps,valid_from,valid_until,active,approved_by,approved_at)"
          " VALUES('G103_RACE_FARE','MOTO','MOTO_RACE_ZONE',4000,1000,200,4000,1200,"
          "clock_timestamp()-interval '1 hour',clock_timestamp()+interval '60 days',"
          "true," + sql_uuid(OWNER) + ",clock_timestamp()-interval '2 hours');"
          "INSERT INTO public.mobility_stage_g93_ride_campaigns"
          "(id,service_kind,rule_version,approved_by,active,begins_at,ends_at,duration_days)"
          " VALUES(" + sql_uuid(CAMPAIGN) + ",'MOTO_RIDE','G103_RACE_60D_QA'," +
          sql_uuid(OWNER) + ",true,transaction_timestamp()-interval '1 hour',"
          "transaction_timestamp()-interval '1 hour'+interval '60 days',60);")


def prepare(i):
    passenger = uid(i)
    auto_route_key = uid(100 + i * 10 + 1)
    auto_quote_key = uid(100 + i * 10 + 2)
    auto_booking_key = uid(100 + i * 10 + 3)
    moto_quote_key = uid(200 + i * 10 + 1)
    moto_booking_key = uid(200 + i * 10 + 2)
    route = service_expr(
        "public.mobility_stage_g73_route("
        + sql_uuid(passenger) + "," + sql_uuid(auto_route_key) +
        ",'economico','CENTRO_FIXTURE','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0)")
    assert UID.fullmatch(route)
    auto_quote = service_expr(
        "public.mobility_stage_g73_quote(" + sql_uuid(passenger) + "," +
        sql_uuid(route) + "," + sql_uuid(auto_quote_key) + ")")
    assert UID.fullmatch(auto_quote)
    moto = json.loads(service_expr(
        "public.mobility_stage_g100_moto_quote_qa("
        + sql_uuid(passenger) + "," + sql_uuid(moto_quote_key) +
        ",'CENTRO_FIXTURE','AEROPUERTO','MOTO_RACE_ZONE',5000,600)"))
    assert moto["commissionBps"] == 1200 and moto["subsidyBps"] == 1000
    return {
        "actor": passenger, "auto_quote": auto_quote,
        "auto_booking": auto_booking_key,
        "moto_quote": moto["quoteId"], "moto_booking": moto_booking_key
    }


def book(kind, a, *, pause=0):
    if pause:
        time.sleep(pause)
    actor = sql_uuid(a["actor"])
    if kind == "AUTO":
        expr = ("public.mobility_stage_g73_book(" + actor + "," +
                sql_uuid(a["auto_quote"]) + "," +
                sql_uuid(a["auto_booking"]) + ")")
    else:
        expr = ("public.mobility_stage_g100_moto_book_qa(" + actor + "," +
                sql_uuid(a["moto_quote"]) + "," +
                sql_uuid(a["moto_booking"]) + ")")
    # SELECT pg_sleep(0.3) keeps the successful transaction open, so the
    # concurrent INSERT must wait for the shared auth.users lock to release.
    return query("BEGIN; SET LOCAL ROLE service_role; SELECT " + expr +
                 "::text; SELECT pg_sleep(0.3); COMMIT;", okay=False)


def active_counts(passenger):
    return tuple(map(int, result_text(
        "SELECT (SELECT count(*) FROM public.mobility_stage_auto_demo_trips "
        "WHERE passenger_id=" + sql_uuid(passenger) +
        " AND status IN ('searching','accepted','arriving','in_progress'))::text"
        " || ',' || (SELECT count(*) FROM public.mobility_stage_g100_moto_trips "
        "WHERE passenger_id=" + sql_uuid(passenger) + " AND status='searching')::text"
    ).split(",")))


def cancel_winner(kind, a):
    if kind == "AUTO":
        result = json.loads(service_expr(
            "public.mobility_stage_g95_cancel_booked_auto_qa(" +
            sql_uuid(a["actor"]) + "," + sql_uuid(a["auto_booking"]) +
            "," + sql_uuid(uid(300 + int(a["actor"][-1]))) + ")"))
        assert result["tripState"] == "cancelled"
    else:
        result = json.loads(service_expr(
            "public.mobility_stage_g100_moto_cancel_qa(" +
            sql_uuid(a["actor"]) + "," + sql_uuid(a["moto_booking"]) +
            "," + sql_uuid(uid(400 + int(a["actor"][-1]))) + ")"))
        assert result["tripState"] == "cancelled"
        assert result["financialState"] == "VOIDED_QA"
        assert result["reversalEntriesBalanced"] is True


def race(i, favored):
    a = prepare(i)
    start = threading.Barrier(2)
    def contender(kind):
        start.wait(timeout=5)
        return book(kind, a, pause=0 if kind == favored else 0.045)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        fs = {kind: pool.submit(contender, kind) for kind in ["AUTO", "MOTO"]}
        out = {kind: future.result(timeout=20) for kind, future in fs.items()}
    winners = [k for k, result in out.items() if result.returncode == 0]
    assert len(winners) == 1, {
        k: (v.returncode, v.stderr[-700:]) for k, v in out.items()
    }
    winner = winners[0]
    loser = "MOTO" if winner == "AUTO" else "AUTO"
    assert "G103" in out[loser].stderr or "G100 not eligible" in out[loser].stderr, \
        out[loser].stderr[-800:]
    assert sum(active_counts(a["actor"])) == 1, active_counts(a["actor"])
    assert (active_counts(a["actor"]) == (1, 0)) == (winner == "AUTO")
    cancel_winner(winner, a)
    assert active_counts(a["actor"]) == (0, 0)
    retry = book(loser, a)
    assert retry.returncode == 0, retry.stderr[-850:]
    assert sum(active_counts(a["actor"])) == 1
    print(f"G103 race {i} PASS: favored={favored}, winner={winner}, "
          f"loser={loser} denied; canceled then {loser} booked")


seed()
race(1, "AUTO")
race(2, "MOTO")
print("G103 PASS: two real PG16 cross-service booking races, one active "
      "passenger ride, recovery after cancellation; no false Driver/PSP")
