from fastapi.testclient import TestClient

from qore_mobile_gateway.main import create_app
from qore_mobile_gateway.mobile_auth import MobileReadTokenRegistry


VALID = "valid-mobile-token"


def _client() -> TestClient:
    return TestClient(
        create_app(
            mobile_read_registry=MobileReadTokenRegistry.for_test_tokens({VALID})
        )
    )


def test_invalid_mobile_token_is_rejected() -> None:
    response = _client().get(
        "/v1/accounts",
        headers={"Authorization": "Bearer wrong-token"},
    )

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "mobile_authentication_failed"


def test_valid_mobile_token_can_read_supervision_state() -> None:
    response = _client().get(
        "/v1/accounts",
        headers={"Authorization": f"Bearer {VALID}"},
    )

    assert response.status_code == 200
    assert response.json() == []


def test_health_endpoint_remains_available_without_mobile_session() -> None:
    response = _client().get("/v1/health")

    assert response.status_code == 200
    assert response.json()["mode"] == "read-only"
