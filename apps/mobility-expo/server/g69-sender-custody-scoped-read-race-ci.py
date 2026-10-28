#!/usr/bin/env python3
"""G69 Sender SQL delegated, single-use proof; PG16 disposable only."""
import os,time,uuid
import psycopg
assert os.getenv('PGHOST')=='localhost'
assert os.getenv('PGDATABASE')=='qore_disposable_chain'
assert os.getenv('PGAPPNAME')=='qore_ci_disposable_chain'
SENDER='69000000-0000-4690-8690-000000000001'
OTHER='69000000-0000-4690-8690-000000000002'
SESSION='69000000-0000-4690-8690-000000000003'
OTHER_SESSION='69000000-0000-4690-8690-000000000004'
DELIVERY='69000000-0000-4690-8690-000000000005'
KEY='69000000-0000-4690-8690-000000000006'
IAT=int(time.time()*1000)
def uid():return str(uuid.uuid4())
def db():
 return psycopg.connect(host='localhost',port=os.getenv('PGPORT','5432'),
  user=os.environ['PGUSER'],password=os.environ['PGPASSWORD'],
  dbname='qore_disposable_chain',
  options='-c application_name=qore_ci_disposable_chain')
def denied(con,code,query,params=()):
 try:
  with con.transaction():
   con.execute(query,params).fetchone()
 except psycopg.Error as e:
  assert e.sqlstate==code,(code,e.sqlstate,str(e))
 else:raise AssertionError('G69 action bypassed refusal: '+query[:90])
def seed(con,p,who=SENDER,session=SESSION,delivery=DELIVERY,expiry='8 seconds'):
 con.execute("""INSERT INTO public.mobility_stage_g69_sender_read_proofs
 (proof_hash,sender_id,session_id,token_iat_ms,delivery_id,expires_at)
 VALUES(pg_catalog.sha256(pg_catalog.convert_to(%s::text,'UTF8')),
 %s,%s,%s,%s,pg_catalog.clock_timestamp()+ %s::interval)""",
 (p,who,session,IAT,delivery,expiry))
def redeem(con,p,role='mobility_g69_execute_ci'):
 con.execute('SET LOCAL ROLE '+role)
 try: return con.execute(
  'SELECT public.mobility_stage_g69_sender_exchange_qa(%s)',(p,)
 ).fetchone()[0]
 finally:con.execute('RESET ROLE')
with db() as con:
 con.execute('INSERT INTO auth.users(id) VALUES (%s),(%s) ON CONFLICT DO NOTHING',(SENDER,OTHER))
 for who,session in [(SENDER,SESSION),(OTHER,OTHER_SESSION)]:
  con.execute("""INSERT INTO public.mobility_stage_g42_provider_session_grants
  (user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
  VALUES(%s,%s,clock_timestamp()-interval '1 day',
   clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',
   'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')""",(who,session))
 assert con.execute("""SELECT count(*) FROM public.user_roles
  WHERE user_id IN (%s,%s) AND role='passenger'::public.app_role""",
  (SENDER,OTHER)).fetchone()[0]==2
 con.execute("""INSERT INTO public.mobility_stage_deliveries
  (id,request_key,sender_id,requested_vehicle_kind,category,grams,
  length_cm,width_cm,height_cm,pickup_tag,delivery_tag)
  VALUES(%s,%s,%s,'MOTO','PARCEL',1000,10,10,10,'NORTE_QA','CENTRO_QA')""",
  (DELIVERY,KEY,SENDER))
p=uid()
with db() as con:
 seed(con,p)
with db() as con:
 dto=redeem(con,p)
 assert dto==dict(mode='STAGING_DEMO_ONLY',deliveryId=DELIVERY,
  ownerId=SENDER,state='requested',revision=1,vehicleKind='MOTO',
  assignmentPersisted=False,proofVerified=False,qaOnly=True,
  productionEnabled=False,liveDeliveriesEnabled=False),dto
 # Only the one used proof row is changed. No delivery events or status writes.
 assert con.execute("""SELECT redeemed_at IS NOT NULL FROM
  public.mobility_stage_g69_sender_read_proofs
  WHERE proof_hash=pg_catalog.sha256(pg_catalog.convert_to(%s::text,'UTF8'))""",
  (p,)).fetchone()[0] is True
 assert con.execute("""SELECT status,revision FROM public.mobility_stage_deliveries
  WHERE id=%s""",(DELIVERY,)).fetchone()==('requested',1)
 denied(con,'G6902',
  'SELECT public.mobility_stage_g69_sender_exchange_qa(%s)',(p,))
# A Passenger with a distinct valid G42 session cannot use his proof
# to read another Passenger's delivery.
foreign=uid()
with db() as con:
 seed(con,foreign,who=OTHER,session=OTHER_SESSION)
with db() as con:
 con.execute('SET LOCAL ROLE mobility_g69_execute_ci')
 denied(con,'G6804',
  'SELECT public.mobility_stage_g69_sender_exchange_qa(%s)',(foreign,))
 con.execute('RESET ROLE')
 assert con.execute("""SELECT redeemed_at IS NULL FROM
  public.mobility_stage_g69_sender_read_proofs WHERE
  proof_hash=pg_catalog.sha256(pg_catalog.convert_to(%s::text,'UTF8'))""",
  (foreign,)).fetchone()[0] is True
# An expired proof remains unusable even if valid G42 session exists.
expired=uid()
with db() as con:
 con.execute("""INSERT INTO public.mobility_stage_g69_sender_read_proofs
 (proof_hash,sender_id,session_id,token_iat_ms,delivery_id,issued_at,expires_at)
 VALUES(pg_catalog.sha256(pg_catalog.convert_to(%s::text,'UTF8')),
 %s,%s,%s,%s,pg_catalog.clock_timestamp()-interval '30 seconds',
 pg_catalog.clock_timestamp()-interval '22 seconds')""",
 (expired,SENDER,SESSION,IAT,DELIVERY))
with db() as con:
 con.execute('SET LOCAL ROLE mobility_g69_execute_ci')
 denied(con,'G6902','SELECT public.mobility_stage_g69_sender_exchange_qa(%s)',(expired,))
 con.execute('RESET ROLE')
# Two concurrent consumers of the same scoped proof; no double read.
race=uid()
with db() as con:seed(con,race)
held=db()
try:
 out=redeem(held,race)
 assert out['deliveryId']==DELIVERY
 with db() as other:
  other.execute("SET LOCAL lock_timeout='200ms'")
  other.execute('SET LOCAL ROLE mobility_g69_execute_ci')
  denied(other,'55P03','SELECT public.mobility_stage_g69_sender_exchange_qa(%s)',(race,))
  other.execute('RESET ROLE')
 held.commit()
finally:held.close()
with db() as con:
 con.execute('SET LOCAL ROLE mobility_g69_execute_ci')
 denied(con,'G6902','SELECT public.mobility_stage_g69_sender_exchange_qa(%s)',(race,))
 con.execute('RESET ROLE')
# Revocation wins if committed before the exchange.
revoked=uid()
with db() as con:
 seed(con,revoked)
 con.execute("""UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=clock_timestamp(),revision=revision+1
 WHERE user_id=%s AND session_id=%s""",(SENDER,SESSION))
with db() as con:
 con.execute('SET LOCAL ROLE mobility_g69_execute_ci')
 denied(con,'G6802','SELECT public.mobility_stage_g69_sender_exchange_qa(%s)',(revoked,))
 con.execute('RESET ROLE')
# No other role can redeem, mint proof, or read G68 owner function.
for role in ['anon','authenticated','service_role',
 'mobility_g48_gateway_ci','mobility_g56_driver_gateway_ci',
 'mobility_g60c_execute_ci']:
 with db() as con:
  con.execute('SET LOCAL ROLE '+role)
  denied(con,'42501',
   'SELECT public.mobility_stage_g69_sender_exchange_qa(%s)',(uid(),))
  denied(con,'42501',
   'SELECT public.mobility_stage_g68_sender_custody_owner_qa(%s,%s,%s,%s)',
   (SENDER,SESSION,IAT,DELIVERY))
  con.execute('RESET ROLE')
print('G69 PASS: scoped Passenger DTO, one-use UUID, two-session row lock, no PII, foreign role/expired/revoked session and forbidden grants')
