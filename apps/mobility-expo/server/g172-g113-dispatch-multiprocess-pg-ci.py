"""G172 G85/G113 original PostgreSQL AUTO bookings under 12 worker sessions,
real transaction crash rollback and no repeated dispatch effects.
Never uses maps, payment, KYC bypass, fake Driver approval or production DB.
"""
import concurrent.futures
import multiprocessing
import os
import time
import psycopg

EXPECTED = {
    "CI": "true", "PGHOST": "localhost", "PGPORT": "5432",
    "PGDATABASE": "qore_disposable_chain",
    "PGAPPNAME": "qore_ci_disposable_chain"
}
if any(os.environ.get(k) != v for k,v in EXPECTED.items()):
    raise SystemExit("G172 refuses non-disposable PG16")
N = 240
WORKERS = 12

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

def worker(_):
    total=0
    with psycopg.connect() as conn:
        for _ in range(60):
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
    new=[booking(admin,5000+i) for i in range(N)]
    keys=[x[0] for x in new]
    trips=[x[1] for x in new]
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
    print({"lab":"G172_ORIGINAL_AUTO_PG16_WORKER",
      "originalBookings":N+1,"concurrentPostgresWorkerSessions":WORKERS,
      "oneWorkerKilledBeforeCommit":True,"retryAfterCrashExactlyOnce":True,
      "committedRetryAttemptsPerBooking":1,"duplicateOffers":0,
      "dispatchLegalAuthority":"NOT_BYPASSED",
      "elapsedSecondsBulk":elapsed,
      "liveEnabled":False,"commercialReadiness":"NOT_CERTIFIED",
      "verdict":"PG16_MULTIPROCESS_RECOVERY_PASS"})
