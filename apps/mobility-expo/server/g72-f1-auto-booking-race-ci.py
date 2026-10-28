"""G72 synthetic PG16: two sessions, a single quote and exactly one booking.
No remote DB, real passenger, route provider, commercial price or PSP.
"""
import os
import uuid
import psycopg

REQUIRED = {"PGHOST": "localhost", "PGDATABASE": "qore_disposable_chain",
            "PGAPPNAME": "qore_ci_disposable_chain"}
ACTOR = "72720000-0000-4727-8727-000000000002"
PRE = "72720000-0000-4727-8727-000000000020"
KEY = "72720000-0000-4727-8727-000000000021"

def scalar(db, sql, args=()):
    return db.execute(sql, args).fetchone()[0]

def main():
    if any(os.getenv(k) != v for k,v in REQUIRED.items()):
        raise SystemExit("G72 refuses non-disposable database")
    with psycopg.connect(autocommit=True) as a, psycopg.connect(autocommit=True) as b:
        if a.execute("SELECT current_database(),current_setting('application_name')").fetchone() != (
                "qore_disposable_chain","qore_ci_disposable_chain"):
            raise AssertionError("G72 wrong database")
        a.execute("INSERT INTO auth.users(id) VALUES(%s)", (ACTOR,))
        a.execute("SET ROLE service_role")
        b.execute("SET ROLE service_role")
        quote=scalar(a,"""SELECT public.mobility_stage_g72_prequote(
          %s,%s,'economico','PANTEON','AEROPUERTO',
          'ASUNCION_FIXTURE',5000,600,0)""",(ACTOR, PRE))
        # Until A commits the quote-to-trip link, B cannot book it;
        # a timed-out connection MUST reconcile the same idempotency key.
        with a.transaction():
            first=scalar(a,"SELECT public.mobility_stage_g72_book(%s,%s,%s)",
                         (ACTOR,quote,KEY))
            try:
                with b.transaction():
                    b.execute("SET LOCAL lock_timeout='250ms'")
                    scalar(b,"SELECT public.mobility_stage_g72_book(%s,%s,%s)",
                           (ACTOR,quote,KEY))
            except psycopg.Error as error:
                if error.sqlstate != "55P03":
                    raise AssertionError("Expected real row-lock serialization") from error
            else:
                raise AssertionError("G72 second session bypassed uncommitted booking lock")
        restored=scalar(b,"SELECT public.mobility_stage_g72_book(%s,%s,%s)",
                        (ACTOR,quote,KEY))
        receipt=scalar(b,"SELECT public.mobility_stage_g72_booking_receipt(%s,%s)",
                       (ACTOR,KEY))
        if restored != first or receipt["serviceId"] != str(first):
            raise AssertionError("G72 lost ACK created a second trip")
        try:
            scalar(b,"SELECT public.mobility_stage_g72_book(%s,%s,%s)",
                   (ACTOR,quote,uuid.uuid4()))
        except psycopg.Error as error:
            if error.sqlstate != "P7201":
                raise AssertionError("Wrong SQLSTATE for reused quote") from error
        else:
            raise AssertionError("G72 allowed alternate key on committed quote")
        a.execute("RESET ROLE")
        count=scalar(a,"SELECT count(*) FROM public.mobility_stage_auto_demo_trips WHERE passenger_id=%s",
                     (ACTOR,))
        if count != 1:
            raise AssertionError(f"G72 duplicate durable trips: {count}")
    print("G72 PostgreSQL two-session PASS: serialized one booking, immutable ACK and rejected second key")

if __name__=="__main__":
    main()
