#!/usr/bin/env python3
"""G52: one PG16 reader keeps version lock; concurrent send waits then changes revision.
Synthetic identities, no remote database, never RUN LIVE.
"""
import os
import time
from concurrent.futures import ThreadPoolExecutor
import psycopg

assert os.environ.get("PGHOST") == "localhost"
assert os.environ.get("PGDATABASE") == "qore_disposable_chain"
assert os.environ.get("PGAPPNAME") == "qore_ci_disposable_chain"
P = "52520000-0000-4252-8252-000000000021"
D = "52520000-0000-4252-8252-000000000022"
SP = "52520000-0000-4252-8252-000000000121"
SD = "52520000-0000-4252-8252-000000000122"
SID = "52520000-0000-4252-8252-000000000720"
KEY = "52520000-0000-4252-8252-000000000721"
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

with db() as conn:
    conn.execute("INSERT INTO auth.users(id) VALUES (%s),(%s) ON CONFLICT DO NOTHING", (P,D))
    conn.execute("DELETE FROM public.user_roles WHERE user_id=%s AND role='passenger'::public.app_role", (D,))
    conn.execute("INSERT INTO public.user_roles(user_id,role) VALUES (%s,'driver') ON CONFLICT DO NOTHING", (D,))
    for actor,session in ((P,SP),(D,SD)):
        conn.execute("""
            INSERT INTO public.mobility_stage_g42_provider_session_grants(
             user_id,session_id,provider_confirmed_at,token_allowed_from,
             valid_until,evidence_kind)
            VALUES(%s,%s,clock_timestamp()-interval '1 day',
             clock_timestamp()-interval '1 minute',
             clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY')
        """,(actor,session))
    conn.execute("""
        INSERT INTO public.mobility_stage_g50_race_source(
         id,passenger_id,driver_id,can_send)
        VALUES(%s,%s,%s,true)
    """,(SID,P,D))
    opened=conn.execute(
        "SELECT public.mobility_stage_g50_open_owner_qa('RIDE',%s,%s,%s,%s)",
        (SID,P,SP,AT)).fetchone()[0]
    CID=opened["conversationId"]

read_conn=db()
try:
    initial=read_conn.execute(
        "SELECT public.mobility_stage_g52_history_owner_qa(%s,%s,%s,%s,%s,%s,%s)",
        (CID,P,SP,AT,None,None,100)).fetchone()[0]
    assert initial["revision"]==1 and initial["messages"]==[]
    def send():
        with db() as conn:
            return conn.execute(
                "SELECT public.mobility_stage_g50_send_owner_qa(%s,%s,%s,%s,%s,%s)",
                (CID,D,SD,AT,KEY,"Mensaje bloqueado hasta version consistente")
            ).fetchone()[0]
    with ThreadPoolExecutor(max_workers=1) as pool:
        future=pool.submit(send)
        time.sleep(.3)
        assert not future.done(),"G52 version reader failed to block writer"
        read_conn.commit()
        sent=future.result(timeout=15)
    assert sent["serverStored"] is True
finally:
    read_conn.close()
with db() as conn:
    refreshed=conn.execute(
        "SELECT public.mobility_stage_g52_history_owner_qa(%s,%s,%s,%s,%s,%s,%s)",
        (CID,P,SP,AT,None,None,100)).fetchone()[0]
    assert refreshed["revision"]==2
    assert len(refreshed["messages"])==1
    assert refreshed["messages"][0]["senderRole"]=="driver"
    assert refreshed["messages"][0]["revision"]==2
    replay=conn.execute(
        "SELECT public.mobility_stage_g50_send_owner_qa(%s,%s,%s,%s,%s,%s)",
        (CID,D,SD,AT,KEY,"Mensaje bloqueado hasta version consistente")
    ).fetchone()[0]
    assert replay["messageId"]==sent["messageId"]
    assert conn.execute(
        "SELECT revision FROM public.mobility_stage_g52_thread_versions WHERE conversation_id=%s",
        (CID,)).fetchone()[0]==2,"G52 replay bumped revision"
    try:
        conn.execute(
            "SELECT public.mobility_stage_g52_history_owner_qa(%s,%s,%s,%s,%s,%s,%s)",
            (CID,P,SP,AT,1,5,100))
    except psycopg.Error as exc:
        assert exc.sqlstate=="G5209",f"Expected G5209, got {exc.sqlstate}"
    else:
        raise AssertionError("G52 stale cursor accepted after durable message")
print("G52 PASS: transactional version fence blocks concurrent send, replay does not mutate version")
