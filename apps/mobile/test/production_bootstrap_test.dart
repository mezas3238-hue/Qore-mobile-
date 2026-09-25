import 'package:flutter_test/flutter_test.dart';
import 'package:qore_mobile/main.dart';

void main() {
  testWidgets('production build fails closed without HTTPS gateway config',
      (tester) async {
    await tester.pumpWidget(const QoreMobileApp.production());
    await tester.pumpAndSettle();

    expect(find.text('Gateway no configurado'), findsOneWidget);
    expect(
      find.textContaining('QORE_GATEWAY_URL'),
      findsOneWidget,
    );
  });
}
