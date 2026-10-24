#!/usr/bin/env python3
"""G58: verify both private chat SQL roles are independent, NOLOGIN,
non-owner, transaction-local, forbidden to mint or read ticket tables.
Only PostgreSQL16 disposable_chain on localhost; no remote DB.
"""
import os
import psycopg

assert os.environ.get("PGHOST")=="localhost"
assert os.environ.get("PGDATABASE")=="qore_disposable_chain"
assert os.environ.get("PGAPPNAME")=="qore_ci_disposable_chain"

DRIVER="mobility_g56_driver_gateway_ci"
PAX="mobility_g49_chat_gateway_ci"
ROLES={
 DRIVER:[
  "public.mobility_stage_g56_driver_inbox_qa(uuid,bigint,bigint,uuid,integer)",
  "public.mobility_stage_g57b_driver_history_markers_qa(uuid,bigint,bigint,integer)",
  "public.mobility_stage_g57b_driver_mark_visible_qa(uuid,uuid)"
 ],
 PAX:[
  "public.mobility_stage_g57_history_markers_qa(uuid,bigint,bigint,integer)",
  "public.mobility_stage_g57_mark_visible_ordered_qa(uuid,uuid)"
 ]
}
DENIED=[
 "public.mobility_stage_g57b_mint_read_owner_qa(uuid,uuid,bigint,uuid)",
 "public.mobility_stage_g56_mint_owner_qa(uuid,uuid,bigint,text,text,uuid,uuid)",
 "public.mobility_stage_g54_mark_read_qa(uuid,bigint)",
 "public.mobility_stage_g55_mark_viewed_qa(uuid,uuid)"
]
FORBIDDEN_TABLES=[
 "public.mobility_stage_g57b_driver_read_tickets",
 "public.mobility_stage_g57b_driver_markers",
 "public.mobility_stage_g57_visible_markers",
 "public.mobility_stage_g56_driver_tickets",
 "public.mobility_stage_g50_chat_messages",
 "public.mobility_stage_g42_provider_session_grants"
]
def db():
    return psycopg.connect(host=os.environ["PGHOST"],
      port=os.environ.get("PGPORT","5432"),user=os.environ["PGUSER"],
      password=os.environ["PGPASSWORD"],dbname=os.environ["PGDATABASE"],
      options="-c application_name=qore_ci_disposable_chain")

with db() as conn:
    for role in ROLES:
        info=conn.execute("""
          SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit
          FROM pg_catalog.pg_roles WHERE rolname=%s
        """,(role,)).fetchone()
        assert info==(False,False,False,False,False),(role,info)

for role,allowed in ROLES.items():
    with db() as conn:
        origin=conn.execute("SELECT current_user").fetchone()[0]
        conn.execute("SET LOCAL ROLE "+role)  # role from constant local allowlist
        effective=conn.execute("SELECT current_user").fetchone()[0]
        assert effective==role,effective
        for fn in allowed:
            assert conn.execute("""
              SELECT pg_catalog.has_function_privilege(current_user,%s,'EXECUTE')
            """,(fn,)).fetchone()[0] is True,(role,fn)
        for fn in DENIED:
            assert conn.execute("""
              SELECT pg_catalog.has_function_privilege(current_user,%s,'EXECUTE')
            """,(fn,)).fetchone()[0] is False,(role,fn)
        for fn in ROLES[PAX if role==DRIVER else DRIVER]:
            assert conn.execute("""
              SELECT pg_catalog.has_function_privilege(current_user,%s,'EXECUTE')
            """,(fn,)).fetchone()[0] is False,(role,fn)
        for table in FORBIDDEN_TABLES:
            assert conn.execute("""
              SELECT pg_catalog.has_table_privilege(current_user,%s,'SELECT')
            """,(table,)).fetchone()[0] is False,(role,table)
        assert conn.execute("""
          SELECT current_database(),current_setting('application_name')
        """).fetchone()==("qore_disposable_chain","qore_ci_disposable_chain")
        conn.commit()
        after=conn.execute("SELECT current_user").fetchone()[0]
        assert after==origin,(role,origin,after)

with db() as conn:
    assert conn.execute("SELECT current_user").fetchone()[0] not in ROLES

print("G58 PASS: Driver/Passenger NOLOGIN SQL executor roles isolated, no owner mint, transaction reset")
