# QORE Mobile — G4 Cola de ofertas y notificaciones privadas (CI)

**Fecha:** 2026-10-17 · **Alcance:** PostgreSQL 16 efímero y tests Node con simuladores. **NO instalar en Supabase remoto, NO enviar push a conductores reales, NO activar pagos ni viajes comerciales.**

## Problema resuelto

QORE Radar ya creaba ofertas privadas para cada conductor y un registro `mobility_stage_auto_demo_push_outbox`, pero no existía un proceso que pudiera **reclamar de forma exclusiva** cuál notificación debía tramitar. Dos trabajadores lanzados a la vez podrían intentar enviarla duplicada si consultaran y enviaran sin bloqueo SQL.

## Implementación comprobable

**Contrato SQL (solo CI):** `docs/backend/staging_only/G4_PUSH_OUTBOX_AT_MOST_ONCE_POSTGRES_CI_ONLY.sql`

- Amplía el outbox sintético con `claimed_at`, `claimed_by`, `provider_ticket_id` y restricciones.
- `mobility_stage_claim_auto_demo_push(_worker_id)`: consulta una oferta `offered` ligada a un viaje `searching`, con vencimiento superior a tres segundos, usa `FOR UPDATE OF o SKIP LOCKED` y `UPDATE` atómico para reclamarla a **un solo worker**. Omite las ofertas expiradas, rechazadas, retiradas o ya asignadas.
- `mobility_stage_ack_auto_demo_push(_worker_id,_offer_id,_ticket_id)`: exige que el mismo worker reclamante registre una sola vez el ID de ticket validado que Expo haya admitido **para procesamiento**. Esto no confirma entrega al teléfono ni aceptación del viaje.
- Ambas RPC se otorgan solo a `service_role`; `authenticated` y `anon` no tienen EXECUTE ni acceso directo al outbox.
- La semántica deliberada es **como máximo un intento de envío por oferta**. Si el worker muere justo después de reclamar o Expo falla, puede no llegar notificación; no se reintenta automáticamente. Es una elección defensiva de laboratorio para evitar duplicados, **no una política de servicio comercial**.

**Procesador de servidor (no ejecutado como daemon):** `server/g4-private-push-outbox-worker.mjs`

1. Reclama una oferta mediante un adaptador DB exclusivo de servidor.
2. Valida IDs, tiempo restante, estado `offered` y viaje `searching` de un servicio autoritativo antes de enviar.
3. Recupera el push token de un registro de dispositivo **verificado y opt-in del conductor exacto**, no de la petición cliente. Si no hay permiso o token, no envía.
4. Crea una notificación privada mediante `makePrivateDriverPush` con solo `rideId` y `offerId` y TTL corto; pasa el paquete a `sendVerifiedOffer` (interfaz Expo Push server-only).
5. Solo cuando Expo responde con un ticket de procesamiento válido, el trabajador invoca `ackTicket`. Si falla el ACK, devuelve `ack_unavailable_no_retry` y **no supone entrega**.
6. Devuelve siempre `commercialRidesEnabled:false`, `delivered:false`, `rideAccepted:false`. Ni el worker ni los tests están conectados a un programador/scheduler.

En `server/g4-expo-push-offers.mjs` se conservó el `providerTicketId` del proveedor en la **respuesta al backend** para auditoría interna; no se envía el ID ni claves al pasajero. El resultado aún dice `acceptedForProcessing:true` y `delivered:false`.

## Evidencia y pruebas

- `scripts/sql/g4_push_outbox_smoke.sql`: test real sobre PostgreSQL 16 desechable, verifica sólo un claim de ofertas válidas, que expiradas/declinadas/perdedoras no entren, y que ACK de un worker ajeno o repetido falle. Crea datos ficticios sin usar Auth real.
- `scripts/sql/g4_push_claim_concurrency_ci.sh`: dos procesos `psql` simultáneos compiten por **una sola** oferta privada. Se exige que un proceso obtenga el ID y el otro `NONE`, con un único claimant auditado. Esto demuestra competencia SQL real, no entrega push.
- `server/g4-private-push-outbox-worker.test.mjs`: pruebas de consentimiento, token de otro conductor, oferta retirada/vencida, cambio de estado, revalidación, ticket del proveedor y fallos de ACK, sin llamadas de red a Expo.
- `server/g4-expo-push-offers.test.mjs`: verificación del ticket como procesamiento, no entrega.
- Workflow `.github/workflows/mobility-ci.yml`: ejecuta smoke G4 después de la carrera previa de aceptación y luego dos consumidores SQL en PostgreSQL desechable.
- No marcar aprobado hasta que el último HEAD de PR #7 esté `success` en push y pull_request.

## Gate pendiente para notificaciones verdaderamente funcionales

1. **P0:** bloquear registro público Supabase Auth `disable_signup=true`, verificado nativamente en el Lovable STAGING nuevo `9c677bb2-746b-419f-ad9c-dd6d26bab944`. Última evidencia false / no certificado. Provisionar 3 identidades de prueba confirmadas y ejecutar JWT/Storage REST bajo roles reales.
2. Diseñar registro privado de push tokens del conductor por dispositivo (con consentimiento, rotación/revocación y expiración), descargar tokens inválidos al recibir receipts; proteger `service_role` exclusivamente en backend.
3. Rediseñar de forma profesional la política de entrega para un piloto: claim con **lease**, ID idempotente, expiración, backoff acotado, *dead-letter* y control de recepción, con semántica "puede haber duplicados" aceptable para wake-up; la app debe deduplicar ofertas y obtener estado del servidor. El contrato actual de at-most-once no garantiza entrega.
4. Conectar FCM/APNs y `expo-notifications` mediante development builds Android/iOS, permisos y sesiones del conductor; medir cuándo llega un push con app cerrada/dormida.
5. Conectar API HTTPS autenticada, motor real Google Routes y RLS/Reatime privado; jamás identificar una aceptación a través de push sin transacción confirmada.
6. QA 3 teléfonos con cuentas ficticias y un solo ganador, observabilidad, seguridad, cumplimiento legal AUTO; **MOTO comercial bloqueada**.

**Aislamiento obligatorio:** G3/G4 y este nuevo contrato siguen exclusivamente en CI, STAGING remoto permanece G1/G2; proyecto Supabase anterior `qdqrlgzlotnfdxzpacxs` no se modifica. PR #7 DRAFT, Flutter trading PR #2 sin tocar, `LIVE_TRIPS_ENABLED=false`. Ninguna notificación, viaje ni cobro real ha sido autorizado o enviado.
