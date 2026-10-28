#!/usr/bin/env python3
"""G56: two PostgreSQL16 connections compete for one DRIVER_SEND capability,
then verify replay, assignment rotation and G42 session-lock revocation.
DISPOSABLE QA ONLY: do not run against STAGING/LIVE."""
import os
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import psycopg

assert os.environ.get("PGHOST") == "localhost"
assert os.environ.get("PGDATABASE") == "qore_disposable_chain"
assert os.environ.get("PGAPPNAME") == "qore_ci_disposable_chain"

P="56561100-0000-4656-8656-000000000001"
D="56561100-0000-4656-8656-000000000002"
OLD="56561100-0000-4656-8656-000000000003"
SP="56561100-0000-4656-8656-000000000101"
SD="56561100-0000-4656-8656-000000000102"
SERVICE="56561100-0000-4656-8656-000000000201"
KEY="56561100-0000-4656-8656-000000000401"
AT=int(time.time()*1000)

def db():
    return psycopg.connect(
        host=os.environ["PGHOST"],port=os.environ.get("PGPORT","5432"),
        user=os.environ["PGUSER"],password=os.environ["PGPASSWORD"],
        dbname=os.environ["PGDATABASE"],
        options="-c application_name=qore_ci_disposable_chain",
    )

def mint(conn,op,cid):
    return conn.execute("""
        SELECT public.mobility_stage_g56_mint_owner_qa(
         %s,%s,%s,%s,'RIDE',%s,%s)
    """,(D,SD,AT,op,SERVICE,cid)).fetchone()[0]["ticket"]

def delegated_send(ticket,key,body):
    with db() as conn:
        conn.execute("SET LOCAL ROLE mobility_g56_driver_gateway_ci")
        assert conn.execute("SELECT current_user").fetchone()[0]=="mobility_g56_driver_gateway_ci"
        return conn.execute("SELECT public.mobility_stage_g56_send_qa(%s,%s,%s)",
            (ticket,key,body)).fetchone()[0]

with db() as conn:
    conn.execute("INSERT INTO auth.users(id) VALUES(%s),(%s),(%s) ON CONFLICT DO NOTHING",
        (P,D,OLD))
    conn.execute("""
       DELETE FROM public.user_roles WHERE user_id IN (%s,%s)
       AND role='passenger'::public.app_role
    """,(D,OLD))
    conn.execute("""
       INSERT INTO public.user_roles(user_id,role)
       VALUES(%s,'driver'::public.app_role),(%s,'driver'::public.app_role)
       ON CONFLICT DO NOTHING
    """,(D,OLD))
    for actor,sid in ((P,SP),(D,SD)):
        conn.execute("""
           INSERT INTO public.mobility_stage_g42_provider_session_grants
           (user_id,session_id,provider_confirmed_at,token_allowed_from,
            valid_until,evidence_kind)
           VALUES(%s,%s,clock_timestamp()-interval '1 day',
            clock_timestamp()-interval '1 minute',
            clock_timestamp()+interval '1 hour',
            'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')
        """,(actor,sid))
    conn.execute("""
      INSERT INTO public.mobility_stage_g50_race_source(
       id,passenger_id,driver_id,can_send)
      VALUES(%s,%s,%s,true)
    """,(SERVICE,P,D))
    conversation=conn.execute("""
      SELECT public.mobility_stage_g50_open_owner_qa('RIDE',%s,%s,%s,%s)
    """,(SERVICE,D,SD,AT)).fetchone()[0]["conversationId"]
    TICKET=mint(conn,"DRIVER_SEND",conversation)

barrier=Barrier(2)
def run_once():
    try:
        with db() as conn:
            conn.execute("SET LOCAL ROLE mobility_g56_driver_gateway_ci")
            assert conn.execute("SELECT current_user").fetchone()[0]=="mobility_g56_driver_gateway_ci"
            barrier.wait(timeout=15)
            result=conn.execute("""
              SELECT public.mobility_stage_g56_send_qa(%s,%s,%s)
            """,(TICKET,KEY,"Voy llegando")).fetchone()[0]
            return ("OK",result)
    except psycopg.Error as e:
        return ("DENIED",e.sqlstate)

with ThreadPoolExecutor(max_workers=2) as pool:
    a=pool.submit(run_once)
    b=pool.submit(run_once)
    outcomes=[a.result(timeout=25),b.result(timeout=25)]
success=[x for x in outcomes if x[0]=="OK"]
denied=[x for x in outcomes if x[0]=="DENIED"]
assert len(success)==1 and len(denied)==1,outcomes
assert denied[0][1]=="G5605",outcomes
ack=success[0][1]
assert ack["serverStored"] is True and ack["senderRole"]=="driver",ack

with db() as conn:
    count=conn.execute("""
      SELECT count(*) FROM public.mobility_stage_g50_chat_messages
      WHERE conversation_id=%s AND sender_id=%s AND request_key=%s
    """,(conversation,D,KEY)).fetchone()[0]
    assert count==1,count
    replay=mint(conn,"DRIVER_SEND",conversation)
same=delegated_send(replay,KEY,"Voy llegando")
assert same==ack,(ack,same)

with db() as conn:
    colliding=mint(conn,"DRIVER_SEND",conversation)
try:
    delegated_send(colliding,KEY,"Distinto")
except psycopg.Error as e:
    assert e.sqlstate=="G5009",e.sqlstate
else:
    raise AssertionError("G56 allowed conflicting Driver requestKey")

with db() as conn:
    stale=mint(conn,"DRIVER_SEND",conversation)
    conn.execute("UPDATE public.mobility_stage_g50_race_source SET driver_id=%s WHERE id=%s",
        (OLD,SERVICE))
try:
    delegated_send(stale,"56561100-0000-4656-8656-000000000402","Hola")
except psycopg.Error as e:
    assert e.sqlstate in ("G5604","G5003"),e.sqlstate
else:
    raise AssertionError("G56 old Driver survived reassignment")

with db() as conn:
    conn.execute("UPDATE public.mobility_stage_g50_race_source SET driver_id=%s WHERE id=%s",
        (D,SERVICE))
    held=mint(conn,"DRIVER_SEND",conversation)
    after=mint(conn,"DRIVER_SEND",conversation)

hold=db()
try:
    hold.execute("SET LOCAL ROLE mobility_g56_driver_gateway_ci")
    receipt=hold.execute("""
      SELECT public.mobility_stage_g56_send_qa(%s,%s,%s)
    """,(held,"56561100-0000-4656-8656-000000000403","Antes de revocar")).fetchone()[0]
    assert receipt["serverStored"] is True

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
        assert not future.done(),"G56 did not hold G42 session grant lock"
        hold.commit()
        future.result(timeout=15)
finally:
    hold.close()

try:
    delegated_send(after,"56561100-0000-4656-8656-000000000404","Despues de revocar")
except psycopg.Error as e:
    assert e.sqlstate=="G5601",e.sqlstate
else:
    raise AssertionError("G56 consumed ticket after revocation")

print("G56 PASS: one ticket one commit across connections, replay exact, reassignment and revocation fenced")
