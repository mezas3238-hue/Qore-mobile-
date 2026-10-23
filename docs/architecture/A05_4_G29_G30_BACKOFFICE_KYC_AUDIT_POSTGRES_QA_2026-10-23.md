# Arquitecto A — A05.4 / G29 + G29.1 + G30 — KYC y auditoría Admin de fuentes reales

**Fecha:** 2026-10-23. Repositorio `mezas3238-hue/Qore-mobile-`. Rama `feature/mobility-monorepo-isolated-20261016` · PR #7 DRAFT. No merge, no SQL remoto, no VPS, no LIVE, no PSP.

## Entregado

### G29 — Bandeja KYC de vehículos AUTO

- Archivo: `apps/mobility-expo/docs/backend/staging_only/G29_ADMIN_KYC_PAGE_POSTGRES_CI_ONLY.sql`.
- RPC `mobility_stage_g29_admin_kyc_page(uuid,bigint,text,integer)`. Requiere rol privado **Admin activo y exclusivo** de G27 en cada consulta, invocable exclusivamente por `service_role`. Fuente de verdad: `mobility_vehicles` G2 con revisión de `G2_REVIEW_AUDIT` + expediente privado `mobility_stage_driver_documents` G17 + cumplimiento de chofer/vehículo G2. Los documentos nunca salen al frontend: ni imagen, bucket, nombre, object_key, sha256, matrícula ni identidad.
- Estado actual de esta bandeja: vehículos `AUTO` con `review_status='pending'`. Las motos de G2 son `moto_pasajero`, **no son MOTO_DELIVERY** y se excluyen explícitamente hasta contar con modelo legal y técnico verificado de reparto.
- `licenseStatus`, `insuranceStatus`, `inspectionStatus` se derivan de evidencia G17 y, para calificar como **valid**, fecha de vigencia y verificadores G2. Un documento aprobado sin verificación adicional queda **pending**; si tiene fecha legal vencida queda **expired**. Las ausencias devuelven **missing** y un rechazo permanece **rejected**. No significa aprobación general del vehículo: la aplicación sigue en pending.
- Solo devuelve `vehicleId`, `vehicleKind`, `applicationStatus`, `licenseStatus`, `insuranceStatus`, `inspectionStatus`, `reviewRevision`. Prohibida la exposición de PII.
- Orden descendente estable por UUID, página máxima de 50 y **sin límite global de registros**. Cursor HMAC, actor, sesión y scope G27. CI: 121 expedientes AUTO en 50/50/21, cero duplicados, moto pasajero excluida, falso rol/revocado denegado y prueba de licencia aprobada pero vencida (G29.1).

### G30 — Auditoría operativa de tres clases, parcial pero verdadera

- Archivo: `G30_ADMIN_AUDIT_PAGE_POSTGRES_CI_ONLY.sql`.
- RPC `mobility_stage_g30_admin_audit_page(uuid,bigint,text,integer)`: lector privado únicamente para Admin exclusivo G27 con scope `admin.audit.read`. Fuentes append-only reales **G8 incident moderation**, **G8 suspensiones/restablecimientos**, **G2 revisiones de vehículos**. El resultado usa sólo códigos de acción, tipo, desenlace, marca temporal, revisión y eventId; nunca actorId, expediente, reasonCode ni datos personales.
- Es expresamente un **subconjunto de auditoría**: NO incluye todavía cambios de tarifa, comisiones, merchants, habilitaciones de zonas, sesiones de operador o lectura de expedientes. Por lo tanto NO se puede afirmar que certifica el libro de auditoría completo.
- Keyset descendente por `occurredAtMs+eventId`, máximo 50 por página, **sin límite global**. CI 123 eventos sintéticos de tres fuentes en 50/50/23; autenticación nativa antigua no confiere automáticamente rol Admin del nuevo backoffice.

### Integración HTTP local

El adaptador `g28-backoffice-sql-read-repository.mjs` permite actualmente solamente `admin.incidents.read` (G28), `admin.kyc.read` (G29) y `admin.audit.read` (G30). La composición local `g28-backoffice-qa-composition.mjs` prueba los tres contratos por HTTP de **127.0.0.1**, con JWT/MFA **sintéticos** y RPC simulada; las SQL verdaderas se prueban en PostgreSQL 16 desechable en un job separado. La combinación no constituye una integración HTTP ↔ PostgreSQL real remota ni una certificación de MFA de proveedor.

`admin.zones.read` y `owner.finance.read` permanecen **bloqueadas**. No inventar disponibilidad de autos/motos por municipio, cobertura activa, ni ingresos comerciales usando el ledger de pagos simulados G7.

## Invariantes y limitaciones

- G29 y G30 requieren los controles privados G27 y la validación de JWT/MFA vigente del servidor. El navegador B no obtiene el servicio role.
- Solo 50 elementos por página; sin máximo total. Lectura de consistencia eventual (ver G26.5), refrescar desde página uno ante commits tardíos y deduplicar por clave.
- No se ha medido el índice y plan de ejecución con EXPLAIN ANALYZE a gran escala para G29/G30; NO reclamar latencia o escalabilidad comercial.
- Operaciones son estrictamente **GET / read-only**. No habilitar firma KYC, documentos binarios, SOS real, pagos ni alteración de roles desde Admin Web.
- El flujo STAGING público HTTPS aún requiere autorización Owner, JWT/MFA proveedor con revocación verificable, secretos gestionados, pruebas RLS y E2E navegador/dispositivos, respaldo/reten­ción legal en Paraguay.
- A mantiene las carpetas propias y workflows; B es dueño exclusivo de `apps/movete-cliente/**`, `apps/movete-admin/**` y `docs/architect-b/**`. Sus rutas y DTO propuestos no cambian. B mantiene `enabled=false` y `certifiedContracts=[]` hasta autorización.

## Siguiente prioridad A

1. A05.5: modelado de **zonas** separado de **disponibilidad**, observado por servicio, con timestamp de frescura, RLS y paginación sin techo; no fabricar conductores disponibles.
2. A05.6: auditoría integral (no sólo tres fuentes), retención, trazabilidad y pruebas de alteración; inventario de eventos faltantes.
3. A05.7: finanzas **solo** cuando exista ledger operacional válido conciliado; G7 actual es simulado, no puede ser ingreso real.
4. A04.3: Auth JWT/MFA real y revocación; despliegue exclusivamente con autorización previa del Owner.
5. Stress PostgreSQL de >30.000 filas para todos los paneles, índices de expresión y latencias documentadas, E2E Admin Web sin secretos/PII.

Esta entrega no certifica operatividad comercial y no autoriza merge o despliegue.
