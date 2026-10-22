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
permisos. La siguiente capa será repositorio y API autenticada; después quedará
cerrar pruebas integrales/capacidad antes de conectar Lovable.
