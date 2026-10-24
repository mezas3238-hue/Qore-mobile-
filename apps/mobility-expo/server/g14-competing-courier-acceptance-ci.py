"""G14 real concurrent courier race: exactly one courier wins a delivery.
Disposable PostgreSQL 16 only. Synthetic identities and no external services.
"""
import os
import time
from concurrent.futures import ThreadPoolExecutor
import psycopg

assert os.getenv("PGDATABASE") == "qore_disposable_chain"
assert os.getenv("PGHOST") in ("localhost", "127.0.0.1")
assert os.getenv("PGAPPNAME") == "qore_ci_disposable_chain"
dsn = ("host=localhost port=5432 dbname=qore_disposable_chain "
       "user=qore_ci password=qore_ci_only application_name=qore_ci_disposable_chain "
       "connect_timeout=5")
reviewer = "00000000-0000-4000-8000-000000000101"
sender = "00000000-0000-4000-8000-000000000161"
courier_a = "00000000-0000-4000-8000-000000000103"
vehicle_a = "00000000-0000-4000-8000-000000000104"
courier_b = "00000000-0000-4000-8000-000000000163"
vehicle_b = "00000000-0000-4000-8000-000000000164"
request_key = "00000000-0000-4000-8000-000000000165"
offer_key_a = "00000000-0000-4000-8000-000000000166"
offer_key_b = "00000000-0000-4000-8000-000000000167"
decision_key_a = "00000000-0000-4000-8000-000000000168"
decision_key_b = "00000000-0000-4000-8000-000000000169"

# Synthetic seeded courier has all cargo checks and no passenger-mode bypass.
with psycopg.connect(dsn) as seed:
    seed.execute("INSERT INTO auth.users(id) VALUES (%s),(%s)", (sender, courier_b))
    # Supabase G1 fixture grants default passenger role. Remove it before verified Driver role.
    seed.execute("DELETE FROM public.user_roles WHERE user_id=%s", (courier_b,))
    seed.execute("INSERT INTO public.user_roles(user_id,role) VALUES (%s,'driver')", (courier_b,))
    seed.execute(
        """INSERT INTO public.mobility_vehicles
           (id,driver_id,vehicle_kind,service_kind,country_code,municipality_code,
            plate_normalized,brand,model,manufacture_year,passenger_capacity,review_status)
           VALUES (%s,%s,'MOTO','moto_pasajero','PY','ASUNCION',
                   'QORE164','DEMO','COURIER',2024,1,'approved')""",
        (vehicle_b, courier_b),
    )
    seed.execute(
        """INSERT INTO public.mobility_driver_compliance
          (driver_id,license_class,license_valid_through,license_verified_at,
           license_verified_by,driver_review_status)
          VALUES (%s,'M',CURRENT_DATE+90,clock_timestamp()-interval '1 day',%s,'approved')""",
        (courier_b, reviewer),
    )
    seed.execute(
        """INSERT INTO public.mobility_stage_delivery_vehicle_clearance
          (vehicle_id,delivery_authorized,cargo_insurance_valid_through,
           cargo_insurance_verified_at,max_grams,max_volume_cm3,max_edge_cm,
           reviewed_by,reviewed_at)
          VALUES (%s,true,CURRENT_DATE+90,clock_timestamp()-interval '1 day',
                  10000,45000,60,%s,clock_timestamp()-interval '2 minutes')""",
        (vehicle_b, reviewer),
    )
    seed.execute(
        """INSERT INTO public.driver_locations(driver_id,available,lat,lng,updated_at)
          VALUES (%s,true,-25.3,-57.57,clock_timestamp()-interval '5 seconds')""",
        (courier_b,),
    )
    seed.execute(
        """INSERT INTO public.mobility_location_consents(driver_id,opted_in_at)
          VALUES (%s,clock_timestamp()-interval '1 day')""",
        (courier_b,),
    )

with psycopg.connect(dsn) as first, psycopg.connect(dsn) as second:
    with first.cursor() as a, second.cursor() as b:
        a.execute("SET ROLE service_role")
        b.execute("SET ROLE service_role")
        a.execute(
            """SELECT public.mobility_stage_delivery_request(
               %s,%s,'MOTO','PARCEL',300,10,10,10,'CENTRO','LAMBRARE',false)""",
            (sender, request_key),
        )
        delivery = a.fetchone()[0]
        a.execute(
            "SELECT public.mobility_stage_delivery_offer(%s,%s,%s,%s,30)",
            (delivery, courier_a, vehicle_a, offer_key_a),
        )
        offer_a = a.fetchone()[0]
        a.execute(
            "SELECT public.mobility_stage_delivery_offer(%s,%s,%s,%s,30)",
            (delivery, courier_b, vehicle_b, offer_key_b),
        )
        offer_b = a.fetchone()[0]
        first.commit()
        assert offer_a != offer_b

        a.execute(
            "SELECT public.mobility_stage_delivery_accept_offer(%s,%s,%s)",
            (offer_a, courier_a, decision_key_a),
        )
        winner_event = a.fetchone()[0]

        def competing_accept():
            with second.cursor() as other:
                other.execute("SET LOCAL statement_timeout='3000ms'")
                other.execute(
                    "SELECT public.mobility_stage_delivery_accept_offer(%s,%s,%s)",
                    (offer_b, courier_b, decision_key_b),
                )
                return other.fetchone()[0]

        # B must wait for the same delivery lock; after A commits it must lose.
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(competing_accept)
            time.sleep(0.15)
            first.commit()
            try:
                future.result(timeout=4)
            except psycopg.Error as error:
                assert "expired, withdrawn or ineligible" in str(error), str(error)
                second.rollback()
            else:
                raise AssertionError("Second courier accepted the already assigned delivery")

        a.execute(
            "SELECT public.mobility_stage_delivery_accept_offer(%s,%s,%s)",
            (offer_a, courier_a, decision_key_a),
        )
        assert a.fetchone()[0] == winner_event, "Winner replay not idempotent"
        a.execute(
            """SELECT courier_id,status FROM public.mobility_stage_deliveries
               WHERE id=%s""",
            (delivery,),
        )
        assigned_id, status = a.fetchone()
        assert str(assigned_id) == courier_a and status == "accepted", (assigned_id,status)
        a.execute(
            "SELECT status FROM public.mobility_stage_delivery_offers WHERE id=%s",
            (offer_b,),
        )
        assert a.fetchone()[0] == "withdrawn", "Losing private offer not withdrawn"
        a.execute(
            "SELECT count(*) FROM public.mobility_stage_delivery_events WHERE delivery_id=%s",
            (delivery,),
        )
        assert a.fetchone()[0] == 1, "Multiple assignment events created"
        first.commit()

print("G14 competing courier acceptance, one winner, private loser withdrawal PASS")

