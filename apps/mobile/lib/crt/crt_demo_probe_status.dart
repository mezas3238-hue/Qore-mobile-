/// Authenticated, strictly non-operable IC Markets cTrader DEMO QA probe.
//// This object is NOT a TradingView or CRT/MSS signal.
class QoreCrtDemoProbeStatus {
  const QoreCrtDemoProbeStatus({
    required this.recent,
    required this.symbolsObserved,
    required this.sampledClosedM5,
    required this.probeState,
  });

  final bool recent;
  final int symbolsObserved;
  final int sampledClosedM5;
  final String? probeState;

  static QoreCrtDemoProbeStatus fromJson(Object? source, {DateTime? now}) {
    if (source is! Map) {
      throw const FormatException('Invalid cTrader DEMO QA status');
    }
    final j = Map<String, Object?>.from(source);
    if (j['schema_version'] != 'QORE_CTRADER_DEMO_PROBE_STATUS_V1' ||
        j['source'] != 'CTRADER_OPEN_API_DEMO' ||
        j['environment'] != 'DEMO' ||
        j['broker'] != 'IC Markets' ||
        j['source_parity_certified'] != false ||
        j['verified_market_feed'] != false ||
        j['crt_signals_enabled'] != false ||
        j['push_enabled'] != false ||
        j['can_trade'] != false) {
      throw const FormatException('Unsafe or untrusted DEMO probe response');
    }
    if (j['state'] == 'QA_NOT_CONNECTED') {
      if (j['observed_at_ms'] != null ||
          j['sampled_closed_m5'] != 0 ||
          j['symbols_observed'] != 0 ||
          j['probe_state'] != null) {
        throw const FormatException('Contradictory disconnected state');
      }
      return const QoreCrtDemoProbeStatus(
        recent: false, symbolsObserved: 0, sampledClosedM5: 0,
        probeState: null,
      );
    }
    if (j['state'] != 'QA_PROBE_RECEIVED') {
      throw const FormatException('Unrecognized DEMO probe state');
    }
    final at = j['observed_at_ms'];
    final symbols = j['symbols_observed'];
    final bars = j['sampled_closed_m5'];
    final probeState = j['probe_state'];
    if (at is! int || symbols is! int || bars is! int ||
        symbols < 0 || symbols > 3000 || bars < 0 || bars > 500 ||
        !{'INVENTORY_QA_ONLY','HISTORICAL_M5_QA_UNCERTIFIED'}
            .contains(probeState) ||
        (probeState == 'INVENTORY_QA_ONLY' && bars != 0) ||
        (probeState == 'HISTORICAL_M5_QA_UNCERTIFIED' && bars == 0)) {
      throw const FormatException('Invalid cTrader DEMO sample');
    }
    final current = (now ?? DateTime.now().toUtc()).millisecondsSinceEpoch;
    if (at > current || current - at >= 90000) {
      return const QoreCrtDemoProbeStatus(
        recent: false, symbolsObserved: 0, sampledClosedM5: 0,
        probeState: null,
      );
    }
    return QoreCrtDemoProbeStatus(
      recent: true,
      symbolsObserved: symbols,
      sampledClosedM5: bars,
      probeState: probeState as String,
    );
  }
}
