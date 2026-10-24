#!/usr/bin/env python3
"""G67: PG16 QA-only atomic proof / G42 session / G5 legacy RPC race."""
import os, uuid, time
import psycopg

assert os.environ.get('PGHOST') == 'localhost'
assert os.environ.get('PGDATABASE') == 'qore_disposable_chain'
assert os.environ.get('PGAPPNAME') == 'qore_ci_disposable_chain'
COURIER='00000000-0000-4000-8000-000000000181'
VEHICLE='00000000-0000-4000-8000-000000000184'
SENDER='b6670000-0000-4667-8667-000000000001'
SESSION='b6670000-0000-4667-8667-000000000002'
AT=int(time.time()*1000)
SHA='a'*64
def new():return str(uuid.uuid4())
def db():
 return psycopg.connect(host='localhost',port=os.environ.get('PGPORT','5432'),
  user=os.environ['PGUSER'],password=os.environ['PGPASSWORD'],
  dbname='qore_disposable_chain',
  options='-c application_name=qore_ci_disposable_chain')
def sql(conn,query,*params):return conn.execute(query,params)
def denied(conn,code,query,*args):
 try:
  with conn.transaction():
   sql(conn,query,*args)
 except psycopg.Error as e:
  assert e.sqlstate==code,(code,e.sqlstate,str(e))
 else:raise AssertionError('G67 unexpectedly authorized SQL '+query[:65])
MINT="""SELECT public.mobility_stage_g67_register_proof_owner_qa(
 %s,%s,%s,%s,%s,%s,%s,%s,clock_timestamp()+interval '10 minutes')"""
DELIVER="""SELECT public.mobility_stage_delivery_transition(%s,%s,'deliver',%s,%s)"""
PROBE="""SELECT public.mobility_stage_g67_proof_verified_owner_qa(%s,%s,%s)"""
with db() as con:
 sql(con,"INSERT INTO auth.users(id) VALUES(%s) ON CONFLICT DO NOTHING",SENDER)
 sql(con,"""INSERT INTO public.mobility_stage_g42_provider_session_grants
 (user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
 VALUES(%s,%s,clock_timestamp()-interval '1 day',
  clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',
  'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')""",COURIER,SESSION)
def fixture():
 did=new();rkey=new()
 with db() as con:
  # Synthetic owner-only fixture, no LIVE courier or acceptance. Build a
  # picked_up row without counterfeit API acceptance. Restore triggers before
  # testing the real G5 state transition and its G67 fence.
  assert sql(con,"""SELECT count(*) FROM public.mobility_stage_g36_driver_slots
   WHERE driver_id=%s""",COURIER).fetchone()[0]==0
  con.execute("ALTER TABLE public.mobility_stage_deliveries DISABLE TRIGGER USER")
  try:
   sql(con,"""INSERT INTO public.mobility_stage_deliveries(
    id,request_key,sender_id,courier_id,vehicle_id,requested_vehicle_kind,
    category,grams,length_cm,width_cm,height_cm,pickup_tag,delivery_tag,
    restricted_item_declared,status,revision)
    VALUES(%s,%s,%s,%s,%s,'AUTO','PARCEL',100,10,10,10,
    'CENTRO','NORTE',false,'picked_up',3)""",
    did,rkey,SENDER,COURIER,VEHICLE)
  finally:con.execute("ALTER TABLE public.mobility_stage_deliveries ENABLE TRIGGER USER")
  sql(con,"""INSERT INTO public.mobility_stage_g36_driver_slots(
   driver_id,assignment_kind,assignment_id) VALUES(%s,'DELIVERY',%s)""",COURIER,did)
 return did
def proof_for(did):
 p=new()
 with db() as con:
  result=sql(con,MINT,did,COURIER,SESSION,AT,p,SHA,'image/jpeg',512).fetchone()[0]
  assert str(result)==p
  assert sql(con,PROBE,did,COURIER,p).fetchone()[0] is True
 return p
first=fixture()
with db() as con:
 assert sql(con,PROBE,first,COURIER,new()).fetchone()[0] is False
 denied(con,'G6704',DELIVER,first,COURIER,new(),new())
 assert sql(con,"SELECT status FROM public.mobility_stage_deliveries WHERE id=%s",
  first).fetchone()[0]=='picked_up'
 denied(con,'G6701',MINT,first,COURIER,SESSION,AT,new(),'bad','image/jpeg',512)
 denied(con,'G6701',MINT,first,COURIER,SESSION,AT,new(),SHA,'image/svg+xml',512)
 denied(con,'G6703',MINT,first,SENDER,SESSION,AT,new(),SHA,'image/jpeg',512)
p=proof_for(first)
# Post-approval mutation with a different proof UUID still fails INSIDE G5.
with db() as con:
 denied(con,'G6704',DELIVER,first,COURIER,new(),new())
 denied(con,'G6704',DELIVER,first,COURIER,new(),p.upper() if False else new())
 assert sql(con,"SELECT consumed_at FROM public.mobility_stage_g67_delivery_proofs WHERE proof_ref=%s",
  p).fetchone()[0] is None
# Insert conflicting event revision; G5 row update/trigger runs and consumes
# proof, but following INSERT fails: whole UPDATE, proof consumption and slot
# release must revert with the SAVEPOINT.
with db() as con:
 con.execute('SAVEPOINT phantom')
 sql(con,"""INSERT INTO public.mobility_stage_delivery_events(
  request_key,delivery_id,actor_id,action,next_status,delivery_revision,proof_ref)
 VALUES(%s,%s,%s,'deliver','delivered',4,%s)""",new(),first,COURIER,p)
 denied(con,'23505',DELIVER,first,COURIER,new(),p)
 assert sql(con,"SELECT status FROM public.mobility_stage_deliveries WHERE id=%s",first).fetchone()[0]=='picked_up'
 assert sql(con,"SELECT consumed_at FROM public.mobility_stage_g67_delivery_proofs WHERE proof_ref=%s",p).fetchone()[0] is None
 assert sql(con,"SELECT count(*) FROM public.mobility_stage_g36_driver_slots WHERE driver_id=%s",COURIER).fetchone()[0]==1
 con.execute('ROLLBACK TO SAVEPOINT phantom')
 con.execute('RELEASE SAVEPOINT phantom')
# G5 direct legacy RPC is still callable only by server role. Trigger MUST
# enforce G67 even when caller has no right to SELECT proof registry.
with db() as con:
 con.execute('SET LOCAL ROLE service_role')
 denied(con,'G6704',DELIVER,first,COURIER,new(),new())
 con.execute('RESET ROLE')
# Two connections compete over one G5 event. Second cannot pass delivery
# row FOR UPDATE before first COMMIT and cannot consume twice afterward.
winner=db()
try:
 original=new()
 event_id=sql(winner,DELIVER,first,COURIER,original,p).fetchone()[0]
 assert event_id is not None
 with db() as contender:
  contender.execute("SET LOCAL lock_timeout='250ms'")
  denied(contender,'55P03',DELIVER,first,COURIER,new(),p)
 winner.commit()
finally:winner.close()
with db() as con:
 old=sql(con,DELIVER,first,COURIER,original,p).fetchone()[0]
 assert old==event_id
 denied(con,'P0001',DELIVER,first,COURIER,new(),p)
 assert sql(con,"SELECT status,proof_ref FROM public.mobility_stage_deliveries WHERE id=%s",first).fetchone()==('delivered',uuid.UUID(p))
 assert sql(con,"SELECT consumed_at FROM public.mobility_stage_g67_delivery_proofs WHERE proof_ref=%s",p).fetchone()[0] is not None
 assert sql(con,PROBE,first,COURIER,p).fetchone()[0] is True
 assert sql(con,"SELECT count(*) FROM public.mobility_stage_delivery_events WHERE delivery_id=%s AND action='deliver'",first).fetchone()[0]==1
 assert sql(con,"SELECT count(*) FROM public.mobility_stage_g36_driver_slots WHERE driver_id=%s",COURIER).fetchone()[0]==0
# Revocation of attestation before G5 must make even a genuine UUID useless.
second=fixture()
p2=proof_for(second)
with db() as con:
 assert sql(con,"SELECT public.mobility_stage_g67_revoke_proof_owner_qa(%s,%s)",
  p2,second).fetchone()[0] is True
 denied(con,'G6704',DELIVER,second,COURIER,new(),p2)
 assert sql(con,PROBE,second,COURIER,p2).fetchone()[0] is False
# Reuse a fresh second proof is intentionally forbidden by unique(delivery).
with db() as con:
 try:
  with con.transaction():
   sql(con,MINT,second,COURIER,SESSION,AT,new(),SHA,'image/jpeg',512)
 except psycopg.Error as e:
  assert e.sqlstate=='23505',e.sqlstate
 else:raise AssertionError('G67 allowed second proof for one delivery')
# Session revocation fence: G42 write cannot complete before delivery TX.
# The second delivery is unavailable due to revoked proof, so test a read-held
# G42 lock via a third synthetic delivery after ending second fixture in QA.
with db() as con:
 # Dispose synthetic second active fixture in owner-only rollback fixture.
 con.execute("ALTER TABLE public.mobility_stage_deliveries DISABLE TRIGGER USER")
 try:
  sql(con,"DELETE FROM public.mobility_stage_g36_driver_slots WHERE driver_id=%s AND assignment_id=%s",COURIER,second)
  sql(con,"DELETE FROM public.mobility_stage_g67_delivery_proofs WHERE delivery_id=%s",second)
  sql(con,"DELETE FROM public.mobility_stage_deliveries WHERE id=%s",second)
 finally:con.execute("ALTER TABLE public.mobility_stage_deliveries ENABLE TRIGGER USER")
third=fixture()
p3=proof_for(third)
held=db()
try:
 sql(held,DELIVER,third,COURIER,new(),p3)
 with db() as revoke:
  revoke.execute("SET LOCAL lock_timeout='200ms'")
  denied(revoke,'55P03',"""UPDATE public.mobility_stage_g42_provider_session_grants
   SET revoked_at=clock_timestamp(),revision=revision+1 WHERE user_id=%s AND session_id=%s""",
   COURIER,SESSION)
 held.commit()
finally:held.close()
with db() as con:
 sql(con,"""UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=clock_timestamp(),revision=revision+1
 WHERE user_id=%s AND session_id=%s""",COURIER,SESSION)
 assert sql(con,PROBE,third,COURIER,p3).fetchone()[0] is True
 denied(con,'G6702',MINT,third,COURIER,SESSION,AT,new(),SHA,'image/jpeg',512)
 for role in ('anon','authenticated','service_role','mobility_g48_gateway_ci','mobility_g60c_execute_ci'):
  con.execute('SET LOCAL ROLE '+role)
  denied(con,'42501',MINT,third,COURIER,SESSION,AT,new(),SHA,'image/jpeg',512)
  con.execute('RESET ROLE')
print('G67 PASS: G5 protected from fake UUID, one atomic proof/event, phantom INSERT rollback, 2 PG connections, revoked proof and G42 session fence')
