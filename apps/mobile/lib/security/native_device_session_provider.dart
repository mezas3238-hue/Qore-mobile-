import 'dart:convert';

import 'package:flutter/services.dart';

import 'session.dart';

class NativeDeviceSessionProvider implements DeviceSessionProvider {
  NativeDeviceSessionProvider({
    MethodChannel? channel,
  }) : _channel = channel ?? const MethodChannel('qore.mobile/security');

  final MethodChannel _channel;

  @override
  Future<DeviceSecurityCapabilities> securityCapabilities() async {
    final raw = await _channel.invokeMapMethod<String, Object?>(
      'securityCapabilities',
    );
    if (raw == null) {
      throw StateError('Native security capabilities are unavailable.');
    }
    return DeviceSecurityCapabilities.fromJson(
      Map<String, Object?>.from(raw),
    );
  }

  @override
  Future<QoreDeviceSession?> readSession() async {
    final raw = await _channel.invokeMapMethod<String, Object?>('readSession');
    if (raw == null || raw.isEmpty) {
      return null;
    }
    return QoreDeviceSession.fromJson(Map<String, Object?>.from(raw));
  }

  @override
  Future<String> signBase64(List<int> canonicalMessage) async {
    final signature = await _channel.invokeMethod<String>(
      'sign',
      {'message_b64': base64Encode(canonicalMessage)},
    );
    if (signature == null || signature.isEmpty) {
      throw StateError('Native signer returned no signature.');
    }
    return signature;
  }

  @override
  Future<void> saveSession(QoreDeviceSession session) {
    return _channel.invokeMethod<void>('saveSession', {
      'device_id': session.deviceId,
      'access_token': session.accessToken,
      'access_expires_at': session.accessExpiresAt.toIso8601String(),
      'refresh_token': session.refreshToken,
      'refresh_expires_at': session.refreshExpiresAt.toIso8601String(),
    });
  }

  @override
  Future<void> clearSession() {
    return _channel.invokeMethod<void>('clearSession');
  }

  @override
  Future<DeviceEnrollmentIdentity> ensureEnrollmentIdentity() async {
    final raw = await _channel.invokeMapMethod<String, Object?>(
      'ensureEnrollmentIdentity',
    );
    if (raw == null) {
      throw StateError('Native enrollment identity is unavailable.');
    }
    final map = Map<String, Object?>.from(raw);

    String requiredString(String key) {
      final value = map[key];
      if (value is! String || value.isEmpty) {
        throw StateError('Native identity is missing $key.');
      }
      return value;
    }

    return DeviceEnrollmentIdentity(
      deviceId: requiredString('device_id'),
      platform: requiredString('platform'),
      publicKeyB64: requiredString('public_key_b64'),
      keyAlgorithm: requiredString('key_algorithm'),
    );
  }

  @override
  Future<bool> authenticateOwner({required String reason}) async {
    return await _channel.invokeMethod<bool>(
          'authenticateOwner',
          {'reason': reason},
        ) ??
        false;
  }

  @override
  Future<void> publishWidgetSnapshot(Map<String, Object?> snapshot) {
    return _channel.invokeMethod<void>(
      'publishWidgetSnapshot',
      {'snapshot_json': jsonEncode(snapshot)},
    );
  }

  Future<void> publishWidgetPreferences(Map<String, Object?> preferences) {
    return _channel.invokeMethod<void>(
      'publishWidgetPreferences',
      {'appearance_json': jsonEncode(preferences)},
    );
  }
}
