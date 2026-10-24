# Movete Fácil — R61 Arquitecto B · integridad de estados entre Cliente y Driver G65

**Fecha:** 2026-10-24 · **PR:** #8 DRAFT · **Rama:** `feature/mobility-cliente-admin-parallel-20261022`.

## Hallazgo
El Arquitecto A certificó **G65** en PostgreSQL16/Node/Expo/aislamiento como QA de ciclo AUTO Driver: `accepted → arrive → arriving → pickup → in_progress → complete → completed`, todavía sin HTTPS desplegado ni teléfono real. Cliente B ya posee endpoint **Passenger G11** `GET /v1/staging/rider/trips/{tripId}/status`, con un DTO distinto y redactado. **Nunca es legal enviar al Cliente el DTO privado de Driver:** el servidor debe producir su respuesta Passenger con autorización de titular y revision persistida.

Antes de R61, el validador Cliente revisaba por separado la fase mostrada y el evento interno del servidor pero no cotejaba que `event.serverRevision===revision` ni que `event.status` fuera la fase coherente. Así una respuesta 200 con `state:'assigned'` + `event.status:'completed'` o una revisión antigua podía confundir seguimiento. Además `rider-polling.mjs` copiaba `reply.code` externo al snapshot visible y marcaba GET de revisión vieja como refresco nuevo, pudiendo exponer datos y falsas señales de frescura.

## Cambios implementados exclusivamente en Cliente B

1. `apps/movete-cliente/src/domain/ride-status-gateway.mjs`: mapea **estados del DTO privado Passenger** según G11 a evento del servidor, sin reinterpretar el DTO Driver: `searching→searching`, `assigned→accepted`, `arriving→at_pickup`, `in_progress→in_progress`, `completed→completed`, `cancelled→cancelled`. Exige igualdad de revisión entre evento y snapshot; rechaza historial Driver/tracking sensible si el Passenger no tiene asignación vigente o visibilidad GPS consentida. No crea ETA, ubicación, ni asignación y no usa endpoint Driver.
2. `apps/movete-cliente/src/domain/rider-polling.mjs`: lista cerrada de códigos de error transportados al UI; cualquier código extraño/teléfono/JWT/HTML se vuelve `SERVER_UNAVAILABLE`. Un GET con `revision < revision persistida` devuelve `STALE_SERVER_REVISION`, borra el GPS/ETA del Cliente, deja de atribuir frescura al servidor y **no revierte** el estado de la asignación.
3. `ride-status-gateway.test.mjs`: cuatro nuevas pruebas adversariales sobre estado y evento contradictorios, revisión servidor vs evento, fuga de datos Driver en searching, GPS anidado pese a falta de consentimiento.
4. `rider-polling.test.mjs`: tres pruebas nuevas de error manipulado, errores de transporte conocidos y revisiones idénticas; prueba existente de revisión vieja reforzada a fail-closed.
5. `r61-passenger-g65-lifecycle-contract.test.mjs`: seis pruebas de integración **sintética** del contrato Passenger con estados desde `searching` a `completed`, cancelación terminal, actualización cruzada, revisión desfasada y denegación de rol. Los datos HTTP son fixtures; **no prueban un backend HTTPS real, SQL integrado, GPS, conductor real o dispositivo móvil**.

## Evidencias y bloqueos para certificar comercialmente

A: `apps/mobility-expo/server/g65-driver-trip-status-qa.mjs` con JWT Driver/SQL assignment scoped, ciclo Driver y test Node. B: `ride-status-gateway.mjs` y `rider-polling.mjs` con JWT Passenger/DTO G11. Es una **compatibilidad contractual de QA**, **no una afirmación de que ambos servidores estén conectados**. El backend deberá emitir un DTO Passenger de estado persistido y transición de Driver en el mismo servicio, con dos roles exclusivos, revisión monotónica, autorización cruzada negativa y event evidence.

P0 en orden: IdP real con JWT/JWKS/revocación → HTTPS STAGING aprobado y accesible por dos dispositivos → persistencia de booking y ACK/reconciliación por `requestKey` → asignación Driver/G65 evento transaccional → GET Passenger propio → pruebas físicas Android/iOS → seguridad GPS/PSP/cancelación/soporte. No hay prueba de producción, no hay dinero real. Los 17 gates G61 continúan NO_GO hasta nueva evidencia independiente.

## QA requerida antes de cerrar

Comprobar el **mismo SHA final B**: ownership de archivos B, Admin Web QA y two-app isolation (Cliente y Driver TypeScript + Node tests + export web). Si CI falla, corregir lo propio y remitir a A los fallos ajenos; sin editar Driver o backend desde B.

**Continuidad R62:** contratos de estados con reconstrucción/reconexión física, y aceptación de cuenta/sesión/logout en dos dispositivos sintéticos; cuando A entregue HTTPS/IdP autoritativos, reemplazar fixtures por E2E real certificado. PR #7 y #8 DRAFT, sin merge, LIVE, despliegue, pagos ni secretos.
