import 'models.dart';

class WidgetSnapshot {
  const WidgetSnapshot({
    required this.generatedAt,
    required this.expiresAt,
    required this.activePositions,
    required this.healthyRuntimes,
    required this.totalRuntimes,
    required this.freshness,
    required this.mode,
    required this.traderNames,
    required this.accountProviders,
    this.balance,
    this.equity,
    this.realizedPnlToday,
    this.floatingPnl,
    this.dailyDrawdownFraction,
    this.lastHeartbeat,
  });

  static const schemaVersion = '2';

  final DateTime generatedAt;
  final DateTime expiresAt;
  final double? balance;
  final double? equity;
  final double? realizedPnlToday;
  final double? floatingPnl;
  final double? dailyDrawdownFraction;
  final int activePositions;
  final int healthyRuntimes;
  final int totalRuntimes;
  final Freshness freshness;
  final TradingMode mode;
  final DateTime? lastHeartbeat;
  final List<String> traderNames;
  final List<String> accountProviders;

  factory WidgetSnapshot.fromDashboard(
    DashboardSnapshot dashboard, {
    required DateTime generatedAt,
    Duration validity = const Duration(seconds: 60),
  }) {
    final healthy = dashboard.runtimes
        .where((runtime) => runtime.freshness == Freshness.live)
        .length;

    DateTime? lastHeartbeat;
    for (final runtime in dashboard.runtimes) {
      final value = runtime.lastHeartbeat;
      if (value != null &&
          (lastHeartbeat == null || value.isAfter(lastHeartbeat))) {
        lastHeartbeat = value;
      }
    }

    return WidgetSnapshot(
      generatedAt: generatedAt.toUtc(),
      expiresAt: generatedAt.toUtc().add(validity),
      balance: dashboard.portfolio.balance,
      equity: dashboard.portfolio.equity,
      realizedPnlToday: dashboard.portfolio.realizedPnlToday,
      floatingPnl: dashboard.portfolio.floatingPnl,
      dailyDrawdownFraction: dashboard.portfolio.dailyDrawdownFraction,
      activePositions: dashboard.portfolio.activePositions,
      healthyRuntimes: healthy,
      totalRuntimes: dashboard.runtimes.length,
      freshness: dashboard.portfolio.freshness,
      mode: dashboard.accounts.isEmpty
          ? TradingMode.unknown
          : dashboard.accounts.first.mode,
      lastHeartbeat: lastHeartbeat,
      traderNames: dashboard.traders.map((trader) => trader.name).toList(),
      accountProviders:
          dashboard.accounts.map((account) => account.provider).toList(),
    );
  }

  Map<String, Object?> toJson() {
    return {
      'schema_version': schemaVersion,
      'generated_at': generatedAt.toIso8601String(),
      'expires_at': expiresAt.toIso8601String(),
      'balance': balance,
      'equity': equity,
      'realized_pnl_today': realizedPnlToday,
      'floating_pnl': floatingPnl,
      'daily_drawdown_fraction': dailyDrawdownFraction,
      'active_positions': activePositions,
      'healthy_runtimes': healthyRuntimes,
      'total_runtimes': totalRuntimes,
      'freshness': freshness.name,
      'mode': mode.name,
      'last_heartbeat': lastHeartbeat?.toIso8601String(),
      'trader_names': traderNames,
      'account_count': accountProviders.length,
      'account_providers': accountProviders,
    };
  }
}
