package com.qore.mobile.qore_mobile

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.provider.Settings
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
    private const val CHANNEL_ID = "qore_crt_lab_replay_v2"


    /**
     * Dedicated Android channel for CRT QA notices. Android owns the
     * final sound/vibration preference from this channel's settings.
     * Version v2 is intentional: a v1 channel's sound/vibration cannot
     * be changed by code after first creation.
     *
     * A dedicated channel does NOT turn the replay into a market signal.
     */
    fun ensureCrtQaChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE)
            as NotificationManager
        manager.createNotificationChannel(NotificationChannel(
            CHANNEL_ID,
            "QORE CRT · Avisos QA (tono/vibración)",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Avisos CRT de laboratorio, independientes del resto de QORE. NO OPERAR."
            enableVibration(true)
            setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                    .build()
            )
        })
    }

    /**
     * Opens Android's own per-channel preferences: sound, vibration, quiet.
     * Users' choices prevail over initial app defaults. Does NOT enable
     * alerts or request a market feed.
     */
    fun openCrtQaNotificationSettings(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
        ensureCrtQaChannel(context)
        return try {
            val intent = Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                putExtra(Settings.EXTRA_CHANNEL_ID, CHANNEL_ID)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            true
        } catch (_: android.content.ActivityNotFoundException) {
            false
        } catch (_: SecurityException) {
            false
        }
    }

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
        ensureCrtQaChannel(context)

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


    /**
     * One user-tapped test of Android's local notification UI.
     * NO Railway, Firebase, CRT market event, account, order or automatic
     * permission/subscription. Success means posted, NOT seen or delivered.
     */
    fun showLocalConnectionTest(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 33 &&
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED) return false

        // Preview uses the SAME dedicated CRT QA notification channel as
        // real QA replay notices, testing the configured ringtone/vibration.
        val channel = CHANNEL_ID
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE)
            as NotificationManager
        ensureCrtQaChannel(context)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (manager.areNotificationsEnabled().not()) return false
            if (manager.getNotificationChannel(channel)?.importance ==
                NotificationManager.IMPORTANCE_NONE) return false
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pending = PendingIntent.getActivity(
            context, 31056, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notice = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            Notification.Builder(context, channel)
        else Notification.Builder(context)
        notice.setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("QORE Mobile · PRUEBA LOCAL")
            .setContentText("Notificación de Android. NO procede del VPS ni es CRT.")
            .setStyle(Notification.BigTextStyle().bigText(
                "Prueba local solicitada desde QORE Mobile. NO prueba " +
                    "la conexión a Railway, Firebase, cTrader o al detector CRT. " +
                    "No es una señal ni una orden de trading.",
            ))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_STATUS)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            notice.setTimeoutAfter(60_000L)
        manager.notify(31056, notice.build())
        return true
    }

    fun disable(context: Context) {
        // Opt-out revokes future delivery AND removes already posted QA cards.
        // Keep the hashes until each event's 4h expiry to prevent re-notify
        // after rapidly toggling the preference.
        context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(CONSENT_KEY, false).commit()
        val seen = context.getSharedPreferences(SEEN_PREFS, Context.MODE_PRIVATE)
        val notifications = context.getSystemService(
            Context.NOTIFICATION_SERVICE
        ) as NotificationManager
        for ((key, _) in seen.all) {
            if (key.length == 24 && key.all {
                it in '0'..'9' || it in 'a'..'f'
            }) {
                notifications.cancel(key.hashCode())
            }
        }
    }
}
