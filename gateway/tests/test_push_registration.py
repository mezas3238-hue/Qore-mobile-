import json

from qore_mobile_gateway.push import PushRegistrationStore
from tests.device_auth_helpers import (
    ADMIN_TOKEN,
    build_client,
    enroll_device,
    new_private_key,
    proof_headers,
)


def _register(client, session, private_key, provider: str, token: str):
    path = "/v1/mobile/push-token"
    body = json.dumps(
        {"provider": provider, "token": token},
        separators=(",", ":"),
    ).encode()
    headers = proof_headers(
        token=session["access_token"],
        private_key=private_key,
        method="PUT",
        path=path,
        body=body,
    )
    headers["Content-Type"] = "application/json"
    return client.put(path, content=body, headers=headers)


def test_android_registers_only_fcm_and_never_echoes_raw_token() -> None:
    store = PushRegistrationStore()
    client = build_client(push_registrations=store)
    private_key = new_private_key()
    session = enroll_device(client, private_key)
    raw_token = "fcm-provider-token-1234567890"

    response = _register(
        client,
        session,
        private_key,
        "fcm",
        raw_token,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "fcm"
    assert payload["device_id"] == "device-test-0001"
    assert payload["token_fingerprint"]
    assert "token" not in payload
    assert raw_token not in response.text

    stored = store.get("device-test-0001")
    assert stored is not None
    assert stored.token == raw_token


def test_android_rejects_apns_registration() -> None:
    client = build_client(push_registrations=PushRegistrationStore())
    private_key = new_private_key()
    session = enroll_device(client, private_key)

    response = _register(
        client,
        session,
        private_key,
        "apns",
        "apns-provider-token-1234567890",
    )
    assert response.status_code == 422


def test_device_revocation_removes_push_registration() -> None:
    store = PushRegistrationStore()
    client = build_client(push_registrations=store)
    private_key = new_private_key()
    session = enroll_device(client, private_key)
    assert _register(
        client,
        session,
        private_key,
        "fcm",
        "fcm-provider-token-abcdefghij",
    ).status_code == 200
    assert store.get("device-test-0001") is not None

    revoked = client.post(
        "/v1/admin/devices/device-test-0001/revoke",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )
    assert revoked.status_code == 200
    assert store.get("device-test-0001") is None
