#!/usr/bin/env python3
"""G59: PostgreSQL16 QA reconciliation after uncertain client HTTP outcome.
Explicit rollback != evidence for caller; no duplicate SEND; no LIVE DB.
"""
import os
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import psycopg

assert os.environ.get("PGHOST") == "localhost"
assert os.environ.get("PGDATABASE") == "qore_disposable_chain"
assert os.environ.get("PGAPPNAME") == "qore_ci_disposable_chain"
P="59590000-0000-4959-8959-000000000001"
D="59590000-0000-4959-8959-000000000002"
SP="59590000-0000-4959-8959-000000000101"
SD="59590000-0000-4959-8959-000000000102"
SID="59590000-0000-4959-8959-000000000200"
KEY="59590000-0000-4959-8959-000000000400"
KEY2="59590000-0000-4959-8959-000000000401"
BODY="Estoy cerca de la entrada"
AT=int(time.time()*1000)
SQL="""SELECT public.mobility_stage_g59_reconcile_passenger_owner_qa(
 'RIDE',%s,%s,%s,%s,%s,%s,%s)"""
SEND="""SELECT public.mobility_stage_g53_passenger_send_owner_qa(
 'RIDE',%s,%s,%s,%s,%s,%s,%s)"""

def db():
    return psycopg.connect(host="localhost",port=os.getenv("PGPORT","5432"),
        user=os.environ["PGUSER"],password=os.environ["PGPASSWORD"],
        dbname="qore_disposable_chain",
        options="-c application_name=qore_ci_disposable_chain")

def reconcile(key=KEY,body=BODY,actor=P,session=SP,service=SID,iat=AT):
    with db() as conn:
        return conn.execute(SQL,(service,CID,actor,session,iat,key,body)).fetchone()[0]

def send(key=KEY,body=BODY):
    with db() as conn:
        return conn.execute(SEND,(SID,CID,P,SP,AT,key,body)).fetchone()[0]

def denied(args,code):
    try:
        reconcile(**args)
    except psycopg.Error as exc:
        assert exc.sqlstate==code,(exc.sqlstate,code,str(exc))
    else:
        raise AssertionError("G59 accepted unauthorized reconciliation")

with db() as conn:
    conn.execute("INSERT INTO auth.users(id) VALUES(%s),(%s) ON CONFLICT DO NOTHING",(P,D))
    conn.execute("DELETE FROM public.user_roles WHERE user_id=%s AND role='passenger'::public.app_role",(D,))
    conn.execute("DELETE FROM public.user_roles WHERE user_id=%s AND role='driver'::public.app_role",(P,))
    conn.execute("""INSERT INTO public.user_roles(user_id,role) VALUES
      (%s,'passenger'::public.app_role),(%s,'driver'::public.app_role)
      ON CONFLICT DO NOTHING""",(P,D))
    for actor,session in [(P,SP),(D,SD)]:
        conn.execute("""INSERT INTO public.mobility_stage_g42_provider_session_grants(
          user_id,session_id,provider_confirmed_at,token_allowed_from,
          valid_until,evidence_kind)
         VALUES(%s,%s,clock_timestamp()-interval '1 day',
          clock_timestamp()-interval '1 minute',
          clock_timestamp()+interval '1 hour',
          'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')""",(actor,session))
    conn.execute("""INSERT INTO public.mobility_stage_g50_race_source(
      id,passenger_id,driver_id,can_send) VALUES (%s,%s,%s,true)""",(SID,P,D))
    CID=conn.execute(
        "SELECT public.mobility_stage_g50_open_owner_qa('RIDE',%s,%s,%s,%s)",
        (SID,P,SP,AT)).fetchone()[0]["conversationId"]

# Missing row is NEVER authorization to retry a mutating SEND automatically.
missing=reconcile()
assert missing=={"state":"NOT_YET_OBSERVED","serverStored":False,
 "retrySafe":False,"reconcileAgain":True,"qaOnly":True,"productionEnabled":False}

# A real committed message retains original G53 receipt after an HTTP loss.
original=send()
found=reconcile()
assert found["state"]=="COMMITTED" and found["ack"]==original,found
assert found["ack"]["revision"]==2 and found["latestRevision"]==2
assert found["historyRefreshRequired"] is False
assert found["retrySafe"] is False and found["reconcileAgain"] is False
assert reconcile()["ack"]==original

# Newer messages change G52 high-water mark; G53 original revision is immutable.
with db() as conn:
    driver_msg=conn.execute("""
      SELECT public.mobility_stage_g50_send_owner_qa(%s,%s,%s,%s,%s,%s)
    """,(CID,D,SD,AT,KEY2,"Voy llegando")).fetchone()[0]
assert driver_msg["serverStored"] is True
newer=reconcile()
assert newer["ack"]==original,newer
assert newer["latestRevision"]==3 and newer["historyRefreshRequired"] is True
assert newer["ack"]["revision"]==2

with db() as conn:
    assert conn.execute("""SELECT count(*) FROM public.mobility_stage_g50_chat_messages
     WHERE conversation_id=%s AND sender_id=%s AND request_key=%s""",
     (CID,P,KEY)).fetchone()[0]==1

# A deliberately rolled-back write must not turn into a confirmed ACK.
with db() as conn:
    conn.execute(SEND,(SID,CID,P,SP,AT,"59590000-0000-4959-8959-000000000450",
      "Este envio se revierte"))
    conn.rollback()
unknown=reconcile(key="59590000-0000-4959-8959-000000000450",
                  body="Este envio se revierte")
assert unknown["state"]=="NOT_YET_OBSERVED" and unknown["retrySafe"] is False

denied({"body":"Cuerpo diferente"},"G5909")
denied({"actor":D,"session":SD},"G5903")
denied({"session":SD},"G5001")
denied({"service":"59590000-0000-4959-8959-000000000998"},"G5903")
denied({"key":None},"G5902")
denied({"iat":1},"G5001")

# Uncommitted G42 SHARE lock in reconcile prevents racing revoke UPDATE.
holder=db()
try:
    got=holder.execute(SQL,(SID,CID,P,SP,AT,KEY,BODY)).fetchone()[0]
    assert got["state"]=="COMMITTED"
    with db() as competing:
        competing.execute("SET LOCAL lock_timeout='200ms'")
        try:
            competing.execute("""UPDATE public.mobility_stage_g42_provider_session_grants
              SET revoked_at=clock_timestamp(),revision=revision+1
              WHERE user_id=%s AND session_id=%s""",(P,SP))
        except psycopg.Error as exc:
            assert exc.sqlstate=="55P03",exc.sqlstate
        else:
            raise AssertionError("G59 did not fence revocation")
    holder.commit()
finally:
    holder.close()

with db() as conn:
    conn.execute("""UPDATE public.mobility_stage_g42_provider_session_grants
      SET revoked_at=clock_timestamp(),revision=revision+1
      WHERE user_id=%s AND session_id=%s""",(P,SP))
denied({},"G5001")

# Direct untrusted SQL roles may NOT call owner-only reconciliation.
for role in ("anon","authenticated","service_role",
    "mobility_g49_chat_gateway_ci","mobility_g56_driver_gateway_ci",
    "mobility_g58f_exchange_ci"):
    try:
        with db() as conn:
            conn.execute("SET LOCAL ROLE "+role)  # test allowlist only
            conn.execute(SQL,(SID,CID,P,SP,AT,KEY,BODY))
    except psycopg.Error as exc:
        assert exc.sqlstate=="42501",(role,exc.sqlstate)
    else:
        raise AssertionError("G59 public read capability leaked to "+role)

print("G59 PASS: immutable G53 ACK, G52 fresh head, denied conflict, missing != retry, G42 revocation, privilege fence (QA)")
