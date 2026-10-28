#!/usr/bin/env python3
"""G57B Driver ordered Passenger receipts — real two-session PostgreSQL16 QA.
Race two adjacent Passenger markers; later message cannot commit before
earlier one. Session revocation fence. LOCAL disposable database ONLY.
"""
import os
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import psycopg

assert os.environ.get("PGHOST")=="localhost"
assert os.environ.get("PGDATABASE")=="qore_disposable_chain"
assert os.environ.get("PGAPPNAME")=="qore_ci_disposable_chain"
P="57572100-0000-4757-8757-000000000001"
D="57572100-0000-4757-8757-000000000002"
SP="57572100-0000-4757-8757-000000000101"
SD="57572100-0000-4757-8757-000000000102"
SERVICE="57572100-0000-4757-8757-000000000201"
AT=int(time.time()*1000)

def db():
    return psycopg.connect(host=os.environ["PGHOST"],
     port=os.environ.get("PGPORT","5432"),user=os.environ["PGUSER"],
     password=os.environ["PGPASSWORD"],dbname=os.environ["PGDATABASE"],
     options="-c application_name=qore_ci_disposable_chain")

def readticket(conn,cid):
    return conn.execute("""
      SELECT public.mobility_stage_g57b_mint_read_owner_qa(%s,%s,%s,%s)
    """,(D,SD,AT,cid)).fetchone()[0]["ticket"]

def markers(conn,cid):
    ticket=conn.execute("""
      SELECT public.mobility_stage_g56_mint_owner_qa(
       %s,%s,%s,'DRIVER_HISTORY','RIDE',%s,%s)
    """,(D,SD,AT,SERVICE,cid)).fetchone()[0]["ticket"]
    envelope=conn.execute("""
      SELECT public.mobility_stage_g57b_driver_history_markers_qa(
       %s,NULL,NULL,100)
    """,(ticket,)).fetchone()[0]
    assert envelope["page"]["ownerId"]==D
    assert envelope["page"]["counterpartRole"]=="passenger"
    return {m["messageId"]:m["marker"] for m in envelope["readMarkers"]}

with db() as conn:
    conn.execute("INSERT INTO auth.users(id) VALUES(%s),(%s) ON CONFLICT DO NOTHING",(P,D))
    conn.execute("DELETE FROM public.user_roles WHERE user_id=%s AND role='passenger'::public.app_role",(D,))
    conn.execute("""
      INSERT INTO public.user_roles(user_id,role) VALUES(%s,'driver'::public.app_role)
      ON CONFLICT DO NOTHING
    """,(D,))
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
    cid=conn.execute("""
      SELECT public.mobility_stage_g50_open_owner_qa('RIDE',%s,%s,%s,%s)
    """,(SERVICE,D,SD,AT)).fetchone()[0]["conversationId"]
    first=conn.execute("""
      SELECT public.mobility_stage_g50_send_owner_qa(
       %s,%s,%s,%s,%s,'Primer cliente')
    """,(cid,P,SP,AT,"57572100-0000-4757-8757-000000000401")).fetchone()[0]
    second=conn.execute("""
      SELECT public.mobility_stage_g50_send_owner_qa(
       %s,%s,%s,%s,%s,'Segundo cliente')
    """,(cid,P,SP,AT,"57572100-0000-4757-8757-000000000402")).fetchone()[0]
    marker=markers(conn,cid)
    assert len(marker)==2
    first_marker=marker[first["messageId"]]
    second_marker=marker[second["messageId"]]
    t1=readticket(conn,cid)
    t2=readticket(conn,cid)
    first_seq=first["seq"]
    second_seq=second["seq"]

barrier=Barrier(2)
def mark(token,message_marker):
    try:
        with db() as conn:
            conn.execute("SET LOCAL ROLE mobility_g56_driver_gateway_ci")
            assert conn.execute("SELECT current_user").fetchone()[0]=="mobility_g56_driver_gateway_ci"
            barrier.wait(timeout=15)
            ack=conn.execute("""
              SELECT public.mobility_stage_g57b_driver_mark_visible_qa(%s,%s)
            """,(token,message_marker)).fetchone()[0]
            return ("OK",ack)
    except psycopg.Error as exc:
        return ("DENIED",exc.sqlstate)

with ThreadPoolExecutor(max_workers=2) as pool:
    a=pool.submit(mark,t1,first_marker)
    b=pool.submit(mark,t2,second_marker)
    outcomes=[a.result(timeout=25),b.result(timeout=25)]

assert outcomes[0][0]=="OK" and outcomes[0][1]["messageId"]==first["messageId"],outcomes
assert outcomes[1][0]=="OK" or outcomes[1]==("DENIED","G5718"),outcomes

with db() as conn:
    current=conn.execute("""
      SELECT through_seq FROM public.mobility_stage_g51_chat_reads
      WHERE conversation_id=%s AND actor_id=%s
    """,(cid,D)).fetchone()[0]
    if outcomes[1][0]=="OK":
        assert current==second_seq,(current,outcomes)
    else:
        assert current==first_seq,(current,outcomes)
        retry=readticket(conn,cid)
        accepted=conn.execute("""
          SELECT public.mobility_stage_g57b_driver_mark_visible_qa(%s,%s)
        """,(retry,second_marker)).fetchone()[0]
        assert accepted["messageId"]==second["messageId"]

# Validate G42 lock-to-revocation ordering while third message's receipt
# transaction is held open. Remaining ticket minted pre-revocation must fail.
with db() as conn:
    third=conn.execute("""
      SELECT public.mobility_stage_g50_send_owner_qa(
       %s,%s,%s,%s,%s,'Tercer cliente')
    """,(cid,P,SP,AT,"57572100-0000-4757-8757-000000000403")).fetchone()[0]
    marker3=markers(conn,cid)[third["messageId"]]
    active=readticket(conn,cid)
    stale=readticket(conn,cid)
holder=db()
try:
    holder.execute("SET LOCAL ROLE mobility_g56_driver_gateway_ci")
    ack=holder.execute("""
      SELECT public.mobility_stage_g57b_driver_mark_visible_qa(%s,%s)
    """,(active,marker3)).fetchone()[0]
    assert ack["messageId"]==third["messageId"]
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
        assert not future.done(),"G57B read did not fence G42 revocation"
        holder.commit()
        future.result(timeout=15)
finally:
    holder.close()

try:
    with db() as conn:
        conn.execute("SET LOCAL ROLE mobility_g56_driver_gateway_ci")
        conn.execute("""
          SELECT public.mobility_stage_g57b_driver_mark_visible_qa(%s,%s)
        """,(stale,marker3))
except psycopg.Error as exc:
    assert exc.sqlstate=="G5711",exc.sqlstate
else:
    raise AssertionError("G57B consumed pre-revocation capability after revocation")

print("G57B PASS: concurrent first unread Passenger, G42 revocation, real delegated Driver role")
