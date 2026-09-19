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


SECRET = b"unit-test-secret"


def _client():
    registry = RuntimeCredentialRegistry(
        [
            RuntimeCredential(
                runtime_id="runtime-a",
                account_ids=frozenset({"account-a"}),
                secret=SECRET,
            )
        ]
    )
    return build_client(credential_registry=registry)


def _sign(body: bytes) -> str:
    return "v1=" + hmac.new(SECRET, body, hashlib.sha256).hexdigest()


def _post(client, path: str, payload: dict):
    body = json.dumps(payload, separators=(",", ":")).encode()
    return client.post(
        path,
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Qore-Runtime-Id": "runtime-a",
            "X-Qore-Signature": _sign(body),
        },
    )


def _heartbeat(sequence: int, now: datetime) -> dict:
    return {
        "schema_version": "0.1",
        "event_id": f"heartbeat-{sequence}",
        "event_type": "runtime.heartbeat",
        "runtime_id": "runtime-a",
        "account_id": "account-a",
        "sequence": sequence,
        "event_time": now.isoformat(),
        "emitted_at": now.isoformat(),
        "payload": {},
    }


def _mobile_get(client, path: str, access: str, private_key):
    return client.get(
        path,
        headers=proof_headers(
            token=access,
            private_key=private_key,
            method="GET",
            path=path,
        ),
    )


def test_gap_blocks_incremental_state_until_full_reconciliation() -> None:
    client = _client()
    private_key = new_private_key()
    mobile_session = enroll_device(client, private_key)
    access = mobile_session["access_token"]
    now = datetime.now(UTC)

    accepted = _post(client, "/v1/runtime/events", _heartbeat(1, now))
    assert accepted.status_code == 202

    replay = _post(client, "/v1/runtime/events", _heartbeat(1, now))
    assert replay.status_code == 409
    assert replay.json()["detail"]["code"] == "sequence_replay_or_out_of_order"

    gap = _post(client, "/v1/runtime/events", _heartbeat(3, now))
    assert gap.status_code == 409
    assert gap.json()["detail"]["code"] == "sequence_gap"

    blocked = _post(client, "/v1/runtime/events", _heartbeat(2, now))
    assert blocked.status_code == 409
    assert blocked.json()["detail"]["code"] == "reconciliation_required"

    runtime_before = _mobile_get(
        client,
        "/v1/runtimes",
        access,
        private_key,
    ).json()[0]
    assert runtime_before["reconciliation_required"] is True
    assert runtime_before["last_sequence"] == 1

    reconciliation = {
        "schema_version": "0.1",
        "runtime_id": "runtime-a",
        "account_id": "account-a",
        "sequence": 3,
        "event_time": now.isoformat(),
        "emitted_at": now.isoformat(),
        "account": {
            "account_id": "account-a",
            "provider": "FundedNext",
            "label": "Primary",
            "mode": "live",
            "runtime_id": "runtime-a",
            "balance": 100000,
            "equity": 100125,
            "realized_pnl_today": 100,
            "floating_pnl": 25,
            "open_positions": 0,
            "last_heartbeat": now.isoformat(),
            "as_of": now.isoformat(),
            "freshness": "live",
        },
        "traders": [
            {
                "trader_id": "vt08-forex",
                "account_id": "account-a",
                "name": "VT08 FOREX",
                "market": "FOREX",
                "mode": "live",
                "state": "monitoring",
                "last_market_read": now.isoformat(),
                "last_signal_or_abstention": now.isoformat(),
                "freshness": "live",
                "as_of": now.isoformat(),
            }
        ],
        "positions": [],
    }

    reconciled = _post(client, "/v1/runtime/reconcile", reconciliation)
    assert reconciled.status_code == 202

    runtime_after = _mobile_get(
        client,
        "/v1/runtimes",
        access,
        private_key,
    ).json()[0]
    assert runtime_after["reconciliation_required"] is False
    assert runtime_after["last_sequence"] == 3

    accounts = _mobile_get(
        client,
        "/v1/accounts",
        access,
        private_key,
    ).json()
    traders = _mobile_get(
        client,
        "/v1/traders",
        access,
        private_key,
    ).json()
    assert len(accounts) == 1
    assert accounts[0]["provider"] == "FundedNext"
    assert len(traders) == 1
    assert traders[0]["trader_id"] == "vt08-forex"

    next_event = _post(client, "/v1/runtime/events", _heartbeat(4, now))
    assert next_event.status_code == 202
