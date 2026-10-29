#!/usr/bin/env python3
"""G200 MOTO: completed original G118 ride, passenger and Driver, never generic chat."""
import os,time,uuid
import psycopg
assert os.getenv('PGHOST')=='localhost'
assert os.getenv('PGDATABASE')=='qore_disposable_chain'
assert os.getenv('PGAPPNAME')=='qore_ci_disposable_chain'
P='19900000-0000-4199-8199-000000000021'
D='10900000-0000-4109-8109-000000000022'
S='20000000-0000-4200-8200-000000000001'
T='20000000-0000-4200-8200-000000000002'
AT=int(time.time()*1000)
def key():return str(uuid.uuid4())
def db():return psycopg.connect(host='localhost',port=os.getenv('PGPORT','5432'),
 user=os.environ['PGUSER'],password=os.environ['PGPASSWORD'],dbname='qore_disposable_chain',
 options='-c application_name=qore_ci_disposable_chain')
def denied(c,code,sql,*args):
 try:
  with c.transaction():c.execute(sql,args)
 except psycopg.Error as err:
  assert err.sqlstate==code,(code,err.sqlstate,str(err))
 else:raise AssertionError('G200 unauthorized MOTO contact allowed')
OPEN='SELECT public.mobility_stage_g200_open_case_qa(%s,%s,%s,%s)'
READ='SELECT public.mobility_stage_g200_read_case_qa(%s,%s,%s,%s)'
SEND='SELECT public.mobility_stage_g200_send_message_qa(%s,%s,%s,%s,%s,%s)'
BLOCK='SELECT public.mobility_stage_g200_close_case_qa(%s,%s,%s,%s,%s)'
INBOX='SELECT public.mobility_stage_g200_driver_inbox_qa(%s,%s,%s)'
with db() as c:
 # G118's completed QA fixture models legal-proof-absent mechanics; it is NOT
 # a municipal authorization or a remotely accepted commercial booking.
 ride=c.execute("""SELECT id FROM public.mobility_stage_g100_moto_trips
  WHERE passenger_id=%s AND driver_id=%s AND status='completed'
  AND completed_at>clock_timestamp()-interval '7 days'
  ORDER BY id LIMIT 1""",(P,D)).fetchone()
 assert ride is not None,'G118 completed Moto fixture absent'
 # G199 created this explicit owner-only completed MOTO fixture; the original
 # G109 Driver already has the exclusive Driver role. No fake legal approval.
 for who,sid in [(P,S),(D,T)]:
  c.execute("""INSERT INTO public.mobility_stage_g42_provider_session_grants
 (user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
 VALUES(%s,%s,clock_timestamp()-interval '1 day',
 clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',
 'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')""",(who,sid))
 opened=c.execute(OPEN,(P,S,AT,ride[0])).fetchone()[0]
 case=opened['caseId']
 assert opened['tripId']==ride[0]
 assert c.execute(OPEN,(P,S,AT,ride[0])).fetchone()[0]['caseId']==case
 denied(c,'P2003',OPEN,D,T,AT,ride[0])
 inbox=c.execute(INBOX,(D,T,AT)).fetchone()[0]
 assert inbox['cases'][0]['caseId']==case
 denied(c,'P2003',INBOX,P,S,AT)
 assert c.execute(READ,(case,P,S,AT)).fetchone()[0]['canSend'] is True
 k=key()
 m=c.execute(SEND,(case,P,S,AT,k,'Olvide un casco azul.')).fetchone()[0]
 assert m['serverPersisted'] is True
 assert c.execute(SEND,(case,P,S,AT,k,'Olvide un casco azul.')).fetchone()[0]==m
 denied(c,'P2006',SEND,case,P,S,AT,k,'Ahora una bolsa')
 denied(c,'P2001',SEND,case,P,S,AT,key(),'Llamame al 0981123456')
 response=c.execute(SEND,(case,D,T,AT,key(),
 'Encontrado, coordinemos por soporte QORE.')).fetchone()[0]
 assert response['serverPersisted'] is True
 assert len(c.execute(READ,(case,D,T,AT)).fetchone()[0]['messages'])==2
 assert c.execute(BLOCK,(case,P,S,AT,True)).fetchone()[0] is True
 denied(c,'P2005',SEND,case,D,T,AT,key(),'Otro mensaje')
 c.execute("""UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=clock_timestamp(),revision=revision+1
 WHERE user_id=%s AND session_id=%s""",(D,T))
 denied(c,'P2002',READ,case,D,T,AT)
 for role in ['anon','authenticated','mobility_g48_gateway_ci']:
  c.execute('SET LOCAL ROLE '+role)
  denied(c,'42501',SEND,case,P,S,AT,key(),'Ataque')
  c.execute('RESET ROLE')
print('G200 PASS: Moto original completed trip, seven-day Passenger/Driver private messages, no phone, idempotency, blocked contact, revoked Driver, never LIVE')
