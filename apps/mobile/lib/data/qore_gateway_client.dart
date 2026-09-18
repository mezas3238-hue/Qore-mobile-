import 'dart:convert';
import 'dart:io';

import '../domain/models.dart';
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
    required this.accessTokenProvider,
    HttpClient? httpClient,
  }) : _httpClient = httpClient ?? HttpClient();

  final Uri baseUri;
  final AccessTokenProvider accessTokenProvider;
  final HttpClient _httpClient;

  Future<Object?> _getJson(String path) async {
    final token = await accessTokenProvider.readAccessToken();
    if (token == null || token.isEmpty) {
      throw const QoreSessionMissing();
    }

    final request = await _httpClient
        .getUrl(baseUri.resolve(path))
        .timeout(const Duration(seconds: 8));
    request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
    request.headers.set(HttpHeaders.acceptHeader, 'application/json');

    final response = await request.close().timeout(const Duration(seconds: 8));
    final body = await utf8.decoder.bind(response).join();

    if (response.statusCode == HttpStatus.unauthorized) {
      throw const QoreSessionMissing();
    }
    if (response.statusCode != HttpStatus.ok) {
      throw QoreGatewayException(
        'Gateway request failed',
        statusCode: response.statusCode,
      );
    }

    try {
      return jsonDecode(body);
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
