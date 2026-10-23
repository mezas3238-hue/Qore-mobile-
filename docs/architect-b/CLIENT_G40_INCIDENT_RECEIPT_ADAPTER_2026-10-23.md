# Arquitecto B — Adapter G40 de incidentes, contrato QA no desplegado

Fecha: 23 octubre de 2026. PR #8 DRAFT. Solo \`apps/movete-cliente/**\` y \`docs/architect-b/**\`.

Backend A HEAD observado al desarrollar: G41 OpenAPI (versión \`1.0.0-g41\`). Nuevo \`IncidentReportG40\` incluye únicamente requestKey, subjectKind/subjectId, category y severity; \`IncidentReceiptG40\` devuelve incidentId, receiptId, state, revision y timestamps con marca textual \`RECEIVED_IN_QA_DATABASE_ONLY\`. **G40/G41 marcan x-qore-runtime-wired=false; no HTTP público ni servicio de emergencias desplegado.**

Se creó gateway \`incident-g40-gateway.mjs\` con POST reporte y GET de estado propia, validación estricta de los 5 campos del request y 7 del recibo, revalidación JWT Passenger, pin HTTPS, abort+deadline, lectura streaming acotada y control de solicitudes simultáneas. Rechaza \`CRITICAL\`, SOS, descripción libre, PII/identidad en body y cualquier campo adicional; 409 exige conciliar la misma requestKey, sin afirmar recepción. \`qaDatabaseOnly:true\`, \`sosDispatched:false\`, \`operatorNotified:false\` son invariantes explícitas, no garantías de servicio operativo.

Se exige además \`stagingRuntimeVerified=true\` **inyectado solo cuando Backend A certifique realmente JWT/RLS, autorización y despliegue STAGING**; defecto \`false\`. Por tanto, el formulario de soporte existente continúa mostrando \`NO ENVIADO / NO SOS\`, y **no se le conecta ni activa este adaptador** hasta entonces. Las pruebas son 100% sintéticas.

Pendiente: CI exacta del HEAD, evidencia de A de montaje del endpoint en STAGING, JWT revocado/cross-user, operación de un canal de atención legalmente habilitado (para cualquier función de emergencia), UI controlada con recibo verificable, soporte E2E en Android. NO MERGE/DEPLOY/LIVE.
