# G36 — Exclusión atómica de asignaciones AUTO y DELIVERY por Driver

**QORE Mobile / Movete Fácil · Arquitecto A · 23 de octubre de 2026**  
**PR #7:** DRAFT. **PR #8:** DRAFT, exclusivamente del Arquitecto B. **No merge, no LIVE, no deploy, no SQL remoto, no PSP ni VPS.**

## Problema identificado

El esquema G3 ya protegía con `UNIQUE(driver_id)` cada viaje AUTO activo; G5 protegía con `UNIQUE(courier_id)` cada entrega activa. **Esas dos restricciones son independientes**. Bajo solicitudes concurrentes, una transacción de AUTO puede ignorar el nuevo empleo en DELIVERY y viceversa. Una verificación `NOT EXISTS` hecha antes de aceptar un envío no sustituye una exclusión global, debido a las carreras entre transacciones.

## Implementado — fuente de verdad en PostgreSQL descartable

**Archivo:** `apps/mobility-expo/docs/backend/staging_only/G36_CROSS_SERVICE_DRIVER_SLOT_POSTGRES_CI_ONLY.sql`.

1. Tabla `mobility_stage_g36_driver_slots`, con `driver_id UUID PRIMARY KEY` y destino `AUTO_RIDE` o `DELIVERY`. La clave única PostgreSQL conserva un único cupo activo por conductor, también frente a dos transacciones diferentes bajo concurrencia real.
2. La migración, que solo se permite sobre `qore_disposable_chain`, incorpora los estados activos ya existentes en las tablas G3/G5 a la reserva común; **rechaza** duplicidades previas en vez de conservar un estado conflictivo.
3. Triggers `BEFORE INSERT/UPDATE` de viajes AUTO y envíos: el paso de `searching/requested` a una asignación activa intenta adquirir el cupo mediante una inserción única **dentro de la misma transacción**. Si ya existe una asignación del mismo Driver, la nueva se rechaza y su cambio de estado revierte automáticamente. También se rechaza que cambien el conductor o vehículo de una asignación mientras está activa.
4. Antes de otorgar un cupo de prueba se vuelve a consultar el preflight vigente de **ese vehículo seleccionado**: G20 para viajes en auto y G20/G5 para transporte de paquetes, incluida categoría/tamaño/peso y seguro de carga vigente. Esto no reemplaza la autorización legal ni operativa de producción.
5. Los estados terminales liberan el cupo exacto solo cuando el mismo Driver, tipo y solicitud coinciden. Una aceptación duplicada con la misma clave idempotente retorna el mismo recibo sin reservar nuevamente; una transacción que falla no conserva una reserva.
6. La tabla privada no concede `SELECT`, `INSERT`, `UPDATE` ni `DELETE` al navegador, apps móviles, `authenticated` o incluso `service_role`. Sólo el trigger `SECURITY DEFINER`, con `search_path` vacío, la gestiona; los tests administrativos inspeccionan cupos desde el propietario de la base **descartable**. No existe un API público para administrar la tabla.

**No cambia** tarifas, pagos, ofertas, la interfaz Lovable, los DTO de Cliente/Admin Web, GPS o disponibilidad G31. La prueba de auto es una carrera **sintética**, no despacho LIVE.

## Evidencia automatizada

- `G36_CROSS_SERVICE_DRIVER_SLOT_ASSERT_POSTGRES_CI_ONLY.sql`: usa el conductor y vehículo AUTO verificados de G20 y un seguro adicional para carga revisado por Admin sintético, todo en `BEGIN/ROLLBACK`. Comprueba adopción del viaje previo, rechazo de escritura directa hacia un envío cuando el conductor tiene un auto activo, cancelación y liberación del cupo, aceptación de envío con recibo idempotente, bloqueo de otro viaje mientras reparte, entrega completada y liberación, y posterior aceptación del viaje legítimo.
- `g36-cross-service-driver-race-ci.py`: dos conexiones PostgreSQL **independientes** corren simultáneamente funciones reales de aceptación (AUTO y entrega) para el **mismo conductor y vehículo validado**, con barrera de concurrencia. Exige exactamente un ganador, un perdedor y un solo cupo persistente; comprueba también que solo una de las solicitudes quedó `accepted`. Utiliza únicamente `PGHOST=localhost`, `PGDATABASE=qore_disposable_chain` y `PGAPPNAME=qore_ci_disposable_chain`.
- Workflow G4 PostgreSQL 16 CI: aplica G36 después de G35 y ejecuta ambas pruebas. Los workflows Node, Expo y aislamiento A/B permanecen obligatorios.

## Riesgos y bloqueos restantes

- **No es una certificación LIVE de oferta o aceptación.** Aún faltan las comprobaciones del JWT Driver en un backend HTTPS autorizado, la firma/revocación de sesiones, la identidad vinculada a la oferta y los controles de monto/pago reales.
- Los esquemas históricos de G3/G5 conceden actualmente a `service_role` permisos amplios `INSERT/UPDATE` sobre sus propias tablas; G36 protege la **exclusión global** incluso ante esas escrituras, pero deben reducirse esos permisos o delimitarse mediante funciones privadas y auditoría sin introducir elevación de privilegios. Que el backend sea confiable es un requisito fuerte.
- El trigger protege la base local en todas las rutas de datos que usen estas dos tablas. Si otros módulos futuros representan ofertas aceptadas en otras tablas, tendrán que integrarse **en la misma reserva atómica**; no asumir cobertura universal de toda la plataforma.
- Se recomienda reforzar la inmutabilidad de conductor y vehículo también después del estado terminal, registrar eventos de cualquier cambio privilegiado y ampliar ensayo a múltiples conductores, repetición y retardo/timeout.
- G31 continúa con `eligible_by_policy=false`; G32 y G33 solo analizan ubicación sintética, G35 es una evaluación documental privada y `availabilityConfirmed=false` en todas las vistas. **No se habilita ninguna zona comercial** por el éxito de G36.
- `MOTO_PASAJERO` sigue bloqueado; los envíos en moto requieren autorización legal propia. Owner Finance permanece denegado porque G7 es dinero simulado.

## Coordinación de arquitectos

A modifica únicamente `apps/mobility-expo/**`, SQL/CI y `docs/architecture/**`. B conserva `apps/movete-cliente/**`, `apps/movete-admin/**` y `docs/architect-b/**`. Registrar los commits y CI finales en issue #9; no sincronizar ramas ni fusionar PR sin instrucción del Owner.
