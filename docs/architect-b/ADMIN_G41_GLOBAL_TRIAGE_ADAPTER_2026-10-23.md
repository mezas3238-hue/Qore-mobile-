# Arquitecto B — adapter triaje global G41, solo QA STAGING no montado

**Fecha:** 23 octubre 2026. **PR #8 DRAFT**, no merge/deploy/LIVE. Backend A OpenAPI \`1.0.0-g41\` publica \`GET /v1/staging/admin/incidents/triage-queue\` con filtro \`severity/status\` por servidor **ANTES** de paginar 50 y orden de severidad + fecha. Es **x-qore-runtime-wired=false**; no endpoint productivo operando.

Se preparó \`incident-g41-gateway.mjs\`, independiente del antiguo \`admin/incidents/queue\` (A05). Gate de tres niveles OFF por defecto: \`enabled\`, \`contractCertified\`, \`stagingRuntimeVerified\`; HTTPS fijado, sesión Admin MFA, rechazo Owner/Passenger, JWT efímero y anti-rotación, cursores QA opacos de 44–384 caracteres y filtros whitelisted. Respuesta estricta 11 campos G41, estado QA \`productionEnabled=false\`, \`snapshotConsistent=false\`, máximo 50 por respuesta **sin límite global**. Filtra/ordena el **servidor**, no pretende que el filtro local previo alcance otras páginas. El reader está acotado en bytes.

No se conecta todavía a la vista ni presenta un total global; esta integración debe esperar a que A confirme montaje STAGING, JWT Admin, provider AAL2 MFA y cursores firmados/vinculados a sesión+filtros. La vista Admin actual conserva su advertencia de filtro solo de la página visible. Tests sintéticos adversariales de filtros, prioridad, privacidad, 50 registros por página, old JWT y streaming. No SOS, ni respuesta de emergencia, ni acciones sobre usuarios.

Verificar CI exacto de commit y documentar SHA. Sin secretos ni PII real.
