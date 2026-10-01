import json

from qore_mobile_gateway.audit import AuditLog
from tests.device_auth_helpers import (
    ADMIN_TOKEN,
    build_client,
    enroll_device,
    new_private_key,
    proof_headers,
)


def test_device_lifecycle_is_audited_without_tokens_or_signatures() -> None:
    audit = AuditLog()
    client = build_client(audit_log=audit)
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

    revoked = client.post(
        f"/v1/admin/devices/{session['device_id']}/revoke",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )
    assert revoked.status_code == 200

    response = client.get(
        "/v1/admin/audit",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )
    assert response.status_code == 200

    events = response.json()
    event_types = [item["event_type"] for item in events]
    assert "device.enrolled" in event_types
    assert "device.session_refreshed" in event_types
    assert "device.revoked" in event_types

    serialized = json.dumps(events).lower()
    assert session["access_token"].lower() not in serialized
    assert session["refresh_token"].lower() not in serialized
    assert "x-qore-device-signature" not in serialized
