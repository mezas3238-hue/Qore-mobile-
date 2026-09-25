from tests.device_auth_helpers import (
    build_client,
    enroll_device,
    new_private_key,
    proof_headers,
)


def test_dashboard_endpoint_is_authenticated_and_empty_safe() -> None:
    client = build_client()

    unauthorized = client.get("/v1/dashboard")
    assert unauthorized.status_code == 401

    private_key = new_private_key()
    session = enroll_device(client, private_key)
    response = client.get(
        "/v1/dashboard",
        headers=proof_headers(
            token=session["access_token"],
            private_key=private_key,
            method="GET",
            path="/v1/dashboard",
        ),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["portfolio"]["account_count"] == 0
    assert payload["portfolio"]["trader_count"] == 0
    assert payload["portfolio"]["active_positions"] == 0
    assert payload["accounts"] == []
    assert payload["traders"] == []
    assert payload["positions"] == []
    assert payload["runtimes"] == []
    assert payload["risk"] == []
    assert len(payload["alerts"]) == 1
    security = payload["alerts"][0]
    assert security["kind"] == "security"
    assert security["severity"] == "info"
    assert security["title"] == "Dispositivo enrolado"
    assert security["source"] == "gateway.security"
