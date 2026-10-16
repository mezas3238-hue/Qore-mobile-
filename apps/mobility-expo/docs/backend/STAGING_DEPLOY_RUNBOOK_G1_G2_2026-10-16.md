# G1/G2 — Guía de puesta en staging AISLADO (NO PRODUCCIÓN)

**Proyecto aislado**: [QORE Mobility STAGING — NO LIVE](https://lovable.dev/projects/9c677bb2-746b-419f-ad9c-dd6d26bab944). La base Supabase se encontraba `enabled=false` en la última verificación, pendiente de que Lovable reponga el límite temporal de acciones DB. **Nunca ejecutar estos archivos en ref `qdqrlgzlotnfdxzpacxs`.**

## Preconditions / STOP
- `get_database_status.enabled===true` en el **nuevo** proyecto STAGING; ref URL Supabase identificado de manera independiente, distinto del ref Lovable antiguo.
- `QORE_MOBILITY_ENV=staging`; confirmación de dueño de datos que no hay usuarios reales ni configuración prod.
- Guardar un registro de las migraciones ejecutadas (`sha256`, versión, actor, UTC, resultado); no repetir a ciegas ni modificar las tablas heredadas.
- Revisión legal/seguro no habilita viajes; el código operativo sigue `LIVE_TRIPS_ENABLED=false`.

## DDL de staging, con revisión humana y un paso por transacción
1. `docs/backend/staging_only/G1_ISOLATED_SUPABASE_BASELINE_DO_NOT_APPLY_PRODUCTION.sql` — perfiles con lectura propia, roles solo leíbles, nuevo signup asignado únicamente a pasajero, `has_role` protege rol propio.
2. `docs/backend/staging_only/G2_AUTO_MOTO_COMPLIANCE_DO_NOT_APPLY_PRODUCTION.sql` — tablas AUTO/MOTO y evidencias server-only; motos sin permiso para ofrecer viajes.
3. `docs/backend/staging_only/G2_SERVER_PREFLIGHT_DO_NOT_APPLY_PRODUCTION.sql` — consentimiento ubicación registrado en servidor, preflight autorizado solo para servicio de backend; MOTO siempre denegado.
4. `docs/backend/staging_only/G2_REVIEW_AUDIT_DO_NOT_APPLY_PRODUCTION.sql` — revisión de administrador autenticado, auditoría append-only y reintento idempotente; MOTO comercial denegado.
5. `docs/backend/staging_only/G2_APPLICATION_INTAKE_DO_NOT_APPLY_PRODUCTION.sql` — solicitudes pending/evidence_unverified, RLS lectura propia/admin, escritura exclusiva del servidor.

No ejecutar el archivo histórico `docs/backend/LOVABLE_DRIZZLE_0000_REFERENCE_DO_NOT_APPLY.sql`: pertenece al backend Lovable anterior y contiene funciones de viajes inseguras.

## Verificaciones después de cada ejecución
- `pg_policies`, `has_table_privilege` y `has_function_privilege` garantizan ausencia de INSERT/UPDATE/DELETE desde `anon` y `authenticated` en tablas G2, ausencia de `EXECUTE` en RPC de preflight/review/intake.
- Un signup ficticio crea `profiles` y `user_roles(passenger)` exclusivamente, no genera `driver/admin`.
- Crear **solo en staging** dos identidades test con emails ficticios verificados; asignar admin usando consola confiable, no desde cliente, y probar autocertificación, accesos ajenos, expiración, GPS revocado, idempotencia, review MOTO rechazado.
- Con credenciales **anon/publishable** y usuarios desechables ejecutar `scripts/staging-auth-readonly.mjs`; el script bloquea explícitamente la ref antigua.
- Verificar el guard Expo y no enviar service_role a variables EXPO_PUBLIC.

## Contrato inicial de pasarela
El código de `server/g2-staging-vehicle-gateway.mjs` acepta **exclusivamente**:
- `POST /v1/staging/vehicle-applications`: Auth debe comprobar el JWT **en servidor** mediante `auth.getUser(token)`; _driver_id se toma del JWT confirmado, no del JSON cliente; solicitud solo `pending` y documentos no verificados.
- `POST /v1/staging/admin/vehicle-reviews`: _reviewer_id procede del JWT comprobado; además el SQL exige revisor con rol admin diferente del conductor; no asume que review equivale a permiso para operar.
- No acepta parámetros arbitrarios de `role`, `driverId`, `reviewerId`, `verified`, ni vías de pago o ride request. Los contratos rechazan campos desconocidos.

El prototipo local `server/run-g2-local-staging-gateway.mjs` **no está desplegado**. Si se prueba manualmente en estación controlada, necesita `QORE_MOBILITY_ENV=staging`, `QORE_STAGING_PROJECT_REF`, `QORE_STAGING_PUBLISHABLE_KEY`, `QORE_STAGING_SERVICE_ROLE_KEY` en variables de entorno SERVER-ONLY; escucha solamente `127.0.0.1:4141`, no aporta CORS, TLS, rate limiting ni observabilidad de producción. No se autoriza exposición a internet ni conexión con usuarios reales. No almacenar secretos en repo, chats ni archivos de Expo.

## Pruebas automáticas ya reproducibles
- GitHub Actions `mobility-check`: `npm run check`, `node --test server/*.test.mjs`, guard `LIVE_TRIPS_ENABLED=false` y export web.
- GitHub Actions `g2-postgres-contract`: PostgreSQL 16 desechable que ejecuta DDL G1+G2 y comprueba RLS, roles, solicitud idempotente, revisión admin, póliza vencida, GPS revocado, MOTO denegada.
- No son E2E remoto Supabase Auth ni pruebas de plataforma Android/iOS. Cada etapa debe quedar registrada separadamente en handoff.

## Cierre de gate
G1/G2 requieren un staging remoto funcional con migraciones aplicadas allí y pruebas de JWT reales, control de acceso de documentos, logging/monitoreo, rate limit, KYC externo, reglas municipales y cobertura validada. En ningún caso habilitar `LIVE_TRIPS_ENABLED` o restablecer EXECUTE en las ocho RPC legacy.
