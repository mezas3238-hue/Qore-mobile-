import 'package:flutter/material.dart';

import '../config/app_config.dart';
import '../domain/models.dart';
import '../security/native_device_session_provider.dart';
import 'appearance_controller.dart';

class AppearancePage extends StatelessWidget {
  AppearancePage({super.key, required this.controller, required this.snapshot});

  final AppearanceController controller;
  final DashboardSnapshot snapshot;
  final NativeDeviceSessionProvider _native = NativeDeviceSessionProvider();

  Future<void> _apply(Future<void> change) async {
    await change;
    try {
      await _native.publishWidgetPreferences(controller.widgetPreferences());
    } catch (_) {}
  }

  Future<void> _setWidgetLive(bool enabled) async {
    await controller.setWidgetLiveEnabled(enabled);
    final config = QoreAppConfig.fromEnvironment();
    if (config == null) return;
    try {
      await _native.setWidgetLiveMode(
        enabled: enabled,
        gatewayUrl: config.gatewayUri.toString(),
      );
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Apariencia', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 6),
          const Text('Preferencias locales. No contienen credenciales ni controles de trading.'),
          const SizedBox(height: 14),
          _section(context, 'Tema', QoreThemePreference.values, controller.themePreference,
              (v) => v.name == 'dark' ? 'Oscuro' : v.name == 'light' ? 'Claro' : 'Sistema',
              (v) => _apply(controller.setTheme(v))),
          _accent(context),
          _section(context, 'Densidad', QoreDensity.values, controller.density,
              (v) => v.name == 'compact' ? 'Compacta' : v.name == 'normal' ? 'Normal' : 'Amplia',
              (v) => _apply(controller.setDensity(v))),
          _section(context, 'Texto', QoreTextSize.values, controller.textSize,
              (v) => v.name == 'small' ? 'Pequeño' : v.name == 'normal' ? 'Normal' : 'Grande',
              (v) => _apply(controller.setTextSize(v))),
          _section(context, 'Tarjetas', QoreCardRadius.values, controller.cardRadius,
              (v) => v.name == 'compact' ? 'Compacto' : v.name == 'soft' ? 'Suave' : 'Redondo',
              (v) => _apply(controller.setCardRadius(v))),
          _toggle('Mostrar mercados de traders', controller.showTraderMarkets,
              (v) => _apply(controller.setShowTraderMarkets(v))),
          _toggle('Mostrar edad del heartbeat', controller.showHeartbeatAge,
              (v) => _apply(controller.setShowHeartbeatAge(v))),
          _toggle('Mostrar hora exacta', controller.showExactTime,
              (v) => _apply(controller.setShowExactTime(v))),
          const SizedBox(height: 16),
          Text('Widget Android', style: Theme.of(context).textTheme.headlineSmall),
          const Text('VISTA DEL WIDGET EN LA PANTALLA DE INICIO',
              style: TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          Card(
            child: SwitchListTile(
              title: const Text('Widget LIVE'),
              subtitle: const Text(
                'Actualiza aproximadamente cada 2 s también con la pantalla apagada mientras Widget LIVE esté activo.',
              ),
              value: controller.widgetLiveEnabled,
              onChanged: _setWidgetLive,
            ),
          ),
          _section(context, 'Fondo', QoreWidgetBackground.values, controller.widgetBackground,
              (v) => v.name == 'solid' ? 'Sólido' : v.name == 'glass' ? 'Glass' : 'Alto contraste',
              (v) => _apply(controller.setWidgetBackground(v))),
          _section(context, 'Tamaño / información', QoreWidgetInfoLevel.values, controller.widgetInfoLevel,
              (v) => v.name == 'compact' ? 'Compacto 2×1' : v.name == 'normal' ? 'Normal 4×2' : 'Detallado 4×4',
              (v) => _apply(controller.setWidgetInfoLevel(v))),
          const SizedBox(height: 10),
          _HomePreview(controller: controller, snapshot: snapshot),
          const SizedBox(height: 8),
          const Text('Este bloque representa el widget nativo de la pantalla de inicio. En Android también puedes redimensionarlo arrastrando sus bordes.'),
        ],
      ),
    );
  }

  Widget _section<T>(BuildContext context, String title, List<T> values, T selected,
      String Function(T) label, ValueChanged<T> onChanged) {
    return Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [Text(title, style: Theme.of(context).textTheme.titleMedium), const SizedBox(height: 8),
        Wrap(spacing: 7, runSpacing: 7, children: [for (final v in values)
          ChoiceChip(label: Text(label(v)), selected: selected == v, onSelected: (_) => onChanged(v))])],
    )));
  }

  Widget _accent(BuildContext context) {
    const colors = [Color(0xFF4F46E5), Color(0xFF2563EB), Color(0xFF16A34A), Color(0xFF0891B2), Color(0xFFD97706), Color(0xFFDC2626)];
    return Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [Text('Color de acento', style: Theme.of(context).textTheme.titleMedium), const SizedBox(height: 8),
        Wrap(spacing: 10, children: [for (var i = 0; i < QoreAccent.values.length; i++)
          InkWell(onTap: () => _apply(controller.setAccent(QoreAccent.values[i])), child: Container(
            width: 38, height: 38, decoration: BoxDecoration(shape: BoxShape.circle, color: colors[i],
              border: Border.all(color: controller.accent == QoreAccent.values[i] ? Theme.of(context).colorScheme.onSurface : Colors.transparent, width: 3))))])],
    )));
  }

  Widget _toggle(String title, bool value, ValueChanged<bool> onChanged) =>
      Card(child: SwitchListTile(title: Text(title), value: value, onChanged: onChanged));
}

class _HomePreview extends StatelessWidget {
  const _HomePreview({required this.controller, required this.snapshot});
  final AppearanceController controller;
  final DashboardSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final p = snapshot.portfolio;
    final r = snapshot.runtimes.isEmpty ? null : snapshot.runtimes.first;
    final mode = snapshot.accounts.isEmpty ? 'UNKNOWN' : snapshot.accounts.first.mode.name.toUpperCase();
    final age = r?.lastHeartbeat == null ? null : DateTime.now().toUtc().difference(r!.lastHeartbeat!).inSeconds.clamp(0, 999);
    final status = '${r?.freshness.name.toUpperCase() ?? 'UNKNOWN'}${controller.showHeartbeatAge && age != null ? ' · ${age}s' : ''}';
    final dark = controller.themePreference != QoreThemePreference.light;
    final fg = dark ? Colors.white : const Color(0xFF101828);
    final muted = dark ? const Color(0xFF9CA3AF) : const Color(0xFF667085);
    final bg = switch (controller.widgetBackground) {
      QoreWidgetBackground.solid => dark ? const Color(0xFF111827) : Colors.white,
      QoreWidgetBackground.glass => dark ? const Color(0xDD1F2937) : const Color(0xDDF8FAFC),
      QoreWidgetBackground.highContrast => dark ? Colors.black : Colors.white,
    };
    final size = switch (controller.widgetInfoLevel) {
      QoreWidgetInfoLevel.compact => const Size(210, 105),
      QoreWidgetInfoLevel.normal => const Size(330, 170),
      QoreWidgetInfoLevel.detailed => const Size(330, 300),
    };
    String money(double? v) => v == null ? '—' : v.toStringAsFixed(2);
    final live = r?.freshness == Freshness.live;
    final traders = snapshot.traders.map((e) => e.name).toList();

    return Container(height: 430, padding: const EdgeInsets.all(16), decoration: BoxDecoration(
      color: dark ? const Color(0xFF071B22) : const Color(0xFFE8EEF2), borderRadius: BorderRadius.circular(28)),
      child: Column(children: [
        Align(alignment: Alignment.centerLeft, child: Text('Pantalla de inicio Android', style: TextStyle(color: fg, fontWeight: FontWeight.w700))),
        const SizedBox(height: 12),
        Container(width: size.width, height: size.height, padding: const EdgeInsets.all(13), decoration: BoxDecoration(
          color: bg, borderRadius: BorderRadius.circular(controller.radius), border: Border.all(color: controller.accentColor.withValues(alpha: .45))),
          child: DefaultTextStyle(style: TextStyle(color: fg, fontSize: 12 * controller.textScale), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [const Expanded(child: Text('QORE', style: TextStyle(fontWeight: FontWeight.w800))), Text(mode, style: TextStyle(color: controller.accentColor, fontWeight: FontWeight.w800))]),
            const SizedBox(height: 5), Row(children: [Icon(Icons.circle, size: 9, color: live ? const Color(0xFF22C55E) : muted), const SizedBox(width: 5), Text(status, style: const TextStyle(fontWeight: FontWeight.w700))]),
            const Spacer(),
            if (controller.widgetInfoLevel == QoreWidgetInfoLevel.compact)
              Text('Equity ${money(p.equity)}', style: const TextStyle(fontWeight: FontWeight.w800))
            else ...[
              Row(children: [Expanded(child: _metric('Equity', money(p.equity), muted)), Expanded(child: _metric('P/L', money(p.realizedPnlToday), muted)), Expanded(child: _metric('Pos', '${p.activePositions}', muted)), Expanded(child: _metric('Runtime', '${snapshot.runtimes.where((x) => x.freshness == Freshness.live).length}/${snapshot.runtimes.length}', muted))]),
              if (controller.widgetInfoLevel == QoreWidgetInfoLevel.detailed) ...[
                const SizedBox(height: 9), Row(children: [Expanded(child: _metric('Balance', money(p.balance), muted)), Expanded(child: _metric('DD', p.dailyDrawdownFraction == null ? '—' : '${(p.dailyDrawdownFraction! * 100).toStringAsFixed(2)}%', muted))]),
                const SizedBox(height: 7), Text('Traders', style: TextStyle(color: muted, fontSize: 10)),
                for (final t in traders.take(3)) Text('• $t', maxLines: 1, overflow: TextOverflow.ellipsis),
                if (traders.length > 3) Text('+${traders.length - 3} más', style: TextStyle(color: muted)),
              ]
            ]
          ]))),
        const Spacer(),
        Wrap(spacing: 22, children: [for (final x in const [(Icons.mail_outline,'Correo'), (Icons.folder_outlined,'Archivos'), (Icons.code,'GitHub'), (Icons.settings_outlined,'Ajustes')]) Column(children: [Container(width: 42, height: 42, decoration: BoxDecoration(color: fg.withValues(alpha: .10), borderRadius: BorderRadius.circular(12)), child: Icon(x.$1, color: fg)), const SizedBox(height: 3), Text(x.$2, style: TextStyle(color: fg, fontSize: 9))])])
      ]));
  }

  Widget _metric(String label, String value, Color muted) => Column(crossAxisAlignment: CrossAxisAlignment.start,
      children: [Text(label, style: TextStyle(color: muted, fontSize: 9)), Text(value, style: const TextStyle(fontWeight: FontWeight.w700))]);
}
