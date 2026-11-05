package com.qore.mobile.qore_mobile

import org.json.JSONObject

/**
 * Widget safe projection of the existing authenticated Gateway CRT QA inbox.
 * It never marks offline-replay as a certified market signal.
 */
internal object QoreCrtWidgetSummary {
    const val OFFLINE = "CRT · Sin conexión"
    private const val TTL_MS = 14_400_000L
    private val markets = setOf(
        "AUDJPY","GBPUSD","GBPJPY","XAUUSD","NDX100","SPX500",
        "US30","BTCUSD","AUDUSD","USDCAD","USDJPY","EURUSD",
        "USDCHF","NZDUSD","NZDJPY","NZDCHF","XAGUSD","AUDCAD",
        "AUDCHF","AUDNZD","CADCHF","CADJPY","CHFJPY","EURAUD",
        "EURCAD","EURCHF","EURGBP","EURJPY","EURNZD","GBPAUD",
        "GBPCAD","GBPCHF","GBPNZD","NZDCAD"
    )
    private val families = setOf(
        "CRT_2C_RETURN","CRT_3C_TRUE","INSIDE_RETURN",
        "INSIDE_CONTINUATION_REJECTED","MULTI4","MULTI_N","M15_RETEST"
    )
    private val eventTypes = setOf(
        "CRT_OBSERVED","MSS_M5_OBSERVED","MSS_M15_OBSERVED"
    )
    private val states = setOf("CONFIRMED","AWAITING","UNVERIFIED")

    fun project(response: JSONObject, nowMs: Long): String {
        if (response.optString("schema_version") != "QORE_MOBILE_CRT_QA_V1" ||
            !response.optBoolean("authenticated") ||
            response.optBoolean("live_feed", true) ||
            response.optBoolean("certified", true) ||
            response.optBoolean("push_enabled", true) ||
            response.optInt("ttl_seconds") != 14400 ||
            response.optString("state") !in setOf(
                "QA_NOT_CONNECTED", "OFFLINE_REPLAY_ONLY")) return OFFLINE
        val events = response.optJSONArray("events") ?: return OFFLINE
        if (events.length() > 100 || nowMs <= 0L) return OFFLINE
        var bestAt = 0L
        var bestText = OFFLINE
        for (i in 0 until events.length()) {
            val row = events.optJSONObject(i) ?: continue
            val symbol = row.optString("instrumentId")
            val family = row.optString("family")
            val type = row.optString("eventType")
            val direction = row.optString("direction")
            val m5 = row.optString("mssM5")
            val m15 = row.optString("mssM15")
            val c1 = row.optLong("c1StartMs", 0L)
            val at = row.optLong("eventAtMs", 0L)
            val expiry = row.optLong("expiresAtMs", 0L)
            val phase = c1 % 300_000L
            val step = if (type == "MSS_M15_OBSERVED") 900_000L else 300_000L
            val expectedId = "IC|" + symbol + "|" + c1 + "|" +
                (if (direction == "BULLISH") "1" else "-1") +
                "|" + type + "|" + at
            val expectedSource = when (symbol) {
                "NDX100" -> "IC:USTEC"
                "SPX500" -> "IC:US500"
                else -> "IC:" + symbol
            }
            if (symbol !in markets || family !in families || type !in eventTypes ||
                direction !in setOf("BULLISH","BEARISH") ||
                m5 !in states || m15 !in states ||
                row.optString("schema") != "QORE_CRT_MONITOR_QA_V2" ||
                row.optString("mode") != "OFFLINE_REPLAY" ||
                row.optString("certification") != "NOT_VERIFIED" ||
                row.optString("deliveryState") != "BLOCKED_NOT_CERTIFIED" ||
                row.optString("transport") != "DISABLED" ||
                row.optBoolean("sendPush", true) ||
                row.optBoolean("actionable", true) ||
                !row.optBoolean("requiresRealFeedAndPineParity") ||
                row.optString("tvSymbol") != expectedSource ||
                row.optString("eventId") != expectedId ||
                c1 <= 0L || c1 % 60_000L != 0L ||
                at <= c1 || at - c1 > 345_600_000L ||
                at % step != phase ||
                (type == "MSS_M5_OBSERVED" && m5 != "CONFIRMED") ||
                (type == "MSS_M15_OBSERVED" && m15 != "CONFIRMED") ||
                at > Long.MAX_VALUE-TTL_MS || expiry != at+TTL_MS ||
                nowMs < at || nowMs >= expiry) continue
            if (at > bestAt) {
                bestAt = at
                val state5 = if (m5 == "CONFIRMED") "OK" else "—"
                val state15 = if (m15 == "CONFIRMED") "OK" else "—"
                bestText = "CRT QA · " + symbol + " M5 " + state5 +
                    " · M15 " + state15 + " (no operar)"
            }
        }
        return bestText
    }
}
