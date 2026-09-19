from __future__ import annotations

import os
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from .device_sessions import (
    DeviceRecord,
    DeviceSessionStore,
    EnrollmentCodeRegistry,
    IssuedSession,
    SessionRecord,
)


def _dt(value: str | None) -> datetime | None:
    if value is None:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _iso(value: datetime | None) -> str | None:
    return None if value is None else value.astimezone(UTC).isoformat()


class PersistentDeviceSessionStore(DeviceSessionStore):
    """SQLite-backed device sessions without persisting raw secrets.

    The database contains public device identity material, SHA-256 token/code
    hashes and replay nonces. Raw enrollment codes, access tokens and refresh
    tokens are never written to disk.
    """

    def __init__(
        self,
        *,
        db_path: str | os.PathLike[str],
        enrollment_codes: EnrollmentCodeRegistry,
        **kwargs,
    ) -> None:
        path = Path(db_path).expanduser()
        if not path.is_absolute():
            raise RuntimeError("QORE_MOBILE_STATE_DB_PATH must be absolute")

        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        self._db_path = path
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.execute("PRAGMA journal_mode=WAL")
        self._db.execute("PRAGMA synchronous=FULL")
        self._db.execute("PRAGMA foreign_keys=ON")
        self._initialize_schema()
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass

        super().__init__(enrollment_codes=enrollment_codes, **kwargs)
        with self._lock:
            self._sync_enrollment_codes()
            self._load_persisted_state()

    def _initialize_schema(self) -> None:
        self._db.executescript(
            """
            CREATE TABLE IF NOT EXISTS enrollment_codes (
                code_hash TEXT PRIMARY KEY,
                consumed INTEGER NOT NULL CHECK (consumed IN (0, 1))
            );

            CREATE TABLE IF NOT EXISTS devices (
                device_id TEXT PRIMARY KEY,
                platform TEXT NOT NULL,
                label TEXT NOT NULL,
                public_key BLOB NOT NULL,
                key_algorithm TEXT NOT NULL,
                created_at TEXT NOT NULL,
                revoked_at TEXT
            );

            CREATE TABLE IF NOT EXISTS sessions (
                access_hash TEXT PRIMARY KEY,
                refresh_hash TEXT NOT NULL UNIQUE,
                device_id TEXT NOT NULL,
                access_expires_at TEXT NOT NULL,
                refresh_expires_at TEXT NOT NULL,
                generation INTEGER NOT NULL,
                revoked_at TEXT,
                FOREIGN KEY(device_id) REFERENCES devices(device_id)
            );

            CREATE TABLE IF NOT EXISTS proof_nonces (
                device_id TEXT NOT NULL,
                nonce TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                PRIMARY KEY(device_id, nonce)
            );
            """
        )
        self._db.commit()

    def _sync_enrollment_codes(self) -> None:
        configured = self._enrollment_codes.unused_hashes()
        consumed = {
            row[0]
            for row in self._db.execute(
                "SELECT code_hash FROM enrollment_codes WHERE consumed = 1"
            )
        }

        for digest in configured:
            self._db.execute(
                """
                INSERT INTO enrollment_codes(code_hash, consumed)
                VALUES (?, 0)
                ON CONFLICT(code_hash) DO NOTHING
                """,
                (digest,),
            )

        rows = list(
            self._db.execute(
                "SELECT code_hash, consumed FROM enrollment_codes"
            )
        )
        for digest, is_consumed in rows:
            if not is_consumed and digest not in configured:
                self._db.execute(
                    "DELETE FROM enrollment_codes WHERE code_hash = ?",
                    (digest,),
                )

        self._db.commit()
        self._enrollment_codes.replace_unused_hashes(configured - consumed)

    def _load_persisted_state(self) -> None:
        self._devices.clear()
        self._sessions_by_access_hash.clear()
        self._sessions_by_refresh_hash.clear()
        self._seen_nonces.clear()

        for row in self._db.execute(
            """
            SELECT device_id, platform, label, public_key, key_algorithm,
                   created_at, revoked_at
            FROM devices
            """
        ):
            record = DeviceRecord(
                device_id=row[0],
                platform=row[1],
                label=row[2],
                public_key=bytes(row[3]),
                key_algorithm=row[4],
                created_at=_dt(row[5]) or datetime.now(UTC),
                revoked_at=_dt(row[6]),
            )
            self._devices[record.device_id] = record

        for row in self._db.execute(
            """
            SELECT access_hash, refresh_hash, device_id, access_expires_at,
                   refresh_expires_at, generation, revoked_at
            FROM sessions
            """
        ):
            record = SessionRecord(
                device_id=row[2],
                access_hash=row[0],
                refresh_hash=row[1],
                access_expires_at=_dt(row[3]) or datetime.now(UTC),
                refresh_expires_at=_dt(row[4]) or datetime.now(UTC),
                generation=row[5],
                revoked_at=_dt(row[6]),
            )
            if record.revoked_at is None:
                self._sessions_by_access_hash[record.access_hash] = record
                self._sessions_by_refresh_hash[record.refresh_hash] = record

        now = datetime.now(UTC)
        for device_id, nonce, expires_at in self._db.execute(
            "SELECT device_id, nonce, expires_at FROM proof_nonces"
        ):
            expiry = _dt(expires_at)
            if expiry is not None and expiry >= now:
                self._seen_nonces[(device_id, nonce)] = expiry

        self._db.execute(
            "DELETE FROM proof_nonces WHERE expires_at < ?",
            (_iso(now),),
        )
        self._db.commit()

    def _persist_enrollment_codes(self) -> None:
        unused = self._enrollment_codes.unused_hashes()
        rows = {
            row[0]
            for row in self._db.execute(
                "SELECT code_hash FROM enrollment_codes"
            )
        }
        for digest in rows:
            self._db.execute(
                "UPDATE enrollment_codes SET consumed = ? WHERE code_hash = ?",
                (0 if digest in unused else 1, digest),
            )

    def _persist_devices(self) -> None:
        for record in self._devices.values():
            self._db.execute(
                """
                INSERT INTO devices(
                    device_id, platform, label, public_key, key_algorithm,
                    created_at, revoked_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(device_id) DO UPDATE SET
                    platform = excluded.platform,
                    label = excluded.label,
                    public_key = excluded.public_key,
                    key_algorithm = excluded.key_algorithm,
                    created_at = excluded.created_at,
                    revoked_at = excluded.revoked_at
                """,
                (
                    record.device_id,
                    record.platform,
                    record.label,
                    record.public_key,
                    record.key_algorithm,
                    _iso(record.created_at),
                    _iso(record.revoked_at),
                ),
            )

    def _persist_sessions(self) -> None:
        self._db.execute("DELETE FROM sessions")
        for record in self._sessions_by_access_hash.values():
            self._db.execute(
                """
                INSERT INTO sessions(
                    access_hash, refresh_hash, device_id,
                    access_expires_at, refresh_expires_at,
                    generation, revoked_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.access_hash,
                    record.refresh_hash,
                    record.device_id,
                    _iso(record.access_expires_at),
                    _iso(record.refresh_expires_at),
                    record.generation,
                    _iso(record.revoked_at),
                ),
            )

    def _persist_nonces(self) -> None:
        now = datetime.now(UTC)
        self._db.execute("DELETE FROM proof_nonces")
        for (device_id, nonce), expires_at in self._seen_nonces.items():
            if expires_at >= now:
                self._db.execute(
                    """
                    INSERT INTO proof_nonces(device_id, nonce, expires_at)
                    VALUES (?, ?, ?)
                    """,
                    (device_id, nonce, _iso(expires_at)),
                )

    def _persist_state(self) -> None:
        self._persist_enrollment_codes()
        self._persist_devices()
        self._persist_sessions()
        self._persist_nonces()
        self._db.commit()

    def enroll(self, **kwargs) -> IssuedSession:
        issued = super().enroll(**kwargs)
        with self._lock:
            self._persist_state()
        return issued

    def refresh(self, **kwargs) -> IssuedSession:
        issued = super().refresh(**kwargs)
        with self._lock:
            self._persist_state()
        return issued

    def revoke_device(self, device_id: str, **kwargs) -> bool:
        revoked = super().revoke_device(device_id, **kwargs)
        with self._lock:
            self._persist_state()
        return revoked

    def _verify_device_proof(self, **kwargs) -> None:
        super()._verify_device_proof(**kwargs)
        with self._lock:
            self._persist_nonces()
            self._db.commit()

    def close(self) -> None:
        with self._lock:
            self._db.commit()
            self._db.close()
