# Auditoría estática de backend Lovable / Supabase — 2026-10-16

**Estado:** inspección de fuente SQL sin ejecución ni mutaciones. Fuente `drizzle/migrations/0000_migration.sql`, copia de referencia en `docs/backend/LOVABLE_DRIZZLE_0000_REFERENCE_DO_NOT_APPLY.sql`. El backend reporta Supabase habilitado, proyecto Lovable `2fa91fe1-e7a0-4fff-a16f-7d457b2d6eed`, proyecto NO publicado. Se comprobó `information_schema.columns` con query SELECT; consultas directas de `pg_policies` y `pg_proc` fallaron por cuota temporal. La copia SQL de Lovable **no prueba que las políticas estén efectivamente aplicadas**.

## Hallazgos P0 verificados por lectura del código SQL
1. **Aceptación sin categoría/vehículo concreto:** `accept_ride(_ride_id)` solo comprueba `is_approved_driver(uid)`, `driver_locations.available`, estados y carrera. No verifica `rides.category = vehicles.category`; tampoco vehículo aprobado, inspección o cobertura; `rides` carece de `vehicle_id` y snapshot. Riesgo de conductor de categoría distinta.
2. **Aprobación documental débil:** `admin_review_driver` requiere rol admin, pero no existen campos/restricciones para póliza habilitada, vencimiento, licencia clase adecuada, inspección ni fotos verificadas. `submit_driver_application` permite `_license_doc_path IS NULL`. El checklist UI no equivale a verificación documental persistida.
3. **Solo categoría automóvil en backend:** enum `vehicle_category` = `economico`, `confort`, `xl`; `vehicles` tiene `UNIQUE(driver_id)`, no moto pasajero y sin multi-vehículo. No extender enum/índices sin migración aditiva revisada.
4. **Tarifa estimada insegura para dinero real:** `request_ride` usa Haversine ×1.3, 22 km/h + 3 min, usa `fare_configs` (seed 15%); no trazas de proveedor/route_id, expiración, aceptación de quote versionada o ajuste de pickup. Sin pagos/ledger.
5. **Disponibilidad y GPS:** `set_driver_availability` solo comprueba coordenadas no nulas cuando `_available`; no se ven límites geográficos, consentimiento atestado, monotonicidad ni staleness. `get_nearby_requests` comprueba disponibilidad, no caducidad de localización. `get_ride_counterpart` devuelve coordenadas de conductor mientras viaje activo, sin chequear antigüedad de GPS.
6. **Privacidad y funciones SECURITY DEFINER:** existen políticas RLS en snapshot, pero todavía requieren comparar contra sistema aplicado, auditar `pg_proc.proacl`, `search_path`/CREATE sobre esquema `public`, permisos anon/authenticated, storage, JWT adversarial y retención. `has_role` e `is_approved_driver` son consultas SECURITY DEFINER que necesitan revisión de EXECUTE/filtraciones.
7. **Seguros y cobros no existen:** faltan registros legales y financieros para servicio comercial, efectivo/PSP, idempotency keys, ledger, wallet/settlement y administración de riesgos.

## Hallazgos positivos sujetos a verificación dinámica
- Índices parciales contra doble viaje para pasajero y conductor están definidos en SQL.
- `admin_review_driver` restringe rol admin en función SQL y `user_roles` no tiene escritura directa concedida a autenticados en la migración.
- El bucket `driver-docs` tiene políticas storage para propietario/admin dentro del SQL de referencia; verificar bucket privado creado, defaults y ACL aplicados en staging.
- Muchas RPC sensibles revocan EXECUTE a anon/public y lo conceden a authenticated; confirmar todas las firmas y grants reales.

## Remediación por prioridades
- **Inmediato:** conservar `LIVE_TRIPS_ENABLED=false`, incluso si Supabase ya expone RPC; probar que la UI no accede a funciones reales de viajes.
- **G1:** pg_policies/pg_proc/pg_class + storage/cron/triggers snapshot aplicado y drift; crear Supabase staging separado con fixtures y arnés de 2 pasajeros; pruebas de registrar conductor AUTO, documentos bucket y aprobación controlada.
- **G2:** migración aditiva con `vehicle_kind`, `service_category`, tablas evidencia inspección/póliza con expiry, aprobación y `vehicle_id` obligatorio al aceptar, snapshot inmutable; validar conductor+licencia+vehículo+tipo+seguro ATÓMICAMENTE.
- **G3:** cotización server-authoritative basada en rutas calles reales, versión y TTL; costos reales, comisiones por ciudad y vehículo, sin tarifario en cliente.
- **G4:** despacho por ETA y vehículo aprobado + ubicación fresca/opt-in + idempotencia/concurrencia.
- **G5/G6:** ledger, PSP sandbox, seguros comerciales y habilitación legal municipal; observabilidad, emergencias, dispositivos, auditoría y autorización escrita.

## Estado de pruebas
CI de G0 `ecea25e...`: runs 38853056796/38853085599 SUCCESS. CI de guard G2 `017e5c4...`: runs 38853315755/38853320224 SUCCESS. G1 staging RLS smoke solo implementado, **NO EJECUTADO** por falta de staging/fixtures. No se hicieron builds físicos. Nuevas pruebas del archivo de licencia están en commit `34833296981616ed102f9af9e94914cf4068fedc`, verificar CI final antes de declarar aprobadas.

**Riesgo:** el SQL de esta carpeta es evidencia histórica, nunca la ruta ejecutable `supabase/migrations`. Para comparar migraciones reales se necesita acceso autorizado y snapshot de drift.
