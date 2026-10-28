"""G86 two independent PostgreSQL sessions certify G85 queue claiming and
cancellation. Disposable CI ONLY; no public route, production DB or driver.
"""
import os
import psycopg

ENV = {"PGHOST": "localhost", "PGDATABASE": "qore_disposable_chain",
       "PGAPPNAME": "qore_ci_disposable_chain"}

def key(number):
    return f"86860000-0000-4868-8868-{number:012x}"

def scalar(db, statement, args=()):
    return db.execute(statement, args).fetchone()[0]

def run_qa(db):
    result = scalar(db, "SELECT public.mobility_stage_g85_run_one_dispatch_qa()")
    if result.get("mode") != "STAGING_DEMO_ONLY" or result.get("commercialEnabled") is not False:
        raise AssertionError("G86 dispatcher lost QA-only fencing")
    return result

def create_booking(db, number):
    passenger, route_key, quote_key, book_key = (
        key(number),key(0x100+number),key(0x200+number),key(0x300+number))
    db.execute("INSERT INTO auth.users(id) VALUES (%s)", (passenger,))
    route = scalar(db, """SELECT public.mobility_stage_g73_route(
       %s,%s,'economico','CENTRO_FIXTURE','AEROPUERTO',
       'ASUNCION_FIXTURE',5000,600,0)""", (passenger, route_key))
    quote = scalar(db, "SELECT public.mobility_stage_g73_quote(%s,%s,%s)",
                   (passenger,route,quote_key))
    trip = scalar(db, "SELECT public.mobility_stage_g73_book(%s,%s,%s)",
                  (passenger,quote,book_key))
    return passenger,book_key,trip

def main():
    if any(os.environ.get(k) != v for k,v in ENV.items()):
        raise SystemExit("G86 refuses non-disposable PostgreSQL environment")
    with psycopg.connect(autocommit=True) as a, psycopg.connect(autocommit=True) as b:
        if a.execute("SELECT current_database(),current_setting('application_name')").fetchone() != (
            "qore_disposable_chain","qore_ci_disposable_chain"):
            raise AssertionError("G86 wrong DB")
        if scalar(a,"SELECT count(*) FROM public.mobility_stage_g85_auto_dispatch_jobs") != 0:
            raise AssertionError("G86 expected clean independent ephemeral outbox")
        # Existing fixtures from G80/G85 have no active real geofencing.
        # Suspend only synthetic vehicles, never relax KYC or legal checks.
        a.execute("""UPDATE public.mobility_vehicles SET review_status='suspended'
                   WHERE vehicle_kind='AUTO' AND review_status='approved'""")
        c,c_key,c_trip = create_booking(a, 0x31)
        u,u_key,u_trip = create_booking(a, 0x32)
        v,v_key,v_trip = create_booking(a, 0x33)
        # One booking was canceled before a worker ever handled it.
        scalar(a, "SELECT public.mobility_stage_auto_demo_transition(%s,%s,'cancelled',%s)",
               (c_trip,c,key(0x701)))
        a.execute("""UPDATE public.mobility_stage_g85_auto_dispatch_jobs
                     SET next_attempt_at=clock_timestamp()-interval '3 minutes'
                     WHERE booking_key=%s""",(c_key,))
        a.execute("""UPDATE public.mobility_stage_g85_auto_dispatch_jobs
                     SET next_attempt_at=clock_timestamp()-interval '2 minutes'
                     WHERE booking_key=%s""",(u_key,))
        a.execute("""UPDATE public.mobility_stage_g85_auto_dispatch_jobs
                     SET next_attempt_at=clock_timestamp()-interval '1 minute'
                     WHERE booking_key=%s""",(v_key,))
        # A canceled Passenger trip is terminal and may not notify Driver.
        a.execute("SET ROLE service_role")
        stopped=run_qa(a)
        a.execute("RESET ROLE")
        if stopped.get("status") != "CLOSED" or stopped.get("tripId") != str(c_trip):
            raise AssertionError(f"G86 canceled booked AUTO not closed: {stopped}")
        # Two genuine, overlapping PostgreSQL transactions:
        # A locks first due job. B uses SKIP LOCKED and consumes second.
        with a.transaction():
            a.execute("""SELECT booking_key FROM public.mobility_stage_g85_auto_dispatch_jobs
                         WHERE booking_key=%s FOR UPDATE""",(u_key,))
            b.execute("SET ROLE service_role")
            other=run_qa(b)
            b.execute("RESET ROLE")
            a.execute("SET LOCAL ROLE service_role")
            own=run_qa(a)
            idle=run_qa(a)
            if other.get("status") != "WAITING" or other.get("tripId") != str(v_trip):
                raise AssertionError(f"G86 second worker did not SKIP LOCKED: {other}")
            if own.get("status") != "WAITING" or own.get("tripId") != str(u_trip):
                raise AssertionError(f"G86 first worker lost locked job: {own}")
            if idle.get("status") != "IDLE":
                raise AssertionError(f"G86 duplicated a claimed job: {idle}")
        expected = {(str(c_key), "CLOSED", 0),
                    (str(u_key), "WAITING", 1),
                    (str(v_key), "WAITING", 1)}
        actual = set(a.execute("""SELECT booking_key::text,status,attempts
                    FROM public.mobility_stage_g85_auto_dispatch_jobs""").fetchall())
        if actual != expected:
            raise AssertionError(f"G86 durable state mismatch {actual}")
        if scalar(a, """SELECT count(*) FROM public.mobility_stage_auto_demo_offers
                 WHERE trip_id IN (%s,%s,%s)""",(c_trip,u_trip,v_trip)) != 0:
            raise AssertionError("G86 created an offer for canceled/unverified Driver")
        # SDK role must not inspect or run internal queue.
        with b.transaction():
            b.execute("SET LOCAL ROLE authenticated")
            try:
                scalar(b,"SELECT public.mobility_stage_g85_run_one_dispatch_qa()")
            except psycopg.Error as exc:
                if exc.sqlstate != "42501":
                    raise AssertionError(f"G86 wrong permission refusal {exc.sqlstate}")
            else:
                raise AssertionError("G86 authenticated role triggered worker")
        # G87 cannot be tested by forging an expired offer: the real G71
        # trigger blocks unauthorized rows, even for synthetic QA accounts.
        # Certify that protection independently, without disabling triggers
        # or granting Driver privileges to the SDK.
        candidate = a.execute("""SELECT driver_id,id FROM public.mobility_vehicles
                         WHERE vehicle_kind='AUTO' ORDER BY id LIMIT 1""").fetchone()
        if not candidate:
            raise AssertionError("G87 disposable Driver fixture missing")
        driver_id,vehicle_id = candidate
        try:
            scalar(a, """INSERT INTO public.mobility_stage_auto_demo_offers
                  (request_key,trip_id,driver_id,vehicle_id,ttl_seconds,
                   offered_at,expires_at)
                  VALUES (%s,%s,%s,%s,30,
                   clock_timestamp()-interval '90 seconds',
                   clock_timestamp()-interval '60 seconds') RETURNING id""",
                   (key(0x801),u_trip,driver_id,vehicle_id))
        except psycopg.Error as exc:
            if "KYC" not in str(exc) and "eligible" not in str(exc):
                raise AssertionError(f"Unexpected offer guard: {exc.sqlstate}") from exc
        else:
            raise AssertionError("G71 allowed fabricated expired Driver offer")
        if scalar(a,"""SELECT count(*) FROM public.mobility_stage_auto_demo_offers
                     WHERE trip_id=%s""",(u_trip,)) != 0:
            raise AssertionError("Rejected synthetic offer was persisted")
        if scalar(a,"""SELECT count(*) FROM public.mobility_stage_g85_auto_dispatch_jobs
                     WHERE booking_key=%s AND status='WAITING'
                     AND attempts=1 AND offer_id IS NULL""",(u_key,)) != 1:
            raise AssertionError("Rejected offer changed valid pending job")
        print("G86 PASS: two disjoint workers, cancelled CLOSED, expired-forgery rejected by KYC")

if __name__ == "__main__":
    main()
