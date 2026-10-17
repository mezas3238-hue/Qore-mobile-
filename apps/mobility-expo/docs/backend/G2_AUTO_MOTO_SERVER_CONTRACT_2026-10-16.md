# G2 — Contrato seguro de automóviles y motocicletas
**Fecha:** 2026-10-16 · **Estado:** propuesta para STAGING, no activado en Lovable/producción.

## Fuente verificada
La migración inicial Lovable usa `vehicle_category` para `economico/confort/xl` y `vehicles.driver_id UNIQUE`. `rides` no tiene `vehicle_id`, y la RPC heredada `accept_ride` no verificaba coincidencia de tipo de servicio, vehículo, habilitación y póliza. Por eso G1 revocó EXECUTE de esa RPC a todos los clientes.

## Contrato G2
La [migración borrador en carpeta staging_only](staging_only/G2_AUTO_MOTO_COMPLIANCE_DO_NOT_APPLY_PRODUCTION.sql) propone **tablas nuevas** sin cambiar el enum antiguo ni `rides`: `mobility_vehicle_kind` = AUTO/MOTO; servicio `moto_pasajero` compatible solo con MOTO, y tres niveles de AUTO solo con AUTO. Se permite registrar múltiples vehículos por conductor en inventario, nunca seleccionar dos para un mismo viaje.

Las tablas `mobility_driver_compliance` y `mobility_vehicle_compliance` guardan vigencia y verificador de licencia, registro, seguro que cubra pasajeros remunerados, inspección, autorización municipal y casco/condiciones de moto. La combinación vehículo aprobado + evidencias vigentes deberá comprobarse de nuevo en una transacción de aceptación y no mediante un booleano de la app.

**Seguridad por defecto:** `authenticated` puede leer solamente filas de su inventario o de administrador, pero no puede insertar/actualizar/aprobar inventario ni leer certificaciones; `anon` carece de permisos. Solo `service_role` podrá escribir desde backend auditado. Un usuario no puede autorizarse como conductor desde el teléfono.

## Aún requiere diseño/certificación antes de uso real
- Provisionar un Supabase **STAGING separado** (distinto del existente `qdqrlgzlotnfdxzpacxs`), revisar SQL, ejecutar allí, verificar grants/RLS con dos pasajeros y dos conductores ficticios. Esta fase no se ejecutó en producción.
- Agregar documento privado por expediente, flujo de revisión auditado por admin autenticado, referencias de pruebas de identidad, revocación, retención y privacidad.
- Añadir `assigned_vehicle_id` y snapshot irrevocable a `rides` con constraints, lock `FOR UPDATE`, idempotencia y validación atómica al aceptar. Sin eso **NO** se habilita `accept_ride`.
- Confirmar requisitos de licencia profesional, seguro para pasajeros pagos, casco, moto-taxi y habilitación para cada municipio con asesoría local. No inferir legalidad de una clase de licencia.
- Cotización Google Routes separada AUTO/TWO_WHEELER a través de un servidor y tarifas aprobadas; GPS fresco con consentimiento, app nativa y recorridos físicos; PSP sandbox y ledger.
- No restablecer grants de las ocho funciones bloqueadas ni cambiar `LIVE_TRIPS_ENABLED=false` por esta propuesta.

## Pruebas iniciales de arquitectura
El test de contrato estático de SQL `src/domain/g2-staging-schema.test.ts` impide introducir accidentalmente permisos de autoaprobación, reabrir viajes o alterar tablas heredadas. No sustituye PostgreSQL en STAGING ni pruebas de concurrencia.

## Criterio de éxito
G2 no se puede declarar aprobado hasta demostrar con cuenta ajena: imposibilidad de acceder a certificaciones, imposible asignar AUTO a viaje MOTO y viceversa, seguros/pólizas caducados rechazados, permiso municipal y cascos rechazados si faltan, estado suspendido bloqueado, elección de **vehículo concreto** y snapshot atómico, sin habilitar viajes comerciales.
