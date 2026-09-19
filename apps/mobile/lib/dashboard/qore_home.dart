import 'package:flutter/material.dart';

import 'dashboard_controller.dart';
import '../data/qore_gateway_client.dart';
import '../domain/models.dart';

class QoreHome extends StatefulWidget {
  const QoreHome({
    super.key,
    this.client,
    this.snapshotSink,
  });

  final QoreGatewayClient? client;
  final DashboardSnapshotSink? snapshotSink;

  @override
  State<QoreHome> createState() => _QoreHomeState();
}

class _QoreHomeState extends State<QoreHome> with WidgetsBindingObserver {
  late final DashboardController controller;
  int selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    controller = DashboardController(
      widget.client,
      snapshotSink: widget.snapshotSink,
    );
    controller.startAutoRefresh();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      controller.startAutoRefresh();
    } else {
      controller.stopAutoRefresh();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        return Scaffold(
          appBar: AppBar(
            title: const Text('QORE Mobile'),
            actions: [
              _ConnectionBadge(status: controller.status),
              IconButton(
                tooltip: 'Actualizar',
                onPressed: controller.canRefresh ? controller.refresh : null,
                icon: const Icon(Icons.refresh),
              ),
              const SizedBox(width: 8),
            ],
          ),
          body: SafeArea(
            child: _pageForIndex(
              selectedIndex,
              controller.status,
              controller.snapshot,
              controller.errorMessage,
            ),
          ),
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
                icon: Icon(Icons.show_chart),
                selectedIcon: Icon(Icons.show_chart),
                label: 'Posiciones',
              ),
              NavigationDestination(
                icon: Icon(Icons.notifications_none),
                selectedIcon: Icon(Icons.notifications),
                label: 'Alertas',
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _pageForIndex(
    int index,
    DashboardStatus status,
    DashboardSnapshot? snapshot,
    String? errorMessage,
  ) {
    if (status == DashboardStatus.disconnected) {
      return const _SafeStatePage(
        heading: 'Sin conexión a Core',
        description:
            'No existe una sesión autenticada con QORE Mobile Gateway. '
            'La aplicación no mostrará datos simulados como si fueran LIVE.',
        icon: Icons.cloud_off,
      );
    }

    if (status == DashboardStatus.loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (status == DashboardStatus.error || snapshot == null) {
      return _SafeStatePage(
        heading: 'Sincronización no disponible',
        description: errorMessage ??
            'No hay un snapshot autenticado disponible en este momento.',
        icon: Icons.warning_amber_outlined,
      );
    }

    return switch (index) {
      0 => _PortfolioPage(snapshot: snapshot),
      1 => _AccountsPage(
          accounts: snapshot.accounts,
          risks: snapshot.risks,
        ),
      2 => _TradersPage(
          traders: snapshot.traders,
          runtimes: snapshot.runtimes,
        ),
      3 => _PositionsPage(positions: snapshot.positions),
      _ => _AlertsPage(alerts: snapshot.alerts),
    };
  }
}

class _ConnectionBadge extends StatelessWidget {
  const _ConnectionBadge({required this.status});

  final DashboardStatus status;

  @override
  Widget build(BuildContext context) {
    final (label, icon) = switch (status) {
      DashboardStatus.ready => ('Conectado', Icons.cloud_done_outlined),
      DashboardStatus.loading => ('Sincronizando', Icons.sync),
      DashboardStatus.error => ('Error', Icons.cloud_off_outlined),
      DashboardStatus.disconnected => ('Sin conexión', Icons.cloud_off),
    };

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Chip(
        avatar: Icon(icon, size: 18),
        label: Text(label),
      ),
    );
  }
}

class _SafeStatePage extends StatelessWidget {
  const _SafeStatePage({
    required this.heading,
    required this.description,
    required this.icon,
  });

  final String heading;
  final String description;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(heading, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon),
                const SizedBox(width: 12),
                Expanded(child: Text(description)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _PortfolioPage extends StatelessWidget {
  const _PortfolioPage({required this.snapshot});

  final DashboardSnapshot snapshot;

  String _money(double? value) =>
      value == null ? '—' : value.toStringAsFixed(2);

  @override
  Widget build(BuildContext context) {
    final portfolio = snapshot.portfolio;
    final healthyRuntimes = snapshot.runtimes
        .where((runtime) => runtime.freshness == Freshness.live)
        .length;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('Portfolio', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 16),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            _MetricCard(label: 'Balance', value: _money(portfolio.balance)),
            _MetricCard(label: 'Equity', value: _money(portfolio.equity)),
            _MetricCard(
              label: 'P/L hoy',
              value: _money(portfolio.realizedPnlToday),
            ),
            _MetricCard(
              label: 'Flotante',
              value: _money(portfolio.floatingPnl),
            ),
            _MetricCard(
              label: 'Cuentas',
              value: '${portfolio.accountCount}',
            ),
            _MetricCard(
              label: 'Posiciones',
              value: '${portfolio.activePositions}',
            ),
            _MetricCard(
              label: 'Runtimes',
              value: '$healthyRuntimes/${snapshot.runtimes.length}',
            ),
          ],
        ),
        const SizedBox(height: 20),
        Text(
          'Actualizado: ${portfolio.asOf.toLocal().toIso8601String()}',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 160,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 8),
              Text(value, style: Theme.of(context).textTheme.titleLarge),
            ],
          ),
        ),
      ),
    );
  }
}

class _AccountsPage extends StatelessWidget {
  const _AccountsPage({
    required this.accounts,
    required this.risks,
  });

  final List<AccountSnapshot> accounts;
  final List<RiskSnapshot> risks;

  RiskSnapshot? _riskFor(String accountId) {
    for (final risk in risks) {
      if (risk.accountId == accountId) {
        return risk;
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    if (accounts.isEmpty) {
      return const _SafeStatePage(
        heading: 'Cuentas',
        description: 'El Gateway autenticado no reporta cuentas todavía.',
        icon: Icons.account_balance_wallet_outlined,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(20),
      itemCount: accounts.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final account = accounts[index];
        return Card(
          child: ListTile(
            onTap: () => _showAccountDetails(
              context,
              account,
              _riskFor(account.accountId),
            ),
            leading: const Icon(Icons.account_balance_wallet_outlined),
            title: Text(account.label),
            subtitle: Text(
              '${account.provider} · ${account.mode.name.toUpperCase()} · '
              '${account.freshness.name.toUpperCase()}',
            ),
            trailing: Text(
              account.equity == null
                  ? '—'
                  : account.equity!.toStringAsFixed(2),
            ),
          ),
        );
      },
    );
  }
}

class _TradersPage extends StatelessWidget {
  const _TradersPage({
    required this.traders,
    required this.runtimes,
  });

  final List<TraderSnapshot> traders;
  final List<RuntimeSnapshot> runtimes;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('Traders', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 12),
        for (final trader in traders)
          Card(
            child: ListTile(
              onTap: () => _showTraderDetails(context, trader),
              leading: const Icon(Icons.smart_toy_outlined),
              title: Text(trader.name),
              subtitle: Text(
                '${trader.market} · ${trader.state} · '
                '${trader.freshness.name.toUpperCase()}',
              ),
            ),
          ),
        const SizedBox(height: 20),
        Text('Runtimes', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        for (final runtime in runtimes)
          Card(
            child: ListTile(
              leading: Icon(
                runtime.reconciliationRequired
                    ? Icons.sync_problem
                    : Icons.dns_outlined,
              ),
              title: Text(runtime.runtimeId),
              subtitle: Text(
                '${runtime.freshness.name.toUpperCase()} · '
                'seq ${runtime.lastSequence ?? '—'}',
              ),
              trailing: runtime.reconciliationRequired
                  ? const Text('RECONCILIAR')
                  : null,
            ),
          ),
      ],
    );
  }
}


class _PositionsPage extends StatelessWidget {
  const _PositionsPage({required this.positions});

  final List<PositionSnapshot> positions;

  @override
  Widget build(BuildContext context) {
    if (positions.isEmpty) {
      return const _SafeStatePage(
        heading: 'Posiciones',
        description: 'No hay posiciones abiertas reportadas por el Gateway.',
        icon: Icons.show_chart,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(20),
      itemCount: positions.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final position = positions[index];
        final pnl = position.unrealizedPnl == null
            ? '—'
            : position.unrealizedPnl!.toStringAsFixed(2);
        return Card(
          child: ListTile(
            onTap: () => _showPositionDetails(context, position),
            leading: Icon(
              position.side.toLowerCase() == 'long'
                  ? Icons.trending_up
                  : Icons.trending_down,
            ),
            title: Text(
              '${position.symbol} · ${position.side.toUpperCase()}',
            ),
            subtitle: Text(
              '${position.traderId} · entrada '
              '${position.entry?.toStringAsFixed(5) ?? '—'}',
            ),
            trailing: Text(pnl),
          ),
        );
      },
    );
  }
}

class _AlertsPage extends StatelessWidget {
  const _AlertsPage({required this.alerts});

  final List<AlertSnapshot> alerts;

  IconData _icon(AlertSeverity severity) {
    return switch (severity) {
      AlertSeverity.critical => Icons.error_outline,
      AlertSeverity.warning => Icons.warning_amber_outlined,
      AlertSeverity.info => Icons.info_outline,
      AlertSeverity.unknown => Icons.help_outline,
    };
  }

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) {
      return const _SafeStatePage(
        heading: 'Alertas',
        description: 'No hay alertas activas ni eventos operativos recientes.',
        icon: Icons.notifications_none,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(20),
      itemCount: alerts.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final alert = alerts[index];
        return Card(
          child: ListTile(
            leading: Icon(_icon(alert.severity)),
            title: Text(alert.title),
            subtitle: Text(
              '${alert.detail}\n'
              '${alert.source} · '
              '${alert.raisedAt.toLocal().toIso8601String()}',
            ),
            isThreeLine: true,
          ),
        );
      },
    );
  }
}


String _detailNumber(double? value, {int decimals = 2}) {
  return value == null ? '—' : value.toStringAsFixed(decimals);
}

String _detailTime(DateTime? value) {
  return value == null ? '—' : value.toLocal().toIso8601String();
}

void _showDetailSheet(
  BuildContext context, {
  required String title,
  required List<(String, String)> rows,
}) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (context) {
      return SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          children: [
            Text(title, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 12),
            for (final row in rows)
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(row.$1),
                trailing: SizedBox(
                  width: 180,
                  child: Text(
                    row.$2,
                    textAlign: TextAlign.end,
                  ),
                ),
              ),
          ],
        ),
      );
    },
  );
}

void _showAccountDetails(
  BuildContext context,
  AccountSnapshot account,
  RiskSnapshot? risk,
) {
  _showDetailSheet(
    context,
    title: account.label,
    rows: [
      ('Provider', account.provider),
      ('Modo', account.mode.name.toUpperCase()),
      ('Freshness', account.freshness.name.toUpperCase()),
      ('Balance', _detailNumber(account.balance)),
      ('Equity', _detailNumber(account.equity)),
      ('P/L hoy', _detailNumber(account.realizedPnlToday)),
      ('P/L flotante', _detailNumber(account.floatingPnl)),
      (
        'DD diario',
        account.dailyDrawdownFraction == null
            ? '—'
            : '${(account.dailyDrawdownFraction! * 100).toStringAsFixed(2)}%',
      ),
      (
        'DD total',
        account.totalDrawdownFraction == null
            ? '—'
            : '${(account.totalDrawdownFraction! * 100).toStringAsFixed(2)}%',
      ),
      ('Posiciones', '${account.openPositions}'),
      ('Runtime', account.runtimeId),
      ('Heartbeat', _detailTime(account.lastHeartbeat)),
      ('QORE Risk', risk?.state ?? '—'),
      (
        'Open risk',
        risk?.openRiskFraction == null
            ? '—'
            : '${(risk!.openRiskFraction! * 100).toStringAsFixed(2)}%',
      ),
      (
        'Riesgo diario restante',
        risk?.dailyLossRemainingFraction == null
            ? '—'
            : '${(risk!.dailyLossRemainingFraction! * 100).toStringAsFixed(2)}%',
      ),
      (
        'Riesgo total restante',
        risk?.totalLossRemainingFraction == null
            ? '—'
            : '${(risk!.totalLossRemainingFraction! * 100).toStringAsFixed(2)}%',
      ),
      ('Fuente riesgo', risk?.source ?? '—'),
      ('Actualizado', _detailTime(account.asOf)),
    ],
  );
}

void _showTraderDetails(BuildContext context, TraderSnapshot trader) {
  _showDetailSheet(
    context,
    title: trader.name,
    rows: [
      ('Mercado', trader.market),
      ('Cuenta', trader.accountId),
      ('Modo', trader.mode.name.toUpperCase()),
      ('Estado', trader.state),
      ('Freshness', trader.freshness.name.toUpperCase()),
      ('Última lectura', _detailTime(trader.lastMarketRead)),
      ('Última señal/abstención', _detailTime(trader.lastSignalOrAbstention)),
      ('Actualizado', _detailTime(trader.asOf)),
    ],
  );
}

void _showPositionDetails(BuildContext context, PositionSnapshot position) {
  _showDetailSheet(
    context,
    title: '${position.symbol} · ${position.side.toUpperCase()}',
    rows: [
      ('Trader', position.traderId),
      ('Cuenta', position.accountId),
      ('Entrada', _detailNumber(position.entry, decimals: 5)),
      ('Precio actual', _detailNumber(position.currentPrice, decimals: 5)),
      ('Stop', _detailNumber(position.stop, decimals: 5)),
      ('Target', _detailNumber(position.target, decimals: 5)),
      ('Tamaño', _detailNumber(position.size)),
      ('P/L flotante', _detailNumber(position.unrealizedPnl)),
      ('R', _detailNumber(position.rState)),
      ('Apertura', _detailTime(position.openedAt)),
      ('Actualizado', _detailTime(position.asOf)),
    ],
  );
}

