# QORE Mobile — G57/A39: confirmaciones de lectura contiguas, sin saltos

**Fecha:** 2026-10-24. **Propietario de los cambios:** Arquitecto A (backend compartido). **Estado:** QA sintética con PostgreSQL16 desechable, adaptador Node offline, sin HTTP ni cliente real. **No LIVE.**

## 1. Defecto anterior y reparación

El prototipo G55 emitía un marcador para el último mensaje `driver` devuelto por la página G52; permitía marcar ese mensaje como visto aun si existían mensajes `driver` anteriores no confirmados. El wrapper G54 delegado `mark_read_qa(ticket, raw_through_seq)` también dejaba pasar un watermark numérico en QA.

G57 implementa una nueva ruta **estrictamente ordenada**: una página G52 auténtica emite **un marcador individual por cada mensaje entrante de Driver** incluido en la página, sin marcar nada como leído. Al recibir una confirmación explícita de interfaz, PostgreSQL16 verifica:
- JWT/session/provider previamente verificado por la capa Node y **bloqueo G42** de sesión dentro de la transacción SQL;
- actor con **rol Passenger exclusivo**, servicio y conductor asignado actualmente, conversación activa; el ticket G54 `CHAT_READ` tiene un único uso y una caducidad de 20 segundos;
- marcador G57 emitido dentro de una auténtica página G52, firmado en repositorio mediante SHA-256 del token UUID y ligado a actor, sesión, token iat, conversación, `messageId`, `seq` y revisión del mensaje; marcador válido 60 segundos;
- correspondencia SQL con mensaje entrante real y revisión G52; `seq` y watermark nunca provienen del móvil;
- **criterio de contigüidad**: bajo `pg_advisory_xact_lock('g57/read/'+actor+'/'+conversation)`, obtiene el primer mensaje del Driver con `seq > through_seq`; solo permite confirmar ese mensaje exacto. Otro mensaje posterior, aun con marcador válido, recibe `G5708` (conflicto). Un mensaje ya confirmado recibe `G5709`.
- solo después se actualiza G51 `through_seq` en la misma transacción. El DTO visible es `{conversationId,messageId,readConfirmed:true,qaOnly:true}`, sin datos internos ni marcador cruzado.

**Crítico: no basta con que un mensaje exista en el historial**. El servicio no crea el evento de visibilidad automáticamente. Un frontend genuino, cuando esté implementado por B, debe enviar el marcador solamente tras una comprobación UI explícita de visibilidad. Los ensayos sintéticos **no pueden demostrar visibilidad física de la pantalla** y se prohíbe afirmarlo.

## 2. Cierre de rutas inseguras

La migración G57 **revoca al rol delegado** `mobility_g49_chat_gateway_ci` permiso de invocar:
- `mobility_stage_g55_mark_viewed_qa(uuid,uuid)` (saltos no contiguos);
- `mobility_stage_g54_mark_read_qa(uuid,bigint)` (posición numérica elegida por llamador).

**No** revocar `mobility_stage_g54_consume_qa` o `mobility_stage_g51_mark_read_owner_qa` del owner SQL porque la nueva función `SECURITY DEFINER` necesita esas rutinas internamente. No volver a habilitar los grants antiguos en futuras migraciones.

Estos cambios SQL se aplican **solo** al entorno `qore_disposable_chain` con `application_name=qore_ci_disposable_chain`; no modificar bases remotas.

## 3. Archivos creados

- `apps/mobility-expo/docs/backend/staging_only/G57_ORDERED_VISIBLE_RECEIPTS_POSTGRES_CI_ONLY.sql`: tablas RLS privadas, marcadores por mensaje, autorización de historia y confirmación contigua.
- `apps/mobility-expo/docs/backend/staging_only/G57_ORDERED_VISIBLE_RECEIPTS_ASSERT_POSTGRES_CI_ONLY.sql`: dos mensajes entrantes intercalados con uno saliente; intenta confirmar segundo primero, exige error G5708 sin mover watermark; luego confirma primero y segundo; comprueba replay, no-op y grants previos revocados.
- `apps/mobility-expo/server/g57-ordered-visible-concurrency-ci.py`: dos conexiones PostgreSQL reales compiten por ACK primero/segundo; solo se acepta el segundo si el primero ya confirmó y comprometió; tercera prueba G42 de revocación concurrente bloqueada hasta commit.
- `apps/mobility-expo/server/g57-ordered-visible-qa.mjs`: adapta G52 sin alterar DTO B, valida cobertura exacta por marcador Driver e identidad de los tickets; servicio `markVisibleOrdered` con comparación estricta `messageId` y respuesta sin `readThrough`. Nunca monta HTTP.
- `apps/mobility-expo/server/g57-ordered-visible-qa.test.mjs`: adversarial JWT/rol, cobertura de marcadores, PII, errores y ACK.
- `apps/mobility-expo/server/g57-ordered-visible-openapi-contract.test.mjs`: esquemas estrictos, endpoint OFF y grants G54/G55.
- `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json`: versión `1.0.0-g57`, endpoints FUTUROS `history-with-ordered-markers` y `mark-visible-ordered`, ambos `x-qore-runtime-wired:false`.
- `.github/workflows/mobility-g4-postgres-disposable.yml`: instalar G57 **después de G56B**, assertions SQL y carrera en dos conexiones.

## 4. Trabajos pendientes para terminar mensajería real

**G57B / Driver (QA implementado)**: G57A cubre Passenger sobre mensajes Driver y G57B agrega Driver sobre mensajes Passenger mediante SQL y Node con rol exclusivo Driver, marcadores individuales, primer mensaje no leído y sin raw seq. [Handoff G57B](G57B_DRIVER_INCOMING_PASSENGER_ORDERED_READ_2026-10-24.md). **Aún pendiente** E2E móvil real y carrera de dos conexiones propia de G57B; la carrera PostgreSQL de dos conexiones está probada en G57A.

**Integración B (solo B)**: implementar visibilidad explícita y contigua de mensajes al estar realmente en viewport, limpieza en cambio de cuenta/sesión/asignación, reconexión y expiración, no marcar por GET/push/scroll programático. No alterar contratos G52/G53. Coordinar en issue #9.

**G58 (A)**: gateway loopback JWT issuer/audience/JWKS verificados y ejecución PostgreSQL con role delegado, sin permisos de owner en la conexión que atienda móvil; rate limiting, TLS después de certificación y secretos fuera del repositorio. Ninguna ruta G57 está conectada a teléfono real.

**Aprobaciones**: ningún merge, LIVE, PSP, deploy, App Store o SQL remoto sin orden del Owner. PR #7/#8 DRAFT. `4/4 SUCCESS` solo se puede declarar después de verificar PostgreSQL, Node, Expo y aislamiento **sobre el mismo HEAD**.

## 5. Sesiones y continuidad

No inventar nuevo token iat por request. El `tokenIatMs` debe proceder del JWT verificado y permanecer estable hasta renovación auténtica. La prueba SQL anterior detectó y corrigió este problema al comparar proof G49 con ticket G54. Las marcas G57 se invalidan por rol, asignación, sesión, expiración, replay o lectura adelantada. El SDK no tiene privilegios para invocar funciones owner.

Continuar sin detener otras tareas QA por fallas aisladas: corregir las fallas de CI concretas, re-ejecutar y documentar SHA. No tocar rama B ni desplegar.
