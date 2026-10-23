# Arquitecto B — lectura HTTP con presupuesto de memoria (Admin Web)

**Fecha:** 23-oct-2026. **Rama B:** feature/mobility-cliente-admin-parallel-20261022. **PR:** #8 DRAFT.

Se implementó lector binario incremental en \`apps/movete-admin/src/bounded-json-response.mjs\`. Cuando \`Response.body.getReader()\` existe, no acumula más bytes que el límite preestablecido, aborta/cancela al sobrepasarlo, rechaza secuencias UTF-8 inválidas, respeta \`AbortSignal\` aunque el lector se demore y descarta resultados obsoletos. En entornos sin stream se usa \`Response.text()\` con comprobación posterior del mismo límite (limitación residual declarada).

El gateway de Admin usa este lector para GET de KYC, zonas, incidentes, auditoría y finanzas, bajo la misma política de JWT, MFA, TLS, cursores firmados y whitelist de contratos **apagados por defecto**. No hay nuevas rutas ni habilitación real. Tests incluyen Unicode fragmentado, chunks oversized, aborto de lector detenido y mock sin stream.

**Pendiente:** CI Admin TS/Vite, Client/Driver isolation y ownership sobre el SHA del commit; integración STAGING real/QA de sesión y backend A siguen pendientes. No MERGE, NO LIVE, NO deploy ni PII real.
