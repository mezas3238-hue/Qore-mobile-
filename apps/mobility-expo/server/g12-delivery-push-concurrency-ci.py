"""Real concurrent G12 claim in disposable PostgreSQL 16. Never remote."""
import os
import psycopg

assert os.getenv("PGDATABASE") == "qore_disposable", "Refusing non-disposable database"
assert os.getenv("PGHOST") in ("localhost", "127.0.0.1"), "Refusing remote database"
dsn = "host=localhost port=5432 dbname=qore_disposable user=qore_ci password=qore_ci_only connect_timeout=5"
worker_a = "00000000-0000-4000-8000-000000000021"
worker_b = "00000000-0000-4000-8000-000000000022"
offer = "00000000-0000-4000-8000-000000000012"
with psycopg.connect(dsn) as first, psycopg.connect(dsn) as second:
    with first.cursor() as a, second.cursor() as b:
        a.execute("SELECT offer_id FROM public.mobility_stage_claim_delivery_push(%s)", (worker_a,))
        rows = a.fetchall()
        assert len(rows) == 1 and str(rows[0][0]) == offer, rows
        # Keep first transaction open. SKIP LOCKED must not block or double-claim.
        b.execute("SET LOCAL statement_timeout='2000ms'")
        b.execute("SELECT offer_id FROM public.mobility_stage_claim_delivery_push(%s)", (worker_b,))
        assert b.fetchall() == [], "Concurrent worker double-claimed"
        second.commit()
        first.commit()
        b.execute("SELECT claimed_by FROM public.mobility_stage_delivery_offer_outbox WHERE offer_id=%s", (offer,))
        assert str(b.fetchone()[0]) == worker_a
        b.execute("SELECT public.mobility_stage_ack_delivery_push(%s,%s,%s)",
                  (worker_b, offer, "ticket_12345"))
        assert b.fetchone()[0] is False
        b.execute("SELECT public.mobility_stage_ack_delivery_push(%s,%s,%s)",
                  (worker_a, offer, "ticket_12345"))
        assert b.fetchone()[0] is True
        b.execute("SELECT public.mobility_stage_ack_delivery_push(%s,%s,%s)",
                  (worker_a, offer, "ticket_12345"))
        assert b.fetchone()[0] is False
        b.execute("SELECT receipt_confirmed_at FROM public.mobility_stage_delivery_offer_outbox WHERE offer_id=%s",
                  (offer,))
        assert b.fetchone()[0] is None, "Provider ACK must not imply device receipt"
        # Simulate a worker that died with an already-expired synthetic claim.
        # The cleanup process must SKIP the locked row rather than hang or steal it.
        expired_offer = "00000000-0000-4000-8000-000000000014"
        b.execute(
            """UPDATE public.mobility_stage_delivery_offer_outbox
               SET claimed_at=clock_timestamp()-interval '2 minutes', claimed_by=%s
               WHERE offer_id=%s""",
            (worker_a, expired_offer),
        )
        assert b.rowcount == 1, "Missing disposable expired-offer fixture"
        second.commit()
        a.execute(
            """SELECT offer_id FROM public.mobility_stage_delivery_offer_outbox
               WHERE offer_id=%s FOR UPDATE""",
            (expired_offer,),
        )
        assert len(a.fetchall()) == 1
        b.execute("SET LOCAL statement_timeout='2000ms'")
        b.execute("SELECT public.mobility_stage_expire_delivery_push_claims()")
        assert b.fetchone()[0] == 0, "Cleanup stole a concurrently locked claim"
        second.commit()
        first.commit()
        b.execute("SELECT public.mobility_stage_expire_delivery_push_claims()")
        assert b.fetchone()[0] == 1, "Expired orphan was not cleaned after lock release"
        b.execute(
            """SELECT claimed_at, claimed_by FROM public.mobility_stage_delivery_offer_outbox
               WHERE offer_id=%s""",
            (expired_offer,),
        )
        assert b.fetchone() == (None, None), "Expired orphan retains owner"
        b.execute(
            "SELECT public.mobility_stage_ack_delivery_push(%s,%s,%s)",
            (worker_a, expired_offer, "ticket_12345"),
        )
        assert b.fetchone()[0] is False, "Stale worker ACK succeeded after cleanup"
        second.commit()
print("G12 concurrent claim, ACK, and SKIP LOCKED expired cleanup PASS")
