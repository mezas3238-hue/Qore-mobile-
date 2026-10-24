# G58 / Arquitecto A — Transporte local + SQL delegado de mensajes (QA)

**Fecha:** 24 octubre 2026. **Producto:** QORE Mobile / Movete Fácil.  
**Estado:** implementación de contrato **SOLO QA**, sin conexión a móviles reales, sin servidor público ni migraciones remotas. **NO LISTO PARA LIVE.**

## 1. Continuidad verificada

Se continúa sobre G56/G56B/G56C y G57/G57B. La mensajería ya tiene rutas separadas Driver y Passenger, inbox del Driver con paginación e indicadores no leídos, y acuses estrictamente contiguos de mensajes entrantes para ambos roles. G58 agrega una frontera HTTP **únicamente local** y una interfaz de ejecución SQL transaccional delegada. No se mezclan las aplicaciones Driver y Cliente.

## 2. Nuevo código publicado

- `apps/mobility-expo/server/g58-chat-loopback-transport-qa.mjs`: servidor Node HTTP *sin escuchar por defecto*; `listen()` solo permite enlace en `127.0.0.1` y puerto efímero. No existen cookies, CORS, proxy ni acceso a interfaces públicas. Exige un token Bearer transmitido hacia adaptadores previamente autenticados. Solo cinco operaciones: inbox Driver, historia Driver, historia Passenger, lectura visible ordenada Driver y lectura visible ordenada Passenger.
- `apps/mobility-expo/server/g58-chat-loopback-transport-qa.test.mjs`: peticiones HTTP reales desde localhost, rutas POST/GET, query/cursor, token requerido, sin origen/cookies, tamaño de JSON limitado, campos de actor/role/sec arbitrarios rechazados, ninguna filtración de JWT y errores de dependencias sin mensajes internos. Si un adaptador devuelve `accessToken`, `authorization`, `sessionId`, `throughSeq`, `beforeSeq`, `nextPosition`, credenciales o claves sensibles, retorna 503 en vez de publicar esos datos.
- `apps/mobility-expo/server/g58-delegated-chat-sql-qa.mjs`: adaptador de transacción inyectable que **solo** acepta cinco operaciones privadas. Todas las funciones SQL y nombres de roles son constantes conocidas de G56B/G57/G57B, nunca texto del request. Abre BEGIN, ejecuta `SET LOCAL ROLE mobility_g56_driver_gateway_ci` o `mobility_g49_chat_gateway_ci`, verifica `current_user`, database y `application_name`, hace una sola consulta con parámetros y confirma al final. Error, resultados falsificados o rol/base inesperados producen ROLLBACK y error genérico, sin filtrar la excepción. No implementa ni expone minting de tickets.
- `apps/mobility-expo/server/g58-delegated-chat-sql-qa.test.mjs`: operaciones Driver/Passenger, bindings SQL, inyección de actor/SQL/throughSeq, rol equivocado, transacción incompleta y errores SQL fail-closed.
- `apps/mobility-expo/server/g58-delegated-role-isolation-ci.py`: usa PostgreSQL16 local desechable; verifica roles NOLOGIN/NOINHERIT, grants separados Driver/Passenger, que el delegado NO pueda mintar tickets ni leer tablas de sesión/mensajes, y que SET LOCAL ROLE se restaure al COMMIT.
- `.github/workflows/mobility-g4-postgres-disposable.yml`: nuevo ensayo G58 de privilegios al final de G57B, conservando las pruebas históricas.

## 3. Integración de autenticación (deliberadamente no habilitada)

La fuente criptográfica existente es **G42** (`g42-provider-pinned-jwt-auth-qa.mjs`), que prueba issuer, audience, kid, algoritmos y JWK públicos fijados, registros separados de usuario, sesión y autorización SQL G42. No permitir que HTTP provea `actorId`, `role`, `sessionId` o `tokenIatMs`. Los adaptadores G56B/G57A/G57B siguen autorizando/rechazando las operaciones y los tickets se emiten solo en fixture QA aislado.

**Bloqueo operativo real:** falta unir G42, un emisor de tickets con autorización de proveedor en producción, executor PostgreSQL con login mínimamente privilegiado real y controles de rotación de secretos. La función owner-only de tickets sintéticos actualmente **no** autoriza una arquitectura de producción. No montar ni exponer estas rutas antes de diseñar y auditar esa frontera. La función `listen()` es solo una herramienta de ensayo localhost.

El primer intento de publicar un nuevo compositor G42 fue bloqueado por controles del conector; no se añadió ese archivo ni se desactivaron controles existentes. Se conserva G42 como autoridad ya disponible y probada.

## 4. Operaciones que NO se incluyen en G58

- **Ningún envío de mensajes** en este transporte; G56 ya tiene SEND en QA pero faltan gateway y montajes seguros. No fingir funcionalidad de chat interactivo ni activar el botón de enviar.
- **No** marcar como leído por obtener historial, abrir la pantalla o recibir una push. G57A/G57B requieren evidencia explícita y contigua. Un test sintético no prueba que una persona realmente visualizó el mensaje.
- **No** compartir credenciales de PostgreSQL con Expo o Lovable. `openConnection` es solo inyección en un servidor aislado y autorizado.
- **No** habilitar servicios reales, datos personales, geolocalización operativa, PSP, pagos, emergencia SOS, notificaciones o acceso a producción.
- **No** editar `apps/movete-cliente` ni `apps/admin-web`; todo Cliente/Admin pertenece al Arquitecto B.

## 5. Siguiente implementación recomendada

1. **G58B**: fixture de integración end-to-end local usando la verificación G42 existente con JWT test firmado por clave efímera, attestation independiente de G42+provider y roles reales; sin credenciales secretas ni SQL owner en el transporte.
2. **G58C**: servidor de staging protegido, definición de emisor real de tickets, executor con login DB restringido, observabilidad segura, timeouts y resistencia al agotamiento de conexiones. Requiere revisión de arquitectura de seguridad antes de habilitarlo.
3. Montar UI `apps/movete-driver/app/mensajes.tsx` **solo después** de comprobar autenticación/SQL reales. Coordinar protocolo de visibilidad con B mediante issue #9.
4. E2E en Android/iOS, reconexión, cierre de sesión/cambio de conductor, volumen de mensajes, duplicados, expiraciones y pruebas de seguridad antes de cualquier servicio comercial.

**Política:** PR #7/#8 DRAFT, nunca merge/LIVE/deploy sin orden. Declarar resultado 4/4 SUCCESS solo si los cuatro workflows muestran éxito en el mismo SHA. La certificación de G58 es exclusivamente de contratos y laboratorio.
