from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class Freshness(StrEnum):
    LIVE = "live"
    DELAYED = "delayed"
    STALE = "stale"
    OFFLINE = "offline"
    UNKNOWN = "unknown"


class TradingMode(StrEnum):
    DEMO = "demo"
    SHADOW = "shadow"
    LIVE = "live"


class PositionSide(StrEnum):
    LONG = "long"
    SHORT = "short"


class AlertSeverity(StrEnum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertKind(StrEnum):
    RUNTIME_DELAYED = "runtime.delayed"
    RUNTIME_STALE = "runtime.stale"
    RUNTIME_OFFLINE = "runtime.offline"
    RECONCILIATION_REQUIRED = "runtime.reconciliation_required"
    POSITION_OPENED = "position.opened"
    POSITION_CLOSED = "position.closed"
    RISK_THRESHOLD = "risk.threshold"
    RISK_LOCK = "risk.lock"
    SECURITY = "security"


class AccountSnapshot(BaseModel):
    account_id: str
    provider: str
    label: str
    mode: TradingMode
    runtime_id: str
    balance: float | None = None
    equity: float | None = None
    realized_pnl_today: float | None = None
    floating_pnl: float | None = None
    daily_drawdown_fraction: float | None = Field(default=None, ge=0)
    total_drawdown_fraction: float | None = Field(default=None, ge=0)
    open_positions: int = Field(default=0, ge=0)
    last_heartbeat: datetime | None = None
    as_of: datetime
    freshness: Freshness = Freshness.UNKNOWN


class TraderSnapshot(BaseModel):
    trader_id: str
    account_id: str
    name: str
    market: str
    mode: TradingMode
    state: str
    last_market_read: datetime | None = None
    last_signal_or_abstention: datetime | None = None
    freshness: Freshness = Freshness.UNKNOWN
    as_of: datetime


class PositionSnapshot(BaseModel):
    position_id: str
    account_id: str
    trader_id: str
    symbol: str
    side: PositionSide
    entry: float | None = None
    current_price: float | None = None
    stop: float | None = None
    target: float | None = None
    size: float | None = None
    unrealized_pnl: float | None = None
    r_state: float | None = None
    opened_at: datetime
    as_of: datetime


class RuntimeSnapshot(BaseModel):
    runtime_id: str
    account_ids: list[str]
    last_sequence: int | None = Field(default=None, ge=1)
    reconciliation_required: bool
    last_heartbeat: datetime | None = None
    as_of: datetime
    freshness: Freshness


class RiskSnapshot(BaseModel):
    account_id: str
    state: str
    source: str = "qore-risk"
    as_of: datetime
    daily_drawdown_fraction: float | None = Field(default=None, ge=0)
    total_drawdown_fraction: float | None = Field(default=None, ge=0)
    open_risk_fraction: float | None = Field(default=None, ge=0)
    daily_loss_remaining_fraction: float | None = Field(default=None, ge=0)
    total_loss_remaining_fraction: float | None = Field(default=None, ge=0)


class AlertSnapshot(BaseModel):
    alert_id: str
    kind: AlertKind
    severity: AlertSeverity
    title: str
    detail: str
    source: str
    raised_at: datetime
    as_of: datetime
    account_id: str | None = None
    trader_id: str | None = None
    runtime_id: str | None = None
    position_id: str | None = None
    resolved_at: datetime | None = None


class PortfolioSnapshot(BaseModel):
    as_of: datetime
    account_count: int = Field(ge=0)
    trader_count: int = Field(ge=0)
    active_positions: int = Field(ge=0)
    balance: float | None = None
    equity: float | None = None
    realized_pnl_today: float | None = None
    floating_pnl: float | None = None
    daily_drawdown_fraction: float | None = Field(default=None, ge=0)
    total_drawdown_fraction: float | None = Field(default=None, ge=0)
    freshness: Freshness
