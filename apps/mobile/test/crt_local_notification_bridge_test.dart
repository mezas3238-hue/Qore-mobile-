import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qore_mobile/security/native_device_session_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('qore.mobile/security');

  test('local QA notification is one explicit native action, not FCM', () async {
    final calls = <MethodCall>[];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (message) async {
      calls.add(message);
      if (message.method == 'showCrtQaLocalTestNotification') return true;
      throw PlatformException(code: 'UNEXPECTED_CALL');
    });
    addTearDown(() => TestDefaultBinaryMessengerBinding
        .instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null));

    final provider = NativeDeviceSessionProvider();
    expect(await provider.showCrtQaLocalTestNotification(), isTrue);
    expect(calls, hasLength(1));
    expect(calls.single.method, 'showCrtQaLocalTestNotification');
    expect(calls.single.arguments, isNull);
  });

  test('denied Android notification permission is not success', () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (message) async => false);
    addTearDown(() => TestDefaultBinaryMessengerBinding
        .instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null));
    expect(await NativeDeviceSessionProvider()
        .showCrtQaLocalTestNotification(), isFalse);
  });
}
