import 'package:flutter/material.dart';

import '../domain/models.dart';

class ConnectionHealthCard extends StatelessWidget {
  const ConnectionHealthCard({super.key, required this.snapshot});

  final DashboardSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final runtime = snapshot.runtimes.isEmpty ? null : snapshot.runtimes.first;
    final freshness = runtime?.freshness ?? Freshness.unknown;
    final heartbeat = runtime?.lastHeartbeat;
    final age = heartbeat == null
        ? null
        : DateTime.now().toUtc().difference(heartbeat).inSeconds.clamp(0, 999);
    final mode = snapshot.accounts.isEmpty
        ? 'UNKNOWN'
        : snapshot.accounts.first.mode.name.toUpperCase();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: [
            const Row(
              children: [
                Icon(Icons.cloud_done_outlined, size: 18),
                SizedBox(width: 8),
                Expanded(child: Text('Gateway')),
                Text(
                  'CONECTADO',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ],
            ),
            const Divider(height: 20),
            Row(
              children: [
                _HeartbeatPulse(freshness: freshness),
                const SizedBox(width: 8),
                const Expanded(child: Text('Runtime heartbeat')),
                Text(
                  $'{freshness.name.toUpperCase()}$${age == null ? '' : ' · $${age}s'}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: Chip(label: Text(mode)),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeartbeatPulse extends StatefulWidget {
  const _HeartbeatPulse({required this.freshness});

  final Freshness freshness;

  @override
  State<_HeartbeatPulse> createState() => _HeartbeatPulseState();
}

class _HeartbeatPulseState extends State<_HeartbeatPulse>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  Color get _color => switch (widget.freshness) {
        Freshness.live => const Color(0xFF22C55E),
        Freshness.delayed => const Color(0xFFF5AE0B),
        Freshness.stale => const Color(0xFFF97316),
        Freshness.offline => const Color(0xFFEF4444),
        Freshness.unknown => const Color(0xFF9CA3AF),
      };

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 850),
      lowerBound: 0.72,
      upperBound: 1.0,
      value: 1.0,
    );
    if (widget.freshness == Freshness.live) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void didUpdateWidget(covariant _HeartbeatPulse oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.freshness == Freshness.live) {
      if (!_controller.isAnimating) _controller.repeat(reverse: true);
    } else {
      _controller.stop();
      _controller.value = 1.0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: _controller,
      child: Icon(Icons.circle, size: 14, color: _color),
    );
  }
}
