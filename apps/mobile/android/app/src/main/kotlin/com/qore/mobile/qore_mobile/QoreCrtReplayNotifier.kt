package com.qore.mobile.qore_mobile

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import java.security.MessageDigest
import org.json.JSONObject

/**
 * Optional Android system notification from the EXISTING authenticated
 * QORE Mobile widget service. This is NOT FCM and NOT certified CRT.
 *
 * It operates only when the Owner explicitly opts in, Widget LIVE is
 * already running, and the backend returns a valid OFFLINE_REPLAY row.
 * No notification is generated from an unauthenticated or expired event.
 */
internal object QoreCrtReplayNotifier {
    const val CONSENT_KEY = "crt_qa_notices_opt_in"
    private const val WIDGET_PREFS = "qore_widget"
    private const val SEEN_PREFS = "qore_crt_qa_notice_dedup_v1"
    private const val CHANNEL_ID = "qore_crt_lab_replay_v1"

    fun maybeNotify(context: Context, response: JSONObject, nowMs: Long) {
        val widget = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
        if (!widget.getBoolean(CONSENT_KEY, false) ||
            !widget.getBoolean("widget_live_enabled", false)) return
        if (Build.VERSION.SDK_INT >= 33 &&
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED) return

        val preview = QoreCrtWidgetSummary.latest(response, nowMs) ?: return
        val remaining = preview.expiresAtMs - nowMs
        if (remaining <= 0 || remaining > 14_400_000L) return

        // Persist only a digest and at most the event's remaining 4h expiry.
        // No prices, tokens, trader IDs, account IDs or message payloads.
        val hash = MessageDigest.getInstance("SHA-256")
            .digest(preview.id.toByteArray(Charsets.UTF_8))
            .take(12).joinToString("") { "%02x".format(it) }
        val seen = context.getSharedPreferences(SEEN_PREFS, Context.MODE_PRIVATE)
        if (seen.getLong(hash, 0L) > nowMs) return
        val editor = seen.edit()
        for ((key, raw) in seen.all) {
            if (raw is Long && raw <= nowMs) editor.remove(key)
        }
        // Idempotence persists across widget-service restart, but expires <=4h.
        if (!editor.putLong(hash, preview.expiresAtMs).commit()) return

        val notifications = context.getSystemService(
            Context.NOTIFICATION_SERVICE
        ) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            notifications.createNotificationChannel(NotificationChannel(
                CHANNEL_ID,
                "CRT Alerts · Laboratorio QA",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Pruebas técnicas no operables; nunca señales reales."
                enableVibration(false)
            })
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pending = PendingIntent.getActivity(
            context,
            31054,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            Notification.Builder(context, CHANNEL_ID)
        else Notification.Builder(context)

        val direction = if (preview.eventType == "MSS_M15_OBSERVED")
            "MSS M15" else if (preview.eventType == "MSS_M5_OBSERVED")
            "MSS M5" else "CRT"
        notification.setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("QORE CRT · Replay QA, NO OPERAR")
            .setContentText(preview.symbol + " · " + direction +
                " · M5 " + preview.mssM5 + " / M15 " + preview.mssM15)
            .setStyle(Notification.BigTextStyle().bigText(
                "Prueba de recepción desde QORE Mobile Gateway: " +
                preview.symbol + ", familia " + preview.family + ". " +
                "MSS M5 " + preview.mssM5 + "; MSS M15 " + preview.mssM15 +
                ". No es una señal de mercado certificada ni una orden."
            ))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_STATUS)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            notification.setTimeoutAfter(remaining)
        notifications.notify(hash.hashCode(), notification.build())
    }

    fun disable(context: Context) {
        context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(CONSENT_KEY, false).commit()
    }
}
