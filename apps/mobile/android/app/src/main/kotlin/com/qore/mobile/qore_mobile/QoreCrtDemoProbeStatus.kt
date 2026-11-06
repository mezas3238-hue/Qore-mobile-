package com.qore.mobile.qore_mobile

import org.json.JSONObject

/**
 * cTrader DEMO QA connection status. NOT a CRT alert, not feed certification.
 * Only accepts the authenticated Gateway response with explicit no-market flags.
 */
internal object QoreCrtDemoProbeStatus {
    private const val MAX_AGE_MS = 90_000L

    fun label(data: JSONObject, nowMs: Long): String? {
        if (nowMs <= 0 ||
            data.optString("schema_version") != "QORE_CTRADER_DEMO_PROBE_STATUS_V1" ||
            data.optString("source") != "CTRADER_OPEN_API_DEMO" ||
            data.optString("environment") != "DEMO" ||
            data.optString("broker") != "IC Markets" ||
            data.opt("source_parity_certified") != false ||
            data.opt("verified_market_feed") != false ||
            data.opt("crt_signals_enabled") != false ||
            data.opt("push_enabled") != false ||
            data.opt("can_trade") != false) return null
        return when (data.optString("state")) {
            "QA_NOT_CONNECTED" -> "cTrader IC DEMO · sin conexión QA"
            "QA_PROBE_RECEIVED" -> {
                val at = data.optLong("observed_at_ms", 0L)
                val bars = data.optInt("sampled_closed_m5", -1)
                val symbols = data.optInt("symbols_observed", -1)
                val state = data.optString("probe_state")
                if (at <= 0L || nowMs < at ||
                    nowMs - at >= MAX_AGE_MS ||
                    symbols !in 0..3000 || bars !in 0..500 ||
                    state !in setOf(
                        "INVENTORY_QA_ONLY",
                        "HISTORICAL_M5_QA_UNCERTIFIED"
                    )) null
                else "cTrader IC DEMO · QA recibido · no certificado"
            }
            else -> null
        }
    }
}
