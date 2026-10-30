#!/usr/bin/env python3
"""G217 G45 commerce E2E, EXACT G202 original order + linked G150 delivery.
All actors and pre-accept legal KYC are EXPLICIT synthetic DB-OWNER fixtures,
rolled back on exit. Subsequent G5 pickup, G67 proof, G187 recipient ACK,
and both G216/G217 Admin readbacks run with original security gates.
Never a LIVE permit, physical handoff, GPS, or financial PSP settlement.
"""
import os,time,uuid,json
import psycopg
assert os.environ.get("CI")=="true" and os.environ.get("PGHOST")=="localhost"
assert os.environ.get("PGPORT")=="5432"
assert os.environ.get("PGDATABASE")=="qore_disposable_chain"
assert os.environ.get("PGAPPNAME")=="qore_ci_disposable_chain"
with open('/tmp/qore-g202-five-original-journeys-qa.json',encoding='utf8') as f:
 sources=json.load(f)
assert sources["originalPostgresAndAdminReceipts"]==5
order=next(x for x in sources["services"] if x["serviceKind"]=="COMMERCE")
OID=order["originalServiceId"]; DID=order["linkedCommerceDeliveryId"]
ADMIN="14500000-0000-4145-8145-000000000002"
RECIPIENT="18700000-0000-4187-8187-000000000002"
def uid():return str(uuid.uuid4())
def db():return psycopg.connect(host='localhost',port='5432',
 dbname='qore_disposable_chain',user=os.environ['PGUSER'],
 password=os.environ['PGPASSWORD'],
 options='-c application_name=qore_ci_disposable_chain')
def sql(c,q,*args):return c.execute(q,args)
def scalar(c,q,*args):return sql(c,q,*args).fetchone()[0]
def read(c,func,ident,actor=ADMIN):
 sql(c,"SET LOCAL ROLE service_role")
 try:return scalar(c,"SELECT public."+func+"(%s,%s)",actor,ident)
 finally:sql(c,"RESET ROLE")
with db() as c:
 try:
  o=sql(c,"""SELECT o.id,o.buyer_id,o.requested_vehicle_kind,d.id,d.status
   FROM public.mobility_stage_merchant_orders o
   JOIN public.mobility_stage_deliveries d ON d.id=o.delivery_id
   WHERE o.id=%s AND o.revision=5 AND o.status='ready'""",OID).fetchone()
  assert o and str(o[0])==OID and str(o[3])==DID and o[4]=='requested'
  sender=str(o[1]);kind=str(o[2])
  assert kind in ('AUTO','MOTO')
  assert read(c,"mobility_stage_g217_commerce_terminal_admin_qa",OID) is None
  baseline=read(c,"mobility_stage_g146_commerce_trace_qa",OID)
  assert baseline['serviceId']==OID and baseline['deliveryId']==DID
  assert baseline['bookingRequestKey']==order['originalRequestKey']
  # Unique explicitly simulated Driver+vehicle only in transaction rollback:
  # never hijack a real or existing QA courier's exclusive G36 slot.
  courier,vehicle=uid(),uid()
  sql(c,"INSERT INTO auth.users(id) VALUES(%s)",courier)
  sql(c,"DELETE FROM public.user_roles WHERE user_id=%s",courier)
  sql(c,"INSERT INTO public.user_roles(user_id,role) VALUES(%s,'driver')",courier)
  sql(c,"""INSERT INTO public.mobility_vehicles(
   id,driver_id,vehicle_kind,service_kind,municipality_code,plate_normalized,
   brand,model,manufacture_year,passenger_capacity,review_status)
   VALUES(%s,%s,%s,%s,'ASUNCION',%s,'TEST','G217',2020,%s,'approved')""",
   vehicle,courier,kind,'economico' if kind=='AUTO' else 'moto_pasajero',
   'QA'+uuid.uuid4().hex[:8].upper(),4 if kind=='AUTO' else 1)
  at=int(time.time()*1000)
  sessions={x:uid() for x in (sender,courier,RECIPIENT)}
  for actor,sid in sessions.items():
   sql(c,"""INSERT INTO public.mobility_stage_g42_provider_session_grants
    (user_id,session_id,provider_confirmed_at,token_allowed_from,
     valid_until,evidence_kind) VALUES(%s,%s,
     clock_timestamp()-interval '1 day',
     clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',
     'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')""",actor,sid)
  # Simulated pre-accept legal actor: ONLY disposable DB owner; NEVER a
  # public/server RPC, and USER triggers restored before custody transitions.
  offer_key,offer_id=uid(),uid()
  sql(c,"ALTER TABLE public.mobility_stage_delivery_offers DISABLE TRIGGER USER")
  try:
   sql(c,"""INSERT INTO public.mobility_stage_delivery_offers
     (id,request_key,delivery_id,courier_id,vehicle_id,ttl_seconds,expires_at)
     VALUES(%s,%s,%s,%s,%s,30,clock_timestamp()+interval '30 seconds')""",
     offer_id,offer_key,DID,courier,vehicle)
  finally:sql(c,"ALTER TABLE public.mobility_stage_delivery_offers ENABLE TRIGGER USER")
  sql(c,"ALTER TABLE public.mobility_stage_deliveries DISABLE TRIGGER USER")
  try:
   sql(c,"""UPDATE public.mobility_stage_deliveries
    SET courier_id=%s,vehicle_id=%s,status='accepted',revision=2,
     changed_at=clock_timestamp()
    WHERE id=%s AND status='requested'""",courier,vehicle,DID)
  finally:sql(c,"ALTER TABLE public.mobility_stage_deliveries ENABLE TRIGGER USER")
  accepted_key=uid()
  accepted_event=scalar(c,"""INSERT INTO public.mobility_stage_delivery_events(
   request_key,delivery_id,actor_id,action,next_status,delivery_revision)
   VALUES(%s,%s,%s,'accept','accepted',2) RETURNING id""",
   accepted_key,DID,courier)
  sql(c,"""UPDATE public.mobility_stage_delivery_offers
   SET status='accepted',decision_key=%s,decision_event_id=%s WHERE id=%s""",
   accepted_key,str(accepted_event),offer_id)
  sql(c,"""INSERT INTO public.mobility_stage_g36_driver_slots
   (driver_id,assignment_kind,assignment_id) VALUES(%s,'DELIVERY',%s)
   ON CONFLICT (driver_id) DO UPDATE SET assignment_id=excluded.assignment_id""",
   courier,DID)
  assert scalar(c,"""SELECT public.mobility_stage_g187_bind_recipient_qa(
   %s,%s,%s,%s,%s,%s)""",sender,sessions[sender],at,DID,RECIPIENT,uid()
   )['bindingPersisted']
  pickup=scalar(c,"SELECT public.mobility_stage_delivery_transition(%s,%s,'pickup',%s,NULL)",
   DID,courier,uid())
  assert pickup is not None
  proof=uid()
  assert str(scalar(c,"""SELECT public.mobility_stage_g67_register_proof_owner_qa(
   %s,%s,%s,%s,%s,%s,%s,%s,clock_timestamp()+interval '10 minutes')""",
   DID,courier,sessions[courier],at,proof,'a'*64,'image/jpeg',512))==proof
  delivered=scalar(c,"SELECT public.mobility_stage_delivery_transition(%s,%s,'deliver',%s,%s)",
   DID,courier,uid(),proof)
  assert delivered is not None
  assert read(c,"mobility_stage_g216_completed_delivery_trace_qa",DID) is None
  assert read(c,"mobility_stage_g217_commerce_terminal_admin_qa",OID) is None
  ack=scalar(c,"""SELECT public.mobility_stage_g187_confirm_received_qa(
   %s,%s,%s,%s,%s)""",RECIPIENT,sessions[RECIPIENT],at,DID,uid())
  assert ack['recipientConfirmed'] is True
  delivery=read(c,"mobility_stage_g216_completed_delivery_trace_qa",DID)
  commerce=read(c,"mobility_stage_g217_commerce_terminal_admin_qa",OID)
  assert delivery and commerce, 'G216 and G217 must both independently read source'
  assert commerce['serviceId']==OID
  assert commerce['deliveryId']==DID
  assert commerce['bookingRequestKey']==order['originalRequestKey']
  assert commerce['serviceKind']=='COMMERCE' and commerce['status']=='ready'
  assert commerce['revision']==5 and len(commerce['events'])==5
  assert delivery['serviceId']==DID and delivery['status']=='delivered'
  assert delivery['assignment']=={
   'state':'QA_COMPLETED','legalGate':'EXTERNAL_NOT_CERTIFIED'}
  assert len(delivery['events'])==4 and delivery['ledger'] is None
  assert read(c,"mobility_stage_g217_commerce_terminal_admin_qa",OID,uid()) is None
  # Exact persisted record must never be mistaken for commercial payout.
  assert commerce['ledger'] is None and commerce['productionEnabled'] is False
  assert scalar(c,"SELECT status::text FROM public.mobility_stage_deliveries "+
   "WHERE id=%s",DID)=='delivered'
  print('G217 COMMERCE positive PASS in rollback-only PG16: original G45 '+OID+
   ' -> merchant G150 linked G5 '+DID+
   ' -> synthetic legal pre-accept + original SQL G5 pickup/G67 proof'+
   ' -> independent G187 ACK -> Admin G216 + G217, no LIVE/PSP')
 finally:
  c.rollback()
