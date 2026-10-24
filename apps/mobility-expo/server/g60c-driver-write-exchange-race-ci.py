#!/usr/bin/env python3
"""G60C isolated PG16 two-connection delegated Driver send/reconcile.
No real JWT, real people, remote database or production endpoint.
"""
import os
import time
import uuid
from threading import Barrier
from concurrent.futures import ThreadPoolExecutor
import psycopg
for k,v in {"PGHOST":"localhost","PGDATABASE":"qore_disposable_chain",
            "PGAPPNAME":"qore_ci_disposable_chain"}.items():
    assert os.environ.get(k)==v, (k,"disposable-local required")
P='60602000-0000-4060-8060-000000000001'
D='60602000-0000-4060-8060-000000000002'
SP='60602000-0000-4060-8060-000000000101'
SD='60602000-0000-4060-8060-000000000102'
SVC='60602000-0000-4060-8060-000000000200'
KEY='60602000-0000-4060-8060-000000000301'
NEXT='60602000-0000-4060-8060-000000000302'
BODY='Estoy en camino al destino'
AT=int(time.time()*1000)
EXECUTOR='mobility_g60c_execute_ci'
SQL='SELECT public.mobility_stage_g60c_driver_exchange_qa(%s)'
def db():
    return psycopg.connect(host="localhost",port=os.getenv("PGPORT","5432"),
     dbname="qore_disposable_chain",user=os.environ["PGUSER"],
     password=os.environ["PGPASSWORD"],
     options="-c application_name=qore_ci_disposable_chain")
def seeded(op='DRIVER_SEND',actor=D,session=SD,iat=AT,
           service=SVC,conversation=None,key=KEY,body=BODY,old=False):
    proof=str(uuid.uuid4())
    with db() as conn:
        conn.execute("""
         INSERT INTO public.mobility_stage_g60c_driver_proofs(
          proof_hash,driver_id,session_id,token_iat_ms,
          operation,service_kind,service_id,conversation_id,
          request_key,message_body,issued_at,expires_at)
         VALUES(pg_catalog.sha256(pg_catalog.convert_to(%s,'UTF8')),
           %s,%s,%s,%s,'RIDE',%s,%s,%s,%s,
           clock_timestamp()-(CASE WHEN %s THEN interval '30 seconds' ELSE interval '0 seconds' END),
           clock_timestamp()+(CASE WHEN %s THEN interval '-20 seconds' ELSE interval '10 seconds' END))
        """,(proof,actor,session,iat,op,service,conversation or CID,key,body,old,old))
    return proof
def exchange(proof,role=EXECUTOR):
    with db() as conn:
        conn.execute('SET LOCAL ROLE '+role)
        return conn.execute(SQL,(proof,)).fetchone()[0]
def denied(proof,code,role=EXECUTOR):
    try: exchange(proof,role)
    except psycopg.Error as e:
        assert e.sqlstate==code,(code,e.sqlstate,str(e))
    else: raise AssertionError('G60C exchange unexpectedly succeeded')

with db() as conn:
    conn.execute("INSERT INTO auth.users(id) VALUES(%s),(%s) ON CONFLICT DO NOTHING",(P,D))
    conn.execute("""DELETE FROM public.user_roles WHERE
     (user_id=%s AND role='driver'::public.app_role)
     OR (user_id=%s AND role='passenger'::public.app_role)""",(P,D))
    conn.execute("""INSERT INTO public.user_roles(user_id,role) VALUES
     (%s,'passenger'::public.app_role),(%s,'driver'::public.app_role)
     ON CONFLICT DO NOTHING""",(P,D))
    for actor,sess in ((P,SP),(D,SD)):
        conn.execute("""INSERT INTO public.mobility_stage_g42_provider_session_grants(
          user_id,session_id,provider_confirmed_at,token_allowed_from,
          valid_until,evidence_kind)
          VALUES(%s,%s,clock_timestamp()-interval '1 day',
           clock_timestamp()-interval '1 minute',
           clock_timestamp()+interval '1 hour',
           'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')""",(actor,sess))
    conn.execute("""INSERT INTO public.mobility_stage_g50_race_source(
      id,passenger_id,driver_id,can_send) VALUES(%s,%s,%s,true)""",(SVC,P,D))
    CID=conn.execute("""SELECT public.mobility_stage_g50_open_owner_qa(
     'RIDE',%s,%s,%s,%s)""",(SVC,D,SD,AT)).fetchone()[0]['conversationId']

for role in ('anon','authenticated','service_role',
             'mobility_g56_driver_gateway_ci','mobility_g58f_exchange_ci'):
    denied(str(uuid.uuid4()),'42501',role)
recovery_unknown=exchange(seeded('DRIVER_RECONCILE'))
assert recovery_unknown=={'state':'NOT_YET_OBSERVED',
 'serverStored':False,'retrySafe':False,'reconcileAgain':True,
 'qaOnly':True,'productionEnabled':False},recovery_unknown
proof=seeded()
ack=exchange(proof)
assert ack['serverStored'] is True and ack['senderRole']=='driver' and ack['body']==BODY
assert ack['revision']==2
denied(proof,'G6012')  # one-use after successful committed send
with db() as conn:
    count=conn.execute("""SELECT count(*) FROM public.mobility_stage_g50_chat_messages
     WHERE conversation_id=%s AND sender_id=%s AND request_key=%s""",
     (CID,D,KEY)).fetchone()[0]
    assert count==1,count

recovery=exchange(seeded('DRIVER_RECONCILE'))
assert recovery['state']=='COMMITTED' and recovery['ack']==ack
assert recovery['latestRevision']==2 and recovery['historyRefreshRequired'] is False
# Distinct proof means exactly-once message, not exactly-once attempt:
# idempotency is guaranteed by original G50 (conversation,actor,requestKey).
two_proofs=(seeded(),seeded())
start=Barrier(2)
def compete(proof):
    start.wait(timeout=15)
    return exchange(proof)
with ThreadPoolExecutor(max_workers=2) as pool:
    a=pool.submit(compete,two_proofs[0])
    b=pool.submit(compete,two_proofs[1])
    assert a.result(timeout=25)==ack
    assert b.result(timeout=25)==ack
with db() as conn:
    count=conn.execute("""SELECT count(*) FROM public.mobility_stage_g50_chat_messages
      WHERE conversation_id=%s AND sender_id=%s AND request_key=%s""",
      (CID,D,KEY)).fetchone()[0]
    assert count==1,count
# Two DB callers contend for same opaque proof: exactly one wins.
same=seeded('DRIVER_RECONCILE')
start=Barrier(2)
def once():
    start.wait(timeout=15)
    try:return ('ok',exchange(same)['state'])
    except psycopg.Error as e:return ('denied',e.sqlstate)
with ThreadPoolExecutor(max_workers=2) as pool:
    x=pool.submit(once);y=pool.submit(once)
    assert sorted([x.result(timeout=25),y.result(timeout=25)])==[
        ('denied','G6012'),('ok','COMMITTED')]
denied(seeded('DRIVER_SEND',body='Contenido alterado'),'G5009')
denied(seeded('DRIVER_SEND',actor=P,session=SP),'G5603')
denied(seeded('DRIVER_SEND',session=SP),'G6013')
denied(seeded('DRIVER_SEND',iat=1000),'G6013')
denied(seeded('DRIVER_SEND',old=True),'G6012')
# Reconcile must remain authoritatively read-only with new head version.
with db() as conn:
    conn.execute("""SELECT public.mobility_stage_g50_send_owner_qa(
     %s,%s,%s,%s,%s,%s)""",(CID,P,SP,AT,NEXT,'Ya estoy esperando'))
    assert conn.execute("""SELECT count(*) FROM public.mobility_stage_g50_chat_messages
      WHERE conversation_id=%s""",(CID,)).fetchone()[0]==2
latest=exchange(seeded('DRIVER_RECONCILE'))
assert latest['ack']==ack and latest['ack']['revision']==2
assert latest['latestRevision']==3 and latest['historyRefreshRequired'] is True
with db() as conn:
    conn.execute("""UPDATE public.mobility_stage_g50_race_source
     SET can_send=false WHERE id=%s""",(SVC,))
denied(seeded('DRIVER_RECONCILE'),'G5914')
with db() as conn:
    conn.execute("""UPDATE public.mobility_stage_g50_race_source
     SET can_send=true WHERE id=%s""",(SVC,))
# Reconcile holds G42 row share until transaction COMMIT; competing revoke waits.
held=seeded('DRIVER_RECONCILE')
holder=db()
try:
    holder.execute('SET LOCAL ROLE '+EXECUTOR)
    assert holder.execute(SQL,(held,)).fetchone()[0]['state']=='COMMITTED'
    with db() as revoker:
        revoker.execute("SET LOCAL lock_timeout='200ms'")
        try:
            revoker.execute("""UPDATE public.mobility_stage_g42_provider_session_grants
              SET revoked_at=clock_timestamp(),revision=revision+1
              WHERE user_id=%s AND session_id=%s""",(D,SD))
        except psycopg.Error as e:
            assert e.sqlstate=='55P03',e.sqlstate
        else:raise AssertionError('G60C exchanged under a revocation race')
    holder.commit()
finally:holder.close()
with db() as conn:
    conn.execute("""UPDATE public.mobility_stage_g42_provider_session_grants
      SET revoked_at=clock_timestamp(),revision=revision+1
      WHERE user_id=%s AND session_id=%s""",(D,SD))
denied(seeded('DRIVER_RECONCILE'),'G6013')
print('G60C PASS: single-use SQL proof, restricted gateway, G42 fence, exact ACK and idempotent driver SEND after uncertainty')
