"""G48: two real PostgreSQL connections compete for one delegated read ticket.

Disposable CI only; QA owner mints the fake provider-attested capability. The
NOLOGIN role can execute ONLY G48 read wrappers, not mint, read proofs or DML.
No real JWT, private files, remotely stored evidence, PSP or LIVE endpoints.
"""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import os
import time
import psycopg

assert os.environ.get("PGHOST") in ("localhost", "127.0.0.1")
assert os.environ.get("PGDATABASE") == "qore_disposable_chain"
assert os.environ.get("PGAPPNAME") == "qore_ci_disposable_chain"
assert os.environ.get("PGUSER") == "qore_ci"

DRIVER="48480000-0000-4848-8484-000000000601"
SESSION="48480000-0000-4848-8484-000000000701"
def db():
    return psycopg.connect(connect_timeout=10, options="-c statement_timeout=16000")

def setup():
    with db() as cx,cx.cursor() as c:
        c.execute("INSERT INTO auth.users(id) VALUES(%s::uuid)",(DRIVER,))
        # G0 synthetic Auth seeds passenger. Switch role using same exclusive
        # transition as G18 in the disposable database, never in a real project.
        c.execute("DELETE FROM public.user_roles WHERE user_id=%s::uuid",(DRIVER,))
        c.execute("INSERT INTO public.user_roles(user_id,role) VALUES(%s::uuid,'driver'::public.app_role)",(DRIVER,))
        c.execute("""INSERT INTO public.mobility_stage_g42_provider_session_grants(
          user_id,session_id,provider_confirmed_at,token_allowed_from,
          valid_until,evidence_kind
        ) VALUES(%s::uuid,%s::uuid,clock_timestamp()-interval '1 hour',
          clock_timestamp()-interval '2 minutes',clock_timestamp()+interval '1 hour',
          'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')""",(DRIVER,SESSION))

def mint():
    with db() as cx,cx.cursor() as c:
        c.execute("""SELECT public.mobility_stage_g48_mint_owner_attested_qa(
           %s::uuid,%s::uuid,
           floor(extract(epoch FROM clock_timestamp())*1000)::bigint,
           'DRIVER_STATUS',%s::uuid)""",(DRIVER,SESSION,DRIVER))
        receipt=c.fetchone()[0]
        assert receipt["purpose"]=="DRIVER_STATUS"
        assert receipt["delegationKind"]=="QA_OWNER_ONLY_NOT_JWT_BOUND"
        assert receipt["productionEnabled"] is False
        return receipt["ticket"]

def query(ticket,barrier=None):
    with db() as cx,cx.cursor() as c:
        c.execute("SET ROLE mobility_g48_gateway_ci")
        if barrier:
            barrier.wait(timeout=12)
        try:
            c.execute("SELECT public.mobility_stage_g48_driver_status_qa(%s::uuid)",(ticket,))
            result=c.fetchone()[0]
            cx.commit()
            return ("success",result)
        except psycopg.Error as err:
            cx.rollback()
            return ("error",err.sqlstate)

def assert_single_winner():
    ticket=mint()
    barrier=Barrier(2)
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(query,ticket,barrier) for _ in range(2)]
        results=[f.result(timeout=24) for f in futures]
    succeeded=[r for r in results if r[0]=="success"]
    rejected=[r for r in results if r==("error","G4804")]
    assert len(succeeded)==1 and len(rejected)==1,results
    assert succeeded[0][1]["source"]=="QA_G48_DRIVER_STATUS_ONLY"
    assert succeeded[0][1]["signedUrlAvailable"] is False
    assert succeeded[0][1]["documentBytesAvailable"] is False
    with db() as cx,cx.cursor() as c:
        c.execute("""SELECT count(*) FROM public.mobility_stage_g48_ticket_audit
          WHERE actor_id=%s::uuid AND action='CONSUMED'""",(DRIVER,))
        assert c.fetchone()[0]==1
    print("G48 PASS: two PG sessions same ticket, exactly one successful use",flush=True)

def assert_revoke_after_mint():
    ticket=mint()
    with db() as cx,cx.cursor() as c:
        c.execute("""UPDATE public.mobility_stage_g42_provider_session_grants
           SET revoked_at=clock_timestamp(),revision=revision+1
           WHERE user_id=%s::uuid AND session_id=%s::uuid""",(DRIVER,SESSION))
    outcome=query(ticket)
    assert outcome==("error","G4801"),outcome
    with db() as cx,cx.cursor() as c:
        c.execute("""SELECT count(*) FROM public.mobility_stage_g48_ticket_audit
          WHERE actor_id=%s::uuid AND action='CONSUMED'""",(DRIVER,))
        assert c.fetchone()[0]==1
    print("G48 PASS: provider revocation before consumption denies old ticket",flush=True)

if __name__=="__main__":
    setup()
    assert_single_winner()
    assert_revoke_after_mint()
