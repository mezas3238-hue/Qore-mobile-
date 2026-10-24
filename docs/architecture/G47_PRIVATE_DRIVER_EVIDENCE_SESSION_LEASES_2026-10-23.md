# QORE Mobile — Arquitecto A · G47 (A28) KYC Driver: evidencia privada, sesiones y auditoría

Fecha: **23 de octubre de 2026** · Repositorio soberano: **mezas3238-hue/Qore-mobile-** · PR #7 **DRAFT**.

## Resultado técnico

G47 agrega control de lectura **de metadatos sintéticos** a la infraestructura existente de **G17** (registro de documentos y revisión manual) y **G20** (preflight documental). El documento físico auténtico **no está almacenado ni servido por G47**. No se usan credenciales de Storage remoto ni URLs firmadas, no existe API HTTPS montada, ninguna foto real de identidad o licencia entra en las pruebas.

**Separación de aplicaciones:** `apps/movete-driver` sigue siendo app Driver independiente de `apps/movete-cliente`, y `apps/movete-admin` es backoffice. G47 vive sólo en `apps/mobility-expo` y `docs/architecture`, ámbitos A. B conserva Cliente y Admin sin modificaciones.

### SQL ejecutable sólo en PostgreSQL 16 descartable

`apps/mobility-expo/docs/backend/staging_only/G47_PRIVATE_DRIVER_EVIDENCE_LEASES_POSTGRES_CI_ONLY.sql` (require `qore_disposable_chain`, `qore_ci_disposable_chain`, G17/G42/G46):

- **Endurecimiento G17**: revoca a `PUBLIC,anon,authenticated,service_role` los privilegios directos sobre la tabla `mobility_stage_driver_documents`, su historial de revisiones y las 3 RPC G17. No son autoridades remotas válidas mientras acepten IDs de actor aportados por el llamante sin una prueba JWT transaccional.
- **Huella de objeto simulado**, `mobility_stage_g47_attested_objects`: por `document_id`, compara usuario, MIME, tamaño, SHA-256 y patrón del path privado del registro G17. `QA_SYNTHETIC_STORAGE_HEAD_ONLY` significa **simulación de una observación de Storage; no prueba que exista un archivo real**. No se copia documento.
- **Permiso de sesión de 60 segundos** `mobility_stage_g47_access_leases`: sólo `DRIVER_SELF_VIEW` por el propio Driver con rol exclusivo, o `ADMIN_MANUAL_REVIEW` para Admin con rol exclusivo sobre evidencia pendiente. Incluye requestKey única, documento, actor, sessionId, emisión, caducidad y revocación.
- **Session fence obligatorio** `mobility_stage_g42_lock_session(actor,session,iat)` bloquea el registro de sesión **en la misma transacción** de emisión/probe, de modo que una revocación registrada elimina el acceso posterior. Ni un JWT aislado ni la propiedad del archivo sirven por sí mismos.
- **Auditoría persistente** `mobility_stage_g47_access_audit` para `ISSUED/REVOKED`, enlazada a la sesión y con trigger de rechazo de UPDATE/DELETE. No guarda contenido del documento, nombre personal, path, hash ni una URL. Es un registro de eventos, no un repositorio de fotos.
- **RPC QA privadas** `mobility_stage_g47_attest_object_qa`, `issue_lease_qa`, `probe_lease_qa`, `revoke_lease_qa`. No se concede `EXECUTE` a `service_role`, `anon`, `authenticated`; disponibles para owner de BD descartable. Idempotencia sin resurrección de lease revocado/expirado, firma de sesión, bloqueo por rol y respuesta sólo de `leaseId`, caducidad y flags `false`.

La caducidad de **60 s** es del **permiso de consulta sintético**, **no** un plazo de conservación ni purga automática del expediente. Retención documental, eliminación, consentimientos, acceso judicial y plazos legales requieren política paraguaya revisada y aprobación antes de producir.

### Contratos Node y OpenAPI

- `server/g47-driver-evidence-lease-qa.mjs` exige configuración `isolated_staging` + `liveEnabled:false` + `localQaOnly:true`, JWT proveedor pinneado inyectado y confirmado mediante fuentes separadas, sesión válida, rol exclusivo, limitador y para admin **AAL2/MFA independiente**. El body nunca acepta `driverId`, `actorId`, bytes, `objectKey`, hash, bucket ni URL. Ante error del proveedor/BD, bloquea.
- `server/g47-driver-evidence-lease-qa.test.mjs` incluye pruebas de suplantación, alteración de resultados, MFA vencida, token revocado, role mismatch y acceso a objetos ajenos.
- OpenAPI `1.0.0-g47`: `POST /v1/staging/driver/evidence/leases-g47` y `POST /v1/staging/driver/evidence/leases-g47/probe`, ambos **`x-qore-runtime-wired:false`**, `x-qore-qa-only:true`. Respuestas selladas contienen `signedUrlAvailable:false`, `documentBytesAvailable:false`, `productionEnabled:false`; emisión agrega `storageConnected:false`.
- `server/g47-driver-evidence-openapi-contract.test.mjs` impide cualquier campo `url`, `objectKey`, `storageBucket`, `documentBytes`, `sha256Hex` o activación LIVE.

### Pruebas automáticas

`G47_PRIVATE_DRIVER_EVIDENCE_LEASES_ASSERT_POSTGRES_CI_ONLY.sql` ejecutada **después de G46** en workflow PostgreSQL full-schema. Crea sus datos sintéticos propios, sin depender de persistencia de G17. Valida:

- denegación de SELECT/INSERT/UPDATE RPC a `service_role` y `authenticated`;
- rechazo de huella SHA falsa y licencia sin observación sintética;
- emisión y replay mismo requestKey/actor/sesión sin evento duplicado;
- prohibición de requestKey de otro actor, auto-revisión Driver y comprobación cruzada;
- emisión para Admin sólo sobre evidencia pendiente;
- auditoría append-only no editable ni borrable;
- revocación idempotente y ausencia de lease activo posterior;
- revocación de sesión G42 bloquea `probe` inmediatamente;
- todas las respuestas sin path, hash, URL, bucket o bytes.

## Límites importantes y trabajos restantes

1. **Sin almacenamiento real conectado**: falta elegir y configurar proveedor de Storage privado para fotos/documentos, cifrado en reposo, IAM/ACL por expediente, integridad de bytes contra SHA calculado por servidor, antimalware real antes de registro, generación corta de URL firmada después de autorización, revalidación y auditoría de cada descarga.
2. **Sin revisión documental real**: pruebas G17/G20 sólo certifican contratos y flujos sintéticos; un documento pendiente no habilita viajar. No exponer el antiguo `service_role` para G17/G20 hasta crear RPC con identidad segura (G48).
3. **AAL2** está validado en el boundary Node de QA, pero la función SQL de laboratorio es owner-only y no es un servidor MFA. Los derechos de inspector por alcance y segregación laboral aún requieren diseño y pruebas operativas.
4. **Revocación de leases existentes** tras una observación de objeto en cuarentena se realiza en la comprobación; no hay Storage real que deje de servir enlaces porque **nunca se emiten enlaces**.
5. **Retención y privacidad Paraguay**: definir base legal, plazos de retención, derecho de acceso/eliminación, controles de backups, clave de cifrado, análisis de incidentes y alcance de revisión de Admin, con abogado/privacidad antes de LIVE.
6. **Siguiente A G48**: privilegiado mínimo SQL con ID servidor-JWT, Auth real con autorización Owner, RLS y roles por función, permisos auditables de descarga, sin reabrir G17/G6/G9 generales. **Siguiente B**: Driver no pertenece a B; B limita Admin a estado documental y auditoría sanitizada hasta integración certificada.
7. No usar `@lovable` ni interfaz definitiva para sustituir comprobaciones de backend. No hay integración HTTPS ni datos de documentos auténticos.

**Gobierno:** NO MERGE / NO LIVE / NO DEPLOY / NO VPS / NO PSP / NO secretos / NO PII real. PR #7 y PR #8 permanecen DRAFT. El CI es QA descartable, no certificación operativa comercial.
