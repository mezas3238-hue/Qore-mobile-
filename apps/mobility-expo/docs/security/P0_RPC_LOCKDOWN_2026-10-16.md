# P0-SEC-001 — Bloqueo de RPC operativas y endurecimiento de roles
Fecha: 2026-10-16. Estado: migración propuesta y versionada; revisar ejecución real y CI en GitHub.

## Evidencia contra base aplicada (lectura solo de metadatos)
- Supabase habilitado en proyecto Lovable `2fa91fe1-e7a0-4fff-a16f-7d457b2d6eed`, ref `qdqrlgzlotnfdxzpacxs`.
- Conteos agregados al momento de inspección: perfiles 0, solicitudes conductor 0, viajes 0, viajes activos 0. Es una fotografía, no garantía futura.
- 10 tablas públicas: RLS habilitado, no FORCE RLS. `profiles`, `user_roles`, `vehicles`, `rides`, `ride_events` y `driver_applications` tienen políticas por propietario/admin o participante en el snapshot aplicado.
- `storage.objects` controla `driver-docs` por carpeta propietario/admin según `pg_policies`; aún se requieren pruebas JWT adversariales.
- Las funciones `request_ride`, `accept_ride`, `advance_ride`, `cancel_ride`, `set_driver_availability`, `get_nearby_requests`, `get_ride_counterpart` y `rate_ride` tenían EXECUTE concedido a authenticated. `LIVE_TRIPS_ENABLED=false` en cliente NO revoca permiso de invocación directa.
- `has_role`, `is_approved_driver`, `handle_new_user` tenían EXECUTE para PUBLIC/anon en ACL. `has_role` podía consultar rol de otro UUID si se conocía.
- Índices parciales `one_active_ride_per_driver` y `one_active_ride_per_passenger` están efectivamente aplicados, pero no sustituyen restricciones de categoría/seguro.

## Migración
Archivo: `supabase/migrations/20261016192600_p0_lockdown_trips_and_roles.sql`.
- Rechaza cambios si el conjunto de 8 funciones esperadas difiere (transacción).
- Revoca ejecución de esas 8 RPC a `PUBLIC`, `anon` y `authenticated`; **no** cambia autorización para `submit_driver_application`, `admin_review_driver`, `admin_stats` ni signup.
- Restringe `has_role`/`is_approved_driver` a la identidad JWT y revoca ejecución `PUBLIC`/anon a funciones auxiliares. Mantiene authenticated para políticas RLS legítimas.
- No elimina tablas, no borra usuarios, no modifica precios 15% ni codifica 10% como comercial, no crea viajes, no habilita wallets.
- Reversibilidad: permisos podrían restituirse manualmente tras G1–G6, **no** debe automatizarse un rollback que reabra operaciones; cualquier futura autorización comercial requiere contrato, servidor con vehículo concreto, seguros, precio versionado y validación independiente.

## Verificación requerida post-aplicación
1. Comparar `pg_proc.proacl` de 8 funciones: ningún EXECUTE PUBLIC/anon/authenticated.
2. Evaluar `has_function_privilege('authenticated', 'public.request_ride(public.vehicle_category,text,double precision,double precision,text,double precision,double precision)', 'EXECUTE')` = false; idem accept/advance y resto.
3. `pg_get_functiondef` de helpers debe exigir `_user_id = auth.uid()` o `_uid = auth.uid()`, y no permitir rol ajeno.
4. RLS y trigger de `profiles`/rol pasajero deben continuar; comparar JWT propios y ajenos en STAGING.
5. Auditoría cliente + service_role: no entregar claves privilegiadas a móviles; futuras RPCs deben nacer deny-by-default.

## Aún bloqueado
Staging Supabase independiente; E2E de permisos con cuentas test; backend seguro vehículo/insurance; rutas reales; pricing comercial aprobado; PSP, conciliación, SOS, pólizas y legislación. No confundir migración con plataforma operativa.
