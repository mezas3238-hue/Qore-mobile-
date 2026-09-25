from datetime import UTC, datetime

from qore_mobile_gateway.models import (
    AccountSnapshot,
    Freshness,
    PositionSide,
    PositionSnapshot,
    TraderSnapshot,
    TradingMode,
)
from qore_mobile_gateway.service import build_portfolio_snapshot


NOW = datetime(2026, 9, 18, 23, 0, tzinfo=UTC)


def test_two_accounts_and_multiple_traders_aggregate_without_fake_drawdown() -> None:
    accounts = [
        AccountSnapshot(
            account_id="account-a",
            provider="provider-a",
            label="A",
            mode=TradingMode.LIVE,
            runtime_id="runtime-a",
            balance=100_000,
            equity=100_250,
            realized_pnl_today=200,
            floating_pnl=50,
            open_positions=1,
            last_heartbeat=NOW,
            as_of=NOW,
            freshness=Freshness.LIVE,
        ),
        AccountSnapshot(
            account_id="account-b",
            provider="provider-b",
            label="B",
            mode=TradingMode.SHADOW,
            runtime_id="runtime-b",
            balance=200_000,
            equity=199_900,
            realized_pnl_today=-50,
            floating_pnl=-50,
            open_positions=0,
            last_heartbeat=NOW,
            as_of=NOW,
            freshness=Freshness.DELAYED,
        ),
    ]

    traders = [
        TraderSnapshot(
            trader_id="t1",
            account_id="account-a",
            name="Trader 1",
            market="EURUSD",
            mode=TradingMode.LIVE,
            state="monitoring",
            as_of=NOW,
            freshness=Freshness.LIVE,
        ),
        TraderSnapshot(
            trader_id="t2",
            account_id="account-a",
            name="Trader 2",
            market="XAUUSD",
            mode=TradingMode.LIVE,
            state="in_position",
            as_of=NOW,
            freshness=Freshness.LIVE,
        ),
        TraderSnapshot(
            trader_id="t3",
            account_id="account-b",
            name="Trader 3",
            market="NAS100",
            mode=TradingMode.SHADOW,
            state="monitoring",
            as_of=NOW,
            freshness=Freshness.DELAYED,
        ),
    ]

    positions = [
        PositionSnapshot(
            position_id="p1",
            account_id="account-a",
            trader_id="t2",
            symbol="XAUUSD",
            side=PositionSide.LONG,
            opened_at=NOW,
            as_of=NOW,
            unrealized_pnl=50,
        )
    ]

    snapshot = build_portfolio_snapshot(
        accounts=accounts,
        traders=traders,
        positions=positions,
        now=NOW,
    )

    assert snapshot.account_count == 2
    assert snapshot.trader_count == 3
    assert snapshot.active_positions == 1
    assert snapshot.balance == 300_000
    assert snapshot.equity == 300_150
    assert snapshot.realized_pnl_today == 150
    assert snapshot.floating_pnl == 0
    assert snapshot.freshness == Freshness.DELAYED
    assert snapshot.daily_drawdown_fraction is None
    assert snapshot.total_drawdown_fraction is None
