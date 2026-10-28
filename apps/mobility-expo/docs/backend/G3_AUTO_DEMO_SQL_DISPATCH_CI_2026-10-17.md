# G3 AUTO — contrato SQL de viajes de DEMOSTRACIÓN, SOLO CI

**Fecha:** 2026-10-17 · **Estado:** implementado y aprobado en PostgreSQL 16 efímero, **NO desplegado en Lovable/Supabase remoto**, NO conectado al cliente Expo, NO viajes ni cobros reales.

## Qué se versionó

- `docs/backend/staging_only/G3_AUTO_DEMO_TRIP_CONTRACT_POSTGRES_CI_ONLY.sql`: tipo de estado ficticio, tabla de `mobility_stage_auto_demo_trips` y tabla de eventos `mobility_stage_auto_demo_events`. No existen coordenadas GPS, importe pagadero, plataforma de cobro ni dispatch comercial en estas tablas.
- RPCs **solo service_role** `mobility_stage_auto_demo_request`, `mobility_stage_auto_demo_accept`, `mobility_stage_auto_demo_transition`. El backend futuro deberá verificar `auth.getUser(token)` y derivar `_passenger_id` / `_driver_id` del usuario, no aceptar identidad en JSON. Ninguna RPC está expuesta a anon/authenticated.
- La aceptación usa `SELECT ... FOR UPDATE` sobre el viaje ficticio + validación de `mobility_vehicle_preflight` existente + evento con revisión única. Índices parciales impiden más de un viaje activo por pasajero y más de uno asignado por conductor. Cualquier vehículo MOTO está prohibido por servicio AUTO y por preflight.
- Las transiciones admitidas son `searching → accepted → arriving → in_progress → completed` o cancelación por pasajero únicamente antes de iniciar. Rechaza actor ajeno, saltos de etapa, repetición con clave idempotente distinta, regreso desde `completed` y dos asignaciones.
- Los lectores con `authenticated` solo pueden consultar **sus propios viajes ficticios** por RLS; los eventos de auditoría son solo de servidor, con `SELECT, INSERT` y **sin UPDATE/DELETE para service_role**.

## Pruebas CI reales, no simulaciones de SQL

Se incluyeron las migraciones **únicamente** dentro de `scripts/sql/g2_postgres_smoke.sql` contra un PostgreSQL 16 de GitHub Actions. `scripts/sql/g3_auto_demo_trip_smoke.sql` utiliza identidades **sintéticas** de pasajero/admin/conductor y vehículos ficticios con seguros y autorizaciones inventadas **solo para CI**.

La prueba comprueba idempotencia de solicitud, prohibición de dos viajes activos, coincidencia de vehículo y conductor, bloqueo de MOTO, eventos auditados, reintentos seguros, no cancelar viaje iniciado y lectura RLS propia/ajena. No se crean usuarios reales.

También se agregó `scripts/sql/g3_concurrent_accept_ci.sh` al workflow: dos **procesos psql distintos** intentan aceptar el **mismo viaje** con dos conductores AUTO diferentes que poseen vehículos y preflight sintéticos válidos. Se exige exactamente un resultado exitoso, uno rechazado, una revisión de estado y un evento `accepted`; comprueba que el vehículo ganador pertenezca al conductor ganador. El test pasa sobre PostgreSQL real de CI. Esto **no** prueba pérdida de red, reintentos de clientes móviles o carga distribuida.

## Separación estricta de entornos

El Supabase Lovable STAGING NUEVO `9c677bb2-746b-419f-ad9c-dd6d26bab944` conserva su esquema G1/G2 anterior: **no se ha aplicado G3**. El backend anterior `qdqrlgzlotnfdxzpacxs` nunca se modifica. La rama Flutter trading PR #2 tampoco se modifica. `LIVE_TRIPS_ENABLED=false` continúa obligatorio.

## Qué falta para utilizarlo con dos teléfonos reales

1. Confirmar `disable_signup=true` del propio Supabase de STAGING y aprovisionar dos cuentas de prueba confirmadas; correr JWT y Storage REST E2E.
2. Diseñar y aprobar la API autenticada de pasajeros/conductores, incluyendo limitación distribuida, mensajes de error, suplantación de identidad, eventos y reconexiones; incorporar estados/G3 revisados en el backend de STAGING antes de desplegar en la nube.
3. Sustituir los `origin_tag` ficticios por mapas y rutas fiables, precio/quote firmados por servidor, documentación y licencias reales.
4. Integrar consentimiento GPS, cobros y liquidaciones con proveedor autorizado, prevención de fraude, soporte y comprobantes. Obtener cobertura legal/municipal.
5. Ejecutar E2E con dos dispositivos, pruebas de concurrencia bajo carga, cancelaciones, fallas de red, baterías, permisos GPS y seguridad; solo entonces considerar piloto AUTO bajo aprobación expresa.

**G3 SQL CI aprobado NO significa despacho productivo, ni permite viajar o cobrar.**
