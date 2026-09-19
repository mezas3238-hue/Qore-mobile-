package com.qore.mobile.qore_mobile

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.nio.ByteBuffer
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONObject

class MainActivity : FlutterFragmentActivity() {
    companion object {
        private const val CHANNEL = "qore.mobile/security"
        private const val SIGNING_ALIAS = "qore_mobile_device_p256_v1"
        private const val SESSION_KEY_ALIAS = "qore_mobile_session_aes_v1"
        private const val IDENTITY_PREFS = "qore_identity"
        private const val SESSION_PREFS = "qore_secure_session"
        private const val WIDGET_PREFS = "qore_widget"
        private const val SESSION_BLOB = "session_blob"
        private const val DEVICE_ID = "device_id"
        private const val WIDGET_SNAPSHOT = "snapshot_json"
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            CHANNEL,
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "ensureEnrollmentIdentity" -> runCrypto(result) {
                    enrollmentIdentity()
                }
                "sign" -> runCrypto(result) {
                    val encoded = call.argument<String>("message_b64")
                        ?: error("message_b64 is required")
                    sign(Base64.decode(encoded, Base64.DEFAULT))
                }
                "readSession" -> runCrypto(result) {
                    readSession()
                }
                "saveSession" -> runCrypto(result) {
                    saveSession(call)
                    null
                }
                "clearSession" -> runCrypto(result) {
                    clearSession()
                    null
                }
                "authenticateOwner" -> authenticateOwner(call, result)
                "publishWidgetSnapshot" -> {
                    val snapshot = call.argument<String>("snapshot_json")
                    if (snapshot.isNullOrBlank()) {
                        result.error(
                            "INVALID_WIDGET_SNAPSHOT",
                            "snapshot_json is required",
                            null,
                        )
                    } else {
                        getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
                            .edit()
                            .putString(WIDGET_SNAPSHOT, snapshot)
                            .apply()
                        QoreWidgetProvider.updateAll(this)
                        result.success(null)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun runCrypto(
        result: MethodChannel.Result,
        block: () -> Any?,
    ) {
        Thread {
            try {
                val value = block()
                runOnUiThread { result.success(value) }
            } catch (error: Exception) {
                runOnUiThread {
                    result.error(
                        "NATIVE_SECURITY_ERROR",
                        error.message ?: "Native security operation failed",
                        null,
                    )
                }
            }
        }.start()
    }

    private fun enrollmentIdentity(): Map<String, Any> {
        val keyPair = getOrCreateSigningKey()
        val prefs = getSharedPreferences(IDENTITY_PREFS, Context.MODE_PRIVATE)
        var deviceId = prefs.getString(DEVICE_ID, null)
        if (deviceId.isNullOrBlank()) {
            deviceId = UUID.randomUUID().toString()
            prefs.edit().putString(DEVICE_ID, deviceId).commit()
        }

        return mapOf(
            "device_id" to deviceId,
            "platform" to "android",
            "public_key_b64" to Base64.encodeToString(
                keyPair.public.encoded,
                Base64.NO_WRAP,
            ),
            "key_algorithm" to "p256-spki",
        )
    }

    private fun getOrCreateSigningKey(): KeyPair {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val certificate = keyStore.getCertificate(SIGNING_ALIAS)
        val privateKey = keyStore.getKey(SIGNING_ALIAS, null)
        if (certificate != null && privateKey != null) {
            return KeyPair(certificate.publicKey, privateKey as java.security.PrivateKey)
        }

        val generator = KeyPairGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_EC,
            "AndroidKeyStore",
        )
        val spec = KeyGenParameterSpec.Builder(
            SIGNING_ALIAS,
            KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY,
        )
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)
            .build()
        generator.initialize(spec)
        return generator.generateKeyPair()
    }

    private fun sign(message: ByteArray): String {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val privateKey = keyStore.getKey(
            SIGNING_ALIAS,
            null,
        ) as? java.security.PrivateKey
            ?: getOrCreateSigningKey().private

        val signer = Signature.getInstance("SHA256withECDSA")
        signer.initSign(privateKey)
        signer.update(message)
        return Base64.encodeToString(signer.sign(), Base64.NO_WRAP)
    }

    private fun getOrCreateSessionKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = keyStore.getKey(SESSION_KEY_ALIAS, null)
        if (existing is SecretKey) {
            return existing
        }

        val generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore",
        )
        val spec = KeyGenParameterSpec.Builder(
            SESSION_KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()
        generator.init(spec)
        return generator.generateKey()
    }

    private fun encryptSession(json: String): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSessionKey())
        val ciphertext = cipher.doFinal(json.toByteArray(Charsets.UTF_8))
        val iv = cipher.iv
        val packed = ByteBuffer.allocate(4 + iv.size + ciphertext.size)
            .putInt(iv.size)
            .put(iv)
            .put(ciphertext)
            .array()
        return Base64.encodeToString(packed, Base64.NO_WRAP)
    }

    private fun decryptSession(encoded: String): String {
        val packed = ByteBuffer.wrap(Base64.decode(encoded, Base64.DEFAULT))
        val ivSize = packed.int
        require(ivSize in 12..32) { "Invalid session IV" }
        val iv = ByteArray(ivSize).also { packed.get(it) }
        val ciphertext = ByteArray(packed.remaining()).also { packed.get(it) }

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.DECRYPT_MODE,
            getOrCreateSessionKey(),
            GCMParameterSpec(128, iv),
        )
        return String(cipher.doFinal(ciphertext), Charsets.UTF_8)
    }

    private fun saveSession(call: MethodCall) {
        val keys = listOf(
            "device_id",
            "access_token",
            "access_expires_at",
            "refresh_token",
            "refresh_expires_at",
        )
        val json = JSONObject()
        for (key in keys) {
            val value = call.argument<String>(key)
                ?: error("$key is required")
            json.put(key, value)
        }

        val encrypted = encryptSession(json.toString())
        getSharedPreferences(SESSION_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(SESSION_BLOB, encrypted)
            .commit()
    }

    private fun readSession(): Map<String, Any?>? {
        val encoded = getSharedPreferences(
            SESSION_PREFS,
            Context.MODE_PRIVATE,
        ).getString(SESSION_BLOB, null) ?: return null

        return try {
            val json = JSONObject(decryptSession(encoded))
            mapOf(
                "device_id" to json.getString("device_id"),
                "access_token" to json.getString("access_token"),
                "access_expires_at" to json.getString("access_expires_at"),
                "refresh_token" to json.getString("refresh_token"),
                "refresh_expires_at" to json.getString("refresh_expires_at"),
            )
        } catch (_: Exception) {
            clearSession()
            null
        }
    }

    private fun clearSession() {
        getSharedPreferences(SESSION_PREFS, Context.MODE_PRIVATE)
            .edit()
            .remove(SESSION_BLOB)
            .commit()
    }

    private fun authenticateOwner(
        call: MethodCall,
        result: MethodChannel.Result,
    ) {
        val reason = call.argument<String>("reason") ?: "Desbloquear QORE Mobile"
        val executor = ContextCompat.getMainExecutor(this)
        val prompt = BiometricPrompt(
            this,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(
                    authResult: BiometricPrompt.AuthenticationResult,
                ) {
                    result.success(true)
                }

                override fun onAuthenticationError(
                    errorCode: Int,
                    errString: CharSequence,
                ) {
                    result.success(false)
                }

                override fun onAuthenticationFailed() {
                    // Keep the prompt open; final success/error is reported later.
                }
            },
        )

        val authenticators =
            BiometricManager.Authenticators.BIOMETRIC_STRONG or
                BiometricManager.Authenticators.DEVICE_CREDENTIAL
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle("QORE Mobile")
            .setSubtitle(reason)
            .setAllowedAuthenticators(authenticators)
            .build()
        prompt.authenticate(info)
    }
}
