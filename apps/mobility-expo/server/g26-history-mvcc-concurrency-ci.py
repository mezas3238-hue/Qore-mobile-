#!/usr/bin/env python3
"""G26.5 MVCC regression: two real sessions, no remote DB or live data.

The current keyset+wall-clock anchor is *eventually consistent*, not an
exported PostgreSQL snapshot. Demonstrate both possible delayed-commit cases:
(1) an old transaction appears on page 2; (2) a later transaction was ahead
of the cursor and is found only when the client refreshes from page 1.

This test intentionally keeps the invariant of UNBOUNDED total history, with
50 rows PER PAGE. It must not be interpreted as a strong-snapshot guarantee.
"""
import os
import time
from uuid import uuid4

import psycopg

OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
EXPECTED = {
    "PGHOST": "localhost",
    "PGDATABASE": "qore_disposable_chain",
    "PGAPPNAME": "qore_ci_disposable_chain",
}

SQL_PAGE = """
SELECT created_at, id, kind FROM (
 SELECT created_at, id, 'RIDE'::text AS kind
 FROM public.mobility_stage_auto_demo_trips WHERE passenger_id = %s::uuid
 UNION ALL
 SELECT created_at, id, 'DELIVERY'::text AS kind
 FROM public.mobility_stage_deliveries WHERE sender_id = %s::uuid
 UNION ALL
 SELECT created_at, id, 'MERCHANT_ORDER'::text AS kind
 FROM public.mobility_stage_merchant_orders WHERE buyer_id = %s::uuid
) owned
WHERE created_at <= %s::timestamptz
"""
SQL_ORDER = " ORDER BY created_at DESC, id DESC, kind DESC LIMIT 50"
SQL_INSERT = """
INSERT INTO public.mobility_stage_auto_demo_trips
(id,request_key,passenger_id,service,origin_tag,destination_tag,status)
VALUES (%s::uuid,%s::uuid,%s::uuid,'economico','PANTEON','SHOPPING','cancelled')
RETURNING created_at
"""


def safe_connect():
    connection = psycopg.connect(autocommit=True, connect_timeout=5)
    with connection.cursor() as cur:
        cur.execute("SELECT current_database(), current_setting('application_name'), current_setting('transaction_isolation')")
        database, app_name, isolation = cur.fetchone()
    assert (database, app_name, isolation) == (
        "qore_disposable_chain", "qore_ci_disposable_chain", "read committed"
    ), "G26.5 refuses non-disposable or non-READ-COMMITTED DB"
    return connection


def add_ride(connection):
    ride_id, request_id = str(uuid4()), str(uuid4())
    with connection.cursor() as cur:
        cur.execute(SQL_INSERT, (ride_id, request_id, OWNER))
        created_at = cur.fetchone()[0]
    return ride_id, created_at


def server_clock(connection):
    with connection.cursor() as cur:
        cur.execute("SELECT clock_timestamp()")
        return cur.fetchone()[0]


def page(connection, anchor, after=None):
    sql = SQL_PAGE
    params = [OWNER, OWNER, OWNER, anchor]
    if after is not None:
        sql += " AND (created_at,id,kind) < (%s::timestamptz,%s::uuid,%s::text)"
        params.extend(after)
    with connection.cursor() as cur:
        cur.execute(sql + SQL_ORDER, params)
        return cur.fetchall()


def present(connection, ride_id):
    with connection.cursor() as cur:
        cur.execute(
            "SELECT EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_trips WHERE id=%s::uuid)",
            (ride_id,),
        )
        return cur.fetchone()[0]


def ids(rows):
    return {str(row[1]) for row in rows}


def insert_batch(connection, count=55):
    with connection.transaction():
        return [add_ride(connection)[0] for _ in range(count)]


def run():
    if any(os.environ.get(k) != v for k, v in EXPECTED.items()):
        raise SystemExit("G26.5 must run ONLY on isolated disposable localhost CI")
    with safe_connect() as read, safe_connect() as committed, safe_connect() as delayed:
        # CASE 1: TX A began before a later batch; its timestamp sorts below
        # the batch. After page 1, A commits and becomes visible on page 2.
        with delayed.transaction():
            low_id, low_time = add_ride(delayed)
            time.sleep(0.03)
            committed_ids = insert_batch(committed)
            anchor = server_clock(read)
            first = page(read, anchor)
            assert len(first) == 50 and ids(first) <= set(committed_ids)
            assert not present(read, low_id)
        assert present(read, low_id)
        second = page(read, anchor, first[-1])
        assert len(second) == 50 and low_id in ids(second), (
            "Expected late-commit phantom behind keyset, not snapshot isolation"
        )
        assert low_time < first[-1][0]
        assert ids(first).isdisjoint(ids(second))
        print("G26.5 CASE 1: late commit becomes visible on page 2 (documented eventual consistency)")

        # CASE 2: a late TX begins after 55 visible rows are committed.
        # Its creation timestamp is newer than page 1's final cursor. Once
        # committed it cannot be returned by any continuation below cursor.
        current_ids = insert_batch(committed)
        with delayed.transaction():
            high_id, high_time = add_ride(delayed)
            time.sleep(0.03)
            anchor2 = server_clock(read)
            first2 = page(read, anchor2)
            assert len(first2) == 50 and ids(first2) <= set(current_ids)
            assert not present(read, high_id)
        second2 = page(read, anchor2, first2[-1])
        assert high_id not in ids(second2)
        assert high_time > first2[-1][0]
        refreshed = page(read, anchor2)
        assert high_id in ids(refreshed), (
            "Refresh from first page must recover late-commit row"
        )
        assert ids(first2).isdisjoint(ids(second2))
        print("G26.5 CASE 2: late commit ahead of cursor needs fresh first-page traversal")
        print("G26.5 RESULT: no global row cap, no strong MVCC snapshot claim; refresh policy required")


if __name__ == "__main__":
    run()
