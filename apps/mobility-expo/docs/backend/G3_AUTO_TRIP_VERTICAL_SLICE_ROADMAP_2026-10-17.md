# QORE Mobile — G3 AUTO: del recorrido DEMO a viaje real (plan de integración)

**Fecha:** 17 octubre 2026. **PR:** #7 DRAFT. **NO LIVE**. No publicar, cobrar, ni operar transportes sin permisos.

## 1. Qué se consiguió hoy (no reconstruir)

El repo ya tenía `RideContext`, `rideReducer`, pantalla del pasajero `app/demo.tsx`, panel ficticio de conductor `app/conductor.tsx`, historial, Maps/Waze externo y recibos ilustrativos.

Esta ronda añade `src/domain/guided-journey.ts`, `src/domain/guided-journey.test.ts` y `app/recorrido.tsx`, enlazado desde Inicio/Pasajero/Conductor. **Seis pasos secuenciales en un solo dispositivo**, sin red para el despacho:
1. Pasajero ficticio solicita viaje AUTO entre dos lugares preseleccionados.
2. Conductor inventado acepta (si está disponible en DEMO).
3. Conductor marca llegada al origen.
4. Inicia viaje.
5. Finaliza.
6. Muestra **comprobante de ejemplo**, pago efectivo **Gs. 0**.

Las seis etapas derivan del mismo reductor puro `rides.ts` y no conceden identidades, aprobaciones ni cupos comerciales. La navegación de Maps/Waze es externa y NO equivale a tracking mutuo. Precios, distancias, recorrido y conductor del DEMO son inventados. Esta mejora cierra **UX simulada**, no G3 en backend.

## 2. Gates obligatorios hacia un piloto real SOLO AUTO

| Gate | Contrato de aceptación | Estado |
|---|---|---|
| G3-0 prueba de recorrido de un dispositivo | Test completo de dominio sin saltos de etapa, cancelaciones, saldo real Gs. 0 y botón accesible desde app | IMPLEMENTADO EN DEMO; comprobar CI |
| G3-1 Auth staging seguro | `disable_signup=true` confirmado en backend; dos cuentas ficticias con JWT válido, acceso propio/ajeno y Storage REST | BLOQUEADO |
| G3-2 validación documentos | KYC, licencia, documentos, vehículo, póliza remunerada y permiso municipal verificados independientemente; evidencias privadas | PENDIENTE |
| G3-3 oferta real | Cotización de servidor con Google Routes u otro proveedor confiable, distancia/tiempo, tarifa aprobada versionada, expiración de oferta | PENDIENTE |
| G3-4 persistencia | Tabla de viajes en Supabase STAGING únicamente, sin exponer RPC antiguas; propietario pasajero inmutable, origen/destino validados, ID idempotente, estado machine audited | PENDIENTE |
| G3-5 despacho seguro | Solo conductores AUTO elegibles según pruebas server-side; aceptación atómica del primer conductor y prevención de doble aceptación entre teléfonos | PENDIENTE |
| G3-6 progreso | Ubicación GPS con consentimiento verificable y caducidad, controles de acceso por conductor/pasajero, control antispam y reconexión | PENDIENTE |
| G3-7 pagos | Integración PSP paraguayo evaluada, conciliación, comisión, reembolsos, disputas y recibos correctos; nunca cobrar en DEMO | PENDIENTE |
| G3-8 QA dispositivos | Dos Android/iOS reales, prueba A pasajero/B conductor, pérdida de red, permisos denegados, secuencias simultáneas, seguridad y soporte | PENDIENTE |
| G3-9 compliance y salida | Requisitos regulatorios/municipales escritos, seguros, soporte, política de retención y aprobación final de piloto | PENDIENTE |

**MOTO comercial siempre fuera de este alcance.** La documentación orientativa no constituye permiso.

## 3. Arquitectura sugerida para cerrar G3-4 y G3-5, pendiente de revisión

- App pasajeros/conductores hacen solicitudes exclusivamente a API HTTPS autenticada con JWT Supabase de **proyecto aislado**. El servicio usa `getUser(token)`, no confía en `passengerId`/`driverId` del cliente.
- `quote_id` ligado a pasajero, ciudad, servicio, ruta, monto y versión de tarifa, con expiración breve; se calcula con motor server-side, nunca se confía en precio cliente.
- `create_ride` dentro de transacción/idempotency key y con límites antiabusos; un pasajero no puede crear varios viajes activos.
- `accept_ride` hace bloqueo y actualización atómica (`WHERE status='searching'`), y comprueba elegibilidad ACTUAL del conductor, vehículo, seguro, GPS y consentimiento. Doble aceptación produce un único ganador.
- Cada transición exige actor autorizado, estado anterior permitido, versión de fila y auditoría append-only. Location tracking se autoriza solo durante viaje activo y cesa al finalizar o revocar consentimiento.
- Los eventos a UI usan Realtime/polling autenticado con RLS y reconciliación por `revision`, sin depender del orden de notificaciones.
- Mantener **`LIVE_TRIPS_ENABLED=false`** hasta pruebas reales, legales, despacho, PS P y permiso explícito para activar producción. Nunca conectar al backend antiguo `qdqrlgzlotnfdxzpacxs`.

## 4. Estrategia de pruebas antes de habilitar

Primero implementar funciones transaccionales G3 sólo como SQL versionado STAGING, ejecutar fixtures sintéticos en PostgreSQL 16 CI y demostrar: JWT ajeno denegado; quote expirado rechazado; mismo request-key devuelve mismo ride; distinto request-key no crea segundo viaje; dos conductores compiten por aceptar y solo uno gana; conductor sin seguro/vehículo aprobado no gana; eventos fuera de secuencia rechazados. No ejecutar SQL en producción sin un gate independiente. Después certificar Auth real y pruebas end-to-end con dos dispositivos.

## 5. Limitaciones actuales

No se ha construido la API de solicitudes de viajes reales, ni se ha instalado una tabla G3 de viajes en el Supabase nuevo. El flujo Expo sigue **local al reductor** y se reinicia si el proceso pierde su estado. La demostración **no** permite comparar precios reales Bolt/Uber, ni comunica taxis/motos, ni habilita desplazamientos comerciales.
