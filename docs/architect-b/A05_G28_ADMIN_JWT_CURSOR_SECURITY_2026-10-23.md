# Arquitecto B — A05/G28 Admin: seguridad JWT, MFA y cursores, 23-oct-2026

Refuerzo de sesión: un JWT rotado o cambio de expiración en el mismo Admin/Owner invalida KYC, zonas, incidentes, auditoría, finanzas y cursores anteriores. Un refresh con el token idéntico no descarta datos.

Integración con OpenAPI A05: el GET del Admin sólo acepta cursores base64url opacos 44-256 bytes (sintaxis, firma verificada exclusivamente por servidor); el HTTP 200 debe contener nextCursor null o compatible. El 400 devuelve INVALID_OR_EXPIRED_CURSOR y no se recorre una página falsa. Se exige authRevision numérica para rechazar sesiones obsoletas.

Pruebas: session rotation Admin y Owner, 400 cursor vencido, 200 sin cursor, cursores cortos o excesivos, authRevision ausente, conservando flujo de páginas ilimitadas de 50 registros cada una.

QA sintético. Contratos A05 aún no montados ni conectados a HTTPS real, JWT/MFA proveedor STAGING. Gateways apagados por defecto. PR #8 DRAFT, no merge/live ni escrituras.
