"""Gateway CRT QA transport E2E: admin fixture -> device-authenticated inbox.

Exercises actual FastAPI routes and signed mobile client proof. This test has
NO external calls, no VPS access, no FCM, no market order and NO REAL SIGNAL.
"""
from __future__ import annotations

from datetime import UTC, datetime

import pytest

from qore_mobile_gateway.crt_qa import CrtQaInbox, FAMILIES, MARKETS
from tests.device_auth_helpers import (
    ADMIN_TOKEN, build_client, enroll_device, new_private_key, proof_headers,
)


def replay(
    symbol: str,
    family: str,
    event_type: str,
    now: datetime,
) -> dict:
    assert symbol in MARKETS
    assert family in FAMILIES
    assert event_type in {
        "CRT_OBSERVED", "MSS_M5_OBSERVED", "MSS_M15_OBSERVED"
    }
    now_ms = int(now.timestamp() * 1000)
    # The closed-bar event is aligned to both M5 and M15, phase 0. The
    # real market data clock/phase must be certified separately.
    event_at = now_ms - (now_ms % 900_000)
    c1 = event_at - 8 * 3_600_000
    source = {"NDX100": "IC:USTEC", "SPX500": "IC:US500"}.get(
        symbol, f"IC:{symbol}")
    return {
        "schema": "QORE_CRT_MONITOR_QA_V2",
        "mode": "OFFLINE_REPLAY",
        "certification": "NOT_VERIFIED",
        "deliveryState": "BLOCKED_NOT_CERTIFIED",
        "transport": "DISABLED",
        "sendPush": False,
        "actionable": False,
        "requiresRealFeedAndPineParity": True,
        "instrumentId": symbol,
        "tvSymbol": source,
        "family": family,
        "direction": "BULLISH",
        "eventType": event_type,
        "mssM5": "CONFIRMED" if event_type == "MSS_M5_OBSERVED"
                 else "AWAITING",
        "mssM15": "CONFIRMED" if event_type == "MSS_M15_OBSERVED"
                  else "AWAITING",
        "eventId": f"IC|{symbol}|{c1}|1|{event_type}|{event_at}",
        "c1StartMs": c1,
        "eventAtMs": event_at,
    }


def signed_read(client, key, access_token):
    return client.get(
        "/v1/crt/alerts",
        headers=proof_headers(
            token=access_token, private_key=key,
            method="GET", path="/v1/crt/alerts",
        ),
    )


def test_all_34_markets_7_families_authenticated_end_to_end(monkeypatch):
    monkeypatch.setenv("QORE_GATEWAY_ENV", "staging")
    monkeypatch.setenv("QORE_CRT_QA_IMPORT_ENABLED", "true")
    inbox = CrtQaInbox()
    client = build_client(crt_qa_inbox=inbox)
    key = new_private_key()
    session = enroll_device(client, key)
    now = datetime.now(UTC)
    # A public browser or unknown device cannot read the private inbox.
    assert client.get("/v1/crt/alerts").status_code == 401
    for i, symbol in enumerate(MARKETS):
        family = FAMILIES[i % len(FAMILIES)]
        kind = (
            "MSS_M15_OBSERVED" if i % 3 == 0
            else "MSS_M5_OBSERVED" if i % 3 == 1
            else "CRT_OBSERVED"
        )
        event = replay(symbol, family, kind, now)
        r = client.post(
            "/v1/admin/crt/qa-stage",
            headers={"Authorization": "Bearer " + ADMIN_TOKEN},
            json=event,
        )
        assert r.status_code == 202, (symbol, r.status_code, r.text)
        assert r.json() == {
            "state": "QA_STAGED_4H_NOT_SENDABLE", "market_push": "false",
        }
    # Ensure all seven families are present at least once, with all 34 markets.
    r = signed_read(client, key, session["access_token"])
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["authenticated"] is True
    assert payload["state"] == "OFFLINE_REPLAY_ONLY"
    assert payload["live_feed"] is False
    assert payload["certified"] is False
    assert payload["push_enabled"] is False
    assert payload["ttl_seconds"] == 14400
    assert len(payload["events"]) == 34
    assert set(e["instrumentId"] for e in payload["events"]) == set(MARKETS)
    assert set(e["family"] for e in payload["events"]) == set(FAMILIES)
    assert {e["eventType"] for e in payload["events"]} == {
        "CRT_OBSERVED", "MSS_M5_OBSERVED", "MSS_M15_OBSERVED",
    }
    assert all(
        e["expiresAtMs"] - e["eventAtMs"] == 14_400_000
        and e["actionable"] is False
        and e["sendPush"] is False
        and e["mode"] == "OFFLINE_REPLAY"
        and e["deliveryState"] == "BLOCKED_NOT_CERTIFIED"
        for e in payload["events"]
    )
    # Repeated mobile GET uses a NEW signed nonce, not a reused proof.
    again = signed_read(client, key, session["access_token"])
    assert again.status_code == 200
    assert len(again.json()["events"]) == 34
    # No imported CRT replay may change the pre-existing VPS dashboards.
    dashboard = client.get("/v1/dashboard", headers=proof_headers(
        token=session["access_token"], private_key=key,
        method="GET", path="/v1/dashboard",
    ))
    assert dashboard.status_code == 200


def test_cannot_stage_with_mobile_identity_or_fake_admin(monkeypatch):
    monkeypatch.setenv("QORE_GATEWAY_ENV", "qa")
    monkeypatch.setenv("QORE_CRT_QA_IMPORT_ENABLED", "true")
    client = build_client()
    event = replay("BTCUSD", FAMILIES[0], "CRT_OBSERVED", datetime.now(UTC))
    assert client.post("/v1/admin/crt/qa-stage", json=event).status_code == 401
    assert client.post(
        "/v1/admin/crt/qa-stage",
        headers={"Authorization": "Bearer unknown-admin"}, json=event,
    ).status_code == 401
    assert client.get("/v1/crt/alerts").status_code == 401


@pytest.mark.parametrize("environment", ["production", "live", "", "unknown"])
def test_never_stage_crt_in_unapproved_environment(monkeypatch, environment):
    monkeypatch.setenv("QORE_GATEWAY_ENV", environment)
    monkeypatch.setenv("QORE_CRT_QA_IMPORT_ENABLED", "true")
    client = build_client()
    event = replay("EURUSD", FAMILIES[0], "CRT_OBSERVED", datetime.now(UTC))
    response = client.post(
        "/v1/admin/crt/qa-stage",
        headers={"Authorization": "Bearer " + ADMIN_TOKEN}, json=event,
    )
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "crt_qa_import_disabled"


def test_expired_events_never_appear_for_mobile_widget():
    now = datetime.now(UTC).replace(microsecond=0)
    inbox = CrtQaInbox()
    event = replay("USDCAD", FAMILIES[0], "MSS_M5_OBSERVED", now)
    # Offline replay evidence exactly at four-hour expiration is discarded.
    expires = event["eventAtMs"] + 14_400_000
    assert inbox.stage(event, now_ms=expires) == "QA_EXPIRED_NOT_STORED"
    assert inbox.snapshot(
        now=datetime.fromtimestamp(expires / 1000, UTC)
    ).events == []
