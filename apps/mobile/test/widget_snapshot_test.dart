import 'package:flutter_test/flutter_test.dart';
import 'package:qore_mobile/domain/models.dart';
import 'package:qore_mobile/domain/widget_snapshot.dart';

void main() {
  test('widget snapshot contains only sanitized aggregate state', () {
    final now = DateTime.utc(2026, 9, 18, 23);
    final dashboard = DashboardSnapshot(
      portfolio: PortfolioSnapshot(
        asOf: now,
        accountCount: 2,
        traderCount: 3,
        activePositions: 1,
        freshness: Freshness.live,
        equity: 300150,
        realizedPnlToday: 150,
        floatingPnl: 0,
      ),
      accounts: const [],
      traders: const [],
      positions: const [],
      risks: const [],
      alerts: const [],
      runtimes: [
        RuntimeSnapshot(
          runtimeId: 'runtime-a',
          accountIds: const ['account-a'],
          lastSequence: 10,
          reconciliationRequired: false,
          freshness: Freshness.live,
          asOf: now,
        ),
        RuntimeSnapshot(
          runtimeId: 'runtime-b',
          accountIds: const ['account-b'],
          lastSequence: 8,
          reconciliationRequired: false,
          freshness: Freshness.delayed,
          asOf: now,
        ),
      ],
    );

    final widget = WidgetSnapshot.fromDashboard(
      dashboard,
      generatedAt: now,
    );
    final json = widget.toJson();

    expect(json['equity'], 300150);
    expect(json['active_positions'], 1);
    expect(json['healthy_runtimes'], 1);
    expect(json['total_runtimes'], 2);
    expect(json['expires_at'], now.add(const Duration(seconds: 60)).toIso8601String());

    expect(json.containsKey('account_id'), isFalse);
    expect(json.containsKey('account_number'), isFalse);
    expect(json.containsKey('token'), isFalse);
    expect(json.containsKey('runtime_secret'), isFalse);
  });
}
