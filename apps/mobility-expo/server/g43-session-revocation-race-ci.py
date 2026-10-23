"""G43: two REAL independent PG16 transactions prove revocation fencing.

Local disposable DB only; never reads provider credentials or contacts network.
An operation already holding G42 FOR SHARE commits before revocation;
a revocation that holds the row first makes the operation fail closed.
"""
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from time import sleep
from datetime import datetime, timezone
import os
import psycopg

assert os.environ.get("PGHOST") in ("localhost", "127.0.0.1"), "Remote database forbidden"
assert os.environ.get("PGDATABASE") == "qore_disposable_chain", "Non-QA DB forbidden"
assert os.environ.get("PGAPPNAME") == "qore_ci_disposable_chain", "Wrong PG application"
assert os.environ.get("PGUSER") == "qore_ci", "Disposable owner only"

ACTOR = "43430000-0000-4343-8343-000000000010"
SESSIONS = [
    "43430000-0000-4343-8343-000000000110",
    "43430000-0000-4343-8343-000000000120",
]
EFFECTS = [
    "43430000-0000-4343-8343-000000000210",
    "43430000-0000-4343-8343-000000000220",
]
SQL_PROBE = """SELECT public.mobility_stage_g43_guarded_probe(
    %s::uuid,%s::uuid,%s::uuid,%s::bigint)"""
SQL_REVOKE = """UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=clock_timestamp(),revision=revision+1
 WHERE user_id=%s::uuid AND session_id=%s::uuid AND revoked_at IS NULL"""


def connect():
    return psycopg.connect(connect_timeout=10, options="-c statement_timeout=12000")


def iat_ms():
    return int(datetime.now(timezone.utc).timestamp()*1000)


def setup():
    with connect() as db, db.cursor() as cur:
        cur.execute("INSERT INTO auth.users(id) VALUES (%s::uuid)", (ACTOR,))
        for sid in SESSIONS:
            cur.execute("""INSERT INTO public.mobility_stage_g42_provider_session_grants(
                user_id,session_id,provider_confirmed_at,token_allowed_from,
                valid_until,evidence_kind
            ) VALUES (%s::uuid,%s::uuid,clock_timestamp()-interval '1 hour',
             clock_timestamp()-interval '1 minute',
             clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY')""",
             (ACTOR,sid))


def cleanup():
    with connect() as db, db.cursor() as cur:
        cur.execute("DELETE FROM public.mobility_stage_g43_guarded_effects WHERE user_id=%s::uuid", (ACTOR,))
        cur.execute("DELETE FROM public.mobility_stage_g42_provider_session_grants WHERE user_id=%s::uuid", (ACTOR,))
        cur.execute("DELETE FROM auth.users WHERE id=%s::uuid", (ACTOR,))


def operation(session, effect, started=None, release=None):
    with connect() as db, db.cursor() as cur:
        try:
            cur.execute(SQL_PROBE, (effect,ACTOR,session,iat_ms()))
            assert cur.fetchone()[0] is True
            if started:
                started.set()
            if release:
                assert release.wait(8), "Operation release timed out"
            db.commit()
            return "committed"
        except psycopg.Error as error:
            db.rollback()
            return error.sqlstate


def revoke(session, started=None, release=None):
    with connect() as db, db.cursor() as cur:
        cur.execute(SQL_REVOKE, (ACTOR,session))
        assert cur.rowcount == 1
        if started:
            started.set()
        if release:
            assert release.wait(8), "Revoker release timed out"
        db.commit()
        return "revoked"


def check(session, effect, has_effect):
    with connect() as db, db.cursor() as cur:
        cur.execute("SELECT revoked_at IS NOT NULL FROM public.mobility_stage_g42_provider_session_grants WHERE user_id=%s::uuid AND session_id=%s::uuid",(ACTOR,session))
        assert cur.fetchone() == (True,), "Missing committed revocation"
        cur.execute("SELECT count(*) FROM public.mobility_stage_g43_guarded_effects WHERE effect_id=%s::uuid",(effect,))
        assert cur.fetchone()[0] == (1 if has_effect else 0), "Unexpected persisted effect"


def operation_precedes_revoke(pool):
    held, release = Event(), Event()
    op=pool.submit(operation, SESSIONS[0], EFFECTS[0], held, release)
    assert held.wait(8), "Operation never held session lock"
    rev=pool.submit(revoke, SESSIONS[0])
    try:
        sleep(.3)
        assert not rev.done(), "Revocation escaped operation's FOR SHARE lock"
    finally:
        release.set()
    assert op.result(timeout=10) == "committed"
    assert rev.result(timeout=10) == "revoked"
    check(SESSIONS[0], EFFECTS[0], True)
    assert operation(SESSIONS[0], EFFECTS[1]) == "G4301"
    print("G43 PASS: in-flight operation commits, then revocation; post-revoke denied", flush=True)


def revoke_precedes_operation(pool):
    held, release=Event(), Event()
    rev=pool.submit(revoke, SESSIONS[1], held, release)
    assert held.wait(8), "Revoker never held grant row"
    op=pool.submit(operation, SESSIONS[1], EFFECTS[1])
    try:
        sleep(.3)
        assert not op.done(), "Operation did not wait for pending revoke"
    finally:
        release.set()
    assert rev.result(timeout=10)=="revoked"
    assert op.result(timeout=10)=="G4301"
    check(SESSIONS[1], EFFECTS[1], False)
    print("G43 PASS: revoke commits first, operation fails without writes", flush=True)


if __name__ == "__main__":
    setup()
    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            operation_precedes_revoke(executor)
            revoke_precedes_operation(executor)
    finally:
        cleanup()
