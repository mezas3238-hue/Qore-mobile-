from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, ValidationError

from .admin_auth import AdminAuthenticationError, AdminTokenRegistry
from .alerts import current_alerts, device_security_alert
from .audit import AuditEvent, AuditEventType, AuditLog
from .auth import RuntimeAuthenticationError, RuntimeCredentialRegistry
from .device_sessions import (
    DeviceSessionStore,
    EnrollmentCodeRegistry,
    EnrollmentError,
    IssuedSession,
    SessionAuthenticationError,
)
from .push import (
    PushProvider,
    PushRegistrationError,
    PushRegistrationStore,
)

from .models import (
    AccountSnapshot,
    AlertSnapshot,
    MobileDashboardSnapshot,
    PortfolioSnapshot,
    PositionSnapshot,
    RiskSnapshot,
    RuntimeSnapshot,
    TraderSnapshot,
)
from .repository import ReadRepository
from .runtime_state import (
    ReconciliationRequired,
    RuntimeStateStore,
    SequenceGap,
    SequenceReplayOrOutOfOrder,
)
from .service import build_mobile_dashboard_snapshot, build_portfolio_snapshot
from .telemetry import (
    EventReceipt,
    ReconciliationSnapshot,
    TelemetryEnvelope,
    TelemetryService,
    TelemetryValidationError,
)


class HealthResponse(BaseModel):
    service: str
    status: str
    mode: str
    server_time: datetime


class DeviceEnrollmentRequest(BaseModel):
    device_id: str = Field(min_length=8, max_length=128)
    platform: Literal["android", "ios"]
    label: str = Field(min_length=1, max_length=128)
    public_key_b64: str = Field(min_length=40, max_length=512)
    key_algorithm: Literal["ed25519", "p256-spki", "p256-x963"] = "ed25519"


class DeviceSessionResponse(BaseModel):
    access_token: str
    access_expires_at: datetime
    refresh_token: str
    refresh_expires_at: datetime
    device_id: str

    @classmethod
    def from_issued(cls, issued: IssuedSession) -> "DeviceSessionResponse":
        return cls(
            access_token=issued.access_token,
            access_expires_at=issued.access_expires_at,
            refresh_token=issued.refresh_token,
            refresh_expires_at=issued.refresh_expires_at,
            device_id=issued.device_id,
        )


class DeviceRevocationResponse(BaseModel):
    device_id: str
    revoked: bool


class PushTokenRegistrationRequest(BaseModel):
    provider: Literal["fcm", "apns"]
    token: str = Field(min_length=16, max_length=4096)


class PushTokenRegistrationResponse(BaseModel):
    device_id: str
    provider: Literal["fcm", "apns"]
    token_fingerprint: str
    registered_at: datetime


class PushTokenRemovalResponse(BaseModel):
    device_id: str
    removed: bool


def _raise(status_code: int, code: str, message: str) -> None:
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )


def create_app(
    *,
    credential_registry: RuntimeCredentialRegistry | None = None,
    device_sessions: DeviceSessionStore | None = None,
    admin_registry: AdminTokenRegistry | None = None,
    audit_log: AuditLog | None = None,
    read_repository: ReadRepository | None = None,
    runtime_state: RuntimeStateStore | None = None,
    push_registrations: PushRegistrationStore | None = None,
) -> FastAPI:
    app = FastAPI(
        title="QORE Mobile Gateway",
        version="0.2.0",
        description=(
            "Device-bound read-only mobile supervision API plus authenticated "
            "inbound QORE runtime telemetry. No trading execution endpoints exist."
        ),
    )

    repository = read_repository or ReadRepository()
    states = runtime_state or RuntimeStateStore()
    registry = credential_registry or RuntimeCredentialRegistry.from_environment()
    sessions = device_sessions or DeviceSessionStore(
        enrollment_codes=EnrollmentCodeRegistry.from_environment()
    )
    admins = admin_registry or AdminTokenRegistry.from_environment()
    audit = audit_log or AuditLog()
    telemetry = TelemetryService(repository=repository, runtime_state=states)
    pushes = push_registrations or PushRegistrationStore()
    bearer = HTTPBearer(auto_error=False)

    async def require_mobile_read(
        request: Request,
        credentials: Annotated[
            HTTPAuthorizationCredentials | None,
            Depends(bearer),
        ],
        x_qore_device_id: str | None = Header(
            default=None,
            alias="X-Qore-Device-Id",
        ),
        x_qore_device_time: str | None = Header(
            default=None,
            alias="X-Qore-Device-Time",
        ),
        x_qore_device_nonce: str | None = Header(
            default=None,
            alias="X-Qore-Device-Nonce",
        ),
        x_qore_device_signature: str | None = Header(
            default=None,
            alias="X-Qore-Device-Signature",
        ),
    ) -> None:
        token = credentials.credentials if credentials is not None else None
        if not all(
            [
                token,
                x_qore_device_id,
                x_qore_device_time,
                x_qore_device_nonce,
                x_qore_device_signature,
            ]
        ):
            audit.record(
                AuditEventType.DEVICE_AUTH_FAILED,
                device_id=x_qore_device_id,
                reason_code="missing_proof",
            )
            _raise(
                401,
                "device_session_authentication_failed",
                "missing device-bound session proof",
            )

        raw_body = await request.body()
        try:
            sessions.authenticate_access(
                access_token=token,
                device_id=x_qore_device_id,
                method=request.method,
                path=request.url.path,
                timestamp=x_qore_device_time,
                nonce=x_qore_device_nonce,
                signature_b64=x_qore_device_signature,
                body=raw_body,
            )
        except SessionAuthenticationError as exc:
            audit.record(
                AuditEventType.DEVICE_AUTH_FAILED,
                device_id=x_qore_device_id,
                reason_code="invalid_proof_or_session",
            )
            _raise(401, "device_session_authentication_failed", str(exc))

    MobileRead = Annotated[None, Depends(require_mobile_read)]

    def require_admin(
        credentials: Annotated[
            HTTPAuthorizationCredentials | None,
            Depends(bearer),
        ],
    ) -> None:
        token = credentials.credentials if credentials is not None else None
        try:
            admins.authenticate(token)
        except AdminAuthenticationError as exc:
            audit.record(
                AuditEventType.ADMIN_AUTH_FAILED,
                reason_code="invalid_admin_token",
            )
            _raise(401, "admin_authentication_failed", str(exc))

    AdminAccess = Annotated[None, Depends(require_admin)]

    @app.get("/v1/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(
            service="qore-mobile-gateway",
            status="ok",
            mode="read-only",
            server_time=datetime.now(UTC),
        )

    @app.post(
        "/v1/mobile/enroll",
        response_model=DeviceSessionResponse,
        status_code=201,
    )
    def enroll_mobile_device(
        payload: DeviceEnrollmentRequest,
        x_qore_enrollment_code: str | None = Header(
            default=None,
            alias="X-Qore-Enrollment-Code",
        ),
    ) -> DeviceSessionResponse:
        if not x_qore_enrollment_code:
            audit.record(
                AuditEventType.DEVICE_ENROLLMENT_FAILED,
                device_id=payload.device_id,
                reason_code="missing_code",
            )
            _raise(401, "device_enrollment_failed", "missing enrollment code")
        try:
            issued = sessions.enroll(
                enrollment_code=x_qore_enrollment_code,
                device_id=payload.device_id,
                platform=payload.platform,
                label=payload.label,
                public_key_b64=payload.public_key_b64,
                key_algorithm=payload.key_algorithm,
            )
        except EnrollmentError as exc:
            audit.record(
                AuditEventType.DEVICE_ENROLLMENT_FAILED,
                device_id=payload.device_id,
                reason_code="invalid_code_or_device",
            )
            _raise(401, "device_enrollment_failed", str(exc))
        security_time = datetime.now(UTC)
        audit.record(
            AuditEventType.DEVICE_ENROLLED,
            device_id=payload.device_id,
            occurred_at=security_time,
        )
        repository.upsert_alert(
            device_security_alert(
                action="enrolled",
                device_id=payload.device_id,
                label=payload.label,
                platform=payload.platform,
                raised_at=security_time,
            )
        )
        return DeviceSessionResponse.from_issued(issued)

    @app.post(
        "/v1/mobile/refresh",
        response_model=DeviceSessionResponse,
    )
    async def refresh_mobile_session(
        request: Request,
        credentials: Annotated[
            HTTPAuthorizationCredentials | None,
            Depends(bearer),
        ],
        x_qore_device_id: str | None = Header(
            default=None,
            alias="X-Qore-Device-Id",
        ),
        x_qore_device_time: str | None = Header(
            default=None,
            alias="X-Qore-Device-Time",
        ),
        x_qore_device_nonce: str | None = Header(
            default=None,
            alias="X-Qore-Device-Nonce",
        ),
        x_qore_device_signature: str | None = Header(
            default=None,
            alias="X-Qore-Device-Signature",
        ),
    ) -> DeviceSessionResponse:
        refresh_token = (
            credentials.credentials if credentials is not None else None
        )
        if not all(
            [
                refresh_token,
                x_qore_device_id,
                x_qore_device_time,
                x_qore_device_nonce,
                x_qore_device_signature,
            ]
        ):
            audit.record(
                AuditEventType.DEVICE_AUTH_FAILED,
                device_id=x_qore_device_id,
                reason_code="refresh_missing_proof",
            )
            _raise(
                401,
                "device_refresh_failed",
                "missing device-bound refresh proof",
            )
        raw_body = await request.body()
        try:
            issued = sessions.refresh(
                refresh_token=refresh_token,
                device_id=x_qore_device_id,
                method=request.method,
                path=request.url.path,
                timestamp=x_qore_device_time,
                nonce=x_qore_device_nonce,
                signature_b64=x_qore_device_signature,
                body=raw_body,
            )
        except SessionAuthenticationError as exc:
            audit.record(
                AuditEventType.DEVICE_AUTH_FAILED,
                device_id=x_qore_device_id,
                reason_code="refresh_invalid",
            )
            _raise(401, "device_refresh_failed", str(exc))
        audit.record(
            AuditEventType.DEVICE_SESSION_REFRESHED,
            device_id=x_qore_device_id,
        )
        return DeviceSessionResponse.from_issued(issued)

    @app.put(
        "/v1/mobile/push-token",
        response_model=PushTokenRegistrationResponse,
    )
    def register_mobile_push_token(
        payload: PushTokenRegistrationRequest,
        _: MobileRead,
        x_qore_device_id: str | None = Header(
            default=None,
            alias="X-Qore-Device-Id",
        ),
    ) -> PushTokenRegistrationResponse:
        if not x_qore_device_id:
            _raise(401, "device_session_authentication_failed", "missing device id")
        platform = sessions.get_active_device_platform(x_qore_device_id)
        if platform is None:
            _raise(401, "device_session_authentication_failed", "unknown device")
        try:
            registration = pushes.register(
                device_id=x_qore_device_id,
                platform=platform,
                provider=PushProvider(payload.provider),
                token=payload.token,
            )
        except PushRegistrationError as exc:
            _raise(422, "push_registration_invalid", str(exc))
        audit.record(
            AuditEventType.PUSH_TOKEN_REGISTERED,
            device_id=x_qore_device_id,
            token_fingerprint=registration.token_fingerprint,
        )
        return PushTokenRegistrationResponse(
            device_id=registration.device_id,
            provider=registration.provider.value,
            token_fingerprint=registration.token_fingerprint,
            registered_at=registration.registered_at,
        )

    @app.delete(
        "/v1/mobile/push-token",
        response_model=PushTokenRemovalResponse,
    )
    def delete_mobile_push_token(
        _: MobileRead,
        x_qore_device_id: str | None = Header(
            default=None,
            alias="X-Qore-Device-Id",
        ),
    ) -> PushTokenRemovalResponse:
        if not x_qore_device_id:
            _raise(401, "device_session_authentication_failed", "missing device id")
        removed = pushes.remove(x_qore_device_id)
        if removed is not None:
            audit.record(
                AuditEventType.PUSH_TOKEN_REMOVED,
                device_id=x_qore_device_id,
                token_fingerprint=removed.token_fingerprint,
            )
        return PushTokenRemovalResponse(
            device_id=x_qore_device_id,
            removed=removed is not None,
        )

    @app.get("/v1/dashboard", response_model=MobileDashboardSnapshot)
    def dashboard(_: MobileRead) -> MobileDashboardSnapshot:
        now = datetime.now(UTC)
        runtimes_snapshot = states.list_snapshots(now=now)
        return build_mobile_dashboard_snapshot(
            accounts=repository.list_accounts(),
            traders=repository.list_traders(),
            positions=repository.list_positions(),
            runtimes=runtimes_snapshot,
            risk=repository.list_risk(),
            alerts=current_alerts(
                repository=repository,
                runtimes=runtimes_snapshot,
                now=now,
            ),
            now=now,
        )

    @app.get("/v1/portfolio", response_model=PortfolioSnapshot)
    def portfolio(_: MobileRead) -> PortfolioSnapshot:
        return build_portfolio_snapshot(
            accounts=repository.list_accounts(),
            traders=repository.list_traders(),
            positions=repository.list_positions(),
        )

    @app.get("/v1/accounts", response_model=list[AccountSnapshot])
    def accounts(_: MobileRead) -> list[AccountSnapshot]:
        return repository.list_accounts()

    @app.get("/v1/traders", response_model=list[TraderSnapshot])
    def traders(_: MobileRead) -> list[TraderSnapshot]:
        return repository.list_traders()

    @app.get("/v1/positions", response_model=list[PositionSnapshot])
    def positions(_: MobileRead) -> list[PositionSnapshot]:
        return repository.list_positions()

    @app.get("/v1/risk", response_model=list[RiskSnapshot])
    def risk(_: MobileRead) -> list[RiskSnapshot]:
        return repository.list_risk()

    @app.get("/v1/runtimes", response_model=list[RuntimeSnapshot])
    def runtimes(_: MobileRead) -> list[RuntimeSnapshot]:
        return states.list_snapshots(now=datetime.now(UTC))

    @app.get("/v1/alerts", response_model=list[AlertSnapshot])
    def alerts(_: MobileRead) -> list[AlertSnapshot]:
        now = datetime.now(UTC)
        return current_alerts(
            repository=repository,
            runtimes=states.list_snapshots(now=now),
            now=now,
        )

    @app.post(
        "/v1/admin/devices/{device_id}/revoke",
        response_model=DeviceRevocationResponse,
    )
    def revoke_mobile_device(
        device_id: str,
        _: AdminAccess,
    ) -> DeviceRevocationResponse:
        revoked = sessions.revoke_device(device_id)
        if revoked:
            security_time = datetime.now(UTC)
            removed_push = pushes.remove(device_id)
            if removed_push is not None:
                audit.record(
                    AuditEventType.PUSH_TOKEN_REMOVED,
                    device_id=device_id,
                    token_fingerprint=removed_push.token_fingerprint,
                    occurred_at=security_time,
                )
            audit.record(
                AuditEventType.DEVICE_REVOKED,
                device_id=device_id,
                occurred_at=security_time,
            )
            repository.upsert_alert(
                device_security_alert(
                    action="revoked",
                    device_id=device_id,
                    raised_at=security_time,
                )
            )
        return DeviceRevocationResponse(
            device_id=device_id,
            revoked=revoked,
        )

    @app.get("/v1/admin/audit", response_model=list[AuditEvent])
    def admin_audit(_: AdminAccess) -> list[AuditEvent]:
        return audit.list_events()

    @app.post("/v1/runtime/events", response_model=EventReceipt, status_code=202)
    async def ingest_runtime_event(
        request: Request,
        x_qore_runtime_id: str | None = Header(
            default=None,
            alias="X-Qore-Runtime-Id",
        ),
        x_qore_signature: str | None = Header(
            default=None,
            alias="X-Qore-Signature",
        ),
    ) -> EventReceipt:
        raw_body = await request.body()
        try:
            envelope = TelemetryEnvelope.model_validate_json(raw_body)
        except ValidationError as exc:
            audit.record(
                AuditEventType.TELEMETRY_REJECTED,
                reason_code="invalid_envelope",
            )
            _raise(422, "invalid_envelope", str(exc))

        try:
            registry.authenticate(
                header_runtime_id=x_qore_runtime_id,
                signature=x_qore_signature,
                body_runtime_id=envelope.runtime_id,
                account_id=envelope.account_id,
                raw_body=raw_body,
            )
        except RuntimeAuthenticationError as exc:
            audit.record(
                AuditEventType.RUNTIME_AUTH_FAILED,
                runtime_id=envelope.runtime_id,
                account_id=envelope.account_id,
                reason_code="runtime_authentication_failed",
            )
            _raise(401, "runtime_authentication_failed", str(exc))

        try:
            validated_payload = telemetry.validate_payload(envelope)
            return telemetry.ingest(
                envelope=envelope,
                validated_payload=validated_payload,
                received_at=datetime.now(UTC),
            )
        except TelemetryValidationError as exc:
            audit.record(
                AuditEventType.TELEMETRY_REJECTED,
                runtime_id=envelope.runtime_id,
                account_id=envelope.account_id,
                reason_code="telemetry_validation_failed",
            )
            _raise(422, "telemetry_validation_failed", str(exc))
        except SequenceReplayOrOutOfOrder as exc:
            audit.record(
                AuditEventType.TELEMETRY_REJECTED,
                runtime_id=envelope.runtime_id,
                account_id=envelope.account_id,
                reason_code="sequence_replay_or_out_of_order",
            )
            _raise(409, "sequence_replay_or_out_of_order", str(exc))
        except SequenceGap as exc:
            audit.record(
                AuditEventType.TELEMETRY_REJECTED,
                runtime_id=envelope.runtime_id,
                account_id=envelope.account_id,
                reason_code="sequence_gap",
            )
            _raise(409, "sequence_gap", str(exc))
        except ReconciliationRequired as exc:
            audit.record(
                AuditEventType.TELEMETRY_REJECTED,
                runtime_id=envelope.runtime_id,
                account_id=envelope.account_id,
                reason_code="reconciliation_required",
            )
            _raise(409, "reconciliation_required", str(exc))

    @app.post(
        "/v1/runtime/reconcile",
        response_model=EventReceipt,
        status_code=202,
    )
    async def reconcile_runtime(
        request: Request,
        x_qore_runtime_id: str | None = Header(
            default=None,
            alias="X-Qore-Runtime-Id",
        ),
        x_qore_signature: str | None = Header(
            default=None,
            alias="X-Qore-Signature",
        ),
    ) -> EventReceipt:
        raw_body = await request.body()
        try:
            snapshot = ReconciliationSnapshot.model_validate_json(raw_body)
        except ValidationError as exc:
            audit.record(
                AuditEventType.TELEMETRY_REJECTED,
                reason_code="invalid_reconciliation_snapshot",
            )
            _raise(422, "invalid_reconciliation_snapshot", str(exc))

        try:
            registry.authenticate(
                header_runtime_id=x_qore_runtime_id,
                signature=x_qore_signature,
                body_runtime_id=snapshot.runtime_id,
                account_id=snapshot.account_id,
                raw_body=raw_body,
            )
        except RuntimeAuthenticationError as exc:
            audit.record(
                AuditEventType.RUNTIME_AUTH_FAILED,
                runtime_id=snapshot.runtime_id,
                account_id=snapshot.account_id,
                reason_code="runtime_authentication_failed",
            )
            _raise(401, "runtime_authentication_failed", str(exc))

        try:
            return telemetry.reconcile(
                snapshot=snapshot,
                received_at=datetime.now(UTC),
            )
        except TelemetryValidationError as exc:
            audit.record(
                AuditEventType.TELEMETRY_REJECTED,
                runtime_id=snapshot.runtime_id,
                account_id=snapshot.account_id,
                reason_code="reconciliation_validation_failed",
            )
            _raise(422, "telemetry_validation_failed", str(exc))
        except SequenceReplayOrOutOfOrder as exc:
            audit.record(
                AuditEventType.TELEMETRY_REJECTED,
                runtime_id=snapshot.runtime_id,
                account_id=snapshot.account_id,
                reason_code="reconciliation_sequence_rejected",
            )
            _raise(409, "sequence_replay_or_out_of_order", str(exc))

    return app


app = create_app()
