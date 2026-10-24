# QORE Mobile — G59 / A47: Reconciliación de chat después de timeout y COMMIT incierto
**Corte:** 24 octubre 2026 · Arquitecto A · PR #7 DRAFT · QA local, NO producción.

## Objetivo
Un timeout HTTP o la pérdida del ACK no prueban rollback de PostgreSQL. Evitar reenviar un `CHAT_SEND` únicamente porque la aplicación perdió conexión, evitar mensajes duplicados, y recuperar **solo** el recibo persistido con autoridad SQL. La única identidad válida procede del JWT validado por el backend, no de campos `actorId`, `role`, `sessionId` o `iat` enviados por un cliente.

## Código desarrollado
1. `G59_UNKNOWN_COMMIT_RECONCILIATION_POSTGRES_CI_ONLY.sql`: función `mobility_stage_g59_reconcile_passenger_owner_qa(text,uuid,uuid,uuid,uuid,bigint,uuid,text)`, únicamente owner QA. Guarda la barrera G42 hasta COMMIT mediante `G50_authorize`. Exige rol exclusivo Passenger, servicio, conversación y asignación vigentes, y consulta mensaje por clave inmutable `(conversation_id,sender_id,request_key)`. Nunca inserta mensajes.
2. Para una clave no encontrada devuelve `state=NOT_YET_OBSERVED`, `retrySafe=false`, `serverStored=false` y `reconcileAgain=true`. Eso **no** significa que el mensaje fue abortado: puede haber un envío simultáneo sin confirmar o todavía no visible. No emitir un segundo SEND automático.
3. Cuando existe mensaje exacto, compara el texto completo; una misma clave con contenido distinto falla `G5909`. Devuelve `state=COMMITTED` y `ack` sellado con las nueve propiedades originales de G53: `conversationId`, `serviceId`, `requestKey`, `messageId`, `senderRole`, `body`, `createdAt`, `revision`, `serverStored`.
4. Mantiene la **revisión histórica original** de G53/G52: `ack.revision` jamás es reinterpretada como la última revisión. `latestRevision` es un metadato independiente y `historyRefreshRequired` obliga a recargar G52 cuando otro mensaje elevó el high-water mark. No declarar un mensaje visto por el destinatario, no crear marcadores G57 sin viewport real.
5. `G59_UNKNOWN_COMMIT_RECONCILIATION_ASSERT_POSTGRES_CI_ONLY.sql` prueba ausencia de EXECUTE para `anon`, `authenticated`, `service_role`, roles delegados y emisor G58F. Ninguna ruta web ni permiso público nuevo.
6. `g59-uncertain-commit-recovery-qa.mjs` contrato Node fail-closed: Auth externa inyectada, verificación de sesión revocada, Passenger exclusivo, rate gate, shape exacto de respuestas y denegación de PII y reclamos falsos. HTTP 200 solo ante COMMITTED validado; `503 OUTCOME_UNKNOWN_RECONCILE_AGAIN` ante ausencia, jamás `serverStored=true` deducido por timeout.
7. Tests: `g59-uncertain-commit-recovery-qa.test.mjs` para Node adversarial y `g59-uncertain-commit-reconciliation-ci.py` para PostgreSQL real. Pruebas de ACK original después de más mensajes, commit/rollback controlados, revocación dentro y después de transacción, privilegios SQL, conflictos de clave y dos participantes.
8. Workflow `.github/workflows/mobility-g4-postgres-disposable.yml` agrega la migración G59 **después de G58F**, ASSERT y Python; workflow Node ya ejecuta todos `*.test.mjs`.

## Contrato QA de recuperación
```json
{
  "state": "COMMITTED",
  "ack": {
    "conversationId": "UUID",
    "serviceId": "UUID",
    "requestKey": "UUID",
    "messageId": "UUID",
    "senderRole": "passenger",
    "body": "Texto confirmado",
    "createdAt": 0,
    "revision": 2,
    "serverStored": true
  },
  "latestRevision": 3,
  "historyRefreshRequired": true,
  "qaOnly": true,
  "productionEnabled": false,
  "retrySafe": false
}
```
Este esquema es una ilustración de los campos, no un ACK real. Solo un recibo que regrese de SQL y pase las validaciones puede usarse. Si `latestRevision>ack.revision`, consultar G52 nuevo antes de presentar estado de historial; no falsificar ACK original.

## Dependencias para producto real y para B
- El contrato es **owner-only inyectado y sintético**, no una API desplegada. Emisión productiva y Auth real, pool SQL con permisos mínimos, HTTPS público, secretos y roles necesitan revisión y autorización formal.
- Cliente B debe conservar cualquier mensaje en estado `PENDIENTE / RESULTADO_INCIERTO` mientras se consulta una prueba independiente, sin reenviar automáticamente ni mostrar confirmación verde. B puede consumir un contrato **futuro** versionado cuando A lo publique y certifique; no editar sus archivos. Coordinar en issue #9.
- No deducir de `COMMITTED` que el mensaje fue leído en viewport, que una notificación llegó o que existe soporte en producción.
- Falta cerrar reconciliación para actor Driver y después instrumentar ambos clientes físicos bajo G60. La recuperación Passenger por key no reemplaza el resto del recorrido a producción.

## Criterio de cierre G59
Exigir PostgreSQL, Node, Expo y aislamiento **SUCCESS sobre exactamente el mismo HEAD**. En caso de fallo corregir y repetir. El CI no certifica servicio comercial.

## Próximo trabajo
Continuar G59B: operación Driver simétrica con permisos aislados y recuperación de métricas GC TTL sin PII, e integración posterior G60 con Driver + Cliente B. Sin merges, despliegues, pagos, datos reales ni edición de carpetas B.
