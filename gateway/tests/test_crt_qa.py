from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from qore_mobile_gateway.crt_qa import CrtQaInbox, QaCrtEvent, MARKETS, FAMILIES
from tests.device_auth_helpers import (
    ADMIN_TOKEN, build_client, enroll_device, new_private_key, proof_headers,
)


def sample(now: datetime) -> dict:
    now_ms = int(now.timestamp() * 1000)
    event_at = now_ms - now_ms % 900_000  # exact M15/M5 native phase zero
    c1 = event_at - 8 * 3_600_000
    return dict(
        schema="QORE_CRT_MONITOR_QA_V2",
        mode="OFFLINE_REPLAY",
        certification="NOT_VERIFIED",
        deliveryState="BLOCKED_NOT_CERTIFIED",
        transport="DISABLED",
        sendPush=False,
        actionable=False,
        requiresRealFeedAndPineParity=True,
        instrumentId="USDCAD",
        tvSymbol="IC:USDCAD",
        family="CRT_3C_TRUE",
        direction="BULLISH",
        eventType="MSS_M15_OBSERVED",
        mssM5="CONFIRMED",
        mssM15="CONFIRMED",
        eventId=f"IC|USDCAD|{c1}|1|MSS_M15_OBSERVED|{event_at}",
        c1StartMs=c1,
        eventAtMs=event_at,
    )


def test_exactly_34_markets_and_7_crt_families() -> None:
    assert len(MARKETS) == 34
    assert len(set(MARKETS)) == 34
    assert len(FAMILIES) == 7
    assert "NDX100" in MARKETS and "BTCUSD" in MARKETS


def test_ttl_four_hours_and_duplicates_never_renotify() -> None:
    now = datetime.now(UTC).replace(second=0, microsecond=0)
    event = sample(now)
    inbox = CrtQaInbox()
    now_ms = int(now.timestamp() * 1000)
    assert inbox.stage(event, now_ms=now_ms) == "QA_STAGED_4H_NOT_SENDABLE"
    assert inbox.stage(event, now_ms=now_ms) == "QA_DUPLICATE_NOT_RENOTIFIED"
    first = inbox.snapshot(now=now)
    assert first.state == "OFFLINE_REPLAY_ONLY"
    assert first.live_feed is False and first.certified is False
    assert first.push_enabled is False
    assert len(first.events) == 1
    assert first.events[0]["expiresAtMs"] - event["eventAtMs"] == 14_400_000
    future = datetime.fromtimestamp(
        (event["eventAtMs"] + 14_400_000) / 1000, tz=UTC)
    assert inbox.snapshot(now=future).events == []


@pytest.mark.parametrize("overrides", [
    {"sendPush": True}, {"actionable": True},
    {"certification": "CERTIFIED"},
    {"transport": "ENABLED"}, {"mode": "LIVE"},
    {"tvSymbol": "IC:EURUSD"},
    {"family": "UNKNOWN"}, {"eventId": "IC|FORGED"},
    {"mssM15": "AWAITING"}, {"eventType": "FAKE_ENTRY"},
])
def test_invalid_or_actionable_evidence_is_blocked(overrides: dict) -> None:
    bad = {**sample(datetime.now(UTC)), **overrides}
    with pytest.raises(ValidationError):
        QaCrtEvent.model_validate(bad)


def test_conflicting_duplicate_quarantined_not_resent() -> None:
    now = datetime.now(UTC).replace(second=0, microsecond=0)
    first = sample(now)
    inbox = CrtQaInbox()
    now_ms = int(now.timestamp() * 1000)
    assert inbox.stage(first, now_ms=now_ms) == "QA_STAGED_4H_NOT_SENDABLE"
    altered = {**first, "mssM5": "AWAITING"}
    assert inbox.stage(altered, now_ms=now_ms) == "QA_CONFLICT_QUARANTINED"
    assert inbox.snapshot(now=now).events == []


def test_authenticated_inbox_reuses_existing_device_proof() -> None:
    client = build_client()
    assert client.get("/v1/crt/alerts").status_code == 401
    key = new_private_key()
    session = enroll_device(client, key)
    headers = proof_headers(
        token=session["access_token"], private_key=key,
        method="GET", path="/v1/crt/alerts",
    )
    ok = client.get("/v1/crt/alerts", headers=headers)
    assert ok.status_code == 200
    data = ok.json()
    assert data["state"] == "QA_NOT_CONNECTED"
    assert data["authenticated"] is True
    assert data["live_feed"] is False
    assert data["push_enabled"] is False
    assert data["events"] == []
    # A bound device nonce cannot be used twice.
    assert client.get("/v1/crt/alerts", headers=headers).status_code == 401


def test_authenticated_gateway_displays_quarantined_event_without_push() -> None:
    now = datetime.now(UTC).replace(second=0, microsecond=0)
    inbox = CrtQaInbox()
    inbox.stage(sample(now), now_ms=int(now.timestamp() * 1000))
    client = build_client(crt_qa_inbox=inbox)
    key = new_private_key()
    session = enroll_device(client, key)
    response = client.get("/v1/crt/alerts", headers=proof_headers(
        token=session["access_token"], private_key=key,
        method="GET", path="/v1/crt/alerts",
    ))
    assert response.status_code == 200
    data = response.json()
    assert data["state"] == "OFFLINE_REPLAY_ONLY"
    assert data["events"][0]["sendPush"] is False
    assert data["events"][0]["actionable"] is False


def test_admin_import_always_off_unless_explicit_nonproduction_gate(monkeypatch):
    monkeypatch.delenv("QORE_CRT_QA_IMPORT_ENABLED", raising=False)
    client = build_client()
    response = client.post("/v1/admin/crt/qa-stage",
        headers={"Authorization": "Bearer " + ADMIN_TOKEN},
        json=sample(datetime.now(UTC)))
    assert response.status_code == 403
    monkeypatch.setenv("QORE_CRT_QA_IMPORT_ENABLED", "true")
    monkeypatch.setenv("QORE_GATEWAY_ENV", "production")
    response = client.post("/v1/admin/crt/qa-stage",
        headers={"Authorization": "Bearer " + ADMIN_TOKEN},
        json=sample(datetime.now(UTC)))
    assert response.status_code == 403
