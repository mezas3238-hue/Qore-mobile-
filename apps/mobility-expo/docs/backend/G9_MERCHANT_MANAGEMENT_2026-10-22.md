# QORE Mobile — onboarding y catálogo comercial G9

**Fecha:** 2026-10-22

**Estado:** contrato PostgreSQL 16 desechable; NO desplegado y NO LIVE.

G9 reemplaza la dependencia de fixtures para operar comercios: incorpora
solicitud idempotente de alta, revisión exclusiva de admin, creación/edición de
sucursales y alta/actualización de catálogo por owner o manager persistido.
Toda mutación genera un evento privado append-only con parámetros estructurados.

La suspensión de un comercio desactiva inmediatamente la aceptación de pedidos.
Los precios se guardan en PYG enteros con revisión incremental. `PHARMACY_OTC`
solo se admite cuando el comercio aprobado es farmacia; prescripción y
controlados siguen sin existir en el contrato.

El smoke `scripts/sql/g9_merchant_management_smoke.sql` cubre replay,
separación owner/admin, catálogo, cambio de precio, rechazo OTC, suspensión y
permisos.

El repositorio server-only, gateway autenticado y runtime loopback exponen:

- `POST /v1/staging/merchant/onboarding/request`
- `POST /v1/staging/admin/merchants/:merchantId/review`
- `POST /v1/staging/merchant/branches/upsert`
- `POST /v1/staging/merchant/catalog/upsert`

Owner/admin siempre se derivan de Auth y PostgreSQL vuelve a comprobar rol o
membresía. El cliente no puede autoaprobarse ni enviar un owner alternativo.
La suite local pasa 216/216 pruebas de servidor, 102/102 de dominio, TypeScript
y guard NO-LIVE. Después de confirmar el smoke PostgreSQL remoto quedará cerrar
pruebas integrales/capacidad antes de conectar Lovable.

El primer gate G9 detectó que PostgreSQL no convierte implícitamente un `CASE`
de texto al enum de estado comercial. La corrección usa casts explícitos a
`mobility_stage_merchant_status` y queda sujeta al siguiente CI efímero.
