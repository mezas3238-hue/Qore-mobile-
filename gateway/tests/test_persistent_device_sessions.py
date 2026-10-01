from pathlib import Path

import pytest

from qore_mobile_gateway.device_sessions import EnrollmentCodeRegistry
from qore_mobile_gateway.main import _default_device_session_store
from qore_mobile_gateway.persistent_device_sessions import (
    PersistentDeviceSessionStore,
)
from tests.device_auth_helpers import (
    DEVICE_ID,
    ENROLLMENT_CODE,
    build_client,
    enroll_device,
    new_private_key,
    proof_headers,
    public_key_b64,
)


def _store(path: Path) -> PersistentDeviceSessionStore:
    return PersistentDeviceSessionStore(
        db_path=path,
        enrollment_codes=EnrollmentCodeRegistry.for_test_codes(
            {ENROLLMENT_CODE}
        ),
    )


def test_access_session_survives_gateway_restart(tmp_path: Path) -> None:
    database = tmp_path / "mobile-security.sqlite3"
    private_key = new_private_key()

    first_store = _store(database)
    first_client = build_client(device_sessions=first_store)
    session = enroll_device(first_client, private_key)
    first_client.close()
    first_store.close()

    second_store = _store(database)
    second_client = build_client(device_sessions=second_store)
    response = second_client.get(
        "/v1/accounts",
        headers=proof_headers(
            token=session["access_token"],
            private_key=private_key,
            method="GET",
            path="/v1/accounts",
            nonce="restart-session-nonce",
        ),
    )

    assert response.status_code == 200
    second_client.close()
    second_store.close()


def test_consumed_enrollment_code_stays_consumed_after_restart(
    tmp_path: Path,
) -> None:
    database = tmp_path / "mobile-security.sqlite3"

    first_store = _store(database)
    first_client = build_client(device_sessions=first_store)
    enroll_device(first_client, new_private_key())
    first_client.close()
    first_store.close()

    second_store = _store(database)
    second_client = build_client(device_sessions=second_store)
    another_key = new_private_key()
    response = second_client.post(
        "/v1/mobile/enroll",
        headers={"X-Qore-Enrollment-Code": ENROLLMENT_CODE},
        json={
            "device_id": "device-test-0002",
            "platform": "android",
            "label": "Second phone",
            "public_key_b64": public_key_b64(another_key),
        },
    )

    assert response.status_code == 401
    assert "already-used" in response.json()["detail"]["message"]
    second_client.close()
    second_store.close()


def test_proof_nonce_replay_stays_blocked_after_restart(tmp_path: Path) -> None:
    database = tmp_path / "mobile-security.sqlite3"
    private_key = new_private_key()

    first_store = _store(database)
    first_client = build_client(device_sessions=first_store)
    session = enroll_device(first_client, private_key)
    headers = proof_headers(
        token=session["access_token"],
        private_key=private_key,
        method="GET",
        path="/v1/accounts",
        nonce="restart-replay-nonce",
    )
    first = first_client.get("/v1/accounts", headers=headers)
    assert first.status_code == 200
    first_client.close()
    first_store.close()

    second_store = _store(database)
    second_client = build_client(device_sessions=second_store)
    replay = second_client.get("/v1/accounts", headers=headers)

    assert replay.status_code == 401
    assert "replay" in replay.json()["detail"]["message"]
    second_client.close()
    second_store.close()


def test_production_gateway_requires_persistent_device_state(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("QORE_GATEWAY_ENV", "production")
    monkeypatch.delenv("QORE_MOBILE_STATE_DB_PATH", raising=False)

    with pytest.raises(RuntimeError, match="QORE_MOBILE_STATE_DB_PATH"):
        _default_device_session_store()
