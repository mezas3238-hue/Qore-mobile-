class QoreDeviceSession {
  const QoreDeviceSession({
    required this.deviceId,
    required this.accessToken,
    required this.accessExpiresAt,
    required this.refreshToken,
    required this.refreshExpiresAt,
  });

  final String deviceId;
  final String accessToken;
  final DateTime accessExpiresAt;
  final String refreshToken;
  final DateTime refreshExpiresAt;

  factory QoreDeviceSession.fromJson(Map<String, Object?> json) {
    String requiredString(String key) {
      final value = json[key];
      if (value is! String || value.isEmpty) {
        throw FormatException('Missing or invalid $key');
      }
      return value;
    }

    DateTime requiredDate(String key) {
      final value = requiredString(key);
      final parsed = DateTime.tryParse(value);
      if (parsed == null) {
        throw FormatException('Missing or invalid $key');
      }
      return parsed.toUtc();
    }

    return QoreDeviceSession(
      deviceId: requiredString('device_id'),
      accessToken: requiredString('access_token'),
      accessExpiresAt: requiredDate('access_expires_at'),
      refreshToken: requiredString('refresh_token'),
      refreshExpiresAt: requiredDate('refresh_expires_at'),
    );
  }
}

/// Security boundary implemented by native Android/iOS code.
///
/// The private Ed25519 key must remain inside OS-backed secure storage. Dart
/// receives signatures only; it never receives raw private-key material.
abstract interface class DeviceSessionProvider {
  Future<QoreDeviceSession?> readSession();

  Future<String> signBase64(List<int> canonicalMessage);

  Future<void> saveSession(QoreDeviceSession session);

  Future<void> clearSession();
}

/// Fail-closed placeholder until native device enrollment is wired.
class NoDeviceSessionProvider implements DeviceSessionProvider {
  const NoDeviceSessionProvider();

  @override
  Future<QoreDeviceSession?> readSession() async => null;

  @override
  Future<String> signBase64(List<int> canonicalMessage) {
    throw StateError('No enrolled device signer is available.');
  }

  @override
  Future<void> saveSession(QoreDeviceSession session) async {}

  @override
  Future<void> clearSession() async {}
}
