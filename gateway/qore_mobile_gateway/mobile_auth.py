import hashlib
import hmac
import json
import os


class MobileAuthenticationError(Exception):
    pass


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class MobileReadTokenRegistry:
    """Server-side allowlist of mobile read-token hashes.

    Production can later replace this verifier with the final device/session
    identity provider without changing the read API authorization boundary.
    """

    def __init__(self, token_hashes: set[str] | frozenset[str] | None = None) -> None:
        self._token_hashes = frozenset(token_hashes or set())

    @classmethod
    def from_environment(cls) -> "MobileReadTokenRegistry":
        raw = os.getenv("QORE_MOBILE_READ_TOKEN_HASHES_JSON", "[]")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                "QORE_MOBILE_READ_TOKEN_HASHES_JSON is not valid JSON"
            ) from exc

        hashes = {str(value).lower() for value in parsed}
        if any(len(value) != 64 for value in hashes):
            raise RuntimeError("mobile token hashes must be SHA-256 hex digests")
        return cls(hashes)

    @classmethod
    def for_test_tokens(cls, tokens: set[str]) -> "MobileReadTokenRegistry":
        return cls({token_hash(token) for token in tokens})

    def authenticate(self, token: str | None) -> None:
        if not token:
            raise MobileAuthenticationError("missing mobile read token")
        digest = token_hash(token)
        if not any(
            hmac.compare_digest(digest, allowed)
            for allowed in self._token_hashes
        ):
            raise MobileAuthenticationError("invalid mobile read token")
