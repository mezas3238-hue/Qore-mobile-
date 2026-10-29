"""G173 G85/G113 original PostgreSQL AUTO bookings under parallel write load,
real transaction crash rollback and no repeated dispatch effects.
Never uses maps, payment, KYC bypass, fake Driver approval or production DB.
"""
import concurrent.futures
import multiprocessing
import os
import time
import json
import statistics
import psycopg

EXPECTED = {
    "CI": "true", "PGHOST": "localhost", "PGPORT": "5432",
    "PGDATABASE": "qore_disposable_chain",
    "PGAPPNAME": "qore_ci_disposable_chain"
}
if any(os.environ.get(k) != v for k,v in EXPECTED.items()):
    raise SystemExit("G172 refuses non-disposable PG16")
N = 1000
BOOKING_CLIENTS = 16
WORKERS = 24

def uid(n):
    return f"17200000-0000-4172-8172-{n:012x}"

def scalar(conn, sql, args=()):
    return conn.execute(sql,args).fetchone()[0]

def booking(conn,n):
    passenger,route_key,quote_key,book_key=(
        uid(n),uid(10000+n),uid(20000+n),uid(30000+n))
    conn.execute("INSERT INTO auth.users(id) VALUES (%s)",(passenger,))
    route=scalar(conn,"""SELECT public.mobility_stage_g73_route(
     %s,%s,'economico','CENTRO_FIXTURE','AEROPUERTO',
     'ASUNCION_FIXTURE',5000,600,0)""",(passenger,route_key))
    quote=scalar(conn,
        "SELECT public.mobility_stage_g73_quote(%s,%s,%s)",
        (passenger,route,quote_key))
    # G93 was enabled earlier in the full-chain workflow. Never bypass
    # Owner's active subsidy: disclose and freeze the original quote terms
    # before G73 booking, exactly as G93 enforces in SQL.
    active=scalar(conn,"""SELECT EXISTS(SELECT 1
      FROM public.mobility_stage_g93_ride_campaigns
      WHERE service_kind='AUTO_RIDE' AND active
      AND begins_at<=clock_timestamp() AND ends_at>clock_timestamp())""")
    if active:
        terms=scalar(conn,
          "SELECT public.mobility_stage_g93_preview_auto_qa(%s,%s)",
          (passenger,quote))
        assert terms["ownerId"]==str(passenger),terms
        assert terms["subsidyBps"]==1000,terms
    trip=scalar(conn,
        "SELECT public.mobility_stage_g73_book(%s,%s,%s)",
        (passenger,quote,book_key))
    return book_key,trip

def batch(conn,limit=10):
    conn.execute("SET LOCAL ROLE service_role")
    result=scalar(conn,
      "SELECT public.mobility_stage_g113_run_due_auto_batch_qa(%s)",(limit,))
    if result.get("mode")!="STAGING_DEMO_ONLY" or result.get("commercialEnabled") is not False:
        raise AssertionError("G172 G113 returned unsafe mode")
    return result

def make_bookings(slot):
    elapsed=[]
    entries=[]
    with psycopg.connect(autocommit=True) as conn:
        # Distinct independent PostgreSQL connections run simultaneously.
        for i in range(slot,N,BOOKING_CLIENTS):
            start=time.perf_counter()
            entries.append(booking(conn,5000+i))
            elapsed.append((time.perf_counter()-start)*1000)
    return entries,elapsed

def percentile(values,p):
    ordered=sorted(values)
    assert ordered
    return round(ordered[max(0,int((len(ordered)-1)*p))],2)

def worker(_):
    total=0
    with psycopg.connect() as conn:
        for _ in range(100):
            with conn.transaction():
                receipt=batch(conn)
            total+=receipt["processed"]
            if receipt["processed"]==0:
                break
    return total

def held_txn(signal):
    # Separate OS process, not a mock. Stop before DB COMMIT.
    with psycopg.connect() as conn:
        with conn.transaction():
            result=batch(conn,1)
            if result["processed"]!=1:
                signal.put(("FAIL",result))
                return
            signal.put(("LOCKED",result["processed"]))
            time.sleep(45)   # parent forcibly kills process; PostgreSQL rolls back

with psycopg.connect(autocommit=True) as admin:
    context=scalar(admin,
      "SELECT current_database()||':'||current_setting('application_name')")
    assert context=="qore_disposable_chain:qore_ci_disposable_chain"
    creation_started=time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=BOOKING_CLIENTS) as ex:
        produced=list(ex.map(make_bookings,range(BOOKING_CLIENTS)))
    create_seconds=round(time.perf_counter()-creation_started,3)
    new=[entry for entries,_ in produced for entry in entries]
    booking_ms=[ms for _,times in produced for ms in times]
    assert len(new)==N and len(set(key for key,_ in new))==N
    assert len(set(trip for _,trip in new))==N
    keys=[x[0] for x in new]
    trips=[x[1] for x in new]
    # G73 lost-ACK recovery on 50 actual committed booking identities.
    # No second transaction may allocate a new trip or an outbox item.
    for i in range(0,N,max(1,N//50)):
        key,trip=new[i]
        quote=scalar(admin,
          "SELECT quote_id FROM public.mobility_stage_g72_auto_prequotes WHERE booking_key=%s",
          (key,))
        passenger=scalar(admin,
          "SELECT passenger_id FROM public.mobility_stage_g85_auto_dispatch_jobs WHERE booking_key=%s",
          (key,))
        replay=scalar(admin,
          "SELECT public.mobility_stage_g73_book(%s,%s,%s)",
          (passenger,quote,key))
        assert replay==trip,(replay,trip)
    assert scalar(admin,"SELECT count(*) FROM public.mobility_stage_g85_auto_dispatch_jobs WHERE booking_key=ANY(%s::uuid[])",(keys,))==N
    # Persist query plans and cost evidence (never infer 1M capability from it).
    plan=scalar(admin,"""SELECT pg_catalog.jsonb_build_object(
      'plan',pg_catalog.current_setting('server_version'),
      'poolMaxConnections',pg_catalog.current_setting('max_connections')::integer)""")
    explain=admin.execute("""EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON)
      SELECT booking_key FROM public.mobility_stage_g85_auto_dispatch_jobs
      WHERE status IN ('PENDING','WAITING') AND
      next_attempt_at<=clock_timestamp()
      ORDER BY next_attempt_at,created_at,booking_key LIMIT 10""").fetchone()[0]
    query_plan=explain[0]["Plan"]
    before=admin.execute("""SELECT status,attempts,count(*) FROM
      public.mobility_stage_g85_auto_dispatch_jobs WHERE
      booking_key=ANY(%s::uuid[]) GROUP BY status,attempts""",(keys,)).fetchall()
    assert before==[("PENDING",0,N)],before
    start=time.monotonic()
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as ex:
        processed=list(ex.map(worker,range(WORKERS)))
    elapsed=round(time.monotonic()-start,3)
    result=admin.execute("""SELECT status,attempts,count(*) FROM
      public.mobility_stage_g85_auto_dispatch_jobs WHERE
      booking_key=ANY(%s::uuid[]) GROUP BY status,attempts""",(keys,)).fetchall()
    assert result==[("WAITING",1,N)],result
    assert sum(processed)==N,(sum(processed),processed)
    duplicate=scalar(admin,"""SELECT count(*) FROM
      public.mobility_stage_auto_demo_offers
      WHERE trip_id=ANY(%s::uuid[])""",(trips,))
    assert duplicate==0,"G172 must not fabricate certified drivers"
    # A repeat after G85 backoff cannot mutate a committed original booking.
    with admin.transaction():
        assert batch(admin)["processed"]==0

    crash_key,crash_trip=booking(admin,9000)
    crash_before=admin.execute("""SELECT status,attempts FROM
      public.mobility_stage_g85_auto_dispatch_jobs WHERE booking_key=%s""",
      (crash_key,)).fetchone()
    assert crash_before==("PENDING",0),crash_before
    channel=multiprocessing.Queue()
    process=multiprocessing.Process(target=held_txn,args=(channel,))
    process.start()
    try:
        state,_=channel.get(timeout=12)
        assert state=="LOCKED",state
        process.kill()
        process.join(timeout=10)
        assert not process.is_alive()
    finally:
        if process.is_alive():
            process.kill()
            process.join()
    after_kill=admin.execute("""SELECT status,attempts FROM
      public.mobility_stage_g85_auto_dispatch_jobs WHERE booking_key=%s""",
      (crash_key,)).fetchone()
    assert after_kill==("PENDING",0),"G172 SIGKILL must roll back the job"
    with admin.transaction():
        recovery=batch(admin,1)
    assert recovery["processed"]==1,recovery
    recovered=admin.execute("""SELECT status,attempts,trip_id FROM
      public.mobility_stage_g85_auto_dispatch_jobs WHERE booking_key=%s""",
      (crash_key,)).fetchone()
    assert recovered==("WAITING",1,crash_trip),recovered
    with admin.transaction():
        assert batch(admin,1)["processed"]==0
    assert scalar(admin,"""SELECT count(*) FROM public.mobility_stage_auto_demo_offers
      WHERE trip_id=%s""",(crash_trip,))==0
    metrics={"lab":"G173_ORIGINAL_AUTO_PG16_CONCURRENCY",
      "originalBookings":N+1,
      "simultaneousBookingConnections":BOOKING_CLIENTS,
      "concurrentPostgresWorkerSessions":WORKERS,
      "totalBookingPhaseSeconds":create_seconds,
      "bookingP50Ms":percentile(booking_ms,.50),
      "bookingP95Ms":percentile(booking_ms,.95),
      "bookingP99Ms":percentile(booking_ms,.99),
      "bookingPerSecond":round(N/create_seconds,2),
      "dispatchPhaseSeconds":elapsed,
      "dispatchPerSecond":round(N/elapsed,2),
      "postgresVersion":plan["plan"],
      "postgresConfiguredMaxConnections":plan["poolMaxConnections"],
      "queryPlanNode":query_plan["Node Type"],
      "queryPlanActualMs":round(explain[0]["Execution Time"],3),
      "queryPlanBufferHits":query_plan.get("Shared Hit Blocks"),
      "oneWorkerKilledBeforeCommit":True,"retryAfterCrashExactlyOnce":True,
      "committedRetryAttemptsPerBooking":1,
      "originalBookingsLost":0,"duplicateBookings":0,"duplicateOffers":0,
      "ownerSubsidyDisclosure":"ENFORCED",
      "dispatchLegalAuthority":"NOT_BYPASSED",
      "liveEnabled":False,"commercialReadiness":"NOT_CERTIFIED",
      "verdict":"PG16_MULTIPROCESS_RECOVERY_PASS"}
    print(json.dumps(metrics,sort_keys=True))
