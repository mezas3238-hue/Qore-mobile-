import 'package:flutter/material.dart';

import 'bootstrap/qore_bootstrap.dart';
import 'dashboard/dashboard_controller.dart';
import 'dashboard/qore_home.dart';
import 'data/qore_gateway_client.dart';

void main() {
  runApp(const QoreMobileApp.production());
}

class QoreMobileApp extends StatelessWidget {
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
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'QORE Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF4F46E5),
        ),
        useMaterial3: true,
      ),
      home: production
          ? const QoreBootstrap()
          : QoreHome(
              client: client,
              snapshotSink: snapshotSink,
            ),
    );
  }
}
