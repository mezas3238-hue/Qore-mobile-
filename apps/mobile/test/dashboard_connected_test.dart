import 'package:flutter_test/flutter_test.dart';
import 'package:qore_mobile/data/qore_gateway_client.dart';
import 'package:qore_mobile/domain/models.dart';
import 'package:qore_mobile/main.dart';

class _FakeGatewayClient implements QoreGatewayClient {
  _FakeGatewayClient(this.snapshot);

  final DashboardSnapshot snapshot;

  @override
  Future<DashboardSnapshot> fetchDashboard() async => snapshot;
}

void main() {
  testWidgets('renders authenticated supervision dashboard', (tester) async {
    final now = DateTime.utc(2026, 9, 18, 23);
    final snapshot = DashboardSnapshot(
      portfolio: PortfolioSnapshot(
        asOf: now,
        accountCount: 2,
        traderCount: 2,
        activePositions: 1,
        freshness: Freshness.live,
        balance: 300000,
        equity: 300150,
        realizedPnlToday: 150,
        floatingPnl: 0,
      ),
      accounts: [
        AccountSnapshot(
          accountId: 'account-a',
          provider: 'FundedNext',
          label: 'Primary',
          mode: TradingMode.live,
          runtimeId: 'runtime-a',
          openPositions: 1,
          freshness: Freshness.live,
          asOf: now,
          balance: 100000,
          equity: 100250,
          lastHeartbeat: now,
        ),
        AccountSnapshot(
          accountId: 'account-b',
          provider: 'FundedNext',
          label: 'Secondary',
          mode: TradingMode.shadow,
          runtimeId: 'runtime-b',
          openPositions: 0,
          freshness: Freshness.delayed,
          asOf: now,
          balance: 200000,
          equity: 199900,
          lastHeartbeat: now,
        ),
      ],
      traders: [
        TraderSnapshot(
          traderId: 'vt08',
          accountId: 'account-a',
          name: 'VT08 FOREX',
          market: 'FOREX',
          mode: TradingMode.live,
          state: 'monitoring',
          freshness: Freshness.live,
          asOf: now,
          lastMarketRead: now,
        ),
        TraderSnapshot(
          traderId: 'ts-xau',
          accountId: 'account-b',
          name: 'TURTLE SOUP XAUUSD',
          market: 'XAUUSD',
          mode: TradingMode.shadow,
          state: 'monitoring',
          freshness: Freshness.delayed,
          asOf: now,
          lastMarketRead: now,
        ),
      ],
      positions: [
        PositionSnapshot(
          positionId: 'position-1',
          accountId: 'account-a',
          traderId: 'vt08',
          symbol: 'EURUSD',
          side: 'long',
          openedAt: now,
          asOf: now,
        ),
      ],
      runtimes: [
        RuntimeSnapshot(
          runtimeId: 'runtime-a',
          accountIds: const ['account-a'],
          lastSequence: 10,
          reconciliationRequired: false,
          freshness: Freshness.live,
          asOf: now,
          lastHeartbeat: now,
        ),
        RuntimeSnapshot(
          runtimeId: 'runtime-b',
          accountIds: const ['account-b'],
          lastSequence: 8,
          reconciliationRequired: false,
          freshness: Freshness.delayed,
          asOf: now,
          lastHeartbeat: now,
        ),
      ],
      risks: [
        RiskSnapshot(
          accountId: 'account-a',
          state: 'normal',
          source: 'qore-risk',
          asOf: now,
          openRiskFraction: 0.005,
          dailyLossRemainingFraction: 0.03,
          totalLossRemainingFraction: 0.05,
        ),
      ],
      alerts: [
        AlertSnapshot(
          alertId: 'runtime:runtime-b:runtime.delayed',
          kind: 'runtime.delayed',
          severity: AlertSeverity.warning,
          title: 'Runtime con demora',
          detail: 'runtime-b está delayed.',
          source: 'gateway.runtime',
          raisedAt: now,
          asOf: now,
          runtimeId: 'runtime-b',
        ),
      ],
    );

    await tester.pumpWidget(
      QoreMobileApp(client: _FakeGatewayClient(snapshot)),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.text('Conectado'), findsOneWidget);
    expect(find.text('CONECTADO'), findsOneWidget);
    expect(find.text('Runtime heartbeat'), findsOneWidget);
    expect(find.text('300000.00'), findsOneWidget);
    expect(find.text('300150.00'), findsOneWidget);
    expect(find.text('1/2'), findsOneWidget);

    await tester.tap(find.text('Traders'));
    await tester.pump();
    expect(find.text('VT08 FOREX'), findsOneWidget);
    expect(find.text('TURTLE SOUP XAUUSD'), findsOneWidget);

    await tester.tap(find.text('Posiciones'));
    await tester.pump();
    expect(find.textContaining('EURUSD'), findsOneWidget);

    await tester.tap(find.text('Alertas'));
    await tester.pump();
    expect(find.text('Runtime con demora'), findsOneWidget);

    await tester.tap(find.text('Apariencia'));
    await tester.pump();
    expect(find.text('Widget Android'), findsOneWidget);
    expect(find.text('VISTA DEL WIDGET EN LA PANTALLA DE INICIO'), findsOneWidget);
    expect(find.text('Compacto 2×1'), findsOneWidget);
    expect(find.text('Normal 4×2'), findsOneWidget);
    expect(find.text('Detallado 4×4'), findsOneWidget);
  });
}
