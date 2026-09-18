from fastapi.testclient import TestClient

from qore_mobile_gateway.main import app


client = TestClient(app)


def test_read_api_starts_empty_instead_of_fabricating_live_state() -> None:
    assert client.get("/v1/accounts").json() == []
    assert client.get("/v1/traders").json() == []
    assert client.get("/v1/positions").json() == []

    portfolio = client.get("/v1/portfolio").json()
    assert portfolio["account_count"] == 0
    assert portfolio["trader_count"] == 0
    assert portfolio["active_positions"] == 0
    assert portfolio["freshness"] == "unknown"
    assert portfolio["balance"] is None
    assert portfolio["equity"] is None
