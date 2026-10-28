# Movete Fácil — Arquitecto A — G17 y G18: identidad Driver + documentos privados

Fecha: 22–23 octubre 2026. Rama: `feature/mobility-monorepo-isolated-20261016`. PR #7 DRAFT. **No merge, LIVE, VPS, SQL remoto, pagos ni push reales**.

## Arquitectura obligatoria

**`apps/movete-driver/` es una app móvil separada** de `apps/movete-cliente/`. El Arquitecto B es el único propietario de Cliente, Admin UI y `docs/architect-b/**`. Arquitecto A mantiene backend central y Driver.

La aplicación Driver necesita convertir una cuenta Auth de registro inicial ('passenger') a una identidad exclusivamente 'driver' **sin** considerarla conductor habilitado. Sus imágenes de licencias y vehículos deben residir en almacenamiento privado con revisión administrativa; el teléfono nunca debe tener credenciales de servicio.

## G17 — Registro de documentación privada y auditoría

Archivo SQL: `apps/mobility-expo/docs/backend/staging_only/G17_PRIVATE_DRIVER_DOCUMENTS_POSTGRES_CI_ONLY.sql`, aplicado **únicamente en PostgreSQL 16 desechable CI**, después de G16.

- `mobility_stage_driver_documents`: registros de evidencia con object key privado, tipo, peso, huella SHA-256, propietario y estado `pending/approved/rejected`. **No almacena los bytes** en la tabla.
- `mobility_stage_driver_document_reviews`: una decisión inmutable por evidencia, actor admin verificado, clave de idempotencia y motivo en código acotado; sin acceso de anon/authenticated a metadatos privados.
- `mobility_stage_register_driver_document`: RPC de servicio, requiere **un único rol Driver** y observación de objeto procedente exclusivamente de un backend que verificó el bucket, propietario, bytes y huella. No concede aprobación.
- `mobility_stage_review_driver_document`: RPC de servicio, admin exclusivo, prohíbe autorrevisión y decisiones repetidas incompatibles.
- `mobility_stage_read_driver_document_status`: respuesta minimizada de siete categorías de KYC sin object keys, nombres, imágenes, hash ni identificación del revisor.

Tipos contemplados: licencia, identidad frente/dorso, cédula verde, seguro, inspección, habilitación. La política previa del bucket `G1_PRIVATE_DOCS_BUCKET_STAGING_ONLY.sql` autoriza actualmente SOLO archivos de **licencia**; el resto NO se encuentra habilitado para subidas reales y necesita migración de Storage revisada por seguridad.

Backend QA:
- `server/g17-driver-document-repository.mjs`
- `server/g17-driver-document-gateway.mjs`
- `server/g17-driver-documents.test.mjs` y `server/g17-private-documents-loopback.test.mjs`
- Rutas: `GET /v1/staging/driver/documents`, `POST /v1/staging/driver/documents/observe`, `POST /v1/staging/admin/driver-documents/review`.
- `g4-staging-runtime.mjs` **rechaza por defecto** `observe` porque no existe aún observador real de Storage con antimalware. La función `unavailablePrivateObjectObservation()` lanza error; no se confía en valores MIME, hash o propiedad introducidos desde la app.

Driver:
- `src/domain/driver-documents.mjs` y `*.d.mts`: consulta de estado solo con bearer verificado, sin cache, en `127.0.0.1` QA.
- No se ha conectado una sesión real/SDK Supabase Auth a las pantallas ni se ha subido ningún documento real. Evitar mostrar falsos aprobados.

## G18 — Conversión controlada a cuenta Driver

SQL: `G18_DRIVER_ROLE_ENROLLMENT_POSTGRES_CI_ONLY.sql`, auditado contra esquema real de CI.

- RPC `mobility_stage_enroll_exclusive_driver(_driver_id,_request_key,_consent)`: requiere consentimiento explícito; solo transforma una cuenta con **un único rol pasajero inicial** y sin historial de viajes/envíos de pasajero. Bloquea mezclas de roles, admin y conversiones duplicadas.
- En una transacción, reemplaza `passenger` por `driver` y registra auditoría append-only `pending_compliance`. **No crea licencias, vehículos ni aprobación**, y los preflights continúan denegando operaciones si falta cumplimiento.
- La identidad se obtiene exclusivamente del JWT verificado en `POST /v1/staging/driver/enrollment`; el cliente suministra solo `requestKey` y `driverConsent=true`.
- `server/g18-driver-enrollment-gateway.mjs`, `server/g18-driver-enrollment-repository.mjs`, y pruebas unitarias/HTTP; runtime aislado conectado.
- `apps/movete-driver/src/domain/driver-enrollment.mjs`, tipos y pruebas: registro con consentimiento y clave de idempotencia estable, rechazo de URL remotas y fallos de Auth. Módulo preparado; todavía no hay sesión real conectada a la UI.

**Importante:** el backend G1 crea inicialmente rol pasajero de forma automática. G18 es una conversión controlada y auditable de ese rol para Driver QA, no una invitación a mezclar los perfiles de las dos apps.

## Seguridad y evidencia

- PostgreSQL CI: G1–G18 sobre PostgreSQL 16 desechable, ACL, RLS, privacidad, exclusividad de roles, idempotencia, rechazo de revisiones no autorizadas y aislamiento del historial de pasajero.
- Node: jwt verificado, mínima exposición, auditoría, contraseñas/secretos ausentes, CORS/cookies prohibidas, HTTP local `127.0.0.1`.
- Driver Expo: pruebas de sesión, consentimiento, consultas de KYC, desconexión, status y privacidad.
- OpenAPI: contratos G17/G18 disponibles en `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json`. Es un contrato, NO servidor público desplegado.

## Pendiente antes de funcionar con documentos reales

1. Provisión de entorno STAGING independiente y activación segura de cuentas Driver, bajo autorización del Owner.
2. Vincular Auth real en app Driver, logout/revocación, token efímero y comunicación segura de red; la limitación a `127.0.0.1` de estos adaptadores existe para QA.
3. Escaneo de virus, comprobación de tamaño/MIME/huella y metadatos confiables desde Storage privado antes de que G17 observe un archivo; nunca confiar en el móvil.
4. Ampliar y auditar políticas privadas de Storage para identidad, seguros y documentos de vehículo; definir caducidad, retención, auditoría y acceso administrativo temporal.
5. Conectar las pantallas `apps/movete-driver/app/documentos.tsx` a sesiones verificadas; informar pendiente/rechazado/aprobado sin almacenar bytes localmente.
6. Asociar KYC aprobado con compliance real de G2, seguros y zona; prohibir servicios MOTO pasajeros sin certificación normativa.
7. Ejecutar E2E Android/iOS con datos sintéticos, revisión legal y aprobación Owner antes de despliegue.

**Prohibido modificar Cliente/Admin del Arquitecto B.**
