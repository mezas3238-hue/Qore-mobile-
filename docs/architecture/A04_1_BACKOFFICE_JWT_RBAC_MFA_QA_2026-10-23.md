# A04.1 — Contrato de admisión Admin/Owner con JWT, RBAC y MFA

**QORE Mobile / Movete Fácil, 23/10/2026. Etapa QA pura. NO LIVE ni despliegue.**

Se crea \`apps/mobility-expo/server/g27-backoffice-session-gateway.mjs\`: política de sesión para rutas \`GET /v1/staging/admin/session\` y \`GET /v1/staging/owner/session\`, **sin listener público y todavía sin cablear al runtime**. No se ofrece una API HTTPS accesible, ni puede tratarse como login completo.

El adaptador sólo acepta (a) JWT verificado por autoridad de identidad externa con revocación/caducidad comprobadas; (b) rol exclusivo resuelto en backend —\`admin\` y \`owner\` **NO heredan permisos mutuamente**—; y (c) atestación MFA \`aal2\` independiente del cliente, asociada al mismo \`userId\` y \`sessionId\`, fresca (máximo 12 horas) y con expiración coherente con sesión. Una bandera de MFA en el móvil/navegador no habilita nada.

Devuelve \`200\` sólo con \`userId\`, \`role\`, \`assuranceLevel\`, \`expiresAtMs\`, \`mode:STAGING_QA_ONLY\` y \`dataAccessEnabled:false\`. Sin MFA verificada o rol cruzado devuelve 403; JWT inválido 401; rate 429; caída de autoridad 503; métodos/rutas ajenos 404. La política no contiene cuentas, PIN, saldos, documentos, correo ni identidad de conductores.

**Limitación fundamental:** sólo está probada con proveedores sintéticos inyectados. Aún hace falta resolver el proveedor JWT y MFA REAL en un STAGING autorizado, revocaciones, base de roles exclusivos (G1 histórica no incluye Owner separado), conexión del transporte, endpoints de lectura Admin/Owner y revisión OpenAPI. La app B **NO debe activar Admin** basándose en este módulo; sigue cerrada hasta integración certificada. Sin aprobar MFA ni contratar proveedor, no usar \`verifyBackofficeMfa:()=>true\` en ningún runtime real.

Pruebas Node: token ausente/revocado, rol Admin vs Owner, MFA sesión ajena, nivel AAL1, prueba vencida, fallas de proveedor y rate, perfiles confirmados y ausencia de PII. Criterio de cierre: CI del commit exacto verde; no confundir QA con certificación real.
