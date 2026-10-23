# QORE Mobile — Arquitecto B · Cancelación propia de viajes y seguridad de historial
**Fecha:** 23 octubre 2026 · **PR #8 DRAFT** · Fuente de verdad GitHub

## Lo implementado en el código
**Historial privado**
- Commit `0b598a6be80d34c9214c7b9ac8dd0da16dc92cf0`: renovar el token o vencer una sesión del pasajero borra datos privados en memoria aun si la cuenta es la misma. Cursor HMAC expirado (HTTP 400) borra la secuencia y snapshot anterior para evitar datos anclados a una consulta inválida.
- Commit `80bc455c49b8a994efe28fdc9734288262e09ded`: un historial que vence después del TTL comienza secuencia de cursor limpia; se corrigieron errores legibles para el pasajero. Reglas del contrato `GET /v1/staging/rider/history` se mantienen: JWT del propio pasajero, `X-Qore-History-Cursor`, HMAC firmado por A, máximo 50 **por página**, sin máximo global de registros.
- CI [#39931364407 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39931364407): Cliente **118/118** pruebas, TypeScript y Expo web export. Admin Web [#39931364371 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39931364371) **109/109** pruebas. Control B #39931364606 SUCCESS.

**Cancelación de viajes**
- Commit `8c6a5879bae6529e2657b5fc5fa254945ee13d3f`: `ride-cancellation.mjs` implementa gateway de STAGING y controlador de cancelación del propio pasajero, con 10 pruebas adversariales en `ride-cancellation.test.mjs`. HTTPS fijado, JWT efímero, sujeto, versión de login, una sola petición en vuelo, body **exactamente** `{requestKey}`, validación de recibo de cancelación persistido, 409 de conflicto, 401/403 de cuenta anterior y rechazo de respuesta vieja.
- Commit `63158893ccf197f260167c8eb892eff8f02e18fe`: `client-experience` conecta controlador de cancelación al viaje activo, con métodos `prepareCancelRide`, `submitCancelRide` y `retryCancelRide`. En logout borra el intento. Una respuesta 200 **no marca el viaje como cancelado localmente**: requiere `GET` autoritativo nuevo. Test con estado de viaje y recibo sintéticos; test sin contrato verifica bloqueo.
- Endpoint ya documentado por A en `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json`, operación `POST /v1/staging/rider/trips/{tripId}/cancel` (`cancelOwnRideIdempotent`), body `RideCancellationV1`: `{requestKey: UUID}` y respuesta `RideCancellationReceiptV1`: `mode:'STAGING_DEMO_ONLY'`, `commercialRidesEnabled:false`, `tripId`, `event:'cancel'`, `eventId`, `serverPersisted:true`.
- **Nunca supone reembolso, multa, tasa de cancelación ni cobro automático.** Idempotencia y concurrencia reales son responsabilidad del servidor A. No habilita cancelar viaje en producción.

## Regla de bloqueo
Los gateways de Historial y Cancelación tienen `enabled=false` y `contractCertified=false` predeterminados. Los contratos OpenAPI del backend A no demuestran por sí mismos que la API esté desplegada o autenticada. La app Cliente sigue sin credenciales/URLs reales de producción, y no se abrieron transacciones ni fondos.

## Próximos pasos concretos
1. Arquitecto A publica pruebas de JWT/RLS de pasajero, HMAC de cursor, cancelación atómica y transición G3 frente a estado concurrente, más disponibilidad STAGING sintética. Cumplir 401,403,409,429,503.
2. Arquitecto B configura integración únicamente para STAGING autorizado, con secure UUID generator de OS para el `requestKey` antes de habilitar el botón Cancelar, prueba casos de doble toque, logout y reintento con el **mismo** UUID.
3. Recuperar `GET /status` después de confirmar cancelación: no actualizar estado ni ofrecer reembolsos/penalizaciones desde UI. Solo mostrar datos persistidos.
4. Pruebas E2E en dispositivo Android y accesibilidad; después revisión Owner del go/no-go. **PR #8 DRAFT; NO MERGE/NO LIVE**.

## Límites de alcance
Arquitecto B modificó únicamente `apps/movete-cliente/**` y `docs/architect-b/**`; no tocó apps Driver, backend, SQL ni workflows globales. Continúa separación Cliente y Driver como productos móviles distintos y Admin como sitio web privado.

## Verificación final
- Commit código `63158893ccf197f260167c8eb892eff8f02e18fe`: [Cliente/Driver CI #39932010765 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932010765). **Cliente 131 tests / 131 PASS / 0 FAIL**, TypeScript + Expo web export PASS; Driver separado igualmente aprobó.
- [Admin Web QA #39932010585 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932010585): **109/109 PASS** y Vite build.
- [Architect B ownership #39932010630 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932010630).
- Certificación técnica QA = código sintético/aislamiento/compilación; **no equivale a certificación operativa, auditoría RLS, API desplegada ni autorización de cobros**.
