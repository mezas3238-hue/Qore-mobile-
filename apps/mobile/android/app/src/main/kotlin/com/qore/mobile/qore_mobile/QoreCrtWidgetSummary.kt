package com.qore.mobile.qore_mobile

import org.json.JSONObject

/**
 * Strict offline replay projection for the EXISTING QORE Android widget.
 * No remote market push, trading control or client-side certification.
 */
internal object QoreCrtWidgetSummary {
    const val OFFLINE = "CRT · Sin conexión"
    private const val TTL_MS = 14_400_000L

    data class ReplayPreview(
        val id: String,
        val symbol: String,
        val family: String,
        val eventType: String,
        val mssM5: String,
        val mssM15: String,
        val expiresAtMs: Long,
        val eventAtMs: Long,
    )

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

    private fun validEnvelope(response: JSONObject, nowMs: Long): Boolean {
        if (nowMs <= 0L ||
            response.optString("schema_version") != "QORE_MOBILE_CRT_QA_V1" ||
            response.opt("authenticated") != true ||
            response.opt("live_feed") != false ||
            response.opt("certified") != false ||
            response.opt("push_enabled") != false ||
            response.optInt("ttl_seconds") != 14400 ||
            response.optString("state") !in setOf(
                "QA_NOT_CONNECTED", "OFFLINE_REPLAY_ONLY")) return false
        val rows = response.optJSONArray("events") ?: return false
        if (rows.length() > 100 ||
            (response.optString("state") == "QA_NOT_CONNECTED" && rows.length() > 0))
            return false
        return true
    }

    fun latest(response: JSONObject, nowMs: Long): ReplayPreview? {
        if (!validEnvelope(response, nowMs)) return null
        val events = response.optJSONArray("events") ?: return null
        val unique = mutableMapOf<String, ReplayPreview>()
        val conflicts = mutableSetOf<String>()
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
                direction !in setOf("BULLISH", "BEARISH") ||
                m5 !in states || m15 !in states ||
                row.optString("schema") != "QORE_CRT_MONITOR_QA_V2" ||
                row.optString("mode") != "OFFLINE_REPLAY" ||
                row.optString("certification") != "NOT_VERIFIED" ||
                row.optString("deliveryState") != "BLOCKED_NOT_CERTIFIED" ||
                row.optString("transport") != "DISABLED" ||
                row.opt("sendPush") != false ||
                row.opt("actionable") != false ||
                row.opt("requiresRealFeedAndPineParity") != true ||
                row.optString("tvSymbol") != expectedSource ||
                row.optString("eventId") != expectedId ||
                c1 <= 0L || c1 % 60_000L != 0L ||
                at <= c1 || at - c1 > 345_600_000L ||
                at % step != phase ||
                (type == "MSS_M5_OBSERVED" && m5 != "CONFIRMED") ||
                (type == "MSS_M15_OBSERVED" && m15 != "CONFIRMED") ||
                at > Long.MAX_VALUE-TTL_MS || expiry != at+TTL_MS ||
                nowMs < at || nowMs >= expiry) continue
            val key = expectedId + "|" + family
            if (key in conflicts) continue
            val candidate = ReplayPreview(
                id = key, symbol = symbol, family = family, eventType = type,
                mssM5 = m5, mssM15 = m15, expiresAtMs = expiry, eventAtMs = at,
            )
            val prior = unique[key]
            if (prior != null && prior != candidate) {
                unique.remove(key)
                conflicts.add(key)
            } else unique[key] = candidate
        }
        return unique.values.maxWithOrNull(
            compareBy<ReplayPreview> { it.eventAtMs }.thenBy { it.id }
        )
    }

    fun project(response: JSONObject, nowMs: Long): String {
        if (!validEnvelope(response, nowMs)) return OFFLINE
        val event = latest(response, nowMs)
        if (event == null) return if (response.optString("state") == "QA_NOT_CONNECTED")
            "CRT QA · Gateway OK · Sin feed"
        else "CRT QA · Sin eventos vigentes"
        val state5 = if (event.mssM5 == "CONFIRMED") "OK" else "—"
        val state15 = if (event.mssM15 == "CONFIRMED") "OK" else "—"
        return "CRT QA · " + event.symbol + " M5 " + state5 +
            " · M15 " + state15 + " (no operar)"
    }
}
