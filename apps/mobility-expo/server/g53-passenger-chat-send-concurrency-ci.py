#!/usr/bin/env python3
"""G53 durable Client ACK PostgreSQL 16 two-session race; DISPOSABLE ONLY."""
import os
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import psycopg

assert os.environ.get("PGHOST") == "localhost"
assert os.environ.get("PGDATABASE") == "qore_disposable_chain"
assert os.environ.get("PGAPPNAME") == "qore_ci_disposable_chain"

P="53530000-0000-4353-8353-000000000021"
D="53530000-0000-4353-8353-000000000022"
SP="53530000-0000-4353-8353-000000000121"
SD="53530000-0000-4353-8353-000000000122"
SID="53530000-0000-4353-8353-000000000720"
KEY="53530000-0000-4353-8353-000000000721"
AT=int(time.time()*1000)
BODY="Llego al punto de recogida"
def db():
    return psycopg.connect(
        host=os.environ["PGHOST"],port=os.environ.get("PGPORT","5432"),
        user=os.environ["PGUSER"],password=os.environ["PGPASSWORD"],
        dbname=os.environ["PGDATABASE"],
        options="-c application_name=qore_ci_disposable_chain"
    )
with db() as conn:
    conn.execute("INSERT INTO auth.users(id) VALUES(%s),(%s) ON CONFLICT DO NOTHING",(P,D))
    conn.execute("DELETE FROM public.user_roles WHERE user_id=%s AND role='passenger'::public.app_role",(D,))
    conn.execute("INSERT INTO public.user_roles(user_id,role) VALUES(%s,'driver'::public.app_role) ON CONFLICT DO NOTHING",(D,))
    for actor,session in ((P,SP),(D,SD)):
        conn.execute("""
         INSERT INTO public.mobility_stage_g42_provider_session_grants(
          user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
         VALUES(%s,%s,clock_timestamp()-interval '1 day',
          clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',
          'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')
        """,(actor,session))
    conn.execute("""
     INSERT INTO public.mobility_stage_g50_race_source(id,passenger_id,driver_id,can_send)
     VALUES(%s,%s,%s,true)""",(SID,P,D))
    CID=conn.execute(
        "SELECT public.mobility_stage_g50_open_owner_qa('RIDE',%s,%s,%s,%s)",
        (SID,P,SP,AT)).fetchone()[0]["conversationId"]

barrier=Barrier(2)
def send():
    with db() as conn:
        barrier.wait(timeout=15)
        return conn.execute("""
         SELECT public.mobility_stage_g53_passenger_send_owner_qa(
          'RIDE',%s,%s,%s,%s,%s,%s,%s)
        """,(SID,CID,P,SP,AT,KEY,BODY)).fetchone()[0]

with ThreadPoolExecutor(max_workers=2) as pool:
    f=pool.submit(send)
    g=pool.submit(send)
    a=f.result(timeout=25)
    b=g.result(timeout=25)

assert a==b,"G53 simultaneous idempotent sends returned unequal durable ACKs"
assert set(a)=={
 "conversationId","serviceId","requestKey","messageId",
 "senderRole","body","createdAt","revision","serverStored"
}
assert a["serverStored"] is True and a["senderRole"]=="passenger"
assert a["revision"]==2 and a["body"]==BODY
with db() as conn:
    assert conn.execute("""
     SELECT count(*) FROM public.mobility_stage_g50_chat_messages
     WHERE conversation_id=%s AND request_key=%s
    """,(CID,KEY)).fetchone()[0]==1
    assert conn.execute("""
     SELECT revision FROM public.mobility_stage_g52_thread_versions
     WHERE conversation_id=%s
    """,(CID,)).fetchone()[0]==2
    try:
        conn.execute("""
         SELECT public.mobility_stage_g53_passenger_send_owner_qa(
          'RIDE',%s,%s,%s,%s,%s,%s,%s)
        """,(SID,CID,P,SP,AT,KEY,"Cuerpo adulterado"))
    except psycopg.Error as exc:
        assert exc.sqlstate=="G5009",f"Expected G5009, got {exc.sqlstate}"
    else:
        raise AssertionError("G53 accepted requestKey replay with different body")

# Separate transaction: G42 shared session lock holds while revoker waits.
holder=db()
try:
    holder.execute("""
     SELECT public.mobility_stage_g53_passenger_send_owner_qa(
      'RIDE',%s,%s,%s,%s,%s,%s,%s)
    """,(SID,CID,P,SP,AT,KEY,BODY))
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
        assert not future.done(),"G53 session revocation ignored held G42 lock"
        holder.commit()
        future.result(timeout=15)
finally:
    holder.close()
try:
    with db() as conn:
        conn.execute("""
         SELECT public.mobility_stage_g53_passenger_send_owner_qa(
          'RIDE',%s,%s,%s,%s,%s,%s,%s)
        """,(SID,CID,P,SP,AT,KEY,BODY))
except psycopg.Error as exc:
    assert exc.sqlstate=="G5001",f"Expected revoked G5001, got {exc.sqlstate}"
else:
    raise AssertionError("G53 replayed durable ACK after revocation")

print("G53 PASS: two real PG connections same durable ACK, one version, key collision rejected, revocation lock")
