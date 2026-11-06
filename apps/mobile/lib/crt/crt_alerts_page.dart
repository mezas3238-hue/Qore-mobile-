import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/qore_gateway_client.dart';
import 'crt_qa_contract.dart';
import 'crt_demo_probe_status.dart';

/// QORE CRT is a section of the EXISTING QORE Mobile Alerts screen.
/// This module never trades, subscribes to market push or self-certifies signals.
class QoreAlertsHub extends StatefulWidget {
  const QoreAlertsHub({
    super.key,
    required this.operationalAlerts,
    this.crtClient,
  });

  final Widget operationalAlerts;
  final QoreCrtQaClient? crtClient;

  @override
  State<QoreAlertsHub> createState() => _QoreAlertsHubState();
}

class _QoreAlertsHubState extends State<QoreAlertsHub> {
  bool crtSelected = false;

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 2),
        child: SegmentedButton<bool>(
          segments: const [
            ButtonSegment<bool>(
              value: false,
              label: Text('Operativas'),
              icon: Icon(Icons.monitor_heart_outlined),
            ),
            ButtonSegment<bool>(
              value: true,
              label: Text('CRT Alerts'),
              icon: Icon(Icons.notifications_active_outlined),
            ),
          ],
          selected: {crtSelected},
          onSelectionChanged: (v) => setState(() => crtSelected = v.first),
        ),
      ),
      Expanded(child: crtSelected
        ? QoreCrtQaPanel(client: widget.crtClient)
        : widget.operationalAlerts),
    ]);
  }
}

class QoreCrtQaPanel extends StatefulWidget {
  const QoreCrtQaPanel({super.key, this.client});
  final QoreCrtQaClient? client;

  @override
  State<QoreCrtQaPanel> createState() => _QoreCrtQaPanelState();
}

class _QoreCrtQaPanelState extends State<QoreCrtQaPanel>
    with WidgetsBindingObserver {
  static const _symbolsKey = 'qore_crt_selected_markets_v1';

  QoreCrtQaInbox? inbox;
  QoreCrtDemoProbeStatus? demoProbe;
  String? message;
  DateTime? lastGatewayReadAt;
  bool fetching = false;
  bool showSymbols = false;
  bool allSymbols = true;
  Set<String> selected = {};
  Timer? refreshTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _restoreSelection();
    _refresh();
    _startPeriodicRefresh();
  }

  Future<void> _restoreSelection() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getStringList(_symbolsKey);
    if (!mounted || saved == null) return;
    final valid = saved.where(qoreCrtMarkets.contains).toSet();
    setState(() {
      allSymbols = valid.isEmpty;
      selected = valid;
    });
  }

  Future<void> _persistSelection() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_symbolsKey, allSymbols
      ? <String>[]
      : selected.where(qoreCrtMarkets.contains).toList());
  }

  void _startPeriodicRefresh() {
    refreshTimer?.cancel();
    if (widget.client != null) {
      refreshTimer = Timer.periodic(
        const Duration(seconds: 30), (_) => _refresh(silent: true));
    }
  }

  Future<void> _refresh({bool silent = false}) async {
    final client = widget.client;
    if (client == null) {
      if (mounted) {
        setState(() {
          inbox = null;
          demoProbe = null;
          lastGatewayReadAt = null;
          message = 'Gateway CRT no configurado. Sin señales certificadas.';
        });
      }
      return;
    }
    if (fetching) { return; }
    fetching = true;
    if (!silent && mounted) setState(() => message = null);
    try {
      final fresh = await client.fetchCrtQaInbox();
      // Authenticated IC Markets DEMO status is diagnostic, NEVER a CRT alert.
      QoreCrtDemoProbeStatus? health;
      if (client is QoreCrtDemoProbeClient) {
        try {
          health = await (client as QoreCrtDemoProbeClient).fetchCrtDemoProbeStatus();
        } catch (_) {
          health = null; // Fail closed, no stale connection claims.
        }
      }
      if (!mounted) return;
      setState(() {
        inbox = fresh;
        demoProbe = health;
        lastGatewayReadAt = DateTime.now().toUtc();
        message = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        inbox = null; // Fail closed rather than display stale alerts.
        demoProbe = null;
        lastGatewayReadAt = null;
        message = 'Bandeja CRT no disponible o contrato inválido.';
      });
    } finally {
      fetching = false;
    }
  }

  @override
  void didUpdateWidget(covariant QoreCrtQaPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.client != widget.client) {
      inbox = null;
      demoProbe = null;
      lastGatewayReadAt = null;
      _startPeriodicRefresh();
      _refresh();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refresh();
      _startPeriodicRefresh();
    } else {
      refreshTimer?.cancel();
      inbox = null;
      demoProbe = null;
      lastGatewayReadAt = null;
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    refreshTimer?.cancel();
    super.dispose();
  }

  String _time(DateTime instant) {
    final d = instant.toLocal();
    String pad(int n) => n.toString().padLeft(2, '0');
    return '${pad(d.day)}/${pad(d.month)} ${pad(d.hour)}:${pad(d.minute)}';
  }

  Widget _eventCard(BuildContext context, QoreCrtQaEvent event) {
    final bullish = event.direction == 'BULLISH';
    final textTheme = Theme.of(context).textTheme;
    Widget status(String name, String value) => Row(children: [
      Expanded(child: Text(name)),
      Text(value == 'CONFIRMED' ? 'Confirmado'
          : value == 'AWAITING' ? 'Pendiente' : 'No verificado',
          style: TextStyle(
            color: value == 'CONFIRMED' ? Colors.teal : Colors.amber.shade700,
            fontWeight: FontWeight.w600)),
    ]);
    return Card(
      margin: const EdgeInsets.only(bottom: 11),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(event.instrumentId, style: textTheme.titleLarge)),
            Icon(bullish ? Icons.trending_up : Icons.trending_down,
              color: bullish ? Colors.teal : Colors.red),
            const SizedBox(width: 5),
            Text(bullish ? 'Alcista' : 'Bajista'),
          ]),
          const SizedBox(height: 7),
          Text('${event.family} · ${event.eventType}'),
          const Divider(),
          status('MSS M5', event.mssM5),
          const SizedBox(height: 5),
          status('MSS M15', event.mssM15),
          const SizedBox(height: 9),
          Text('Confirmación: ${_time(event.confirmedAt)}'),
          Text('Vence: ${_time(event.expiresAt)}'),
          const SizedBox(height: 7),
          const Text('REPLAY QA · NO CERTIFICADO · NO OPERAR',
              style: TextStyle(color: Colors.deepOrange,
                fontSize: 11, fontWeight: FontWeight.bold)),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now().toUtc();
    final connState = inbox?.state == 'OFFLINE_REPLAY_ONLY'
      ? 'solo replay QA' : 'sin fuente CRT';
    final active = (inbox?.events ?? <QoreCrtQaEvent>[])
      .where((e) => e.activeAt(now) &&
        (allSymbols || selected.contains(e.instrumentId)))
      .toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
      children: [
        Text('CRT Alerts', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 8),
        const Card(child: Padding(
          padding: EdgeInsets.all(13),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('LABORATORIO · SIN SEÑALES REALES',
              style: TextStyle(fontWeight: FontWeight.bold)),
            SizedBox(height: 6),
            Text('34 instrumentos IC Markets · 7 familias CRT · '
              'MSS M5 y M15 independientes · vigencia 4 horas.'),
          ]),
        )),
        Card(
          child: ListTile(
            leading: Icon(
              lastGatewayReadAt != null ? Icons.cloud_done_outlined
                  : Icons.cloud_off_outlined,
              color: lastGatewayReadAt != null ? Colors.teal
                  : Colors.amber.shade700,
            ),
            title: Text(lastGatewayReadAt == null
              ? 'Gateway CRT: no verificado'
              : 'Gateway CRT: conexión autenticada OK'),
            subtitle: Text(lastGatewayReadAt == null
              ? 'La app aún no ha recibido una respuesta QA válida.'
              : 'Comprobado: ${_time(lastGatewayReadAt!)}. '
                'Estado: $connState. '
                'Esto NO certifica mercados ni alertas push.'),
          ),
        ),
        Card(
          child: ListTile(
            leading: const Icon(Icons.cell_tower),
            title: const Text('cTrader DEMO · IC Markets'),
            subtitle: Text(demoProbe?.recent == true
              ? 'Prueba de conexión QA recibida: '
                '${demoProbe!.symbolsObserved} símbolos observados, '
                '${demoProbe!.sampledClosedM5} velas M5 de muestra. '
                'No demuestra paridad TradingView ni señales CRT/MSS.'
              : 'Sin prueba vigente de conexión cTrader DEMO. '
                'No hay señales CRT/MSS certificadas ni notificaciones de mercado.'),
          ),
        ),
        Row(children: [
          Expanded(child: Text('Eventos QA vigentes: ${active.length}')),
          IconButton(
            tooltip: 'Actualizar CRT',
            onPressed: fetching ? null : _refresh,
            icon: const Icon(Icons.refresh),
          ),
        ]),
        if (message != null)
          Card(child: Padding(
            padding: const EdgeInsets.all(12), child: Text(message!))),
        OutlinedButton.icon(
          onPressed: () => setState(() => showSymbols = !showSymbols),
          icon: const Icon(Icons.tune),
          label: Text(showSymbols ? 'Ocultar mercados'
            : 'Filtrar mercados (34)'),
        ),
        if (showSymbols) ...[
          SwitchListTile(
            title: const Text('Todos los mercados'),
            value: allSymbols,
            onChanged: (value) {
              setState(() {
                allSymbols = value;
                if (value) selected.clear();
              });
              _persistSelection();
            },
          ),
          Wrap(spacing: 4, runSpacing: 0, children: [
            for (final symbol in qoreCrtMarkets)
              FilterChip(
                label: Text(symbol),
                selected: !allSymbols && selected.contains(symbol),
                onSelected: (checked) {
                  setState(() {
                    allSymbols = false;
                    if (checked) { selected.add(symbol); }
                    else { selected.remove(symbol); }
                  });
                  _persistSelection();
                },
              ),
          ]),
        ],
        const SizedBox(height: 9),
        if (active.isEmpty)
          const Card(child: Padding(
            padding: EdgeInsets.all(20),
            child: Text('Sin eventos CRT/MSS para mostrar. '
              'No se fabrican señales ni entradas.'),
          )),
        for (final item in active) _eventCard(context, item),
        const SizedBox(height: 12),
        Text('Los informes del VPS y las alertas operativas de QORE Mobile '
          'permanecen independientes de este módulo.',
          style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
