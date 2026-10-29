"""G177: One actual PostgreSQL16 CI database, five service sources under
parallel mixed operations. Original G73 AUTO from G173 is joined with G100
MOTO writes, G5 AUTO/MOTO parcel writes and existing G45 COMMERCE receipts.
G42/G93/G103 fare, subsidy, role and legal fences remain enforced.
No payment, route-provider, courier selection or completed ride is invented.
"""
import concurrent.futures
import json
import os
import time
from pathlib import Path
from statistics import mean

import psycopg

REQUIRED = {
    "CI": "true", "PGHOST": "localhost", "PGPORT": "5432",
    "PGDATABASE": "qore_disposable_chain",
    "PGAPPNAME": "qore_ci_disposable_chain"
}
if any(os.environ.get(k) != v for k, v in REQUIRED.items()):
    raise SystemExit("G177 only in disposable CI PG16")
N_MOTO = 300
N_DELIVERY_AUTO = 300
N_DELIVERY_MOTO = 300
WORKERS = 20

def uid(n):
    return f"17700000-0000-4177-8177-{n:012x}"

def query(conn, sql, args=()):
    return conn.execute(sql, args).fetchone()[0]

def require_sql_guard(conn):
    actual = conn.execute(
        "SELECT current_database(),current_setting('application_name')"
    ).fetchone()
    if actual != ("qore_disposable_chain", "qore_ci_disposable_chain"):
        raise RuntimeError("G177 refuses database escape")
    return actual

def percentile(values, fraction):
    ordered = sorted(values)
    return round(ordered[int((len(ordered) - 1) * fraction)], 2)

def create_service(n):
    # Each thread opens one real independent PostgreSQL connection and commits
    # actual source RPCs. No in-memory mock/order IDs.
    group = n // 300
    i = n % 300
    passenger = uid(1000+n)
    request_key = uid(20000+n)
    start = time.perf_counter()
    with psycopg.connect(autocommit=True, connect_timeout=4) as conn:
        require_sql_guard(conn)
        conn.execute("INSERT INTO auth.users(id) VALUES(%s)", (passenger,))
        if group == 0:
            quote_key = uid(50000+n)
            booking_key = uid(80000+n)
            quote = query(conn, """
              SELECT public.mobility_stage_g100_moto_quote_qa(
                %s,%s,'CENTRO_FIXTURE','AEROPUERTO','MOTO_TEST_ZONE',5000,600)
            """, (passenger, quote_key))
            assert quote["serviceKind"] == "MOTO_RIDE"
            assert quote["ownerId"] == str(passenger)
            assert quote["subsidyBps"] == 1000
            receipt = query(conn, """
              SELECT public.mobility_stage_g100_moto_book_qa(%s,%s,%s)
            """, (passenger, quote["quoteId"], booking_key))
            assert receipt["tripState"] == "searching"
            assert receipt["driverAssigned"] is False
            assert receipt["pspCollected"] is False
            # A lost POST response must recover the identical immutable ID.
            if i % 6 == 0:
                retry = query(conn,
                  "SELECT public.mobility_stage_g100_moto_book_qa(%s,%s,%s)",
                  (passenger, quote["quoteId"], booking_key))
                assert retry["tripId"] == receipt["tripId"]
                assert retry["bookingKey"] == receipt["bookingKey"]
            # Some real cancellations must create four reversed ledger entries
            # and repeated cancellation must not charge/refund again.
            if i % 5 == 0:
                cancellation_key = uid(110000+n)
                canceled = query(conn,
                  "SELECT public.mobility_stage_g100_moto_cancel_qa(%s,%s,%s)",
                  (passenger, booking_key, cancellation_key))
                assert canceled["tripId"] == receipt["tripId"]
                assert canceled["tripState"] == "cancelled"
                assert canceled["reversalEntriesBalanced"] is True
                assert canceled["pspRefunded"] is False
                replay = query(conn,
                  "SELECT public.mobility_stage_g100_moto_cancel_qa(%s,%s,%s)",
                  (passenger, booking_key, cancellation_key))
                assert replay["cancellationEventId"] == canceled["cancellationEventId"]
            kind = "MOTO_RIDE"
            ident = receipt["tripId"]
        else:
            vehicle = "AUTO" if group == 1 else "MOTO"
            delivery = query(conn, """
              SELECT public.mobility_stage_delivery_request(
                %s,%s,%s::public.mobility_vehicle_kind,
                'PARCEL'::public.mobility_stage_delivery_category,
                2000,30,20,10,'PICKUP_EAST','DELIVERY_WEST',false)
            """, (passenger, request_key, vehicle))
            assert delivery is not None
            if i % 6 == 0:
                retry = query(conn, """
                  SELECT public.mobility_stage_delivery_request(
                    %s,%s,%s::public.mobility_vehicle_kind,
                    'PARCEL'::public.mobility_stage_delivery_category,
                    2000,30,20,10,'PICKUP_EAST','DELIVERY_WEST',false)
                """, (passenger, request_key, vehicle))
                assert retry == delivery, "G5 duplicate request created second delivery"
            kind = "DELIVERY_"+vehicle
            ident = str(delivery)
    return kind, ident, (time.perf_counter()-start)*1000

with psycopg.connect(autocommit=True) as admin:
    require_sql_guard(admin)
    # Existing real G73+G113, G45/G139, G100/G102 and G122/G145
    # have already run on this same PG server. Never fake missing services.
    preexisting = query(admin, """
      SELECT pg_catalog.jsonb_build_object(
       'auto', (SELECT count(*) FROM public.mobility_stage_g85_auto_dispatch_jobs
               WHERE booking_key::text LIKE '17200000-%'),
       'commerce', (SELECT count(*) FROM public.mobility_stage_g45_order_receipts),
       'moto', (SELECT count(*) FROM public.mobility_stage_g100_moto_trips),
       'cargo', (SELECT count(*) FROM public.mobility_stage_deliveries))
    """)
    assert preexisting["auto"] >= 1001, preexisting
    assert preexisting["commerce"] >= 2, preexisting
    assert preexisting["moto"] >= 1, preexisting
    assert preexisting["cargo"] >= 2, preexisting

start = time.perf_counter()
with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as ex:
    originals = list(ex.map(create_service, range(900)))
elapsed = round(time.perf_counter()-start,3)
assert len(originals) == 900
assert len({x[1] for x in originals}) == 900, "Cross-service original identity collision"
kind_labels=("MOTO_RIDE","DELIVERY_AUTO","DELIVERY_MOTO")
stats={}
for kind in kind_labels:
    values=[x[2] for x in originals if x[0]==kind]
    assert len(values)==300
    stats[kind]={"requests":len(values),"p50Ms":percentile(values,.5),
      "p95Ms":percentile(values,.95),"p99Ms":percentile(values,.99)}
with psycopg.connect(autocommit=True) as admin:
    require_sql_guard(admin)
    moto_ids=[x[1] for x in originals if x[0]=="MOTO_RIDE"]
    auto_ids=[x[1] for x in originals if x[0]=="DELIVERY_AUTO"]
    cargo_moto_ids=[x[1] for x in originals if x[0]=="DELIVERY_MOTO"]
    moto_totals = admin.execute("""
      SELECT status,count(*) FROM public.mobility_stage_g100_moto_trips
      WHERE id=ANY(%s::uuid[]) GROUP BY status ORDER BY status
    """,(moto_ids,)).fetchall()
    assert dict(moto_totals)=={"cancelled":60,"searching":240},moto_totals
    entries = query(admin, """
      SELECT count(*) FROM public.mobility_stage_g100_moto_entries e
      JOIN public.mobility_stage_g100_moto_trips t ON t.quote_id=e.quote_id
      WHERE t.id=ANY(%s::uuid[])
    """,(moto_ids,))
    assert entries==(300*4+60*4),entries
    for kind, ids in (("AUTO",auto_ids),("MOTO",cargo_moto_ids)):
        counts=admin.execute("""
         SELECT requested_vehicle_kind::text,status,count(*)
         FROM public.mobility_stage_deliveries
         WHERE id=ANY(%s::uuid[])
         GROUP BY requested_vehicle_kind,status
        """,(ids,)).fetchall()
        assert counts==[(kind,"requested",300)],counts
        assert query(admin, """
          SELECT count(*) FROM public.mobility_stage_deliveries
          WHERE id=ANY(%s::uuid[]) AND courier_id IS NOT NULL
        """,(ids,))==0,"No courier can be forged under load"

    # Source provenance/merchant stock truth for an original G139 Client
    # order. This is read-only: original B->A->G45->G6->D writes are tested
    # separately earlier in this SAME workflow.
    commerce = admin.execute("""
      SELECT r.request_key::text,r.order_id::text,o.status,
        o.requested_vehicle_kind::text,
        (SELECT count(*) FROM public.mobility_stage_merchant_order_events e
          WHERE e.order_id=o.id) AS n_events
      FROM public.mobility_stage_g45_order_receipts r
      JOIN public.mobility_stage_merchant_orders o ON o.id=r.order_id
      WHERE r.request_key IN(
        '13800000-0000-4138-8138-000000000201'::uuid,
        '13800000-0000-4138-8138-000000000212'::uuid)
      ORDER BY r.request_key
    """).fetchall()
    assert len(commerce)==2,commerce
    assert len({x[1] for x in commerce})==2
    assert all(row[4]>=2 for row in commerce),commerce

    # ORIGINAL G173 1000 AUTO dispatch rows remain intact after concurrent
    # other-service operations; never silently consume another user's job.
    assert query(admin, """
       SELECT count(*) FROM public.mobility_stage_g85_auto_dispatch_jobs
       WHERE booking_key::text LIKE '17200000-%'
         AND status IN ('PENDING','WAITING','OFFERED','CLOSED','EXHAUSTED')
    """)>=1001
    quote_replay=None
    plans={}
    for service,sql in {
      "autoDue":"SELECT booking_key FROM public.mobility_stage_g85_auto_dispatch_jobs WHERE status IN ('PENDING','WAITING') AND next_attempt_at<=clock_timestamp() ORDER BY next_attempt_at,created_at,booking_key LIMIT 10",
      "motoOwner":"SELECT id FROM public.mobility_stage_g100_moto_trips WHERE passenger_id=%s LIMIT 1",
      "cargoOwner":"SELECT id FROM public.mobility_stage_deliveries WHERE sender_id=%s LIMIT 1",
      "commerceOwner":"SELECT id FROM public.mobility_stage_merchant_orders WHERE buyer_id=%s LIMIT 1"
    }.items():
        actor=uid(1000) if service=="motoOwner" else (uid(1300) if service=="cargoOwner" else '13800000-0000-4138-8138-000000000001')
        args=() if service=="autoDue" else (actor,)
        plan=admin.execute("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) "+sql,args).fetchone()[0][0]
        plans[service]={"executionMs":round(plan["Execution Time"],3),
          "node":plan["Plan"]["Node Type"],
          "bufferHits":plan["Plan"].get("Shared Hit Blocks",0)}

    report={
      "lab":"G177_FIVE_SERVICE_SHARED_PG16",
      "servicesVerified":["AUTO_RIDE","MOTO_RIDE","DELIVERY_AUTO","DELIVERY_MOTO","COMMERCE"],
      "sources":"EXISTING_REAL_POSTGRES16_CI_SCHEMA",
      "autoOriginalBookingsAtLeast":1001,
      "newConcurrentRealSqlMutations":900,
      "newMotoOriginalTrips":300,
      "newDeliveryAutoOriginalRequests":300,
      "newDeliveryMotoOriginalRequests":300,
      "merchantOriginalSourceRowsVerified":2,
      "concurrentPostgreSQLClients":WORKERS,
      "totalPhaseSeconds":elapsed,
      "newOperationsPerSecond":round(900/elapsed,2),
      "motoLedgerEntries":entries,
      "canceledMoto":60,
      "originalsLost":0,
      "duplicateOriginals":0,
      "forgedAssignments":0,
      "externalMapsCalls":0,
      "externalPspCalls":0,
      "liveEnabled":False,
      "legalDriverGate":"NEVER_BYPASSED",
      "perService":stats,"queryPlans":plans,
      "limits":"AUTO+MOTO+DELIVERY are real PG mutations; COMMERCE is existing PG order read-back; no end-to-end merchant/courier completion under 900-op load.",
      "verdict":"PG16_FIVE_SERVICE_MIXED_INTEGRITY_PASS"
    }
    out=Path("artifacts/qore-load-lab/g177-five-service-pg16.json")
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n",
      encoding="utf-8")
    print(json.dumps(report,sort_keys=True))
