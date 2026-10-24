#!/usr/bin/env python3
"""G56B Driver inbox: actual PostgreSQL16 NOLOGIN delegate, two-connections
one-use capability race, revision lock, and G42 revoked-session gate. QA ONLY."""
import os
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import psycopg

assert os.environ.get("PGHOST")=="localhost"
assert os.environ.get("PGDATABASE")=="qore_disposable_chain"
assert os.environ.get("PGAPPNAME")=="qore_ci_disposable_chain"
P="56561400-0000-4656-8656-000000000001"
D="56561400-0000-4656-8656-000000000002"
SP="56561400-0000-4656-8656-000000000101"
SD="56561400-0000-4656-8656-000000000102"
SERVICE="56561400-0000-4656-8656-000000000201"
AT=int(time.time()*1000)

def db():
    return psycopg.connect(host=os.environ["PGHOST"],
       port=os.environ.get("PGPORT","5432"),user=os.environ["PGUSER"],
       password=os.environ["PGPASSWORD"],dbname=os.environ["PGDATABASE"],
       options="-c application_name=qore_ci_disposable_chain")

def mint(conn):
    return conn.execute("""
     SELECT public.mobility_stage_g56_inbox_mint_owner_qa(%s,%s,%s)
    """,(D,SD,AT)).fetchone()[0]["ticket"]

with db() as conn:
    conn.execute("INSERT INTO auth.users(id) VALUES(%s),(%s) ON CONFLICT DO NOTHING",(P,D))
    conn.execute("""
      DELETE FROM public.user_roles WHERE user_id=%s
      AND role='passenger'::public.app_role
    """,(D,))
    conn.execute("""
      INSERT INTO public.user_roles(user_id,role) VALUES(%s,'driver'::public.app_role)
      ON CONFLICT DO NOTHING
    """,(D,))
    for user,sid in ((P,SP),(D,SD)):
        conn.execute("""
          INSERT INTO public.mobility_stage_g42_provider_session_grants(
            user_id,session_id,provider_confirmed_at,token_allowed_from,
            valid_until,evidence_kind)
          VALUES(%s,%s,clock_timestamp()-interval '1 day',
            clock_timestamp()-interval '1 minute',
            clock_timestamp()+interval '1 hour',
            'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')
        """,(user,sid))
    conn.execute("""
      INSERT INTO public.mobility_stage_g50_race_source
        (id,passenger_id,driver_id,can_send)
      VALUES(%s,%s,%s,true)
    """,(SERVICE,P,D))
    CID=conn.execute("""
      SELECT public.mobility_stage_g50_open_owner_qa('RIDE',%s,%s,%s,%s)
    """,(SERVICE,D,SD,AT)).fetchone()[0]["conversationId"]
    conn.execute("""
      INSERT INTO public.mobility_stage_g50_chat_messages(
        conversation_id,sender_id,request_key,body)
      VALUES(%s,%s,%s,'Hola Driver')
    """,(CID,P,"56561400-0000-4656-8656-000000000401"))
    TICKET=mint(conn)

barrier=Barrier(2)
def same_ticket():
    try:
        with db() as conn:
            conn.execute("SET LOCAL ROLE mobility_g56_driver_gateway_ci")
            assert conn.execute("SELECT current_user").fetchone()[0]=="mobility_g56_driver_gateway_ci"
            barrier.wait(timeout=15)
            page=conn.execute("""
              SELECT public.mobility_stage_g56_driver_inbox_qa(%s,NULL,NULL,NULL,50)
            """,(TICKET,)).fetchone()[0]
            return ("OK",page)
    except psycopg.Error as exc:
        return ("DENIED",exc.sqlstate)

with ThreadPoolExecutor(max_workers=2) as pool:
    a=pool.submit(same_ticket)
    b=pool.submit(same_ticket)
    results=[a.result(timeout=25),b.result(timeout=25)]
success=[x for x in results if x[0]=="OK"]
denied=[x for x in results if x[0]=="DENIED"]
assert len(success)==1 and len(denied)==1,results
assert denied[0][1]=="G5615",results
first=success[0][1]
assert first["items"][0]["unreadCount"]==1,first
assert first["ownerId"]==D and first["productionEnabled"] is False

# A Driver inbox page shares the driver's revision row lock: concurrent
# inserts bump revision only after the page transaction commits.
with db() as conn:
    held_ticket=mint(conn)
hold=db()
try:
    hold.execute("SET LOCAL ROLE mobility_g56_driver_gateway_ci")
    held=hold.execute("""
     SELECT public.mobility_stage_g56_driver_inbox_qa(%s,NULL,NULL,NULL,50)
    """,(held_ticket,)).fetchone()[0]
    def write_new_message():
        with db() as conn:
            conn.execute("""
              INSERT INTO public.mobility_stage_g50_chat_messages(
               conversation_id,sender_id,request_key,body)
              VALUES(%s,%s,%s,'Segundo mensaje')
            """,(CID,P,"56561400-0000-4656-8656-000000000402"))
    with ThreadPoolExecutor(max_workers=1) as pool:
        future=pool.submit(write_new_message)
        time.sleep(.2)
        assert not future.done(),"G56B revision not fenced by page transaction"
        hold.commit()
        future.result(timeout=15)
finally:
    hold.close()

with db() as conn:
    stale_ticket=mint(conn)
try:
    with db() as conn:
        conn.execute("SET LOCAL ROLE mobility_g56_driver_gateway_ci")
        conn.execute("""
          SELECT public.mobility_stage_g56_driver_inbox_qa(%s,%s,NULL,NULL,50)
        """,(stale_ticket,held["revision"]))
except psycopg.Error as e:
    assert e.sqlstate=="G5619",e.sqlstate
else:
    raise AssertionError("G56B accepted stale version after activity")

with db() as conn:
    hold_ticket=mint(conn)
    revoked_ticket=mint(conn)
holder=db()
try:
    holder.execute("SET LOCAL ROLE mobility_g56_driver_gateway_ci")
    holder.execute("""
      SELECT public.mobility_stage_g56_driver_inbox_qa(%s,NULL,NULL,NULL,50)
    """,(hold_ticket,))
    def revoke():
        with db() as conn:
            conn.execute("""
              UPDATE public.mobility_stage_g42_provider_session_grants
                SET revoked_at=clock_timestamp(),revision=revision+1
                WHERE user_id=%s AND session_id=%s
            """,(D,SD))
    with ThreadPoolExecutor(max_workers=1) as pool:
        future=pool.submit(revoke)
        time.sleep(.2)
        assert not future.done(),"G56B failed to hold session-grant lock"
        holder.commit()
        future.result(timeout=15)
finally:
    holder.close()

try:
    with db() as conn:
        conn.execute("SET LOCAL ROLE mobility_g56_driver_gateway_ci")
        conn.execute("""
          SELECT public.mobility_stage_g56_driver_inbox_qa(%s,NULL,NULL,NULL,50)
        """,(revoked_ticket,))
except psycopg.Error as e:
    assert e.sqlstate=="G5611",e.sqlstate
else:
    raise AssertionError("G56B issued inbox after session revocation")

print("G56B PASS: two delegated connections, one ticket, revision-write fence, G42 revocation")
