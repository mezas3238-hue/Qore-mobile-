import CryptoKit
import Flutter
import LocalAuthentication
import Security
import UIKit
import WidgetKit

final class QoreSecurityBridge {
  private let channelName = "qore.mobile/security"
  private let keyService = "com.qore.mobile.device-key"
  private let secureKeyAccount = "secure-enclave-p256-v1"
  private let softwareKeyAccount = "software-p256-v1"
  private let sessionService = "com.qore.mobile.session"
  private let sessionAccount = "device-session-v1"
  private let identityService = "com.qore.mobile.identity"
  private let identityAccount = "device-id-v1"
  private let appGroup = "group.com.qore.mobile.shared"
  private let widgetSnapshotKey = "qore_widget_snapshot"

  private enum SigningKey {
    case secure(SecureEnclave.P256.Signing.PrivateKey)
    case software(P256.Signing.PrivateKey)

    var publicKeyData: Data {
      switch self {
      case .secure(let key):
        return key.publicKey.x963Representation
      case .software(let key):
        return key.publicKey.x963Representation
      }
    }

    func signature(for data: Data) throws -> Data {
      switch self {
      case .secure(let key):
        return try key.signature(for: data).derRepresentation
      case .software(let key):
        return try key.signature(for: data).derRepresentation
      }
    }
  }

  func attach(binaryMessenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(
      name: channelName,
      binaryMessenger: binaryMessenger
    )
    channel.setMethodCallHandler { [weak self] call, result in
      guard let self else {
        result(
          FlutterError(
            code: "NATIVE_SECURITY_ERROR",
            message: "Native security bridge is unavailable",
            details: nil
          )
        )
        return
      }
      self.handle(call: call, result: result)
    }
  }

  private func handle(call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "securityCapabilities":
      let biometricContext = LAContext()
      var biometricError: NSError?
      let biometricAvailable = biometricContext.canEvaluatePolicy(
        .deviceOwnerAuthenticationWithBiometrics,
        error: &biometricError
      )
      let biometricKind: String
      switch biometricContext.biometryType {
      case .faceID:
        biometricKind = "face"
      case .touchID:
        biometricKind = "fingerprint"
      default:
        biometricKind = "none"
      }

      let ownerContext = LAContext()
      var ownerError: NSError?
      let ownerAuthenticationAvailable = ownerContext.canEvaluatePolicy(
        .deviceOwnerAuthentication,
        error: &ownerError
      )

      result([
        "biometric_strong_available": biometricAvailable,
        "device_credential_available": ownerAuthenticationAvailable,
        "secure_store_available": true,
        "secure_hardware_available": SecureEnclave.isAvailable,
        "secure_store": "Keychain",
        "biometric_kind": biometricKind,
      ])

    case "ensureEnrollmentIdentity":
      runCrypto(result: result) {
        let key = try self.loadOrCreateSigningKey()
        return [
          "device_id": try self.loadOrCreateDeviceId(),
          "platform": "ios",
          "public_key_b64": key.publicKeyData.base64EncodedString(),
          "key_algorithm": "p256-x963",
        ]
      }

    case "sign":
      guard
        let args = call.arguments as? [String: Any],
        let encoded = args["message_b64"] as? String,
        let data = Data(base64Encoded: encoded)
      else {
        result(
          FlutterError(
            code: "INVALID_ARGUMENT",
            message: "message_b64 is required",
            details: nil
          )
        )
        return
      }
      runCrypto(result: result) {
        let key = try self.loadOrCreateSigningKey()
        return try key.signature(for: data).base64EncodedString()
      }

    case "readSession":
      runCrypto(result: result) {
        guard let data = try self.readKeychain(
          service: self.sessionService,
          account: self.sessionAccount
        ) else {
          return nil
        }
        let object = try JSONSerialization.jsonObject(with: data)
        return object as? [String: Any]
      }

    case "saveSession":
      guard let args = call.arguments as? [String: Any] else {
        result(
          FlutterError(
            code: "INVALID_ARGUMENT",
            message: "session payload is required",
            details: nil
          )
        )
        return
      }
      runCrypto(result: result) {
        let allowed = [
          "device_id",
          "access_token",
          "access_expires_at",
          "refresh_token",
          "refresh_expires_at",
        ]
        var session: [String: String] = [:]
        for key in allowed {
          guard let value = args[key] as? String, !value.isEmpty else {
            throw BridgeError.invalidSession
          }
          session[key] = value
        }
        let data = try JSONSerialization.data(withJSONObject: session)
        try self.writeKeychain(
          data,
          service: self.sessionService,
          account: self.sessionAccount
        )
        return nil
      }

    case "clearSession":
      runCrypto(result: result) {
        try self.deleteKeychain(
          service: self.sessionService,
          account: self.sessionAccount
        )
        return nil
      }

    case "authenticateOwner":
      let reason: String
      if
        let args = call.arguments as? [String: Any],
        let supplied = args["reason"] as? String,
        !supplied.isEmpty
      {
        reason = supplied
      } else {
        reason = "Desbloquear QORE Mobile"
      }
      authenticateOwner(reason: reason, result: result)

    case "publishWidgetSnapshot":
      guard
        let args = call.arguments as? [String: Any],
        let json = args["snapshot_json"] as? String,
        !json.isEmpty
      else {
        result(
          FlutterError(
            code: "INVALID_WIDGET_SNAPSHOT",
            message: "snapshot_json is required",
            details: nil
          )
        )
        return
      }
      guard let defaults = UserDefaults(suiteName: appGroup) else {
        result(
          FlutterError(
            code: "APP_GROUP_UNAVAILABLE",
            message: "QORE shared App Group is unavailable",
            details: nil
          )
        )
        return
      }
      defaults.set(json, forKey: widgetSnapshotKey)
      WidgetCenter.shared.reloadAllTimelines()
      result(nil)

    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func runCrypto(
    result: @escaping FlutterResult,
    operation: @escaping () throws -> Any?
  ) {
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        let value = try operation()
        DispatchQueue.main.async { result(value) }
      } catch {
        DispatchQueue.main.async {
          result(
            FlutterError(
              code: "NATIVE_SECURITY_ERROR",
              message: error.localizedDescription,
              details: nil
            )
          )
        }
      }
    }
  }

  private func loadOrCreateSigningKey() throws -> SigningKey {
    if SecureEnclave.isAvailable {
      if let data = try readKeychain(
        service: keyService,
        account: secureKeyAccount
      ) {
        return .secure(
          try SecureEnclave.P256.Signing.PrivateKey(
            dataRepresentation: data
          )
        )
      }

      let access = SecAccessControlCreateWithFlags(
        nil,
        kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        [],
        nil
      )!
      let key = try SecureEnclave.P256.Signing.PrivateKey(
        compactRepresentable: false,
        accessControl: access
      )
      try writeKeychain(
        key.dataRepresentation,
        service: keyService,
        account: secureKeyAccount
      )
      return .secure(key)
    }

    if let data = try readKeychain(
      service: keyService,
      account: softwareKeyAccount
    ) {
      return .software(
        try P256.Signing.PrivateKey(rawRepresentation: data)
      )
    }

    let key = P256.Signing.PrivateKey(compactRepresentable: false)
    try writeKeychain(
      key.rawRepresentation,
      service: keyService,
      account: softwareKeyAccount
    )
    return .software(key)
  }

  private func loadOrCreateDeviceId() throws -> String {
    if let data = try readKeychain(
      service: identityService,
      account: identityAccount
    ),
      let value = String(data: data, encoding: .utf8),
      !value.isEmpty
    {
      return value
    }

    let value = UUID().uuidString.lowercased()
    try writeKeychain(
      Data(value.utf8),
      service: identityService,
      account: identityAccount
    )
    return value
  }

  private func authenticateOwner(
    reason: String,
    result: @escaping FlutterResult
  ) {
    let context = LAContext()
    var error: NSError?
    guard context.canEvaluatePolicy(
      .deviceOwnerAuthentication,
      error: &error
    ) else {
      result(false)
      return
    }

    context.evaluatePolicy(
      .deviceOwnerAuthentication,
      localizedReason: reason
    ) { success, _ in
      DispatchQueue.main.async {
        result(success)
      }
    }
  }

  private func readKeychain(
    service: String,
    account: String
  ) throws -> Data? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(
      query as CFDictionary,
      &item
    )
    if status == errSecItemNotFound {
      return nil
    }
    guard status == errSecSuccess else {
      throw BridgeError.keychain(status)
    }
    return item as? Data
  }

  private func writeKeychain(
    _ data: Data,
    service: String,
    account: String
  ) throws {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
    let attributes: [String: Any] = [
      kSecValueData as String: data,
      kSecAttrAccessible as String:
        kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    ]

    let updateStatus = SecItemUpdate(
      query as CFDictionary,
      attributes as CFDictionary
    )
    if updateStatus == errSecSuccess {
      return
    }
    if updateStatus != errSecItemNotFound {
      throw BridgeError.keychain(updateStatus)
    }

    var insert = query
    for (key, value) in attributes {
      insert[key] = value
    }
    let addStatus = SecItemAdd(
      insert as CFDictionary,
      nil
    )
    guard addStatus == errSecSuccess else {
      throw BridgeError.keychain(addStatus)
    }
  }

  private func deleteKeychain(
    service: String,
    account: String
  ) throws {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
    let status = SecItemDelete(query as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw BridgeError.keychain(status)
    }
  }

  private enum BridgeError: LocalizedError {
    case invalidSession
    case keychain(OSStatus)

    var errorDescription: String? {
      switch self {
      case .invalidSession:
        return "Invalid secure session payload"
      case .keychain(let status):
        return "Keychain operation failed: \(status)"
      }
    }
  }
}
