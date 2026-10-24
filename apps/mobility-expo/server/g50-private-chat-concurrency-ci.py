#!/usr/bin/env python3
"""G50 private chat two-session races, DISPOSABLE PostgreSQL ONLY."""
import os
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import psycopg

assert os.environ.get("PGHOST") == "localhost"
assert os.environ.get("PGDATABASE") == "qore_disposable_chain"
assert os.environ.get("PGAPPNAME") == "qore_ci_disposable_chain"

P = "50500000-0000-4050-8050-000000000021"
D = "50500000-0000-4050-8050-000000000022"
SP = "50500000-0000-4050-8050-000000000221"
SD = "50500000-0000-4050-8050-000000000222"
SID = "50500000-0000-4050-8050-000000000700"
KEY = "50500000-0000-4050-8050-000000000720"
AT = int(time.time() * 1000)

def db():
    return psycopg.connect(
        host=os.environ["PGHOST"],
        port=os.environ.get("PGPORT", "5432"),
        user=os.environ["PGUSER"],
        password=os.environ["PGPASSWORD"],
        dbname=os.environ["PGDATABASE"],
        options="-c application_name=qore_ci_disposable_chain",
    )

def exec_one(query, args=()):
    with db() as conn:
        return conn.execute(query, args).fetchone()[0]

with db() as conn:
    conn.execute("INSERT INTO auth.users(id) VALUES (%s),(%s) ON CONFLICT DO NOTHING", (P,D))
    # G1 role trigger seeds passenger. Convert only synthetic Driver.
    conn.execute("DELETE FROM public.user_roles WHERE user_id=%s AND role='passenger'::public.app_role", (D,))
    conn.execute("INSERT INTO public.user_roles(user_id,role) VALUES (%s,'driver') ON CONFLICT DO NOTHING", (D,))
    for actor,session in ((P,SP),(D,SD)):
        conn.execute("""
            INSERT INTO public.mobility_stage_g42_provider_session_grants
              (user_id,session_id,provider_confirmed_at,token_allowed_from,
               valid_until,evidence_kind)
            VALUES (%s,%s,clock_timestamp()-interval '1 day',
               clock_timestamp()-interval '1 minute',
               clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY')
            """, (actor,session))
    conn.execute("""
        CREATE TABLE public.mobility_stage_g50_race_source(
          id uuid PRIMARY KEY, passenger_id uuid, driver_id uuid, can_send boolean)
        """)
    conn.execute("""
        INSERT INTO public.mobility_stage_g50_race_source VALUES (%s,%s,%s,true)
        """, (SID,P,D))
    # The chain DB is discarded. Replace source with a strict synthetic fixture,
    # never run this override on a real environment.
    conn.execute("""
        CREATE OR REPLACE FUNCTION public.mobility_stage_g50_source(_kind text,_service uuid)
        RETURNS TABLE(passenger_id uuid,driver_id uuid,can_send boolean)
        LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
        AS $fixture$
        BEGIN
          IF _kind='RIDE' THEN
            RETURN QUERY SELECT f.passenger_id,f.driver_id,f.can_send
             FROM public.mobility_stage_g50_race_source f
             WHERE f.id=_service FOR SHARE;
          END IF;
        END $fixture$;
    """)

barrier = Barrier(2)
def race_open(actor,session):
    with db() as conn:
        barrier.wait(timeout=15)
        rec=conn.execute(
            "SELECT public.mobility_stage_g50_open_owner_qa('RIDE',%s,%s,%s,%s)",
            (SID,actor,session,AT)).fetchone()[0]
        return rec["conversationId"]

with ThreadPoolExecutor(max_workers=2) as pool:
    a=pool.submit(race_open,P,SP)
    b=pool.submit(race_open,D,SD)
    c1,c2=a.result(timeout=20),b.result(timeout=20)
assert c1==c2, "G50 concurrent open created multiple conversations"
assert exec_one("SELECT count(*) FROM public.mobility_stage_g50_chat_threads WHERE service_id=%s AND state='ACTIVE'",(SID,))==1

barrier=Barrier(2)
def race_send():
    with db() as conn:
        barrier.wait(timeout=15)
        rec=conn.execute(
            "SELECT public.mobility_stage_g50_send_owner_qa(%s,%s,%s,%s,%s,%s)",
            (c1,P,SP,AT,KEY,"Hola simultaneo")).fetchone()[0]
        return rec["messageId"]

with ThreadPoolExecutor(max_workers=2) as pool:
    a=pool.submit(race_send)
    b=pool.submit(race_send)
    m1,m2=a.result(timeout=20),b.result(timeout=20)
assert m1==m2, "G50 duplicate idempotency request created two messageIds"
assert exec_one("SELECT count(*) FROM public.mobility_stage_g50_chat_messages WHERE conversation_id=%s AND request_key=%s",(c1,KEY))==1

# Session lock must serialize against revocation; a stale check in Node
# must never authorize a write committed AFTER revocation.
conn1=db()
try:
    conn1.execute(
        "SELECT public.mobility_stage_g50_send_owner_qa(%s,%s,%s,%s,%s,%s)",
        (c1,P,SP,AT,"50500000-0000-4050-8050-000000000721","Antes de revocar"))
    def revoke():
        with db() as conn:
            conn.execute("""
              UPDATE public.mobility_stage_g42_provider_session_grants
                 SET revoked_at=clock_timestamp(),revision=revision+1
               WHERE user_id=%s AND session_id=%s
            """,(P,SP))
    with ThreadPoolExecutor(max_workers=1) as pool:
        future=pool.submit(revoke)
        time.sleep(.2)
        assert not future.done(), "G50 revocation was not blocked by session lock"
        conn1.commit()
        future.result(timeout=15)
finally:
    conn1.close()
try:
    exec_one("SELECT public.mobility_stage_g50_send_owner_qa(%s,%s,%s,%s,%s,%s)",
       (c1,P,SP,AT,"50500000-0000-4050-8050-000000000722","Despues de revocar"))
except psycopg.Error as exc:
    assert exc.sqlstate=="G5001", f"Expected G5001, got {exc.sqlstate}"
else:
    raise AssertionError("G50 revoked session persisted new message")

print("G50 PASS: 2-session open unique, idempotent send one receipt, revocation lock wins")
