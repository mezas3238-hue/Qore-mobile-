# QORE Mobile — G57B/A40: Driver confirma mensajes del Cliente en orden

**Fecha:** 24 octubre 2026. **Arquitecto:** A. **Ámbito:** Driver/backend común. **Estado:** QA exclusivamente, PostgreSQL16 desechable, servidor Node sin HTTP montado.

## Implementación verificada por diseño

La trayectoria G57A confirma mensajes entrantes del **Driver leídos por el Cliente** (rol Passenger). G57B agrega el recorrido inverso, **mensajes entrantes del Cliente leídos por Driver**, sin reutilizar autoridad Passenger.

**Datos y seguridad:**
1. El propietario SQL QA crea una capacidad `DRIVER_MARK_VISIBLE` con TTL de 20 segundos, vinculada a identidad Driver exclusivamente, sesión G42 confirmada, `tokenIatMs` del JWT auténtico y conversación asignada. Nunca concede la función mint a SDK, servicio remoto o delegado.
2. La capacidad `DRIVER_HISTORY` G56 autorizada devuelve la misma página G56 inmutable y crea un marcador independiente para **cada** mensaje `senderRole:'passenger'` en esa página. No crea marcadores para mensajes del propio Driver. Los tokens UUID se guardan solo como SHA-256, TTL 60 segundos.
3. Para reconocer visibilidad **explícita** del mensaje, el gateway futuro presentará una capacidad Driver de un solo uso y un marcador de mensaje. SQL vuelve a bloquear sesión G42, rol exclusivo, asignación actual y coincidencia de token/actor/sesión/conversación y mensaje; `pg_advisory_xact_lock` serializa lecturas de un mismo Driver e hilo.
4. La transacción busca el primer mensaje `passenger` cuyo `seq` supere el watermark previamente confirmado del Driver; si el token corresponde a un mensaje posterior retorna `G5718`, sin grabar ninguna lectura. Mensaje ya leído: `G5719`. Si coincide exactamente, `G51_mark_read_owner_qa` actualiza el watermark bajo el mismo bloqueo; el DTO visible es exactamente `{conversationId,messageId,readConfirmed:true,qaOnly:true}`. No se permite `throughSeq` en app.
5. La reasignación del conductor, el fin del servicio, la revocación o duplicidad de roles, sesiones caducadas, tickets repetidos, marcadores de otra sesión y errores de almacenamiento fallan cerrados.
6. **Historial ilimitado**: como G56, la paginación limita el tamaño de la página (1–100 mensajes), no el historial total. La estructura del Cliente G52/G53 no se altera.

## Archivos

- `apps/mobility-expo/docs/backend/staging_only/G57B_DRIVER_ORDERED_VISIBLE_POSTGRES_CI_ONLY.sql`: tablas aisladas, funciones y grants NOLOGIN específicos del Driver.
- `apps/mobility-expo/docs/backend/staging_only/G57B_DRIVER_ORDERED_VISIBLE_ASSERT_POSTGRES_CI_ONLY.sql`: primer/segundo mensaje del Cliente con mensaje Driver intercalado, rechazo de lectura adelantada, ACK y watermark estrictos, ticket foráneo denegado, replay y reasignación.
- `apps/mobility-expo/server/g57b-driver-ordered-visible-qa.mjs`: adapter independiente, reusa validación de G56 HISTORY y conserva el DTO G56 sellado; verifica que cada mensaje Passenger en la página tenga exactamente un marcador.
- `apps/mobility-expo/server/g57b-driver-ordered-visible-qa.test.mjs`: pruebas JWT, scope, cobertura de marcadores, roles, PII y rechazo de ACK falso.
- `apps/mobility-expo/server/g57b-driver-ordered-visible-openapi-contract.test.mjs`: endpoint OFF, tipos exactos y permisos SQL.
- `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json`: versión `1.0.0-g57b`, endpoints FUTUROS Driver `history-with-ordered-markers` y `mark-visible-ordered`.
- `.github/workflows/mobility-g4-postgres-disposable.yml`: aplicar G57B después de G57A, probar grants reales y sentencias PostgreSQL.

## Qué NO está terminado

- No hay verificación **física** de visibilidad del mensaje; una aplicación de verdad tiene que detectar mensajes realmente visibles y confirmar en orden **solo por acción UI explícita**. Un backend puede certificar el orden y autenticidad del marcador, no que el humano leyó o que el mensaje estuvo en pantalla.
- No hay conexión real al servidor: `x-qore-runtime-wired:false`; no se ha montado endpoint HTTPS, JWT/JWKS, TLS, provider real, realtime push, reconexión automática ni ejecución DB desde aplicación con credenciales restringidas.
- El Cliente/Admin sigue siendo propiedad exclusiva del Arquitecto B. **No modificar archivos B**. Entregar contrato G57A al B por issue de coordinación #9. El Driver/G57B queda para Arquitecto A.
- La pantalla `apps/movete-driver/app/mensajes.tsx` debe permanecer honestamente desconectada hasta cerrar G58; no habilitar un composer o «visto» falsos.
- No hay pruebas end-to-end en Android/iOS físicos, seguridad operacional, stress comercial, secretos productivos ni revisión legal. CI sintético aprobado no sustituye certificación LIVE.

## Continuidad

Siguiente bloque **G58**: ensamblaje de gateway `127.0.0.1` en staging sintético, verificación estricta issuer/aud/JWKS, rol único, lock G42, controlador de rate limits y executor SQL no-owner con `SET LOCAL ROLE` transaccional. Cerrar pruebas sobre dos conexiones y no exponer RPC de owner a apps. Desplegar SOLO con aprobación Owner después de gates de seguridad.

Conservar PR #7 y PR #8 **DRAFT**; sin merge, LIVE, VPS, SQL remoto, pagos, secretos ni push.
