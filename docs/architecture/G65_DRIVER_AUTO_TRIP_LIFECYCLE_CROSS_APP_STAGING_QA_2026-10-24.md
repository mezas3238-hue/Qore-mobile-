# Movete Fácil — G65 A54 — Viaje AUTO: continuidad Driver / Cliente, estado y ciclo completo en QA

**Fecha:** 24-10-2026. **Responsable:** Arquitecto A (Driver + backend compartido). **Rama:** `feature/mobility-monorepo-isolated-20261016`, PR #7 DRAFT. **Sin merge / LIVE / VPS / pagos / credenciales reales / despliegue.**

## Objetivo y resultado

G63/G64 permitían aceptar/rechazar ofertas y recuperar una aceptación HTTP incierta, pero Driver no tenía una vista segura para continuar el viaje. G65 implementa la lectura privada del estado de una asignación **AUTO** y la interfaz Driver para registrar por orden llegada, inicio y finalización; cada cambio se somete al SQL G3 existente y se vuelve a consultar antes de habilitar la etapa siguiente.

### Backend

- `apps/mobility-expo/server/g65-driver-trip-status-qa.mjs`: ruta lógica **GET /v1/staging/driver/trips/{tripId}/status**. Valida JWT a través de callback independiente, sesión G42 no revocada, rol exclusivo Driver, rate gate, consulta propietario por `{tripId,driverId}` y DTO mínimo. Nunca muestra nombre, teléfono, ubicación, destino, tarifa o medios de pago del pasajero.
- `g65-driver-trip-status-repository.mjs`: adaptador para el servidor que consulta la tabla `mobility_stage_auto_demo_trips` con DOS predicados SQL `eq('id',tripId).eq('driver_id',actorId)`. No confía en un `driverId` enviado por el cliente. Solo proyecta `id,driver_id,vehicle_id,passenger_id,status,revision,service` y devuelve un registro validado al gateway.
- **Estados permitidos**: `accepted` → `arrive`, `arriving` → `pickup`, `in_progress` → `complete`. `completed/cancelled` son terminales. El backend debe revalidar con `mobility_stage_auto_demo_transition` las reglas transaccionales G3/G4 y las restricciones adicionales G20/G38 vigentes. No se permite “completar” mientras sigue en `accepted`.
- Tests del servidor `g65-driver-trip-status-qa.test.mjs` prueban actor ajeno, sesión revocada, rol ajeno o dual, asignación inválida, respuesta enmascarada y composición SQL scoped.

### App independiente Driver

- `driver-trip-lifecycle-http.mjs`: conexión HTTPS STAGING pinneada al host expresamente aprobado; GET estado privado y POST transición a **/v1/staging/trips/{tripId}/transition** (endpoint G4 ya implementado en QA). Request POST únicamente `{event,eventKey}`, sin identidad ni datos de pasajero/ubicación/precio.
- `driver-trip-lifecycle.mjs`: controlador con identidad efímera, invalidación de eventos tras logout/cambio de cuenta, CSPRNG para `eventKey`, una sola acción activa, revisión persistida y lectura obligatoria tras el evento. Un ACK POST no se confunde con estado actualizado.
- **Pérdida de ACK**: estado `uncertain`; nuevas mutaciones quedan bloqueadas. Una consulta voluntaria a GET estado puede mostrar una transición verificada por revisión y estado, pero **no** atribuye el evento a una confirmación de entrega HTTP ni autoriza duplicar POST. Si el servidor aún muestra la revisión anterior, permanece incierto.
- `DriverTripProvider.tsx`: react provider dedicado, mismo Auth Driver de G62; `DriverApplicationProviders` lo monta sin habilitar STAGING por defecto. `driver-staging-runtime.mjs` aporta adapters GET/POST con la misma conexión/host y CSPRNG de G61.
- `app/viaje.tsx`: pantalla de viaje AUTO asignado, accesible desde `app/ofertas.tsx` **solo después de aceptación confirmada por servidor**. El identificador de ruta no autoriza nada: el gateway verifica `driver_id` en SQL. La pantalla muestra únicamente eventos persistidos y se niega a inventar GPS/ETA, estado comercial, pago o PII. 
- `driver-offer-actions.mjs`: añade `serviceId` (tripId aportado por inbox privado) al resumen de una decisión para permitir navegación sin acceder a un viaje ajeno.

### QA y prohibiciones

Pruebas unitarias de estado, HTTP, transición ordenada, sesiones ajenas, logout durante HTTP y pérdida de ACK; suite existente de Node/PostgreSQL/Expo/aislamiento sobre el mismo commit. **Las pruebas HTTP usan doubles de backend, no un servicio HTTPS desplegado.** La base PostgreSQL16 real descartable certifica G3/G4/G10/G64 en workflow separado, no el mismo test gráfico.

El layout predeterminado Driver continúa **sin runtime configurado**, por lo que no hay viajes falsamente activos. Se mantiene Driver y Cliente como **dos aplicaciones nativas independientes**; G65 no modifica la rama B.

### Pendientes hacia aplicación funcional real

1. Enlazar el servidor de estado con IdP/JWKS, privilegios SQL mínimos y HTTPS STAGING real autorizado; controlar revocación concurrente y rate limit por sesión.
2. Ensayar **dos dispositivos físicos**, uno Cliente y otro Driver, en circuito request → dispatch → aceptación → status → llegada → inicio → cierre, con ubicación consentida verificable y cobertura/zona legal habilitada.
3. Añadir el ciclo equivalente **DELIVERY/entrega comercial** con prueba de custodia G5, así como operaciones de cancelación, soporte, SOS, avisos y fallos de desconexión con rutas comerciales aprobadas.
4. Completar KYC, PSP, conciliaciones contables, Admin, privacidad, firma Android/iOS, seguro/normativa paraguaya y aceptación Owner.
5. El manifiesto comercial de 17 gates sigue **NO_GO** hasta evidencia de los servicios operativos, no solo CI verde.

**A/B sin pisarse:** A conserva backend/Driver. B conserva Cliente/Admin. Coordinar contrato de seguimiento sin hacer merge ni modificar archivos B. 
