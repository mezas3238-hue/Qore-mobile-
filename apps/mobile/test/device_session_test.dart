import 'package:flutter_test/flutter_test.dart';
import 'package:qore_mobile/security/session.dart';

void main() {
  test('parses a complete device-bound session', () {
    final session = QoreDeviceSession.fromJson({
      'device_id': 'device-123456',
      'access_token': 'access',
      'access_expires_at': '2026-09-18T23:10:00Z',
      'refresh_token': 'refresh',
      'refresh_expires_at': '2026-10-18T23:00:00Z',
    });

    expect(session.deviceId, 'device-123456');
    expect(session.accessToken, 'access');
    expect(session.refreshToken, 'refresh');
  });

  test('rejects incomplete session payloads', () {
    expect(
      () => QoreDeviceSession.fromJson({
        'device_id': 'device-123456',
        'access_token': 'access',
      }),
      throwsA(isA<FormatException>()),
    );
  });
}
