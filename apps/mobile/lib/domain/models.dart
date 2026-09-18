enum Freshness {
  live,
  delayed,
  stale,
  offline,
  unknown;

  static Freshness fromJson(Object? value) {
    return Freshness.values.firstWhere(
      (item) => item.name == value,
      orElse: () => Freshness.unknown,
    );
  }
}

enum TradingMode {
  demo,
  shadow,
  live;

  static TradingMode fromJson(Object? value) {
    return TradingMode.values.firstWhere(
      (item) => item.name == value,
      orElse: () => TradingMode.demo,
    );
  }
}

double? _double(Object? value) => value is num ? value.toDouble() : null;
int _int(Object? value) => value is num ? value.toInt() : 0;
DateTime? _date(Object? value) =>
    value is String ? DateTime.tryParse(value)?.toUtc() : null;

class PortfolioSnapshot {
  const PortfolioSnapshot({
    required this.asOf,
    required this.accountCount,
    required this.traderCount,
    required this.activePositions,
    required this.freshness,
    this.balance,
    this.equity,
    this.realizedPnlToday,
    this.floatingPnl,
    this.dailyDrawdownFraction,
    this.totalDrawdownFraction,
  });

  final DateTime? asOf;
  final int accountCount;
  final int traderCount;
  final int activePositions;
  final double? balance;
  final double? equity;
  final double? realizedPnlToday;
  final double? floatingPnl;
  final double? dailyDrawdownFraction;
  final double? totalDrawdownFraction;
  final Freshness freshness;

  factory PortfolioSnapshot.fromJson(Map<String, Object?> json) {
    return PortfolioSnapshot(
      asOf: _date(json['as_of']),
      accountCount: _int(json['account_count']),
      traderCount: _int(json['trader_count']),
      activePositions: _int(json['active_positions']),
      balance: _double(json['balance']),
      equity: _double(json['equity']),
      realizedPnlToday: _double(json['realized_pnl_today']),
      floatingPnl: _double(json['floating_pnl']),
      dailyDrawdownFraction: _double(json['daily_drawdown_fraction']),
      totalDrawdownFraction: _double(json['total_drawdown_fraction']),
      freshness: Freshness.fromJson(json['freshness']),
    );
  }
}

class AccountSnapshot {
  const AccountSnapshot({
    required this.accountId,
    required this.provider,
    required this.label,
    required this.mode,
    required this.runtimeId,
    required this.openPositions,
    required this.freshness,
    required this.asOf,
    this.balance,
    this.equity,
    this.realizedPnlToday,
    this.floatingPnl,
    this.dailyDrawdownFraction,
    this.totalDrawdownFraction,
    this.lastHeartbeat,
  });

  final String accountId;
  final String provider;
  final String label;
  final TradingMode mode;
  final String runtimeId;
  final double? balance;
  final double? equity;
  final double? realizedPnlToday;
  final double? floatingPnl;
  final double? dailyDrawdownFraction;
  final double? totalDrawdownFraction;
  final int openPositions;
  final DateTime? lastHeartbeat;
  final DateTime? asOf;
  final Freshness freshness;

  factory AccountSnapshot.fromJson(Map<String, Object?> json) {
    return AccountSnapshot(
      accountId: json['account_id'] as String? ?? '',
      provider: json['provider'] as String? ?? '',
      label: json['label'] as String? ?? '',
      mode: TradingMode.fromJson(json['mode']),
      runtimeId: json['runtime_id'] as String? ?? '',
      balance: _double(json['balance']),
      equity: _double(json['equity']),
      realizedPnlToday: _double(json['realized_pnl_today']),
      floatingPnl: _double(json['floating_pnl']),
      dailyDrawdownFraction: _double(json['daily_drawdown_fraction']),
      totalDrawdownFraction: _double(json['total_drawdown_fraction']),
      openPositions: _int(json['open_positions']),
      lastHeartbeat: _date(json['last_heartbeat']),
      asOf: _date(json['as_of']),
      freshness: Freshness.fromJson(json['freshness']),
    );
  }
}

class TraderSnapshot {
  const TraderSnapshot({
    required this.traderId,
    required this.accountId,
    required this.name,
    required this.market,
    required this.mode,
    required this.state,
    required this.freshness,
    required this.asOf,
    this.lastMarketRead,
    this.lastSignalOrAbstention,
  });

  final String traderId;
  final String accountId;
  final String name;
  final String market;
  final TradingMode mode;
  final String state;
  final DateTime? lastMarketRead;
  final DateTime? lastSignalOrAbstention;
  final Freshness freshness;
  final DateTime? asOf;

  factory TraderSnapshot.fromJson(Map<String, Object?> json) {
    return TraderSnapshot(
      traderId: json['trader_id'] as String? ?? '',
      accountId: json['account_id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      market: json['market'] as String? ?? '',
      mode: TradingMode.fromJson(json['mode']),
      state: json['state'] as String? ?? '',
      lastMarketRead: _date(json['last_market_read']),
      lastSignalOrAbstention: _date(json['last_signal_or_abstention']),
      freshness: Freshness.fromJson(json['freshness']),
      asOf: _date(json['as_of']),
    );
  }
}

class PositionSnapshot {
  const PositionSnapshot({
    required this.positionId,
    required this.accountId,
    required this.traderId,
    required this.symbol,
    required this.side,
    required this.openedAt,
    required this.asOf,
    this.entry,
    this.currentPrice,
    this.stop,
    this.target,
    this.size,
    this.unrealizedPnl,
    this.rState,
  });

  final String positionId;
  final String accountId;
  final String traderId;
  final String symbol;
  final String side;
  final double? entry;
  final double? currentPrice;
  final double? stop;
  final double? target;
  final double? size;
  final double? unrealizedPnl;
  final double? rState;
  final DateTime? openedAt;
  final DateTime? asOf;

  factory PositionSnapshot.fromJson(Map<String, Object?> json) {
    return PositionSnapshot(
      positionId: json['position_id'] as String? ?? '',
      accountId: json['account_id'] as String? ?? '',
      traderId: json['trader_id'] as String? ?? '',
      symbol: json['symbol'] as String? ?? '',
      side: json['side'] as String? ?? '',
      entry: _double(json['entry']),
      currentPrice: _double(json['current_price']),
      stop: _double(json['stop']),
      target: _double(json['target']),
      size: _double(json['size']),
      unrealizedPnl: _double(json['unrealized_pnl']),
      rState: _double(json['r_state']),
      openedAt: _date(json['opened_at']),
      asOf: _date(json['as_of']),
    );
  }
}

class RuntimeSnapshot {
  const RuntimeSnapshot({
    required this.runtimeId,
    required this.accountIds,
    required this.reconciliationRequired,
    required this.freshness,
    required this.asOf,
    this.lastSequence,
    this.lastHeartbeat,
  });

  final String runtimeId;
  final List<String> accountIds;
  final int? lastSequence;
  final bool reconciliationRequired;
  final DateTime? lastHeartbeat;
  final DateTime? asOf;
  final Freshness freshness;

  factory RuntimeSnapshot.fromJson(Map<String, Object?> json) {
    final rawAccounts = json['account_ids'];
    return RuntimeSnapshot(
      runtimeId: json['runtime_id'] as String? ?? '',
      accountIds: rawAccounts is List
          ? rawAccounts.whereType<String>().toList(growable: false)
          : const [],
      lastSequence:
          json['last_sequence'] is num ? (json['last_sequence'] as num).toInt() : null,
      reconciliationRequired:
          json['reconciliation_required'] as bool? ?? false,
      lastHeartbeat: _date(json['last_heartbeat']),
      asOf: _date(json['as_of']),
      freshness: Freshness.fromJson(json['freshness']),
    );
  }
}

class DashboardSnapshot {
  const DashboardSnapshot({
    required this.portfolio,
    required this.accounts,
    required this.traders,
    required this.positions,
    required this.runtimes,
  });

  final PortfolioSnapshot portfolio;
  final List<AccountSnapshot> accounts;
  final List<TraderSnapshot> traders;
  final List<PositionSnapshot> positions;
  final List<RuntimeSnapshot> runtimes;
}
