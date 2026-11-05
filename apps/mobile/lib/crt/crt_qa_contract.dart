/// Read-only, NON-OPERABLE CRT QA contract; distinct from QORE Core account telemetry.
/// The mobile client never self-certifies a live trading alert.
const qoreCrtMarkets = <String>[
  'AUDJPY','GBPUSD','GBPJPY','XAUUSD','NDX100','SPX500',
  'US30','BTCUSD','AUDUSD','USDCAD','USDJPY','EURUSD',
  'USDCHF','NZDUSD','NZDJPY','NZDCHF','XAGUSD','AUDCAD',
  'AUDCHF','AUDNZD','CADCHF','CADJPY','CHFJPY','EURAUD',
  'EURCAD','EURCHF','EURGBP','EURJPY','EURNZD','GBPAUD',
  'GBPCAD','GBPCHF','GBPNZD','NZDCAD',
];
const _families = <String>{
  'CRT_2C_RETURN','CRT_3C_TRUE','INSIDE_RETURN',
  'INSIDE_CONTINUATION_REJECTED','MULTI4','MULTI_N','M15_RETEST',
};
const _events = <String>{
  'CRT_OBSERVED','MSS_M5_OBSERVED','MSS_M15_OBSERVED',
};
const _statuses = <String>{'AWAITING','CONFIRMED','UNVERIFIED'};
const _ttlMs = 14400000;

class QoreCrtQaEvent {
  const QoreCrtQaEvent({
    required this.instrumentId,
    required this.family,
    required this.eventType,
    required this.direction,
    required this.mssM5,
    required this.mssM15,
    required this.confirmedAt,
    required this.expiresAt,
    required this.eventId,
  });

  final String instrumentId, family, eventType, direction, mssM5, mssM15, eventId;
  final DateTime confirmedAt, expiresAt;

  bool activeAt(DateTime now) =>
    !confirmedAt.isAfter(now.toUtc()) && expiresAt.isAfter(now.toUtc());

  static QoreCrtQaEvent? fromJson(Object? source, {required DateTime now}) {
    if (source is! Map<String,dynamic>) return null;
    final d = source;
    final instrument = d['instrumentId'];
    final family = d['family'];
    final eventType = d['eventType'];
    final direction = d['direction'];
    final m5 = d['mssM5'];
    final m15 = d['mssM15'];
    final eventId = d['eventId'];
    final at = d['eventAtMs'];
    final c1 = d['c1StartMs'];
    final expiry = d['expiresAtMs'];
    if (instrument is! String ||
      !qoreCrtMarkets.contains(instrument) ||
      family is! String || !_families.contains(family) ||
      eventType is! String || !_events.contains(eventType) ||
      direction is! String || !{'BULLISH','BEARISH'}.contains(direction) ||
      m5 is! String || m15 is! String ||
      !_statuses.contains(m5) || !_statuses.contains(m15) ||
      at is! int || c1 is! int || expiry is! int ||
      eventId is! String) { return null; }
    final tv = instrument == 'NDX100' ? 'IC:USTEC' :
      instrument == 'SPX500' ? 'IC:US500' : 'IC:$instrument';
    if (d['schema'] != 'QORE_CRT_MONITOR_QA_V2' ||
      d['mode'] != 'OFFLINE_REPLAY' ||
      d['certification'] != 'NOT_VERIFIED' ||
      d['deliveryState'] != 'BLOCKED_NOT_CERTIFIED' ||
      d['transport'] != 'DISABLED' ||
      d['sendPush'] != false || d['actionable'] != false ||
      d['requiresRealFeedAndPineParity'] != true ||
      d['tvSymbol'] != tv) { return null; }
    if (c1 <= 0 || at <= c1 || at-c1 > 345600000 ||
      at % 60000 != 0 || c1 % 60000 != 0 ||
      expiry != at + _ttlMs) { return null; }
    final phase = c1 % 300000;
    final step = eventType == 'MSS_M15_OBSERVED' ? 900000 : 300000;
    if (at % step != phase) return null;
    if (eventType == 'MSS_M5_OBSERVED' && m5 != 'CONFIRMED') return null;
    if (eventType == 'MSS_M15_OBSERVED' && m15 != 'CONFIRMED') return null;
    final sign = direction == 'BULLISH' ? '1' : '-1';
    if (eventId != 'IC|$instrument|$c1|$sign|$eventType|$at') return null;
    final event = QoreCrtQaEvent(
      instrumentId:instrument, family:family, eventType:eventType,
      direction:direction, mssM5:m5, mssM15:m15, eventId:eventId,
      confirmedAt:DateTime.fromMillisecondsSinceEpoch(at,isUtc:true),
      expiresAt:DateTime.fromMillisecondsSinceEpoch(expiry,isUtc:true),
    );
    return event.activeAt(now) ? event : null;
  }
}

class QoreCrtQaInbox {
  const QoreCrtQaInbox({required this.state,required this.events});
  final String state;
  final List<QoreCrtQaEvent> events;

  static QoreCrtQaInbox fromJson(Object? data,{DateTime? now}) {
    if (data is! Map<String,dynamic> ||
      data['schema_version'] != 'QORE_MOBILE_CRT_QA_V1' ||
      data['authenticated'] != true ||
      data['live_feed'] != false ||
      data['certified'] != false ||
      data['push_enabled'] != false ||
      data['ttl_seconds'] != 14400 ||
      !{'QA_NOT_CONNECTED','OFFLINE_REPLAY_ONLY'}.contains(data['state']) ||
      data['events'] is! List) {
      throw const FormatException('Invalid or untrusted QORE CRT inbox');
    }
    final rows = data['events'] as List<dynamic>;
    if (rows.length > 100) { throw const FormatException('CRT inbox over limit'); }
    final instant = (now??DateTime.now()).toUtc();
    final seen = <String,QoreCrtQaEvent>{};
    final conflicts = <String>{};
    for (final row in rows) {
      final event=QoreCrtQaEvent.fromJson(row,now:instant);
      if(event==null){ continue; }
      final key='${event.eventId}|${event.family}';
      if(conflicts.contains(key)){ continue; }
      final old=seen[key];
      if(old!=null && (old.mssM5!=event.mssM5 ||
        old.mssM15!=event.mssM15)) {
        seen.remove(key);
        conflicts.add(key);
      } else {
        seen[key]=event;
      }
    }
    final result=seen.values.toList()
      ..sort((a,b)=>b.confirmedAt.compareTo(a.confirmedAt));
    return QoreCrtQaInbox(state:data['state'] as String,events:result);
  }
}
