# QORE Mobile — Arquitecto B | R43 Admin Web, casos de pedidos comerciales
Fecha de transferencia: 2026-10-24. Repositorio soberano `mezas3238-hue/Qore-mobile-`. Rama B `feature/mobility-cliente-admin-parallel-20261022` · PR #8 DRAFT. Rama A `feature/mobility-monorepo-isolated-20261016` · PR #7 DRAFT.

## Objetivo y resultado

Se creó una **bandeja exclusiva de casos de pedidos comerciales**, separada de incidentes generales G41 y del chat pasajero↔Driver, para preparar una futura gestión real de problemas de supermercados, farmacias OTC, restaurantes y comercios. Un incidente con categoría `OTHER` o `DELIVERY` no acredita que su sujeto sea un `MERCHANT_ORDER`; el Admin debe requerir un contrato explícito de clasificación y permisos.

**Estado exacto:** dominio de lectura y UI con gates fail-closed implementados. **No hay endpoint comercial montado, no hay casos reales ni atención humana**. La bandeja muestra el bloqueo de integración en lugar de inventar cifras. No se creó ningún ticket ni se contactó a nadie. No se habilitó API, Auth Admin Live, pagos, producción, merge ni despliegue.

## Archivos R43 (todos propiedad B)

1. `apps/movete-admin/src/merchant-case-page.mjs`: validador `projectMerchantCasePage` para una página futura con `scope:'ADMIN_MERCHANT_CASES_QA_PAGE'`, `qaOnly:true`, límites de expiración, paginación cursor opaco y filas de `subjectKind:'MERCHANT_ORDER'` exclusivamente. Exige actor Admin con MFA/verificación de sesión y flag de contrato certificado. No acepta columnas PII o extras. Categorías de motivo de comercio: faltante, equivocado, dañado, demora, disputa, seguridad. Solo severidades LOW/MEDIUM/HIGH. Estados de ensayo RECEIVED_QA, CLASSIFIED_QA, REVIEW_QA y CLOSED_QA, sin implicar respuesta de operador. Ordenamiento reproducible por abierto primero, gravedad, recencia y caseId. Retorna únicamente totales **por página**; jamás infiere total global o disponibilidad de operadores.
2. `merchant-case-page.d.mts`: tipos de los DTO y resultados. Los flags `operationsEnabled:false`, `notificationsEnabled:false`, `operatorAssigned:false`, `emergencyDispatchEnabled:false`, `contactConfirmed:false`, `caseResolvedInProduction:false` garantizan semántica QA/no operativa.
3. `merchant-case-page.test.mjs`: 12 tests de permisos, MFA, sesión, tipo MERCHANT_ORDER obligatorio, detección de PII/campos extra, estado/capacidad falsa, orden reproducible, caducidad, TTL, páginas de hasta 50 filas (sin límite global de casos), duplicados, invalidación de cache por JWT, cuenta, contrato y regresión de revisión.
4. `admin-experience.mjs` y `admin-experience.d.mts`: añaden al snapshot campos explícitos `merchantCases:null`, `merchantCaseContractReady:false`, incluyendo logout. No reutilizan la cola de incidentes general. No se expuso API para poblarlos mientras A no firme un contrato propio.
5. `main.tsx`: añade al tab Seguridad la sección "Casos de pedidos comerciales", distinguida de `GlobalTriagePanel` y `IncidentReadOnly`. Si no hay Admin+MFA, acceso denegado; si no hay contrato específico, dice que está pendiente; si la página futura vence, oculta resultados. El componente de solo lectura está preparado para presentar un DTO certificado con motivo, estado QA y revisión, sin nombre, teléfono, domicilio, pedido real, mensajes, acciones de asignación, suspensión o SOS.

## Incidentes en CI y corrección

El primer commit de UI obtuvo fallo en una expectativa de test: dos casos empataban en fecha y severidad y el criterio especificado es desempate por `caseId` ascendente. Se corrigió **la aserción**, sin relajar la validación ni cambiar el ordenamiento, en commit `badbf32f87aa29c84579a6aeda62b236a21f3524`. Los tests se reejecutan para certificar el HEAD final documental. NO afirmar SUCCESS de otro SHA; verificar ownership, Admin QA, two-app isolation con test/typecheck/export Cliente+Driver en el mismo commit.

## Backend A auditado en R43

En OpenAPI del HEAD A `842143d2d82e03c7c10041051341f3daa643f783`, versión `1.0.0-g57`, había 72 rutas. `/v1/staging/admin/incidents/queue`, `/v1/staging/admin/incidents/triage-queue` y G40 `/v1/staging/safety/incidents/*` continuaban `x-qore-runtime-wired:false`. **No existe endpoint de bandeja comercial explícita** (sujeto MERCHANT_ORDER, rol Admin y clase de caso). No montar silenciosamente G41 con reclasificación `OTHER`.

## Dependencias bloqueadas y orden de continuación

- **A1:** Auth/MFA Admin real; verificación del `MERCHANT_ORDER` y permisos por rol/organización, RLS, revocación, caducidad de JWT, respuesta minimizada sin PII.
- **A2:** contrato para consulta de casos comerciales desde PostgreSQL de QA con paginación por cursor, filtro servidor por `subjectKind:'MERCHANT_ORDER'` **antes** de paginar, orden monotónico estable, snapshot TTL, revisión y estimación de consistencia; no confundir pageCount con total global.
- **A3:** estados de flujo de atención realmente operada, bandeja de agentes, asignación idempotente con ACK duradero y control de carreras. No inferir de `CLASSIFIED_QA` o `REVIEW_QA` trabajo humano, ni de `CLOSED_QA` una solución en producción.
- **A4:** canales seguros Cliente↔comercio y Cliente↔soporte separados de chat Driver. Consentimiento revisable, scope temporal, mensajes idempotentes, no revelar PII, moderación, caso/servicio y evento auditado. El flujo R42 es solo preferencia RAM y NO envía.
- **A5:** legalidad de productos farmacéuticos, política de documentación, retención y borrado, fraude, recibos de comunicación, soporte de emergencia independiente. Nunca habilitar SOS por ver estado QA.
- **B R44:** si A aún no ha montado la API, continuar módulos independientes seguros de Admin/Cliente, por ejemplo diseño de controles de seguimiento de eventos QA, navegación accesible o rechazos de estados desactualizados. No invadir Backend ni Driver. Revisar HEADs y nuevos contratos **antes de escribir**.

## Regla de continuidad autónoma
Iniciar R44 leyendo este handoff más R1–R42; avanzar código real con pruebas y documentos sin volver a preguntar por autorizaciones ya otorgadas de desarrollo. Detenerse únicamente ante bloqueo auténtico. **NO MERGE / NO LIVE / NO DEPLOY / NO VPS / NO PSP real / NO secrets** sin orden explícita Owner. PR #8 DRAFT.
