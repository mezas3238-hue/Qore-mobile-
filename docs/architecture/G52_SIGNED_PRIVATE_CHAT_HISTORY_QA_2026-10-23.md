# QORE Mobile — Arquitecto A G52: historial privado versionado y cursor firmado

**Alcance:** QA descartable / PR A #7 DRAFT. Contrato para la lógica Cliente del Arquitecto B, sin modificar carpetas B ni montar HTTPS; no hay mensajes en producción ni dispositivos reales.

## Diferencia corregida de G50 a G52

G50 persistía mensajes y ofrecía `after: integer` ascendente. Sin embargo, `apps/movete-cliente/src/domain/passenger-chat-flow.mjs` necesita una lista **newest-first**, un `nextCursor` opaco y un DTO sellado: `conversationId,serviceId,serviceKind,ownerId,counterpartRole,assignmentVerified,state,revision,generatedAt,expiresAt,messages,nextCursor,canSend,productionEnabled`.

G52 crea ese contrato sin reescribir G50 ni habilitar falsamente una conexión. La futura ruta `GET /v1/staging/chat/services/{serviceKind}/{serviceId}/messages` aparece en OpenAPI `1.0.0-g52` con `x-qore-runtime-wired:false`.

## Archivos implementados

- `apps/mobility-expo/docs/backend/staging_only/G52_CHAT_HISTORY_KEYSET_POSTGRES_CI_ONLY.sql`: revisión local a cada hilo y revisión inmutable de cada mensaje; backfill de mensajes ya insertados en G50; triggers de versión sobre futuras inserciones. Función `mobility_stage_g52_history_owner_qa` exige token con concesión G42 bloqueada, rol Passenger exclusivo, hilo ACTIVE, conductor/repartidor asignado todavía vigente y servicio habilitado. Lectura por `seq DESC`, 100 filas por página sin cap global. `FOR SHARE` evita que una escritura simultánea cambie la versión durante una página.
- `G52_CHAT_HISTORY_ASSERT_POSTGRES_CI_ONLY.sql`: 205 mensajes en 3 páginas, replay idempotente, revisión, sin duplicados, emisor Driver/Passenger, terminal, reasignación, actor externo, revocación; fixture sintético `ROLLBACK`.
- `apps/mobility-expo/server/g52-chat-history-qa.mjs`: gateway solo Node QA. El cursor HMAC-SHA256 cifra **no** el contenido; **firma** la identidad, sesión, token `iat`, tipo e ID del servicio, ID de conversación, revisión del hilo, secuencia anterior y expiración. Esto hace detectable la manipulación, pero no convierte chat en E2E encryption. `G50_open_owner_qa` se usa solamente para resolver el hilo de primera página; `G52_history_owner_qa` comprueba los permisos de nuevo dentro de PostgreSQL.
- `g52-chat-history-qa.test.mjs`: pruebas Node de actor/sesión distinto, firma rota, cursor caducado, rotación de asignación, DTO contaminado, mensajes fuera de orden, PII, identidad de confianza, rol y limitador.
- `g52-chat-history-openapi-contract.test.mjs`: compara el contrato exacto de B y verifica que el backend continúa deshabilitado.
- `apps/mobility-expo/server/g52-chat-history-concurrency-ci.py`: dos conexiones PostgreSQL independientes comprueban que un historial leído con `FOR SHARE` bloquee la actualización concurrente de versión, y que el replay idempotente no altere la revisión ni acepte cursores vencidos.
- G50 endurecido para coincidir con el filtro Cliente B: rechaza espacios al inicio/final, signos HTML `<` y `>` y marcadores Unicode bidi U+200E/U+200F, tanto en Node como en SQL, con pruebas negativas.
- `.github/workflows/mobility-g4-postgres-disposable.yml`: instala G52 después de G51 y ejecuta sus pruebas PostgreSQL 16 locales. OpenAPI versión `1.0.0-g52`.

## Reglas importantes

- `limit=100` significa máximo por **página**, no por usuario ni por historial; el test lee 205 mensajes.
- `senderRole` sale exclusivamente del emisor persistido en SQL; jamás del dispositivo. `body` y `createdAt` se validan de forma estricta antes de devolverlos.
- Un reintento de envío con el mismo `requestKey` no debe inventar un segundo mensaje o incrementar versión: G50 sigue siendo la autoridad de idempotencia.
- Cuando llega un mensaje nuevo, cambia la revisión del hilo y se rechaza el cursor anterior. La UI debe recargar primero; nunca mezclar snapshots.
- La respuesta de lectura se limita al usuario Passenger. El conductor tendrá que usar un endpoint/adapter propio limitado a su función, sin ampliar los permisos del Cliente.
- Las credenciales del proveedor, emisor de capacidad G49, servidor HTTPS y firma de cursores en infraestructura gestionada **no existen aún en este contrato**.

## Trabajo todavía pendiente (sin detener continuidad salvo bloqueo real)

1. Auth JWT/JWKS/issuer/audience verificable contra proveedor real y puente de identidad SQL mínimo privilegio, sin propietario universal ni service_role.
2. Componer el gateway QA de historial, envío idempotente y notificaciones con métodos Cliente B; doble ensayo real Cliente/Driver sobre dispositivos y redes con cortes y reasignaciones.
3. Antispam y limitación de tasa distribuida en la misma transacción, recibos de lectura en Driver, políticas de retención, auditoría sin mensajes sensibles y canal de incidentes.
4. Infraestructura remota de staging con secretos fuera del repositorio, a implementar solo tras autorizaciones del Owner. Mantener PR #7 y #8 DRAFT, **NO MERGE/NO LIVE**.

**Significado del gate:** un resultado verde prueba únicamente el contrato QA y el SQL descartable. No afirma un chat operativo ni la preparación comercial de la plataforma.
