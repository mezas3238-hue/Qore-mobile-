"""G36 cross-service simultaneous acceptances in TWO independent PG sessions.

Only ephemeral PostgreSQL 16 qore_disposable_chain with synthetic actors.
One transaction must win across AUTO and DELIVERY; never two assignments.
"""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import os
import psycopg

assert os.environ.get("PGHOST") == "localhost", "No remote PG"
assert os.environ.get("PGDATABASE") == "qore_disposable_chain", "No live PG"
assert os.environ.get("PGAPPNAME") == "qore_ci_disposable_chain", "No staging/live"
DRIVER="00000000-0000-4000-8000-000000000181"
VEHICLE="00000000-0000-4000-8000-000000000184"
PASSENGER_OLD="00000000-0000-4000-8000-000000000241"
OLD_REQ="00000000-0000-4000-8000-000000000243"
P_RIDE="b6360000-0000-4636-8636-000000000001"
P_CARGO="b6360000-0000-4636-8636-000000000002"
AUTO_REQ="b6360000-0000-4636-8636-000000000003"
CARGO_REQ="b6360000-0000-4636-8636-000000000004"
AUTO_ACCEPT_KEY="b6360000-0000-4636-8636-000000000005"
CARGO_ACCEPT_KEY="b6360000-0000-4636-8636-000000000006"
CANCEL_KEY="b6360000-0000-4636-8636-000000000007"
AUTO_OFFER_KEY="b6360000-0000-4636-8636-000000000008"
CARGO_OFFER_KEY="b6360000-0000-4636-8636-000000000009"
def conn():
    return psycopg.connect(connect_timeout=15)

def prepare():
    with conn() as db:
        with db.cursor() as c:
            c.execute("INSERT INTO auth.users(id) VALUES (%s::uuid),(%s::uuid) ON CONFLICT DO NOTHING",(P_RIDE,P_CARGO))
            c.execute("""INSERT INTO public.mobility_stage_delivery_vehicle_clearance(
             vehicle_id,delivery_authorized,cargo_insurance_valid_through,
             cargo_insurance_verified_at,max_grams,max_volume_cm3,max_edge_cm,
             reviewed_by,reviewed_at)
             VALUES(%s::uuid,true,CURRENT_DATE+90,clock_timestamp()-interval '10 minutes',
             5000,100000,60,'00000000-0000-4000-8000-000000000101',
             clock_timestamp()-interval '5 minutes')
             ON CONFLICT(vehicle_id) DO UPDATE SET
             delivery_authorized=true,cargo_insurance_valid_through=CURRENT_DATE+90,
             cargo_insurance_verified_at=clock_timestamp()-interval '10 minutes',
             max_grams=5000,max_volume_cm3=100000,max_edge_cm=60,
             reviewed_by='00000000-0000-4000-8000-000000000101',
             reviewed_at=clock_timestamp()-interval '5 minutes'""",(VEHICLE,))
            c.execute("SET LOCAL ROLE service_role")
            c.execute("SELECT id FROM public.mobility_stage_auto_demo_trips WHERE request_key=%s::uuid",(OLD_REQ,))
            old_id=c.fetchone()[0]
            c.execute("""SELECT public.mobility_stage_auto_demo_transition(
              %s::uuid,%s::uuid,'cancelled',%s::uuid)""",(old_id,PASSENGER_OLD,CANCEL_KEY))
            c.execute("""SELECT public.mobility_stage_auto_demo_request(
              %s::uuid,%s::uuid,'CENTRO','SAN_LORENZO','economico')""",(P_RIDE,AUTO_REQ))
            trip=c.fetchone()[0]
            c.execute("""SELECT public.mobility_stage_delivery_request(
              %s::uuid,%s::uuid,'AUTO','PARCEL',300,10,10,10,
              'CENTRO','LAMBRARE',false)""",(P_CARGO,CARGO_REQ))
            delivery=c.fetchone()[0]
            c.execute("SELECT public.mobility_vehicle_preflight(%s::uuid,%s::uuid,'economico')",(DRIVER,VEHICLE))
            assert c.fetchone()[0] is True, "AUTO selected-vehicle preflight unavailable"
            c.execute("SELECT public.mobility_stage_delivery_courier_preflight(%s::uuid,%s::uuid,%s::uuid)",(DRIVER,VEHICLE,delivery))
            assert c.fetchone()[0] is True, "DELIVERY selected-vehicle preflight unavailable"
            # G4 and G10 revoked direct accept: only driver-specific private
            # OFFER acceptance is authorized to the server service_role.
            c.execute("""SELECT public.mobility_stage_auto_demo_offer(
               %s::uuid,%s::uuid,%s::uuid,%s::uuid,30)""",
               (trip,DRIVER,VEHICLE,AUTO_OFFER_KEY))
            offer_auto=c.fetchone()[0]
            c.execute("""SELECT public.mobility_stage_delivery_offer(
               %s::uuid,%s::uuid,%s::uuid,%s::uuid,45)""",
               (delivery,DRIVER,VEHICLE,CARGO_OFFER_KEY))
            offer_cargo=c.fetchone()[0]
            # The service_role deliberately cannot SELECT internal slots;
            # the disposable database owner (qore_ci) alone inspects them.
            c.execute("RESET ROLE")
            c.execute("SELECT count(*) FROM public.mobility_stage_g36_driver_slots WHERE driver_id=%s::uuid",(DRIVER,))
            assert c.fetchone()[0] == 0, "Previous AUTO slot did not release"
    return trip,delivery,offer_auto,offer_cargo

def attempt(kind,job,barrier):
    with conn() as db:
        with db.cursor() as c:
            c.execute("SET LOCAL ROLE service_role")
            barrier.wait(timeout=20)
            try:
                if kind=="AUTO_RIDE":
                    c.execute("""SELECT public.mobility_stage_auto_demo_accept_offer(
                      %s::uuid,%s::uuid,%s::uuid)""",
                      (job,DRIVER,AUTO_ACCEPT_KEY))
                else:
                    c.execute("""SELECT public.mobility_stage_delivery_accept_offer(
                      %s::uuid,%s::uuid,%s::uuid)""",
                      (job,DRIVER,CARGO_ACCEPT_KEY))
                receipt=c.fetchone()[0]
                db.commit()
                return kind,"success",str(receipt)
            except psycopg.Error as e:
                db.rollback()
                return kind,"rejected",e.sqlstate

def verify(trip,delivery,results):
    winners=[x for x in results if x[1]=="success"]
    losers=[x for x in results if x[1]=="rejected"]
    assert len(winners)==1 and len(losers)==1,results
    with conn() as db:
        with db.cursor() as c:
            c.execute("""SELECT assignment_kind,assignment_id
              FROM public.mobility_stage_g36_driver_slots WHERE driver_id=%s::uuid""",(DRIVER,))
            slots=c.fetchall()
            assert len(slots)==1,slots
            c.execute("""SELECT status FROM public.mobility_stage_auto_demo_trips
               WHERE id=%s::uuid""",(trip,))
            a=c.fetchone()[0]
            c.execute("""SELECT status FROM public.mobility_stage_deliveries
              WHERE id=%s::uuid""",(delivery,))
            d=c.fetchone()[0]
            assert (a=="accepted") != (d=="accepted"),(a,d,results)
            assert slots[0][0]==winners[0][0],(slots,winners)
    print("G36 PASS: two independent AUTO/cargo accepts raced; "
          "exactly one durable slot, no dual-service Driver",results,flush=True)

if __name__=="__main__":
    trip,delivery,offer_auto,offer_cargo=prepare()
    barrier=Barrier(2)
    with ThreadPoolExecutor(max_workers=2) as ex:
        future_auto=ex.submit(attempt,"AUTO_RIDE",offer_auto,barrier)
        future_cargo=ex.submit(attempt,"DELIVERY",offer_cargo,barrier)
        outcomes=[future_auto.result(timeout=35),future_cargo.result(timeout=35)]
    verify(trip,delivery,outcomes)
