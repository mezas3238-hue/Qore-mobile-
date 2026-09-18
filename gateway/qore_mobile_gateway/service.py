from collections.abc import Iterable
from datetime import UTC, datetime

from .models import (
    AccountSnapshot,
    Freshness,
    PortfolioSnapshot,
    PositionSnapshot,
    TraderSnapshot,
)


_FRESHNESS_SEVERITY = {
    Freshness.UNKNOWN: 0,
    Freshness.LIVE: 1,
    Freshness.DELAYED: 2,
    Freshness.STALE: 3,
    Freshness.OFFLINE: 4,
}


def _sum_known(values: Iterable[float | None]) -> float | None:
    known = [value for value in values if value is not None]
    return sum(known) if known else None


def _worst_freshness(accounts: list[AccountSnapshot]) -> Freshness:
    if not accounts:
        return Freshness.UNKNOWN
    return max(accounts, key=lambda item: _FRESHNESS_SEVERITY[item.freshness]).freshness


def build_portfolio_snapshot(
    *,
    accounts: list[AccountSnapshot],
    traders: list[TraderSnapshot],
    positions: list[PositionSnapshot],
    now: datetime | None = None,
) -> PortfolioSnapshot:
    """Aggregate quantities that are mathematically safe to combine.

    Drawdown fractions are deliberately not aggregated here. Provider/account
    drawdown semantics differ, so portfolio risk will be supplied by an
    explicit QORE Risk contract rather than invented in the mobile layer.
    """

    as_of = now or datetime.now(UTC)

    return PortfolioSnapshot(
        as_of=as_of,
        account_count=len(accounts),
        trader_count=len(traders),
        active_positions=len(positions),
        balance=_sum_known(account.balance for account in accounts),
        equity=_sum_known(account.equity for account in accounts),
        realized_pnl_today=_sum_known(
            account.realized_pnl_today for account in accounts
        ),
        floating_pnl=_sum_known(account.floating_pnl for account in accounts),
        daily_drawdown_fraction=None,
        total_drawdown_fraction=None,
        freshness=_worst_freshness(accounts),
    )
