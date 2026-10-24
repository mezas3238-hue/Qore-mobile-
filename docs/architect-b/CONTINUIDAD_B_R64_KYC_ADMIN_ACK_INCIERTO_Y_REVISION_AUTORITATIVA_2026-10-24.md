# QORE Mobile — Arquitecto B / R64 · revisión KYC Admin con conciliación obligatoria

**Fecha:** 24-10-2026 · PR #8 DRAFT · propietario B exclusivo `apps/movete-admin/**` y `docs/architect-b/**`.

## Problema observado

El método QA `createAdminExperience().reviewVehicle()` podía invocar dos POST simultáneos contra una futura pasarela de revisión administrativa. Tras timeout/ACK incierto también podía permitir una nueva acción sin consulta SQL, lo que en una integración real podría duplicar decisiones o mezclar decisiones de un JWT anterior con la nueva sesión. La cola KYC de browser no es autoridad.

## R64 aplicado

- `apps/movete-admin/src/admin-experience.mjs`: exclusión de POST concurrente (`ADMIN_REVIEW_IN_FLIGHT`), latch por sesión hasta conciliación (`KYC_REVIEW_RECONCILIATION_REQUIRED`), salida de error saneada, limpieza de cola/cursor tras envío incluso cuando se pierde ACK.
- Un GET KYC realmente ejecutado mediante `syncFromServer('kyc')` debe regresar con una revisión **mayor** que la página anterior al POST. Igual o menor: `KYC_REVIEW_REVISION_NOT_ADVANCED`, sin desbloquear POST. Inyectar una página local por `readKyc()` no levanta el latch.
- Logout, rotación JWT o cambio de rol eliminan la revisión pendiente solo al descartar sesión anterior; un ACK tardío no borra datos de la nueva sesión. Ninguna decisión se refleja optimistamente como aprobada.
- `apps/movete-admin/src/r64-kyc-review-reconciliation.test.mjs`: 7 pruebas adversariales de doble clic, timeout, GET anterior, lectura local ineficaz, saneamiento PII, actor cambiado y rol Owner prohibido. Todos usan un adaptador HTTP falso con datos sintéticos.

## Limitaciones y próximos contratos A

Este mecanismo reduce reintentos ciegos, **pero no reemplaza** idempotencia, atomicidad y auditoría de revisión KYC en PostgreSQL A. El Admin real requiere GET/POST firmados y certificados por A con JWT/MFA, solicitud idempotente, estado definitivo revisado, rol, motivo, accesos mínimos, documentos privados, HTTPS STAGING y evidencias auditables. Si la revisión del servidor no incrementa el contador global, A deberá definir una señal de conciliación verificable alternativa y B adaptar este gate.

Revisar tres workflows de GitHub Actions sobre el SHA final de la rama B. No declarar certificación funcional STAGING/nativa en virtud del CI QA.

**Estado comercial:** NO_GO. No merge, deployment, pagos, acceso KYC real ni activación de operaciones.
