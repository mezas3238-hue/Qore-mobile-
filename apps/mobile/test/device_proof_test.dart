import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:qore_mobile/security/device_proof.dart';

void main() {
  test('canonical proof is deterministic and includes the empty-body hash', () {
    final message = canonicalDeviceProof(
      method: 'get',
      path: '/v1/accounts',
      timestamp: '2026-09-18T23:00:00.000Z',
      nonce: 'nonce-123',
    );

    expect(
      utf8.decode(message),
      'GET\n'
      '/v1/accounts\n'
      '2026-09-18T23:00:00.000Z\n'
      'nonce-123\n'
      'e3b0c44298fc1c149afbf4c8996fb924'
      '27ae41e4649b934ca495991b7852b855',
    );
  });

  test('secure nonces are non-empty and vary between calls', () {
    final first = secureNonce();
    final second = secureNonce();

    expect(first, isNotEmpty);
    expect(second, isNotEmpty);
    expect(first, isNot(second));
  });
}
