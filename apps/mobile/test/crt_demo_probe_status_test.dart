import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qore_mobile/crt/crt_demo_probe_status.dart';
import 'package:qore_mobile/crt/crt_qa_contract.dart';
import 'package:qore_mobile/crt/crt_alerts_page.dart';
import 'package:qore_mobile/data/qore_gateway_client.dart';

Map<String, Object?> sample({int? at, Map<String, Object?> override = const {}}) => {
  'schema_version': 'QORE_CTRADER_DEMO_PROBE_STATUS_V1',
  'state': 'QA_PROBE_RECEIVED',
  'source': 'CTRADER_OPEN_API_DEMO',
  'environment': 'DEMO',
  'broker': 'IC Markets',
  'probe_state': 'INVENTORY_QA_ONLY',
  'sampled_closed_m5': 0,
  'symbols_observed': 34,
  'observed_at_ms': at ?? DateTime.now().toUtc().millisecondsSinceEpoch,
  'source_parity_certified': false,
  'verified_market_feed': false,
  'crt_signals_enabled': false,
  'push_enabled': false,
  'can_trade': false,
  ...override,
};

class _FakeCrtWithProbe implements QoreCrtQaClient, QoreCrtDemoProbeClient {
  @override
  Future<QoreCrtQaInbox> fetchCrtQaInbox() async {
    return QoreCrtQaInbox.fromJson({
      'schema_version': 'QORE_MOBILE_CRT_QA_V1',
      'state': 'QA_NOT_CONNECTED',
      'authenticated': true,
      'live_feed': false,
      'push_enabled': false,
      'certified': false,
      'ttl_seconds': 14400,
      'events': <Object>[],
    });
  }

  @override
  Future<QoreCrtDemoProbeStatus> fetchCrtDemoProbeStatus() async =>
      QoreCrtDemoProbeStatus.fromJson(sample());
}

void main() {
  test('recent DEMO view-only QA probe never certifies market alerts', () {
    final result = QoreCrtDemoProbeStatus.fromJson(sample());
    expect(result.recent, true);
    expect(result.symbolsObserved, 34);
    expect(result.sampledClosedM5, 0);
    expect(result.probeState, 'INVENTORY_QA_ONLY');
  });

  test('LIVE, trading scope, fake certified signals and FCM rejected', () {
    for (final entry in <Map<String, Object?>>[
      {'environment': 'LIVE'},
      {'source_parity_certified': true},
      {'verified_market_feed': true},
      {'crt_signals_enabled': true},
      {'push_enabled': true},
      {'can_trade': true},
      {'state': 'CERTIFIED'},
      {'broker': 'other'},
      {'probe_state': 'HISTORICAL_M5_QA_UNCERTIFIED',
       'sampled_closed_m5': 0},
      {'symbols_observed': 3001},
    ]) {
      expect(() => QoreCrtDemoProbeStatus.fromJson(sample(override: entry)),
        throwsFormatException, reason: '$entry');
    }
  });

  test('no stale or disconnected probe claims active', () {
    final now = DateTime.now().toUtc();
    final expired = QoreCrtDemoProbeStatus.fromJson(sample(
      at: now.millisecondsSinceEpoch - 100000), now: now);
    expect(expired.recent, false);
    final disconnected = QoreCrtDemoProbeStatus.fromJson(sample(
      override: {
        'state': 'QA_NOT_CONNECTED',
        'observed_at_ms': null,
        'probe_state': null,
        'symbols_observed': 0,
        'sampled_closed_m5': 0,
      },
    ));
    expect(disconnected.recent, false);
  });

  testWidgets('existing CRT Alerts page shows DEMO QA status without signals',
      (tester) async {
    await tester.pumpWidget(MaterialApp(home: Scaffold(
      body: QoreAlertsHub(
        operationalAlerts: const Text('Operativas intactas'),
        crtClient: _FakeCrtWithProbe(),
      ),
    )));
    await tester.tap(find.text('CRT Alerts'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('cTrader DEMO · IC Markets'), findsOneWidget);
    expect(find.textContaining('Prueba de conexión QA recibida'),
        findsOneWidget);
    expect(find.textContaining('LABORATORIO · SIN SEÑALES REALES'),
        findsOneWidget);
    expect(find.text('Operativas intactas'), findsNothing);
  });
}
