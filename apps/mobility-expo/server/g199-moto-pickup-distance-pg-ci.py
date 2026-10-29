#!/usr/bin/env python3
"""G199: MOTO passenger road-distance cap on G118 private offer.
Never mint a municipal/legal permit from synthetic distance.
"""
import os,time,uuid
import psycopg
assert os.environ.get('PGHOST')=='localhost'
assert os.environ.get('PGDATABASE')=='qore_disposable_chain'
assert os.environ.get('PGAPPNAME')=='qore_ci_disposable_chain'
D='10900000-0000-4109-8109-000000000022'
P='10900000-0000-4109-8109-000000000021'
S='19900000-0000-4199-8199-000000000011'
T='11800000-0000-4118-8118-000000000001'
AT=int(time.time()*1000)
def conn():return psycopg.connect(host='localhost',port=os.getenv('PGPORT','5432'),
 user=os.environ['PGUSER'],password=os.environ['PGPASSWORD'],
 dbname='qore_disposable_chain',options='-c application_name=qore_ci_disposable_chain')
def denied(c,code,sql,*args):
 try:
  with c.transaction():c.execute(sql,args)
 except psycopg.Error as exc:
  assert exc.sqlstate==code,(code,exc.sqlstate,str(exc))
 else:raise AssertionError('unauthorized G199 mutation or offer')
SAVE='SELECT public.mobility_stage_g197_save_pickup_qa(%s,%s,%s,%s,%s,%s)'
READ='SELECT public.mobility_stage_g197_read_pickup_qa(%s,%s,%s)'
CHECK='SELECT public.mobility_stage_g197_check_pickup_qa(%s,%s,%s)'
with conn() as c:
 c.execute("""INSERT INTO public.mobility_stage_g42_provider_session_grants
 (user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
 VALUES(%s,%s,clock_timestamp()-interval '1 day',
 clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',
 'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')""",(D,S))
 moto=c.execute("""SELECT id FROM public.mobility_stage_g100_moto_trips
 WHERE passenger_id=%s AND status='completed' ORDER BY id LIMIT 1""",(T,)).fetchone()
 assert moto is not None, 'G118 original completed MOTO fixture absent'
 trip=moto[0]
 original=c.execute(SAVE,(D,S,AT,'MOTO_RIDE',3000,0)).fetchone()[0]
 assert original['serviceKind']=='MOTO_RIDE' and original['revision']==1
 settings=c.execute(READ,(D,S,AT)).fetchone()[0]
 assert 'MOTO_RIDE' in {p['serviceKind'] for p in settings['preferences']}
 assert c.execute(CHECK,('MOTO_RIDE',trip,D)).fetchone()[0] is False
 denied(c,'P9701',SAVE,D,S,AT,'MOTO_RIDE',7000,1)
 denied(c,'P9704',SAVE,D,S,AT,'MOTO_RIDE',5000,0)
 denied(c,'P9703',SAVE,P,S,AT,'MOTO_RIDE',5000,0)
 # Even the SQL owner cannot slip an unverified/out-of-range offer past
 # the PostgreSQL before-insert trigger, regardless of MOTO legal state.
 offered="""INSERT INTO public.mobility_stage_g118_moto_offers
 (trip_id,driver_id,vehicle_id,request_key,expires_at)
 VALUES(%s,%s,%s,%s,clock_timestamp()+interval '30 seconds')"""
 denied(c,'P9905',offered,trip,D,str(uuid.uuid4()),str(uuid.uuid4()))
 road_id=str(uuid.uuid4())
 c.execute("""INSERT INTO public.mobility_stage_g197_verified_pickup_routes
 (service_kind,service_id,driver_id,distance_meters,road_evidence_id,
  verified_at,expires_at,source)
 VALUES('MOTO_RIDE',%s,%s,6100,%s,clock_timestamp(),
 clock_timestamp()+interval '60 seconds','INDEPENDENT_SERVER_ROAD_ROUTING')""",
 (trip,D,road_id))
 assert c.execute(CHECK,('MOTO_RIDE',trip,D)).fetchone()[0] is False
 denied(c,'P9905',offered,trip,D,str(uuid.uuid4()),str(uuid.uuid4()))
 c.execute("""UPDATE public.mobility_stage_g197_verified_pickup_routes
 SET distance_meters=2900 WHERE road_evidence_id=%s""",(road_id,))
 assert c.execute(CHECK,('MOTO_RIDE',trip,D)).fetchone()[0] is True
 assert c.execute(CHECK,('RIDE',trip,D)).fetchone()[0] is False
 c.execute(SAVE,(D,S,AT,'MOTO_RIDE',2000,1))
 assert c.execute(CHECK,('MOTO_RIDE',trip,D)).fetchone()[0] is False
 c.execute("""UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=clock_timestamp(),revision=revision+1
 WHERE user_id=%s AND session_id=%s""",(D,S))
 denied(c,'P9702',SAVE,D,S,AT,'MOTO_RIDE',50000,2)
 for role in ('anon','authenticated','mobility_g48_gateway_ci'):
  c.execute('SET LOCAL ROLE '+role)
  denied(c,'42501',SAVE,D,S,AT,'MOTO_RIDE',50000,2)
  c.execute('RESET ROLE')
print('G199 PASS: MOTO distance configured per Driver, no fake circular radius, out-of-range G118 offers blocked, no bypass of legal MOTO gate or commercial claims')
