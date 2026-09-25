from fastapi.testclient import TestClient

from qore_mobile_gateway.main import app


client = TestClient(app)


def test_health_is_explicitly_read_only() -> None:
    response = client.get("/v1/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["service"] == "qore-mobile-gateway"
    assert payload["status"] == "ok"
    assert payload["mode"] == "read-only"
    assert payload["server_time"]
