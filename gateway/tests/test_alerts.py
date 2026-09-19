import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta

from qore_mobile_gateway.auth import RuntimeCredential, RuntimeCredentialRegistry
from qore_mobile_gateway.repository import ReadRepository
from qore_mobile_gateway.runtime_state import RuntimeStateStore, SequenceGap
from tests.device_auth_helpers import (
    build_client,
    enroll_device,
    new_private_key,
    proof_headers,
)


RUNTIME_SECRET = b"runtime-alert-test-secret"


def _runtime_registry() -> RuntimeCredentialRegistry:
    return RuntimeCredentialRegistry(
        [
            RuntimeCredential(
                runtime_id="runtime-a",
                account_ids=frozenset({"account-a"}),
                secret=RUNTIME_SECRET,
            )
        ]
    )


def _runtime_post(client, payload: dict):
    body = json.dumps(payload, separators=(",", ":")).encode()
    signature = "v1=" + hmac.new(
        RUNTIME_SECRET,
        body,
        hashlib.sha256,
    ).hexdigest()
    return client.post(
        "/v1/runtime/events",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Qore-Runtime-Id": "runtime-a",
            "X-Qore-Signature": signature,
        },
    )


def _read_alerts(client, access_token: str, private_key):
    return client.get(
        "/v1/alerts",
        headers=proof_headers(
            token=access_token,
            private_key=private_key,
            method="GET",
            path="/v1/alerts",
        ),
    )


def test_alert_center_surfaces_offline_and_reconciliation_state() -> None:
    states = RuntimeStateStore()
    repository = ReadRepository()
    client = build_client(
        runtime_state=states,
        read_repository=repository,
    )
    private_key = new_private_key()
    session = enroll_device(client, private_key)

    now = datetime.now(UTC)
    states.accept_sequence(
        runtime_id="runtime-a",
        account_id="account-a",
        sequence=1,
    )
    try:
        states.accept_sequence(
            runtime_id="runtime-a",
            account_id="account-a",
            sequence=3,
        )
    except SequenceGap:
        pass
    states.record_heartbeat(
        runtime_id="runtime-a",
        account_id="account-a",
        event_time=now - timedelta(seconds=61),
        received_at=now - timedelta(seconds=61),
    )

    response = _read_alerts(
        client,
        session["access_token"],
        private_key,
    )

    assert response.status_code == 200
    kinds = {item["kind"] for item in response.json()}
    assert "runtime.offline" in kinds
    assert "runtime.reconciliation_required" in kinds


def test_position_open_event_is_visible_in_alert_center() -> None:
    client = build_client(credential_registry=_runtime_registry())
    private_key = new_private_key()
    session = enroll_device(client, private_key)
    now = datetime.now(UTC)

    event = {
        "schema_version": "0.1",
        "event_id": "position-open-1",
        "event_type": "position.opened",
        "runtime_id": "runtime-a",
        "account_id": "account-a",
        "sequence": 1,
        "event_time": now.isoformat(),
        "emitted_at": now.isoformat(),
        "payload": {
            "position_id": "position-1",
            "account_id": "account-a",
            "trader_id": "vt08-forex",
            "symbol": "EURUSD",
            "side": "long",
            "entry": 1.1,
            "current_price": 1.1,
            "size": 0.1,
            "opened_at": now.isoformat(),
            "as_of": now.isoformat(),
        },
    }

    accepted = _runtime_post(client, event)
    assert accepted.status_code == 202

    response = _read_alerts(
        client,
        session["access_token"],
        private_key,
    )
    assert response.status_code == 200

    position_alerts = [
        item for item in response.json()
        if item["kind"] == "position.opened"
    ]
    assert len(position_alerts) == 1
    assert position_alerts[0]["position_id"] == "position-1"
    assert "EURUSD" in position_alerts[0]["title"]
