import base64
import hashlib
from datetime import UTC, datetime

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from qore_mobile_gateway.device_sessions import (
    DeviceSessionStore,
    EnrollmentCodeRegistry,
)
from qore_mobile_gateway.main import create_app


CODE = "p256-enrollment-code"


def _canonical(path: str, timestamp: str, nonce: str) -> bytes:
    body_hash = hashlib.sha256(b"").hexdigest()
    return f"GET\n{path}\n{timestamp}\n{nonce}\n{body_hash}".encode()


def _client() -> TestClient:
    return TestClient(
        create_app(
            device_sessions=DeviceSessionStore(
                enrollment_codes=EnrollmentCodeRegistry.for_test_codes({CODE})
            )
        )
    )


def _exercise(key_algorithm: str, public_key_b64: str, private_key) -> None:
    client = _client()
    enrolled = client.post(
        "/v1/mobile/enroll",
        headers={"X-Qore-Enrollment-Code": CODE},
        json={
            "device_id": f"device-{key_algorithm}",
            "platform": "android" if key_algorithm == "p256-spki" else "ios",
            "label": "P256 test device",
            "public_key_b64": public_key_b64,
            "key_algorithm": key_algorithm,
        },
    )
    assert enrolled.status_code == 201, enrolled.text
    access = enrolled.json()["access_token"]

    path = "/v1/accounts"
    timestamp = datetime.now(UTC).isoformat()
    nonce = f"nonce-{key_algorithm}"
    signature = private_key.sign(
        _canonical(path, timestamp, nonce),
        ec.ECDSA(hashes.SHA256()),
    )

    response = client.get(
        path,
        headers={
            "Authorization": f"Bearer {access}",
            "X-Qore-Device-Id": f"device-{key_algorithm}",
            "X-Qore-Device-Time": timestamp,
            "X-Qore-Device-Nonce": nonce,
            "X-Qore-Device-Signature": base64.b64encode(signature).decode(),
        },
    )

    assert response.status_code == 200
    assert response.json() == []


def test_android_style_spki_p256_proof() -> None:
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_der = private_key.public_key().public_bytes(
        serialization.Encoding.DER,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    _exercise(
        "p256-spki",
        base64.b64encode(public_der).decode(),
        private_key,
    )


def test_ios_style_x963_p256_proof() -> None:
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_x963 = private_key.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    _exercise(
        "p256-x963",
        base64.b64encode(public_x963).decode(),
        private_key,
    )
