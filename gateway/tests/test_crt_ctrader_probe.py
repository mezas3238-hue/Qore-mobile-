"""QA-only signed cTrader DEMO probe end-to-end mobile gateway tests.

No cTrader network requests, trading orders, market event ingestion or FCM.
"""
from datetime import UTC, datetime, timedelta
import hashlib
import hmac
import json
import uuid

from qore_mobile_gateway.crt_ctrader_probe import CTraderDemoProbeInbox
from tests.device_auth_helpers import build_client, enroll_device, new_private_key, proof_headers

PATH = "/v1/admin/crt/ctrader-demo-probe"
READ = "/v1/crt/ctrader-demo-probe"
KEY = "x" * 64


def evidence(*, now_ms: int, overrides=None):
    return {
        "schema": "QORE_CTRADER_IC_DEMO_PROBE_V1",
        "source": "CTRADER_OPEN_API_DEMO",
        "environment": "DEMO",
        "oauthScope": "accounts",
        "accountIsLive": False,
        "broker": "IC Markets",
        "probeState": "INVENTORY_QA_ONLY",
        "observedAtMs": now_ms,
        "symbolsObserved": 34,
        "closedM5Observed": 0,
        "sourceParityCertified": False,
        "marketSignalsEnabled": False,
        "sendPush": False,
        "canTrade": False,
        **(overrides or {}),
    }


def proof(body, now_ms, *, nonce=None, secret=KEY):
    nonce = nonce or str(uuid.uuid4())
    canonical = (
        f"POST\n{PATH}\n{now_ms}\n{nonce}\n"
        f"{hashlib.sha256(body).hexdigest()}"
    ).encode()
    signature = hmac.new(secret.encode(), canonical, hashlib.sha256).hexdigest()
    return {
        "X-Qore-Ctrader-Time": str(now_ms),
        "X-Qore-Ctrader-Nonce": nonce,
        "X-Qore-Ctrader-Signature": "v1=" + signature,
        "content-type": "application/json",
    }


def setup(monkeypatch):
    monkeypatch.setenv("QORE_GATEWAY_ENV", "staging")
    monkeypatch.setenv("QORE_CTRADER_DEMO_PROBE_ENABLED", "true")
    monkeypatch.setenv("QORE_CTRADER_DEMO_PROBE_HMAC_SECRET", KEY)


def test_read_requires_authenticated_mobile_device(monkeypatch):
    setup(monkeypatch)
    client = build_client()
    assert client.get(READ).status_code == 401
    key = new_private_key()
    session = enroll_device(client, key)
    r = client.get(READ, headers=proof_headers(
        token=session["access_token"], private_key=key, method="GET", path=READ))
    assert r.status_code == 200
    j = r.json()
    assert j["state"] == "QA_NOT_CONNECTED"
    assert not j["source_parity_certified"]
    assert not j["crt_signals_enabled"]
    assert not j["push_enabled"]


def test_signed_probe_to_mobile_status_never_becomes_signal(monkeypatch):
    setup(monkeypatch)
    client = build_client()
    now = int(datetime.now(UTC).timestamp() * 1000)
    body = json.dumps(evidence(now_ms=now), separators=(",", ":")).encode()
    headers = proof(body, now)
    received = client.post(PATH, content=body, headers=headers)
    assert received.status_code == 202, received.text
    assert received.json() == {
        "state": "QA_PROBE_RECEIVED_NOT_CERTIFIED",
        "signals_enabled": "false", "push_enabled": "false",
    }
    assert client.post(PATH, content=body, headers=headers).status_code == 403
    key = new_private_key()
    session = enroll_device(client, key)
    status = client.get(READ, headers=proof_headers(
        token=session["access_token"], private_key=key, method="GET", path=READ))
    assert status.status_code == 200
    j = status.json()
    assert j["state"] == "QA_PROBE_RECEIVED"
    assert j["symbols_observed"] == 34
    assert j["sampled_closed_m5"] == 0
    assert not j["verified_market_feed"]
    assert not j["source_parity_certified"]
    assert not j["crt_signals_enabled"]
    assert not j["push_enabled"]
    assert not j["can_trade"]
    assert client.get("/v1/crt/alerts", headers=proof_headers(
        token=session["access_token"], private_key=key, method="GET",
        path="/v1/crt/alerts")).json()["events"] == []


def test_disabled_or_production_rejects_incoming_probe(monkeypatch):
    client = build_client()
    now = int(datetime.now(UTC).timestamp() * 1000)
    body = json.dumps(evidence(now_ms=now)).encode()
    hdr = proof(body, now)
    monkeypatch.setenv("QORE_GATEWAY_ENV", "production")
    monkeypatch.setenv("QORE_CTRADER_DEMO_PROBE_ENABLED", "true")
    monkeypatch.setenv("QORE_CTRADER_DEMO_PROBE_HMAC_SECRET", KEY)
    assert client.post(PATH, content=body, headers=hdr).status_code == 403
    monkeypatch.setenv("QORE_GATEWAY_ENV", "staging")
    monkeypatch.setenv("QORE_CTRADER_DEMO_PROBE_ENABLED", "false")
    assert client.post(PATH, content=body, headers=hdr).status_code == 403


def test_tampered_source_live_scope_market_push_rejected(monkeypatch):
    setup(monkeypatch)
    client = build_client()
    for extra in (
        {"accountIsLive": True},
        {"oauthScope": "trading"},
        {"sourceParityCertified": True},
        {"sendPush": True},
        {"canTrade": True},
        {"marketSignalsEnabled": True},
        {"environment": "LIVE"},
        {"source": "TRADINGVIEW"},
        {"broker": "OTHER"},
        {"probeState": "HISTORICAL_M5_QA_UNCERTIFIED", "closedM5Observed": 0},
        {"probeState": "INVENTORY_QA_ONLY", "closedM5Observed": 30},
        {"unknown": 5},
    ):
        now = int(datetime.now(UTC).timestamp() * 1000)
        body = json.dumps(evidence(now_ms=now, overrides=extra)).encode()
        assert client.post(PATH, content=body, headers=proof(body, now)).status_code == 403, extra
    assert client.get("/v1/crt/alerts").status_code == 401


def test_bad_hmac_time_and_body_are_rejected(monkeypatch):
    setup(monkeypatch)
    client = build_client()
    now = int(datetime.now(UTC).timestamp() * 1000)
    body = json.dumps(evidence(now_ms=now)).encode()
    wrong = proof(body, now, secret="q" * 64)
    assert client.post(PATH, content=body, headers=wrong).status_code == 403
    assert client.post(PATH, content=body, headers=proof(body, now-360000)).status_code == 403
    assert client.post(PATH, content=body, headers=proof(body, now)).status_code == 202


def test_probe_expires_and_does_not_retain_market_data(monkeypatch):
    setup(monkeypatch)
    box = CTraderDemoProbeInbox()
    now = datetime.now(UTC)
    ts = int(now.timestamp() * 1000)
    body = json.dumps(evidence(now_ms=ts)).encode()
    p = proof(body, ts)
    box.accept(raw_body=body, timestamp_ms=p["X-Qore-Ctrader-Time"],
               nonce=p["X-Qore-Ctrader-Nonce"],
               signature=p["X-Qore-Ctrader-Signature"], now_ms=ts)
    assert box.snapshot(now=now).state == "QA_PROBE_RECEIVED"
    assert box.snapshot(now=now + timedelta(seconds=91)).state == "QA_NOT_CONNECTED"
