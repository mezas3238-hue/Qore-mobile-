class QoreAppConfig {
  const QoreAppConfig._(this.gatewayUri);

  final Uri gatewayUri;

  static QoreAppConfig? fromEnvironment() {
    const raw = String.fromEnvironment('QORE_GATEWAY_URL');
    if (raw.isEmpty) {
      return null;
    }

    final uri = Uri.tryParse(raw);
    if (uri == null ||
        uri.scheme.toLowerCase() != 'https' ||
        uri.host.isEmpty ||
        uri.hasFragment) {
      return null;
    }

    if (uri.path.endsWith('/')) {
      return QoreAppConfig._(uri);
    }
    return QoreAppConfig._(
      uri.replace(path: uri.path + '/'),
    );
  }
}
