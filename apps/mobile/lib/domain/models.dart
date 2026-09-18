class QoreModelException implements Exception {
  const QoreModelException(this.message);

  final String message;

  @override
  String toString() => 'QoreModelException: $message';
}

String _requiredString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty) {
    throw QoreModelException('Missing or invalid $key');
  }
  return value;
}

int _requiredInt(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! num) {
    throw QoreModelException('Missing or invalid $key');
  }
  return value.toInt();
}

bool _requiredBool(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! bool) {
    throw QoreModelException('Missing or invalid $key');
  }
  return value;
}

DateTime _requiredDate(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String) {
    throw QoreModelException('Missing or invalid $key');
  }
  final parsed = DateTime.tryParse(value);
  if (parsed == null) {
    throw QoreModelException('Missing or invalid $key');
  }
  return parsed.toUtc();
}

double? _double(Object? value) => value is num ? value.toDouble() : null;
DateTime? _date(Object? value) =>
    value is String ? DateTime.tryParse(value)?.toUtc() : null;

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
  live,
  unknown;

  static TradingMode fromJson(Object? value) {
    return TradingMode.values.firstWhere(
      (item) => item.name == value,
      orElse: () => TradingMode.unknown,
    );
  }
}

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

  final DateTime asOf;
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
      asOf: _requiredDate(json, 'as_of'),
      accountCount: _requiredInt(json, 'account_count'),
      traderCount: _requiredInt(json, 'trader_count'),
      activePositions: _requiredInt(json, 'active_positions'),
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
  final DateTime asOf;
  final Freshness freshness;

  factory AccountSnapshot.fromJson(Map<String, Object?> json) {
    return AccountSnapshot(
      accountId: _requiredString(json, 'account_id'),
      provider: _requiredString(json, 'provider'),
      label: _requiredString(json, 'label'),
      mode: TradingMode.fromJson(json['mode']),
      runtimeId: _requiredString(json, 'runtime_id'),
      balance: _double(json['balance']),
      equity: _double(json['equity']),
      realizedPnlToday: _double(json['realized_pnl_today']),
      floatingPnl: _double(json['floating_pnl']),
      dailyDrawdownFraction: _double(json['daily_drawdown_fraction']),
      totalDrawdownFraction: _double(json['total_drawdown_fraction']),
      openPositions: _requiredInt(json, 'open_positions'),
      lastHeartbeat: _date(json['last_heartbeat']),
      asOf: _requiredDate(json, 'as_of'),
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
  final DateTime asOf;

  factory TraderSnapshot.fromJson(Map<String, Object?> json) {
    return TraderSnapshot(
      traderId: _requiredString(json, 'trader_id'),
      accountId: _requiredString(json, 'account_id'),
      name: _requiredString(json, 'name'),
      market: _requiredString(json, 'market'),
      mode: TradingMode.fromJson(json['mode']),
      state: _requiredString(json, 'state'),
      lastMarketRead: _date(json['last_market_read']),
      lastSignalOrAbstention: _date(json['last_signal_or_abstention']),
      freshness: Freshness.fromJson(json['freshness']),
      asOf: _requiredDate(json, 'as_of'),
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
  final DateTime openedAt;
  final DateTime asOf;

  factory PositionSnapshot.fromJson(Map<String, Object?> json) {
    return PositionSnapshot(
      positionId: _requiredString(json, 'position_id'),
      accountId: _requiredString(json, 'account_id'),
      traderId: _requiredString(json, 'trader_id'),
      symbol: _requiredString(json, 'symbol'),
      side: _requiredString(json, 'side'),
      entry: _double(json['entry']),
      currentPrice: _double(json['current_price']),
      stop: _double(json['stop']),
      target: _double(json['target']),
      size: _double(json['size']),
      unrealizedPnl: _double(json['unrealized_pnl']),
      rState: _double(json['r_state']),
      openedAt: _requiredDate(json, 'opened_at'),
      asOf: _requiredDate(json, 'as_of'),
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
  final DateTime asOf;
  final Freshness freshness;

  factory RuntimeSnapshot.fromJson(Map<String, Object?> json) {
    final rawAccounts = json['account_ids'];
    if (rawAccounts is! List || rawAccounts.any((item) => item is! String)) {
      throw const QoreModelException('Missing or invalid account_ids');
    }

    final rawSequence = json['last_sequence'];
    if (rawSequence != null && rawSequence is! num) {
      throw const QoreModelException('Invalid last_sequence');
    }

    return RuntimeSnapshot(
      runtimeId: _requiredString(json, 'runtime_id'),
      accountIds: rawAccounts.cast<String>().toList(growable: false),
      lastSequence: rawSequence is num ? rawSequence.toInt() : null,
      reconciliationRequired:
          _requiredBool(json, 'reconciliation_required'),
      lastHeartbeat: _date(json['last_heartbeat']),
      asOf: _requiredDate(json, 'as_of'),
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
