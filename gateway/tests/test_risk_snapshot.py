import hashlib
import hmac
import json
from datetime import UTC, datetime

from qore_mobile_gateway.auth import RuntimeCredential, RuntimeCredentialRegistry
from tests.device_auth_helpers import (
    build_client,
    enroll_device,
    new_private_key,
    proof_headers,
)


SECRET = b"risk-runtime-secret"


def test_authenticated_runtime_risk_snapshot_reaches_mobile_read_api() -> None:
    registry = RuntimeCredentialRegistry(
        [
            RuntimeCredential(
                runtime_id="runtime-a",
                account_ids=frozenset({"account-a"}),
                secret=SECRET,
            )
        ]
    )
    client = build_client(credential_registry=registry)
    private_key = new_private_key()
    session = enroll_device(client, private_key)
    now = datetime.now(UTC)

    payload = {
        "schema_version": "0.1",
        "event_id": "risk-1",
        "event_type": "risk.snapshot",
        "runtime_id": "runtime-a",
        "account_id": "account-a",
        "sequence": 1,
        "event_time": now.isoformat(),
        "emitted_at": now.isoformat(),
        "payload": {
            "account_id": "account-a",
            "state": "normal",
            "source": "qore-risk",
            "as_of": now.isoformat(),
            "daily_drawdown_fraction": 0.01,
            "total_drawdown_fraction": 0.02,
            "open_risk_fraction": 0.005,
            "daily_loss_remaining_fraction": 0.03,
            "total_loss_remaining_fraction": 0.05,
        },
    }
    body = json.dumps(payload, separators=(",", ":")).encode()
    signature = "v1=" + hmac.new(SECRET, body, hashlib.sha256).hexdigest()

    accepted = client.post(
        "/v1/runtime/events",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Qore-Runtime-Id": "runtime-a",
            "X-Qore-Signature": signature,
        },
    )
    assert accepted.status_code == 202

    response = client.get(
        "/v1/risk",
        headers=proof_headers(
            token=session["access_token"],
            private_key=private_key,
            method="GET",
            path="/v1/risk",
        ),
    )
    assert response.status_code == 200
    risk = response.json()
    assert len(risk) == 1
    assert risk[0]["account_id"] == "account-a"
    assert risk[0]["source"] == "qore-risk"
    assert risk[0]["open_risk_fraction"] == 0.005
