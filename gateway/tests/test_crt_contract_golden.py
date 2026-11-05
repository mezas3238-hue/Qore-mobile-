"""Cross-language CRT QA contract fixture: Python Gateway ↔ Flutter app."""
from datetime import UTC, datetime
import json
from pathlib import Path

from qore_mobile_gateway.crt_qa import QaCrtEvent, CrtQaInbox, CrtQaSnapshot


CONTRACT = (
    Path(__file__).resolve().parents[2] / "contracts" / "crt_qa_v1_golden.json"
)


def test_golden_json_validates_as_gateway_snapshot_and_event() -> None:
    payload = json.loads(CONTRACT.read_text(encoding="utf-8"))
    snapshot = CrtQaSnapshot.model_validate(payload)
    assert snapshot.state == "OFFLINE_REPLAY_ONLY"
    assert snapshot.live_feed is False and snapshot.push_enabled is False
    assert snapshot.certified is False and snapshot.ttl_seconds == 14400
    assert len(snapshot.events) == 1
    event = QaCrtEvent.model_validate(snapshot.events[0])
    assert event.instrumentId == "USDCAD"
    assert event.family == "CRT_3C_TRUE"
    assert event.eventType == "MSS_M15_OBSERVED"
    assert event.mssM5 == "CONFIRMED"
    assert event.mssM15 == "CONFIRMED"


def test_golden_json_exact_four_hour_deadline_and_fail_closed_expiry() -> None:
    payload = json.loads(CONTRACT.read_text(encoding="utf-8"))
    event = payload["events"][0]
    now_ms = 1_800_000_060_000
    assert event["expiresAtMs"] - event["eventAtMs"] == 14_400_000
    inbox = CrtQaInbox()
    assert inbox.stage(event, now_ms=now_ms) == "QA_STAGED_4H_NOT_SENDABLE"
    assert len(inbox.snapshot(
        now=datetime.fromtimestamp(now_ms / 1000, tz=UTC)
    ).events) == 1
    expired = datetime.fromtimestamp(event["expiresAtMs"] / 1000, tz=UTC)
    assert inbox.snapshot(now=expired).events == []
    assert inbox.stage(event, now_ms=event["expiresAtMs"]) == "QA_EXPIRED_NOT_STORED"
