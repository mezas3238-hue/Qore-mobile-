# G56 / A38 — Driver chat delegado, QA aislada (fase OPEN/HISTORY/SEND)

**Fecha:** 2026-10-24. **Producto:** QORE Mobile / Movete Fácil. **Owner técnico:** Arquitecto A. **Estado:** implementación parcial **QA ONLY**, no ruta HTTP, no STAGING público, no producción.

## 1. Cambios concretos

- SQL `G56_DRIVER_SCOPED_CHAT_POSTGRES_CI_ONLY.sql`: nuevo rol `mobility_g56_driver_gateway_ci` sin LOGIN ni privilegios sobre tablas de mensajes o sesiones. Tickets de un uso de 20 segundos, con hash SHA-256 de UUID, scope por Driver, sesión, iat, servicio y conversación. Las funciones `open_qa`, `history_qa` y `send_qa` solo se conceden al rol delegado.
- SQL `G56_DRIVER_SCOPED_CHAT_ASSERT_POSTGRES_CI_ONLY.sql`: usuario pasajero, Driver diferente, reasignación, sesión revocada, ticket repetido y persistencia/idempotencia. Ejerce `SET LOCAL ROLE` real. Las variables de psql capturadas por `\gset` se pasan a los bloques PL/pgSQL con parámetros de sesión, **no** mediante sustitución psql dentro de `DO $$`.
- Node `server/g56-driver-scoped-chat-qa.mjs`: tres operaciones inyectables `open(req)`, `history(req)` y `send(req)`. Proveedor JWT, sesión no revocada, rol `driver` exclusivo y rate limiter son requisitos independientes; actor/session/iat **jamás** provienen del JSON móvil.
- `history` firma cursor HMAC SHA-256 con secreto servidor de al menos 32 bytes, identidad y sesión, tipo/id de servicio, conversación, revisión y caducidad de 60 segundos. Oculta `beforeSeq` y `seq` brutos del DTO devuelto; la base los conserva internamente. Cada página admite 1–100 mensajes sin máximo histórico.
- `send` requiere requestKey UUID y valida que el ACK SQL tenga exactamente `conversationId,serviceId,requestKey,messageId,senderRole,body,createdAt,revision,serverStored`. No se declara éxito hasta recibir `serverStored:true` de la operación SQL confirmada; un replay conserva su recibo histórico.
- `server/g56-driver-scoped-chat-qa.test.mjs`: pruebas de JWT/rol/revocación, DTO estricto, mensaje inválido o con contacto/URL, cursor alterado/cruzado, revisión y ACK falsificados, y fallos de dependencias.
- Workflow `.github/workflows/mobility-g4-postgres-disposable.yml`: instala SQL G56 **después** de G55, ejecuta aserciones PostgreSQL16 y el ensayo de dos conexiones. El workflow Node detecta automáticamente los nuevos tests por `server/*.test.mjs`.
- OpenAPI `1.0.0-g56`: rutas Driver separadas para OPEN/HISTORY/SEND con `x-qore-runtime-wired:false`, BearerAuth, respuestas de error y esquemas estrictos. Test `server/g56-driver-scoped-chat-openapi-contract.test.mjs` impide introducir raw seq, actorId o un ACK con rol Passenger.

## 2. Contratos de llamada Node (NO HTTP montado)

`open({bearer,serviceKind,serviceId})`

`history({bearer,serviceKind,serviceId,conversationId,cursor,limit})`, con `cursor:null` inicialmente; después reenviar exactamente `nextCursor` firmado. No enviar `beforeSeq` o `expectedRevision` desde UI.

`send({bearer,serviceKind,serviceId,conversationId,requestKey,body})`. `requestKey` estable durante reintentos del mismo contenido; un requestKey con distinto body debe fallar.

El adaptador inyecta dos autoridades **que no son intercambiables**: `mintOwnerTicket` (solo fixture sintético en QA) y `executeScopedTicket` (rol NOLOGIN con grants limitados). **No existe aún emisor real de tickets ni autenticación JWT remota autorizada.**

## 3. Controles y amenazas

1. Driver no asignado/antiguo, pasajero disfrazado, sesión revocada y servicio terminal: denegar incluso si conservan una conversación o token anterior.
2. No incluir teléfono, email, URL, HTML, controles bidireccionales ni material KYC en cuerpo; no enviar contenido privado por push.
3. Un cursor no certifica autorización de sesión: validar firma y fuente actual de asignación en cada operación SQL.
4. Los errores de backend tienen que ser fail-closed. No se deben marcar envíos como exitosos mediante optimismo de interfaz.
5. **QA sintética no garantiza** comportamiento comercial ni seguridad móvil física. Las funciones owner `*_mint_owner_qa` deben permanecer completamente inaccesibles a Expo/SDK.

## 4. Deuda explícita antes de cerrar G56

- **Driver Inbox aún pendiente:** servicio a servicio, paginación, unreadCount, cambios de asignación, cursors y wrapper NOLOGIN. G51 es exclusivamente Passenger y NO debe reutilizarse para Driver.
- **HTTP aún OFF:** rutas Driver, verificación real de JWT/JWKS, rate gates de proceso, ejecutor SQL transaccional no-owner, trazabilidad, TLS y secretos fuera de móviles.
- **UI Driver aún OFF:** integrar pantalla `apps/movete-driver/app/mensajes.tsx` con interfaz Inbox/History/Composer cuando haya proveedor real autorizado; no simular mensajes ni activar botones que envíen a nada.
- **Concurrencia G56 implementada:** `server/g56-driver-scoped-chat-concurrency-ci.py` usa dos sesiones PostgreSQL reales, `SET LOCAL ROLE`, competencia por un mismo ticket, replay exacto, colisión de requestKey, Driver reasignado y revocación G42 bloqueada hasta commit. Es un ensayo CI desechable; aún falta estrés de miles de mensajes, paginación amplia y carreras del inbox.
- **G57 pendiente:** leer solo mensajes realmente visibles y contiguos; G55 page marker **no** es prueba física. La UI Cliente pertenece a B.
- **G58 pendiente:** composición HTTP local, Auth fixture con issuer/aud/JWKS fijados y gateway delegado, sin desplegar.
- Documentar el resultado de **cuatro workflows en un mismo SHA** antes de usar palabra certificación. El código puede evolucionar mientras se ejecutan CI.

## 5. Propiedad y decisión comercial

Arquitecto A: SQL, backend, OpenAPI, Driver y workflows. Arquitecto B: Cliente/Admin únicamente. PR #7/#8 siempre DRAFT; sin merge, LIVE, SQL remoto, PSP ni push reales sin aprobación del Owner. El proyecto sigue **en desarrollo**, no apto para usar con pasajeros reales.
