"""G32: independent PostgreSQL sessions race a Driver sequence and consent revoke.
Disposable chain ONLY, never contact Supabase or any remote database.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from threading import Barrier
from time import sleep
import os
import psycopg

assert os.environ.get("PGDATABASE") == "qore_disposable_chain"
assert os.environ.get("PGHOST") == "localhost"
assert os.environ.get("PGAPPNAME") == "qore_ci_disposable_chain"

DRIVER = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1"
APPROVER = "c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2"
ZONE = "c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3"
EVENT_ONE = "c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4"
EVENT_TWO = "c5c5c5c5-c5c5-4c5c-8c5c-c5c5c5c5c5c5"
EVENT_THREE = "c6c6c6c6-c6c6-4c6c-8c6c-c6c6c6c6c6c6"
RPC = """SELECT public.mobility_stage_g32_quarantine_signal(
 %s::uuid,%s::uuid,%s::bigint,%s::bigint,%s::uuid,%s::text,%s::bigint,%s::bigint
)"""

def connection():
    return psycopg.connect(connect_timeout=10)

def clock_ms():
    return int(datetime.now(timezone.utc).timestamp() * 1000)

def setup():
    with connection() as db:
        with db.cursor() as c:
            c.execute("INSERT INTO auth.users(id) VALUES (%s::uuid),(%s::uuid) ON CONFLICT DO NOTHING",
                      (DRIVER, APPROVER))
            c.execute("DELETE FROM public.user_roles WHERE user_id=%s::uuid", (DRIVER,))
            c.execute("INSERT INTO public.user_roles(user_id,role) VALUES(%s::uuid,'driver')", (DRIVER,))
            c.execute("""INSERT INTO public.mobility_location_consents(driver_id,opted_in_at)
             VALUES(%s::uuid,clock_timestamp()-interval '30 minutes')""", (DRIVER,))
            c.execute("""INSERT INTO public.mobility_stage_g31_zone_coverage(
             zone_id,municipality,service_kind,coverage_status)
             VALUES(%s::uuid,'Asuncion','AUTO_DELIVERY','PLANNED')""", (ZONE,))

def run_signal(event,seq,at_ms,barrier=None):
    with connection() as db:
        with db.cursor() as c:
            c.execute("SET ROLE service_role")
            if barrier is not None:
                barrier.wait(timeout=12)
            try:
                c.execute(RPC, (DRIVER,event,seq,at_ms,ZONE,"AUTO_DELIVERY",1,1))
                result=c.fetchone()[0]
                db.commit()
                return ("success",str(result))
            except psycopg.Error as exc:
                db.rollback()
                return ("rejected",exc.sqlstate)

def test_race():
    barrier=Barrier(2)
    captured=clock_ms()
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures=[
          pool.submit(run_signal,EVENT_ONE,1,captured,barrier),
          pool.submit(run_signal,EVENT_TWO,1,captured,barrier)
        ]
        results=[f.result(timeout=25) for f in futures]
    successes=[x for x in results if x[0]=="success"]
    denials=[x for x in results if x[0]=="rejected"]
    assert len(successes)==1 and len(denials)==1, results
    assert denials[0][1]=="G3201", results
    with connection() as db:
        with db.cursor() as c:
            c.execute("""SELECT count(*) FROM public.mobility_stage_g32_signal_quarantine
                      WHERE driver_id=%s::uuid""",(DRIVER,))
            assert c.fetchone()[0]==1
            c.execute("""SELECT last_sequence FROM public.mobility_stage_g32_signal_state
                      WHERE driver_id=%s::uuid""",(DRIVER,))
            assert c.fetchone()[0]==1
    print("G32 two session same-driver sequence race: exactly one winner",flush=True)

def test_revoke_race():
    with connection() as revoker:
        with revoker.cursor() as c:
            c.execute("""UPDATE public.mobility_location_consents
              SET revoked_at=clock_timestamp()
              WHERE driver_id=%s::uuid""",(DRIVER,))
            with ThreadPoolExecutor(max_workers=1) as pool:
                future=pool.submit(run_signal,EVENT_THREE,2,clock_ms())
                sleep(.25)
                revoker.commit()
                result=future.result(timeout=20)
    assert result == ("rejected","G3201"),result
    with connection() as db:
        with db.cursor() as c:
            c.execute("""SELECT count(*) FROM public.mobility_stage_g32_signal_quarantine
              WHERE driver_id=%s::uuid""",(DRIVER,))
            assert c.fetchone()[0]==1
    print("G32 concurrent consent revocation fenced and rejected",flush=True)

def cleanup():
    with connection() as db:
        with db.cursor() as c:
            c.execute("DELETE FROM public.mobility_stage_g32_signal_quarantine WHERE driver_id=%s::uuid",(DRIVER,))
            c.execute("DELETE FROM public.mobility_stage_g32_signal_state WHERE driver_id=%s::uuid",(DRIVER,))
            c.execute("DELETE FROM public.mobility_location_consents WHERE driver_id=%s::uuid",(DRIVER,))
            c.execute("DELETE FROM public.user_roles WHERE user_id=%s::uuid",(DRIVER,))
            c.execute("DELETE FROM public.mobility_stage_g31_zone_coverage WHERE zone_id=%s::uuid",(ZONE,))
            c.execute("DELETE FROM auth.users WHERE id IN (%s::uuid,%s::uuid)",(DRIVER,APPROVER))

if __name__=="__main__":
    setup()
    try:
        test_race()
        test_revoke_race()
    finally:
        cleanup()
