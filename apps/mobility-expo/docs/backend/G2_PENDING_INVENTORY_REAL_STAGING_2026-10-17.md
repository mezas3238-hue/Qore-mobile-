# G2 — De solicitud a inventario pendiente (STAGING REAL)

Fecha de implementación: 2026-10-17. **No LIVE / sin usuarios ni vehículos reales.**

## Entorno y estado aplicados
- Lovable STAGING de movilidad **nuevo** ID `9c677bb2-746b-419f-ad9c-dd6d26bab944`, con Supabase habilitado. Nunca ejecutar esta migración en `2fa91fe1-e7a0-4fff-a16f-7d457b2d6eed` / ref `qdqrlgzlotnfdxzpacxs`.
- El esquema remoto G1/G2 antes de esta ronda constaba de **9 tablas públicas**, bucket `mobility-staging-driver-evidence` privado, 0 usuarios, 0 solicitudes y 0 vehículos.
- SQL nuevo versionado: `docs/backend/staging_only/G2_APPLICATION_TO_PENDING_INVENTORY_STAGING_ONLY.sql` — **APLICADO en el Supabase de STAGING nuevo** dentro de transacción con pre/postcondiciones.
- PostgreSQL remoto devolvió: `public_tables=10`, `audit_rows=0`, `draft_rows=0`, `inventory_rows=0`, `client_can_stage=false`, `service_can_rewrite_audit=false`. No hubo altas ni aprobación de vehículos.

## Diseño: pending-only
La función `public.mobility_stage_vehicle_pending(application_id,reviewer_id,request_key)` se concede **solo a `service_role`**:
- Exige que el revisor posea rol administrador en `public.user_roles`, que sea distinto del conductor y que la solicitud esté pendiente y marque evidencia sin verificar.
- Deriva los atributos del vehículo **directamente de la solicitud existente en la base**, nunca del JSON de un cliente. El vehículo creado siempre tiene `review_status='pending'`.
- Usa bloqueo transaccional advisory por application_id, unicidad `request_key`, `application_id` y `vehicle_id` en `mobility_vehicle_intake_audit`, además de chapa única en `mobility_vehicles`. Reintentos iguales devuelven el mismo ID; reintentos diferentes contra la misma solicitud se rechazan.
- `mobility_vehicle_intake_audit` está bajo RLS, sin `UPDATE` ni `DELETE` otorgados al rol de servicio, y sin lectura a clientes.
- MOTO puede estar *pending* para investigación documental pero **no puede pasar revisión comercial/ser ofrecida**. Sus gates de preflight y review siguen denegando esa operación.
- No asigna rol conductor, no verifica documentos, no concede licencia, no crea viajes, rutas, pagos, promociones, GPS ni permisos municipales.

## Hallazgo y cierre ACL remoto
El primer CI de PostgreSQL reveló que usar `SELECT ... FOR UPDATE` sobre las solicitudes exigía `UPDATE`; se corrigió sustituyéndolo por `pg_advisory_xact_lock()` por solicitud, sin conceder privilegios nuevos.

La inspección en Supabase REAL detectó que las ACL por defecto de Supabase habían concedido inadvertidamente `UPDATE`/ `DELETE` al rol de servicio sobre `mobility_vehicle_applications`, pese a la intención de solo `SELECT,INSERT`. Se reparó en la base STAGING con migración versionada `docs/backend/staging_only/G2_LOCK_IMMUTABLE_APPLICATION_STAGING_ONLY.sql`:
- Se revocaron todos los privilegios del rol servicio sobre dicha tabla y se concedieron **únicamente SELECT + INSERT**.
- PostgreSQL remoto confirmó `service_update=false`, `service_delete=false`, `service_insert=true`, sin modificar cuentas ni registros.
- El archivo de contrato original `G2_APPLICATION_INTAKE_DO_NOT_APPLY_PRODUCTION.sql` fue corregido para futuras bases recién creadas.

## Adaptador local y pruebas
- `server/g2-staging-vehicle-gateway.mjs` define `POST /v1/staging/admin/materialize-pending`, payload **únicamente** `requestKey` y `applicationId`, revisor derivado de `auth.getUser(token)` verificado en servidor.
- `server/run-g2-local-staging-gateway.mjs` expone dicho endpoint solo por `127.0.0.1`, usa claves `service_role` **únicamente** del servidor; **NO desplegado**, no accesible a clientes Expo y no conectado a la consola Lovable.
- `server/g2-staging-vehicle-gateway.test.mjs` añade falsificación de revisor, UUID inválido, propiedades `approved` y errores de permisos de base.
- `scripts/sql/g2_postgres_smoke.sql` ejecuta el SQL real con fixtures sintéticos en PostgreSQL 16 efímero y prueba idempotencia, conductor, privacidad, admin, MOTO y ninguna elevación a aprobado.

## Gates abiertos y restricciones
- **Auth invite-only no certificado:** Lovable reportó anteriormente `disable_signup=false`; no se ha confirmado un cambio en la configuración nativa. Requiere `Disable sign-up` en el proyecto Lovable STAGING y verificación posterior; ocultarlo en la UI no es suficiente.
- Faltan dos identidades ficticias de Auth en nuevo Supabase, verificación JWT y Storage REST real, evidencia/seguro obligatorio verificable por persona habilitada, pantalla administrativa protegida, controles antiabuso y auditoría de documentaciones.
- **Toda interfaz pública de transporte** permanece deshabilitada, `LIVE_TRIPS_ENABLED=false`, sin reabrir las 8 RPC legacy de viajes del Supabase viejo y sin tocar Flutter trading.
