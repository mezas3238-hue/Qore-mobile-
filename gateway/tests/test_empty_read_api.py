from fastapi.testclient import TestClient

from qore_mobile_gateway.main import create_app
from qore_mobile_gateway.mobile_auth import MobileReadTokenRegistry


TOKEN = "test-mobile-token"
client = TestClient(
    create_app(
        mobile_read_registry=MobileReadTokenRegistry.for_test_tokens({TOKEN})
    )
)
HEADERS = {"Authorization": f"Bearer {TOKEN}"}


def test_mobile_reads_fail_closed_without_session() -> None:
    assert client.get("/v1/accounts").status_code == 401
    assert client.get("/v1/portfolio").status_code == 401


def test_read_api_starts_empty_instead_of_fabricating_live_state() -> None:
    assert client.get("/v1/accounts", headers=HEADERS).json() == []
    assert client.get("/v1/traders", headers=HEADERS).json() == []
    assert client.get("/v1/positions", headers=HEADERS).json() == []

    portfolio = client.get("/v1/portfolio", headers=HEADERS).json()
    assert portfolio["account_count"] == 0
    assert portfolio["trader_count"] == 0
    assert portfolio["active_positions"] == 0
    assert portfolio["freshness"] == "unknown"
    assert portfolio["balance"] is None
    assert portfolio["equity"] is None
