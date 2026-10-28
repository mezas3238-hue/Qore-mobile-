"""Independent Postgres sessions exercise a real G13 stale-lease takeover.
Only localhost disposable CI. Never connects to Supabase, LIVE or VPS.
"""
import os
import psycopg

assert os.getenv("PGDATABASE") == "qore_disposable_chain", "Refusing other DBs"
assert os.getenv("PGHOST") in ("localhost", "127.0.0.1"), "Refusing remote DB"
assert os.getenv("PGAPPNAME") == "qore_ci_disposable_chain", "Refusing non-CI application"
dsn = ("host=localhost port=5432 dbname=qore_disposable_chain "
       "user=qore_ci password=qore_ci_only application_name=qore_ci_disposable_chain "
       "connect_timeout=5")
sender = "00000000-0000-4000-8000-000000000141"
courier = "00000000-0000-4000-8000-000000000103"
vehicle = "00000000-0000-4000-8000-000000000104"
request_key = "00000000-0000-4000-8000-000000000142"
offer_key = "00000000-0000-4000-8000-000000000143"
worker_a = "00000000-0000-4000-8000-000000000151"
worker_b = "00000000-0000-4000-8000-000000000152"

with psycopg.connect(dsn) as admin:
    admin.execute("INSERT INTO auth.users(id) VALUES (%s)", (sender,))

with psycopg.connect(dsn) as first, psycopg.connect(dsn) as second:
    with first.cursor() as a, second.cursor() as b:
        a.execute("SET ROLE service_role")
        b.execute("SET ROLE service_role")
        a.execute(
            """SELECT public.mobility_stage_delivery_request(
                 %s,%s,'MOTO','DOCUMENTS',200,8,8,8,'CENTRO','FERNANDO_DE_LA_MORA',false)""",
            (sender, request_key),
        )
        delivery_id = a.fetchone()[0]
        a.execute(
            "SELECT public.mobility_stage_delivery_offer(%s,%s,%s,%s,30)",
            (delivery_id, courier, vehicle, offer_key),
        )
        offer_id = a.fetchone()[0]
        first.commit()

        # Session A holds the row in an uncommitted claim transaction.
        a.execute(
            "SELECT offer_id,claim_nonce FROM public.mobility_stage_claim_delivery_push_v2(%s)",
            (worker_a,),
        )
        rows = a.fetchall()
        assert len(rows) == 1 and rows[0][0] == offer_id, rows
        nonce_a = rows[0][1]

        b.execute("SET LOCAL statement_timeout='2000ms'")
        b.execute(
            "SELECT offer_id FROM public.mobility_stage_claim_delivery_push_v2(%s)",
            (worker_b,),
        )
        assert b.fetchall() == [], "G13 SKIP LOCKED blocked or duplicated"
        second.commit()
        first.commit()

        # A committed fresh claim remains exclusively owned by A.
        b.execute(
            "SELECT offer_id FROM public.mobility_stage_claim_delivery_push_v2(%s)",
            (worker_b,),
        )
        assert b.fetchall() == [], "G13 stole a fresh worker lease"
        second.commit()

        # Simulate A dying before BEGIN. After lease expiry, B may safely take over.
        a.execute(
            """UPDATE public.mobility_stage_delivery_offer_outbox
               SET claimed_at=clock_timestamp()-interval '13 seconds'
               WHERE offer_id=%s""",
            (offer_id,),
        )
        assert a.rowcount == 1
        first.commit()
        b.execute(
            "SELECT offer_id,claim_nonce FROM public.mobility_stage_claim_delivery_push_v2(%s)",
            (worker_b,),
        )
        rows = b.fetchall()
        assert len(rows) == 1 and rows[0][0] == offer_id, rows
        nonce_b = rows[0][1]
        assert nonce_a != nonce_b, "G13 reclaimed without rotating nonce"
        second.commit()

        a.execute(
            "SELECT public.mobility_stage_begin_delivery_push_v2(%s,%s,%s)",
            (worker_a, offer_id, nonce_a),
        )
        assert a.fetchone()[0] is False, "Stale worker started provider send"
        first.commit()

        b.execute(
            "SELECT public.mobility_stage_begin_delivery_push_v2(%s,%s,%s)",
            (worker_b, offer_id, nonce_b),
        )
        assert b.fetchone()[0] is True, "Current owner failed to begin"
        second.commit()

        a.execute(
            "SELECT public.mobility_stage_ack_delivery_push_v2(%s,%s,%s,%s)",
            (worker_a, offer_id, nonce_a, "ticket_old_123"),
        )
        assert a.fetchone()[0] is False, "Stale worker ACK succeeded"
        first.commit()

        b.execute(
            "SELECT public.mobility_stage_ack_delivery_push_v2(%s,%s,%s,%s)",
            (worker_b, offer_id, nonce_b, "ticket_new_123"),
        )
        assert b.fetchone()[0] is True, "Current owner ACK failed"
        b.execute(
            """SELECT provider_ticket_id,receipt_confirmed_at
               FROM public.mobility_stage_delivery_offer_outbox WHERE offer_id=%s""",
            (offer_id,),
        )
        assert b.fetchone() == ("ticket_new_123", None), "ACK incorrectly implied receipt"
        second.commit()

print("G13 independent-session claim, fencing and ACK PASS")
