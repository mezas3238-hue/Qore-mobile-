package com.qore.mobile.qore_mobile

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.RemoteViews
import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import org.json.JSONObject

class QoreWidgetProvider : AppWidgetProvider() {
    companion object {
        private const val PREFS = "qore_widget"
        private const val SNAPSHOT = "snapshot_json"
        private const val EXPANDED_MIN_WIDTH_DP = 250

        fun updateAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, QoreWidgetProvider::class.java)
            val ids = manager.getAppWidgetIds(component)
            for (id in ids) {
                updateWidget(context, manager, id)
            }
        }

        private fun updateWidget(
            context: Context,
            manager: AppWidgetManager,
            appWidgetId: Int,
        ) {
            val minWidth = manager.getAppWidgetOptions(appWidgetId)
                .getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
            val layout = if (minWidth >= EXPANDED_MIN_WIDTH_DP) {
                R.layout.qore_widget
            } else {
                R.layout.qore_widget_compact
            }
            val views = RemoteViews(context.packageName, layout)
            val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(SNAPSHOT, null)

            val launchIntent = Intent(context, MainActivity::class.java)
            val pending = PendingIntent.getActivity(
                context,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.qore_widget_root, pending)

            if (raw.isNullOrBlank()) {
                renderUnavailable(views, "SIN DATOS")
                manager.updateAppWidget(appWidgetId, views)
                return
            }

            try {
                val json = JSONObject(raw)
                val expiresAt = Instant.parse(json.getString("expires_at"))
                val expired = Instant.now().isAfter(expiresAt)
                if (expired) {
                    renderUnavailable(views, "STALE")
                    val generated = Instant.parse(json.getString("generated_at"))
                    views.setTextViewText(
                        R.id.qore_widget_updated,
                        "Última: " + formatTime(generated),
                    )
                } else {
                    val formatter = NumberFormat.getNumberInstance()
                    formatter.maximumFractionDigits = 2
                    formatter.minimumFractionDigits = 2

                    views.setTextViewText(
                        R.id.qore_widget_equity,
                        json.optDouble("equity")
                            .takeUnless { it.isNaN() }
                            ?.let { formatter.format(it) } ?: "—",
                    )
                    views.setTextViewText(
                        R.id.qore_widget_pnl,
                        json.optDouble("realized_pnl_today")
                            .takeUnless { it.isNaN() }
                            ?.let { formatter.format(it) } ?: "—",
                    )
                    val dd = if (json.isNull("daily_drawdown_fraction")) {
                        "—"
                    } else {
                        String.format(
                            "%.2f%%",
                            json.getDouble("daily_drawdown_fraction") * 100.0,
                        )
                    }
                    views.setTextViewText(R.id.qore_widget_dd, dd)
                    views.setTextViewText(
                        R.id.qore_widget_positions,
                        json.optInt("active_positions", 0).toString(),
                    )
                    val healthy = json.optInt("healthy_runtimes", 0)
                    val total = json.optInt("total_runtimes", 0)
                    views.setTextViewText(
                        R.id.qore_widget_runtimes,
                        "$healthy/$total",
                    )
                    views.setTextViewText(
                        R.id.qore_widget_status,
                        json.optString("freshness", "unknown").uppercase(),
                    )
                    views.setTextViewText(
                        R.id.qore_widget_updated,
                        "Actualizado: " +
                            formatTime(Instant.parse(json.getString("generated_at"))),
                    )
                }
            } catch (_: Exception) {
                renderUnavailable(views, "ERROR")
            }

            manager.updateAppWidget(appWidgetId, views)
        }

        private fun renderUnavailable(views: RemoteViews, status: String) {
            views.setTextViewText(R.id.qore_widget_equity, "—")
            views.setTextViewText(R.id.qore_widget_pnl, "—")
            views.setTextViewText(R.id.qore_widget_dd, "—")
            views.setTextViewText(R.id.qore_widget_positions, "—")
            views.setTextViewText(R.id.qore_widget_runtimes, "—")
            views.setTextViewText(R.id.qore_widget_status, status)
        }

        private fun formatTime(value: Instant): String {
            return DateTimeFormatter.ofPattern("HH:mm:ss")
                .withZone(ZoneId.systemDefault())
                .format(value)
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        updateAll(context)
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle,
    ) {
        updateAll(context)
    }
}
