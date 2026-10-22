"""Disposable PostgreSQL G12 real two-session SKIP LOCKED check. No remote DB."""
import os
import subprocess

offer = "00000000-0000-4000-8000-000000000012"
worker_a = "00000000-0000-4000-8000-000000000021"
worker_b = "00000000-0000-4000-8000-000000000022"

def psql(sql):
    return subprocess.run(["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
                           "-c", sql], check=True, capture_output=True, text=True).stdout.strip()

assert os.getenv("PGDATABASE") == "qore_disposable", "Refusing non-disposable database"
assert psql("SELECT count(*) FROM public.mobility_stage_delivery_offer_outbox WHERE claimed_at IS NULL") == "1"
first = subprocess.Popen(
    ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    text=True, bufsize=1,
)
try:
    first.stdin.write("BEGIN;\n")
    first.stdin.write(f"SELECT offer_id FROM public.mobility_stage_claim_delivery_push('{worker_a}');\n")
    first.stdin.flush()
    claimed = first.stdout.readline().strip()
    assert claimed == offer, f"first worker failed to claim: {claimed!r}"
    # First session still holds the row lock until its explicit COMMIT.
    second = psql(f"SELECT count(*) FROM public.mobility_stage_claim_delivery_push('{worker_b}')")
    assert second == "0", f"second worker claimed locked offer: {second!r}"
    first.stdin.write("COMMIT;\n")
    first.stdin.close()
    first.wait(timeout=10)
    assert first.returncode == 0, "first transaction failed"
    assert psql(f"SELECT count(*) FROM public.mobility_stage_delivery_offer_outbox WHERE offer_id='{offer}' AND claimed_by='{worker_a}'") == "1"
    assert psql(f"SELECT public.mobility_stage_ack_delivery_push('{worker_b}','{offer}','ticket_12345')") == "f"
    assert psql(f"SELECT public.mobility_stage_ack_delivery_push('{worker_a}','{offer}','ticket_12345')") == "t"
    assert psql(f"SELECT public.mobility_stage_ack_delivery_push('{worker_a}','{offer}','ticket_12345')") == "f"
    print("G12 disposable concurrent claim and owner-only ACK PASS")
finally:
    if first.poll() is None:
        first.kill()
        first.wait(timeout=10)
