import 'models.dart';

class WidgetSnapshot {
  const WidgetSnapshot({
    required this.generatedAt,
    required this.expiresAt,
    required this.activePositions,
    required this.healthyRuntimes,
    required this.totalRuntimes,
    required this.freshness,
    this.equity,
    this.realizedPnlToday,
    this.floatingPnl,
    this.dailyDrawdownFraction,
  });

  static const schemaVersion = '1';

  final DateTime generatedAt;
  final DateTime expiresAt;
  final double? equity;
  final double? realizedPnlToday;
  final double? floatingPnl;
  final double? dailyDrawdownFraction;
  final int activePositions;
  final int healthyRuntimes;
  final int totalRuntimes;
  final Freshness freshness;

  factory WidgetSnapshot.fromDashboard(
    DashboardSnapshot dashboard, {
    required DateTime generatedAt,
    Duration validity = const Duration(seconds: 60),
  }) {
    final healthy = dashboard.runtimes
        .where((runtime) => runtime.freshness == Freshness.live)
        .length;

    return WidgetSnapshot(
      generatedAt: generatedAt.toUtc(),
      expiresAt: generatedAt.toUtc().add(validity),
      equity: dashboard.portfolio.equity,
      realizedPnlToday: dashboard.portfolio.realizedPnlToday,
      floatingPnl: dashboard.portfolio.floatingPnl,
      dailyDrawdownFraction: dashboard.portfolio.dailyDrawdownFraction,
      activePositions: dashboard.portfolio.activePositions,
      healthyRuntimes: healthy,
      totalRuntimes: dashboard.runtimes.length,
      freshness: dashboard.portfolio.freshness,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'schema_version': schemaVersion,
      'generated_at': generatedAt.toIso8601String(),
      'expires_at': expiresAt.toIso8601String(),
      'equity': equity,
      'realized_pnl_today': realizedPnlToday,
      'floating_pnl': floatingPnl,
      'daily_drawdown_fraction': dailyDrawdownFraction,
      'active_positions': activePositions,
      'healthy_runtimes': healthyRuntimes,
      'total_runtimes': totalRuntimes,
      'freshness': freshness.name,
    };
  }
}
