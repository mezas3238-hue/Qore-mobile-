from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, ValidationError

from .admin_auth import AdminAuthenticationError, AdminTokenRegistry
from .auth import RuntimeAuthenticationError, RuntimeCredentialRegistry
from .device_sessions import (
    DeviceSessionError,
    DeviceSessionStore,
    EnrollmentCodeRegistry,
    EnrollmentError,
    IssuedSession,
    SessionAuthenticationError,
)
from .models import (
    AccountSnapshot,
    PortfolioSnapshot,
    PositionSnapshot,
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
from .service import build_portfolio_snapshot
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
    public_key_b64: str = Field(min_length=40, max_length=128)


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
    read_repository: ReadRepository | None = None,
    runtime_state: RuntimeStateStore | None = None,
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
    telemetry = TelemetryService(repository=repository, runtime_state=states)
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
            _raise(401, "device_session_authentication_failed", str(exc))

    MobileRead = Annotated[None, Depends(require_mobile_read)]

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
            _raise(401, "device_enrollment_failed", "missing enrollment code")
        try:
            issued = sessions.enroll(
                enrollment_code=x_qore_enrollment_code,
                device_id=payload.device_id,
                platform=payload.platform,
                label=payload.label,
                public_key_b64=payload.public_key_b64,
            )
        except EnrollmentError as exc:
            _raise(401, "device_enrollment_failed", str(exc))
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
            _raise(401, "device_refresh_failed", str(exc))
        return DeviceSessionResponse.from_issued(issued)

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

    @app.get("/v1/runtimes", response_model=list[RuntimeSnapshot])
    def runtimes(_: MobileRead) -> list[RuntimeSnapshot]:
        return states.list_snapshots(now=datetime.now(UTC))

    @app.post(
        "/v1/admin/devices/{device_id}/revoke",
        response_model=DeviceRevocationResponse,
    )
    def revoke_mobile_device(
        device_id: str,
        credentials: Annotated[
            HTTPAuthorizationCredentials | None,
            Depends(bearer),
        ],
    ) -> DeviceRevocationResponse:
        token = credentials.credentials if credentials is not None else None
        try:
            admins.authenticate(token)
        except AdminAuthenticationError as exc:
            _raise(401, "admin_authentication_failed", str(exc))
        return DeviceRevocationResponse(
            device_id=device_id,
            revoked=sessions.revoke_device(device_id),
        )

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
            _raise(401, "runtime_authentication_failed", str(exc))

        try:
            validated_payload = telemetry.validate_payload(envelope)
            return telemetry.ingest(
                envelope=envelope,
                validated_payload=validated_payload,
                received_at=datetime.now(UTC),
            )
        except TelemetryValidationError as exc:
            _raise(422, "telemetry_validation_failed", str(exc))
        except SequenceReplayOrOutOfOrder as exc:
            _raise(409, "sequence_replay_or_out_of_order", str(exc))
        except SequenceGap as exc:
            _raise(409, "sequence_gap", str(exc))
        except ReconciliationRequired as exc:
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
            _raise(401, "runtime_authentication_failed", str(exc))

        try:
            return telemetry.reconcile(
                snapshot=snapshot,
                received_at=datetime.now(UTC),
            )
        except TelemetryValidationError as exc:
            _raise(422, "telemetry_validation_failed", str(exc))
        except SequenceReplayOrOutOfOrder as exc:
            _raise(409, "sequence_replay_or_out_of_order", str(exc))

    return app


app = create_app()
