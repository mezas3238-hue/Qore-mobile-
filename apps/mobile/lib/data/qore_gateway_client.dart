import 'dart:convert';
import 'dart:io';

import '../domain/models.dart';
import '../security/device_proof.dart';
import '../security/session.dart';

class QoreGatewayException implements Exception {
  const QoreGatewayException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => 'QoreGatewayException($statusCode): $message';
}

class QoreSessionMissing implements Exception {
  const QoreSessionMissing();
}

abstract interface class QoreGatewayClient {
  Future<DashboardSnapshot> fetchDashboard();
}

class HttpQoreGatewayClient implements QoreGatewayClient {
  HttpQoreGatewayClient({
    required this.baseUri,
    required this.sessionProvider,
    HttpClient? httpClient,
  }) : _httpClient = httpClient ?? HttpClient();

  final Uri baseUri;
  final DeviceSessionProvider sessionProvider;
  final HttpClient _httpClient;

  Future<QoreDeviceSession?>? _refreshInFlight;

  Future<Map<String, String>> _proofHeaders({
    required QoreDeviceSession session,
    required String token,
    required String method,
    required String path,
    List<int> body = const [],
  }) async {
    final timestamp = DateTime.now().toUtc().toIso8601String();
    final nonce = secureNonce();
    final signature = await sessionProvider.signBase64(
      canonicalDeviceProof(
        method: method,
        path: path,
        timestamp: timestamp,
        nonce: nonce,
        body: body,
      ),
    );

    return {
      HttpHeaders.authorizationHeader: 'Bearer $token',
      HttpHeaders.acceptHeader: 'application/json',
      'X-Qore-Device-Id': session.deviceId,
      'X-Qore-Device-Time': timestamp,
      'X-Qore-Device-Nonce': nonce,
      'X-Qore-Device-Signature': signature,
    };
  }

  Future<QoreDeviceSession> _refreshSession(
    QoreDeviceSession session,
  ) async {
    final active = _refreshInFlight;
    if (active != null) {
      final result = await active;
      if (result == null) {
        throw const QoreSessionMissing();
      }
      return result;
    }

    final future = _performRefresh(session);
    _refreshInFlight = future;
    try {
      final refreshed = await future;
      if (refreshed == null) {
        throw const QoreSessionMissing();
      }
      return refreshed;
    } finally {
      _refreshInFlight = null;
    }
  }

  Future<QoreDeviceSession?> _performRefresh(
    QoreDeviceSession session,
  ) async {
    const path = '/v1/mobile/refresh';
    final headers = await _proofHeaders(
      session: session,
      token: session.refreshToken,
      method: 'POST',
      path: path,
    );

    final request = await _httpClient
        .postUrl(baseUri.resolve(path))
        .timeout(const Duration(seconds: 8));
    headers.forEach(request.headers.set);

    final response = await request.close().timeout(const Duration(seconds: 8));
    final body = await utf8.decoder.bind(response).join();

    if (response.statusCode == HttpStatus.unauthorized) {
      await sessionProvider.clearSession();
      return null;
    }
    if (response.statusCode != HttpStatus.ok) {
      throw QoreGatewayException(
        'Gateway session refresh failed',
        statusCode: response.statusCode,
      );
    }

    final decoded = jsonDecode(body);
    if (decoded is! Map) {
      throw const QoreGatewayException(
        'Gateway returned an invalid session response',
      );
    }

    final refreshed = QoreDeviceSession.fromJson(
      decoded.map((key, value) => MapEntry(key.toString(), value)),
    );
    await sessionProvider.saveSession(refreshed);
    return refreshed;
  }

  Future<QoreDeviceSession> _usableSession() async {
    var session = await sessionProvider.readSession();
    if (session == null) {
      throw const QoreSessionMissing();
    }

    final refreshBefore = DateTime.now().toUtc().add(
          const Duration(seconds: 30),
        );
    if (!session.accessExpiresAt.isAfter(refreshBefore)) {
      session = await _refreshSession(session);
    }

    return session;
  }

  Future<Object?> _getJson(
    String path, {
    bool allowRefreshRetry = true,
  }) async {
    var session = await _usableSession();
    var headers = await _proofHeaders(
      session: session,
      token: session.accessToken,
      method: 'GET',
      path: path,
    );

    var request = await _httpClient
        .getUrl(baseUri.resolve(path))
        .timeout(const Duration(seconds: 8));
    headers.forEach(request.headers.set);

    var response = await request.close().timeout(const Duration(seconds: 8));
    var responseBody = await utf8.decoder.bind(response).join();

    if (response.statusCode == HttpStatus.unauthorized && allowRefreshRetry) {
      session = await _refreshSession(session);
      headers = await _proofHeaders(
        session: session,
        token: session.accessToken,
        method: 'GET',
        path: path,
      );
      request = await _httpClient
          .getUrl(baseUri.resolve(path))
          .timeout(const Duration(seconds: 8));
      headers.forEach(request.headers.set);
      response = await request.close().timeout(const Duration(seconds: 8));
      responseBody = await utf8.decoder.bind(response).join();
    }

    if (response.statusCode == HttpStatus.unauthorized) {
      await sessionProvider.clearSession();
      throw const QoreSessionMissing();
    }
    if (response.statusCode != HttpStatus.ok) {
      throw QoreGatewayException(
        'Gateway request failed',
        statusCode: response.statusCode,
      );
    }

    try {
      return jsonDecode(responseBody);
    } on FormatException {
      throw const QoreGatewayException('Gateway returned invalid JSON');
    }
  }

  Map<String, Object?> _map(Object? value) {
    if (value is! Map) {
      throw const QoreGatewayException('Expected a JSON object');
    }
    return value.map(
      (key, item) => MapEntry(key.toString(), item),
    );
  }

  List<Map<String, Object?>> _list(Object? value) {
    if (value is! List) {
      throw const QoreGatewayException('Expected a JSON array');
    }
    return value.map(_map).toList(growable: false);
  }

  @override
  Future<DashboardSnapshot> fetchDashboard() async {
    final results = await Future.wait<Object?>([
      _getJson('/v1/portfolio'),
      _getJson('/v1/accounts'),
      _getJson('/v1/traders'),
      _getJson('/v1/positions'),
      _getJson('/v1/runtimes'),
    ]);

    return DashboardSnapshot(
      portfolio: PortfolioSnapshot.fromJson(_map(results[0])),
      accounts:
          _list(results[1]).map(AccountSnapshot.fromJson).toList(growable: false),
      traders:
          _list(results[2]).map(TraderSnapshot.fromJson).toList(growable: false),
      positions: _list(results[3])
          .map(PositionSnapshot.fromJson)
          .toList(growable: false),
      runtimes:
          _list(results[4]).map(RuntimeSnapshot.fromJson).toList(growable: false),
    );
  }

  void close() {
    _httpClient.close(force: true);
  }
}
