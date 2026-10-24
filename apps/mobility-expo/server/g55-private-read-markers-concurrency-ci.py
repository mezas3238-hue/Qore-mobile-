#!/usr/bin/env python3
"""G55: two real PostgreSQL 16 delegated sessions compete for SAME opaque
server-issued read marker via separate valid CHAT_READ tickets. QA ONLY."""
import os
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import psycopg

assert os.environ.get("PGHOST")=="localhost"
assert os.environ.get("PGDATABASE")=="qore_disposable_chain"
assert os.environ.get("PGAPPNAME")=="qore_ci_disposable_chain"
P="55550000-0000-4555-8555-000000000021"
D="55550000-0000-4555-8555-000000000022"
SP="55550000-0000-4555-8555-000000000121"
SD="55550000-0000-4555-8555-000000000122"
SERVICE="55550000-0000-4555-8555-000000000720"
KEY="55550000-0000-4555-8555-000000000721"
AT=int(time.time()*1000)

def db():
    return psycopg.connect(
        host=os.environ["PGHOST"],port=os.environ.get("PGPORT","5432"),
        user=os.environ["PGUSER"],password=os.environ["PGPASSWORD"],
        dbname=os.environ["PGDATABASE"],
        options="-c application_name=qore_ci_disposable_chain",
    )

def mint_read(conn,conversation):
    return conn.execute("""
      SELECT public.mobility_stage_g54_mint_owner_qa(%s,%s,%s,'CHAT_READ',%s)
    """,(P,SP,AT,conversation)).fetchone()[0]["ticket"]

def mint_marker(conn,conversation):
    ticket=conn.execute("""
      SELECT public.mobility_stage_g49_mint_owner_qa(
        %s,%s,%s,'CHAT_HISTORY','RIDE',%s,%s)
    """,(P,SP,AT,SERVICE,conversation)).fetchone()[0]["ticket"]
    envelope=conn.execute("""
      SELECT public.mobility_stage_g55_history_marker_qa(%s,NULL,NULL,100)
    """,(ticket,)).fetchone()[0]
    assert envelope["readMarker"] and envelope["page"]["messages"]
    assert envelope["readMarker"]["messageId"]==envelope["page"]["messages"][0]["messageId"]
    return envelope["readMarker"]["marker"]

with db() as conn:
    conn.execute("INSERT INTO auth.users(id) VALUES(%s),(%s) ON CONFLICT DO NOTHING",(P,D))
    conn.execute("DELETE FROM public.user_roles WHERE user_id=%s AND role='passenger'::public.app_role",(D,))
    conn.execute("""
      INSERT INTO public.user_roles(user_id,role) VALUES(%s,'driver'::public.app_role)
      ON CONFLICT DO NOTHING""",(D,))
    for actor,session in ((P,SP),(D,SD)):
        conn.execute("""
        INSERT INTO public.mobility_stage_g42_provider_session_grants(
          user_id,session_id,provider_confirmed_at,token_allowed_from,
          valid_until,evidence_kind)
        VALUES(%s,%s,clock_timestamp()-interval '1 day',
          clock_timestamp()-interval '1 minute',
          clock_timestamp()+interval '1 hour',
          'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')
        """,(actor,session))
    conn.execute("""
      INSERT INTO public.mobility_stage_g50_race_source(
        id,passenger_id,driver_id,can_send)
      VALUES(%s,%s,%s,true)
    """,(SERVICE,P,D))
    CID=conn.execute("""
      SELECT public.mobility_stage_g50_open_owner_qa('RIDE',%s,%s,%s,%s)
    """,(SERVICE,P,SP,AT)).fetchone()[0]["conversationId"]
    message=conn.execute("""
      SELECT public.mobility_stage_g50_send_owner_qa(%s,%s,%s,%s,%s,%s)
    """,(CID,D,SD,AT,KEY,"Estoy llegando")).fetchone()[0]
    SEQ=message["seq"]
    MARKER=mint_marker(conn,CID)
    tickets=[mint_read(conn,CID),mint_read(conn,CID)]
    revision_before=conn.execute("""
      SELECT revision FROM public.mobility_stage_g51_inbox_revisions
      WHERE passenger_id=%s
    """,(P,)).fetchone()[0]

barrier=Barrier(2)
def read_once(ticket):
    try:
        with db() as conn:
            conn.execute("SET LOCAL ROLE mobility_g49_chat_gateway_ci")
            assert conn.execute("SELECT current_user").fetchone()[0]=="mobility_g49_chat_gateway_ci"
            barrier.wait(timeout=15)
            accepted=conn.execute("""
              SELECT public.mobility_stage_g55_mark_viewed_qa(%s,%s)
            """,(ticket,MARKER)).fetchone()[0]
            return ("OK",accepted)
    except psycopg.Error as exc:
        return ("ERROR",exc.sqlstate)

with ThreadPoolExecutor(max_workers=2) as pool:
    f=pool.submit(read_once,tickets[0])
    g=pool.submit(read_once,tickets[1])
    actual=[f.result(timeout=25),g.result(timeout=25)]
success=[x for x in actual if x[0]=="OK"]
fail=[x for x in actual if x[0]=="ERROR"]
assert len(success)==1 and success[0][1]["readThrough"]==SEQ,actual
assert len(fail)==1 and fail[0][1]=="G5505",actual

with db() as conn:
    assert conn.execute("""
     SELECT count(*) FROM public.mobility_stage_g51_chat_reads
     WHERE conversation_id=%s AND actor_id=%s AND through_seq=%s
    """,(CID,P,SEQ)).fetchone()[0]==1
    assert conn.execute("""
     SELECT revision FROM public.mobility_stage_g51_inbox_revisions
     WHERE passenger_id=%s
    """,(P,)).fetchone()[0]==revision_before+1
    second_marker=mint_marker(conn,CID)
    second_ticket=mint_read(conn,CID)
    conn.execute("""
      UPDATE public.mobility_stage_g42_provider_session_grants
       SET revoked_at=clock_timestamp(),revision=revision+1
       WHERE user_id=%s AND session_id=%s
    """,(P,SP))

try:
    with db() as conn:
        conn.execute("SET LOCAL ROLE mobility_g49_chat_gateway_ci")
        conn.execute("""
          SELECT public.mobility_stage_g55_mark_viewed_qa(%s,%s)
        """,(second_ticket,second_marker))
except psycopg.Error as exc:
    assert exc.sqlstate=="G5401",f"Expected G5401 after revocation, got {exc.sqlstate}"
else:
    raise AssertionError("G55 marker accepted after SQL session revocation")

print("G55 PASS: real delegated two-ticket race one read; second marker blocked by revocation")
