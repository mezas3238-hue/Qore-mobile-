from collections import deque
from datetime import UTC, datetime
from enum import StrEnum
from threading import RLock

from pydantic import BaseModel


class AuditEventType(StrEnum):
    DEVICE_ENROLLED = "device.enrolled"
    DEVICE_SESSION_REFRESHED = "device.session_refreshed"
    DEVICE_REVOKED = "device.revoked"
    DEVICE_AUTH_FAILED = "device.auth_failed"
    DEVICE_ENROLLMENT_FAILED = "device.enrollment_failed"
    PUSH_TOKEN_REGISTERED = "push.token_registered"
    PUSH_TOKEN_REMOVED = "push.token_removed"
    ADMIN_AUTH_FAILED = "admin.auth_failed"
    RUNTIME_AUTH_FAILED = "runtime.auth_failed"
    TELEMETRY_REJECTED = "telemetry.rejected"


class AuditEvent(BaseModel):
    event_type: AuditEventType
    occurred_at: datetime
    device_id: str | None = None
    runtime_id: str | None = None
    account_id: str | None = None
    reason_code: str | None = None
    token_fingerprint: str | None = None


class AuditLog:
    """In-memory foundation audit sink.

    Events intentionally contain identifiers and reason codes only. Tokens,
    signatures, raw request bodies and secrets must never be added.
    """

    def __init__(self, max_events: int = 10_000) -> None:
        self._events: deque[AuditEvent] = deque(maxlen=max_events)
        self._lock = RLock()

    def record(
        self,
        event_type: AuditEventType,
        *,
        device_id: str | None = None,
        runtime_id: str | None = None,
        account_id: str | None = None,
        reason_code: str | None = None,
        token_fingerprint: str | None = None,
        occurred_at: datetime | None = None,
    ) -> None:
        with self._lock:
            self._events.append(
                AuditEvent(
                    event_type=event_type,
                    occurred_at=occurred_at or datetime.now(UTC),
                    device_id=device_id,
                    runtime_id=runtime_id,
                    account_id=account_id,
                    reason_code=reason_code,
                    token_fingerprint=token_fingerprint,
                )
            )

    def list_events(self) -> list[AuditEvent]:
        with self._lock:
            return list(self._events)
