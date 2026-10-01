import hashlib
import hmac
import json
import os
from dataclasses import dataclass


class RuntimeAuthenticationError(Exception):
    pass


@dataclass(frozen=True)
class RuntimeCredential:
    runtime_id: str
    account_ids: frozenset[str]
    secret: bytes


class RuntimeCredentialRegistry:
    def __init__(self, credentials: list[RuntimeCredential] | None = None) -> None:
        self._credentials = {
            credential.runtime_id: credential
            for credential in (credentials or [])
        }

    @classmethod
    def from_environment(cls) -> "RuntimeCredentialRegistry":
        raw = os.getenv("QORE_RUNTIME_CREDENTIALS_JSON", "[]")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                "QORE_RUNTIME_CREDENTIALS_JSON is not valid JSON"
            ) from exc

        credentials: list[RuntimeCredential] = []
        for item in parsed:
            runtime_id = str(item["runtime_id"])
            account_ids = frozenset(str(value) for value in item["account_ids"])
            secret = str(item["secret"]).encode("utf-8")
            if not runtime_id or not account_ids or not secret:
                raise RuntimeError("runtime credentials may not be empty")
            credentials.append(
                RuntimeCredential(
                    runtime_id=runtime_id,
                    account_ids=account_ids,
                    secret=secret,
                )
            )
        return cls(credentials)

    def authenticate(
        self,
        *,
        header_runtime_id: str | None,
        signature: str | None,
        body_runtime_id: str,
        account_id: str,
        raw_body: bytes,
    ) -> RuntimeCredential:
        if not header_runtime_id or header_runtime_id != body_runtime_id:
            raise RuntimeAuthenticationError("runtime identity mismatch")

        credential = self._credentials.get(body_runtime_id)
        if credential is None:
            raise RuntimeAuthenticationError("unknown runtime")

        if account_id not in credential.account_ids:
            raise RuntimeAuthenticationError("runtime not authorized for account")

        if not signature or not signature.startswith("v1="):
            raise RuntimeAuthenticationError("missing or invalid signature")

        supplied = signature.removeprefix("v1=")
        expected = hmac.new(
            credential.secret,
            raw_body,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(supplied, expected):
            raise RuntimeAuthenticationError("signature verification failed")

        return credential
