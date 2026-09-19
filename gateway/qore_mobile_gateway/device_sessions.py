import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from threading import RLock

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey


class DeviceSessionError(Exception):
    pass


class EnrollmentError(DeviceSessionError):
    pass


class SessionAuthenticationError(DeviceSessionError):
    pass


@dataclass(frozen=True)
class IssuedSession:
    access_token: str
    access_expires_at: datetime
    refresh_token: str
    refresh_expires_at: datetime
    device_id: str


@dataclass
class DeviceRecord:
    device_id: str
    platform: str
    label: str
    public_key: bytes
    created_at: datetime
    revoked_at: datetime | None = None


@dataclass
class SessionRecord:
    device_id: str
    access_hash: str
    refresh_hash: str
    access_expires_at: datetime
    refresh_expires_at: datetime
    generation: int = 1
    revoked_at: datetime | None = None


def _hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _decode_public_key(value: str) -> bytes:
    try:
        raw = base64.b64decode(value, validate=True)
    except ValueError as exc:
        raise EnrollmentError("invalid device public key encoding") from exc
    if len(raw) != 32:
        raise EnrollmentError("Ed25519 public key must be 32 bytes")
    return raw


class EnrollmentCodeRegistry:
    def __init__(self, code_hashes: set[str] | None = None) -> None:
        self._unused = set(code_hashes or set())
        self._lock = RLock()

    @classmethod
    def for_test_codes(cls, codes: set[str]) -> "EnrollmentCodeRegistry":
        return cls({_hash_secret(code) for code in codes})

    def consume(self, code: str) -> None:
        digest = _hash_secret(code)
        with self._lock:
            match = next(
                (
                    candidate
                    for candidate in self._unused
                    if hmac.compare_digest(candidate, digest)
                ),
                None,
            )
            if match is None:
                raise EnrollmentError("invalid or already-used enrollment code")
            self._unused.remove(match)


class DeviceSessionStore:
    def __init__(
        self,
        *,
        enrollment_codes: EnrollmentCodeRegistry,
        access_ttl: timedelta = timedelta(minutes=10),
        refresh_ttl: timedelta = timedelta(days=30),
        proof_skew: timedelta = timedelta(seconds=60),
    ) -> None:
        self._enrollment_codes = enrollment_codes
        self._access_ttl = access_ttl
        self._refresh_ttl = refresh_ttl
        self._proof_skew = proof_skew
        self._devices: dict[str, DeviceRecord] = {}
        self._sessions_by_access_hash: dict[str, SessionRecord] = {}
        self._sessions_by_refresh_hash: dict[str, SessionRecord] = {}
        self._seen_nonces: dict[tuple[str, str], datetime] = {}
        self._lock = RLock()

    def _issue_session(self, *, device_id: str, now: datetime) -> IssuedSession:
        access = secrets.token_urlsafe(32)
        refresh = secrets.token_urlsafe(48)
        record = SessionRecord(
            device_id=device_id,
            access_hash=_hash_secret(access),
            refresh_hash=_hash_secret(refresh),
            access_expires_at=now + self._access_ttl,
            refresh_expires_at=now + self._refresh_ttl,
        )
        self._sessions_by_access_hash[record.access_hash] = record
        self._sessions_by_refresh_hash[record.refresh_hash] = record
        return IssuedSession(
            access_token=access,
            access_expires_at=record.access_expires_at,
            refresh_token=refresh,
            refresh_expires_at=record.refresh_expires_at,
            device_id=device_id,
        )

    def enroll(
        self,
        *,
        enrollment_code: str,
        device_id: str,
        platform: str,
        label: str,
        public_key_b64: str,
        now: datetime | None = None,
    ) -> IssuedSession:
        current = now or datetime.now(UTC)
        public_key = _decode_public_key(public_key_b64)
        with self._lock:
            existing = self._devices.get(device_id)
            if existing is not None and existing.revoked_at is None:
                raise EnrollmentError("device_id is already enrolled")
            self._enrollment_codes.consume(enrollment_code)
            self._devices[device_id] = DeviceRecord(
                device_id=device_id,
                platform=platform,
                label=label,
                public_key=public_key,
                created_at=current,
            )
            return self._issue_session(device_id=device_id, now=current)

    def _canonical_message(
        self,
        *,
        method: str,
        path: str,
        timestamp: str,
        nonce: str,
        body: bytes,
    ) -> bytes:
        body_hash = hashlib.sha256(body).hexdigest()
        return (
            f"{method.upper()}\n{path}\n{timestamp}\n{nonce}\n{body_hash}"
        ).encode("utf-8")

    def _verify_device_proof(
        self,
        *,
        device: DeviceRecord,
        method: str,
        path: str,
        timestamp: str,
        nonce: str,
        signature_b64: str,
        body: bytes,
        now: datetime,
    ) -> None:
        if device.revoked_at is not None:
            raise SessionAuthenticationError("device is revoked")

        try:
            proof_time = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except ValueError as exc:
            raise SessionAuthenticationError("invalid device proof timestamp") from exc
        if proof_time.tzinfo is None:
            raise SessionAuthenticationError("device proof timestamp must be timezone-aware")
        if abs(now - proof_time.astimezone(UTC)) > self._proof_skew:
            raise SessionAuthenticationError("device proof timestamp outside allowed skew")

        nonce_key = (device.device_id, nonce)
        expiry = self._seen_nonces.get(nonce_key)
        if expiry is not None and expiry >= now:
            raise SessionAuthenticationError("device proof nonce replay detected")

        try:
            signature = base64.b64decode(signature_b64, validate=True)
        except ValueError as exc:
            raise SessionAuthenticationError("invalid device signature encoding") from exc

        public_key = Ed25519PublicKey.from_public_bytes(device.public_key)
        message = self._canonical_message(
            method=method,
            path=path,
            timestamp=timestamp,
            nonce=nonce,
            body=body,
        )
        try:
            public_key.verify(signature, message)
        except InvalidSignature as exc:
            raise SessionAuthenticationError("device proof signature failed") from exc

        self._seen_nonces[nonce_key] = now + self._proof_skew

    def authenticate_access(
        self,
        *,
        access_token: str,
        device_id: str,
        method: str,
        path: str,
        timestamp: str,
        nonce: str,
        signature_b64: str,
        body: bytes,
        now: datetime | None = None,
    ) -> None:
        current = now or datetime.now(UTC)
        digest = _hash_secret(access_token)
        with self._lock:
            record = self._sessions_by_access_hash.get(digest)
            if record is None or record.revoked_at is not None:
                raise SessionAuthenticationError("invalid access session")
            if record.device_id != device_id:
                raise SessionAuthenticationError("access session device mismatch")
            if current >= record.access_expires_at:
                raise SessionAuthenticationError("access session expired")
            device = self._devices.get(device_id)
            if device is None:
                raise SessionAuthenticationError("unknown device")
            self._verify_device_proof(
                device=device,
                method=method,
                path=path,
                timestamp=timestamp,
                nonce=nonce,
                signature_b64=signature_b64,
                body=body,
                now=current,
            )

    def refresh(
        self,
        *,
        refresh_token: str,
        device_id: str,
        method: str,
        path: str,
        timestamp: str,
        nonce: str,
        signature_b64: str,
        body: bytes,
        now: datetime | None = None,
    ) -> IssuedSession:
        current = now or datetime.now(UTC)
        digest = _hash_secret(refresh_token)
        with self._lock:
            record = self._sessions_by_refresh_hash.get(digest)
            if record is None or record.revoked_at is not None:
                raise SessionAuthenticationError("invalid refresh session")
            if record.device_id != device_id:
                raise SessionAuthenticationError("refresh session device mismatch")
            if current >= record.refresh_expires_at:
                raise SessionAuthenticationError("refresh session expired")
            device = self._devices.get(device_id)
            if device is None:
                raise SessionAuthenticationError("unknown device")

            self._verify_device_proof(
                device=device,
                method=method,
                path=path,
                timestamp=timestamp,
                nonce=nonce,
                signature_b64=signature_b64,
                body=body,
                now=current,
            )

            record.revoked_at = current
            self._sessions_by_access_hash.pop(record.access_hash, None)
            self._sessions_by_refresh_hash.pop(record.refresh_hash, None)
            return self._issue_session(device_id=device_id, now=current)

    def revoke_device(self, device_id: str, *, now: datetime | None = None) -> bool:
        current = now or datetime.now(UTC)
        with self._lock:
            device = self._devices.get(device_id)
            if device is None:
                return False
            device.revoked_at = current
            for record in list(self._sessions_by_access_hash.values()):
                if record.device_id == device_id:
                    record.revoked_at = current
                    self._sessions_by_access_hash.pop(record.access_hash, None)
                    self._sessions_by_refresh_hash.pop(record.refresh_hash, None)
            return True
