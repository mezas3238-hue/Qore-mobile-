#!/usr/bin/env python3
"""G67: PostgreSQL16 disposable-only two-connection proof/transition tests.
No real uploads, users, URLs, identity provider or commercial deliveries.
"""
import os, uuid
import psycopg

assert os.environ.get('PGHOST') == 'localhost'
assert os.environ.get('PGDATABASE') == 'qore_disposable_chain'
assert os.environ.get('PGAPPNAME') == 'qore_ci_disposable_chain'
SENDER='99999999-9999-4999-8999-999999999999'
COURIER='11111111-1111-4111-8111-111111111111'
VEHICLE='66666666-6666-4666-8666-666666666666'
REVIEWER='22222222-2222-4222-8222-222222222222'
def db():
 return psycopg.connect(host='localhost',port=os.environ.get('PGPORT','5432'),
  user=os.environ['PGUSER'],password=os.environ['PGPASSWORD'],
  dbname='qore_disposable_chain',
  options='-c application_name=qore_ci_disposable_chain')
def new_id(): return str(uuid.uuid4())
def fixture():
 d,p,k=new_id(),new_id(),new_id()
 with db() as c:
  c.execute("""INSERT INTO public.mobility_stage_deliveries
    (id,request_key,sender_id,requested_vehicle_kind,category,grams,
     length_cm,width_cm,height_cm,pickup_tag,delivery_tag)
    VALUES (%s,%s,%s,'MOTO','PARCEL',300,9,9,9,'CENTRO_G67','LAMBRARE_G67')""",
    (d,new_id(),SENDER))
  c.execute("""UPDATE public.mobility_stage_deliveries
    SET courier_id=%s,vehicle_id=%s,status='accepted',revision=revision+1
    WHERE id=%s""",(COURIER,VEHICLE,d))
  c.execute("""UPDATE public.mobility_stage_deliveries
    SET status='picked_up',revision=revision+1 WHERE id=%s""",(d,))
  c.execute("""SELECT public.mobility_stage_g67_register_proof_qa(
    %s,%s,%s,'PHOTO',%s,4096,'image/jpeg',%s,
    clock_timestamp()+interval '4 minutes')""",(p,d,COURIER,'e'*64,REVIEWER))
 return d,p,k
def deliver(c,d,p,key):
 return c.execute("""SELECT public.mobility_stage_delivery_transition(
  %s,%s,'deliver',%s,%s)""",(d,COURIER,key,p)).fetchone()[0]
def state(d,p):
 with db() as c:
  return c.execute("""SELECT d.status::text,d.revision,p.status,p.consumed_revision,
   (SELECT count(*) FROM public.mobility_stage_delivery_events
    WHERE delivery_id=d.id AND action='deliver'),
   (SELECT count(*) FROM public.mobility_stage_g67_delivery_proof_audit
    WHERE proof_ref=p.proof_ref AND event='CONSUME')
   FROM public.mobility_stage_deliveries d
   JOIN public.mobility_stage_g67_delivery_proofs p ON p.delivery_id=d.id
   WHERE d.id=%s AND p.proof_ref=%s""",(d,p)).fetchone()
# Race order #1: live G5 transition holds delivery and proof locks through COMMIT.
d,p,k=fixture()
first=db(); second=db()
try:
 event=deliver(first,d,p,k)
 second.execute("SET LOCAL lock_timeout='250ms'")
 try: deliver(second,d,p,new_id())
 except psycopg.Error as ex:
  assert ex.sqlstate=='55P03',('second writer not blocked',ex.sqlstate)
  second.rollback()
 else: raise AssertionError('G67 competing deliver incorrectly committed while lock held')
 # Other DB transactions cannot observe an uncommitted proof consumption.
 assert state(d,p)==('picked_up',3,'verified',None,0,0),state(d,p)
 first.commit()
finally:
 first.close();second.close()
assert state(d,p)==('delivered',4,'consumed',4,1,1),state(d,p)
with db() as c:
 assert deliver(c,d,p,k)==event, 'same G5 key did not recover original receipt'
try:
 with db() as c: deliver(c,d,p,new_id())
except psycopg.Error:
 pass
else: raise AssertionError('G67 second key reused consumed proof')
assert state(d,p)==('delivered',4,'consumed',4,1,1)
# Race order #2: rollback after consuming proof never leaves delivered or used.
d2,p2,k2=fixture()
t=db()
try:
 deliver(t,d2,p2,k2)
 t.rollback()
finally:t.close()
assert state(d2,p2)==('picked_up',3,'verified',None,0,0)
# Revocation commits while transaction holds proof lock; attempted deliver must
# wait and then reject the revoked proof without forging a delivery event.
revoke=db(); courier=db()
try:
 assert revoke.execute("""SELECT public.mobility_stage_g67_revoke_proof_qa(
  %s,%s)""",(p2,REVIEWER)).fetchone()[0] is True
 courier.execute("SET LOCAL lock_timeout='250ms'")
 try: deliver(courier,d2,p2,k2)
 except psycopg.Error as ex:
  assert ex.sqlstate=='55P03',('revocation lock not respected',ex.sqlstate)
  courier.rollback()
 else:raise AssertionError('G67 delivered during held revoke lock')
 revoke.commit()
finally:
 revoke.close();courier.close()
try:
 with db() as c: deliver(c,d2,p2,k2)
except psycopg.Error as ex:
 assert ex.sqlstate=='G6703',ex.sqlstate
else:raise AssertionError('G67 revoked proof became delivered')
assert state(d2,p2)==('picked_up',3,'revoked',None,0,0)
print('G67 PASS: two PG connections, lock timeout, atomic commit, replay, rollback, revoke fence')
