#!/usr/bin/env python3
"""G59B: Driver direct SEND lost-HTTP recovery, disposable PostgreSQL16 ONLY."""
import os,time
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import psycopg
assert os.environ.get('PGHOST')=='localhost'
assert os.environ.get('PGDATABASE')=='qore_disposable_chain'
assert os.environ.get('PGAPPNAME')=='qore_ci_disposable_chain'
P='59592000-0000-4959-8959-000000000001'
D='59592000-0000-4959-8959-000000000002'
PS='59592000-0000-4959-8959-000000000101'
DS='59592000-0000-4959-8959-000000000102'
SID='59592000-0000-4959-8959-000000000200'
KEY='59592000-0000-4959-8959-000000000401'
PKEY='59592000-0000-4959-8959-000000000403'
TEXT='Estoy llegando al punto'
AT=int(time.time()*1000)
QUERY="""SELECT public.mobility_stage_g59b_reconcile_driver_owner_qa(
 'RIDE',%s,%s,%s,%s,%s,%s,%s)"""
def db():
    return psycopg.connect(host='localhost',port=os.environ.get('PGPORT','5432'),
        user=os.environ['PGUSER'],password=os.environ['PGPASSWORD'],
        dbname='qore_disposable_chain',
        options='-c application_name=qore_ci_disposable_chain')
def reconcile(body=TEXT,actor=D,session=DS,key=KEY,service=SID):
    with db() as conn:
        return conn.execute(QUERY,(service,CID,actor,session,AT,key,body)).fetchone()[0]
def denied(code,**kw):
    try: reconcile(**kw)
    except psycopg.Error as ex:
        assert ex.sqlstate==code,(ex.sqlstate,code,str(ex))
    else: raise AssertionError('G59B unauthorized Driver reconcile succeeded')

with db() as conn:
    conn.execute('INSERT INTO auth.users(id) VALUES(%s),(%s) ON CONFLICT DO NOTHING',(P,D))
    conn.execute("""DELETE FROM public.user_roles WHERE
      (user_id=%s AND role='driver'::public.app_role)
      OR (user_id=%s AND role='passenger'::public.app_role)""",(P,D))
    conn.execute("""INSERT INTO public.user_roles(user_id,role) VALUES
      (%s,'passenger'::public.app_role),(%s,'driver'::public.app_role)
      ON CONFLICT DO NOTHING""",(P,D))
    for who,sess in ((P,PS),(D,DS)):
        conn.execute("""INSERT INTO public.mobility_stage_g42_provider_session_grants(
         user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
         VALUES(%s,%s,clock_timestamp()-interval '1 day',
          clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',
          'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')""",(who,sess))
    conn.execute("""INSERT INTO public.mobility_stage_g50_race_source(
     id,passenger_id,driver_id,can_send) VALUES(%s,%s,%s,true)""",(SID,P,D))
    CID=conn.execute("""SELECT public.mobility_stage_g50_open_owner_qa(
     'RIDE',%s,%s,%s,%s)""",(SID,D,DS,AT)).fetchone()[0]['conversationId']

unknown=reconcile()
assert unknown=={'state':'NOT_YET_OBSERVED','serverStored':False,
'retrySafe':False,'reconcileAgain':True,'qaOnly':True,'productionEnabled':False}
# Race two independently minted DRIVER_SEND capabilities for SAME requestKey.
with db() as conn:
    t1=conn.execute("""SELECT public.mobility_stage_g56_mint_owner_qa(
     %s,%s,%s,'DRIVER_SEND','RIDE',%s,%s)""",(D,DS,AT,SID,CID)).fetchone()[0]['ticket']
    t2=conn.execute("""SELECT public.mobility_stage_g56_mint_owner_qa(
     %s,%s,%s,'DRIVER_SEND','RIDE',%s,%s)""",(D,DS,AT,SID,CID)).fetchone()[0]['ticket']
barrier=Barrier(2)
def delegated(ticket):
    with db() as conn:
        conn.execute('SET LOCAL ROLE mobility_g56_driver_gateway_ci')
        barrier.wait(timeout=20)
        return conn.execute('SELECT public.mobility_stage_g56_send_qa(%s,%s,%s)',
                            (ticket,KEY,TEXT)).fetchone()[0]
with ThreadPoolExecutor(max_workers=2) as pool:
    first=pool.submit(delegated,t1);second=pool.submit(delegated,t2)
    x=first.result(timeout=30); y=second.result(timeout=30)
assert x==y and x['serverStored'] is True and x['senderRole']=='driver'
found=reconcile()
assert found['state']=='COMMITTED' and found['ack']==x,found
assert found['ack']['revision']==2 and found['latestRevision']==2
assert not found['historyRefreshRequired'] and found['retrySafe'] is False
with db() as conn:
    n=conn.execute("""SELECT count(*) FROM public.mobility_stage_g50_chat_messages
      WHERE conversation_id=%s AND sender_id=%s AND request_key=%s""",(CID,D,KEY)).fetchone()[0]
    assert n==1,n
    conn.execute("""SELECT public.mobility_stage_g50_send_owner_qa(
      %s,%s,%s,%s,%s,%s)""",(CID,P,PS,AT,PKEY,'Aqui estoy'))
newer=reconcile()
assert newer['ack']==x and newer['latestRevision']==3
assert newer['historyRefreshRequired'] is True and newer['ack']['revision']==2
denied('G5919',body='Distinto contenido')
denied('G5913',actor=P,session=PS)
denied('G5001',session=PS)
denied('G5913',service='59592000-0000-4959-8959-000000000997')
# A Driver no longer currently assigned loses the right to recover.
with db() as conn:
    conn.execute("UPDATE public.mobility_stage_g50_race_source SET can_send=false WHERE id=%s",(SID,))
denied('G5914')
with db() as conn:
    conn.execute("UPDATE public.mobility_stage_g50_race_source SET can_send=true WHERE id=%s",(SID,))
# Hold G42 lock through COMMIT when a Driver recovers original ACK.
holder=db()
try:
    assert holder.execute(QUERY,(SID,CID,D,DS,AT,KEY,TEXT)).fetchone()[0]['state']=='COMMITTED'
    with db() as revoker:
        revoker.execute("SET LOCAL lock_timeout='200ms'")
        try:
            revoker.execute("""UPDATE public.mobility_stage_g42_provider_session_grants
             SET revoked_at=clock_timestamp(),revision=revision+1
             WHERE user_id=%s AND session_id=%s""",(D,DS))
        except psycopg.Error as ex:
            assert ex.sqlstate=='55P03',ex.sqlstate
        else: raise AssertionError('G59B revocation overtook held session lock')
    holder.commit()
finally: holder.close()
with db() as conn:
    conn.execute("""UPDATE public.mobility_stage_g42_provider_session_grants
      SET revoked_at=clock_timestamp(),revision=revision+1
      WHERE user_id=%s AND session_id=%s""",(D,DS))
denied('G5001')
for role in ('anon','authenticated','service_role','mobility_g49_chat_gateway_ci',
             'mobility_g56_driver_gateway_ci','mobility_g58f_exchange_ci'):
    try:
        with db() as conn:
            conn.execute('SET LOCAL ROLE '+role)
            conn.execute(QUERY,(SID,CID,D,DS,AT,KEY,TEXT))
    except psycopg.Error as ex:
        assert ex.sqlstate=='42501',(role,ex.sqlstate)
    else: raise AssertionError('G59B leaked Driver recovery to '+role)
print('G59B PASS: Driver two SEND tickets one ACK; immutable revision after Passenger event, role/revoke and denied SQL (QA)')
