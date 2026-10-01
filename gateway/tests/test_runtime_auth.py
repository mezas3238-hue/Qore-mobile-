import hashlib
import hmac
import json
from datetime import UTC, datetime

from fastapi.testclient import TestClient

from qore_mobile_gateway.auth import RuntimeCredential, RuntimeCredentialRegistry
from qore_mobile_gateway.main import create_app


SECRET = b"unit-test-secret"
NOW = datetime.now(UTC)


def _client() -> TestClient:
    registry = RuntimeCredentialRegistry(
        [
            RuntimeCredential(
                runtime_id="runtime-a",
                account_ids=frozenset({"account-a"}),
                secret=SECRET,
            )
        ]
    )
    return TestClient(create_app(credential_registry=registry))


def _body(*, account_id: str = "account-a", sequence: int = 1) -> bytes:
    return json.dumps(
        {
            "schema_version": "0.1",
            "event_id": f"evt-{sequence}",
            "event_type": "runtime.heartbeat",
            "runtime_id": "runtime-a",
            "account_id": account_id,
            "sequence": sequence,
            "event_time": NOW.isoformat(),
            "emitted_at": NOW.isoformat(),
            "payload": {},
        },
        separators=(",", ":"),
    ).encode()


def _signature(body: bytes, secret: bytes = SECRET) -> str:
    return "v1=" + hmac.new(secret, body, hashlib.sha256).hexdigest()


def test_rejects_invalid_signature() -> None:
    client = _client()
    body = _body()

    response = client.post(
        "/v1/runtime/events",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Qore-Runtime-Id": "runtime-a",
            "X-Qore-Signature": _signature(body, b"wrong-secret"),
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "runtime_authentication_failed"


def test_rejects_account_not_bound_to_runtime() -> None:
    client = _client()
    body = _body(account_id="account-b")

    response = client.post(
        "/v1/runtime/events",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Qore-Runtime-Id": "runtime-a",
            "X-Qore-Signature": _signature(body),
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "runtime_authentication_failed"
