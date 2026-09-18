from dataclasses import dataclass, field

from .models import AccountSnapshot, PositionSnapshot, TraderSnapshot


@dataclass
class ReadRepository:
    """Canonical mobile read store.

    Production ingestion will populate this repository from authenticated
    QORE runtime telemetry. It intentionally starts empty so the Gateway
    cannot fabricate LIVE portfolio data.
    """

    accounts: dict[str, AccountSnapshot] = field(default_factory=dict)
    traders: dict[str, TraderSnapshot] = field(default_factory=dict)
    positions: dict[str, PositionSnapshot] = field(default_factory=dict)

    def list_accounts(self) -> list[AccountSnapshot]:
        return sorted(self.accounts.values(), key=lambda item: item.account_id)

    def list_traders(self) -> list[TraderSnapshot]:
        return sorted(self.traders.values(), key=lambda item: item.trader_id)

    def list_positions(self) -> list[PositionSnapshot]:
        return sorted(self.positions.values(), key=lambda item: item.position_id)
