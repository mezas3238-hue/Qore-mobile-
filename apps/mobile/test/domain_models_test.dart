import 'package:flutter_test/flutter_test.dart';
import 'package:qore_mobile/domain/models.dart';

void main() {
  test('parses account and runtime freshness safely', () {
    final account = AccountSnapshot.fromJson({
      'account_id': 'account-a',
      'provider': 'FundedNext',
      'label': 'Primary',
      'mode': 'live',
      'runtime_id': 'runtime-a',
      'balance': 100000,
      'equity': 100250.5,
      'open_positions': 2,
      'as_of': '2026-09-18T23:00:00Z',
      'freshness': 'live',
    });

    final runtime = RuntimeSnapshot.fromJson({
      'runtime_id': 'runtime-a',
      'account_ids': ['account-a', 'account-b'],
      'last_sequence': 42,
      'reconciliation_required': false,
      'last_heartbeat': '2026-09-18T23:00:00Z',
      'as_of': '2026-09-18T23:00:00Z',
      'freshness': 'delayed',
    });

    expect(account.provider, 'FundedNext');
    expect(account.mode, TradingMode.live);
    expect(account.equity, 100250.5);
    expect(account.freshness, Freshness.live);

    expect(runtime.accountIds, ['account-a', 'account-b']);
    expect(runtime.lastSequence, 42);
    expect(runtime.freshness, Freshness.delayed);
  });

  test('unknown freshness fails safe to unknown', () {
    final portfolio = PortfolioSnapshot.fromJson({
      'as_of': '2026-09-18T23:00:00Z',
      'account_count': 0,
      'trader_count': 0,
      'active_positions': 0,
      'freshness': 'unexpected-value',
    });

    expect(portfolio.freshness, Freshness.unknown);
  });

  test('parses Alert Center snapshots', () {
    final alert = AlertSnapshot.fromJson({
      'alert_id': 'runtime:r1:runtime.offline',
      'kind': 'runtime.offline',
      'severity': 'critical',
      'title': 'Runtime offline',
      'detail': 'r1 está offline.',
      'source': 'gateway.runtime',
      'raised_at': '2026-09-18T23:00:00Z',
      'as_of': '2026-09-18T23:01:00Z',
      'runtime_id': 'r1',
    });

    expect(alert.severity, AlertSeverity.critical);
    expect(alert.runtimeId, 'r1');
    expect(alert.kind, 'runtime.offline');
  });

  test('missing financial identity fields do not become empty strings', () {
    expect(
      () => AccountSnapshot.fromJson({
        'provider': 'FundedNext',
        'label': 'Primary',
        'mode': 'live',
        'runtime_id': 'runtime-a',
        'open_positions': 0,
        'as_of': '2026-09-18T23:00:00Z',
        'freshness': 'live',
      }),
      throwsA(isA<QoreModelException>()),
    );
  });
}
