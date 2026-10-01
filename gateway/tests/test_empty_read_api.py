from tests.device_auth_helpers import (
    build_client,
    enroll_device,
    new_private_key,
    proof_headers,
)


def test_mobile_reads_fail_closed_without_session() -> None:
    client = build_client()

    assert client.get("/v1/accounts").status_code == 401
    assert client.get("/v1/portfolio").status_code == 401


def test_read_api_starts_empty_instead_of_fabricating_live_state() -> None:
    client = build_client()
    private_key = new_private_key()
    session = enroll_device(client, private_key)
    access = session["access_token"]

    accounts = client.get(
        "/v1/accounts",
        headers=proof_headers(
            token=access,
            private_key=private_key,
            method="GET",
            path="/v1/accounts",
        ),
    )
    traders = client.get(
        "/v1/traders",
        headers=proof_headers(
            token=access,
            private_key=private_key,
            method="GET",
            path="/v1/traders",
        ),
    )
    positions = client.get(
        "/v1/positions",
        headers=proof_headers(
            token=access,
            private_key=private_key,
            method="GET",
            path="/v1/positions",
        ),
    )
    portfolio = client.get(
        "/v1/portfolio",
        headers=proof_headers(
            token=access,
            private_key=private_key,
            method="GET",
            path="/v1/portfolio",
        ),
    )

    assert accounts.json() == []
    assert traders.json() == []
    assert positions.json() == []

    payload = portfolio.json()
    assert payload["account_count"] == 0
    assert payload["trader_count"] == 0
    assert payload["active_positions"] == 0
    assert payload["freshness"] == "unknown"
    assert payload["balance"] is None
    assert payload["equity"] is None
