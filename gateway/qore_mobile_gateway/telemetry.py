from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

from .alerts import position_closed_alert, position_opened_alert
from .models import AccountSnapshot, PositionSnapshot, RiskSnapshot, TraderSnapshot
from .repository import ReadRepository
from .runtime_state import RuntimeStateStore


class EventType(StrEnum):
    RUNTIME_HEARTBEAT = "runtime.heartbeat"
    ACCOUNT_SNAPSHOT = "account.snapshot"
    TRADER_STATE = "trader.state"
    RISK_SNAPSHOT = "risk.snapshot"
    POSITION_OPENED = "position.opened"
    POSITION_UPDATED = "position.updated"
    POSITION_CLOSED = "position.closed"


class TelemetryEnvelope(BaseModel):
    schema_version: str
    event_id: str
    event_type: EventType
    runtime_id: str
    account_id: str
    sequence: int = Field(ge=1)
    event_time: datetime
    emitted_at: datetime
    payload: dict[str, Any]


class ReconciliationSnapshot(BaseModel):
    schema_version: str
    runtime_id: str
    account_id: str
    sequence: int = Field(ge=1)
    event_time: datetime
    emitted_at: datetime
    account: AccountSnapshot
    traders: list[TraderSnapshot] = Field(default_factory=list)
    positions: list[PositionSnapshot] = Field(default_factory=list)


class EventReceipt(BaseModel):
    accepted: bool
    runtime_id: str
    account_id: str
    sequence: int
    reconciliation_required: bool = False


class TelemetryValidationError(Exception):
    pass


class TelemetryService:
    def __init__(
        self,
        *,
        repository: ReadRepository,
        runtime_state: RuntimeStateStore,
    ) -> None:
        self.repository = repository
        self.runtime_state = runtime_state

    def _validate_account_scope(
        self,
        *,
        envelope_account_id: str,
        account_id: str,
    ) -> None:
        if envelope_account_id != account_id:
            raise TelemetryValidationError("payload account does not match envelope")

    def validate_payload(self, envelope: TelemetryEnvelope) -> object | None:
        if envelope.event_type == EventType.RUNTIME_HEARTBEAT:
            return None

        if envelope.event_type == EventType.ACCOUNT_SNAPSHOT:
            account = AccountSnapshot.model_validate(envelope.payload)
            self._validate_account_scope(
                envelope_account_id=envelope.account_id,
                account_id=account.account_id,
            )
            if account.runtime_id != envelope.runtime_id:
                raise TelemetryValidationError(
                    "account snapshot runtime does not match envelope"
                )
            return account

        if envelope.event_type == EventType.RISK_SNAPSHOT:
            risk = RiskSnapshot.model_validate(envelope.payload)
            self._validate_account_scope(
                envelope_account_id=envelope.account_id,
                account_id=risk.account_id,
            )
            return risk

        if envelope.event_type == EventType.TRADER_STATE:
            trader = TraderSnapshot.model_validate(envelope.payload)
            self._validate_account_scope(
                envelope_account_id=envelope.account_id,
                account_id=trader.account_id,
            )
            existing = self.repository.get_trader(trader.trader_id)
            if existing is not None and existing.account_id != trader.account_id:
                raise TelemetryValidationError(
                    "trader identity belongs to another account"
                )
            return trader

        if envelope.event_type in {
            EventType.POSITION_OPENED,
            EventType.POSITION_UPDATED,
        }:
            position = PositionSnapshot.model_validate(envelope.payload)
            self._validate_account_scope(
                envelope_account_id=envelope.account_id,
                account_id=position.account_id,
            )
            existing = self.repository.get_position(position.position_id)
            if existing is not None and existing.account_id != position.account_id:
                raise TelemetryValidationError(
                    "position identity belongs to another account"
                )
            return position

        if envelope.event_type == EventType.POSITION_CLOSED:
            position_id = envelope.payload.get("position_id")
            if not isinstance(position_id, str) or not position_id:
                raise TelemetryValidationError(
                    "position.closed requires a non-empty position_id"
                )
            existing = self.repository.get_position(position_id)
            if existing is not None and existing.account_id != envelope.account_id:
                raise TelemetryValidationError(
                    "position identity belongs to another account"
                )
            return position_id

        raise TelemetryValidationError("unsupported event type")

    def ingest(
        self,
        *,
        envelope: TelemetryEnvelope,
        validated_payload: object | None,
        received_at: datetime,
    ) -> EventReceipt:
        self.runtime_state.accept_sequence(
            runtime_id=envelope.runtime_id,
            account_id=envelope.account_id,
            sequence=envelope.sequence,
        )

        if envelope.event_type == EventType.RUNTIME_HEARTBEAT:
            self.runtime_state.record_heartbeat(
                runtime_id=envelope.runtime_id,
                account_id=envelope.account_id,
                event_time=envelope.event_time,
                received_at=received_at,
            )
            self.repository.record_account_heartbeat(
                account_id=envelope.account_id,
                event_time=envelope.event_time,
                received_at=received_at,
            )
        elif envelope.event_type == EventType.ACCOUNT_SNAPSHOT:
            assert isinstance(validated_payload, AccountSnapshot)
            self.repository.upsert_account(validated_payload)
        elif envelope.event_type == EventType.TRADER_STATE:
            assert isinstance(validated_payload, TraderSnapshot)
            self.repository.upsert_trader(validated_payload)
        elif envelope.event_type == EventType.RISK_SNAPSHOT:
            assert isinstance(validated_payload, RiskSnapshot)
            self.repository.upsert_risk(validated_payload)
        elif envelope.event_type in {
            EventType.POSITION_OPENED,
            EventType.POSITION_UPDATED,
        }:
            assert isinstance(validated_payload, PositionSnapshot)
            self.repository.upsert_position(validated_payload)
            if envelope.event_type == EventType.POSITION_OPENED:
                self.repository.upsert_alert(
                    position_opened_alert(
                        event_id=envelope.event_id,
                        position=validated_payload,
                        raised_at=received_at,
                    )
                )
        elif envelope.event_type == EventType.POSITION_CLOSED:
            assert isinstance(validated_payload, str)
            existing = self.repository.get_position(validated_payload)
            self.repository.close_position(
                account_id=envelope.account_id,
                position_id=validated_payload,
            )
            self.repository.upsert_alert(
                position_closed_alert(
                    event_id=envelope.event_id,
                    account_id=envelope.account_id,
                    position_id=validated_payload,
                    position=existing,
                    raised_at=received_at,
                )
            )

        return EventReceipt(
            accepted=True,
            runtime_id=envelope.runtime_id,
            account_id=envelope.account_id,
            sequence=envelope.sequence,
        )

    def reconcile(
        self,
        *,
        snapshot: ReconciliationSnapshot,
        received_at: datetime,
    ) -> EventReceipt:
        if snapshot.account.account_id != snapshot.account_id:
            raise TelemetryValidationError("reconciliation account mismatch")
        if snapshot.account.runtime_id != snapshot.runtime_id:
            raise TelemetryValidationError("reconciliation runtime mismatch")
        if any(item.account_id != snapshot.account_id for item in snapshot.traders):
            raise TelemetryValidationError("reconciliation trader account mismatch")
        if any(item.account_id != snapshot.account_id for item in snapshot.positions):
            raise TelemetryValidationError("reconciliation position account mismatch")

        try:
            self.repository.validate_reconciliation_scope(
                account_id=snapshot.account_id,
                traders=snapshot.traders,
                positions=snapshot.positions,
            )
        except ValueError as exc:
            raise TelemetryValidationError(str(exc)) from exc

        self.runtime_state.reconcile(
            runtime_id=snapshot.runtime_id,
            account_id=snapshot.account_id,
            sequence=snapshot.sequence,
            received_at=received_at,
            event_time=snapshot.event_time,
        )
        self.repository.replace_account_scope(
            account=snapshot.account,
            traders=snapshot.traders,
            positions=snapshot.positions,
        )
        return EventReceipt(
            accepted=True,
            runtime_id=snapshot.runtime_id,
            account_id=snapshot.account_id,
            sequence=snapshot.sequence,
            reconciliation_required=False,
        )
