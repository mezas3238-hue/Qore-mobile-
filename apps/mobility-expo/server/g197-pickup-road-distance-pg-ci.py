#!/usr/bin/env python3
"""G197: PostgreSQL owner preference, actual road-distance fence and revocation."""
import os,time,uuid
import psycopg
assert os.environ.get('PGHOST')=='localhost'
assert os.environ.get('PGDATABASE')=='qore_disposable_chain'
assert os.environ.get('PGAPPNAME')=='qore_ci_disposable_chain'
D='10900000-0000-4109-8109-000000000022'
P='10900000-0000-4109-8109-000000000021'
S='19700000-0000-4197-8197-000000000011'
T='19700000-0000-4197-8197-000000000021'
AT=int(time.time()*1000)
def db():return psycopg.connect(host='localhost',port=os.getenv('PGPORT','5432'),
 user=os.environ['PGUSER'],password=os.environ['PGPASSWORD'],
 dbname='qore_disposable_chain',
 options='-c application_name=qore_ci_disposable_chain')
def fail(c,expected,sql,*params):
 try:
  with c.transaction():c.execute(sql,params)
 except psycopg.Error as exc:
  assert exc.sqlstate==expected,(expected,exc.sqlstate,str(exc))
 else:raise AssertionError('unsafe G197 call was allowed')
SET='SELECT public.mobility_stage_g197_save_pickup_qa(%s,%s,%s,%s,%s,%s)'
GET='SELECT public.mobility_stage_g197_read_pickup_qa(%s,%s,%s)'
CHECK='SELECT public.mobility_stage_g197_check_pickup_qa(%s,%s,%s)'
with db() as c:
 c.execute("""INSERT INTO public.mobility_stage_g42_provider_session_grants
 (user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
 VALUES(%s,%s,clock_timestamp()-interval '1 day',
 clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',
 'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')""",(D,S))
 c.execute("""INSERT INTO public.mobility_stage_g42_provider_session_grants
 (user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
 VALUES(%s,%s,clock_timestamp()-interval '1 day',
 clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',
 'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')""",(P,T))
 assert c.execute(SET,(D,S,AT,'RIDE',5000,0)).fetchone()[0]['revision']==1
 assert c.execute(SET,(D,S,AT,'MERCHANT_ORDER',2000,0)).fetchone()[0]['maximumRoadMeters']==2000
 assert c.execute(GET,(D,S,AT)).fetchone()[0]['preferences'].__len__()==2
 fail(c,'P9704',SET,D,S,AT,'RIDE',10000,0)
 fail(c,'P9703',SET,P,T,AT,'RIDE',10000,0)
 fail(c,'P9701',SET,D,S,AT,'RIDE',777,1)
 assert c.execute(CHECK,('RIDE',T,D)).fetchone()[0] is False
 road_id=str(uuid.uuid4())
 c.execute("""INSERT INTO public.mobility_stage_g197_verified_pickup_routes
 (service_kind,service_id,driver_id,distance_meters,road_evidence_id,
  verified_at,expires_at,source)
 VALUES ('RIDE',%s,%s,7800,%s,clock_timestamp(),
 clock_timestamp()+interval '60 seconds','INDEPENDENT_SERVER_ROAD_ROUTING')""",
 (T,D,road_id))
 assert c.execute(CHECK,('RIDE',T,D)).fetchone()[0] is False
 c.execute("""UPDATE public.mobility_stage_g197_verified_pickup_routes
 SET distance_meters=4500 WHERE road_evidence_id=%s""",(road_id,))
 assert c.execute(CHECK,('RIDE',T,D)).fetchone()[0] is True
 # Owner explicitly disables RIDE while DELIVERY/COMMERCE preferences remain
 # distinct. A valid road route may never bypass this zero-metre OFF value.
 off=c.execute(SET,(D,S,AT,'RIDE',0,1)).fetchone()[0]
 assert off['maximumRoadMeters']==0 and off['revision']==2
 assert c.execute(CHECK,('RIDE',T,D)).fetchone()[0] is False
 restored=c.execute(SET,(D,S,AT,'RIDE',5000,2)).fetchone()[0]
 assert restored['revision']==3
 assert c.execute(CHECK,('RIDE',T,D)).fetchone()[0] is True
 assert c.execute(CHECK,('MERCHANT_ORDER',T,D)).fetchone()[0] is False
 assert c.execute(CHECK,('DELIVERY',T,D)).fetchone()[0] is True
 old=c.execute(SET,(D,S,AT,'RIDE',3000,3)).fetchone()[0]
 assert old['revision']==4
 assert c.execute(CHECK,('RIDE',T,D)).fetchone()[0] is False
 # Revoked IdP prevents *any* preference mutation even with valid JWT age.
 c.execute("""UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=clock_timestamp(),revision=revision+1
 WHERE user_id=%s AND session_id=%s""",(D,S))
 fail(c,'P9702',SET,D,S,AT,'RIDE',50000,4)
 for role in ('anon','authenticated','mobility_g48_gateway_ci'):
  c.execute('SET LOCAL ROLE '+role)
  fail(c,'42501',SET,D,S,AT,'RIDE',10000,2)
  fail(c,'42501',GET,D,S,AT)
  c.execute('RESET ROLE')
print('G197 PASS: 3 independently configurable pickup radii; meters by real road evidence, expired/forged/busy revoked default denied, no LIVE') 
