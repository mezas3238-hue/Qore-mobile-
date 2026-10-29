#!/usr/bin/env python3
"""G198: original completed G109 ride -> distinct private lost-items messages."""
import os,time,uuid
import psycopg
assert os.environ.get('PGHOST')=='localhost'
assert os.environ.get('PGDATABASE')=='qore_disposable_chain'
assert os.environ.get('PGAPPNAME')=='qore_ci_disposable_chain'
P='10900000-0000-4109-8109-000000000021'
D='10900000-0000-4109-8109-000000000022'
V='10900000-0000-4109-8109-000000000024'
R='19800000-0000-4198-8198-000000000021'
PS='19800000-0000-4198-8198-000000000031'
DS='19800000-0000-4198-8198-000000000032'
AT=int(time.time()*1000)
def new():return str(uuid.uuid4())
def db():return psycopg.connect(host='localhost',port=os.getenv('PGPORT','5432'),
 user=os.environ['PGUSER'],password=os.environ['PGPASSWORD'],
 dbname='qore_disposable_chain',
 options='-c application_name=qore_ci_disposable_chain')
OPEN='SELECT public.mobility_stage_g198_open_case_qa(%s,%s,%s,%s)'
SEND='SELECT public.mobility_stage_g198_send_message_qa(%s,%s,%s,%s,%s,%s)'
READ='SELECT public.mobility_stage_g198_read_case_qa(%s,%s,%s,%s)'
CLOSE='SELECT public.mobility_stage_g198_close_case_qa(%s,%s,%s,%s,%s)'
def denied(c,code,stmt,*args):
 try:
  with c.transaction():c.execute(stmt,args)
 except psycopg.Error as e:
  assert e.sqlstate==code,(code,e.sqlstate,str(e))
 else:raise AssertionError('G198 forbidden contact allowed')
with db() as c:
 # A completed QA trip must have exact original Driver and Passenger.
 # Fixture is directly inserted with USER triggers disabled, NEVER via LIVE.
 c.execute('ALTER TABLE public.mobility_stage_auto_demo_trips DISABLE TRIGGER USER')
 try:
  c.execute("""INSERT INTO public.mobility_stage_auto_demo_trips
  (id,request_key,passenger_id,driver_id,vehicle_id,service,
   origin_tag,destination_tag,status,revision,changed_at)
  VALUES (%s,%s,%s,%s,%s,'economico','CENTRO','NORTE','completed',5,
   clock_timestamp())""",(R,new(),P,D,V))
 finally:
  c.execute('ALTER TABLE public.mobility_stage_auto_demo_trips ENABLE TRIGGER USER')
 for u,s in ((P,PS),(D,DS)):
  c.execute("""INSERT INTO public.mobility_stage_g42_provider_session_grants
  (user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
  VALUES(%s,%s,clock_timestamp()-interval '1 day',
  clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',
  'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')""",(u,s))
 opened=c.execute(OPEN,(P,PS,AT,R)).fetchone()[0]
 case=opened['caseId']
 assert opened['state']=='OPEN'
 assert c.execute(OPEN,(P,PS,AT,R)).fetchone()[0]['caseId']==case
 denied(c,'P9803',OPEN,D,DS,AT,R)
 assert c.execute(READ,(case,D,DS,AT)).fetchone()[0]['canSend'] is True
 inbox=c.execute('SELECT public.mobility_stage_g198_driver_inbox_qa(%s,%s,%s)',(D,DS,AT)).fetchone()[0]
 assert inbox['cases'][0]['caseId']==case
 denied(c,'P9803','SELECT public.mobility_stage_g198_driver_inbox_qa(%s,%s,%s)',P,PS,AT)
 k=new()
 receipt=c.execute(SEND,(case,P,PS,AT,k,'Olvide mi mochila negra.')).fetchone()[0]
 assert receipt['serverPersisted'] is True
 assert c.execute(SEND,(case,P,PS,AT,k,'Olvide mi mochila negra.')).fetchone()[0]==receipt
 denied(c,'P9806',SEND,case,P,PS,AT,k,'Olvide mi telefono.')
 denied(c,'P9801',SEND,case,P,PS,AT,new(),'Llamame al 0994123456')
 sent=c.execute(SEND,(case,D,DS,AT,new(),'Encontrada. Contacta a soporte para coordinar.')).fetchone()[0]
 assert sent['serverPersisted'] is True
 thread=c.execute(READ,(case,P,PS,AT)).fetchone()[0]
 assert len(thread['messages'])==2
 assert {m['senderRole'] for m in thread['messages']}=={'passenger','driver'}
 assert c.execute(CLOSE,(case,P,PS,AT,True)).fetchone()[0] is True
 denied(c,'P9805',SEND,case,D,DS,AT,new(),'Otra respuesta')
 denied(c,'P9805',READ,case,P,PS,AT)
 c.execute("""UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=clock_timestamp(),revision=revision+1
 WHERE user_id=%s AND session_id=%s""",(D,DS))
 denied(c,'P9802',READ,case,D,DS,AT)
 for role in ('anon','authenticated','mobility_g48_gateway_ci'):
  c.execute('SET LOCAL ROLE '+role)
  denied(c,'42501',SEND,case,P,PS,AT,new(),'Ataque')
  c.execute('RESET ROLE')
print('G198 PASS: same completed trip, original Passenger↔Driver, bounded chat, no phone, idempotent, block and revoked session, no LIVE')
