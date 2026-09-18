import 'package:flutter/material.dart';

void main() {
  runApp(const QoreMobileApp());
}

class QoreMobileApp extends StatelessWidget {
  const QoreMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'QORE Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF4F46E5)),
        useMaterial3: true,
      ),
      home: const QoreHome(),
    );
  }
}

class QoreHome extends StatefulWidget {
  const QoreHome({super.key});

  @override
  State<QoreHome> createState() => _QoreHomeState();
}

class _QoreHomeState extends State<QoreHome> {
  int selectedIndex = 0;

  static const pages = <Widget>[
    _StatusPage(
      heading: 'Portfolio',
      description: 'Resumen agregado de todas las cuentas QORE autorizadas.',
    ),
    _StatusPage(
      heading: 'Cuentas',
      description: 'Balance, equity, drawdown y estado por cuenta.',
    ),
    _StatusPage(
      heading: 'Traders',
      description: 'Estado, heartbeat, mercado y posiciones por trader.',
    ),
    _StatusPage(
      heading: 'Alertas',
      description: 'Eventos operativos, riesgo y conectividad.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('QORE Mobile'),
        actions: const [
          Padding(
            padding: EdgeInsets.only(right: 16),
            child: Center(child: _ConnectionBadge()),
          ),
        ],
      ),
      body: SafeArea(child: pages[selectedIndex]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIndex,
        onDestinationSelected: (index) {
          setState(() => selectedIndex = index);
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Portfolio',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_balance_wallet_outlined),
            selectedIcon: Icon(Icons.account_balance_wallet),
            label: 'Cuentas',
          ),
          NavigationDestination(
            icon: Icon(Icons.smart_toy_outlined),
            selectedIcon: Icon(Icons.smart_toy),
            label: 'Traders',
          ),
          NavigationDestination(
            icon: Icon(Icons.notifications_none),
            selectedIcon: Icon(Icons.notifications),
            label: 'Alertas',
          ),
        ],
      ),
    );
  }
}

class _ConnectionBadge extends StatelessWidget {
  const _ConnectionBadge();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Estado de conexión: sin conexión a Core',
      child: Chip(
        avatar: const Icon(Icons.cloud_off, size: 18),
        label: const Text('Sin conexión a Core'),
      ),
    );
  }
}

class _StatusPage extends StatelessWidget {
  const _StatusPage({
    required this.heading,
    required this.description,
  });

  final String heading;
  final String description;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          heading,
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 8),
        Text(description),
        const SizedBox(height: 24),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.shield_outlined),
                    SizedBox(width: 8),
                    Text(
                      'Estado seguro',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'Todavía no hay una sesión autenticada con QORE Mobile Gateway. '
                  'La aplicación no mostrará datos simulados como si fueran datos LIVE.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
