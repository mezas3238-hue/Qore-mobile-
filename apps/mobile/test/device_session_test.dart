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

  test('parses native security capabilities', () {
    final capabilities = DeviceSecurityCapabilities.fromJson({
      'biometric_strong_available': true,
      'device_credential_available': true,
      'secure_store_available': true,
      'secure_hardware_available': true,
      'secure_store': 'AndroidKeyStore',
      'biometric_kind': 'strong',
    });

    expect(capabilities.strongBiometricAvailable, isTrue);
    expect(capabilities.ownerAuthenticationAvailable, isTrue);
    expect(capabilities.secureStore, 'AndroidKeyStore');
  });

  test('rejects incomplete security capabilities', () {
    expect(
      () => DeviceSecurityCapabilities.fromJson({
        'biometric_strong_available': true,
      }),
      throwsA(isA<FormatException>()),
    );
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
