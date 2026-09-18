import hashlib
import hmac
import json
from datetime import UTC, datetime

from fastapi.testclient import TestClient

from qore_mobile_gateway.auth import RuntimeCredential, RuntimeCredentialRegistry
from qore_mobile_gateway.main import create_app


SECRET = b"unit-test-secret"


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


def _sign(body: bytes) -> str:
    return "v1=" + hmac.new(SECRET, body, hashlib.sha256).hexdigest()


def _post(client: TestClient, path: str, payload: dict) -> object:
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


def test_gap_blocks_incremental_state_until_full_reconciliation() -> None:
    client = _client()
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

    runtime_before = client.get("/v1/runtimes").json()[0]
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

    runtime_after = client.get("/v1/runtimes").json()[0]
    assert runtime_after["reconciliation_required"] is False
    assert runtime_after["last_sequence"] == 3

    accounts = client.get("/v1/accounts").json()
    traders = client.get("/v1/traders").json()
    assert len(accounts) == 1
    assert accounts[0]["provider"] == "FundedNext"
    assert len(traders) == 1
    assert traders[0]["trader_id"] == "vt08-forex"

    next_event = _post(client, "/v1/runtime/events", _heartbeat(4, now))
    assert next_event.status_code == 202
