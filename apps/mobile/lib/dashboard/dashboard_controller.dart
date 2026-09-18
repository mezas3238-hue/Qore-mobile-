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

  bool get canRefresh => _client != null;

  Future<void> refresh() async {
    final client = _client;
    if (client == null) {
      status = DashboardStatus.disconnected;
      snapshot = null;
      errorMessage = null;
      notifyListeners();
      return;
    }

    status = DashboardStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      snapshot = await client.fetchDashboard();
      status = DashboardStatus.ready;
    } on QoreSessionMissing {
      snapshot = null;
      status = DashboardStatus.disconnected;
      errorMessage = null;
    } on QoreGatewayException {
      snapshot = null;
      status = DashboardStatus.error;
      errorMessage = 'No se pudo sincronizar con QORE Mobile Gateway.';
    } on QoreModelException {
      snapshot = null;
      status = DashboardStatus.error;
      errorMessage = 'El Gateway devolvió un estado inválido.';
    } catch (_) {
      snapshot = null;
      status = DashboardStatus.error;
      errorMessage = 'Error inesperado al actualizar el dashboard.';
    }

    notifyListeners();
  }
}
