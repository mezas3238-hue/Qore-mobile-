abstract interface class AccessTokenProvider {
  Future<String?> readAccessToken();
}

/// Placeholder used until device enrollment and secure OS-backed storage land.
///
/// It intentionally returns no token so production reads fail closed instead
/// of embedding a development credential in the application.
class NoSessionTokenProvider implements AccessTokenProvider {
  const NoSessionTokenProvider();

  @override
  Future<String?> readAccessToken() async => null;
}
