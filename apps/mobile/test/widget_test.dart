import 'package:flutter_test/flutter_test.dart';
import 'package:qore_mobile/main.dart';

void main() {
  testWidgets('starts disconnected and exposes main navigation', (tester) async {
    await tester.pumpWidget(const QoreMobileApp());

    expect(find.text('QORE Mobile'), findsOneWidget);
    expect(find.text('Sin conexión a Core'), findsOneWidget);
    expect(find.text('Sin conexión'), findsOneWidget);
    expect(find.text('Portfolio'), findsOneWidget);
    expect(find.text('Cuentas'), findsOneWidget);
    expect(find.text('Traders'), findsOneWidget);
    expect(find.text('Posiciones'), findsOneWidget);
    expect(find.text('Alertas'), findsOneWidget);
  });
}
