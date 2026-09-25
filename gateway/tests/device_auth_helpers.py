import base64
import hashlib
import uuid
from datetime import UTC, datetime

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient

from qore_mobile_gateway.admin_auth import AdminTokenRegistry
from qore_mobile_gateway.device_sessions import (
    DeviceSessionStore,
    EnrollmentCodeRegistry,
)
from qore_mobile_gateway.main import create_app


ENROLLMENT_CODE = "test-enrollment-code"
ADMIN_TOKEN = "test-admin-token"
DEVICE_ID = "device-test-0001"


def new_private_key() -> Ed25519PrivateKey:
    return Ed25519PrivateKey.generate()


def public_key_b64(private_key: Ed25519PrivateKey) -> str:
    raw = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return base64.b64encode(raw).decode("ascii")


def canonical_message(
    *,
    method: str,
    path: str,
    timestamp: str,
    nonce: str,
    body: bytes = b"",
) -> bytes:
    body_hash = hashlib.sha256(body).hexdigest()
    return (
        f"{method.upper()}\n{path}\n{timestamp}\n{nonce}\n{body_hash}"
    ).encode("utf-8")


def proof_headers(
    *,
    token: str,
    private_key: Ed25519PrivateKey,
    method: str,
    path: str,
    device_id: str = DEVICE_ID,
    body: bytes = b"",
    timestamp: str | None = None,
    nonce: str | None = None,
) -> dict[str, str]:
    proof_time = timestamp or datetime.now(UTC).isoformat()
    proof_nonce = nonce or str(uuid.uuid4())
    signature = private_key.sign(
        canonical_message(
            method=method,
            path=path,
            timestamp=proof_time,
            nonce=proof_nonce,
            body=body,
        )
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Qore-Device-Id": device_id,
        "X-Qore-Device-Time": proof_time,
        "X-Qore-Device-Nonce": proof_nonce,
        "X-Qore-Device-Signature": base64.b64encode(signature).decode("ascii"),
    }


def build_client(**app_kwargs) -> TestClient:
    sessions = app_kwargs.pop(
        "device_sessions",
        DeviceSessionStore(
            enrollment_codes=EnrollmentCodeRegistry.for_test_codes(
                {ENROLLMENT_CODE}
            )
        ),
    )
    admins = app_kwargs.pop(
        "admin_registry",
        AdminTokenRegistry.for_test_tokens({ADMIN_TOKEN}),
    )
    return TestClient(
        create_app(
            device_sessions=sessions,
            admin_registry=admins,
            **app_kwargs,
        )
    )


def enroll_device(
    client: TestClient,
    private_key: Ed25519PrivateKey,
    *,
    device_id: str = DEVICE_ID,
) -> dict:
    response = client.post(
        "/v1/mobile/enroll",
        headers={"X-Qore-Enrollment-Code": ENROLLMENT_CODE},
        json={
            "device_id": device_id,
            "platform": "android",
            "label": "Test phone",
            "public_key_b64": public_key_b64(private_key),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()
