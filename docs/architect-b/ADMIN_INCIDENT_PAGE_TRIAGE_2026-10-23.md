# Arquitecto B — Incidentes Admin: triaje visual acotado a una página

**Fecha:** 2026-10-23
**Alcance:** apps/movete-admin/** y docs/architect-b/**; PR #8 DRAFT, NO MERGE/LIVE/DEPLOY.

## Implementado
- \`incident-page-triage.mjs\`: derivación de totales de incidentes visibles, casos activos y críticos activos a partir de **una única página ya autenticada y autorizada** de la cola existente.
- Filtros \`ALL\`, \`ACTIVE\`, \`CRITICAL_ACTIVE\` y orden visual \`PRIORITY\`/ \`RECENT\`; prioridad local por activo, gravedad y antigüedad. Nunca se presenta como orden global del backend ni nivel de atención realmente activado.
- Rechazo de cualquier columna extra, PII, duplicado, timestamp inválido, revisión negativa y página caducada. Datos proyectados mínimos y congelados; ninguna red o mutación.
- Vista Admin con selectores accesibles y contadores claramente rotulados **«esta página»**, sin inventar que el backend tenga cero incidentes ni que los 50 registros por página sean el máximo global.
- No se agrega permiso de respuesta, acción SOS, suspensión, aprobación ni uso comercial. El gateway sigue desactivado sin contrato A certificado.

## QA
Siete pruebas adversariales nuevas sobre orden, filtros, límites por página, privacidad y caducidad. CI Admin Web, aislamiento y ownership deben observarse en el SHA de commit actualizado; los resultados anteriores no se adjudican al nuevo commit hasta que concluyan.

## Dependencia Backend A
Para triaje *global* se necesita \`GET /admin/incidents/queue\` con filtros de severidad/estado y paginación por cursor autorizados en servidor, idempotencia y coherencia de orden entre páginas. Hasta entonces es solo triaje **de la página visible** y el operador debe navegar las páginas para revisar más registros. La recepción/atención de emergencias requiere servicio operativo explícitamente certificado, no este UI.
