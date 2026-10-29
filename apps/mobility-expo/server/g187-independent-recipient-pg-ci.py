#!/usr/bin/env python3
"""G187: same original G5 delivery requires courier G67 AND independent recipient."""
import os,time,uuid
import psycopg
assert os.environ.get('PGHOST')=='localhost'
assert os.environ.get('PGDATABASE')=='qore_disposable_chain'
assert os.environ.get('PGAPPNAME')=='qore_ci_disposable_chain'
S='18700000-0000-4187-8187-000000000001'
R='18700000-0000-4187-8187-000000000002'
OTHER='18700000-0000-4187-8187-000000000003'
D='00000000-0000-4000-8000-000000000181'
V='00000000-0000-4000-8000-000000000184'
SS='18700000-0000-4187-8187-000000000011'
RS='18700000-0000-4187-8187-000000000012'
DS='18700000-0000-4187-8187-000000000013'
OS='18700000-0000-4187-8187-000000000014'
AT=int(time.time()*1000)
def new():return str(uuid.uuid4())
def db():
 return psycopg.connect(host='localhost',port=os.environ.get('PGPORT','5432'),
  user=os.environ['PGUSER'],password=os.environ['PGPASSWORD'],
  dbname='qore_disposable_chain',
  options='-c application_name=qore_ci_disposable_chain')
def sql(c,q,*v):return c.execute(q,v)
def denied(c,code,q,*v):
 try:
  with c.transaction():sql(c,q,*v)
 except psycopg.Error as ex:
  assert ex.sqlstate==code,(code,ex.sqlstate,str(ex))
 else:raise AssertionError('G187 unauthorized SQL succeeded')
BIND="""SELECT public.mobility_stage_g187_bind_recipient_qa(%s,%s,%s,%s,%s,%s)"""
CONFIRM="""SELECT public.mobility_stage_g187_confirm_received_qa(%s,%s,%s,%s,%s)"""
READ="""SELECT public.mobility_stage_g187_sender_confirmation_status_qa(%s,%s,%s,%s)"""
RECOVER="""SELECT public.mobility_stage_g190_recipient_confirmation_status_qa(%s,%s,%s,%s)"""
with db() as c:
 for uid in (S,R,OTHER):
  sql(c,"INSERT INTO auth.users(id) VALUES (%s) ON CONFLICT DO NOTHING",uid)
  sql(c,"DELETE FROM public.user_roles WHERE user_id=%s",uid)
  sql(c,"INSERT INTO public.user_roles(user_id,role) VALUES (%s,'passenger')",uid)
 for uid,sid in ((S,SS),(R,RS),(D,DS),(OTHER,OS)):
  sql(c,"""INSERT INTO public.mobility_stage_g42_provider_session_grants
  (user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
  VALUES (%s,%s,clock_timestamp()-interval '1 day',
   clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',
   'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')""",uid,sid)
delivery=new()
with db() as c:
 # Synthetic accepted/picked_up legal fixture, never a forged commercial KYC.
 # G67 is still active when the original G5 deliver RPC is executed.
 c.execute("ALTER TABLE public.mobility_stage_deliveries DISABLE TRIGGER USER")
 try:
  sql(c,"""INSERT INTO public.mobility_stage_deliveries
  (id,request_key,sender_id,courier_id,vehicle_id,requested_vehicle_kind,
  category,grams,length_cm,width_cm,height_cm,pickup_tag,delivery_tag,
  restricted_item_declared,status,revision)
  VALUES (%s,%s,%s,%s,%s,'AUTO','PARCEL',100,10,10,10,'CENTRO','NORTE',false,'picked_up',3)""",
  delivery,new(),S,D,V)
 finally:c.execute("ALTER TABLE public.mobility_stage_deliveries ENABLE TRIGGER USER")
 sql(c,"""INSERT INTO public.mobility_stage_g36_driver_slots
  (driver_id,assignment_kind,assignment_id) VALUES (%s,'DELIVERY',%s)""",D,delivery)
with db() as c:
 denied(c,'P9004',RECOVER,OTHER,OS,AT,delivery)
 # Unbound recipient is deliberately invisible, even with a real IdP.
 denied(c,'P9004',RECOVER,R,RS,AT,delivery)
 before=sql(c,READ,S,SS,AT,delivery).fetchone()[0]
 assert before['recipientConfirmed'] is False
 assert before['recipientBound'] is False
 assert before['bindingKey'] is None
 assert before['eligibleForSettlement'] is False
 assert before['paymentAuthorized'] is False
 bindkey=new()
 bound=sql(c,BIND,S,SS,AT,delivery,R,bindkey).fetchone()[0]
 assert bound['bindingPersisted'] is True
 sender_proof=sql(c,READ,S,SS,AT,delivery).fetchone()[0]
 assert sender_proof['bindingKey']==bindkey
 pending=sql(c,RECOVER,R,RS,AT,delivery).fetchone()[0]
 assert pending['recipientConfirmed'] is False
 assert pending['confirmationId'] is None
 assert pending['eligibleForSettlement'] is False
 assert sql(c,BIND,S,SS,AT,delivery,R,bindkey).fetchone()[0]==bound
 denied(c,'P8704',BIND,S,SS,AT,delivery,OTHER,new())
 denied(c,'P8701',BIND,S,SS,AT,delivery,S,new())
 denied(c,'P8704',BIND,OTHER,OS,AT,delivery,R,new())
 denied(c,'P8705',CONFIRM,R,RS,AT,delivery,new())
 denied(c,'P8703',CONFIRM,D,DS,AT,delivery,new())
 denied(c,'P8704',CONFIRM,OTHER,OS,AT,delivery,new())
 proof=new()
 assert sql(c,"""SELECT public.mobility_stage_g67_register_proof_owner_qa(
  %s,%s,%s,%s,%s,%s,%s,%s,clock_timestamp()+interval '10 minutes')""",
  delivery,D,DS,AT,proof,'a'*64,'image/jpeg',512).fetchone()[0]==uuid.UUID(proof)
 # A UUID or a courier's proof has NOT yet completed G5; still no recipient consent.
 denied(c,'P8705',CONFIRM,R,RS,AT,delivery,new())
 assert sql(c,"SELECT public.mobility_stage_delivery_transition(%s,%s,'deliver',%s,%s)",
  delivery,D,new(),proof).fetchone()[0] is not None
 courier_only=sql(c,READ,S,SS,AT,delivery).fetchone()[0]
 assert courier_only['deliveryState']=='delivered'
 assert courier_only['courierProofCommitted'] is True
 assert courier_only['recipientBound'] is True
 assert courier_only['bindingKey']==bindkey
 assert courier_only['recipientConfirmed'] is False
 assert courier_only['eligibleForSettlement'] is False
 assert courier_only['paymentAuthorized'] is False
 denied(c,'P8704',CONFIRM,S,SS,AT,delivery,new())
 denied(c,'P8704',CONFIRM,OTHER,OS,AT,delivery,new())
# Two independently authenticated recipient submissions race on ONE delivery row.
winner=db()
try:
 key=new()
 confirmed=sql(winner,CONFIRM,R,RS,AT,delivery,key).fetchone()[0]
 assert confirmed['recipientConfirmed'] is True
 assert confirmed['paymentAuthorized'] is False
 with db() as contender:
  sql(contender,"SET LOCAL lock_timeout='200ms'")
  denied(contender,'55P03',CONFIRM,R,RS,AT,delivery,new())
 winner.commit()
finally:winner.close()
with db() as c:
 assert sql(c,CONFIRM,R,RS,AT,delivery,key).fetchone()[0]==confirmed
 denied(c,'P8704',CONFIRM,R,RS,AT,delivery,new())
 final=sql(c,READ,S,SS,AT,delivery).fetchone()[0]
 assert final['recipientConfirmed'] is True
 assert final['bindingKey']==bindkey
 assert final['eligibleForSettlement'] is True
 assert final['paymentAuthorized'] is False
 assert final['revision']==4
 recovered=sql(c,RECOVER,R,RS,AT,delivery).fetchone()[0]
 assert recovered['recipientConfirmed'] is True
 assert recovered['confirmationId']==key
 assert recovered['eligibleForSettlement'] is True
 assert recovered['paymentAuthorized'] is False
 denied(c,'P9004',RECOVER,S,SS,AT,delivery)
 denied(c,'P9004',RECOVER,OTHER,OS,AT,delivery)
 # Dispute does not erase the recipient's immutable ACK, but stops settlement.
 disputed=sql(c,"SELECT public.mobility_stage_delivery_transition(%s,%s,'dispute',%s,NULL)",delivery,S,new()).fetchone()[0]
 assert disputed is not None
 after_dispute=sql(c,READ,S,SS,AT,delivery).fetchone()[0]
 assert after_dispute['deliveryState']=='disputed'
 assert after_dispute['recipientConfirmed'] is True
 assert after_dispute['eligibleForSettlement'] is False
 recipient_history=sql(c,RECOVER,R,RS,AT,delivery).fetchone()[0]
 assert recipient_history['recipientConfirmed'] is True
 assert recipient_history['confirmationId']==key
 assert recipient_history['eligibleForSettlement'] is False
 denied(c,'P8704',READ,OTHER,OS,AT,delivery)
 assert sql(c,"SELECT count(*) FROM public.mobility_stage_g187_recipient_confirmations WHERE delivery_id=%s",delivery).fetchone()[0]==1
 # Revocation forbids a replay or future writes, despite persisted confirmation.
 sql(c,"""UPDATE public.mobility_stage_g42_provider_session_grants
  SET revoked_at=clock_timestamp(),revision=revision+1
  WHERE user_id=%s AND session_id=%s""",R,RS)
 denied(c,'P8702',CONFIRM,R,RS,AT,delivery,key)
 denied(c,'P9002',RECOVER,R,RS,AT,delivery)
 for role in ('anon','authenticated','mobility_g48_gateway_ci'):
  sql(c,'SET LOCAL ROLE '+role)
  denied(c,'42501',CONFIRM,R,RS,AT,delivery,key)
  denied(c,'42501',RECOVER,R,RS,AT,delivery)
  sql(c,'RESET ROLE')
print('G190 PASS: original G5/G67 custody, G187 distinct recipient ACK, read-only revocation and private recovery, immutable dispute record, no PSP')
