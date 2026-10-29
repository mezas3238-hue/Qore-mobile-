#!/usr/bin/env python3
"""G211 disposable PG16: both original post-ride lost-item closures return
atomic, source-verified terminal receipts. Test modifications are rolled back."""
import os
import time
import psycopg

assert os.getenv("CI") == "true"
assert os.getenv("PGHOST") == "localhost"
assert os.getenv("PGDATABASE") == "qore_disposable_chain"
assert os.getenv("PGAPPNAME") == "qore_ci_disposable_chain"

D = "10900000-0000-4109-8109-000000000022"
AUTO = ("198", "10900000-0000-4109-8109-000000000021",
        "19800000-0000-4198-8198-000000000031",
        "19800000-0000-4198-8198-000000000032", "P9803", "P9805", "P9802")
MOTO = ("200", "19900000-0000-4199-8199-000000000021",
        "20000000-0000-4200-8200-000000000001",
        "20000000-0000-4200-8200-000000000002", "P2003", "P2005", "P2002")
AT = int(time.time() * 1000)


def denied(conn, code, statement, params):
    try:
        with conn.transaction():  # Nested SAVEPOINT, preserve outer QA rollback.
            conn.execute(statement, params)
    except psycopg.Error as exc:
        assert exc.sqlstate == code, (code, exc.sqlstate, str(exc))
    else:
        raise AssertionError("G211 unauthorized/ambiguous closure was accepted")


def exercise(conn, spec):
    kind, passenger, session, driver_session, wrong_role, blocked, revoked = spec
    table = "public.mobility_stage_g" + kind + "_lost_item_cases"
    fn = "public.mobility_stage_g211_g" + kind + "_close_case_receipt_qa"
    statement = "SELECT " + fn + "(%s,%s,%s,%s,%s)"
    row = conn.execute(
        "SELECT case_id FROM " + table +
        " WHERE passenger_id=%s AND driver_id=%s AND state='BLOCKED'"
        " ORDER BY opened_at LIMIT 1", (passenger, D)
    ).fetchone()
    assert row is not None, "Original G" + kind + " completed-case fixture missing"
    case = str(row[0])
    # The original G198/G200 integration cases were intentionally BLOCKED.
    # Reopen within an outer disposable transaction ONLY; ROLLBACK below
    # restores the original audited case, no production-side mutation.
    conn.execute(
        "UPDATE " + table + " SET state='OPEN',closed_at=NULL WHERE case_id=%s",
        (case,)
    )
    stranger = MOTO if kind == "198" else AUTO
    denied(conn, wrong_role, statement,
           (case, stranger[1], stranger[2], AT, False))
    denied(conn, revoked, statement,
           (case, D, driver_session, AT, False))
    denied(conn, "P2111", statement, (case, passenger, session, AT, None))
    closed = conn.execute(
        statement, (case, passenger, session, AT, False)
    ).fetchone()[0]
    assert closed == {
        "mode": "STAGING_DEMO_ONLY", "caseId": case, "state": "CLOSED",
        "qaOnly": True, "productionEnabled": False,
    }, closed
    # Same original participant replay is safe, but cannot change a
    # previously CLOSED case to BLOCKED using another intent.
    assert conn.execute(statement, (case, passenger, session, AT, False)
                        ).fetchone()[0] == closed
    denied(conn, "P2112", statement, (case, passenger, session, AT, True))
    conn.execute(
        "UPDATE " + table + " SET state='OPEN',closed_at=NULL WHERE case_id=%s",
        (case,)
    )
    blocked_receipt = conn.execute(
        statement, (case, passenger, session, AT, True)
    ).fetchone()[0]
    assert blocked_receipt["state"] == "BLOCKED"
    assert blocked_receipt["caseId"] == case
    assert conn.execute("SELECT state FROM " + table +
                        " WHERE case_id=%s", (case,)).fetchone()[0] == "BLOCKED"
    denied(conn, blocked, statement, (case, passenger, session, AT, True))
    conn.execute("SET LOCAL ROLE anon")
    denied(conn, "42501", statement, (case, passenger, session, AT, False))
    conn.execute("RESET ROLE")


with psycopg.connect(
    host="localhost", port=os.getenv("PGPORT", "5432"),
    dbname="qore_disposable_chain", user=os.environ["PGUSER"],
    password=os.environ["PGPASSWORD"],
    options="-c application_name=qore_ci_disposable_chain",
) as connection:
    try:
        exercise(connection, AUTO)
        exercise(connection, MOTO)
        assert connection.execute(
            "SELECT state FROM public.mobility_stage_g198_lost_item_cases "
            "WHERE passenger_id=%s ORDER BY opened_at LIMIT 1",
            (AUTO[1],)
        ).fetchone()[0] == "BLOCKED"
    finally:
        connection.rollback()  # Always preserve original G198/G200 fixtures.
print("G211 PASS: original AUTO+MOTO closed/block state proofs, G42 session, "
      "foreign participant, replay and no role bypass; all test writes rolled back")
