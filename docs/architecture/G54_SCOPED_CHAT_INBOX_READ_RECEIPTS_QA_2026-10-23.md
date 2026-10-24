# QORE Mobile — G54 / Arquitecto A · Delegación segura de bandeja y leídos

**Corte:** 23 de octubre de 2026, Paraguay. **Ubicación:** PR A #7, rama `feature/mobility-monorepo-isolated-20261016`. Exclusivamente PostgreSQL 16 descartable y Node QA; sin merge, sin producción y sin acceso a datos reales.

## Motivo y contrato

G49 ya añadió tickets de un uso y permisos mínimos para abrir, leer historial y enviar mensajes del Cliente. Sin embargo, G51 aún ofrecía su bandeja (`mobility_stage_g51_passenger_inbox_owner_qa`) y sus recibos (`mobility_stage_g51_mark_read_owner_qa`) exclusivamente como funciones SQL del propietario. El Cliente necesita listar conversaciones, contar mensajes no leídos y marcar un mensaje leído **sin conceder privilegios al navegador**.

## Implementado en G54

- `apps/mobility-expo/docs/backend/staging_only/G54_SCOPED_CHAT_INBOX_READ_POSTGRES_CI_ONLY.sql`: almacén separado de tickets `mobility_stage_g54_chat_receipt_tickets` con SHA-256 de un UUID aleatorio, operación `CHAT_INBOX` o `CHAT_READ`, actor, sesión, token iat, opcional conversación, plazo máximo de 20 segundos y flag de attestación sintética QA. No modifica las restricciones de G49 para OPEN/HISTORY/SEND.
- `mobility_stage_g54_mint_owner_qa` (solo propietario de fixture QA) comprueba la concesión G42 y rol Passenger exclusivo. CHAT_READ queda vinculado a un hilo que sigue asignado al pasajero con el conductor actual y servicio activo.
- `mobility_stage_g54_consume_qa` bloquea `FOR UPDATE` el ticket de un único uso, vuelve a bloquear sesión G42 y revalida el rol. CHAT_READ revalida asignación real y estado antes de marcar. Ticket consumido, expirado, falso o con propósito equivocado se rechaza.
- `mobility_stage_g54_inbox_qa(ticket,revision,beforeMs,beforeId,limit)` y `mobility_stage_g54_mark_read_qa(ticket,throughSeq)` son las únicas dos nuevas llamadas autorizadas al rol `mobility_g49_chat_gateway_ci` NOLOGIN/NOINHERIT, que **no** puede leer la tabla de tickets, mensajes, lecturas, user_roles ni convocar G51 directamente. No conceder estas operaciones a `anon`, `authenticated`, `service_role` o G48.
- `G54_SCOPED_CHAT_INBOX_READ_ASSERT_POSTGRES_CI_ONLY.sql` ejecuta deliberadamente `SET LOCAL ROLE mobility_g49_chat_gateway_ci` y comprueba el comportamiento real desde el principal delegado, no una simulación como propietario: bandeja con mensaje no leído, confirmación `readThrough` verdadera, segundo uso rechazado, watermark futuro rechazado; luego comprueba conteo cero, asignación cambiada y sesión revocada. Fixture revertido al final.
- `apps/mobility-expo/server/g54-scoped-chat-inbox-read-qa.mjs`: para bandeja reutiliza validación JWT/session/rol, cursor HMAC y DTO de G51, pero sustituye el RPC owner-only por emisión de ticket `CHAT_INBOX` y una única llamada delegada. Para recibos expone `createG54ScopedReadReceiptQa`: entrada exacta `bearer,conversationId,throughSeq`; actor nunca puede ser aportado desde el cuerpo de la solicitud. Verifica tick mintado y recibo final exacto `conversationId,readThrough,qaOnly`.
- Tests Node unitarios con identidades y servicios sintéticos: ataques de suplantación, revocación, token caducado, rol Driver, marcas futuras, errores de proveedor o SQL, tickets alterados y flags LIVE.
- `apps/mobility-expo/server/g54-scoped-chat-inbox-read-concurrency-ci.py`: dos conexiones independientes usan `SET LOCAL ROLE mobility_g49_chat_gateway_ci` y compiten por el mismo ticket de lectura; exactamente una puede consumirlo, se confirma un solo watermark persistido y otra transacción demuestra que la revocación G42 espera hasta el commit de la lectura.
- OpenAPI `1.0.0-g54` documenta la delegación interna sin afirmar rutas montadas. CI PostgreSQL instala G54 **después** de G49 y sus asserts; Node ejecuta tests por descubrimiento normal de `node --test`.

## Invariantes

La bandeja sigue paginada de a lo sumo 100 conversaciones por página sin tope total. Cada conversación solo existe para el pasajero cuando la asignación fuente sigue vigente. Una marca de lectura `throughSeq` no puede saltar más allá de lo realmente persistido y nunca hace retroceder la marca existente. El contador `unreadCount` se reduce al reflejar esos recibos. La app no recibe teléfonos, cuerpos en bandeja, URLs ni secretos del emisor.

El token de delegación autoriza **una sola operación**. No debe ser entregado al móvil: el cliente manda su JWT al futuro gateway de backend y este debe realizar la verificación/firma/roles, mintar y consumir el ticket con credenciales privadas. Una devolución `serverStored` no equivale a `delivered/read` en dispositivo.

## Trabajo pendiente que impide usar la app comercialmente

1. Sustituir proveedor y mint sintéticos de G42/G49/G54 por APIs del proveedor real, política de rotación JWK y un ejecutor de PostgreSQL con credenciales **no-owner** y permisos exactos.
2. Servidor HTTPS, rate limiting distribuido, trazabilidad de datos sin fugas y recuperación ante redes/interrupciones.
3. Recibos de lectura y bandeja equivalentes para Driver, con rol separado, y pruebas E2E Cliente→Driver con asignación/cancelación en dispositivos reales.
4. Integración con notificaciones push privadas, retención y reglas legales, y auditoría de incidentes, con aprobación de despliegue Owner antes de abrir servicios.

**Prohibiciones conservadas:** NO MERGE, NO LIVE, NO VPS, NO PSP, no datos de producción en CI, PR A/B DRAFT.
