from dataclasses import dataclass, field
from datetime import datetime
from threading import RLock

from .freshness import FreshnessPolicy
from .models import (
    AlertSnapshot,
    AccountSnapshot,
    PositionSnapshot,
    RiskSnapshot,
    TraderSnapshot,
)


@dataclass
class ReadRepository:
    """Canonical mobile read store.

    Production ingestion populates this repository only from authenticated
    QORE runtime telemetry. It intentionally starts empty so the Gateway
    cannot fabricate LIVE portfolio data.
    """

    accounts: dict[str, AccountSnapshot] = field(default_factory=dict)
    traders: dict[str, TraderSnapshot] = field(default_factory=dict)
    positions: dict[str, PositionSnapshot] = field(default_factory=dict)
    alerts: dict[str, AlertSnapshot] = field(default_factory=dict)
    risk_by_account: dict[str, RiskSnapshot] = field(default_factory=dict)
    _lock: RLock = field(default_factory=RLock, init=False, repr=False)
    _freshness_policy: FreshnessPolicy = field(
        default_factory=FreshnessPolicy,
        init=False,
        repr=False,
    )

    def list_accounts(self) -> list[AccountSnapshot]:
        with self._lock:
            return sorted(self.accounts.values(), key=lambda item: item.account_id)

    def list_traders(self) -> list[TraderSnapshot]:
        with self._lock:
            return sorted(self.traders.values(), key=lambda item: item.trader_id)

    def list_positions(self) -> list[PositionSnapshot]:
        with self._lock:
            return sorted(self.positions.values(), key=lambda item: item.position_id)

    def list_risk(self) -> list[RiskSnapshot]:
        with self._lock:
            return sorted(
                self.risk_by_account.values(),
                key=lambda item: item.account_id,
            )

    def list_alerts(self, *, include_resolved: bool = False) -> list[AlertSnapshot]:
        with self._lock:
            values = list(self.alerts.values())
            if not include_resolved:
                values = [item for item in values if item.resolved_at is None]
            return sorted(values, key=lambda item: item.raised_at, reverse=True)

    def get_trader(self, trader_id: str) -> TraderSnapshot | None:
        with self._lock:
            return self.traders.get(trader_id)

    def get_position(self, position_id: str) -> PositionSnapshot | None:
        with self._lock:
            return self.positions.get(position_id)

    def upsert_account(self, account: AccountSnapshot) -> None:
        with self._lock:
            self.accounts[account.account_id] = account

    def upsert_trader(self, trader: TraderSnapshot) -> None:
        with self._lock:
            existing = self.traders.get(trader.trader_id)
            if existing is not None and existing.account_id != trader.account_id:
                raise ValueError("trader identity already belongs to another account")
            self.traders[trader.trader_id] = trader

    def upsert_position(self, position: PositionSnapshot) -> None:
        with self._lock:
            existing = self.positions.get(position.position_id)
            if existing is not None and existing.account_id != position.account_id:
                raise ValueError("position identity already belongs to another account")
            self.positions[position.position_id] = position

    def upsert_risk(self, risk: RiskSnapshot) -> None:
        with self._lock:
            self.risk_by_account[risk.account_id] = risk

    def upsert_alert(self, alert: AlertSnapshot) -> None:
        with self._lock:
            self.alerts[alert.alert_id] = alert

    def resolve_alert(self, alert_id: str, *, resolved_at: datetime) -> None:
        with self._lock:
            existing = self.alerts.get(alert_id)
            if existing is None:
                return
            self.alerts[alert_id] = existing.model_copy(
                update={
                    "resolved_at": resolved_at,
                    "as_of": resolved_at,
                }
            )

    def close_position(self, *, account_id: str, position_id: str) -> None:
        with self._lock:
            existing = self.positions.get(position_id)
            if existing is None:
                return
            if existing.account_id != account_id:
                raise ValueError("position does not belong to envelope account")
            del self.positions[position_id]

    def record_account_heartbeat(
        self,
        *,
        account_id: str,
        event_time: datetime,
        received_at: datetime,
    ) -> None:
        with self._lock:
            existing = self.accounts.get(account_id)
            if existing is None:
                return
            freshness = self._freshness_policy.classify(
                now=received_at,
                last_seen=event_time,
            )
            self.accounts[account_id] = existing.model_copy(
                update={
                    "last_heartbeat": event_time,
                    "as_of": received_at,
                    "freshness": freshness,
                }
            )

    def validate_reconciliation_scope(
        self,
        *,
        account_id: str,
        traders: list[TraderSnapshot],
        positions: list[PositionSnapshot],
    ) -> None:
        with self._lock:
            for trader in traders:
                existing = self.traders.get(trader.trader_id)
                if existing is not None and existing.account_id != account_id:
                    raise ValueError(
                        "reconciliation trader identity belongs to another account"
                    )
            for position in positions:
                existing = self.positions.get(position.position_id)
                if existing is not None and existing.account_id != account_id:
                    raise ValueError(
                        "reconciliation position identity belongs to another account"
                    )

    def replace_account_scope(
        self,
        *,
        account: AccountSnapshot,
        traders: list[TraderSnapshot],
        positions: list[PositionSnapshot],
    ) -> None:
        with self._lock:
            account_id = account.account_id
            self.accounts[account_id] = account
            self.traders = {
                key: item
                for key, item in self.traders.items()
                if item.account_id != account_id
            }
            self.positions = {
                key: item
                for key, item in self.positions.items()
                if item.account_id != account_id
            }
            for trader in traders:
                self.traders[trader.trader_id] = trader
            for position in positions:
                self.positions[position.position_id] = position
