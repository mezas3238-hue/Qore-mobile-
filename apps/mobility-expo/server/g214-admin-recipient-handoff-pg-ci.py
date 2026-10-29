#!/usr/bin/env python3
"""G214: two ORIGINAL G122 priced AUTO and MOTO deliveries, G10 private
acceptance, real G5/G67 pickup and proof, G187 independent recipient,
G27 Admin read. All synthetic courier fixture writes ROLLBACK in PG16 CI.
No LIVE, real PSP, legal permit or physical recipient is certified."""
import os,time,uuid
import psycopg
assert os.environ.get("CI")=="true"
assert os.environ.get("PGHOST")=="localhost"
assert os.environ.get("PGPORT")=="5432"
assert os.environ.get("PGDATABASE")=="qore_disposable_chain"
assert os.environ.get("PGAPPNAME")=="qore_ci_disposable_chain"
ADMIN='14500000-0000-4145-8145-000000000002'
SENDER=('12200000-0000-4122-8122-000000000011',
        '12200000-0000-4122-8122-000000000012')
def uid():return str(uuid.uuid4())
def db():return psycopg.connect(host='localhost',port='5432',
 dbname='qore_disposable_chain',user=os.environ['PGUSER'],
 password=os.environ['PGPASSWORD'],
 options='-c application_name=qore_ci_disposable_chain')
def denied(con,code,q,*params):
 try:
  with con.transaction():con.execute(q,params)
 except psycopg.Error as exc:
  assert exc.sqlstate==code,(code,exc.sqlstate,str(exc))
 else:raise AssertionError('G214 unauthorized SQL read succeeded')
def sql(con,q,*params):return con.execute(q,params)
READ='SELECT public.mobility_stage_g214_admin_delivery_handoff_qa(%s,%s)'
TRANSFER="SELECT public.mobility_stage_delivery_transition(%s,%s,%s,%s,%s)"
def read(con,admin,did):
 con.execute("SET LOCAL ROLE service_role")
 try: return sql(con,READ,admin,did).fetchone()[0]
 finally:con.execute("RESET ROLE")
def exercise(kind):
 with db() as con:
  try:
   original=sql(con,"""SELECT d.id,d.sender_id,d.request_key,c.quote_id
    FROM public.mobility_stage_deliveries d
    JOIN public.mobility_stage_g122_delivery_price_consents c
     ON c.delivery_id=d.id AND c.sender_id=d.sender_id
     AND c.vehicle_kind=d.requested_vehicle_kind
    WHERE d.requested_vehicle_kind=%s AND d.sender_id IN (%s,%s)
     AND d.status='requested' AND d.courier_id IS NULL
    ORDER BY d.created_at DESC LIMIT 1""",kind,*SENDER).fetchone()
   assert original is not None,kind+' original G122 Client quote/booking missing'
   did,sender,key,quote=original
   assert read(con,ADMIN,did) is None,kind+' G214 must not forge a delivery before custody'
   courier,recipient=uid(),uid()
   veh=uid()
   sid,rsid,ssid=uid(),uid(),uid()
   at=int(time.time()*1000)
   # Isolated fake Driver and recipient, no municipal or provider approval.
   for user,role in ((courier,'driver'),(recipient,'passenger')):
    sql(con,"INSERT INTO auth.users(id) VALUES(%s)",user)
    sql(con,"DELETE FROM public.user_roles WHERE user_id=%s",user)
    sql(con,"INSERT INTO public.user_roles(user_id,role) VALUES(%s,%s)",user,role)
   sql(con,"""INSERT INTO public.mobility_vehicles(
     id,driver_id,vehicle_kind,service_kind,municipality_code,
     plate_normalized,brand,model,manufacture_year,passenger_capacity,review_status)
     VALUES(%s,%s,%s,%s,'ASUNCION',%s,'TEST','QA',2020,%s,'approved')""",
    veh,courier,kind,'economico' if kind=='AUTO' else 'moto_pasajero',
    'Q'+uuid.uuid4().hex[:8].upper(),4 if kind=='AUTO' else 1)
   for subject,session in ((courier,sid),(recipient,rsid),(sender,ssid)):
    sql(con,"""INSERT INTO public.mobility_stage_g42_provider_session_grants(
     user_id,session_id,provider_confirmed_at,token_allowed_from,
     valid_until,evidence_kind) VALUES(%s,%s,
     clock_timestamp()-interval '1 day',
     clock_timestamp()-interval '1 minute',
     clock_timestamp()+interval '1 hour',
     'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')""",subject,session)
   # Preserve G37/G71/G36 KYC triggers for runtime. Only this synthetic
   # fixture assignment is constructed by the disposable DB owner and
   # immediately reverted. No API can use this bypass.
   sql(con,"ALTER TABLE public.mobility_stage_deliveries DISABLE TRIGGER USER")
   try:
    sql(con,"""UPDATE public.mobility_stage_deliveries
     SET courier_id=%s,vehicle_id=%s,status='accepted',revision=2
     WHERE id=%s""",courier,veh,did)
   finally:sql(con,"ALTER TABLE public.mobility_stage_deliveries ENABLE TRIGGER USER")
   sql(con,"INSERT INTO public.mobility_stage_g36_driver_slots(driver_id,assignment_kind,assignment_id) VALUES(%s,'DELIVERY',%s)",courier,did)
   accept_key=uid()
   accept_id=sql(con,"""INSERT INTO public.mobility_stage_delivery_events(
     request_key,delivery_id,actor_id,action,next_status,delivery_revision)
     VALUES(%s,%s,%s,'accept','accepted',2) RETURNING id""",
     accept_key,did,courier).fetchone()[0]
   sql(con,"ALTER TABLE public.mobility_stage_delivery_offers DISABLE TRIGGER USER")
   try:
    sql(con,"""INSERT INTO public.mobility_stage_delivery_offers(
     id,request_key,delivery_id,courier_id,vehicle_id,status,ttl_seconds,
     offered_at,expires_at,decision_key,decision_event_id)
     VALUES(%s,%s,%s,%s,%s,'accepted',30,clock_timestamp(),
     clock_timestamp()+interval '30 seconds',%s,%s)""",
     uid(),uid(),did,courier,veh,accept_key,accept_id)
   finally:sql(con,"ALTER TABLE public.mobility_stage_delivery_offers ENABLE TRIGGER USER")
   # Real G5 pickup, not a fabricated terminal event.
   assert sql(con,TRANSFER,did,courier,'pickup',uid(),None).fetchone()[0]
   bind_key=uid()
   binding=sql(con,"""SELECT public.mobility_stage_g187_bind_recipient_qa(
    %s,%s,%s,%s,%s,%s)""",sender,ssid,at,did,recipient,bind_key).fetchone()[0]
   assert binding['bindingPersisted'] is True
   proof=uid()
   assert sql(con,"""SELECT public.mobility_stage_g67_register_proof_owner_qa(
    %s,%s,%s,%s,%s,%s,%s,%s,clock_timestamp()+interval '10 minutes')""",
    did,courier,sid,at,proof,'a'*64,'image/jpeg',512).fetchone()[0]==uuid.UUID(proof)
   assert sql(con,TRANSFER,did,courier,'deliver',uid(),proof).fetchone()[0]
   still_pending=read(con,ADMIN,did)
   assert still_pending['serviceKind']=='DELIVERY_'+kind
   assert still_pending['serviceId']==str(did)
   assert still_pending['bookingRequestKey']==str(key)
   assert still_pending['quoteId']==str(quote)
   assert still_pending['courierProofCommitted'] is True
   assert still_pending['recipientBound'] is True
   assert still_pending['recipientConfirmed'] is False
   assert still_pending['eligibleForSettlement'] is False
   assert still_pending['paymentAuthorized'] is False
   assert still_pending['commerciallyCertified'] is False
   ack=uid()
   confirmed=sql(con,"""SELECT public.mobility_stage_g187_confirm_received_qa(
     %s,%s,%s,%s,%s)""",recipient,rsid,at,did,ack).fetchone()[0]
   assert confirmed['recipientConfirmed'] is True
   final=read(con,ADMIN,did)
   assert final['recipientConfirmed'] is True
   assert final['eligibleForSettlement'] is True
   assert final['legalGate']=='EXTERNAL_NOT_CERTIFIED'
   assert final['paymentAuthorized'] is False
   assert final['commerciallyCertified'] is False
   assert final['deliveryState']=='delivered' and final['revision']==4
   assert read(con,uid(),did) is None,'Foreign Admin must never read handoff'
   con.execute('SET LOCAL ROLE authenticated')
   denied(con,'42501',READ,ADMIN,did)
   con.execute('RESET ROLE')
   # Sender dispute preserves recipient ACK but forbids settlement.
   assert sql(con,TRANSFER,did,sender,'dispute',uid(),None).fetchone()[0]
   disputed=read(con,ADMIN,did)
   assert disputed['deliveryState']=='disputed'
   assert disputed['recipientConfirmed'] is True
   assert disputed['eligibleForSettlement'] is False
   assert disputed['paymentAuthorized'] is False
   # Returned custody is terminal; history of recipient ACK must not vanish.
   assert sql(con,TRANSFER,did,courier,'return',uid(),None).fetchone()[0]
   returned=read(con,ADMIN,did)
   assert returned['deliveryState']=='returned'
   assert returned['revision']==6 and returned['recipientConfirmed'] is True
   assert returned['eligibleForSettlement'] is False
   print('G214 '+kind+' original priced Client delivery -> G10 Courier -> '
     'G5/G67 proven -> G187 Recipient -> G27 Admin, dispute/return verified; NO PSP')
  finally:
   con.rollback() # Roll back all fake users, vehicle, G10 and custody.
for vehicle in ('AUTO','MOTO'):exercise(vehicle)
print('G214 PASS both original delivery IDs and quote IDs with source-backed '
 'courier/recipient Admin proof; no LIVE, foreign disclosure or commercial GO')
