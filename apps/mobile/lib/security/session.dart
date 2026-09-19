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
/// The private production signing key must remain inside OS-backed secure storage. Dart
/// receives signatures only; it never receives raw private-key material.
class DeviceEnrollmentIdentity {
  const DeviceEnrollmentIdentity({
    required this.deviceId,
    required this.platform,
    required this.publicKeyB64,
    required this.keyAlgorithm,
  });

  final String deviceId;
  final String platform;
  final String publicKeyB64;
  final String keyAlgorithm;
}

class DeviceSecurityCapabilities {
  const DeviceSecurityCapabilities({
    required this.strongBiometricAvailable,
    required this.deviceCredentialAvailable,
    required this.secureStoreAvailable,
    required this.secureHardwareAvailable,
    required this.secureStore,
    required this.biometricKind,
  });

  final bool strongBiometricAvailable;
  final bool deviceCredentialAvailable;
  final bool secureStoreAvailable;
  final bool secureHardwareAvailable;
  final String secureStore;
  final String biometricKind;

  bool get ownerAuthenticationAvailable =>
      strongBiometricAvailable || deviceCredentialAvailable;

  factory DeviceSecurityCapabilities.fromJson(Map<String, Object?> json) {
    bool requiredBool(String key) {
      final value = json[key];
      if (value is! bool) {
        throw FormatException('Missing or invalid $key');
      }
      return value;
    }

    String requiredString(String key) {
      final value = json[key];
      if (value is! String || value.isEmpty) {
        throw FormatException('Missing or invalid $key');
      }
      return value;
    }

    return DeviceSecurityCapabilities(
      strongBiometricAvailable: requiredBool('biometric_strong_available'),
      deviceCredentialAvailable: requiredBool('device_credential_available'),
      secureStoreAvailable: requiredBool('secure_store_available'),
      secureHardwareAvailable: requiredBool('secure_hardware_available'),
      secureStore: requiredString('secure_store'),
      biometricKind: requiredString('biometric_kind'),
    );
  }
}

abstract interface class DeviceSessionProvider {
  Future<DeviceSecurityCapabilities> securityCapabilities();

  Future<QoreDeviceSession?> readSession();

  Future<String> signBase64(List<int> canonicalMessage);

  Future<void> saveSession(QoreDeviceSession session);

  Future<void> clearSession();

  Future<DeviceEnrollmentIdentity> ensureEnrollmentIdentity();

  Future<bool> authenticateOwner({required String reason});

  Future<void> publishWidgetSnapshot(Map<String, Object?> snapshot);
}

/// Fail-closed placeholder until native device enrollment is wired.
class NoDeviceSessionProvider implements DeviceSessionProvider {
  const NoDeviceSessionProvider();

  @override
  Future<DeviceSecurityCapabilities> securityCapabilities() async =>
      const DeviceSecurityCapabilities(
        strongBiometricAvailable: false,
        deviceCredentialAvailable: false,
        secureStoreAvailable: false,
        secureHardwareAvailable: false,
        secureStore: 'unavailable',
        biometricKind: 'none',
      );

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

  @override
  Future<DeviceEnrollmentIdentity> ensureEnrollmentIdentity() {
    throw StateError('No native device identity is available.');
  }

  @override
  Future<bool> authenticateOwner({required String reason}) async => false;

  @override
  Future<void> publishWidgetSnapshot(Map<String, Object?> snapshot) async {}
}
