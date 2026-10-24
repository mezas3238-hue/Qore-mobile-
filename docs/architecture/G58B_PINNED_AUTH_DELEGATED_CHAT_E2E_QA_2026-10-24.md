# QORE Mobile — Arquitecto A, G58B, JWT firmado y mensajería local integrada

**Fecha:** 2026-10-24. **Repositorio:** `mezas3238-hue/Qore-mobile-`. **Rama A:** `feature/mobility-monorepo-isolated-20261016`.
**Estado:** QA local, no LIVE, no merge, sin despliegue, sin conexión a clientes físicos. **PR #7 y #8 DRAFT.**

## Continuidad y objetivo

G58 incorporó transporte HTTP de localhost, executor SQL con roles delegados y prueba PostgreSQL de privilegios. G58B conecta las fuentes criptográficas de G42 y su autorización independiente al circuito de cinco rutas de chat existente. El objetivo es probar que un HTTP con Bearer solo llega a datos de Driver o Passenger tras validación real de la firma del JWT y comprobación de usuario/sesión/rol, con el actor y la sesión derivados del token firmado, nunca de un body.

**No se utiliza ninguna clave ni contraseña productiva**: las pruebas generan un par ES256 efímero en memoria, crean usuarios y sesiones sintéticas y ejecutan un simulador del contrato de PostgreSQL. Las pruebas PostgreSQL16 reales y separadas verifican los roles NOLOGIN, grants y transacciones. Es una prueba integral **de componentes y contratos**, no una prueba con proveedor o DB comercial.

## Cambios principales

1. `apps/mobility-expo/server/g58b-local-auth-chain-qa.mjs`: ensamblador con `createG42PinnedJwtVerifier` y `createG42ProviderSessionAdapters`; exige issuer HTTPS exacto, audience `authenticated`, `kid` fijado y JWK pública, consulta independiente de usuario, sesión activa y grant privado G42, y lectura exclusiva del rol desde una autoridad externa. Inyecta las autoridades verificadas a G56B Inbox, G57A/B Historial y confirmación ordenada; las respuestas pasan por G58 localhost. `listen()` solo llama el transporte existente de `127.0.0.1`, nunca despliegue.
2. `apps/mobility-expo/server/g58-delegated-chat-sql-qa.mjs`: se añadió `CHAT_OPEN` a la allowlist usando exclusivamente `public.mobility_stage_g49_open_qa($1)` y `mobility_g49_chat_gateway_ci`. Esto permite que la primera consulta G52 del Cliente cree o recupere una conversación antes de leer. No expone `CREATE` genérico, funciones owner ni SQL arbitrario.
3. `apps/mobility-expo/server/g58-delegated-chat-sql-qa.test.mjs`: confirma que la operación `CHAT_OPEN` usa exactamente un UUID paramétrico, BEGIN → SET LOCAL ROLE Passenger → SELECT → COMMIT; un parámetro distinto o actor/SQL inventado sigue rechazado.
4. `apps/mobility-expo/server/g58b-local-auth-chain-qa.test.mjs`: servidor local de prueba con JWT ES256 **firmado en CI** (par de claves efímero), usuarios y sesiones simuladas, grants privados independientes, roles exclusivos Driver/Passenger, tickets de un uso inyectados solo del lado servidor, adaptador transaccional con `current_user` y cinco solicitudes HTTP. Las cinco rutas incluyen inbox Driver, historial Driver, historial Cliente, acuse visible Driver y acuse visible Cliente; el historial Cliente activa G49 CHAT_OPEN. Comprueba firma alterada, issuer/audience erróneos, sesión equivocada, sesión revocada, cross-role, rol múltiple o ausente, marcador falso, error SQL, ausencia de secretos en respuesta y parámetros extra denegados.
5. `apps/mobility-expo/server/g58-delegated-role-isolation-ci.py`: prueba PostgreSQL16 real de la concesión `mobility_stage_g49_open_qa(uuid)` exclusivamente a Passenger delegado y prohibición a Driver, además de grants G57 y owner-only; trabaja solo contra `qore_disposable_chain` local.
6. Corrigió un UUID regex de cuatro grupos en el nuevo compositor; el fallo inicial devolvía `ROLE_UNAVAILABLE` y se cerró antes de certificar el corte.

## Resultado de verificación

El commit funcional `3bb5e57f4c59b4c48021f8561f8d2f2341844f83` tuvo **4/4 workflows SUCCESS del mismo SHA**:

- [PostgreSQL16 #570](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40088376608)
- [Node STAGING #919](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40088376621)
- [Expo #1592](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40088376657)
- [Aislamiento #1096](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40088376613)

Esos resultados no prueban tráfico real de usuarios, backend remoto con credenciales de menor privilegio ni dispositivos Android/iOS físicos. Si se publica un commit posterior, verificar su propia CI y no trasladar automáticamente el 4/4 de un SHA anterior.

## Riesgos abiertos y límites obligatorios

- La **emisión de tickets** es un fixture sintético del lado servidor. No existe todavía un emisor productivo auditado capaz de ligar token/verificación del proveedor a una base de datos real sin habilitar privilegios del propietario a la red o al SDK. Nunca usar el fixture de CI como autenticación de pasajeros.
- La lectura independiente de usuario y sesión está implementada en la interfaz y ensayada con mocks. Falta conectar al proveedor real mediante un cliente seguro del backend, revocación fiable, rotación JWKS y métricas de error, sin secretos en apps o Lovable.
- La cadena G58B ejecuta el SQL sobre un *simulador de contratos*. G58/G57 mantienen pruebas adicionales contra PostgreSQL16 real en CI para permisos/replay, pero el circuito HTTP→JWT→base real aún no fue ejecutado íntegramente con driver SQL de conexión restringida.
- Solo cinco endpoints de **lectura y acuse** están montados en localhost. No existe `SEND` HTTP activo, conexión real Expo de Driver/Cliente, push, historial visible certificado en pantalla, reconexión, cifrado TLS de red real ni servicio público.
- G57A/G57B garantizan orden del primer mensaje entrante pendiente en SQL; no garantizan que un usuario físico lo haya visto. No marcar como leído por GET, carga, push ni scroll programático.
- A no debe modificar `apps/movete-cliente/**` ni Admin Web de B. La integración Cliente visible/UX debe coordinarse por issue #9 y respetar B.
- Los dos PR se mantienen DRAFT, sin merge, LIVE, migración remota, VPS, PSP, pagos ni activación de comercios.

## Siguiente bloque — G58C

1. Diseñar *login SQL de gateway* separado del owner, sin `SET ROLE` por SQL que la propia aplicación pueda escoger arbitrariamente; grants revisados y pool real de staging, solo bajo autorización segura.
2. Timeouts, limitación por cuenta/sesión y presión de memoria, revocación entre verificación y commit, observabilidad sin PII.
3. Simular una transacción real de emisión de ticket y consumo en PostgreSQL16 bajo dos conexiones sin el owner en la capa expuesta; proteger mint mediante autoridad de backoffice auditada.
4. Cuando existan proveedor y credenciales STAGING autorizados: test E2E privado con TLS, Driver Expo, acuse de lectura por viewport y pruebas físicas Android/iOS. Sin automatizar ningún despliegue.

**Mandato de continuidad:** avanzar con pruebas sintéticas y correcciones sin detenerse por autorizaciones triviales, pero detener **solo** la operación bloqueada si requiere accesos/secretos reales o aprobación de LIVE. No mezclar roles ni aplicaciones.
