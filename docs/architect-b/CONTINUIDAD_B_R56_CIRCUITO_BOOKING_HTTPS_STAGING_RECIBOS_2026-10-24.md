# Movete Fácil — Arquitecto B R56: solicitudes Cliente STAGING con recibo verificable
**Fecha:** 2026-10-24 · **Repositorio:** `mezas3238-hue/Qore-mobile-` · **PR #8 OPEN DRAFT** · **Sin merge, LIVE, despliegues, PSP ni credenciales reales.**

## Prioridad P0: aproximar un circuito completo a producción, no crear otra demo

El OpenAPI del Arquitecto A define los requests tipados `POST /v1/staging/rider/trips/request` y `POST /v1/staging/sender/deliveries/request` con `requestKey`. La respuesta común `#/components/responses/Success` es **JSON object genérico**. Por tanto un 201 por sí solo NO acredita que un servicio fue persistido, enviado a despacho o autorizado a operar: el Cliente no debe anunciar un viaje o envío como real sin recibo vinculante y sin consulta de estado.

## Implementación verificada por código

1. `apps/movete-cliente/src/domain/passenger-booking-staging-gateway.mjs`: adaptador real de llamadas HTTP STAGING por el gateway Cliente ya construido y validado; `createPassengerBookingStagingGateway` con **cuatro gates independientes OFF por defecto** (`enabled`, `contractCertified`, `stagingRuntimeVerified`, `qaReceiptContractCertified`), origen HTTPS pinneado, bearer de la sesión privada inyectada, revisión Passenger obligatoria, exclusión previa al primer await, validación estricta del mismo actor y JWT antes y después de red.
2. Respuesta 201 **solo** aceptada como QA si tiene nueve campos exactos: `mode:'STAGING_DEMO_ONLY'`, `commercialEnabled:false`, `ownerId` Passenger, `requestKey` original, `operation` correcto, `serviceId` UUID, `revision>=1`, `serverPersisted:true`, `status:'ACCEPTED_QA'`. Nunca se proyecta como servicio comercial ni como conductor asignado. Este es un **DTO QA propuesto por B, todavía no aprobado en OpenAPI A**; no habilitar flags hasta coordinación A.
3. `passenger-booking-staging-gateway.d.mts`: contrato TS fail-closed con `bookingConfirmedForProduction:false`.
4. `apps/movete-cliente/src/domain/client-experience.mjs` y `.d.mts`: incorporación opcional de `bookingHttpOptions` al controlador existente. Construye el gateway con `getSession` interno y revisión privada real, reutiliza `createClientMutationController` para evitar doble envío y conservar el `requestKey` tras error ambiguo. El constructor default sin opciones NO cambia: CERO red, sin reservas reales.
5. `passenger-booking-staging-gateway.test.mjs`: **14 pruebas QA adversariales**. Prueba HTTP real inyectado para viaje y envío con URL, JSON y bearer exactos; respuestas 201 genéricas rechazadas; receipt cross-account, otra requestKey, supuesto éxito/comercial, campos extra o inexistentes; roles ajenos, sesión y token vencidos, rotación JWT, doble toque, condiciones offline; integración completa del controlador `createClientExperience` con estados fail-closed, prueba de que ACK QA no crea Driver ni GPS ni cotización.

## Límite de seguridad y handoff a A

**Este trabajo NO pone en marcha reservas comerciales.** El servidor móvil HTTPS, IdP/JWKS con rol Passenger exclusivo, autorización real del token, permisos de dispatch y el DTO final están pendientes. La respuesta del OpenAPI G11 permanece genérica; el proyector B solo es un contrato candidato, no evidencia de endpoints desplegados. Ante 201 sin recibo, la mutación pasa a `failed` y prohíbe una requestKey nueva sin conciliación de servidor. El adaptador no implementa conciliación remota por carecer de ese contrato.

**Pedir a A (issue #9):** versión oficial OpenAPI de receipt por operación y respuesta 409/timeout conciliable por la misma key; servicio HTTPS STAGING con IdP real y acceso móvil; prueba PostgreSQL de persistencia y doble POST; vínculo de `serviceId` al propietario y estado persistido; mecanismo de logout/revocación; GO/NO-GO de los 17 gates G61. Sin aprobación explícita del Owner no se configuran flags.

## Verificación CI y siguiente trabajo

Certificar el **SHA final** contra los tres workflows B ownership, Admin Web QA y two-app isolation con Cliente/Driver TS + suites Node + Expo export web. Si Driver de A falla, reportar y **no afirmar 3/3 SUCCESS**; no editar Driver desde B. No presentar Expo web como APK/AAB/IPA firmado ni como ensayo de dispositivos.

Próximo R57 P0: protocolo de conciliación de `requestKey` tras timeout/409 y feed de estado propia de pasajero; solo tras contrato A para evitar un segundo POST inseguro. Paralelizar trabajo con Arquitecto A, sin pisar ramas.
