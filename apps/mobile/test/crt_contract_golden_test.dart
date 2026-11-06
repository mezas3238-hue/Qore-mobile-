import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:qore_mobile/crt/crt_qa_contract.dart';

void main() {
  // Test process cwd = apps/mobile, fixture lives in the repo's contracts/.
  final fixturePath = File('../../contracts/crt_qa_v1_golden.json');

  test('Flutter accepts the same OFFLINE_REPLAY record as Python Gateway', () {
    expect(fixturePath.existsSync(), isTrue);
    final payload = jsonDecode(fixturePath.readAsStringSync())
        as Map<String, dynamic>;
    final reference = DateTime.utc(2027, 1, 15, 8, 1);
    final inbox = QoreCrtQaInbox.fromJson(payload, now: reference);
    expect(inbox.state, 'OFFLINE_REPLAY_ONLY');
    expect(inbox.events, hasLength(1));
    final event = inbox.events.single;
    expect(event.instrumentId, 'USDCAD');
    expect(event.family, 'CRT_3C_TRUE');
    expect(event.eventType, 'MSS_M15_OBSERVED');
    expect(event.mssM5, 'CONFIRMED');
    expect(event.mssM15, 'CONFIRMED');
    expect(event.confirmedAt, DateTime.utc(2027, 1, 15, 8));
    expect(event.expiresAt, DateTime.utc(2027, 1, 15, 12));
  });

  test('Flutter enforces expiry and refuses forged market delivery fields', () {
    final payload = jsonDecode(fixturePath.readAsStringSync())
        as Map<String, dynamic>;
    final atExpiry = QoreCrtQaInbox.fromJson(
      payload, now: DateTime.utc(2027, 1, 15, 12),
    );
    expect(atExpiry.events, isEmpty);

    final cloned = jsonDecode(jsonEncode(payload)) as Map<String, dynamic>;
    final rows = cloned['events'] as List<dynamic>;
    final row = rows.single as Map<String, dynamic>;
    row['sendPush'] = true;
    final forged = QoreCrtQaInbox.fromJson(
      cloned, now: DateTime.utc(2027, 1, 15, 8, 1),
    );
    expect(forged.events, isEmpty);
  });
}
