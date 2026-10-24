#!/usr/bin/env python3
"""G58F: independent PostgreSQL16 sessions test scoped QA attestation exchange.
No real identities, public servers, provider secrets or production connections.
"""
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import psycopg

for key, value in {"PGHOST":"localhost","PGDATABASE":"qore_disposable_chain",
                   "PGAPPNAME":"qore_ci_disposable_chain"}.items():
    assert os.environ.get(key)==value,(key,"must be disposable-local")

PAX="49490000-0000-4949-8949-000000000001"
PAX_SESSION="49490000-0000-4949-8949-000000000101"
DRIVER="56560000-0000-4656-8656-000000000002"
DRIVER_SESSION="56560000-0000-4656-8656-000000000102"
SQL="SELECT public.mobility_stage_g58f_exchange_attestation_qa(%s)"
ROLE="mobility_g58f_exchange_ci"

def db():
    return psycopg.connect(host="localhost",port=os.getenv("PGPORT","5432"),
        dbname="qore_disposable_chain",user=os.environ["PGUSER"],
        password=os.environ["PGPASSWORD"],
        options="-c application_name=qore_ci_disposable_chain")

def seed(actor,session,operation,service_kind=None,service_id=None,
         conversation_id=None,iat=None,old=False):
    proof=str(uuid.uuid4())
    with db() as conn:
        if iat is None:
            iat=conn.execute("SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint").fetchone()[0]
        conn.execute("""
         INSERT INTO public.mobility_stage_g58f_owner_attestations
         (proof_hash,actor_id,session_id,token_iat_ms,operation,service_kind,
          service_id,conversation_id,issued_at,expires_at)
         VALUES(pg_catalog.sha256(pg_catalog.convert_to(%s,'UTF8')),
                %s,%s,%s,%s,%s,%s,%s,
                pg_catalog.clock_timestamp() - (CASE WHEN %s THEN interval '25 seconds' ELSE interval '0 seconds' END),
                pg_catalog.clock_timestamp() - (CASE WHEN %s THEN interval '15 seconds' ELSE interval '-12 seconds' END))
        """,(proof,actor,session,iat,operation,service_kind,service_id,
             conversation_id,old,old))
    return proof

def exchange(proof,role=ROLE):
    with db() as conn:
        conn.execute("SET LOCAL ROLE "+role)  # only test constants
        result=conn.execute(SQL,(proof,)).fetchone()[0]
        assert result["productionEnabled"] is False
        assert result["qaOnly"] is True
        assert uuid.UUID(result["ticket"])
        return result

def denied(proof,expect,role=ROLE):
    try:
        exchange(proof,role=role)
    except psycopg.Error as err:
        assert err.sqlstate==expect,(expect,err.sqlstate,str(err))
        return
    raise AssertionError("G58F unexpectedly minted a capability")

with db() as conn:
    assert conn.execute("""SELECT EXISTS(
      SELECT 1 FROM public.mobility_stage_g42_provider_session_grants
      WHERE user_id=%s AND session_id=%s AND revoked_at IS NULL
    )""",(PAX,PAX_SESSION)).fetchone()[0]
    assert conn.execute("""SELECT EXISTS(
      SELECT 1 FROM public.mobility_stage_g42_provider_session_grants
      WHERE user_id=%s AND session_id=%s AND revoked_at IS NULL
    )""",(DRIVER,DRIVER_SESSION)).fetchone()[0]
    r=conn.execute("""SELECT rolcanlogin,rolsuper,rolinherit FROM pg_catalog.pg_roles
      WHERE rolname=%s""",(ROLE,)).fetchone()
    assert r==(False,False,False),r

# A token alone grants nothing to the standard anonymous/app roles.
for role in ("anon","authenticated","service_role",
             "mobility_g49_chat_gateway_ci","mobility_g56_driver_gateway_ci"):
    try:
        with db() as conn:
            conn.execute("SET LOCAL ROLE "+role)
            conn.execute(SQL,(str(uuid.uuid4()),))
    except psycopg.Error as err:
        assert err.sqlstate=="42501",(role,err.sqlstate)
    else:
        raise AssertionError("Unprivileged role could invoke G58F: "+role)

# A synthetic owner-issued proof can be EXCHANGED once, without identity args.
p=seed(PAX,PAX_SESSION,"CHAT_INBOX")
assert exchange(p)["operation"]=="CHAT_INBOX"
denied(p,"G5802")                   # consumed proof is not a standing mint
driver=seed(DRIVER,DRIVER_SESSION,"DRIVER_INBOX")
assert exchange(driver)["operation"]=="DRIVER_INBOX"
denied(driver,"G5802")

# Two independent transactions can race; row lock permits one winner only.
p=seed(PAX,PAX_SESSION,"CHAT_INBOX")
start=Barrier(2)
def compete():
    start.wait()
    try:
        return ("ok",exchange(p)["operation"])
    except psycopg.Error as e:
        return ("denied",e.sqlstate)
with ThreadPoolExecutor(max_workers=2) as pool:
    a=pool.submit(compete)
    b=pool.submit(compete)
    results=sorted([a.result(),b.result()])
assert results==[("denied","G5802"),("ok","CHAT_INBOX")],results

# SQL limits prevent access even with owner-written but wrong-role evidence.
denied(seed(DRIVER,DRIVER_SESSION,"CHAT_INBOX"),"G5403")
denied(seed(PAX,DRIVER_SESSION,"CHAT_INBOX"),"G5803")
denied(seed(PAX,PAX_SESSION,"CHAT_INBOX",iat=1000),"G5803")
denied(seed(PAX,PAX_SESSION,"CHAT_INBOX",old=True),"G5802")

# A session lock held by exchange prevents concurrent revocation before commit.
p=seed(DRIVER,DRIVER_SESSION,"DRIVER_INBOX")
holder=db()
try:
    holder.execute("SET LOCAL ROLE "+ROLE)
    first=holder.execute(SQL,(p,)).fetchone()[0]
    assert first["operation"]=="DRIVER_INBOX"
    with db() as competing:
        competing.execute("SET LOCAL lock_timeout='200ms'")
        try:
            competing.execute("""
              UPDATE public.mobility_stage_g42_provider_session_grants
              SET revoked_at=pg_catalog.clock_timestamp(), revision=revision+1
              WHERE user_id=%s AND session_id=%s
            """,(DRIVER,DRIVER_SESSION))
        except psycopg.Error as err:
            assert err.sqlstate=="55P03",(err.sqlstate,str(err))
        else:
            raise AssertionError("Revocation overtook the G42 session row lock")
    holder.commit()
finally:
    holder.close()

# After the original transaction commits, revocation applies, and future
# attestations cannot be exchanged even though the QA owner can seed a row.
with db() as conn:
    conn.execute("""
      UPDATE public.mobility_stage_g42_provider_session_grants
      SET revoked_at=pg_catalog.clock_timestamp(), revision=revision+1
      WHERE user_id=%s AND session_id=%s
    """,(DRIVER,DRIVER_SESSION))
denied(seed(DRIVER,DRIVER_SESSION,"DRIVER_INBOX"),"G5803")
print("G58F PASS: denied public roles, one-use exchange, two-session replay, G42 revoke fence, wrong role and expiry (QA only)")
