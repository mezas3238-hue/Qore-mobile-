"""Isolated QORE CRT laboratory inbox for QORE Mobile.

This module cannot assert real feed provenance or turn a replay into a trade.
Every accepted observation is quarantined and expires at most four hours after
its own closed-bar event. All read APIs fail closed when no feed is connected.
"""
from __future__ import annotations

from datetime import UTC, datetime
from threading import RLock
from typing import Literal
import re

from pydantic import BaseModel, Field, model_validator

LIFETIME_MS = 14_400_000
SCHEMA = "QORE_CRT_MONITOR_QA_V2"
FAMILIES = (
    "CRT_2C_RETURN", "CRT_3C_TRUE", "INSIDE_RETURN",
    "INSIDE_CONTINUATION_REJECTED", "MULTI4", "MULTI_N", "M15_RETEST",
)
MARKETS = (
    "AUDJPY", "GBPUSD", "GBPJPY", "XAUUSD", "NDX100", "SPX500",
    "US30", "BTCUSD", "AUDUSD", "USDCAD", "USDJPY", "EURUSD",
    "USDCHF", "NZDUSD", "NZDJPY", "NZDCHF", "XAGUSD", "AUDCAD",
    "AUDCHF", "AUDNZD", "CADCHF", "CADJPY", "CHFJPY", "EURAUD",
    "EURCAD", "EURCHF", "EURGBP", "EURJPY", "EURNZD", "GBPAUD",
    "GBPCAD", "GBPCHF", "GBPNZD", "NZDCAD",
)
Status = Literal["AWAITING", "CONFIRMED", "UNVERIFIED"]
EventType = Literal["CRT_OBSERVED", "MSS_M5_OBSERVED", "MSS_M15_OBSERVED"]


def _source(name: str) -> str:
    return {"NDX100": "IC:USTEC", "SPX500": "IC:US500"}.get(name, "IC:" + name)


class QaCrtEvent(BaseModel):
    schema: Literal["QORE_CRT_MONITOR_QA_V2"]
    mode: Literal["OFFLINE_REPLAY"]
    certification: Literal["NOT_VERIFIED"]
    deliveryState: Literal["BLOCKED_NOT_CERTIFIED"]
    transport: Literal["DISABLED"]
    sendPush: Literal[False]
    actionable: Literal[False]
    requiresRealFeedAndPineParity: Literal[True]
    eventId: str = Field(min_length=20, max_length=256)
    instrumentId: str
    tvSymbol: str
    family: Literal[
        "CRT_2C_RETURN", "CRT_3C_TRUE", "INSIDE_RETURN",
        "INSIDE_CONTINUATION_REJECTED", "MULTI4", "MULTI_N", "M15_RETEST",
    ]
    direction: Literal["BULLISH", "BEARISH"]
    eventType: EventType
    mssM5: Status
    mssM15: Status
    c1StartMs: int = Field(gt=0)
    eventAtMs: int = Field(gt=0)

    @model_validator(mode="after")
    def verify_causal_identity(self) -> "QaCrtEvent":
        if self.instrumentId not in MARKETS or self.tvSymbol != _source(self.instrumentId):
            raise ValueError("unsupported IC Market or mismatched symbol")
        if self.c1StartMs % 60_000 or self.eventAtMs % 60_000:
            raise ValueError("event not aligned to a closed minute")
        duration = self.eventAtMs - self.c1StartMs
        if duration <= 0 or duration > 345_600_000:
            raise ValueError("invalid causal window")
        phase = self.c1StartMs % 300_000
        step = 900_000 if self.eventType == "MSS_M15_OBSERVED" else 300_000
        if self.eventAtMs % step != phase:
            raise ValueError("native broker M5/M15 phase mismatch")
        if self.eventType == "MSS_M5_OBSERVED" and self.mssM5 != "CONFIRMED":
            raise ValueError("MSS M5 not separately confirmed")
        if self.eventType == "MSS_M15_OBSERVED" and self.mssM15 != "CONFIRMED":
            raise ValueError("MSS M15 not separately confirmed")
        direction = "1" if self.direction == "BULLISH" else "-1"
        expected = (
            f"IC|{self.instrumentId}|{self.c1StartMs}|{direction}|"
            f"{self.eventType}|{self.eventAtMs}"
        )
        if self.eventId != expected:
            raise ValueError("immutable event identity mismatch")
        return self


class CrtQaSnapshot(BaseModel):
    schema_version: Literal["QORE_MOBILE_CRT_QA_V1"] = "QORE_MOBILE_CRT_QA_V1"
    state: Literal["QA_NOT_CONNECTED", "OFFLINE_REPLAY_ONLY"] = "QA_NOT_CONNECTED"
    authenticated: bool = True
    live_feed: Literal[False] = False
    push_enabled: Literal[False] = False
    certified: Literal[False] = False
    ttl_seconds: Literal[14400] = 14400
    as_of: datetime
    events: list[dict]


class CrtQaInbox:
    def __init__(self) -> None:
        self._events: dict[tuple[str, str], QaCrtEvent] = {}
        self._quarantined: set[tuple[str, str]] = set()
        self._lock = RLock()

    def stage(self, value: dict, *, now_ms: int) -> str:
        event = QaCrtEvent.model_validate(value)
        if now_ms <= 0 or now_ms >= event.eventAtMs + LIFETIME_MS:
            return "QA_EXPIRED_NOT_STORED"
        if event.eventAtMs > now_ms:
            return "QA_FUTURE_NOT_STORED"
        key = (event.eventId, event.family)
        with self._lock:
            self._prune(now_ms)
            if key in self._quarantined:
                return "QA_CONFLICT_QUARANTINED"
            old = self._events.get(key)
            if old == event:
                return "QA_DUPLICATE_NOT_RENOTIFIED"
            if old is not None:
                self._events.pop(key, None)
                self._quarantined.add(key)
                return "QA_CONFLICT_QUARANTINED"
            self._events[key] = event
        return "QA_STAGED_4H_NOT_SENDABLE"

    def _prune(self, now_ms: int) -> None:
        for key, event in list(self._events.items()):
            if now_ms >= event.eventAtMs + LIFETIME_MS:
                self._events.pop(key, None)

    def snapshot(self, *, now: datetime) -> CrtQaSnapshot:
        now_ms = int(now.timestamp() * 1000)
        with self._lock:
            self._prune(now_ms)
            entries = sorted(
                self._events.values(),
                key=lambda x: (-x.eventAtMs, x.eventId, x.family),
            )[:100]
        observations = [
            {
                **e.model_dump(),
                "expiresAtMs": e.eventAtMs + LIFETIME_MS,
            }
            for e in entries
            if e.eventAtMs <= now_ms < e.eventAtMs + LIFETIME_MS
        ]
        return CrtQaSnapshot(
            state="OFFLINE_REPLAY_ONLY" if observations else "QA_NOT_CONNECTED",
            as_of=now,
            events=observations,
        )
