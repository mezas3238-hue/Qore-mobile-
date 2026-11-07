"""Guarded, read-only cTrader IC Markets DEMO connectivity evidence for QORE Mobile.

This is QA diagnostic telemetry, NOT a CRT/MSS signal, never TradingView parity,
never an authenticated market feed, and never a notification trigger.
Only an authorized Railway staging worker may supply the evidence envelope.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
from datetime import UTC, datetime
from threading import RLock
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

PROBE_PATH = "/v1/admin/crt/ctrader-demo-probe"
FRESHNESS_MS = 90_000
CLOCK_SKEW_MS = 60_000
NONCE_TTL_MS = 180_000
ENVIRONMENTS = frozenset({"qa", "test", "staging"})
SIGNATURE_RE = re.compile(r"v1=[a-f0-9]{64}\Z")
NONCE_RE = re.compile(r"[a-f0-9-]{32,64}\Z")


class ProbeValidationError(ValueError):
    """Sanitized boundary failure; never returns a secret or signal data."""


class CTraderDemoProbeEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    schema: Literal["QORE_CTRADER_IC_DEMO_PROBE_V1"]
    source: Literal["CTRADER_OPEN_API_DEMO"]
    environment: Literal["DEMO"]
    oauthScope: Literal["accounts"]
    accountIsLive: Literal[False]
    broker: Literal["IC Markets"]
    probeState: Literal["INVENTORY_QA_ONLY", "HISTORICAL_M5_QA_UNCERTIFIED"]
    observedAtMs: int = Field(gt=0)
    symbolsObserved: int = Field(ge=0, le=3000)
    closedM5Observed: int = Field(ge=0, le=500)
    sourceParityCertified: Literal[False]
    marketSignalsEnabled: Literal[False]
    sendPush: Literal[False]
    canTrade: Literal[False]

    @model_validator(mode="after")
    def verify_probe_scope(self):
        if self.probeState == "INVENTORY_QA_ONLY" and self.closedM5Observed != 0:
            raise ValueError("inventory-only probe cannot attest closed bars")
        if self.probeState == "HISTORICAL_M5_QA_UNCERTIFIED" and self.closedM5Observed == 0:
            raise ValueError("historical M5 probe must have sampled closed bars")
        return self


class CTraderDemoProbeSnapshot(BaseModel):
    schema_version: Literal["QORE_CTRADER_DEMO_PROBE_STATUS_V1"] = "QORE_CTRADER_DEMO_PROBE_STATUS_V1"
    state: Literal["QA_NOT_CONNECTED", "QA_PROBE_RECEIVED"] = "QA_NOT_CONNECTED"
    source: Literal["CTRADER_OPEN_API_DEMO"] = "CTRADER_OPEN_API_DEMO"
    environment: Literal["DEMO"] = "DEMO"
    broker: Literal["IC Markets"] = "IC Markets"
    probe_state: str | None = None
    sampled_closed_m5: int = 0
    symbols_observed: int = 0
    observed_at_ms: int | None = None
    source_parity_certified: Literal[False] = False
    verified_market_feed: Literal[False] = False
    crt_signals_enabled: Literal[False] = False
    push_enabled: Literal[False] = False
    can_trade: Literal[False] = False


class CTraderDemoProbeInbox:
    def __init__(self):
        self._latest: CTraderDemoProbeEvidence | None = None
        self._nonces: dict[str, int] = {}
        self._lock = RLock()

    @staticmethod
    def _secret() -> bytes:
        if os.getenv("QORE_GATEWAY_ENV", "").lower() not in ENVIRONMENTS:
            raise ProbeValidationError("probe blocked outside QA/STAGING")
        if os.getenv("QORE_CTRADER_DEMO_PROBE_ENABLED") != "true":
            raise ProbeValidationError("probe disabled")
        key = os.getenv("QORE_CTRADER_DEMO_PROBE_HMAC_SECRET", "")
        if len(key.encode("utf-8")) < 32:
            raise ProbeValidationError("probe signing secret not configured")
        return key.encode("utf-8")

    def accept(
        self,
        *,
        raw_body: bytes,
        timestamp_ms: str | None,
        nonce: str | None,
        signature: str | None,
        now_ms: int,
    ) -> str:
        key = self._secret()
        if len(raw_body) > 4096 or len(raw_body) < 2:
            raise ProbeValidationError("invalid evidence size")
        if (not timestamp_ms or not timestamp_ms.isdecimal() or
                len(timestamp_ms) != 13 or
                not nonce or not NONCE_RE.fullmatch(nonce) or
                not signature or not SIGNATURE_RE.fullmatch(signature)):
            raise ProbeValidationError("missing or malformed proof")
        ts = int(timestamp_ms)
        if abs(now_ms - ts) > CLOCK_SKEW_MS:
            raise ProbeValidationError("stale or future signature")
        canonical = (
            f"POST\n{PROBE_PATH}\n{timestamp_ms}\n{nonce}\n"
            f"{hashlib.sha256(raw_body).hexdigest()}"
        ).encode("utf-8")
        expected = hmac.new(key, canonical, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature[3:], expected):
            raise ProbeValidationError("invalid HMAC")
        try:
            evidence = CTraderDemoProbeEvidence.model_validate_json(raw_body)
        except (ValueError, TypeError) as exc:
            raise ProbeValidationError("invalid QA probe evidence") from exc
        if abs(evidence.observedAtMs - now_ms) > CLOCK_SKEW_MS:
            raise ProbeValidationError("event time not fresh")
        with self._lock:
            self._prune(now_ms)
            if nonce in self._nonces:
                raise ProbeValidationError("nonce replay")
            self._nonces[nonce] = now_ms + NONCE_TTL_MS
            if self._latest is None or evidence.observedAtMs >= self._latest.observedAtMs:
                self._latest = evidence
        return "QA_PROBE_RECEIVED_NOT_CERTIFIED"

    def _prune(self, now_ms: int):
        for nonce, expiry in list(self._nonces.items()):
            if expiry <= now_ms:
                del self._nonces[nonce]
        if self._latest is not None and now_ms - self._latest.observedAtMs >= FRESHNESS_MS:
            self._latest = None

    def snapshot(self, *, now: datetime) -> CTraderDemoProbeSnapshot:
        now_ms = int(now.timestamp() * 1000)
        with self._lock:
            self._prune(now_ms)
            sample = self._latest
            if sample is None or sample.observedAtMs > now_ms + CLOCK_SKEW_MS:
                return CTraderDemoProbeSnapshot()
            return CTraderDemoProbeSnapshot(
                state="QA_PROBE_RECEIVED",
                probe_state=sample.probeState,
                sampled_closed_m5=sample.closedM5Observed,
                symbols_observed=sample.symbolsObserved,
                observed_at_ms=sample.observedAtMs,
            )
