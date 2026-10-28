# A05.1 — Lecturas privadas Admin/Owner con contratos compatibles con B (QA)

**Fecha:** 2026-10-23 · Arquitecto A · PR #7 DRAFT · prohibidos merge, LIVE, despliegue, DB remota y datos reales.

## Entregado en código

El gateway \`apps/mobility-expo/server/g27-backoffice-read-gateway.mjs\` añade las cinco rutas exactas propuestas por el Arquitecto B: \`GET /v1/staging/admin/vehicle-review-queue\`, \`/zones/overview\`, \`/incidents/queue\`, \`/audit/events\` y \`GET /v1/staging/owner/finance/summary\`. El gateway **NO está montado en un listener y no se desplegó**; la inclusión de una ruta en OpenAPI sólo establece contrato.

La política está **denegada por defecto** sin TODOS los adaptadores de confianza: JWT verificado contra proveedor con revocación, rol exclusivo \`admin\` o \`owner\`, permiso por acción (no es suficiente pertenecer a un rol), atestación MFA \`aal2\` real atada a la sesión actual y limitación de tasa. En la fase actual sólo hay adaptadores sintéticos de pruebas; bajo ninguna circunstancia conectar un \`authorizePermission:async()=>true\` a un servidor accesible.

Se aplican esquemas **estrictos con lista blanca**, rechazando claves no reconocidas: KYC sólo estados de expediente/vehículo/documentación, sin nombre ni URL de Storage; zonas distinguen \`coverageStatus\`, \`eligibleByPolicy\`, \`onDutyVehicles\` y edad de observación (cobertura NO es disponibilidad); incidentes sólo severidad/estado/categoría; auditoría sólo evento/acción sin PII. Owner ve agregados de ledger en guaraníes paraguayos \`PYG\` **únicamente cuando un proveedor servidor devuelve \`RECONCILED\`, con revisión de ledger válida**; no se crean saldos estimados ni cuentas bancarias.

## Paginación sin techo global

Las cuatro colecciones usan páginas de **50 por petición**, con cursor firmado mediante HMAC-SHA256 de una **clave backoffice independiente** y salida base64url \`[A-Za-z0-9_-]\`, máximo 256 caracteres (formato validado por la implementación B). El cursor ata origen STAGING, usuario, sesión, permiso, fecha ancla y última posición lexicográfica. Se rechazan firmas alteradas, sesión/permiso cruzados, posición que no retrocede, duplicados y respuestas malformadas. \`hasMore=true\` exige página completa y nueva posición; el cliente recibe \`nextCursor\` hasta que sea \`null\`. **No existe máximo global de operaciones ni de páginas**. La lectura es eventualmente consistente; una ancla de hora no significa snapshot MVCC, ver G26.5.

El adaptador \`loadPage({scope,actorId,anchorMs,after,limit})\` sigue siendo inyectado; **falta implementar y demostrar consultas SQL reales, RLS, conciliación de ledger, índices y derecho de lectura** para cada uno de estos recursos en PostgreSQL descartable. No registrar JWT, token de cursor, material HMAC ni PII en logs. Los documentos KYC binarios y URLs temporales NO se sirven desde estas colecciones.

## Evidencia / integración

Tests QA de backend recorren 123 registros por tipo/3 páginas sin duplicados, casos 401/403/429/503, MFA falso/antiguo, SQL simulado no disponible, rol Admin/Owner cruzado, permisos negados, cursores ligados a usuario/sesión/scope, rotación temporal de firma, protección de DTO y finanzas de prueba conciliadas. Tests del OpenAPI verifican los cinco paths, error contract, \`additionalProperties:false\` y ausencia de campos PII.

**Para Arquitecto B:** no modificar todavía el gateway. \`enabled=false\` y \`certifiedContracts=[]\` hasta Auth/MFA/JWT STAGING real, repositorio seguro, HTTP HTTPS y prueba E2E con navegador autorizado. Las respuestas A05 coinciden con los proyectores B existentes, no con una API actualmente accesible. La vista financiera requiere \`role=owner\`, las otras cuatro \`role=admin\`; no dar acceso implícito entre ambas.

## Bloqueos reales y siguiente ejecución A

1. Completar **A05.2 PostgreSQL descartable**: fuentes reales de KYC, zonas, incidente/auditoría y finanzas con RLS/least privilege, cursores y benchmark; los actuales modelos G1/G17/G8/G7 no exponen automáticamente todos estos read models.
2. Completar **A04.2 Auth**: proveedor confiable JWT/revocación/MFA y tabla exclusiva Owner; no usar un rol \`admin\` histórico como \`owner\`. Backoffice actual está inerte si faltan estos servicios.
3. Completar transporte HTTP QA local para las cinco rutas, tests que imiten cabeceras/no-store/CORS, y luego HTTPS STAGING **sólo con permiso Owner**.
4. Redacción de retención KYC/auditoría, política legal paraguaya y acceso privado a documento versionado con motivo y auditoría; nunca exponer archivo directamente a navegador con URL permanente.

Sin firma de aprobación de STAGING, continuar QA sintético y PostgreSQL descartable; no avanzar al servidor público, pagos ni tiendas.
