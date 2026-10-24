# QORE Mobile — Arquitecto A · G55 / marcador de lectura vinculado a historial autorizado

**24 oct 2026, Paraguay.** PR #7 DRAFT / rama `feature/mobility-monorepo-isolated-20261016`. No merge, no LIVE, no VPS, no datos privados reales, no despliegue. Todo funciona únicamente en PostgreSQL 16 **descartable** y Node QA con fuentes de identidad inyectadas.

## Incidente funcional identificado

Cliente B (PR #8) tiene un historial G52 con DTO **exacto** (`conversationId,serviceId,serviceKind,ownerId,counterpartRole,assignmentVerified,state,revision,generatedAt,expiresAt,messages,nextCursor,canSend,productionEnabled`), donde cada mensaje contiene solo `messageId,senderRole,body,createdAt,revision`. No existe `seq`; por tanto, el POST G51 previo que requería `throughSeq` no podía conectarse de forma segura. **No se debe adivinar** el identificador secuencial a partir de `revision`, `createdAt` o `messageId`.

## Solución G55 publicada

- `apps/mobility-expo/docs/backend/staging_only/G55_SERVER_ISSUED_READ_MARKERS_POSTGRES_CI_ONLY.sql`: nueva tabla `mobility_stage_g55_read_markers`, sin permisos de lectura/escritura para SDKs ni rol delegado; solo guarda SHA-256 de UUID aleatorio, pasajero, sesión, iat, conversación, mensaje del conductor, seq, revisión histórica, expiración de 60 s y marca de consumo.
- `mobility_stage_g55_history_marker_qa(G49_CHAT_HISTORY_ticket,revision,beforeSeq,limit)`: bloquea y consume ticket G49 `CHAT_HISTORY`, obtiene la página auténtica desde G52, comprueba actor/conversación/servicio, y emite un marcador **únicamente para el mensaje más reciente del Driver incluido en esa página**. Si la página no contiene mensaje Driver, no hay marcador. Devuelve `{page,readMarker,qaOnly,productionEnabled}` y preserva el DTO exacto de G52 anidado sin añadir campos a los mensajes.
- `mobility_stage_g55_mark_viewed_qa(G54_CHAT_READ_ticket,marker)`: exige **dos capacidades independientes**: el marcador emitido después de una lectura autorizada G52 y un ticket G54 nuevo para `CHAT_READ`, ligado al mismo pasajero/sesión/iat/conversación. Se vuelven a validar G42, rol Passenger, origen de asignación de Driver, servicio vivo y existencia/revisión/mensaje en SQL. Solo entonces se recupera `message_seq` **internamente** y se llama a G51. Marcador reutilizado, caducado, de otro pasajero, otra sesión o conversación, mensaje de pasajero, reasignación o sesión revocada → denegación.
- Se separa el trigger G51 para `INSERT` y para `UPDATE` con `OLD.through_seq IS DISTINCT FROM NEW.through_seq`, evitando que un mismo mensaje confirmado de nuevo altere indebidamente la revisión de inbox. Se mantiene el watermark monotónico y no se permiten futuras secuencias.
- `apps/mobility-expo/server/g55-private-read-markers-qa.mjs`: compone las validaciones G52 (JWT/session/rol y cursor HMAC) sobre wrappers G49/G55 de ticket de un uso, devuelve `{page,readMarker,qaOnly,productionEnabled}`. Un adaptador independiente `createG55MarkVisibleMessageQa` acepta exactamente `{bearer,conversationId,marker}`, autentica de nuevo, minta ticket G54 y delega en SQL; **proyecta** únicamente `{conversationId,messageId,readConfirmed,qaOnly}` al Cliente, sin `readThrough` ni `seq`. Cada invocación histórica usa su propio estado para impedir fugas cruzadas entre llamadas concurrentes.
- `g55-private-read-markers-qa.test.mjs`: contratos sellados, marcador coherente con un Driver efectivamente retornado, ausencia sin mensajes Driver, roles y tickets falsos, JWT/sesión, SQL unavailable, expiración y simultaneidad.
- `G55_SERVER_ISSUED_READ_MARKERS_ASSERT_POSTGRES_CI_ONLY.sql`: casos adversariales en PG16 con `SET LOCAL ROLE mobility_g49_chat_gateway_ci`, sin privilegiar al navegador. Revisa replay, fidelidad de mensaje, watermark persistido, no-op sin bump G51, reasignación y sesión revocada, con ROLLBACK.
- `g55-private-read-markers-concurrency-ci.py`: dos sesiones PG verdaderas compiten con dos tickets G54 válidos por el mismo marcador opaco; **solo una** debe confirmar y el contador de revisiones se incrementa solo una vez. Marcador nuevo con sesión revocada debe rechazarse.
- OpenAPI `1.0.0-g55`: define contratos futuros `GET /v1/staging/chat/services/{serviceKind}/{serviceId}/history-with-read-marker` y `POST /v1/staging/chat/conversations/{conversationId}/mark-visible`, ambos `x-qore-runtime-wired:false`. No se montó HTTPS, no hay conexión a proveedor real. Ambas apps conservan gates OFF.
- Workflow `.github/workflows/mobility-g4-postgres-disposable.yml`: instala G55 después de G54; ejecuta assert SQL y carrera PG. Node/Expo/autorización se validan en workflows existentes.

## Restricción semántica fundamental

El servidor puede demostrar que el marcador corresponde a un mensaje del conductor **entregado en una respuesta de historial autorizada**. El servidor **no puede demostrar que el usuario efectivamente lo miró en pantalla**. El Cliente B debe desencadenar el POST solo desde un evento verificable de visibilidad en su UI (no en carga de conversación ni scrolling implícito), para ese `messageId` y marcador. Un marker caducado obliga a actualizar la página. Nunca hacer confirmaciones optimistas ante timeouts o errores inciertos; no marcar leído porque se haya almacenado un mensaje.

Se ofrece un solo marcador (mensaje más reciente del Driver) por página, no una prueba por cada elemento de la página. La paginación de 100 es tamaño de página, **no límite global** de mensajes ni usuarios. Un mensaje del pasajero nunca genera marcador.

## Bloqueos restantes para operar en real

1. Arquitecto B debe integrar un gateway G55 opt-in con evento UI de visibilidad explícita, abandonar la inferencia `throughSeq` del POST G51 y conservar OFF hasta certificación E2E.
2. Arquitecto A debe reemplazar `mint_owner_qa`, `verifyAccessToken` inyectado y roles DB sintéticos por proveedor JWT/JWKS conectado a IAM real, ejecutor SQL sin privilegios owner, HTTPS privado, rate limiting compartido y auditoría sin cuerpos ni tokens.
3. E2E de Cliente real ↔ Driver real, conexión/caídas/reintentos/reasignaciones/sesiones anuladas, push privado y políticas legales de retención antes de cualquier go-live. Mantener PR #7 y #8 DRAFT sin merge sin autorización del Owner.

**Estado de certificación:** solo corresponde anunciar SUCCESS cuando los cuatro workflows GitHub terminan verdes sobre **un único mismo SHA**.
