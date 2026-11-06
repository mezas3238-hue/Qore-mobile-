import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qore_mobile/crt/crt_qa_contract.dart';
import 'package:qore_mobile/crt/crt_alerts_page.dart';
import 'package:qore_mobile/data/qore_gateway_client.dart';

Map<String, dynamic> event({Map<String, Object?> overrides = const {}}) {
  final now=DateTime.now().toUtc().millisecondsSinceEpoch;
  final at=now-(now%900000);
  final c1=at-8*3600000;
  return {
    'schema':'QORE_CRT_MONITOR_QA_V2',
    'mode':'OFFLINE_REPLAY',
    'certification':'NOT_VERIFIED',
    'deliveryState':'BLOCKED_NOT_CERTIFIED',
    'transport':'DISABLED',
    'sendPush':false,
    'actionable':false,
    'requiresRealFeedAndPineParity':true,
    'instrumentId':'USDCAD',
    'tvSymbol':'IC:USDCAD',
    'family':'CRT_3C_TRUE',
    'direction':'BULLISH',
    'eventType':'MSS_M15_OBSERVED',
    'mssM5':'CONFIRMED',
    'mssM15':'CONFIRMED',
    'c1StartMs':c1,
    'eventAtMs':at,
    'expiresAtMs':at+14400000,
    'eventId':'IC|USDCAD|$c1|1|MSS_M15_OBSERVED|$at',
    ...overrides,
  };
}
Map<String,dynamic> inbox(List<Map<String,dynamic>> events) => {
  'schema_version':'QORE_MOBILE_CRT_QA_V1',
  'state':events.isEmpty ? 'QA_NOT_CONNECTED' : 'OFFLINE_REPLAY_ONLY',
  'authenticated':true,
  'live_feed':false,
  'push_enabled':false,
  'certified':false,
  'ttl_seconds':14400,
  'events':events,
};
class _FakeCrt implements QoreCrtQaClient {
  @override
  Future<QoreCrtQaInbox> fetchCrtQaInbox() async =>
    QoreCrtQaInbox.fromJson(inbox([event()]));
}
void main() {
  test('34 IC markets, 7 families, independently scoped 4h lifecycle', () {
    expect(qoreCrtMarkets.length,34);
    expect(qoreCrtMarkets.toSet().length,34);
    final data=QoreCrtQaInbox.fromJson(inbox([event()]));
    expect(data.events.length,1);
    expect(data.events[0].mssM5,'CONFIRMED');
    expect(data.events[0].mssM15,'CONFIRMED');
    final at=data.events[0].confirmedAt;
    expect(data.events[0].expiresAt.difference(at).inHours,4);
    expect(QoreCrtQaInbox.fromJson(inbox([event()]),
      now:data.events[0].expiresAt).events,isEmpty);
  });
  test('forged real-feed, invalid MSS, wrong IC, future/stale are dropped', () {
    for(final overrides in [
      {'sendPush':true}, {'actionable':true},
      {'mode':'LIVE'}, {'certification':'CERTIFIED'},
      {'mssM15':'AWAITING'}, {'tvSymbol':'IC:GBPUSD'},
      {'eventId':'spoof'}, {'expiresAtMs':0},
    ]) {
      final value=QoreCrtQaInbox.fromJson(inbox([event(overrides:overrides)]));
      expect(value.events,isEmpty,reason:'untrusted input $overrides');
    }
    expect(() => QoreCrtQaInbox.fromJson({
      ...inbox([]),'live_feed':true,
    }), throwsFormatException);
    expect(() => QoreCrtQaInbox.fromJson({
      ...inbox([]),'certified':true,
    }), throwsFormatException);
  });

  testWidgets('existing QORE Mobile operational alerts coexist with CRT QA',
      (tester) async {
    await tester.pumpWidget(MaterialApp(home:Scaffold(
      body:QoreAlertsHub(
        operationalAlerts:const Center(child:Text('Informes VPS preservados')),
        crtClient:_FakeCrt(),
      ),
    )));
    expect(find.text('Informes VPS preservados'),findsOneWidget);
    await tester.tap(find.text('CRT Alerts'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds:80));
    expect(find.text('LABORATORIO · SIN SEÑALES REALES'),findsOneWidget);
    expect(find.text('Gateway CRT: conexión autenticada OK'),findsOneWidget);
    expect(find.text('REPLAY QA · NO CERTIFICADO · NO OPERAR'),findsOneWidget);
    expect(find.text('USDCAD'),findsOneWidget);
    await tester.tap(find.text('Operativas'));
    await tester.pump();
    expect(find.text('Informes VPS preservados'),findsOneWidget);
  });

  testWidgets('CRT tab explicitly reports no authenticated QA connection',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Scaffold(
      body: QoreAlertsHub(
        operationalAlerts: Center(child: Text('Informes VPS preservados')),
      ),
    )));
    await tester.tap(find.text('CRT Alerts'));
    await tester.pump();
    expect(find.text('Gateway CRT: no verificado'), findsOneWidget);
    expect(find.text('LABORATORIO · SIN SEÑALES REALES'), findsOneWidget);
    expect(find.text('REPLAY QA · NO CERTIFICADO · NO OPERAR'), findsNothing);
  });
}
