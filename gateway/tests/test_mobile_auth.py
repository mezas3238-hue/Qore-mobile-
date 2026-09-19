from tests.device_auth_helpers import (
    ADMIN_TOKEN,
    build_client,
    enroll_device,
    new_private_key,
    proof_headers,
)


def test_bearer_token_without_device_proof_is_rejected() -> None:
    client = build_client()
    private_key = new_private_key()
    session = enroll_device(client, private_key)

    response = client.get(
        "/v1/accounts",
        headers={"Authorization": f"Bearer {session['access_token']}"},
    )

    assert response.status_code == 401
    assert (
        response.json()["detail"]["code"]
        == "device_session_authentication_failed"
    )


def test_valid_token_and_device_signature_can_read_supervision_state() -> None:
    client = build_client()
    private_key = new_private_key()
    session = enroll_device(client, private_key)

    response = client.get(
        "/v1/accounts",
        headers=proof_headers(
            token=session["access_token"],
            private_key=private_key,
            method="GET",
            path="/v1/accounts",
        ),
    )

    assert response.status_code == 200
    assert response.json() == []


def test_device_proof_nonce_cannot_be_replayed() -> None:
    client = build_client()
    private_key = new_private_key()
    session = enroll_device(client, private_key)
    headers = proof_headers(
        token=session["access_token"],
        private_key=private_key,
        method="GET",
        path="/v1/accounts",
        nonce="fixed-replay-nonce",
    )

    first = client.get("/v1/accounts", headers=headers)
    second = client.get("/v1/accounts", headers=headers)

    assert first.status_code == 200
    assert second.status_code == 401
    assert "replay" in second.json()["detail"]["message"]


def test_refresh_rotates_session_and_invalidates_old_access_token() -> None:
    client = build_client()
    private_key = new_private_key()
    session = enroll_device(client, private_key)

    refresh = client.post(
        "/v1/mobile/refresh",
        headers=proof_headers(
            token=session["refresh_token"],
            private_key=private_key,
            method="POST",
            path="/v1/mobile/refresh",
        ),
    )

    assert refresh.status_code == 200
    rotated = refresh.json()
    assert rotated["access_token"] != session["access_token"]
    assert rotated["refresh_token"] != session["refresh_token"]

    old_access = client.get(
        "/v1/accounts",
        headers=proof_headers(
            token=session["access_token"],
            private_key=private_key,
            method="GET",
            path="/v1/accounts",
        ),
    )
    new_access = client.get(
        "/v1/accounts",
        headers=proof_headers(
            token=rotated["access_token"],
            private_key=private_key,
            method="GET",
            path="/v1/accounts",
        ),
    )

    assert old_access.status_code == 401
    assert new_access.status_code == 200


def test_remote_revocation_kills_device_sessions() -> None:
    client = build_client()
    private_key = new_private_key()
    session = enroll_device(client, private_key)

    revoked = client.post(
        f"/v1/admin/devices/{session['device_id']}/revoke",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )
    assert revoked.status_code == 200
    assert revoked.json()["revoked"] is True

    read = client.get(
        "/v1/accounts",
        headers=proof_headers(
            token=session["access_token"],
            private_key=private_key,
            method="GET",
            path="/v1/accounts",
        ),
    )
    assert read.status_code == 401


def test_health_endpoint_remains_available_without_mobile_session() -> None:
    response = build_client().get("/v1/health")

    assert response.status_code == 200
    assert response.json()["mode"] == "read-only"
