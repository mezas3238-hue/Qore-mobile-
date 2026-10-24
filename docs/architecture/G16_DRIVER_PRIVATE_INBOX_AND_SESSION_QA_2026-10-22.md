# QORE Mobile — G16: bandeja privada de Driver + sesión segura (STAGING QA)

**Responsable exclusivo:** Arquitecto A (Backend + `apps/movete-driver/**`). **No modificar** `apps/movete-cliente/**`, `apps/movete-admin/**` ni `docs/architect-b/**`.
**Rama soberana:** `feature/mobility-monorepo-isolated-20261016` / PR #7 DRAFT.
**Restricciones:** NO LIVE, NO MERGE, no SQL remoto, sin pagos/push reales, sin VPS ni publicación móvil.

## Problema corregido

G15 permitía consultar ofertas de envíos cuando el push no llegaba. El conductor AUTO no disponía de fallback similar: aun con oferta privada válida podía perderla por fallos de red. G16 añade la misma garantía de **descubrimiento del estado vigente** para AUTO y una bandeja conjunta de AUTO + DELIVERY.

**No se promete exactly-once para push ni recepción por el teléfono.** Un proveedor que acepta un ticket no acredita entrega. La disponibilidad real y los viajes de pasajeros MOTO no están habilitados.

## Contrato SQL privado

Migración **solo CI**: `apps/mobility-expo/docs/backend/staging_only/G16_DRIVER_PRIVATE_AUTO_POLL_POSTGRES_CI_ONLY.sql`.

RPC de servicio: `mobility_stage_poll_driver_auto_offers(_driver_id uuid)` devuelve únicamente `offer_id`, `trip_id`, `expires_at` para ofertas AUTO `offered`, viajes `searching`, destinatario exacto, TTL vigente, cola outbox coincidente y **exactamente un rol persistido `driver`**.

G15 courier poll exige también rol Driver exclusivo. Las tablas y funciones están restringidas al `service_role`: `anon`/`authenticated` no pueden ejecutarlas directamente. El gateway deriva la identidad del bearer verificado, **jamás de body/query**. Un cliente no debe tener una llave `service_role`.

En CI se corrigieron fixtures para que un usuario Driver no conserve el rol pasajero creado por defecto en G1; esa separación es requisito real de onboarding, **no basta esconder menús**.

## Nueva API STAGING

`GET /v1/staging/driver/inbox` — solo Driver verificado.

Respuesta estrictamente mínima:
```json
{
  "mode": "STAGING_DEMO_ONLY",
  "liveTripsEnabled": false,
  "liveDeliveriesEnabled": false,
  "offers": [
    {
      "kind": "AUTO_RIDE",
      "offerId": "uuid",
      "serviceId": "uuid",
      "expiresAtMs": 0
    }
  ],
  "pushDelivered": false,
  "deviceReceived": false,
  "suggestedPollIntervalMs": 5000
}
```

`kind` es `AUTO_RIDE` o `DELIVERY`. `serviceId` es el identificador de viaje o entrega respectivamente. Máximo cinco por tipo, diez total; caducidad dentro de 3–45 segundos. No se envían nombres de pasajeros, teléfonos, documentos, rutas GPS ni tickets del proveedor. La propia petición HTTP usa `Cache-Control: private, no-store`.

Archivos:
- `server/g16-driver-private-inbox-repository.mjs`: combina G16 AUTO y G15 DELIVERY.
- `server/g16-driver-private-inbox-gateway.mjs`: valida sesión, actor Driver exclusivo, rate limit y respuesta.
- `server/g4-loopback-http-transport.mjs` y `server/g4-staging-runtime.mjs`: ruta unida solo en servidor `127.0.0.1` de QA, detrás del gate Auth.
- `docs/backend/openapi/movete-facil-staging.openapi.json`: contrato versionado de esta ruta.

## Movete Fácil Driver — contrato listo, aún sin credenciales reales

**Un solo proyecto móvil:** `apps/movete-driver`, instalable independientemente de Cliente.

- `src/domain/driver-inbox.mjs`: adaptador de lectura que rechaza direcciones distintas a `http://127.0.0.1:puerto`, tokens inválidos, ofertas extrañas, caducadas o PII y snapshots LIVE.
- `src/domain/driver-inbox-session.mjs`: controlador de sesión que limpia la bandeja al cerrar sesión, cambiar de identidad, recibir 401/403 o perder conectividad; ignora respuestas tardías de la cuenta anterior.
- `src/domain/driver-offer-decision.mjs`: contrato de **aceptar/rechazar** AUTO/DELIVERY con rutas separadas, `requestKey` UUID estable para reintento idempotente tras timeout y cero campos de identidad/importe suministrados por el teléfono.
- `*.d.mts` y `*.test.mjs`: tipado y regresiones de QA.

**Estado honesto:** módulos preparados e integrados en pruebas unitarias, **todavía no conectados a una sesión real en la pantalla Driver** porque el login/autorización de STAGING no se ha habilitado para estos nuevos binarios. `apps/movete-driver/app/ofertas.tsx` continúa indicando que no hay ofertas conectadas; no debe mostrar ofertas sintéticas como trabajos reales.

## Pruebas y puertas de aprobación

- PostgreSQL disposable: esquema auténtico G1–G5/G10/G12/G13/G15/G16, rol Driver exclusivo, selección privada, ACK push no equivalente a recepción, TTL, aceptación única.
- Node: JWT, expiración, 401/403, role denial, caída RPC, CORS/cookies bloqueados y HTTP real `127.0.0.1`.
- Driver: lectura de oferta, decisiones, requestKey persistido por el llamante, logout, cambio de cuenta durante request y ausencia de tokens en snapshot.
- CI: PostgreSQL, Node STAGING, Expo legacy y `movete-apps-isolation`. **Verificar SUCCESS del SHA más reciente antes de considerar cerrado el bloque.**

## Próximos pasos del Arquitecto A

1. Auth del nuevo binario Driver: sesión con SDK público en QA controlado, rol único DRIVER verificado **en servidor**, cierre y revocación, sin credenciales privilegiadas incrustadas; no activar signup público.
2. Conectar el controlador G16 a UI Driver con estado real de carga, sin conexión, oferta/caducidad y bloqueo de botones al perder la sesión. No habilitar operación comercial.
3. Almacenamiento privado central de licencia, documento personal, seguros, vencimientos y cola de aprobación Admin. Datos y objetos segmentados por rol/identidad, retención, acceso temporal y auditoría.
4. Entrega de ubicación con consentimiento, actualización y revocación; seguridad por zona y por categoría; **MOTO pasajero cerrado** hasta revisión normativa.
5. G13 reconciliación de envíos ambiguos + pruebas con dispositivos y notificaciones reales solo tras autorización.
6. Completar pruebas end-to-end de dos binarios y contratos para el Arquitecto B sin modificar sus archivos.

**Panel web Admin y todas las pantallas Cliente pertenecen al Arquitecto B**. Si éste requiere backend, abrir issue con contrato; nunca editar sus carpetas.
