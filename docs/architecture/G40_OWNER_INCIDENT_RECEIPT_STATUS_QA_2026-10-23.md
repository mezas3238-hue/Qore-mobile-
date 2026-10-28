# G40 — Incidentes: recibo real del backend descartable y estado privado

**23-10-2026 / Arquitecto A.** Backend sintético, NO LIVE. Petición de B en issue #9.

## SQL G40
- `mobility_stage_g40_report_receipt` envuelve la función G8, retorna `incidentId`, `receiptId` obtenido del evento de **persistencia verdadera**, estado `open`, revisión y timestamps. No fabrica acuse de atención humana.
- `mobility_stage_g40_owner_incident_status` solo lee si `reporter_id` coincide con el actor autenticado por el servidor y responde exactamente DTO no PII. Otros actores reciben NULL→404 sin filtración.
- Recibos estables bajo reintento de `requestKey`, 409 por repetición conflictiva `G4009`. No permite `SOS` ni `CRITICAL` porque no hay atención de emergencias real.
- Ambos RPCs solo tienen permiso `EXECUTE` de `service_role`; los usuarios y el navegador nunca poseen la clave. Entorno PostgreSQL 16 descartable con pruebas de persistencia, idempotencia, cross-account, no participante y SOS bloqueado, todo `ROLLBACK`.

## Gateway Node G40
- Fuente de actor EXCLUSIVAMENTE de `verifyAccessToken` inyectado y revocación de sesión externa, rate limiter, SQL RPC. Validación estricta del DTO sin documentos, PII o flags de emergencia. No recibe userId del cliente.
- `report` y `ownStatus` son módulos locales, **no están montados a HTTP** ni conectados a un proveedor Auth real. Errores 400/401/404/409/429/503 con manejo fail-closed; el valor `receiptStatus` es `RECEIVED_IN_QA_DATABASE_ONLY`.
- OpenAPI versionado G40 con respuesta tipada, endpoint read privado y `x-qore-runtime-wired:false`. B puede usar contrato para desacoplar UI, pero debe mantener su botón **NO ENVIADO** hasta HTTPS STAGING real certificado.

## Pendiente P0
Auth verdadera y revocación, persistencia remota autorizada, SLA de soporte/operador, monitoreo, ley de privacidad, cumplimiento seguridad de incidentes y atención de emergencias. Este contrato NO equivale a 911/SOS. No habilita dinero real.

NO MERGE, NO LIVE, NO deploy, no SQL remoto; PR A #7 DRAFT, no tocar B.
