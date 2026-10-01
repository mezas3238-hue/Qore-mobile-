import 'dart:convert';
import 'dart:io';

import 'device_proof.dart';
import 'session.dart';

class DeviceRecoveryNotEnrolled implements Exception {
  const DeviceRecoveryNotEnrolled();
}

class DeviceRecoveryUnavailable implements Exception {
  const DeviceRecoveryUnavailable(this.message, {this.statusCode});

  final String message;
  final int? statusCode;
}

class DeviceSessionRecoveryService {
  DeviceSessionRecoveryService({
    required this.baseUri,
    required this.sessionProvider,
    HttpClient? httpClient,
  })  : _httpClient = httpClient ?? HttpClient(),
        _ownsClient = httpClient == null;

  final Uri baseUri;
  final DeviceSessionProvider sessionProvider;
  final HttpClient _httpClient;
  final bool _ownsClient;

  Future<QoreDeviceSession> recover() async {
    final identity = await sessionProvider.ensureEnrollmentIdentity();
    const path = '/v1/mobile/recover';
    final timestamp = DateTime.now().toUtc().toIso8601String();
    final nonce = secureNonce();
    final signature = await sessionProvider.signBase64(
      canonicalDeviceProof(
        method: 'POST',
        path: path,
        timestamp: timestamp,
        nonce: nonce,
      ),
    );

    HttpClientRequest request;
    try {
      request = await _httpClient
          .postUrl(baseUri.resolve(path))
          .timeout(const Duration(seconds: 8));
    } on Exception {
      throw const DeviceRecoveryUnavailable(
        'No se pudo contactar QORE Mobile Gateway.',
      );
    }
    request.headers.set(HttpHeaders.acceptHeader, 'application/json');
    request.headers.set('X-Qore-Device-Id', identity.deviceId);
    request.headers.set('X-Qore-Device-Time', timestamp);
    request.headers.set('X-Qore-Device-Nonce', nonce);
    request.headers.set('X-Qore-Device-Signature', signature);

    HttpClientResponse response;
    try {
      response = await request.close().timeout(const Duration(seconds: 8));
    } on Exception {
      throw const DeviceRecoveryUnavailable(
        'QORE Mobile Gateway no respondió a tiempo.',
      );
    }
    final body = await utf8.decoder.bind(response).join();

    if (response.statusCode == HttpStatus.unauthorized ||
        response.statusCode == HttpStatus.notFound) {
      throw const DeviceRecoveryNotEnrolled();
    }
    if (response.statusCode != HttpStatus.ok) {
      throw DeviceRecoveryUnavailable(
        'No se pudo recuperar la sesión del dispositivo.',
        statusCode: response.statusCode,
      );
    }

    final decoded = jsonDecode(body);
    if (decoded is! Map) {
      throw const DeviceRecoveryUnavailable(
        'El Gateway devolvió una sesión inválida.',
      );
    }
    final session = QoreDeviceSession.fromJson(
      decoded.map((key, value) => MapEntry(key.toString(), value)),
    );
    if (session.deviceId != identity.deviceId) {
      throw const DeviceRecoveryUnavailable(
        'La sesión recuperada no corresponde a este dispositivo.',
      );
    }
    await sessionProvider.saveSession(session);
    return session;
  }

  void close() {
    if (_ownsClient) {
      _httpClient.close(force: true);
    }
  }
}
