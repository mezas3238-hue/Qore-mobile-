import 'dart:convert';
import 'dart:io';

import 'session.dart';

class EnrollmentException implements Exception {
  const EnrollmentException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;
}

class EnrollmentService {
  EnrollmentService({
    required this.baseUri,
    required this.sessionProvider,
    HttpClient? httpClient,
  }) : _httpClient = httpClient ?? HttpClient();

  final Uri baseUri;
  final DeviceSessionProvider sessionProvider;
  final HttpClient _httpClient;

  Future<QoreDeviceSession> enroll({
    required String enrollmentCode,
    required String label,
  }) async {
    final code = enrollmentCode.trim();
    final deviceLabel = label.trim();
    if (code.isEmpty || deviceLabel.isEmpty) {
      throw const EnrollmentException(
        'Código y nombre del dispositivo son obligatorios.',
      );
    }

    final identity = await sessionProvider.ensureEnrollmentIdentity();
    final body = utf8.encode(jsonEncode({
      'device_id': identity.deviceId,
      'platform': identity.platform,
      'label': deviceLabel,
      'public_key_b64': identity.publicKeyB64,
      'key_algorithm': identity.keyAlgorithm,
    }));

    final request = await _httpClient
        .postUrl(baseUri.resolve('/v1/mobile/enroll'))
        .timeout(const Duration(seconds: 10));
    request.headers.set(HttpHeaders.contentTypeHeader, 'application/json');
    request.headers.set('X-Qore-Enrollment-Code', code);
    request.contentLength = body.length;
    request.add(body);

    final response = await request.close().timeout(const Duration(seconds: 10));
    final responseBody = await utf8.decoder.bind(response).join();

    if (response.statusCode != HttpStatus.created) {
      throw EnrollmentException(
        response.statusCode == HttpStatus.unauthorized
            ? 'El código de enrolamiento no es válido o ya fue utilizado.'
            : 'No se pudo enrolar este dispositivo.',
        statusCode: response.statusCode,
      );
    }

    final decoded = jsonDecode(responseBody);
    if (decoded is! Map) {
      throw const EnrollmentException(
        'El Gateway devolvió una sesión inválida.',
      );
    }
    final session = QoreDeviceSession.fromJson(
      decoded.map((key, value) => MapEntry(key.toString(), value)),
    );
    await sessionProvider.saveSession(session);
    return session;
  }

  void close() {
    _httpClient.close(force: true);
  }
}
