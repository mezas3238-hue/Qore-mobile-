package com.qore.mobile.qore_mobile

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.util.TypedValue
import android.widget.RemoteViews
import java.text.NumberFormat
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import org.json.JSONObject

class QoreWidgetProvider : AppWidgetProvider() {
    companion object {
        private const val PREFS = "qore_widget"
        private const val SNAPSHOT = "snapshot_json"
        private const val APPEARANCE = "appearance_json"
        private const val NORMAL_MIN_WIDTH = 250
        private const val DETAIL_MIN_HEIGHT = 220

        fun updateAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, QoreWidgetProvider::class.java))
            ids.forEach { updateWidget(context, manager, it) }
        }

        private fun updateWidget(context: Context, manager: AppWidgetManager, id: Int) {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val appearance = JSONObject(prefs.getString(APPEARANCE, "{}") ?: "{}")
            val opts = manager.getAppWidgetOptions(id)
            val width = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
            val height = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
            val level = appearance.optString("info_level", "detailed")
            val layout = when {
                level == "compact" || width < NORMAL_MIN_WIDTH -> R.layout.qore_widget_compact
                level == "normal" || height < DETAIL_MIN_HEIGHT -> R.layout.qore_widget
                else -> R.layout.qore_widget_detailed
            }
            val views = RemoteViews(context.packageName, layout)
            style(views, appearance)
            views.setOnClickPendingIntent(
                R.id.qore_widget_root,
                PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE),
            )
            val raw = prefs.getString(SNAPSHOT, null)
            if (raw.isNullOrBlank()) {
                unavailable(views, "SIN DATOS")
                manager.updateAppWidget(id, views)
                return
            }
            try {
                val json = JSONObject(raw)
                val generated = Instant.parse(json.getString("generated_at"))
                if (Instant.now().isAfter(Instant.parse(json.getString("expires_at")))) {
                    unavailable(views, "STALE")
                    views.setTextViewText(R.id.qore_widget_updated, "Última: ${formatTime(generated)}")
                    manager.updateAppWidget(id, views)
                    return
                }
                val nf = NumberFormat.getNumberInstance().apply { minimumFractionDigits = 2; maximumFractionDigits = 2 }
                fun money(key: String): String {
                    if (json.isNull(key)) return "—"
                    val v = json.optDouble(key, Double.NaN)
                    return if (v.isNaN()) "—" else nf.format(v)
                }
                views.setTextViewText(R.id.qore_widget_balance, money("balance"))
                views.setTextViewText(R.id.qore_widget_equity, money("equity"))
                views.setTextViewText(R.id.qore_widget_pnl, money("realized_pnl_today"))
                val dd = if (json.isNull("daily_drawdown_fraction")) "—" else String.format("%.2f%%", json.getDouble("daily_drawdown_fraction") * 100)
                views.setTextViewText(R.id.qore_widget_dd, dd)
                views.setTextViewText(R.id.qore_widget_positions, json.optInt("active_positions", 0).toString())
                views.setTextViewText(R.id.qore_widget_runtimes, "${json.optInt("healthy_runtimes",0)}/${json.optInt("total_runtimes",0)}")
                views.setTextViewText(R.id.qore_widget_mode, json.optString("mode", "unknown").uppercase())
                val freshness = json.optString("freshness", "unknown").uppercase()
                val hb = if (json.isNull("last_heartbeat")) null else runCatching { Instant.parse(json.getString("last_heartbeat")) }.getOrNull()
                val age = hb?.let { Duration.between(it, Instant.now()).seconds.coerceAtLeast(0) }
                val status = if (appearance.optBoolean("show_heartbeat_age", true) && age != null) "$freshness · ${age}s" else freshness
                views.setTextViewText(R.id.qore_widget_status, status)
                views.setTextColor(R.id.qore_widget_status, freshnessColor(freshness))
                val names = json.optJSONArray("trader_names")
                val lines = mutableListOf<String>()
                if (names != null) {
                    val keep = minOf(3, names.length())
                    for (i in 0 until keep) lines += "• ${names.optString(i)}"
                    if (names.length() > keep) lines += "+${names.length() - keep} más"
                }
                views.setTextViewText(R.id.qore_widget_traders, if (lines.isEmpty()) "Sin traders" else lines.joinToString("\n"))
                views.setTextViewText(R.id.qore_widget_updated, if (appearance.optBoolean("show_exact_time", false)) "Actualizado: ${formatTime(generated)}" else "Snapshot seguro")
            } catch (_: Exception) {
                unavailable(views, "ERROR")
            }
            manager.updateAppWidget(id, views)
        }

        private fun style(views: RemoteViews, appearance: JSONObject) {
            val kind = appearance.optString("background", "solid")
            val bg = when (kind) {
                "glass" -> R.drawable.qore_widget_bg_glass
                "high_contrast" -> R.drawable.qore_widget_bg_high_contrast
                else -> R.drawable.qore_widget_bg_solid
            }
            val light = kind == "high_contrast"
            val fg = if (light) Color.BLACK else Color.WHITE
            val muted = if (light) Color.DKGRAY else Color.LTGRAY
            val accent = appearance.optLong("accent_argb", 0xFF4F46E5).toInt()
            val scale = appearance.optDouble("text_scale", 1.0).toFloat().coerceIn(.85f, 1.25f)
            views.setInt(R.id.qore_widget_root, "setBackgroundResource", bg)
            listOf(R.id.qore_widget_title,R.id.qore_widget_balance,R.id.qore_widget_equity,R.id.qore_widget_pnl,R.id.qore_widget_dd,R.id.qore_widget_positions,R.id.qore_widget_runtimes,R.id.qore_widget_traders).forEach { views.setTextColor(it, fg) }
            listOf(R.id.qore_widget_balance_label,R.id.qore_widget_equity_label,R.id.qore_widget_pnl_label,R.id.qore_widget_dd_label,R.id.qore_widget_positions_label,R.id.qore_widget_runtimes_label,R.id.qore_widget_traders_label,R.id.qore_widget_updated).forEach { views.setTextColor(it, muted) }
            views.setTextColor(R.id.qore_widget_mode, accent)
            views.setTextViewTextSize(R.id.qore_widget_title, TypedValue.COMPLEX_UNIT_SP, 17f * scale)
            views.setTextViewTextSize(R.id.qore_widget_equity, TypedValue.COMPLEX_UNIT_SP, 16f * scale)
        }

        private fun freshnessColor(v: String) = when (v) {
            "LIVE" -> Color.rgb(34,197,94); "DELAYED" -> Color.rgb(245,158,11); "STALE" -> Color.rgb(249,115,22); "OFFLINE" -> Color.rgb(239,68,68); else -> Color.rgb(156,163,175)
        }
        private fun unavailable(v: RemoteViews, status: String) {
            listOf(R.id.qore_widget_balance,R.id.qore_widget_equity,R.id.qore_widget_pnl,R.id.qore_widget_dd,R.id.qore_widget_positions,R.id.qore_widget_runtimes,R.id.qore_widget_mode,R.id.qore_widget_traders).forEach { v.setTextViewText(it, "—") }
            v.setTextViewText(R.id.qore_widget_status, status)
        }
        private fun formatTime(v: Instant) = DateTimeFormatter.ofPattern("HH:mm:ss").withZone(ZoneId.systemDefault()).format(v)
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) = updateAll(context)
    override fun onAppWidgetOptionsChanged(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int, newOptions: Bundle) = updateAll(context)
}
