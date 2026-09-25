from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
import hashlib
from threading import RLock


class PushRegistrationError(Exception):
    pass


class PushProvider(StrEnum):
    FCM = "fcm"
    APNS = "apns"


@dataclass(frozen=True)
class PushRegistration:
    device_id: str
    platform: str
    provider: PushProvider
    token: str
    token_fingerprint: str
    registered_at: datetime


class PushRegistrationStore:
    """In-memory push registry.

    Raw provider tokens are retained only for future provider delivery. Public
    API responses and audit events expose the fingerprint, never the token.
    """

    def __init__(self) -> None:
        self._by_device: dict[str, PushRegistration] = {}
        self._lock = RLock()

    def register(
        self,
        *,
        device_id: str,
        platform: str,
        provider: PushProvider,
        token: str,
        now: datetime | None = None,
    ) -> PushRegistration:
        expected = (
            PushProvider.FCM if platform == "android" else PushProvider.APNS
            if platform == "ios" else None
        )
        if expected is None:
            raise PushRegistrationError("unsupported mobile platform")
        if provider != expected:
            raise PushRegistrationError(
                f"{platform} devices must register {expected.value}"
            )

        if token != token.strip() or len(token) < 16 or len(token) > 4096:
            raise PushRegistrationError("invalid push token")

        registration = PushRegistration(
            device_id=device_id,
            platform=platform,
            provider=provider,
            token=token,
            token_fingerprint=hashlib.sha256(
                token.encode("utf-8")
            ).hexdigest()[:16],
            registered_at=now or datetime.now(UTC),
        )
        with self._lock:
            self._by_device[device_id] = registration
        return registration

    def get(self, device_id: str) -> PushRegistration | None:
        with self._lock:
            return self._by_device.get(device_id)

    def remove(self, device_id: str) -> PushRegistration | None:
        with self._lock:
            return self._by_device.pop(device_id, None)
