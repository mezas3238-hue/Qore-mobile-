# QORE Mobile — G56B / A38 — Inbox privado Driver: PostgreSQL, Node y CI

**Fecha:** 24 octubre 2026. **Estado:** QA PostgreSQL16 desechable, NO LIVE, NO HTTPS conectado.
**Ownership:** Arquitecto A (backend + apps/movete-driver); no editar Cliente/Admin de B.

## Qué se implementó

1. **Inbox exclusivo Driver** en `G56B_DRIVER_SCOPED_INBOX_POSTGRES_CI_ONLY.sql`, sin reutilizar la RPC `G51_passenger_inbox_owner_qa`. Se une por `t.driver_id`, valida el origen del servicio/Driver vigente con `mobility_stage_g50_source` y solo publica conversaciones ACTIVE con `can_send`. Una fila vieja tras reasignación se excluye incluso antes de rotar el hilo G50.
2. **Permisos mínimos**: reusa `mobility_g56_driver_gateway_ci` NOLOGIN, concede únicamente `mobility_stage_g56_driver_inbox_qa`; actor, JWT/sesión/iat **nunca** son aceptados desde la app como autoridad. Emisión `mobility_stage_g56_inbox_mint_owner_qa` solo por propietario sintético en CI, sin GRANT a service_role, anon, authenticated ni gateway. Ticket opaco SHA256 de UUID, una única ejecución, TTL 20 segundos, G42 lock, rol exclusivo en SQL y restricciones RLS.
3. **Revisión de inbox por Driver** guardada separadamente de G51 Passenger. Triggers sobre alta/cierre de hilo, nuevos mensajes y actualización real de `through_seq` del Driver incrementan revisión; una marca de lectura Passenger no incrementa revisión Driver. Cursor keyset usa `updatedAt, conversationId` internamente; SELECT revision FOR SHARE evita intercalar un nuevo mensaje a mitad de una página que ya fue emitida.
4. **No cap global**: recorrido sintético de 205 conversaciones en páginas 100/100/5 (página máxima 100, no máximo histórico). `unreadCount` calcula mensajes del Passenger posteriores al watermark local del Driver, no cuenta sus propios mensajes. En el escenario de 205 chats, dos mensajes entrantes dan exactamente 2 sin exponer contenido, teléfonos ni identidades de pasajeros en el inbox.
5. **Adaptador Node** `server/g56b-driver-private-inbox-qa.mjs`: verifica JWT, revocación de sesión, rol Driver, límite de solicitudes; usa ticket delegado inyectado. Enlaza HMAC-SHA256 al Driver, sesión, iat, revisión, posición, caducidad 60 segundos. Valida DTO exacto y falla cerrado ante token cruzado, paginación desordenada, owner ajeno, datos extra/PII, caducidad o permisos caducos.
6. **OpenAPI offline**: `GET /v1/staging/driver/chat/conversations` requiere BearerAuth, acepta cursor opaco/limit y devuelve página estricta `DriverChatInboxPageG56B`. `x-qore-runtime-wired:false`. No servidor montado ni endpoint público.
7. **Pruebas adversariales**: `G56B_DRIVER_SCOPED_INBOX_ASSERT_POSTGRES_CI_ONLY.sql`; `g56b-driver-private-inbox-qa.test.mjs`; `g56b-driver-private-inbox-openapi-contract.test.mjs`; `g56b-driver-private-inbox-concurrency-ci.py`. Dos sesiones PostgreSQL compiten por el mismo ticket; una sola lectura válida; inserción concurrente espera bloqueo de revisión y un JWT revocado no permite consultar.

## Respuesta SQL de laboratorio (privada, nunca directamente al SDK)

Campos: `ownerId,revision,generatedAt,expiresAt,items,hasMore,nextPosition,productionEnabled:false,qaOnly:true`.
Cada ítem contiene: `conversationId,serviceId,serviceKind,counterpartRole:'passenger',state:'ACTIVE',assignmentVerified:true,canSend:true,revision,updatedAt,unreadCount`.
Node reemplaza `hasMore/nextPosition` por `nextCursor` HMAC firmado, sin publicar keyset ni PII.

## Limitaciones que NO deben ocultarse

- **Un contador no prueba lectura**. El SQL puede calcular cuántos mensajes nuevos hay; no existe aún `Driver mark-visible` con prueba UI de visibilidad contigua. No mover watermark por GET ni por push. G57 tendrá que cerrar este contrato.
- Inbox solo muestra hilos creados G50; un servicio asignado sin conversación puede necesitar `OPEN`. Falta ruta HTTPS y UI Driver conectada a un proveedor real.
- El marcador G55 Passenger no es prueba de visión física ni prueba de contigüidad. Nunca certificar visto solo por consultar historial.
- App Driver actual mantiene Mensajes desconectado: no enviar mensajes sin sesión JWT real, servidor verificado y almacenamiento confirmado.
- Cuentas sintéticas y PostgreSQL efímero **no** son un piloto móvil; faltan autenticación JWT/JWKS de proveedor real, executor DB non-owner, TLS/HTTPS, acciones de background/push reales y E2E Android/iOS.
- El test `G56B` se añade después de G56 al workflow PostgreSQL16; verificar 4/4 CI del **mismo HEAD** antes de certificar QA. Ninguna ruta se despliega.

## Próximo orden de construcción (sin esperar autorizaciones para QA)

1. **G56C**: ruta Driver inbox en `apps/movete-driver/**` como UI estrictamente deshabilitada mientras no haya gateway auténtico. Separar contrato de datos/caducidad y controles visuales de funcionalidad falsa; integrar más tarde con backend real.
2. **G57**: acuse visible de mensajes Driver ↔ Passenger de forma contigua y marcador seguro por mensaje. Resolver el ACK G53 histórico vs revisión G52 sin inventar revisiones.
3. **G58**: gateway loopback con JWT fixture de issuer/aud/JWKS, roles SQL delegados, sin habilitar producción.
4. **P0 reales**: seguridad, KYC, GPS/zonas, PSP, legal, SOS, operativa y pruebas físicas.

**Prohibiciones:** PR #7/#8 DRAFT; sin merge, LIVE, VPS, SQL remoto ni pagos, sin editar los archivos de B.
