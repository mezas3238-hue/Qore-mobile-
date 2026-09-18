from datetime import UTC, datetime

from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, ValidationError

from .auth import RuntimeAuthenticationError, RuntimeCredentialRegistry
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


def _raise(status_code: int, code: str, message: str) -> None:
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )


def create_app(
    *,
    credential_registry: RuntimeCredentialRegistry | None = None,
    read_repository: ReadRepository | None = None,
    runtime_state: RuntimeStateStore | None = None,
) -> FastAPI:
    app = FastAPI(
        title="QORE Mobile Gateway",
        version="0.1.0",
        description=(
            "Read-only mobile supervision API plus authenticated inbound "
            "QORE runtime telemetry. No trading execution endpoints exist."
        ),
    )

    repository = read_repository or ReadRepository()
    states = runtime_state or RuntimeStateStore()
    registry = credential_registry or RuntimeCredentialRegistry.from_environment()
    telemetry = TelemetryService(repository=repository, runtime_state=states)

    @app.get("/v1/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(
            service="qore-mobile-gateway",
            status="ok",
            mode="read-only",
            server_time=datetime.now(UTC),
        )

    @app.get("/v1/portfolio", response_model=PortfolioSnapshot)
    def portfolio() -> PortfolioSnapshot:
        return build_portfolio_snapshot(
            accounts=repository.list_accounts(),
            traders=repository.list_traders(),
            positions=repository.list_positions(),
        )

    @app.get("/v1/accounts", response_model=list[AccountSnapshot])
    def accounts() -> list[AccountSnapshot]:
        return repository.list_accounts()

    @app.get("/v1/traders", response_model=list[TraderSnapshot])
    def traders() -> list[TraderSnapshot]:
        return repository.list_traders()

    @app.get("/v1/positions", response_model=list[PositionSnapshot])
    def positions() -> list[PositionSnapshot]:
        return repository.list_positions()

    @app.get("/v1/runtimes", response_model=list[RuntimeSnapshot])
    def runtimes() -> list[RuntimeSnapshot]:
        return states.list_snapshots(now=datetime.now(UTC))

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
