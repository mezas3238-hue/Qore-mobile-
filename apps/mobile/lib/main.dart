import 'package:flutter/material.dart';

import 'appearance/appearance_controller.dart';
import 'bootstrap/qore_bootstrap.dart';
import 'dashboard/dashboard_controller.dart';
import 'dashboard/qore_home.dart';
import 'data/qore_gateway_client.dart';

void main() {
  runApp(const QoreMobileApp.production());
}

class QoreMobileApp extends StatefulWidget {
  const QoreMobileApp({
    super.key,
    this.client,
    this.snapshotSink,
  }) : production = false;

  const QoreMobileApp.production({super.key})
      : client = null,
        snapshotSink = null,
        production = true;

  final QoreGatewayClient? client;
  final DashboardSnapshotSink? snapshotSink;
  final bool production;

  @override
  State<QoreMobileApp> createState() => _QoreMobileAppState();
}

class _QoreMobileAppState extends State<QoreMobileApp> {
  final AppearanceController appearance = AppearanceController.instance;

  @override
  void initState() {
    super.initState();
    appearance.load();
  }

  ThemeData _theme(Brightness brightness) {
    final base = ThemeData(
      brightness: brightness,
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: appearance.accentColor,
        brightness: brightness,
      ),
      visualDensity: appearance.visualDensity,
    );
    return base.copyWith(
      textTheme: base.textTheme.apply(fontSizeFactor: appearance.textScale),
      cardTheme: CardThemeData(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(appearance.radius),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: appearance,
      builder: (context, _) {
        return MaterialApp(
          title: 'QORE Mobile',
          debugShowCheckedModeBanner: false,
          themeMode: appearance.themeMode,
          theme: _theme(Brightness.light),
          darkTheme: _theme(Brightness.dark),
          home: widget.production
              ? QoreBootstrap(appearanceController: appearance)
              : QoreHome(
                  client: widget.client,
                  snapshotSink: widget.snapshotSink,
                  appearanceController: appearance,
                ),
        );
      },
    );
  }
}
