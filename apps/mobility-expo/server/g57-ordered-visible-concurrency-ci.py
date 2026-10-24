#!/usr/bin/env python3
"""G57: real PostgreSQL16 two-connection race for adjacent incoming messages.
Server must never persist a later read watermark before the earliest unread
Driver message. G42 revocation also fences already minted CHAT_READ tickets.
DISPOSABLE CI ONLY, no remote DB connection permitted.
"""
import os
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import psycopg

assert os.environ.get("PGHOST")=="localhost"
assert os.environ.get("PGDATABASE")=="qore_disposable_chain"
assert os.environ.get("PGAPPNAME")=="qore_ci_disposable_chain"
P="57571100-0000-4757-8757-000000000001"
D="57571100-0000-4757-8757-000000000002"
PS="57571100-0000-4757-8757-000000000101"
DS="57571100-0000-4757-8757-000000000102"
SERVICE="57571100-0000-4757-8757-000000000201"
AT=int(time.time()*1000)

def db():
    return psycopg.connect(host=os.environ["PGHOST"],
       port=os.environ.get("PGPORT","5432"),user=os.environ["PGUSER"],
       password=os.environ["PGPASSWORD"],dbname=os.environ["PGDATABASE"],
       options="-c application_name=qore_ci_disposable_chain")

def ticket(conn,cid):
    return conn.execute("""
      SELECT public.mobility_stage_g54_mint_owner_qa(
        %s,%s,%s,'CHAT_READ',%s)
    """,(P,PS,AT,cid)).fetchone()[0]["ticket"]

with db() as conn:
    conn.execute("INSERT INTO auth.users(id) VALUES(%s),(%s) ON CONFLICT DO NOTHING",(P,D))
    conn.execute("DELETE FROM public.user_roles WHERE user_id=%s AND role='passenger'::public.app_role",(D,))
    conn.execute("INSERT INTO public.user_roles(user_id,role) VALUES(%s,'driver'::public.app_role) ON CONFLICT DO NOTHING",(D,))
    for actor,sid in ((P,PS),(D,DS)):
        conn.execute("""
          INSERT INTO public.mobility_stage_g42_provider_session_grants(
            user_id,session_id,provider_confirmed_at,token_allowed_from,
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
    cid=conn.execute("""
      SELECT public.mobility_stage_g50_open_owner_qa('RIDE',%s,%s,%s,%s)
    """,(SERVICE,P,PS,AT)).fetchone()[0]["conversationId"]
    first=conn.execute("""
      SELECT public.mobility_stage_g50_send_owner_qa(
       %s,%s,%s,%s,%s,'Primer mensaje entrante')
    """,(cid,D,DS,AT,"57571100-0000-4757-8757-000000000401")).fetchone()[0]
    second=conn.execute("""
      SELECT public.mobility_stage_g50_send_owner_qa(
       %s,%s,%s,%s,%s,'Segundo mensaje entrante')
    """,(cid,D,DS,AT,"57571100-0000-4757-8757-000000000402")).fetchone()[0]
    capability=conn.execute("""
      SELECT public.mobility_stage_g49_mint_owner_qa(
       %s,%s,%s,'CHAT_HISTORY','RIDE',%s,%s)
    """,(P,PS,AT,SERVICE,cid)).fetchone()[0]["ticket"]
    envelope=conn.execute("""
      SELECT public.mobility_stage_g57_history_markers_qa(%s,NULL,NULL,100)
    """,(capability,)).fetchone()[0]
    marks={m["messageId"]:m["marker"] for m in envelope["readMarkers"]}
    assert len(marks)==2 and first["messageId"] in marks and second["messageId"] in marks
    first_marker=marks[first["messageId"]]
    second_marker=marks[second["messageId"]]
    first_ticket=ticket(conn,cid)
    second_ticket=ticket(conn,cid)
    first_seq=first["seq"]
    second_seq=second["seq"]

barrier=Barrier(2)
def mark(token,marker):
    try:
        with db() as conn:
            conn.execute("SET LOCAL ROLE mobility_g49_chat_gateway_ci")
            assert conn.execute("SELECT current_user").fetchone()[0]=="mobility_g49_chat_gateway_ci"
            barrier.wait(timeout=15)
            value=conn.execute("""
              SELECT public.mobility_stage_g57_mark_visible_ordered_qa(%s,%s)
            """,(token,marker)).fetchone()[0]
            return ("ACK",value)
    except psycopg.Error as exc:
        return ("DENY",exc.sqlstate)

with ThreadPoolExecutor(max_workers=2) as pool:
    first_future=pool.submit(mark,first_ticket,first_marker)
    second_future=pool.submit(mark,second_ticket,second_marker)
    results=[first_future.result(timeout=25),second_future.result(timeout=25)]

# First must succeed. Second can succeed only if first COMMITTED before it.
assert results[0][0]=="ACK" and results[0][1]["messageId"]==first["messageId"],results
assert results[1][0]=="ACK" or results[1]==("DENY","G5708"),results
with db() as conn:
    watermark=conn.execute("""
      SELECT through_seq FROM public.mobility_stage_g51_chat_reads
      WHERE conversation_id=%s AND actor_id=%s
    """,(cid,P)).fetchone()[0]
    if results[1][0]=="ACK":
        assert watermark==second_seq,(watermark,results)
    else:
        assert watermark==first_seq,(watermark,results)
        fresh=ticket(conn,cid)
        final=conn.execute("""
          SELECT public.mobility_stage_g57_mark_visible_ordered_qa(%s,%s)
        """,(fresh,second_marker)).fetchone()[0]
        assert final["messageId"]==second["messageId"],final

# A previously issued capability cannot persist a read after provider grant
# revocation. Issue new DRIVER message and marker while current session valid.
with db() as conn:
    third=conn.execute("""
      SELECT public.mobility_stage_g50_send_owner_qa(
       %s,%s,%s,%s,%s,'Tercer mensaje entrante')
    """,(cid,D,DS,AT,"57571100-0000-4757-8757-000000000403")).fetchone()[0]
    hist=conn.execute("""
      SELECT public.mobility_stage_g49_mint_owner_qa(
       %s,%s,%s,'CHAT_HISTORY','RIDE',%s,%s)
    """,(P,PS,AT,SERVICE,cid)).fetchone()[0]["ticket"]
    page=conn.execute("""
      SELECT public.mobility_stage_g57_history_markers_qa(%s,NULL,NULL,100)
    """,(hist,)).fetchone()[0]
    mark3=next(m["marker"] for m in page["readMarkers"]
       if m["messageId"]==third["messageId"])
    held=ticket(conn,cid)
    waiting=ticket(conn,cid)

hold=db()
try:
    hold.execute("SET LOCAL ROLE mobility_g49_chat_gateway_ci")
    receipt=hold.execute("""
      SELECT public.mobility_stage_g57_mark_visible_ordered_qa(%s,%s)
    """,(held,mark3)).fetchone()[0]
    assert receipt["messageId"]==third["messageId"]
    def revoke():
        with db() as conn:
            conn.execute("""
              UPDATE public.mobility_stage_g42_provider_session_grants
               SET revoked_at=clock_timestamp(),revision=revision+1
               WHERE user_id=%s AND session_id=%s
            """,(P,PS))
    with ThreadPoolExecutor(max_workers=1) as pool:
        future=pool.submit(revoke)
        time.sleep(.2)
        assert not future.done(),"G57 failed G42 grant lock vs revocation"
        hold.commit()
        future.result(timeout=15)
finally:
    hold.close()

try:
    with db() as conn:
        conn.execute("SET LOCAL ROLE mobility_g49_chat_gateway_ci")
        conn.execute("""
          SELECT public.mobility_stage_g57_mark_visible_ordered_qa(%s,%s)
        """,(waiting,mark3))
except psycopg.Error as exc:
    assert exc.sqlstate=="G5401",exc.sqlstate
else:
    raise AssertionError("G57 accepted previously issued ticket after provider revocation")

print("G57 PASS: two-session strict first unread order and provider revocation fencing")
