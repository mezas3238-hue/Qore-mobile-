package com.qore.mobile.qore_mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

class QoreWidgetBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED &&
            intent?.action != Intent.ACTION_MY_PACKAGE_REPLACED
        ) {
            return
        }
        val prefs = context.getSharedPreferences("qore_widget", Context.MODE_PRIVATE)
        if (!prefs.getBoolean("widget_live_enabled", false)) {
            return
        }
        ContextCompat.startForegroundService(
            context,
            Intent(context, QoreWidgetLiveService::class.java),
        )
    }
}
