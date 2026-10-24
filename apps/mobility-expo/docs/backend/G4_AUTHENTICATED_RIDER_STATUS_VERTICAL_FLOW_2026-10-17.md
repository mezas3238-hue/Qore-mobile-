# QORE Radar G4 — Puente autenticado pasajero ↔ conductor (solo contratos, sin despliegue)

**Fecha:** 2026-10-17 · **PR #7 DRAFT**, rama `feature/mobility-monorepo-isolated-20261016` · NO LIVE / sin cobros / sin MOTO comercial.

## Qué se implementó

1. `server/g4-rider-status-gateway.mjs`: endpoint de lectura `GET /v1/staging/rider/trips/:id/status`, una **función de gateway no desplegada**, que exige JWT validado por adaptador Supabase Auth, identidad de pasajero confirmada, rol pasajero desde servidor, limitación de lecturas y consulta por `tripId` + `passengerId` derivados de sesión. Si cualquiera falla, se deniega con 401/403/404/429/503 y sin nombres, placas, coordenadas ni minutos.
2. La respuesta de búsqueda siempre omite conductor. Únicamente cuando el backend determina `accepted` y la ficha verificada del vehículo coincide con el `driverId`/ `vehicleId` asignados se crea el evento autoritativo `source='server'`, `revision` y `trackingSequence`. La ficha contiene nombre mostrado, modelo, tipo, color, placa y puntuación. Las fotografías requerirán acceso temporal con consentimiento y todavía **no están implementadas**.
3. La ETA muestra segundos estimados y metros por **carreteras**, solo si un adaptador de GPS ha comprobado consentimiento, posición reciente/precisa y un adaptador de rutas ha comprobado tráfico con timestamp fresco sin fallback. Si la posición o ruta caduca, devuelve `tracking:null` en lugar de fingir un marcador o continuar una cuenta atrás.
4. `arriving` del contrato G3 se traduce a `at_pickup` de la interfaz. No se devuelve GPS de aproximación después del encuentro, durante el trayecto ni después de completar/cancelar. No se marca evento Realtime como entregado por el simple hecho de generarlo.
5. `server/g4-rider-status-gateway.test.mjs`: pruebas negativas de pasajero ajeno, rol/contraselo inválidos, spoofing, GPS caducado, rutas sin tráfico, identidad/placa no verificadas, errores del servidor, solicitud en búsqueda, terminal y no filtración.
6. `server/g4-vertical-radar-journey.test.mjs`: prueba de **integración con tres identidades sintéticas** usando `g4-offer-gateway`, `g4-rider-status-gateway` y `g4-expo-push-offers`. Sigue la secuencia búsqueda → oferta privada → notificación admitida a procesamiento (NO entregada) → pasajero todavía sin conductor → lectura privada conductor → aceptación única → segunda oferta rechazada → pasajero ve conductor, placa y ETA de carretera → extraño bloqueado → estado terminal sin tracking. Prueba adicional de GPS/ruta caducados. **Solo mocks**, no red, no Auth ni dispositivos reales.

## Diferencia fundamental con trabajos anteriores

El G4 SQL en PostgreSQL 16 CI ya demostraba un solo ganador de dos ofertas. Esta ronda añade los **contratos de interfaz entre identidades**, incluyendo la consulta del pasajero que refleja la aceptación confirmada y datos de aproximación autorizados. Su estado no procede de la notificación push: debe consultarse al servidor y no se presupone entrega Realtime.

## Gate antes de declarar piloto conectado

- Auth del nuevo Supabase STAGING `9c677bb2-746b-419f-ad9c-dd6d26bab944`: `disable_signup=true` **no certificado**, última lectura previa fue false. Dos o más cuentas sintéticas confirmadas, RLS y pruebas JWT y Storage REST necesarias. Nunca reutilizar `qdqrlgzlotnfdxzpacxs`.
- G3/G4 **aún no aplicados a Supabase**; únicamente G1/G2 están remotos. El nuevo gateway tampoco corre bajo HTTPS público. Se requiere migración revisada, auditada y autorizada antes de activar nada.
- Conectar `loadOwnTrip` mediante query SQL por pasajero de sesión, `loadArrivalEvidence` mediante driver/vehicle verificados, y `authorizePassenger` contra `user_roles` desde backend. En producción, no confiar en `source:'server'` de un JSON cliente: el canal debe ser privado, firmado/autorizado mediante JWT y RLS, y la app debe consultar snapshot autoritativo tras reconexión.
- Conectar Google Routes real con key exclusivamente de servidor, presupuestos/cuotas, medir ETA en calles paraguayas, consent GPS y actualización; registrar token Expo con identidad de conductor, entregar notificaciones en builds físicas y procesar receipts.
- Prueba de al menos tres dispositivos (pasajero + dos conductores) con pérdida de internet, caducidad, aceptación simultánea, app dormida, falsas ubicaciones, doble notificación, permisos revocados y revocación de sesión. Prueba estricta de fallo GPS o de mapa sin ETA inventada.
- Requisitos municipales, seguro comercial remunerado, tarifas autorizadas y proveedor de pagos antes de la habilitación AUTO. MOTO comercial bloqueada hasta aprobación independiente.

**Todos los módulos devuelven `commercialRidesEnabled:false` y PR #7 permanece DRAFT. Flutter trading PR #2 aislado, sin cambios; no se han publicado ni instalado las nuevas rutas o tablas.**
