import 'package:flutter/material.dart';

import '../appearance/appearance_controller.dart';
import '../config/app_config.dart';
import '../data/qore_gateway_client.dart';
import '../domain/models.dart';
import '../domain/widget_snapshot.dart';
import '../dashboard/qore_home.dart';
import '../security/enrollment_service.dart';
import '../security/native_device_session_provider.dart';
import '../security/session.dart';

enum _BootstrapState {
  loading,
  needsEnrollment,
  locked,
  ready,
  configurationError,
  error,
}

class QoreBootstrap extends StatefulWidget {
  const QoreBootstrap({
    super.key,
    this.appearanceController,
  });

  final AppearanceController? appearanceController;

  @override
  State<QoreBootstrap> createState() => _QoreBootstrapState();
}

class _QoreBootstrapState extends State<QoreBootstrap>
    with WidgetsBindingObserver {
  final NativeDeviceSessionProvider _sessionProvider =
      NativeDeviceSessionProvider();

  _BootstrapState _state = _BootstrapState.loading;
  String? _message;
  HttpQoreGatewayClient? _client;
  DateTime? _backgroundedAt;
  DeviceSecurityCapabilities? _securityCapabilities;
  bool _unlocking = false;

  QoreAppConfig? get _config => QoreAppConfig.fromEnvironment();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initialize();
  }

  Future<void> _initialize() async {
    final config = _config;
    if (config == null) {
      if (!mounted) return;
      setState(() {
        _state = _BootstrapState.configurationError;
      });
      return;
    }

    try {
      final capabilities = await _sessionProvider.securityCapabilities();
      if (!capabilities.secureStoreAvailable ||
          !capabilities.ownerAuthenticationAvailable) {
        if (!mounted) return;
        setState(() {
          _securityCapabilities = capabilities;
          _state = _BootstrapState.error;
          _message = !capabilities.secureStoreAvailable
              ? 'El almacén seguro del dispositivo no está disponible.'
              : 'Configura huella, biometría fuerte o bloqueo seguro del dispositivo antes de usar QORE Mobile.';
        });
        return;
      }
      _securityCapabilities = capabilities;

      final session = await _sessionProvider.readSession();
      if (!mounted) return;
      if (session == null) {
        setState(() => _state = _BootstrapState.needsEnrollment);
        return;
      }
      await _unlock();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _state = _BootstrapState.error;
        _message = 'No se pudo abrir el almacén seguro del dispositivo.';
      });
    }
  }

  Future<void> _unlock() async {
    if (_unlocking) return;
    _unlocking = true;
    try {
      final authenticated = await _sessionProvider.authenticateOwner(
        reason: 'Desbloquear QORE Mobile',
      );
      if (!mounted) return;
      if (!authenticated) {
        setState(() => _state = _BootstrapState.locked);
        return;
      }

      final config = _config;
      if (config == null) {
        setState(() => _state = _BootstrapState.configurationError);
        return;
      }

      _client?.close();
      _client = HttpQoreGatewayClient(
        baseUri: config.gatewayUri,
        sessionProvider: _sessionProvider,
      );
      setState(() {
        _state = _BootstrapState.ready;
        _message = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _state = _BootstrapState.locked;
        _message = 'Autenticación del dispositivo no disponible.';
      });
    } finally {
      _unlocking = false;
    }
  }

  Future<void> _enroll({
    required String code,
    required String label,
  }) async {
    final config = _config;
    if (config == null) {
      setState(() => _state = _BootstrapState.configurationError);
      return;
    }

    setState(() {
      _state = _BootstrapState.loading;
      _message = null;
    });

    final authorized = await _sessionProvider.authenticateOwner(
      reason: 'Autorizar el enrolamiento seguro de QORE Mobile',
    );
    if (!mounted) return;
    if (!authorized) {
      setState(() {
        _state = _BootstrapState.needsEnrollment;
        _message =
            'Debes autenticarte con huella, biometría o el bloqueo seguro del teléfono para enrolar este dispositivo.';
      });
      return;
    }

    final service = EnrollmentService(
      baseUri: config.gatewayUri,
      sessionProvider: _sessionProvider,
    );
    try {
      await service.enroll(
        enrollmentCode: code,
        label: label,
      );
      if (!mounted) return;
      await _unlock();
    } on EnrollmentException catch (error) {
      if (!mounted) return;
      setState(() {
        _state = _BootstrapState.needsEnrollment;
        _message = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _state = _BootstrapState.needsEnrollment;
        _message = 'No se pudo completar el enrolamiento seguro.';
      });
    } finally {
      service.close();
    }
  }

  void _sessionMissing() {
    _client?.close();
    _client = null;
    if (!mounted) return;
    setState(() {
      _state = _BootstrapState.needsEnrollment;
      _message = 'La sesión fue revocada o expiró. Vuelve a enrolar este dispositivo.';
    });
  }

  Future<void> _publishWidgetSnapshot(DashboardSnapshot snapshot) async {
    final widgetSnapshot = WidgetSnapshot.fromDashboard(
      snapshot,
      generatedAt: DateTime.now().toUtc(),
    );
    await _sessionProvider.publishWidgetSnapshot(widgetSnapshot.toJson());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.hidden) {
      _backgroundedAt ??= DateTime.now().toUtc();
      return;
    }

    if (state == AppLifecycleState.resumed) {
      final backgrounded = _backgroundedAt;
      _backgroundedAt = null;
      if (backgrounded != null &&
          DateTime.now().toUtc().difference(backgrounded) >
              const Duration(seconds: 30) &&
          _state == _BootstrapState.ready) {
        setState(() => _state = _BootstrapState.locked);
        _unlock();
      }
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _client?.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return switch (_state) {
      _BootstrapState.loading => const _CenteredStatus(
          icon: Icons.shield_outlined,
          title: 'Preparando QORE Mobile',
          body: 'Validando la sesión segura del dispositivo.',
          progress: true,
        ),
      _BootstrapState.needsEnrollment => _EnrollmentScreen(
          errorMessage: _message,
          securityCapabilities: _securityCapabilities,
          onEnroll: _enroll,
        ),
      _BootstrapState.locked => _CenteredStatus(
          icon: Icons.lock_outline,
          title: 'QORE Mobile bloqueado',
          body: _message ??
              'Autentícate con biometría o el bloqueo seguro del dispositivo.',
          actionLabel: 'Desbloquear',
          onAction: _unlock,
        ),
      _BootstrapState.ready => QoreHome(
          client: _client,
          snapshotSink: _publishWidgetSnapshot,
          onSessionMissing: _sessionMissing,
          appearanceController:
              widget.appearanceController ?? AppearanceController.instance,
        ),
      _BootstrapState.configurationError => const _CenteredStatus(
          icon: Icons.settings_outlined,
          title: 'Gateway no configurado',
          body:
              'La build oficial necesita QORE_GATEWAY_URL con una URL HTTPS válida.',
        ),
      _BootstrapState.error => _CenteredStatus(
          icon: Icons.error_outline,
          title: 'Inicio seguro no disponible',
          body: _message ?? 'No se pudo iniciar QORE Mobile.',
          actionLabel: 'Reintentar',
          onAction: _initialize,
        ),
    };
  }
}

class _CenteredStatus extends StatelessWidget {
  const _CenteredStatus({
    required this.icon,
    required this.title,
    required this.body,
    this.progress = false,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String body;
  final bool progress;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icon, size: 48),
                  const SizedBox(height: 16),
                  Text(
                    title,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 12),
                  Text(body, textAlign: TextAlign.center),
                  if (progress) ...[
                    const SizedBox(height: 24),
                    const CircularProgressIndicator(),
                  ],
                  if (actionLabel != null && onAction != null) ...[
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: onAction,
                      child: Text(actionLabel!),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _EnrollmentScreen extends StatefulWidget {
  const _EnrollmentScreen({
    required this.onEnroll,
    this.errorMessage,
    this.securityCapabilities,
  });

  final Future<void> Function({
    required String code,
    required String label,
  }) onEnroll;
  final String? errorMessage;
  final DeviceSecurityCapabilities? securityCapabilities;

  @override
  State<_EnrollmentScreen> createState() => _EnrollmentScreenState();
}

class _EnrollmentScreenState extends State<_EnrollmentScreen> {
  final _labelController = TextEditingController(text: 'Teléfono principal');
  final _codeController = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _labelController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    try {
      await widget.onEnroll(
        code: _codeController.text,
        label: _labelController.text,
      );
    } finally {
      _codeController.clear();
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Enrolar dispositivo')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(
              'Autoriza este teléfono',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            const Text(
              'QORE Mobile registrará una clave del dispositivo. '
              'El código de enrolamiento es de un solo uso, se mantiene sólo en memoria y no se guarda en GitHub ni en el teléfono.',
            ),
            const SizedBox(height: 16),
            _SecurityReadinessCard(
              capabilities: widget.securityCapabilities,
            ),
            const SizedBox(height: 24),
            TextField(
              controller: _labelController,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'Nombre del dispositivo',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _codeController,
              obscureText: true,
              enableSuggestions: false,
              autocorrect: false,
              onSubmitted: (_) => _submit(),
              decoration: const InputDecoration(
                labelText: 'Clave/código de enrolamiento (uso único)',
                border: OutlineInputBorder(),
              ),
            ),
            if (widget.errorMessage != null) ...[
              const SizedBox(height: 16),
              Text(
                widget.errorMessage!,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.error,
                ),
              ),
            ],
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: _submitting ? null : _submit,
              icon: const Icon(Icons.phonelink_lock),
              label: Text(_submitting ? 'Enrolando…' : 'Enrolar'),
            ),
          ],
        ),
      ),
    );
  }
}


class _SecurityReadinessCard extends StatelessWidget {
  const _SecurityReadinessCard({required this.capabilities});

  final DeviceSecurityCapabilities? capabilities;

  @override
  Widget build(BuildContext context) {
    final caps = capabilities;
    final biometric = caps?.strongBiometricAvailable == true;
    final deviceLock = caps?.deviceCredentialAvailable == true;
    final secureStore = caps?.secureStoreAvailable == true;

    Widget securityRow(String label, bool ok) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Icon(
              ok ? Icons.check_circle_outline : Icons.cancel_outlined,
              size: 20,
            ),
            const SizedBox(width: 8),
            Expanded(child: Text(label)),
          ],
        ),
      );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Seguridad del dispositivo',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            securityRow(
              biometric
                  ? 'Huella/biometría fuerte detectada'
                  : 'Huella/biometría fuerte no detectada',
              biometric,
            ),
            securityRow(
              deviceLock
                  ? 'Bloqueo seguro del dispositivo disponible'
                  : 'Bloqueo seguro del dispositivo no disponible',
              deviceLock,
            ),
            securityRow(
              secureStore
                  ? 'Almacén seguro: ${caps?.secureStore ?? 'disponible'}'
                  : 'Almacén seguro no disponible',
              secureStore,
            ),
            if (caps?.secureHardwareAvailable == true)
              const Padding(
                padding: EdgeInsets.only(top: 4),
                child: Text('Protección criptográfica por hardware detectada.'),
              ),
          ],
        ),
      ),
    );
  }
}
