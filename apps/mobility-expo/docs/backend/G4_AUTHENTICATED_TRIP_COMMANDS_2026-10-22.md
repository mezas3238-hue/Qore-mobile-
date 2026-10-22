# QORE Mobile — comandos autenticados de viaje G4

**Fecha:** 2026-10-22

**Estado:** implementado y probado en loopback/STAGING; NO desplegado, NO LIVE.

## Funcionalidad implementada

El runtime G4 incorpora dos comandos HTTP persistentes adicionales:

- `POST /v1/staging/rider/trips/request`: pasajero autenticado crea una
  solicitud AUTO en estado `searching` mediante
  `mobility_stage_auto_demo_request`.
- `POST /v1/staging/trips/:tripId/transition`: conductor autenticado ejecuta
  `arrive`, `pickup` o `complete`; pasajero autenticado puede ejecutar
  `cancel`. Todos llaman `mobility_stage_auto_demo_transition`.

El nuevo `server/g4-trip-command-gateway.mjs` exige JWT confirmado, rol único,
rate limit, JSON con campos exactos, UUID de idempotencia y servicios AUTO
permitidos. No admite `passengerId`, `driverId`, roles, estado, aprobación o
banderas LIVE en el cuerpo.

`server/g4-loopback-http-transport.mjs` enruta estos comandos conservando sus
controles de loopback, cuerpo máximo, ausencia de cookies/CORS, `no-store` y
rechazo de rutas confusas. `server/g4-staging-runtime.mjs` los conecta con el
adaptador persistente común, por lo que solicitud, aceptación, estado y
transiciones comparten la misma autoridad SQL.

## Evidencia

- 150/150 pruebas de servidor Node PASS.
- 102/102 pruebas de dominio Expo PASS.
- TypeScript PASS.
- Guardia NO-LIVE PASS.
- Export web Expo PASS.

Las pruebas cubren creación por pasajero, rechazo a conductor, secuencia de
conductor, cancelación exclusiva del pasajero, suplantación, rol doble/ausente,
rate limiting, recibos inválidos, conflicto persistente y recorrido HTTP real
por `127.0.0.1` hasta `completed`.

## Límites

No hay publicación de API, migración remota, JWT de dispositivos, notificación
real, GPS real, precio aprobado ni dinero. MOTO permanece bloqueada por el gate
legal. El siguiente bloque es sacar el recorrido de viaje del modo AUTO demo y
convertirlo en contrato general versionado que también soporte envíos sin
mezclar sus estados ni sus reglas de custodia.
