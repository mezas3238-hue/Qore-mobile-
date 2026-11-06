# G312 — Soporte PostgreSQL + acciones privadas: estado de implementación

**Corte:** 2026-11-05. **Propietario del frente:** Arquitecto C / issue #120. PR encadenado a G311 #121, G309 #116 y UI G301 #104.

## Descubrimiento confirmado sobre STAGING

Supabase PostgreSQL 17 sigue `ACTIVE_HEALTHY`. La inspección de `information_schema.tables` encontró tablas de seguridad `mobility_stage_safety_incidents`, pero **no encontró tablas `public.*support*`**. El esquema G301 no se ha aplicado y **no se deben inventar identidades de soporte ni de Owner**.

La forma real de `auth.sessions` PG17 incluye `factor_id`, `aal`, `not_after`; `auth.mfa_factors` incluye `factor_type` y `status`; el registro `public.mobility_stage_backoffice_roles` contiene `role,status,approved_by`. Por lo tanto, la política de autenticación G301 se puede probar en un laboratorio aislado con un esquema mínimo estructural.

## Nuevo componente G312

`sql/g312-support-private-action-requests-draft.sql` crea una **bandeja de solicitudes** sin contenido personal:

- UUID de solicitud, ticket y agente; acción predefinida; estado esperado; clave UUID de idempotencia; estado inmutable `QUEUED` y marca de tiempo.
- RLS activado y forzado; cero políticas para navegador; `anon` y `authenticated` no leen ni escriben. Únicamente `service_role` (servidor futuro) recibe `SELECT/INSERT`; sin `UPDATE/DELETE`.
- Unicidad por (agente, ticket, clave de idempotencia). Es una **propuesta de esquema**: no abre un endpoint ni efectúa la transición del ticket.
- Los casos reales y roles de Soporte aún requieren la migración G301 anterior y un proveedor de identidad aprobado.

`scripts/sql/g312-support-disposable-ci.sql` crea usuarios ficticios en PostgreSQL 16 descartable y verifica:
1. Un agente ve solo sus casos más la cola no asignada; otro no ve los suyos.
2. Un Owner con AAL2 **no hereda** acceso a Soporte.
3. AAL1, expiración o revocación producen cero casos visibles.
4. Identidad y teléfono del reclamante no pueden consultarse con permisos de Soporte.
5. Navegadores autenticados no pueden insertar acciones.
6. La cola privada detecta reintentos duplicados y no concede modificación/borrado al servidor.

## Condiciones antes de aplicar a Supabase STAGING

1. Revisar migración G301 (que es base de G312) sobre el esquema PG17 exacto, incluyendo políticas, permisos en `public`, rol Owner aprobado y sesiones Auth.
2. Verificar el comportamiento de `SECURITY DEFINER` G301 con los asesores de seguridad y pruebas de negación con 2 usuarios A/B **reales de STAGING**, sin documentos ni PII.
3. Verificar que `service_role` nunca salga del servidor, que el futuro endpoint `qore-support-actions` valide JWT + MFA AAL2 + sesión vigente, asignación, estado y idempotencia **en una transacción única**.
4. Revisar seguridad de datos/respuesta, registro de auditoría y retención antes de permitir cambios de estado.
5. Aprobar el despliegue de esquema STAGING de forma coordinada con Owner/Integrador. **No merge ni deploy en este PR.**

## Límites

Este PR contiene exclusivamente Soporte y su CI. **No altera** Cliente/Driver, GPS, APK, Comercio, PSP, tarifas, Railway, bases de datos reales ni producción. Hasta que exista el backend transaccional y los roles, el Portal de Soporte permanece bloqueado y las acciones G311 siguen desactivadas. 
