#!/usr/bin/env python3
"""G212: original priced G5 AUTO/MOTO -> private G10 assignment ->
 G42 locked courier pickup. Only disposable PG16; fixture writes ROLLBACK.
 This verifies mechanics, never claims external legal courier certification."""
import os, time, uuid
import psycopg

assert os.getenv("CI")=="true"
assert os.getenv("PGHOST")=="localhost"
assert os.getenv("PGPORT")=="5432"
assert os.getenv("PGDATABASE")=="qore_disposable_chain"
assert os.getenv("PGAPPNAME")=="qore_ci_disposable_chain"
FN="SELECT public.mobility_stage_g212_courier_custody_step_qa(%s,%s,%s,%s,%s,%s,%s)"
def uid():return str(uuid.uuid4())
def db():return psycopg.connect(
 host="localhost",port="5432",dbname="qore_disposable_chain",
 user=os.environ["PGUSER"],password=os.environ["PGPASSWORD"],
 options="-c application_name=qore_ci_disposable_chain")
def denied(con,code,params):
 try:
  with con.transaction():con.execute(FN,params)
 except psycopg.Error as exc:
  assert exc.sqlstate==code,(code,exc.sqlstate,str(exc))
 else:raise AssertionError("G212 unauthorized courier step accepted")

with db() as con:
 try:
  for kind in ("AUTO","MOTO"):
   # G202 already left original sender quotation, G122 consent and G5
   # delivery request. Never counterfeit a new customer consent.
   original=con.execute("""
    SELECT d.id,d.sender_id FROM public.mobility_stage_deliveries d
    JOIN public.mobility_stage_g122_delivery_price_consents c
      ON c.delivery_id=d.id AND c.sender_id=d.sender_id
      AND c.vehicle_kind=d.requested_vehicle_kind
    JOIN public.mobility_stage_fare_quotes q ON q.id=c.quote_id
      AND q.subject_id=d.id AND q.customer_id=d.sender_id
      AND q.total_pyg=c.accepted_total_gs
    WHERE d.requested_vehicle_kind=%s AND d.status='requested'
    ORDER BY d.created_at DESC LIMIT 1
   """,(kind,)).fetchone()
   assert original is not None,kind+" original G122 consent missing"
   did,sender=original
   vehicle=con.execute("""
    SELECT v.id,v.driver_id FROM public.mobility_vehicles v
    JOIN public.user_roles r ON r.user_id=v.driver_id AND r.role='driver'
    WHERE v.vehicle_kind=%s AND v.review_status NOT IN ('rejected','suspended')
    AND v.driver_id<>%s
    ORDER BY (
      SELECT count(*) FROM public.mobility_stage_g36_driver_slots active
      WHERE active.driver_id=v.driver_id),v.id LIMIT 1
   """,(kind,sender)).fetchone()
   assert vehicle is not None,kind+" G5 courier vehicle fixture missing"
   vid,driver=vehicle
   # Earlier disposable G67/G109 tests can leave an occupied G36 slot.
   # This test holds one transactional sandbox: free only this fixture slot
   # and ROLLBACK restores the prior assignment without leaking a second job.
   con.execute("DELETE FROM public.mobility_stage_g36_driver_slots WHERE driver_id=%s",
      (driver,))
   sid=uid()
   at=int(time.time()*1000)
   con.execute("""INSERT INTO public.mobility_stage_g42_provider_session_grants(
    user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
    VALUES(%s,%s,clock_timestamp()-interval '1 day',
     clock_timestamp()-interval '2 minutes',clock_timestamp()+interval '1 hour',
     'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')""",(driver,sid))
   # Superuser QA-only fixture bypass of real G10 acceptance. We assert G212
   # requires its original immutable reference; not municipal/vehicle clearance.
   con.execute("ALTER TABLE public.mobility_stage_deliveries DISABLE TRIGGER USER")
   try:
    con.execute("""UPDATE public.mobility_stage_deliveries
      SET courier_id=%s,vehicle_id=%s,status='accepted',revision=2
      WHERE id=%s""",(driver,vid,did))
   finally:
    con.execute("ALTER TABLE public.mobility_stage_deliveries ENABLE TRIGGER USER")
   # G36's original single-assignment slot is required by the G5
   # transition integrity trigger; only the disposable fixture seeds it.
   con.execute("""INSERT INTO public.mobility_stage_g36_driver_slots(
      driver_id,assignment_kind,assignment_id) VALUES(%s,'DELIVERY',%s)""",
      (driver,did))
   decision=uid()
   event_id=con.execute("""INSERT INTO public.mobility_stage_delivery_events(
      request_key,delivery_id,actor_id,action,next_status,delivery_revision)
      VALUES(%s,%s,%s,'accept','accepted',2) RETURNING id""",
      (decision,did,driver)).fetchone()[0]
   offer=uid()
   con.execute("""INSERT INTO public.mobility_stage_delivery_offers(
      id,request_key,delivery_id,courier_id,vehicle_id,status,ttl_seconds,
      offered_at,expires_at,decision_key,decision_event_id)
      VALUES(%s,%s,%s,%s,%s,'accepted',30,
      clock_timestamp(),clock_timestamp()+interval '30 seconds',%s,%s)""",
      (offer,uid(),did,driver,vid,decision,event_id))
   command=uid()
   payload=(driver,sid,at,did,"pickup",command,None)
   wrong=(uid(),sid,at,did,"pickup",command,None)
   denied(con,"P2122",wrong)
   denied(con,"P2121",(driver,sid,at,did,"dispute",command,None))
   denied(con,"P2121",(driver,sid,at,did,"pickup",command,uid()))
   con.execute("SET LOCAL ROLE service_role")
   receipt=con.execute(FN,payload).fetchone()[0]
   assert receipt is not None
   repeat=con.execute(FN,payload).fetchone()[0]
   assert repeat==receipt,kind+" lost original idempotent event"
   assert con.execute("""SELECT status FROM public.mobility_stage_deliveries
     WHERE id=%s""",(did,)).fetchone()[0]=="picked_up"
   denied(con,"P0001",(driver,sid,at,did,"pickup",uid(),None))
   con.execute("RESET ROLE")
   # Race/revoke invariant: same original token cannot mutate after G42 revoke.
   con.execute("""UPDATE public.mobility_stage_g42_provider_session_grants
    SET revoked_at=clock_timestamp(),revision=revision+1
    WHERE user_id=%s AND session_id=%s""",(driver,sid))
   denied(con,"P2123",(driver,sid,at,did,"pickup",command,None))
   con.execute("SET LOCAL ROLE authenticated")
   denied(con,"42501",payload)
   con.execute("RESET ROLE")
   # Restore this original delivery and events in a disposable CI-only
   # transaction. No fake outcome can survive this test.
   con.rollback()
   # Start fresh transaction to validate next vehicle independently.
  print("G212 PASS: original priced AUTO/MOTO G5 and G10 linked, G42 locked "
        "pickup/replay, invalid role/event, revoked session, no client execute")
 finally:
  con.rollback()
