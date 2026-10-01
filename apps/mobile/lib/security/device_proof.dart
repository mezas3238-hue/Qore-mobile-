import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';

String secureNonce({int byteLength = 24}) {
  final random = Random.secure();
  final bytes = List<int>.generate(
    byteLength,
    (_) => random.nextInt(256),
    growable: false,
  );
  return base64UrlEncode(bytes).replaceAll('=', '');
}

List<int> canonicalDeviceProof({
  required String method,
  required String path,
  required String timestamp,
  required String nonce,
  List<int> body = const [],
}) {
  final bodyHash = sha256.convert(body).toString();
  return utf8.encode(
    '${method.toUpperCase()}\n'
    '$path\n'
    '$timestamp\n'
    '$nonce\n'
    '$bodyHash',
  );
}
