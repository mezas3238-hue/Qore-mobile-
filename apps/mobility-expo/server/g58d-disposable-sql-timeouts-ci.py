#!/usr/bin/env python3
"""G58D: PostgreSQL16 real disposable SQL statement/lock/idle ceilings.
Check role-limited transactions and rollback recovery with two connections.
Not a remote database, not LIVE.
"""
import os
import psycopg

assert os.environ.get("PGHOST")=="localhost"
assert os.environ.get("PGDATABASE")=="qore_disposable_chain"
assert os.environ.get("PGAPPNAME")=="qore_ci_disposable_chain"

def connect():
    return psycopg.connect(
        host=os.environ["PGHOST"],
        port=os.environ.get("PGPORT","5432"),
        user=os.environ["PGUSER"],
        password=os.environ["PGPASSWORD"],
        dbname=os.environ["PGDATABASE"],
        autocommit=True,
        options="-c application_name=qore_ci_disposable_chain"
    )

with connect() as connection:
    origin=connection.execute("SELECT current_user").fetchone()[0]
    with connection.transaction():
        connection.execute("SET LOCAL statement_timeout = '2500ms'")
        connection.execute("SET LOCAL lock_timeout = '500ms'")
        connection.execute("SET LOCAL idle_in_transaction_session_timeout = '3500ms'")
        connection.execute("SET LOCAL ROLE mobility_g49_chat_gateway_ci")
        values=connection.execute("""
          SELECT current_user,current_setting('statement_timeout'),
           current_setting('lock_timeout'),
           current_setting('idle_in_transaction_session_timeout')
        """).fetchone()
        assert values==(
          'mobility_g49_chat_gateway_ci','2500ms','500ms','3500ms'
        ),values
    assert connection.execute("SELECT current_user").fetchone()[0]==origin
    assert connection.execute(
      "SELECT current_setting('statement_timeout')"
    ).fetchone()[0] not in ("2500ms","2.5s")

with connect() as connection:
    try:
        with connection.transaction():
            connection.execute("SET LOCAL statement_timeout = '75ms'")
            connection.execute("SET LOCAL ROLE mobility_g56_driver_gateway_ci")
            connection.execute("SELECT pg_catalog.pg_sleep(0.3)")
    except psycopg.Error as error:
        assert error.sqlstate=="57014",error.sqlstate
    else:
        raise AssertionError("G58D statement deadline failed")
    assert connection.execute("SELECT 1").fetchone()[0]==1

first=connect()
second=connect()
try:
    with first.transaction():
        first.execute("SELECT pg_catalog.pg_advisory_xact_lock(58580044)")
        try:
            with second.transaction():
                second.execute("SET LOCAL lock_timeout = '100ms'")
                second.execute("SET LOCAL statement_timeout = '500ms'")
                second.execute("SET LOCAL ROLE mobility_g49_chat_gateway_ci")
                second.execute("SELECT pg_catalog.pg_advisory_xact_lock(58580044)")
        except psycopg.Error as error:
            assert error.sqlstate=="55P03",error.sqlstate
        else:
            raise AssertionError("G58D concurrent lock wait not terminated")
        assert second.execute("SELECT 1").fetchone()[0]==1
finally:
    first.close()
    second.close()

print("G58D PASS: transaction-local timeouts, statement/lock cancellation and rollback recovery")
