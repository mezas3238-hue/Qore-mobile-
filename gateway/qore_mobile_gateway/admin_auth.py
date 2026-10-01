import hashlib
import hmac
import json
import os


class AdminAuthenticationError(Exception):
    pass


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class AdminTokenRegistry:
    def __init__(self, token_hashes: set[str] | None = None) -> None:
        self._token_hashes = frozenset(token_hashes or set())

    @classmethod
    def from_environment(cls) -> "AdminTokenRegistry":
        raw = os.getenv("QORE_MOBILE_ADMIN_TOKEN_HASHES_JSON", "[]")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                "QORE_MOBILE_ADMIN_TOKEN_HASHES_JSON is not valid JSON"
            ) from exc

        hashes = {str(value).lower() for value in parsed}
        if any(len(value) != 64 for value in hashes):
            raise RuntimeError("admin token hashes must be SHA-256 hex digests")
        return cls(hashes)

    @classmethod
    def for_test_tokens(cls, tokens: set[str]) -> "AdminTokenRegistry":
        return cls({_hash_token(token) for token in tokens})

    def authenticate(self, token: str | None) -> None:
        if not token:
            raise AdminAuthenticationError("missing admin token")
        digest = _hash_token(token)
        if not any(
            hmac.compare_digest(digest, allowed)
            for allowed in self._token_hashes
        ):
            raise AdminAuthenticationError("invalid admin token")
