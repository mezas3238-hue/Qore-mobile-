# QORE Mobile — Anexo operativo de inventario B y reentrada R44 (corte 24-oct-2026)

**Este anexo complementa, no sustituye, el [Handoff Maestro Integral R1–R43](./HANDOFF_MAESTRO_INTEGRAL_B_R1_R43_CONTINUIDAD_AUTONOMA_2026-10-24.md).**
**Fuente soberana:** https://github.com/mezas3238-hue/Qore-mobile-. **PR #8 DRAFT:** https://github.com/mezas3238-hue/Qore-mobile-/pull/8.
**Inventario EXHAUSTIVO DE CAMBIOS PR #8:** https://github.com/mezas3238-hue/Qore-mobile-/pull/8/files — revisar contra nuevo HEAD antes de editar; es preferible al copiar filenames manualmente que envejecen.
**Corte PR #8 ANTES de crear el nuevo maestro:** 346 commits y 276 archivos modificados: 137 en Cliente, 48 en Admin Web, 91 en docs B. Al agregar handoffs estas cifras crecen; nunca presentarlas como actuales de un HEAD posterior.

## 01. Índice preciso de módulos Cliente principales

- Raíz app: \`apps/movete-cliente/app\`: \`index.tsx\` inicio/mode simple, \`cuenta.tsx\` identidad y accesibilidad, \`viaje.tsx\` AUTO/multiparada local, \`envios.tsx\` AUTO/MOTO carga, \`seguimiento.tsx\` estado, \`historial.tsx\` paginación, \`cotizacion.tsx\` quote PYG, \`comercios.tsx\` rubros, catálogo/carrito y sustituciones, \`pagos.tsx\` OFF, \`soporte.tsx\` incidentes y preferencias de contacto, \`mensajes.tsx\` chat asignado, \`conversaciones.tsx\` inbox.
- Runtime/UI: \`src/ClientRuntime.tsx\`, \`src/ClientUI.tsx\`; el estado con PII se desmonta por \`privateViewRevision\`. Revisar contenedores de React antes de alterar hooks.
- Sesión/HTTP: \`src/domain/client-session.mjs\`, \`client-gateway.mjs\`, \`bounded-http-response.mjs\`, \`client-mutations.mjs\`, \`secure-cancel-key.mjs\`; JWT/TTL/pinning/idempotencia siempre fail-closed.
- Viaje/entrega/status: \`client-route-editor.mjs\` (R35), \`delivery-form.mjs\`, \`rider-status.mjs\`, \`rider-polling.mjs\`, \`ride-cancellation.mjs\`, \`fare-quote-flow.mjs\`, \`quote-view.mjs\`; NO precios inventados.
- Comercio: \`commerce-draft.mjs\`, \`commerce-catalog-flow.mjs\`, \`commerce-catalog-pages.mjs\`, \`g44-branch-directory.mjs\`, \`g44-buyer-contract.mjs\`, \`g45-order-qa-contract.mjs\`; \`commerce-storefront.mjs\` R37, \`commerce-checkout-review.mjs\` R38, \`commerce-substitution-draft.mjs\` R39. Las variantes \`.d.mts\` y \`.test.mjs\` deben cambiar a la par.
- Soporte: \`support-draft.mjs\`, \`support-draft-session.mjs\`, \`incident-report-flow.mjs\`, \`incident-g40-gateway.mjs\`, \`merchant-support-guide.mjs\` R40, \`g40-incident-status-view.mjs\` R41, \`merchant-contact-preference.mjs\` R42. No son canales de emergencia o atención real.
- Chat: \`passenger-chat-flow.mjs\`, \`passenger-chat-inbox.mjs\`, \`passenger-chat-navigation.mjs\`, \`g51-chat-inbox-http-gateway.mjs\`, \`g52-chat-history-http-gateway.mjs\`, \`g53-chat-send-http-gateway.mjs\`, \`g55-chat-read-marker.mjs\`; receptores Driver y red HTTP no están certificados. Mantener separación de chat Driver vs Merchant/Support.

## 02. Índice preciso de módulos Admin Web principales

- \`apps/movete-admin/src/main.tsx\`, \`AdminRuntime.tsx\`, \`admin-experience.mjs\`, \`admin-experience.d.mts\`, \`admin-session.mjs\`, \`admin-access.mjs\`.
- Lecturas/seguridad: \`admin-read-gateway.mjs\`, \`bounded-json-response.mjs\`, \`page-cursor.mjs\`, \`kyc-queue.mjs\`, \`kyc-page-view.mjs\`, \`zone-overview.mjs\`, \`owner-finance.mjs\`, \`audit-feed.mjs\`.
- Incidentes generales: \`incidents-overview.mjs\`, \`incident-page-triage.mjs\`, \`incident-g41-flow.mjs\`, \`incident-g41-gateway.mjs\`. Filtro G41 de todas las páginas debe realizarse en servidor, no localmente.
- R43: \`merchant-case-page.mjs\`, \`merchant-case-page.d.mts\` y \`merchant-case-page.test.mjs\`. Página comercial separada, exclusivamente \`MERCHANT_ORDER\`, 12 tests, \`merchantCaseContractReady:false\`; no inferir expedientes de la categoría \`OTHER\`.
- Root propio \`apps/movete-admin/package.json\`: \`npm run check\`, \`npm run build\`, TypeScript y Vite; sin service-role de PostgreSQL en navegador.

## 03. Referencias históricas y handoffs: no perder etapas

- [Fundación y documentación general](./STATUS_Y_CONTRATOS.md) y [Handoff R3 anterior](./HANDOFF_MAESTRO_B_R3_CLIENTE_ADMIN_TOTAL_2026-10-23.md).
- [Handoff Maestro R1–R33, B01–B31](./HANDOFF_MAESTRO_INTEGRAL_B_R1_R33_G55_CONTINUIDAD_AUTONOMA_2026-10-24.md): contiene la trazabilidad histórica completa de Auth, movilidad, commerce, Admin, chat, errores y datos de CI. Sus cifras son históricas.
- R14–R17: [R14](./CONTINUIDAD_B_R14_CHAT_TTL_CURSOR_FRESHNESS_2026-10-23.md), [R15](./CONTINUIDAD_B_R15_CHAT_REASIGNACION_JWT_ACK_2026-10-23.md), [R16](./CONTINUIDAD_B_R16_CHAT_JWT_REVISION_ROLLBACK_2026-10-23.md), [R17](./CONTINUIDAD_B_R17_CHAT_ACK_REVISION_CURSOR_2026-10-23.md).
- R18–R24: [R18–R20](./CONTINUIDAD_B_R18_R20_CHAT_PRIVACIDAD_LISTA_Y_CURSOR_2026-10-23.md), [R21–R22](./CONTINUIDAD_B_R21_R22_METADATOS_PRIVADOS_Y_ORDEN_CHAT_2026-10-23.md), [R23](./CONTINUIDAD_B_R23_BORRADOR_PRIVADO_REASIGNACION_2026-10-23.md), [R24](./CONTINUIDAD_B_R24_RECUPERACION_CHAT_PENDIENTE_2026-10-23.md).
- R25–R34: [R25](./CONTINUIDAD_B_R25_G51_INBOX_HTTPS_OPTIN_2026-10-23.md), [R26–R27](./CONTINUIDAD_B_R26_R27_G51_SEGURIDAD_HTTP_PAGINACION_2026-10-23.md), [R28–R29](./CONTINUIDAD_B_R28_R29_G52_HISTORIAL_PRIVADO_PINNED_2026-10-23.md), [R30](./CONTINUIDAD_B_R30_G52_SOLO_LECTURA_INTEGRACION_2026-10-23.md), [R31](./CONTINUIDAD_B_R31_G53_ENVIO_IDEMPOTENTE_2026-10-23.md), [R32](./CONTINUIDAD_B_R32_G51_RECEPCION_LECTURA_SIN_ACUSE_FALSO_2026-10-23.md), [R33](./CONTINUIDAD_B_R33_G54_REVOCACION_CRUZADA_G51_CHAT_2026-10-24.md), [R34](./CONTINUIDAD_B_R34_G55_MARKER_Y_REFERENCIA_MOVILIDAD_2026-10-24.md).
- R35–R39: [R35](./CONTINUIDAD_B_R35_EDITOR_RUTA_PARADAS_QA_2026-10-24.md), [R36](./CONTINUIDAD_B_R36_MODO_SIMPLE_ACCESIBLE_2026-10-24.md), [R37](./CONTINUIDAD_B_R37_TIENDA_MULTIRRUBRO_PEDIDOS_REFERENCIA_2026-10-24.md), [R38](./CONTINUIDAD_B_R38_REVISION_CARRITO_CERTIFICADA_LOCAL_2026-10-24.md), [R39](./CONTINUIDAD_B_R39_PREFERENCIAS_SUSTITUCIONES_2026-10-24.md).
- R40–R43: [R40](./CONTINUIDAD_B_R40_ASISTENCIA_PEDIDOS_COMERCIALES_2026-10-24.md), [R41](./CONTINUIDAD_B_R41_ESTADOS_INCIDENTES_QA_FRESHNESS_2026-10-24.md), [R42](./CONTINUIDAD_B_R42_PREFERENCIA_CONTACTO_COMERCIOS_SOPORTE_2026-10-24.md), [R43](./CONTINUIDAD_B_R43_BANDEJA_CASOS_COMERCIALES_ADMIN_2026-10-24.md).
- Handoff A disponible para lectura: [G0–G55](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-monorepo-isolated-20261016/docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G55_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md). B NO lo edita.

## 04. QA confirmado para último corte funcional R43, antes del nuevo maestro

- HEAD base B \`0261878d2ed12af1ff15f3b60f770691000d27c0\`.
- Cliente **640/640 PASS**, Driver **51/51 PASS** — [two-app isolation #40093092850](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40093092850).
- Admin **197/197 PASS** — [Admin QA #40093092856](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40093092856).
- [Ownership B #40093092853](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40093092853) SUCCESS.
- **888 tests** exitosos de esas suites. **NO son pruebas E2E de producción ni certificación Android/iOS real.**
- Cada commit posterior, incluyendo este anexo y el maestro, requiere comprobar las tres CI DE SU SHA final.

## 05. Orden al relevo: primera iteración R44

1. Leer Maestro, issue #9, HEAD de PR #8 y PR #7 y OpenAPI A actual; detectar si \`MERCHANT_ORDER\` tiene finalmente API server-first.
2. Si falta: mejorar control fail-closed de paginación, selección temporal de casos/observación QA, revocación JWT y UX Admin. Solo archivos B. No simular identidad, caso abierto o asignación.
3. Adjuntar tests unitarios positivos y adversariales, typecheck, Admin build y Cliente/Driver isolation.
4. Comprobar CI del mismo SHA final, reparar fallos, documentar nueva tarea pendiente a A, y continuar. No detenerse salvo bloqueo real.
5. **NO MERGE / NO LIVE / NO DEPLOY / NO VPS / NO PSP / NO PII real**. Owner no autorizó producción ni habilitación de pagos por decir "avanza".
