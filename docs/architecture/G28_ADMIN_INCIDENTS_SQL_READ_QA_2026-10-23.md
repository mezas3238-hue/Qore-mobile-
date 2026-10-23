# G28 / A05.3 — Incidentes Admin con PostgreSQL descartable

23 de octubre de 2026 · Arquitecto A · PR #7 DRAFT · QA únicamente.

## Trabajos implementados y su alcance

1. G28_ADMIN_INCIDENT_PAGE_POSTGRES_CI_ONLY.sql instala la función privada mobility_stage_g28_admin_incident_page(uuid,bigint,text,integer) en PostgreSQL 16 desechable. Depende de tablas G8 y autoridad G27. Sólo service_role dispone del permiso EXECUTE. La función exige rol Admin exclusivo, activo y scope admin.incidents.read; páginas de 50, sin límite global de registros ni OFFSET. Restringe el DTO a incidentId, category, severity, status, createdAt y revision, sin identidad de denunciantes.
2. La cadena CI ya aplica las migraciones G7 (tarifas/pagos SIMULADOS) y G8 (incidentes) que existían, antes del RPC G28. No han sido migradas a un Supabase real.
3. G28_ADMIN_INCIDENT_PAGE_ASSERT_POSTGRES_CI_ONLY.sql prueba 121 incidentes sintéticos con timestamps iguales en 3 páginas (50 + 50 + 21), cero duplicados, control bajo service_role, denegación Owner/dual-role, limit 51 y cursor manipulado, sin cambios persistentes porque finaliza con ROLLBACK.
4. g28-backoffice-sql-read-repository.mjs convierte únicamente admin.incidents.read en consulta RPC; los otros cuatro scopes (KYC, zonas, auditoría, Owner Finance) siguen denegados hasta certificar fuentes reales.
5. g28-backoffice-integration.test.mjs prueba gateway JWT/MFA sintético + adaptador roles G27 + RPC simulada + transporte HTTP local 127.0.0.1, con rechazo al suspender Admin. No existe listener público.

## Paginación y semántica

50 filas es límite de transporte por respuesta, NUNCA límite general. La posición es (createdAtMs, incidentId), descendente, al truncar timestamp a milisegundos para compatibilidad con contrato B y desempatar por UUID. nextCursor se firma y queda ligado a usuario, sesión y scope por G27. Consistencia eventual, no snapshot MVCC fuerte: refresco desde primera página ante cambios concurrentes (ver G26.5).

El índice de created_at DESC, id DESC es provisional; faltan EXPLAIN ANALYZE de altos volúmenes y un índice de expresión acorde a la comparación real para certificar eficiencia masiva. No afirmar rendimiento que aún no se ha probado.

## Pendientes antes de activar el panel real

- Integrar base de datos de STAGING autorizada, con JWT revocable, MFA real AAL2 y secretos privados, solamente en backend.
- Montar los adaptadores sin habilitar una red pública hasta autorización expresa y pruebas E2E.
- Implementar lecturas SQL independientes y seguras de KYC, zonas y auditoría; no inferir la disponibilidad de zonas a partir de cobertura.
- Owner Finance permanece BLOQUEADO: G7 es exclusivamente de pagos simulados, por tanto no corresponde afirmar ingresos conciliados de operación comercial.
- Revisión RLS, retención legal de incidentes, auditoría de lecturas y pruebas >30.000 registros sin límite global.
- Separación A/B: la forma del DTO incidents es compatible con proyector Admin B. Mantener enabled=false, certifiedContracts=[] en B; sus archivos no se tocaron.

Sin merge, no LIVE, no deploy, no SQL remoto y no datos personales reales.
