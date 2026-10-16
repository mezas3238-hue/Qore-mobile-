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
