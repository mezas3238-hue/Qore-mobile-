# G1/G2 — STAGING separado y certificación PostgreSQL efímera
Fecha: 2026-10-16. **No habilitado para viajes ni clientes reales**.

## Recursos realmente provisionados

**Proyecto Lovable STAGING (nuevo, separado):**
- URL: https://lovable.dev/projects/9c677bb2-746b-419f-ad9c-dd6d26bab944
- ID: `9c677bb2-746b-419f-ad9c-dd6d26bab944`; workspace: `806797cf7f14d2bab85d`.
- Estado de creación: `completed`, agente terminó. La ruta inicial `src/routes/index.tsx` muestra **STAGING — NO LIVE**, sin operaciones, registro público ni pagos; noindex/nofollow. No está publicado.
- **Backend Supabase del proyecto NUEVO: `enabled=false`**. La llamada `enable_database` fue rechazada por cuota Lovable del plan gratuito (reintentar tras ~27 minutos). No afirmar que ya existe una base independiente. No se copiaron usuarios/credenciales/tablas del proyecto antiguo.
- Base Lovable antigua (preproducción): ID `2fa91fe1-e7a0-4fff-a16f-7d457b2d6eed`, ref `qdqrlgzlotnfdxzpacxs`; **distinta**. La comprobación de bucket `driver-docs` también fue rechazada por cuota (mensaje textual: "This query wasn't executed", reintentar tras ~28 min). La migración MIME `20261016195200_private_license_mime.sql` sigue NO APLICADA.

## Alternativa de prueba INMEDIATA concluida: PostgreSQL efímero en GitHub Actions

En `.github/workflows/mobility-ci.yml`, job `g2-postgres-contract` con servicio **postgres:16-alpine** y credenciales ficticias `ci_fixture_only`. No se conecta a Supabase externo, no emplea datos reales y destruye la base al terminar el job.

Ejecuta `scripts/sql/g2_postgres_smoke.sql` contra este Postgres, que:
- Construye `auth.users`, `auth.uid`, roles y ubicaciones sintéticas.
- Ejecuta DDL real de `docs/backend/staging_only/G2_AUTO_MOTO_COMPLIANCE_DO_NOT_APPLY_PRODUCTION.sql`.
- Ejecuta `G2_SERVER_PREFLIGHT_DO_NOT_APPLY_PRODUCTION.sql`, con consentimiento GPS server-controlled y función `SECURITY INVOKER`, sin permiso EXECUTE a anon/authenticated. AUTO requiere documentación vigente, rol driver aprobado, revisor admin, seguro de pasajeros remunerados, consentimiento y GPS fresco.
- **MOTO deliberadamente devuelve FALSE** en preflight incluso con dos cascos/chalecos: aún no existe certificación jurídica municipal ni señal servidor de edad/autoridad de ruta.
- Ejecuta `G2_REVIEW_AUDIT_DO_NOT_APPLY_PRODUCTION.sql`: solo service_role autorizado, revisor con rol admin independiente del conductor, controles de póliza/licencia, estado/revisión versionados, clave idempotente, auditoría sólo SELECT/INSERT (sin UPDATE/DELETE al service_role). Impide aprobar moto comercial y autopromoción.
- Prueba RLS como pasajero/conductor/admin sintéticos, categoría AUTO/MOTO incompatible, conductor de otro vehículo, seguro vencido, GPS revocado, doble revisión/clave idempotente, falsificación de admin, permiso/privacidad en tablas de evidencia.
- Se separa del job `mobility-check` que ejecuta TypeScript, tests puros, guard LIVE y export web. **El resultado local de PostgreSQL no demuestra que políticas idénticas estén aplicadas en Supabase real.**

Primer run con preflight y permisos locales: [push #38979203367](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/38979203367) SUCCESS. Integración adicional con audit de revisión: verificar último run del HEAD del PR #7, logs deben mostrar:
`PASS: PostgreSQL G2 AUTO/MOTO schema, deny-by-default RLS and preflight test.`
y `PASS: G2 admin-only audited review, idempotency and MOTO commercial freeze.`

## Requisitos restantes
1. Esperar/restaurar cuota Lovable; habilitar Supabase **solo en proyecto staging NUEVO**.
2. Leer identificador real/ref y claves `sb_publishable_` **sin compartir claves privilegiadas**, comprobar que ref no coincide con `qdqrlgzlotnfdxzpacxs`; migrar esquema revisado contra staging, con copia y drift.
3. Provisionar dos usuarios de test exclusivamente staging y ejecutar `scripts/staging-auth-readonly.mjs`, JWT Auth/login/logout, almacenamiento privado y ataques cruzados; no trasladar usuarios antiguos.
4. Aplicar MIME del bucket privado en el backend correcto una vez reestablecida cuota y verificar `allowed_mime_types`, sin publicar documentos personales.
5. Añadir flujo de registro remoto integrado con autenticación verificada del conductor y revisión a través de gateway seguro; esta ronda sólo incluye backend *SQL staged* y formularios **puros**.
6. Completar valoración legal moto por municipio, seguro remunerado contractual y verificación de edad/consentimiento; servidor atómico de viaje con snapshot, GPS y quote firmado. Mantener 8 RPC legacy revocadas y `LIVE_TRIPS_ENABLED=false`.

**Política de seguridad:** staging no se comunica con producción, Flutter trading ni servicios QORE Core; `service_role` jamás reside en cliente. PR #7 sigue borrador sin merge.

## G2 Intake — ampliación del flujo de registro de conductor/vehículo
- Se agregó `docs/backend/staging_only/G2_APPLICATION_INTAKE_DO_NOT_APPLY_PRODUCTION.sql`: `mobility_vehicle_applications` guarda AUTO/MOTO **solo en estado `pending`**, `evidence_unverified=true`, sin campos de `approved` ni capacidad de activar viajes.
- `mobility_submit_vehicle_draft` se ejecuta **solo con service_role** bajo un gateway que deberá validar JWT de quien pide registro. Un pasajero autenticado NO tiene permiso SQL para saltar el gateway y escribir en esa tabla. Firma no acepta booleanos de verificación de documentos.
- `request_key uuid UNIQUE` proporciona idempotencia; reintento idéntico devuelve ID original y payload conflictivo es rechazado. La categoría MOTO puede *solicitar* revisión, pero permanece sin autorización comercial.
- Política RLS muestra únicamente solicitudes propias a su autor y al administrador autorizado; las pruebas PostgreSQL simulan los JWT de pasajero, conductor y admin.
- El script `scripts/sql/g2_postgres_smoke.sql` amplió pruebas reales de PostgreSQL con este tercer gate. [Push CI #38979757291](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/38979757291) contiene los logs esperados:
  `PASS: G2 AUTO/MOTO pending-only intake queue, JWT RLS and idempotency.`
- **NO** se conectó cliente Expo a este método; el backend remoto nuevo de staging sigue sin habilitarse por cuota Lovable. Requiere gateway JWT real, validación upload KYC, revisión humana y normativa municipal.

## Actualización G1 — Supabase STAGING ya provisionado (2026-10-16)
- **RESULTADO NUEVO verificado:** `get_database_status` del proyecto Lovable nuevo `9c677bb2-746b-419f-ad9c-dd6d26bab944` devolvió `{"enabled":true,"stack":"supabase"}`. **Se consiguió habilitar la base en STAGING, no en el Lovable anterior.**
- Consulta PostgreSQL read-only en STAGING nuevo devolvió `database_name=postgres`, `db_role=postgres`, `auth_schema=true`, `auth.users` presente, **0 usuarios Auth**, `public_tables=null`, `custom_enums=null`, `legacy_request_rpc_present=false` y **0 buckets**. Verificado explícitamente que es una base limpia, separada funcionalmente de la base antigua que contiene las diez tablas legacy.
- `app.settings.supabase_url` y `app.settings.project_ref` devolvieron NULL: **todavía no se ha identificado/verificado el ref público Supabase propio del nuevo proyecto**. No reutilizar ref `qdqrlgzlotnfdxzpacxs` jamás.
- Se creó `docs/backend/staging_only/G1_ISOLATED_SUPABASE_BASELINE_DO_NOT_APPLY_PRODUCTION.sql`, tested con Postgres CI: tablas `profiles`, `user_roles`, `driver_locations` y trigger signup a rol `passenger` únicamente; RLS de lectura propia. No crea funciones de viaje, tarifa ni pagos.
- **Intento de ejecutar G1 baseline en STAGING remoto NO aplicado:** Lovable respondió explícitamente "This query wasn't executed; retry in 2 minutes" por su límite de acciones. NO afirmar que haya tablas G1 remotas. Todos los SQL G1/G2 siguen sin aplicar en Supabase remoto hasta una respuesta exitosa.
- El CI ha verificado que la base G1 y las cinco piezas de G2 se ejecutan correctamente juntas en PostgreSQL 16 desechable: [PR run #38981291543](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/38981291543) SUCCESS.
- El gateway `server/g2-staging-vehicle-gateway.mjs` con pruebas `server/*.test.mjs` existe: vincula identidad de `auth.getUser(token)`, no acepta roles/revisores fraudulentos y no habilita viajes. El ejecutable `server/run-g2-local-staging-gateway.mjs` sólo localhost, **no desplegado** ni conectado a clientes.
- Siguiente acción: esperar cuota Lovable sin repetir queries fallidas, luego **aplicar solo G1 baseline** a la base nueva verificada, leer pg_catalog post-DDL y pasar progresivamente a G2 con comprobación de permisos; sin datos reales ni fusiones.

## **Resultado certificado de despliegue SQL a Supabase STAGING** — 2026-10-16
- Proyecto Lovable **nuevo** ID `9c677bb2-746b-419f-ad9c-dd6d26bab944`, `get_database_status.enabled=true`. El backend antiguo de movilidad sigue siendo ID `2fa91fe1-e7a0-4fff-a16f-7d457b2d6eed` y no se tocó por esta instalación.
- **G1 remoto APLICADO** mediante `query_database` usando íntegramente `docs/backend/staging_only/G1_ISOLATED_SUPABASE_BASELINE_DO_NOT_APPLY_PRODUCTION.sql`. Operación respondió `{"rows":[]}`; la comprobación post G1 separada fue rechazada por cuota y **NO** se ejecutó.
- **G2 remoto APLICADO de forma ATÓMICA en una sola transacción**: se obtuvieron de GitHub los cuatro SQL G2 staged (AUTO/MOTO compliance, server preflight, review audit, application intake), retirando solo las envolturas `BEGIN/COMMIT` de cada documento, y se ejecutó `BEGIN; precondition; [4 SQL]; postcondition; COMMIT; SELECT`. La precondición impidió ejecutar si `auth.users` no estaba vacío, si faltaba G1, existía cualquier tabla ajena a `profiles,user_roles,driver_locations`, existía RPC vieja `request_ride` o `authenticated` tenía INSERT de roles. La postcondición aborta/rollback si faltan tablas G2, RLS no activo, cliente puede insertar solicitud/actualizar vehículos o ejecutar RPC preflight/review/intake.
- **Respuesta real del servidor:** `{"rows":[{"auth_users":0,"client_can_insert_app":false,"client_can_review":false,"public_table_count":9}]}` — postcondiciones satisfechas. Se aplicaron exclusivamente tablas de identidad, ubicación, inventario, revisión, consentimiento, compliance y solicitudes; ninguna de viajes ni pagos.
- **G2 no está habilitado comercialmente:** `mobility_vehicle_preflight` rechaza MOTO sin condiciones jurídicas, `mobility_review_vehicle` rechaza aprobación comercial MOTO, las RPC solo aceptan `service_role`, no `anon`/ `authenticated`. El gateway remoto a solicitudes **NO está desplegado**, Expo `LIVE_TRIPS_ENABLED=false`, usuarios Auth=0; no se han ejecutado pruebas JWT reales ni upload de documentos.
- Ref público específico `*.supabase.co` del nuevo proyecto continúa no documentado (settings SQL NULL). No reutilizar la ref antigua `qdqrlgzlotnfdxzpacxs` en la app. Instalar la capa HTTPS segura, claves solo servidor, fixture Auth desechable y pruebas entre cuentas.
- **No confundir** estas migraciones REMOTAS G1/G2 (aplicadas en proyecto nuevo) con la migración MIME del bucket `driver-docs` del proyecto anterior (todavía pendiente/NO aplicada salvo comprobación posterior).
