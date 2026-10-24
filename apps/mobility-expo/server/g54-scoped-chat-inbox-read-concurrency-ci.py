#!/usr/bin/env python3
"""G54 PostgreSQL16: actual delegated NOLOGIN role, concurrent ticket consumption
and session-revocation lock. DISPOSABLE PG only, synthetic data.
"""
import os
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import psycopg

assert os.environ.get("PGHOST") == "localhost"
assert os.environ.get("PGDATABASE") == "qore_disposable_chain"
assert os.environ.get("PGAPPNAME") == "qore_ci_disposable_chain"
P="54540000-0000-4454-8454-000000000021"
D="54540000-0000-4454-8454-000000000022"
SP="54540000-0000-4454-8454-000000000121"
SD="54540000-0000-4454-8454-000000000122"
SID="54540000-0000-4454-8454-000000000720"
KEY="54540000-0000-4454-8454-000000000721"
AT=int(time.time()*1000)

def db():
    return psycopg.connect(
        host=os.environ["PGHOST"],
        port=os.environ.get("PGPORT","5432"),
        user=os.environ["PGUSER"],password=os.environ["PGPASSWORD"],
        dbname=os.environ["PGDATABASE"],
        options="-c application_name=qore_ci_disposable_chain",
    )

with db() as conn:
    conn.execute("INSERT INTO auth.users(id) VALUES (%s),(%s) ON CONFLICT DO NOTHING",(P,D))
    conn.execute("DELETE FROM public.user_roles WHERE user_id=%s AND role='passenger'::public.app_role",(D,))
    conn.execute("INSERT INTO public.user_roles(user_id,role) VALUES (%s,'driver'::public.app_role) ON CONFLICT DO NOTHING",(D,))
    for actor,session in ((P,SP),(D,SD)):
        conn.execute("""
         INSERT INTO public.mobility_stage_g42_provider_session_grants(
          user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
         VALUES(%s,%s,clock_timestamp()-interval '1 day',
           clock_timestamp()-interval '1 minute',
           clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY')
        """,(actor,session))
    conn.execute("""
      INSERT INTO public.mobility_stage_g50_race_source(
        id,passenger_id,driver_id,can_send) VALUES(%s,%s,%s,true)
    """,(SID,P,D))
    CID=conn.execute(
        "SELECT public.mobility_stage_g50_open_owner_qa('RIDE',%s,%s,%s,%s)",
        (SID,P,SP,AT)).fetchone()[0]["conversationId"]
    sent=conn.execute(
        "SELECT public.mobility_stage_g50_send_owner_qa(%s,%s,%s,%s,%s,%s)",
        (CID,D,SD,AT,KEY,"Estoy llegando")).fetchone()[0]
    SEQ=conn.execute(
        "SELECT max(seq) FROM public.mobility_stage_g50_chat_messages WHERE conversation_id=%s",
        (CID,)).fetchone()[0]
    TICKET=conn.execute(
        "SELECT public.mobility_stage_g54_mint_owner_qa(%s,%s,%s,%s,%s)",
        (P,SP,AT,"CHAT_READ",CID)).fetchone()[0]["ticket"]

barrier=Barrier(2)
def consume_one():
    try:
        with db() as conn:
            conn.execute("SET LOCAL ROLE mobility_g49_chat_gateway_ci")
            assert conn.execute("SELECT current_user").fetchone()[0]=="mobility_g49_chat_gateway_ci"
            barrier.wait(timeout=15)
            result=conn.execute(
                "SELECT public.mobility_stage_g54_mark_read_qa(%s,%s)",
                (TICKET,SEQ)).fetchone()[0]
            return ("OK",result)
    except psycopg.Error as exc:
        return ("SQL",exc.sqlstate)

with ThreadPoolExecutor(max_workers=2) as pool:
    a=pool.submit(consume_one)
    b=pool.submit(consume_one)
    outcomes=[a.result(timeout=25),b.result(timeout=25)]
good=[x for x in outcomes if x[0]=="OK"]
bad=[x for x in outcomes if x[0]=="SQL"]
assert len(good)==1 and good[0][1]["readThrough"]==SEQ,outcomes
assert len(bad)==1 and bad[0][1]=="G5405",outcomes

with db() as conn:
    assert conn.execute("""
     SELECT count(*) FROM public.mobility_stage_g51_chat_reads
     WHERE conversation_id=%s AND actor_id=%s AND through_seq=%s
    """,(CID,P,SEQ)).fetchone()[0]==1
    inbox=conn.execute(
        "SELECT public.mobility_stage_g54_mint_owner_qa(%s,%s,%s,%s,%s)",
        (P,SP,AT,"CHAT_INBOX",None)).fetchone()[0]["ticket"]

# A delegated inbox transaction must hold its G42 grant lock until commit.
hold=db()
try:
    hold.execute("SET LOCAL ROLE mobility_g49_chat_gateway_ci")
    receipt=hold.execute(
        "SELECT public.mobility_stage_g54_inbox_qa(%s,%s,%s,%s,%s)",
        (inbox,None,None,None,100)).fetchone()[0]
    assert receipt["items"][0]["unreadCount"]==0
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
        assert not future.done(),"G54 delegated lock allowed concurrent grant revocation"
        hold.commit()
        future.result(timeout=15)
finally:
    hold.close()

with db() as conn:
    prev=conn.execute("""
       SELECT count(*) FROM public.mobility_stage_g51_chat_reads
       WHERE conversation_id=%s AND actor_id=%s
    """,(CID,P)).fetchone()[0]
    assert prev==1
    # Revoke old session and ensure a forged/leftover scope cannot pass.
    latest=conn.execute("""
       SELECT count(*) FROM public.mobility_stage_g54_chat_receipt_tickets
       WHERE session_id=%s AND operation='CHAT_INBOX' AND consumed_at IS NOT NULL
    """,(SP,)).fetchone()[0]
    assert latest==1
print("G54 PASS: one-use NOLOGIN concurrent read; G42 held lock blocks revocation; inbox unread zero")
