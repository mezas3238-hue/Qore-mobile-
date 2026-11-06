import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qore_mobile/security/native_device_session_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('qore.mobile/security');

  test('CRT channel settings opens only on explicit user action', () async {
    final calls = <MethodCall>[];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (message) async {
      calls.add(message);
      if (message.method == 'openCrtQaNotificationSettings') return true;
      throw PlatformException(code: 'UNEXPECTED_CALL');
    });
    addTearDown(() => TestDefaultBinaryMessengerBinding
        .instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null));

    final provider = NativeDeviceSessionProvider();
    expect(await provider.openCrtQaNotificationSettings(), isTrue);
    expect(calls, hasLength(1));
    expect(calls.single.arguments, isNull);
  });

  test('CRT notification settings unsupported fails closed', () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (message) async {
      expect(message.method, 'openCrtQaNotificationSettings');
      return null;
    });
    addTearDown(() => TestDefaultBinaryMessengerBinding
        .instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null));
    expect(await NativeDeviceSessionProvider().openCrtQaNotificationSettings(),
        isFalse);
  });

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

  test('null Android bridge reply fails closed without enabling QA', () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (message) async {
      expect(message.method, 'showCrtQaLocalTestNotification');
      return null;
    });
    addTearDown(() => TestDefaultBinaryMessengerBinding
        .instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null));
    expect(await NativeDeviceSessionProvider()
        .showCrtQaLocalTestNotification(), isFalse);
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
