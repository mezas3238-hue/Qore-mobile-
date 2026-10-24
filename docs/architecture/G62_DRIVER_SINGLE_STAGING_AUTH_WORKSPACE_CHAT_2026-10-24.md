# QORE Mobile — G62 / A52. Driver STAGING: sesión única, ofertas, KYC y mensajes

**Fecha:** 24 octubre 2026. Arquitecto A. PR #7 DRAFT. **NO MERGE / NO LIVE / NO DEPLOY.**

## Meta de cierre funcional

Las etapas anteriores dejaron la aplicación Driver con controladores independientes y transporte HTTPS de STAGING opcional (G61), pero las pantallas tenían conexiones nulas por defecto y los adaptadores de ofertas/documentos solo aceptaban `127.0.0.1`. G62 elimina esa incompatibilidad técnica y permite componer **la misma identidad autenticada** para ofertas, documentos de Driver y chat sin alterar la aplicación Cliente ni el Admin Web del Arquitecto B.

## Archivos y cambios

- `apps/movete-driver/src/domain/driver-status-origin.mjs` distingue dos ambientes de lectura: QA histórico HTTP 127.0.0.1 sin permiso externo, o DNS HTTPS STAGING fijado y explícitamente autorizado. Rechaza hosts ajenos, IPs, credenciales URL, port/path/query y modo live.
- `driver-inbox.mjs`, `driver-documents.mjs`, `driver-license-readiness.mjs`: mantienen parsers originales estrictos de ofertas, 7 tipos documentales y revisión de licencia. Ahora admiten **opt-in** `approvedStagingHost` / `allowedByOwner`; no aflojan límites, rol ni contratos legacy. Sus tipos `.d.mts` documentan las opciones.
- `driver-workspace.mjs` y `DriverWorkspaceProvider.tsx`: propagan el mismo origen y tres readers con un token recuperado de Auth; no guardan bearer ni datos personales en snapshots UI. El cambio de cuenta invalida inmediatamente la información y bloquea responder con una sesión anterior.
- `driver-https-staging-auth.mjs`: acepta **objetos Auth SDK reales con prototipo**, no solo objetos JavaScript planos. Exige `getUser` y prueba de rol exclusivo Driver desde un servidor independiente del token/metadata.
- `driver-staging-runtime.mjs` + `.d.mts`: punto de composición único: construye Auth, chat HTTPS y tres readers de workspace. El transporte de ofertas/KYC limita exactamente tres rutas GET bajo el mismo host aprobado: `/v1/staging/driver/inbox`, `/v1/staging/driver/documents`, `/v1/staging/driver/license-readiness`. No acepta rutas arbitrarias, credenciales en URL ni fallback HTTP. Mantiene `productionEnabled:false`, `qaOnly:true`.
- `DriverApplicationProviders.tsx`: envuelve `DriverWorkspaceProvider` y `DriverMessagesProvider` en una única aplicación Driver. Su propiedad `runtime` es por defecto `null`, por lo que cualquier compilación actual sin un integrador expresamente aprobado permanece **deshabilitada**. `app/_layout.tsx` utiliza este contenedor. No hay conexión automática a servidores desconocidos.
- `driver-staging-runtime.test.mjs`: ensayo de composición con backend de laboratorio simulado y los **parsers reales** de ofertas/KYC/chat: inicio de sesión de rol exclusivo, 3 lecturas privadas, bandeja/historial, envío con HTTP perdido después de COMMIT, recuperación G59B, confirmación de lectura, caída de red, logout y cuenta no autorizada. Los tests G61 de rutas HTTPS mantienen los controles de payload y privacidad.
- El test y toda la suite `npm run check` se ejecutan por el workflow de aislamiento Expo; este mismo commit requiere adicionalmente Node STAGING, PostgreSQL disposable y Expo CI.

## Contrato del integrador (sin secretos embarcados)

Un proveedor STAGING autorizado deberá entregar **en tiempo de arranque**, desde configuración segura y revisada, todos estos adapters:

1. `apiOrigin` HTTPS y `approvedStagingHost` coincidentes, confirmados por Owner, junto con `allowedByOwner:true` (no se obtiene del usuario final).
2. `auth` SDK con `getSession`, `getUser` y eventos `onAuthStateChange`; `verifyExclusiveDriverRole` validado por backend con JWT y G42.
3. `request` HTTP que impida redirects/cookies, CSPRNG UUID para `requestKey` y `verifyStopped` respaldado por navegación real independiente, con validación adicional **del lado del servidor** como G60D.
4. Endpoint de chat HTTPS implementado y protegido por el backend para G61, compatible con bandeja, historial, SEND, RECONCILE y marcador de lectura, incluyendo asignación vigente y revocación.
5. Tres rutas de estado Driver devuelven los contratos existentes validados para STAGING, sin declarar ofertas o pasajeros ficticios como LIVE.

La app integra estos adaptadores con `createDriverStagingRuntime(config)` y pasa el objeto resultante a `<DriverApplicationProviders runtime={runtime}>`, pero **no existe un config real en el repositorio actual**. El `app/_layout.tsx` monta el proveedor sin runtime, intencionalmente. Nunca fijar un host ni una API key real en el código fuente. Las contraseñas, service role, llaves privadas o tokens de usuario jamás se escriben en Expo.

## Riesgos y límites reales

El test integra React TypeScript y controladores con respuestas de red sintéticas. **NO es prueba de un backend externo, IdP real, un teléfono conectado a STAGING, pagos, despacho real ni salida LIVE.** El readiness de Driver continúa `driverEligible:false` mientras no haya circuito real de aprobación. Las pruebas Expo actuales incluyen typecheck y export web, no un APK/AAB/IPA firmado.

## Próximo paso sin pausa

**G63**: backend HTTPS STAGING **autorizado** que implemente todas las rutas con Auth/JWKS, PostgreSQL de mínimo privilegio G60C, rate-limit, telemática verificable; pruebas E2E de móvil físico. En paralelo, el Arquitecto B debe cerrar la app Cliente y Admin en su rama y coordinar por issue #9. No merge, no live, no pago, no VPS, no PII sin aprobación explícita.
