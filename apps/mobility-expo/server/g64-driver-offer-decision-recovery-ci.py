#!/usr/bin/env python3
"""G64 authoritative historical AUTO/DELIVERY decision, PostgreSQL16 QA only.
Uses previously committed G16 AUTO and G14 delivery acceptances, so G38's
deliberate no-live-accept policy remains intact.
"""
import os,time,uuid
from concurrent.futures import ThreadPoolExecutor
import psycopg
assert os.environ.get('PGHOST')=='localhost'
assert os.environ.get('PGDATABASE')=='qore_disposable_chain'
assert os.environ.get('PGAPPNAME')=='qore_ci_disposable_chain'
AT=int(time.time()*1000)
AUTO='00000000-0000-4000-8000-000000000181'
COURIER='00000000-0000-4000-8000-000000000103'
PASSENGER='00000000-0000-4000-8000-000000000102'
AUTO_KEY='00000000-0000-4000-8000-000000000187'
DELIVERY_KEY='00000000-0000-4000-8000-000000000168'
AUTO_SESSION='64640000-0000-4640-8640-000000000001'
COURIER_SESSION='64640000-0000-4640-8640-000000000002'
PASSENGER_SESSION='64640000-0000-4640-8640-000000000003'
QUERY="""SELECT public.mobility_stage_g64_reconcile_offer_decision_owner_qa(
 %s,%s,%s,%s,%s,%s,%s)"""
def db():
 return psycopg.connect(host='localhost',port=os.environ.get('PGPORT','5432'),
  user=os.environ['PGUSER'],password=os.environ['PGPASSWORD'],
  dbname='qore_disposable_chain',
  options='-c application_name=qore_ci_disposable_chain')
def recover(kind,offer,actor,session,key,action='accept',connection=None):
 params=(kind,offer,actor,session,AT,key,action)
 if connection is not None:
  return connection.execute(QUERY,params).fetchone()[0]
 with db() as conn:
  return conn.execute(QUERY,params).fetchone()[0]
def denied(code,*args):
 try:recover(*args)
 except psycopg.Error as e:
  assert e.sqlstate==code,(code,e.sqlstate,str(e))
 else:raise AssertionError('G64 wrongly allowed recovery')
with db() as conn:
 a=conn.execute("""SELECT id,decision_event_id FROM
 public.mobility_stage_auto_demo_offers
 WHERE driver_id=%s AND decision_key=%s AND status='accepted'""",
 (AUTO,AUTO_KEY)).fetchone()
 d=conn.execute("""SELECT id,decision_event_id FROM
 public.mobility_stage_delivery_offers
 WHERE courier_id=%s AND decision_key=%s AND status='accepted'""",
 (COURIER,DELIVERY_KEY)).fetchone()
 assert a and d,('G16 AUTO and G14 courier durable fixtures missing',a,d)
 assert a[1] and d[1]
 AID=str(a[0]);DID=str(d[0])
 for who,session in [(AUTO,AUTO_SESSION),(COURIER,COURIER_SESSION),
                     (PASSENGER,PASSENGER_SESSION)]:
  conn.execute("""INSERT INTO public.mobility_stage_g42_provider_session_grants
   (user_id,session_id,provider_confirmed_at,token_allowed_from,
    valid_until,evidence_kind)
   VALUES(%s,%s,clock_timestamp()-interval '1 day',
    clock_timestamp()-interval '1 minute',
    clock_timestamp()+interval '1 hour',
    'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')""",(who,session))
 before=conn.execute("""SELECT
 (SELECT count(*) FROM public.mobility_stage_auto_demo_events),
 (SELECT count(*) FROM public.mobility_stage_delivery_events)""").fetchone()
auto=('AUTO_RIDE',AID,AUTO,AUTO_SESSION,AUTO_KEY)
delivery=('DELIVERY',DID,COURIER,COURIER_SESSION,DELIVERY_KEY)
for args,expected_id in ((auto,a[1]),(delivery,d[1])):
 r=recover(*args)
 assert r==dict(state='COMMITTED',offerId=args[1],
  requestKey=args[4],kind=args[0],action='accept',outcome='accepted',
  receiptId=str(expected_id),serverPersisted=True,liveEnabled=False,
  pushDelivered=False,qaOnly=True,productionEnabled=False,
  retrySafe=False,reconcileAgain=False),r
 denied('G6406',*args[:4],str(uuid.uuid4()))
 denied('G6406',*args,'decline')
# A valid authenticated Driver still cannot recover another Driver's offer.
denied('G6405','DELIVERY',DID,AUTO,AUTO_SESSION,DELIVERY_KEY)
denied('G6404','DELIVERY',DID,PASSENGER,PASSENGER_SESSION,DELIVERY_KEY)
denied('G6403','AUTO_RIDE',AID,AUTO,COURIER_SESSION,AUTO_KEY)
denied('G6402','MOTO_PASSENGER',AID,AUTO,AUTO_SESSION,AUTO_KEY)
# Read-only response while unobserved; do not conclude rollback, even after TTL.
with db() as conn:
 conn.execute('SAVEPOINT restore_fixture')
 conn.execute("""UPDATE public.mobility_stage_auto_demo_offers
  SET status='offered',decision_key=NULL,decision_event_id=NULL
  WHERE id=%s""",(AID,))
 r=recover(*auto,connection=conn)
 assert r==dict(state='NOT_YET_OBSERVED',qaOnly=True,
  productionEnabled=False,retrySafe=False,reconcileAgain=True),r
 conn.execute('ROLLBACK TO SAVEPOINT restore_fixture')
 conn.execute('RELEASE SAVEPOINT restore_fixture')
# Check parallel reads return the same immutable receipt without row mutation.
with ThreadPoolExecutor(max_workers=2) as pool:
 items=list(pool.map(lambda _:recover(*auto),range(2)))
 assert items[0]==items[1]
# G42 row lock must fence revocation in the same transaction.
held=db()
try:
 result=recover(*auto,connection=held)
 assert result['state']=='COMMITTED'
 with db() as revoke:
  revoke.execute("SET LOCAL lock_timeout='200ms'")
  try:revoke.execute("""UPDATE public.mobility_stage_g42_provider_session_grants
   SET revoked_at=clock_timestamp(),revision=revision+1
   WHERE user_id=%s AND session_id=%s""",(AUTO,AUTO_SESSION))
  except psycopg.Error as ex:
   assert ex.sqlstate=='55P03',ex.sqlstate
  else:raise AssertionError('G64 did not lock G42 against revocation')
 held.commit()
finally:held.close()
with db() as conn:
 conn.execute("""UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=clock_timestamp(),revision=revision+1
 WHERE user_id=%s AND session_id=%s""",(AUTO,AUTO_SESSION))
denied('G6403',*auto)
with db() as conn:
 after=conn.execute("""SELECT
 (SELECT count(*) FROM public.mobility_stage_auto_demo_events),
 (SELECT count(*) FROM public.mobility_stage_delivery_events)""").fetchone()
 assert before==after,(before,after)
# No direct client, service role or older gateway access to privileged recovery.
for role in ('anon','authenticated','service_role',
 'mobility_g48_gateway_ci','mobility_g56_driver_gateway_ci',
 'mobility_g60c_execute_ci'):
 try:
  with db() as conn:
   conn.execute('SET LOCAL ROLE '+role)
   recover(*delivery,connection=conn)
 except psycopg.Error as ex:
  assert ex.sqlstate=='42501',(role,ex.sqlstate)
 else:raise AssertionError('G64 leaked owner-only recovery to '+role)
print('G64 PASS: original AUTO/DELIVERY accepted event, unknown not rollback, role scope, no writes, G42 revocation fence')
