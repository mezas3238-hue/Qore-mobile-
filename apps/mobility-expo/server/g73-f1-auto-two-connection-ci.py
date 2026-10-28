"""G73 certified synthetic chain: route lock, quote and booking across two
independent PostgreSQL sessions. No remote DB, real actor, map or payments.
"""
import os
import psycopg

EXPECT = {
    "PGHOST": "localhost", "PGDATABASE": "qore_disposable_chain",
    "PGAPPNAME": "qore_ci_disposable_chain",
}
ACTOR = "73730000-0000-4737-8737-000000000002"
ROUTE_KEY = "73730000-0000-4737-8737-000000000020"
QUOTE_KEY = "73730000-0000-4737-8737-000000000021"
BOOK_KEY = "73730000-0000-4737-8737-000000000022"

def one(db, sql, args=()):
    return db.execute(sql,args).fetchone()[0]

def must_block(run):
    try:
        run()
    except psycopg.Error as err:
        if err.sqlstate != "55P03":
            raise AssertionError(f"Wrong race error {err.sqlstate}") from err
        return
    raise AssertionError("Second connection read uncommitted route/price")

def main():
    if any(os.environ.get(k) != v for k,v in EXPECT.items()):
        raise SystemExit("G73 refuses non-disposable PostgreSQL")
    with psycopg.connect(autocommit=True) as a, psycopg.connect(autocommit=True) as b:
        if a.execute("SELECT current_database(),current_setting('application_name')").fetchone() != (
                "qore_disposable_chain","qore_ci_disposable_chain"):
            raise AssertionError("Wrong database")
        a.execute("INSERT INTO auth.users(id) VALUES(%s)",(ACTOR,))
        a.execute("SET ROLE service_role")
        b.execute("SET ROLE service_role")
        route=one(a,"""SELECT public.mobility_stage_g73_route(
         %s,%s,'economico','PANTEON','SHOPPING','ASUNCION_FIXTURE',1000,60,0)
        """,(ACTOR,ROUTE_KEY))
        with a.transaction():
            quote=one(a,"SELECT public.mobility_stage_g73_quote(%s,%s,%s)",
                      (ACTOR,route,QUOTE_KEY))
            def quote_racer():
                with b.transaction():
                    b.execute("SET LOCAL lock_timeout='250ms'")
                    one(b,"SELECT public.mobility_stage_g73_quote(%s,%s,%s)",
                        (ACTOR,route,QUOTE_KEY))
            must_block(quote_racer)
        replay_quote=one(b,"SELECT public.mobility_stage_g73_quote(%s,%s,%s)",
                         (ACTOR,route,QUOTE_KEY))
        if quote!=replay_quote:
            raise AssertionError("Route produced duplicate G73 quotes")
        with a.transaction():
            trip=one(a,"SELECT public.mobility_stage_g73_book(%s,%s,%s)",
                     (ACTOR,quote,BOOK_KEY))
            def book_racer():
                with b.transaction():
                    b.execute("SET LOCAL lock_timeout='250ms'")
                    one(b,"SELECT public.mobility_stage_g73_book(%s,%s,%s)",
                        (ACTOR,quote,BOOK_KEY))
            must_block(book_racer)
        replay_trip=one(b,"SELECT public.mobility_stage_g73_book(%s,%s,%s)",
                        (ACTOR,quote,BOOK_KEY))
        receipt=one(b,"SELECT public.mobility_stage_g73_booking_receipt(%s,%s)",
                    (ACTOR,BOOK_KEY))
        if trip!=replay_trip or receipt["tripId"]!=str(trip):
            raise AssertionError("Lost ACK did not recover the same booking")
        a.execute("RESET ROLE")
        count=one(a,"""SELECT count(*) FROM public.mobility_stage_g72_auto_prequotes
                     WHERE passenger_id=%s AND route_id=%s""",(ACTOR,route))
        rides=one(a,"""SELECT count(*) FROM public.mobility_stage_auto_demo_trips
                     WHERE passenger_id=%s""",(ACTOR,))
        if count!=1 or rides!=1:
            raise AssertionError(f"Unexpected duplicate quote/trip: {count}/{rides}")
    print("G73 two-connection PASS: stable route quote, stable booking, one winner, lost ACK")

if __name__=="__main__":
    main()
