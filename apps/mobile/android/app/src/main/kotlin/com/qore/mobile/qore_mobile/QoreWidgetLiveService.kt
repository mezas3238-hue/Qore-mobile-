package com.qore.mobile.qore_mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.security.keystore.KeyProperties
import android.util.Base64
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL
import java.nio.ByteBuffer
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.Signature
import java.time.Instant
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlin.math.max
import org.json.JSONArray
import org.json.JSONObject

class QoreWidgetLiveService : Service() {
    companion object {
        private const val CHANNEL_ID = "qore_widget_live"
        private const val NOTIFICATION_ID = 31031
        private const val WIDGET_PREFS = "qore_widget"
        private const val WIDGET_SNAPSHOT = "snapshot_json"
        private const val WIDGET_LIVE_ENABLED = "widget_live_enabled"
        private const val WIDGET_GATEWAY_URL = "widget_gateway_url"
        private const val WIDGET_ACTIVE_INTERVAL_SECONDS = "widget_active_interval_seconds"
        private const val WIDGET_SCREEN_OFF_INTERVAL_SECONDS = "widget_screen_off_interval_seconds"
        private const val WIDGET_APP_FOREGROUND = "widget_app_foreground"
        private const val IDENTITY_PREFS = "qore_identity"
        private const val DEVICE_ID = "device_id"

        private const val SESSION_PREFS = "qore_secure_session"
        private const val SESSION_BLOB = "session_blob"
        private const val SESSION_KEY_ALIAS = "qore_mobile_session_aes_v1"
        private const val SIGNING_ALIAS = "qore_mobile_device_p256_v1"

        private const val DASHBOARD_PATH = "/v1/dashboard"
        private const val REFRESH_PATH = "/v1/mobile/refresh"
        private const val RECOVER_PATH = "/v1/mobile/recover"
    }

    private val running = AtomicBoolean(false)
    private val worker = Executors.newSingleThreadExecutor()
    private val random = SecureRandom()

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val prefs = getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(WIDGET_LIVE_ENABLED, false)) {
            stopSelf()
            return START_NOT_STICKY
        }

        if (running.compareAndSet(false, true)) {
            worker.execute { runLoop() }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        running.set(false)
        worker.shutdownNow()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun runLoop() {
        while (running.get()) {
            val cycleStart = System.currentTimeMillis()
            try {
                val prefs = getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
                if (!prefs.getBoolean(WIDGET_LIVE_ENABLED, false)) {
                    stopSelf()
                    return
                }

                val appForeground =
                    prefs.getBoolean(WIDGET_APP_FOREGROUND, false)
                if (!appForeground) {
                    refreshWidget(prefs)
                }
            } catch (_: InterruptedException) {
                return
            } catch (_: Exception) {
                // Fail closed: keep the last sanitized widget snapshot. The next
                // cycle retries without changing trading/runtime state.
            }

            val prefs = getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
            val intervalSeconds =
                prefs.getInt(WIDGET_ACTIVE_INTERVAL_SECONDS, 2).coerceIn(2, 60)
            val elapsed = System.currentTimeMillis() - cycleStart
            val sleepMs = max(250L, intervalSeconds * 1000L - elapsed)
            try {
                Thread.sleep(sleepMs)
            } catch (_: InterruptedException) {
                return
            }
        }
    }

    private fun refreshWidget(prefs: android.content.SharedPreferences) {
        val gateway = prefs.getString(WIDGET_GATEWAY_URL, null)
            ?.trimEnd('/')
            ?.takeIf { it.startsWith("https://") }
            ?: return

        var session = readSession() ?: recoverSession(gateway) ?: return
        if (expiresSoon(session.optString("access_expires_at"))) {
            session = refreshSession(gateway, session)
                ?: recoverSession(gateway)
                ?: return
        }

        var response = request(
            gateway = gateway,
            path = DASHBOARD_PATH,
            method = "GET",
            token = session.optString("access_token"),
            deviceId = session.optString("device_id"),
        )

        if (response.code == HttpURLConnection.HTTP_UNAUTHORIZED) {
            val latest = readSession()
            if (latest != null &&
                latest.optString("access_token") != session.optString("access_token")
            ) {
                session = latest
                response = request(
                    gateway = gateway,
                    path = DASHBOARD_PATH,
                    method = "GET",
                    token = session.optString("access_token"),
                    deviceId = session.optString("device_id"),
                )
            } else {
                val refreshed = refreshSession(gateway, latest ?: session)
                    ?: recoverSession(gateway)
                if (refreshed != null) {
                    session = refreshed
                    response = request(
                        gateway = gateway,
                        path = DASHBOARD_PATH,
                        method = "GET",
                        token = session.optString("access_token"),
                        deviceId = session.optString("device_id"),
                    )
                }
            }
        }

        if (response.code != HttpURLConnection.HTTP_OK) {
            return
        }

        val dashboard = JSONObject(response.body)
        val snapshot = widgetSnapshot(dashboard)
        prefs.edit()
            .putString(WIDGET_SNAPSHOT, snapshot.toString())
            .apply()
        QoreWidgetProvider.updateAll(this)
    }

    private fun refreshSession(
        gateway: String,
        session: JSONObject,
    ): JSONObject? {
        val refreshToken = session.optString("refresh_token")
        val deviceId = session.optString("device_id")
        if (refreshToken.isBlank() || deviceId.isBlank()) return null

        val response = request(
            gateway = gateway,
            path = REFRESH_PATH,
            method = "POST",
            token = refreshToken,
            deviceId = deviceId,
        )
        if (response.code == HttpURLConnection.HTTP_UNAUTHORIZED) {
            val latest = readSession()
            if (latest != null &&
                latest.optString("refresh_token") != refreshToken
            ) {
                return latest
            }
            return null
        }
        if (response.code != HttpURLConnection.HTTP_OK) return null

        val refreshed = JSONObject(response.body)
        if (refreshed.optString("device_id") != deviceId) return null
        if (refreshed.optString("access_token").isBlank() ||
            refreshed.optString("refresh_token").isBlank()
        ) {
            return null
        }
        saveSession(refreshed)
        return refreshed
    }

    private fun recoverSession(gateway: String): JSONObject? {
        val deviceId = getSharedPreferences(
            IDENTITY_PREFS,
            Context.MODE_PRIVATE,
        ).getString(DEVICE_ID, null) ?: return null

        val response = request(
            gateway = gateway,
            path = RECOVER_PATH,
            method = "POST",
            token = null,
            deviceId = deviceId,
        )
        if (response.code != HttpURLConnection.HTTP_OK) return null

        val recovered = JSONObject(response.body)
        if (recovered.optString("device_id") != deviceId) return null
        if (recovered.optString("access_token").isBlank() ||
            recovered.optString("refresh_token").isBlank()
        ) {
            return null
        }
        saveSession(recovered)
        return recovered
    }

    private data class HttpResult(
        val code: Int,
        val body: String,
    )

    private fun request(
        gateway: String,
        path: String,
        method: String,
        token: String?,
        deviceId: String,
    ): HttpResult {
        if (deviceId.isBlank()) {
            return HttpResult(HttpURLConnection.HTTP_UNAUTHORIZED, "")
        }

        val timestamp = DateTimeFormatter.ISO_INSTANT.format(Instant.now())
        val nonceBytes = ByteArray(24).also { random.nextBytes(it) }
        val nonce = Base64.encodeToString(
            nonceBytes,
            Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING,
        )
        val emptyHash = MessageDigest.getInstance("SHA-256")
            .digest(ByteArray(0))
            .joinToString("") { "%02x".format(it) }
        val canonical = buildString {
            append(method.uppercase())
            append('\n')
            append(path)
            append('\n')
            append(timestamp)
            append('\n')
            append(nonce)
            append('\n')
            append(emptyHash)
        }.toByteArray(Charsets.UTF_8)
        val signature = sign(canonical) ?: return HttpResult(401, "")

        val connection = URL(gateway + path).openConnection() as HttpURLConnection
        return try {
            connection.requestMethod = method
            connection.connectTimeout = 4000
            connection.readTimeout = 4000
            connection.instanceFollowRedirects = false
            if (!token.isNullOrBlank()) {
                connection.setRequestProperty("Authorization", "Bearer $token")
            }
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("X-Qore-Device-Id", deviceId)
            connection.setRequestProperty("X-Qore-Device-Time", timestamp)
            connection.setRequestProperty("X-Qore-Device-Nonce", nonce)
            connection.setRequestProperty("X-Qore-Device-Signature", signature)

            val code = connection.responseCode
            val stream = if (code in 200..299) {
                connection.inputStream
            } else {
                connection.errorStream
            }
            val body = stream?.bufferedReader()?.use(BufferedReader::readText) ?: ""
            HttpResult(code, body)
        } finally {
            connection.disconnect()
        }
    }

    private fun widgetSnapshot(dashboard: JSONObject): JSONObject {
        val now = Instant.now()
        val portfolio = dashboard.optJSONObject("portfolio") ?: JSONObject()
        val accounts = dashboard.optJSONArray("accounts") ?: JSONArray()
        val runtimes = dashboard.optJSONArray("runtimes") ?: JSONArray()
        val traders = dashboard.optJSONArray("traders") ?: JSONArray()

        var healthyRuntimes = 0
        var latestHeartbeat: Instant? = null
        for (index in 0 until runtimes.length()) {
            val runtime = runtimes.optJSONObject(index) ?: continue
            if (runtime.optString("freshness") == "live") healthyRuntimes += 1
            val raw = runtime.optString("last_heartbeat")
            parseInstant(raw)?.let { heartbeat ->
                if (latestHeartbeat == null || heartbeat.isAfter(latestHeartbeat)) {
                    latestHeartbeat = heartbeat
                }
            }
        }

        val traderNames = JSONArray()
        for (index in 0 until traders.length()) {
            val name = traders.optJSONObject(index)?.optString("name").orEmpty()
            if (name.isNotBlank()) traderNames.put(name)
        }

        val snapshot = JSONObject()
            .put("schema_version", "2")
            .put("generated_at", now.toString())
            .put("expires_at", now.plusSeconds(30).toString())
            .put("active_positions", portfolio.optInt("active_positions", 0))
            .put("healthy_runtimes", healthyRuntimes)
            .put("total_runtimes", runtimes.length())
            .put("freshness", portfolio.optString("freshness", "unknown"))
            .put(
                "mode",
                accounts.optJSONObject(0)?.optString("mode", "unknown") ?: "unknown",
            )
            .put(
                "last_heartbeat",
                latestHeartbeat?.toString() ?: JSONObject.NULL,
            )
            .put("trader_names", traderNames)

        copyNullableNumber(snapshot, "balance", portfolio, "balance")
        copyNullableNumber(snapshot, "equity", portfolio, "equity")
        copyNullableNumber(
            snapshot,
            "realized_pnl_today",
            portfolio,
            "realized_pnl_today",
        )
        copyNullableNumber(snapshot, "floating_pnl", portfolio, "floating_pnl")
        copyNullableNumber(
            snapshot,
            "daily_drawdown_fraction",
            portfolio,
            "daily_drawdown_fraction",
        )
        return snapshot
    }

    private fun copyNullableNumber(
        target: JSONObject,
        targetKey: String,
        source: JSONObject,
        sourceKey: String,
    ) {
        if (!source.has(sourceKey) || source.isNull(sourceKey)) {
            target.put(targetKey, JSONObject.NULL)
        } else {
            target.put(targetKey, source.getDouble(sourceKey))
        }
    }

    private fun readSession(): JSONObject? {
        val encoded = getSharedPreferences(
            SESSION_PREFS,
            Context.MODE_PRIVATE,
        ).getString(SESSION_BLOB, null) ?: return null

        return try {
            JSONObject(decryptSession(encoded))
        } catch (_: Exception) {
            null
        }
    }

    private fun saveSession(session: JSONObject) {
        val encrypted = encryptSession(session.toString())
        getSharedPreferences(SESSION_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(SESSION_BLOB, encrypted)
            .commit()
    }

    private fun decryptSession(encoded: String): String {
        val packed = ByteBuffer.wrap(Base64.decode(encoded, Base64.DEFAULT))
        val ivSize = packed.int
        require(ivSize in 12..32) { "Invalid session IV" }
        val iv = ByteArray(ivSize).also { packed.get(it) }
        val ciphertext = ByteArray(packed.remaining()).also { packed.get(it) }

        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val key = keyStore.getKey(SESSION_KEY_ALIAS, null) as? SecretKey
            ?: error("QORE session key unavailable")
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, iv))
        return String(cipher.doFinal(ciphertext), Charsets.UTF_8)
    }

    private fun encryptSession(json: String): String {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val key = keyStore.getKey(SESSION_KEY_ALIAS, null) as? SecretKey
            ?: error("QORE session key unavailable")
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val ciphertext = cipher.doFinal(json.toByteArray(Charsets.UTF_8))
        val iv = cipher.iv
        val packed = ByteBuffer.allocate(4 + iv.size + ciphertext.size)
            .putInt(iv.size)
            .put(iv)
            .put(ciphertext)
            .array()
        return Base64.encodeToString(packed, Base64.NO_WRAP)
    }

    private fun sign(message: ByteArray): String? {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val privateKey = keyStore.getKey(
            SIGNING_ALIAS,
            null,
        ) as? java.security.PrivateKey ?: return null
        val signer = Signature.getInstance("SHA256withECDSA")
        signer.initSign(privateKey)
        signer.update(message)
        return Base64.encodeToString(signer.sign(), Base64.NO_WRAP)
    }

    private fun expiresSoon(raw: String): Boolean {
        val expiry = parseInstant(raw) ?: return true
        return !expiry.isAfter(Instant.now().plusSeconds(30))
    }

    private fun parseInstant(raw: String): Instant? {
        if (raw.isBlank()) return null
        return try {
            OffsetDateTime.parse(raw).toInstant()
        } catch (_: Exception) {
            try {
                Instant.parse(raw)
            } catch (_: Exception) {
                null
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            CHANNEL_ID,
            "QORE Widget LIVE",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Supervisión read-only del widget QORE en tiempo real."
            setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val openApp = Intent(this, MainActivity::class.java)
        val pending = PendingIntent.getActivity(
            this,
            0,
            openApp,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("QORE Widget LIVE")
            .setContentText("Supervisión read-only activa · actualización ~2 s continua")
            .setContentIntent(pending)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .build()
    }
}
