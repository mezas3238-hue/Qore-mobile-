"""G130: PostgreSQL16 multi-connection credit reservation race (NO HTTP)."""
import concurrent.futures
import json
import os
import psycopg

assert os.environ.get("CI") == "true"
assert os.environ.get("PGHOST") == "localhost"
assert os.environ.get("PGDATABASE") == "qore_disposable_geoapify"
assert os.environ.get("PGAPPNAME") == "qore_ci_disposable_geoapify"
ACTOR = "13000000-0000-4130-8130-000000000001"
DELIVERY = "13000000-0000-4130-8130-000000000002"
QUERY = ("SELECT public.mobility_stage_g130_reserve_geoapify_free_qa("
         "%s::uuid,%s::uuid,%s::text,%s::uuid,%s::uuid)::text")

def key(n):
    return f"13000000-0000-4130-8130-{n:012d}"

def reserve(n):
    with psycopg.connect() as db:
        with db.cursor() as cur:
            cur.execute("SET ROLE service_role")
            cur.execute(QUERY, (ACTOR, DELIVERY,
                                "MOTO" if n % 2 else "AUTO", key(n), key(n)))
            receipt = json.loads(cur.fetchone()[0])
            db.commit()
    return receipt

with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
    receipts = list(pool.map(reserve, range(1, 49)))
assert len(receipts) == 48 and all(r["approved"] is True for r in receipts)
assert all(r["durable"] is True for r in receipts)

# Competing replicas with the same coverage evidence: exactly one can
# reserve the provider call. 15 others must NOT authorize another HTTP.
with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
    identical = list(pool.map(reserve, [49] * 16))
assert sum(r["approved"] is True for r in identical) == 1
assert sum(r["approved"] is False and r.get("replayBlocked") is True
           for r in identical) == 15

with psycopg.connect() as db:
    with db.cursor() as cur:
        cur.execute("SELECT calls,credits FROM "
                    "public.mobility_stage_g130_free_quota_days")
        assert cur.fetchone() == (49, 147)
        cur.execute("SELECT count(*) FROM "
                    "public.mobility_stage_g130_free_route_reservations")
        assert cur.fetchone()[0] == 49
print("G130 PostgreSQL concurrency PASS: 49 reservations, 147 credits, "
      "15 competing replay calls denied, zero external API calls.")
