"""G71: two independent PostgreSQL sessions serialize KYC upload and dispatch.
Disposable qore_ci owner only. No real persons, files, biometrics or LIVE.
"""
import os
import uuid
import psycopg

DRIVER = "00000000-0000-4000-8000-000000000181"
VEHICLE = "71710000-0000-4717-8717-000000000101"
PG_REQUIRED = ("localhost", "qore_disposable_chain", "qore_ci_disposable_chain")


def query(connection, statement, args=()):
    return connection.execute(statement, args).fetchone()


def approved(connection):
    return query(connection, "SELECT public.mobility_stage_g71_valid_locked_dossier(%s,%s)",
                 (DRIVER, VEHICLE))[0] is True


def restore_qa_source(connection):
    # Only the isolated synthetic attestor fixture is updated. No handset
    # supplies evidence of authenticity, dates, selfie or identity.
    connection.execute("""
       UPDATE public.mobility_stage_kyc_verified_evidence_qa e SET
         source_document_id=(
           SELECT id FROM public.mobility_stage_driver_documents doc
           WHERE doc.driver_id=%s AND doc.kind='seguro'
           ORDER BY submitted_at DESC,id DESC LIMIT 1
         ), valid_until=clock_timestamp()+interval '40 days',
         evidence_revision=e.evidence_revision+1,
         authenticity_verified=true,issuer_verified=true,malware_scan_passed=true
       WHERE e.driver_id=%s AND e.vehicle_id=%s AND e.kind='seguro'
    """, (DRIVER, DRIVER, VEHICLE))


def upload_pending(connection):
    key = uuid.uuid4()
    connection.execute("""
       SELECT public.mobility_stage_register_driver_document(
         %s,%s,'seguro',%s,'image/jpeg',9001,%s)
    """, (DRIVER, key, DRIVER + "/seguro-G71-RACE-" + key.hex + ".jpg", "f" * 64))


def expects_error(fn, required):
    try:
        fn()
    except psycopg.Error as exc:
        if exc.sqlstate != required:
            raise AssertionError(f"Expected {required}, got {exc.sqlstate}") from exc
        return
    raise AssertionError(f"Expected PostgreSQL SQLSTATE {required}")


def main():
    for name, required in (("PGHOST", PG_REQUIRED[0]),
                           ("PGDATABASE", PG_REQUIRED[1]),
                           ("PGAPPNAME", PG_REQUIRED[2])):
        if os.environ.get(name) != required:
            raise SystemExit(f"Refusing non-disposable {name}")
    with psycopg.connect(autocommit=True) as a, psycopg.connect(autocommit=True) as b:
        actual = query(a, "SELECT current_database(),current_setting('application_name')")
        if actual != PG_REQUIRED[1:]:
            raise AssertionError("Incorrect database or application identity")
        restore_qa_source(a)
        if not approved(a):
            raise AssertionError("Synthetic verified Driver not eligible before race")

        # An uncommitted newest document version holds the Driver mutex.
        # B's offer RPC must wait instead of reading the old verified dossier.
        with a.transaction():
            upload_pending(a)
            def attempting_offer():
                with b.transaction():
                    b.execute("SET LOCAL lock_timeout='250ms'")
                    b.execute("""
                       SELECT public.mobility_stage_auto_demo_offer(
                       %s,%s,%s,%s,10)
                    """, (uuid.uuid4(), DRIVER, VEHICLE, uuid.uuid4()))
            expects_error(attempting_offer, "55P03")
        # After A COMMIT, no KYC validity can be inherited from old source.
        if approved(b):
            raise AssertionError("Pending upload did not invalidate latest attestation")
        def blocked_offer():
            with b.transaction():
                b.execute("""
                   SELECT public.mobility_stage_auto_demo_offer(
                   %s,%s,%s,%s,10)
                """, (uuid.uuid4(), DRIVER, VEHICLE, uuid.uuid4()))
        expects_error(blocked_offer, "P7401")

        # Reverse order: B holds a verified-document decision lock; new
        # document insert on A cannot commit ahead of that transaction.
        restore_qa_source(b)
        if not approved(b):
            raise AssertionError("New provider-verified version did not restore QA")
        with b.transaction():
            if not approved(b):
                raise AssertionError("B lost KYC evidence before upload race")
            def blocked_upload():
                with a.transaction():
                    a.execute("SET LOCAL lock_timeout='250ms'")
                    upload_pending(a)
            expects_error(blocked_upload, "55P03")
        # The upload may now proceed and immediately revokes QA eligibility.
        with a.transaction():
            upload_pending(a)
        if approved(b):
            raise AssertionError("Post-commit replacement failed to block dispatch")
    print("G71 two-session PASS: upload-first and dispatch-first serial ordering, no stale offer")


if __name__ == "__main__":
    main()
