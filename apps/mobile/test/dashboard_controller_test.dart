import 'package:flutter_test/flutter_test.dart';
import 'package:qore_mobile/dashboard/dashboard_controller.dart';
import 'package:qore_mobile/data/qore_gateway_client.dart';
import 'package:qore_mobile/domain/models.dart';

class _Client implements QoreGatewayClient {
  _Client(this.value);

  final DashboardSnapshot value;
  int calls = 0;

  @override
  Future<DashboardSnapshot> fetchDashboard() async {
    calls += 1;
    return value;
  }
}

void main() {
  test('successful refresh publishes the authenticated snapshot', () async {
    final now = DateTime.utc(2026, 9, 19, 12);
    final snapshot = DashboardSnapshot(
      portfolio: PortfolioSnapshot(
        asOf: now,
        accountCount: 0,
        traderCount: 0,
        activePositions: 0,
        freshness: Freshness.live,
      ),
      accounts: const [],
      traders: const [],
      positions: const [],
      runtimes: const [],
      risks: const [],
      alerts: const [],
    );
    final client = _Client(snapshot);
    DashboardSnapshot? published;
    final controller = DashboardController(
      client,
      snapshotSink: (value) async {
        published = value;
      },
    );

    await controller.refresh();
    await Future<void>.delayed(Duration.zero);

    expect(controller.status, DashboardStatus.ready);
    expect(controller.snapshot, same(snapshot));
    expect(published, same(snapshot));
    expect(client.calls, 1);

    controller.dispose();
  });
}
