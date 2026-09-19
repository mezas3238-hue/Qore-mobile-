import 'package:flutter/material.dart';
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
  testWidgets('renders authenticated portfolio and account data', (tester) async {
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

    await tester.pumpWidget(
      QoreMobileApp(client: _FakeGatewayClient(snapshot)),
    );
    await tester.pumpAndSettle();

    expect(find.text('Conectado'), findsOneWidget);
    expect(find.text('300000.00'), findsOneWidget);
    expect(find.text('300150.00'), findsOneWidget);
    expect(find.text('1/2'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.account_balance_wallet_outlined).last);
    await tester.pumpAndSettle();

    expect(find.text('Primary'), findsOneWidget);
    expect(find.text('Secondary'), findsOneWidget);
    expect(find.textContaining('FundedNext'), findsNWidgets(2));
  });
}
