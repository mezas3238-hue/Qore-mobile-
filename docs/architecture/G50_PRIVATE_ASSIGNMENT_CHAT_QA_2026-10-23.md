# QORE Mobile — G50 / A31 · Mensajería privada Cliente ↔ Driver (QA)

**Fecha:** 23 de octubre de 2026 · **Estado:** implementado en rama A como PostgreSQL/Node sintético, sin API HTTPS desplegada. **PR #7 DRAFT.**

## Propiedad y alcance
- Backend y SQL: `apps/mobility-expo/**`; Driver: `apps/movete-driver/**` (Arquitecto A).
- Cliente y Admin: `apps/movete-cliente/**`, `apps/movete-admin/**` (Arquitecto B; no modificados).
- Tres clases de conversaciones futuras: `RIDE`, `DELIVERY`, `MERCHANT_ORDER`; la última depende del comprador del pedido y del courier asignado a la entrega real adjunta. Nunca se habilita moto pasajeros por compartir mensajería.
- No se confunde el inbox de **ofertas** con la mensajería Cliente–Driver.

## Implementaciones G50
1. PostgreSQL 16 descartable: `G50_PRIVATE_SERVICE_CHAT_POSTGRES_CI_ONLY.sql`, tablas `mobility_stage_g50_chat_threads` y `mobility_stage_g50_chat_messages`, revocación de todo acceso directo a `PUBLIC`, `anon`, `authenticated`, `service_role` y al rol delegado G48. No migrar en Supabase remoto.
2. Hilo activo único por tipo/servicio; `conversationId` UUID fijado a pasajero y Driver actual. Si el servicio cambia de Driver, hilo anterior pasa a `CLOSED` y el nuevo identificador es distinto. Acceso antiguo falla tanto en lectura como escritura.
3. El origen del servicio se consulta en tablas G3/G5/G6, con bloqueo de fila y estado del servicio. La sesión se bloquea por `mobility_stage_g42_lock_session` en la misma transacción. La identidad, sesión, rol y asignación **no** vienen del body.
4. `requestKey` por conversación+emisor garantiza idempotencia; mismo key/cuerpo devuelve el recibo original, contenido conflictivo es G5009. `serverStored:true` solo se crea tras escribir en PG, nunca por simple ACK local ni al iniciar la solicitud.
5. GET por secuencia ascendente y `after` keyset: máximo 100 por página, **sin tope global de usuarios/mensajes**. El contenido restringido a 500 caracteres, filtrado de control/bidi, números telefónicos, emails y enlaces tanto en Node como SQL. No almacenar documentos, medios, PII ni texto en notificaciones push.
6. Adaptador `g50-private-chat-qa.mjs` y pruebas: token verificado, revocación, rol exclusivo, limiter, parámetros sellados, respuesta sellada, fraude, caída DB y cursores. El adaptador usa funciones OWNER-only exclusivamente locales y está impedido por construcción de entrar a LIVE.
7. Contrato OpenAPI `1.0.0-g50` agrega `POST /v1/staging/chat/services/{serviceKind}/{serviceId}/conversation`, `GET/POST /v1/staging/chat/conversations/{conversationId}/messages`, respuestas tipadas; `x-qore-runtime-wired:false` en las tres operaciones.
8. App Driver separada: `app/mensajes.tsx` y navegación. Pantalla indica backend pendiente: **no simula recibir ni enviar mensajes reales**.

## QA y casos adversariales
- Archivo `G50_PRIVATE_SERVICE_CHAT_ASSERT_POSTGRES_CI_ONLY.sql`: privacidad, doble envío con requestKey, remitente ajeno, cambio de Driver, hilo antiguo, término de servicio, revocación de sesión y ACL.
- Workflow `mobility-g4-postgres-disposable.yml` instala y ejecuta en PG16 efímero; Node corre con `mobility-staging-node-contracts.yml` y CI Expo.
- Tests SQL usan fuentes y roles sintéticos en `BEGIN ... ROLLBACK` para no escribir en STAGING remoto.

## Interoperabilidad B R6–R13
- Al abrir el chat desde inbox, B debe conservar y enviar **exactamente** el `conversationId` del hilo recuperado del servidor; si hay cambio no abre el anterior.
- B ya tiene UI local `conversaciones` y `mensajes`, pero esto no significa tráfico real ni dos teléfonos operativos.
- La implementación actual **NO** ofrece aún listado global de conversaciones / unreadCount, cursor HMAC ligado al actor, entrega real, bloqueo/reporte de abuso persistente, push SO, retención/purga legal, cifrado E2E ni webhooks. La interfaz B seguirá bloqueada hasta contrato completo y certificación.

## Próximos gates reales
1. G49: identidad JWT/JWKS, proveedor/session revocation y rol mínimo realmente conectados; el emisor owner QA **jamás** se publica como RPC; HTTPS STAGING con autorización explícita y secretos fuera del repo.
2. Endurecer chat: cursor firmado/binding actor/conversation/revision, inbox global ordenado, rate limit compartido persistente, política de abuso/retención, pruebas de dos conexiones con race open/send/revocation.
3. E2E Cliente↔Driver Android/iOS + reasignación, offline/retry ambiguo y notificación genérica sin body, con Auth remoto legalmente autorizado.
4. Conectar B solo cuando las respuestas y la seguridad del backend sean reales; coordinar por issue #9. No tocar rutas B.

**Gobernanza:** no merge, no deployment, no Live, no SQL remoto, no PSP, no personas reales. Un workflow verde significa únicamente el alcance de CI que ejecutó.
