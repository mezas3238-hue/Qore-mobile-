# Movete Fácil Soporte — G301 (STAGING / acceso mínimo)

Portal web **separado** de `movete-admin`, Cliente, Driver y Comercio. UX adaptable a Android. Este módulo NO da permisos al operador ni despliega el portal por sí solo.

## Lo que puede hacer el agente una vez autenticado
- Consultar **únicamente** la cola y los expedientes mínimos que el backend autorice mediante RLS.
- Filtrar tickets por estado, categoría y código, y ver prioridades.
- Consultar el protocolo interno de escalamiento, sin exposición de documentos, identidad o coordenadas.

## No puede
- Cambiar tarifas, porcentajes, comisiones, cobranzas ni liquidaciones.
- Habilitar viajes comerciales, aprobar Driver/KYC, ver archivos de identidad ni reasignar roles.
- Realizar llamadas SOS, responder/gestionar tickets en el servidor, cerrar expedientes o asignarse casos hasta autorizarse cada operación independientemente. Ningún botón simula haber enviado una respuesta.

## Prerrequisitos antes de habilitar STAGING
1. Aprobar estructura separada `mobility_stage_support_staff` con una identidad real y aprobador distinto del empleado.
2. Certificar RPC independiente `mobility_stage_support_my_role()`, que debe devolver exactamente `support` solo ante Auth + MFA `aal2` + rol soporte activo y **sin** rol Owner, Admin, Cliente o Driver.
3. Crear la bandeja `mobility_stage_support_cases` con RLS que solo permita lectura de filas explícitamente asignadas o de una cola minimizada, y `GRANT SELECT` limitado a columnas sanitizadas que `readSupportCases` solicita.
4. Pruebas reales de rol, expiración de sesión, revocación y control de acceso horizontal con usuarios A/B antes de activar el flag. Crear tickets reales requiere API de entrada segura/auditada (no está instalada).
5. Compilar y alojar portal en un destino STAGING **distinto** del Admin, mediante HTTPS con CORS permitido. Configurar solo datos públicos de URL / publishable key y flags.

Todos los flags vienen OFF. Nunca compartir semillas TOTP, claves secretas o contraseñas en Git ni en un chat.

### Desarrollo
`npm install --ignore-scripts`, `npm run check`, `npm run build`.
El suite usa dobles de prueba y no escribe en Supabase ni Railway.

**NO es un producto de soporte listo para uso real.** Es la primera implementación frontend+contratos independientes con exclusión explícita de facultades Owner/Driver y lectura denegada por defecto.
