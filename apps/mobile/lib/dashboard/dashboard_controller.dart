import 'dart:async';

import 'package:flutter/foundation.dart';

import '../data/qore_gateway_client.dart';
import '../domain/models.dart';

enum DashboardStatus {
  disconnected,
  loading,
  ready,
  error,
}

class DashboardController extends ChangeNotifier {
  DashboardController(this._client);

  final QoreGatewayClient? _client;

  DashboardStatus status = DashboardStatus.disconnected;
  DashboardSnapshot? snapshot;
  String? errorMessage;

  Timer? _refreshTimer;
  bool _refreshing = false;

  bool get canRefresh => _client != null;

  void startAutoRefresh({
    Duration interval = const Duration(seconds: 2),
  }) {
    if (_client == null || _refreshTimer != null) {
      return;
    }
    unawaited(refresh());
    _refreshTimer = Timer.periodic(interval, (_) {
      unawaited(refresh());
    });
  }

  void stopAutoRefresh() {
    _refreshTimer?.cancel();
    _refreshTimer = null;
  }

  Future<void> refresh() async {
    final client = _client;
    if (client == null) {
      status = DashboardStatus.disconnected;
      snapshot = null;
      errorMessage = null;
      notifyListeners();
      return;
    }

    if (_refreshing) {
      return;
    }
    _refreshing = true;

    final hadSnapshot = snapshot != null;
    if (!hadSnapshot) {
      status = DashboardStatus.loading;
      notifyListeners();
    }
    errorMessage = null;

    try {
      snapshot = await client.fetchDashboard();
      status = DashboardStatus.ready;
    } on QoreSessionMissing {
      snapshot = null;
      status = DashboardStatus.disconnected;
      errorMessage = null;
      stopAutoRefresh();
    } on QoreGatewayException {
      status = DashboardStatus.error;
      errorMessage = 'No se pudo sincronizar con QORE Mobile Gateway.';
    } on QoreModelException {
      snapshot = null;
      status = DashboardStatus.error;
      errorMessage = 'El Gateway devolvió un estado inválido.';
    } catch (_) {
      status = DashboardStatus.error;
      errorMessage = 'Error inesperado al actualizar el dashboard.';
    } finally {
      _refreshing = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    stopAutoRefresh();
    super.dispose();
  }
}
