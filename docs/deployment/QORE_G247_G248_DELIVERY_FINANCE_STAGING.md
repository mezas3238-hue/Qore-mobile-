# QORE STAGING G247-G248 — delivery/finance RPC reconciliation

Target: Supabase `mrjzxftsdxzepzbcuids` (isolated, noncommercial).

G247 applies only private, server-only delivery functions using preinstalled tables and G5+G10 logic. No public service access; **do not install direct courier accept**. Requires real, independently approved driver/cargo clearance and sessions before any delivery E2E.

G248 adds fare/quote, payment authorization, payment transition, balanced **simulated** ledger functions. No real PSP or LIVE flags. Enum guard rejects real payment methods.

**Merchant lockdown**: Current STAGING owner intentionally removed service_role INSERT/UPDATE on `mobility_stage_merchants`, `mobility_stage_merchant_orders`, `mobility_stage_catalog_items` and others. Do NOT re-grant or install merchant mutation RPCs until business permissions, Owner consent and E2E negative tests are reviewed. Commerce remains blocked; E2E external remains 0/5.

No synthetic Auth accounts created. Must verify Auth public signup disabled, independent sessions and Railway staging before external 5/5. Both migrations are authored in GitHub first, reviewed in Actions then conditionally applied to isolated Supabase.
