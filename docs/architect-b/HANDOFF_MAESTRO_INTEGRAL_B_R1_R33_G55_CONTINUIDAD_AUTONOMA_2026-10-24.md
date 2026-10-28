# QORE Mobile / Movete Fácil — HANDOFF MAESTRO INTEGRAL DEL ARQUITECTO B

## Transferencia completa R1–R33 + legado B01–B31, hallazgo G55, avances reales, bloqueos, pendientes y continuidad autónoma
**Fecha de corte: 24 de octubre de 2026, hora Paraguay.**
**DESTINO: nuevo chat / siguiente Arquitecto B.**
**MANDA EL OWNER: CONTINUAR EL TRABAJO SIN DETENERSE, SALVO BLOQUEO REAL.**

> Este documento ES la orden de ejecución y el mapa histórico. El sucesor debe implementar cambios concretos en GitHub, no volver a comenzar, no quedarse eternamente auditando, no sustituir código por un plan ni pedir aprobación para cada cambio seguro de laboratorio. Cuando un módulo depende de A, registrar el contrato faltante en issue #9 y seguir con otro módulo B. Prohibidos merge, LIVE, deploy, VPS, PSP/pagos, secretos y documentos reales sin autorización expresa del Owner.

---

# 00. REENTRADA INMEDIATA: 12 HECHOS QUE EL NUEVO ARQUITECTO DEBE CONOCER

1. **Repositorio soberano:** [mezas3238-hue/Qore-mobile-](https://github.com/mezas3238-hue/Qore-mobile-). El guion final importa; no confundir con qore-core/trading.
2. **Rama B exclusiva:** feature/mobility-cliente-admin-parallel-20261022. [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) OPEN y DRAFT; base de B: feature/mobility-monorepo-isolated-20261016 (rama A).
3. **Rama A exclusiva:** feature/mobility-monorepo-isolated-20261016. [PR #7](https://github.com/mezas3238-hue/Qore-mobile-/pull/7) OPEN y DRAFT contra main.
4. **Coordinación:** [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9) con contratos exigidos y comentarios de ambos arquitectos. No usar comentarios antiguos como si fueran OpenAPI actual.
5. **HEAD B anterior a este nuevo handoff:** 962d17ce8cd55bf3bb1c7e8d2698c752c4e33430. **284 commits y 239 archivos modificados** según PR #8 en el momento de la auditoría. Este documento crea un SHA B más reciente: leer el HEAD antes de editar.
6. **HEAD A observado:** 533fe7fafc610f926c023bb987dde010d5e74514, **819 commits y 567 archivos cambiados** según PR #7 en el momento de auditar. A trabaja en paralelo, volver a consultarlo siempre.
7. **CI funcional de R33 B:** Cliente **558/558 PASS**, Admin **185/185 PASS**, total **743/743**, Driver **45/45 PASS adicional**. Tres workflows SUCCESS del SHA de código 2f4e6fe7454a040c14eebcf5ba66db2ae8248318:
   - [Cliente/Driver/aislamiento #40056756096](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40056756096)
   - [Admin #40056756150](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40056756150)
   - [ownership B #40056756148](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40056756148)
8. **CI del handoff anterior R33 (SHA 962d17ce):** [aislamiento #40056807329](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40056807329), [Admin #40056807327](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40056807327), [ownership #40056807382](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40056807382), **3/3 SUCCESS**.
9. **Último OpenAPI A consultado:** versión **1.0.0-g55, 65 rutas**, blob Git **726a1cd455dd056e547dd5e572470c33433a429d**. Dos nuevas operaciones G55 de historial con marcador de lectura y confirmación visible. **No están montadas en HTTP.**
10. **Todo chat G50–G55 sigue marcado como QA-only y x-qore-runtime-wired:false en el OpenAPI consultado.** No existe prueba de chat en vivo Cliente ↔ Driver, almacenamiento/recepción real ni JWT proveedor.
11. **CI A del HEAD 533fe7 consultado:** PostgreSQL #40080088770 SUCCESS y Node STAGING #40080088769 SUCCESS; Expo #40080088776 y aislamiento #40080088771 seguían in_progress. No inventar 4/4 GREEN de ese SHA.
12. **Primer trabajo del nuevo chat: R34**, preparar adaptador G55 con marcador emitido por A, bajo triple gate OFF y tests adversariales; si A necesita aclarar cursor/pin, comentar issue #9 y avanzar simultáneamente en otro trabajo de B. No usar secuencias inventadas ni marcar leído automáticamente.

# 01. OBJETIVO DEL PRODUCTO Y LÍMITES DEL OWNER

Movete Fácil es una plataforma paraguaya de movilidad y logística con seguridad, precio competitivo, cobertura por zonas y crecimiento comercial. El sistema deberá incluir:
- Viajes de pasajeros en **autos** (modalidades aprobadas), con selección por zona y disponibilidad real del conductor.
- **Motos para envíos y entregas** de carga, sin inventar transporte de pasajeros en moto ni permisos regulatorios.
- **Envíos particulares** entre usuarios, con trazabilidad, asignación, cobro y prueba de entrega cuando sea autorizado.
- **Entrega comercial** de supermercados, farmacias con productos permitidos, restaurantes y otros comercios.
- **App Cliente** exclusiva del cliente/pasajero/comprador, **App Driver** exclusiva del conductor/repartidor y **Admin Web** para administración con RBAC. Son tres superficies distintas; Cliente y Driver NUNCA se integran como una sola app.
- **Mensajería privada Cliente ↔ Driver** vinculada al viaje/envío/pedido con asignación activa; nunca chat libre con cualquier conductor, nunca exigir compartir teléfono para conversar.
- **Documentos de los conductores** en DB y Storage privados centrales, con permisos, cifrado, auditoría, vencimiento y revisión; no basta guardarlos dentro de la app Driver.
- **Tarifas PYG/Gs para AUTO y MOTO diferenciadas** y calculadas por backend, comisiones y políticas comerciales sujetos a decisión Owner, sin que cobertura implique disponibilidad.
- **Lovable aporta solo la UI definitiva**, una vez backend, contratos, seguridad y servicios listos; no sustituye Node, PostgreSQL, Driver, RLS, despacho ni PSP.
- **Paginación ilimitada en registros totales**, con límites por respuesta y ventanas en RAM del dispositivo. La antigua confusión “solo 50 registros” quedó prohibida: 50 por página NO es 50 total.

Principios: GitHub es fuente de verdad; cambios con commits, SHA y Actions; pruebas sintéticas de QA; sin datos personales reales, secretos en código, VPS/deploy, pagos reales, publicación en tiendas, merge o LIVE sin orden Owner. No mezclar trading con movilidad. No declarar servicio disponible, conductor asignado, pago realizado, operador SOS avisado o mensaje entregado sin recibo y autorización real del servidor.

# 02. MATRIZ DE PROPIEDAD: NO INVADIR AL OTRO ARQUITECTO

| Superficie | Arquitecto B: edición permitida | Arquitecto A: propietario exclusivo |
| --- | --- | --- |
| Cliente | apps/movete-cliente/** | No editar |
| Admin Web | apps/movete-admin/** | No editar |
| Documentación B | docs/architect-b/** | No editar |
| Driver | Solo leer y pedir contrato | apps/movete-driver/** |
| PostgreSQL y SQL | Solo leer/revisar evidencia | Todo backend SQL, migraciones, RLS, funciones |
| Node, HTTP, OpenAPI | Adaptadores de CONSUMO en Cliente/Admin | apps/mobility-expo/**, API, Auth/JWT, contratos y servidor |
| Root y workflows | Observar CI y pedir cambios | .github/**, root, scripts, paquetes compartidos |
| Handoff A | Lectura | docs/handoff/** y docs/architecture/** |
| Comunicación | PR #8 + issue #9 | PR #7 + issue #9 |

**PR #8 tiene como base la rama A**: un diff de PR puede incluir archivos heredados; no implica autoría ni permiso B sobre A. Nunca hacer merge/rebase/force-push unilateral. Al actualizar un archivo utilizar el blob SHA actual y la rama B explícita.

# 03. INVENTARIO DE LO QUE YA EXISTE EN CLIENTE: NO REHACER

Cliente es una app Expo/React Native/Expo Router dentro de apps/movete-cliente. Runtime en src/ClientRuntime.tsx, UI compartida src/ClientUI.tsx, orquestación src/domain/client-experience.mjs y tipos públicos src/domain/client-experience.d.mts.

**Pantallas existentes**: index.tsx, viaje.tsx, envios.tsx, seguimiento.tsx, historial.tsx, comercios.tsx, cotizacion.tsx, pagos.tsx, soporte.tsx, cuenta.tsx, mensajes.tsx, conversaciones.tsx, además de layout y navegación. El proyecto Cliente tiene ID/app propia, no comparte sesión ni UI con Driver.

**Sesión/Auth local y seguridad**
- client-session.mjs: actor Passenger, tokens efímeros, revisiones de privacidad y de autorización, caducidad, limpieza al cerrar/rotar JWT.
- client-gateway.mjs: HTTP HTTPS origin pinned, JWT, operaciones autorizadas, triple gate seguro, status/DTO/timeout/cuerpo acotado.
- bounded-http-response.mjs y response-bytes.mjs: UTF-8, longitud, AbortController y defensa contra respuestas malformadas/sobretamaño.
- client-request-preparation.mjs, client-mutations.mjs, secure-cancel-key.mjs: preparación, UUID CSPRNG, requestKey idempotente, anti doble tap ANTES del await y reintento mismo cuerpo/clave.
- privateViewRevision y remount de formularios para no conservar texto/rutas privadas tras logout, cambio de cuenta o JWT nuevo.

**Viajes AUTO**
- Formulario de origen/destino/tipo de auto y validación local: no calcula precio, ruta, conductor ni reserva ficticios.
- safe-auto-ui-harness.mjs: flujo QA headless de editar, revisar, preparar, ver borrador NO enviado, descartar.
- quote-view.mjs, fare-quote-gateway.mjs y fare-quote-flow.mjs: ServerPricedQuoteV1 / G24 en Gs, versionado/TTL/owner y evidencia de ruta. No aplica cotización a otra cuenta ni inventa tarifa.
- rider-status.mjs, ride-status-gateway.mjs, rider-polling.mjs: snapshot status/revision, GPS consentido y fresco, ETA autoritativa, cleanup offline/401/403 y aislamiento de viaje.
- ride-cancellation.mjs y pantalla seguimiento: cancelación de viaje propio con confirmación, reintento key inmutable, no declarar “cancelado” por un 200 no certificado.

**Envíos AUTO/MOTO**
- delivery-form.mjs, safe-delivery-ui-harness.mjs, app/envios.tsx: MOTO carga con reglas de peso (histórico 10 kg), AUTO carga (histórico 100 kg), medidas y restricciones. Categorías validadas como documentos, paquetes, compras, restaurante y farmacia OTC permitida.
- No contratar envío real sin DTO/quote/status/asignación server y autorización.

**Historial y scroll**
- history-feed.mjs, client-history-gateway.mjs, history-auto-page.mjs, app/historial.tsx; propietario, cursor opaco firmado, expiración/revisión, nombres por kind+serviceId para evitar colisión.
- Ventana local de memoria por defecto 500 items (configurable para QA), pero servidor SIN cuota total. Prueba histórica de 100.000 servicios/2.000 páginas sin superar ventana móvil.

**Comercios**
- commerce-draft.mjs, commerce-catalog-flow.mjs, commerce-catalog-pages.mjs, catalog-branch-lookup.mjs, g44-branch-directory.mjs, g44-buyer-contract.mjs, g44-buyer-http-gateway.mjs y g45-order-qa-contract.mjs.
- Directorio por municipio/modo, catálogo versionado con precio/stock/TTL por sucursal, carrito efímero ligado a versión, invalidación al cambiar sucursal, stock/precio o cuenta, checkout OFF hasta atomicidad y receipt de A.
- No afirmar stock real, entrega o PSP conectado solo por tests.

**Soporte y seguridad**
- support-draft.mjs, support-draft-session.mjs, client-incident-intent.mjs, incident-g40-gateway.mjs, incident-report-flow.mjs y app/soporte.tsx.
- Borrador privado, incidente QA únicamente con receipt verificado y política de expiración; NO SOS enviado, NO operador real avisado.

**Mensajería privada**
- passenger-chat-flow.mjs: RIDE/DELIVERY/MERCHANT_ORDER solo asignados, actor Passenger, contraparte Driver, owner, JWT/TTL/revisión, lectura por cursor y sendMessage inyectado solo con ACK persistido.
- passenger-chat-inbox.mjs: inbox paginado, estado stale ante red caída, anti replay, orden/validación, no cuota global.
- passenger-chat-navigation.mjs: pin exacto conversationId, key de borrador y recuperación del hilo con envío ambiguo.
- passenger-chat-push-hint.mjs: hints genéricos sin cuerpo/nombre/teléfono, no afirmar push real.
- g51-chat-inbox-http-gateway.mjs: transporte bandeja HTTPS JWT firmado, triple gate OFF.
- g51-chat-read-receipt-http-gateway.mjs: POST antiguo throughSeq opt-in, no conectado a UI por falta de secuencia segura.
- g52-chat-history-http-gateway.mjs: GET historial privado, JWT/pin/cursor, limitado bytes y verificación estricta.
- g53-chat-send-http-gateway.mjs: POST idempotente requestKey/body, ACK exacto, respuesta incierta NO confirmada, NO LIVE.
- app/conversaciones.tsx y app/mensajes.tsx: bandeja, chat virtualizado, accesibilidad, read-only sin writer certificado, recovery de pending, sin teléfonos.
- TESTS *.test.mjs, TypeScript y Expo WEB CI. La exportación web no es una APK ni una prueba en celulares.

# 04. INVENTARIO DE ADMIN WEB: YA HECHO, NO REHACER

apps/movete-admin/** es React/TypeScript/Vite separado. AdminRuntime.tsx, admin-experience.mjs y tipos, admin-session.mjs, admin-access.mjs.
- Autorización local proyectada por rol Owner/Admin/MFA, **sin service_role en browser**, sin asumir que el frontend concede permisos de DB.
- admin-read-gateway.mjs, bounded-json-response.mjs: JWT con origin pinned, streaming/UTF-8, deadline/bytes y sesión estable, OFF sin contrato montado.
- kyc-queue.mjs, kyc-page-view.mjs, review-draft.mjs: lista metadata documentación/licencias/vehículo, expiración y borradores sin aprobar al conductor real.
- zone-overview.mjs: cobertura por zonas/modos distinta de disponibilidad real.
- incidents-overview.mjs, incident-page-triage.mjs, incident-g41-flow.mjs, incident-g41-gateway.mjs: incidentes y triaje con filtros que deben aplicarse EN SERVIDOR antes de paginar, NO triaje global inventado desde página local.
- audit-feed.mjs: proyección parcial G30, no auditoría universal real.
- owner-finance.mjs: vistas de ledger/neto PYG sujetas a permisos Owner, no ganancias bancarias reales.
- page-cursor.mjs: páginas de A05/G28/G29/G41 máximo por respuesta, cursor opaco, no cap de registros totales.
- Tests Admin **185/185 PASS** al R33; typecheck/Vite build y CI Admin separados.
- Falta integrar Auth/Admin MFA real, KYC con documentos privados, RLS, decisiones/audit, zonas, incidentes/operación y finanzas reales. No inventar que Admin opera en la calle.

# 05. ARQUITECTO A: INFRAESTRUCTURA EXISTENTE Y NO COMPLETADA

A desarrolla PostgreSQL, RLS, SQL functions, Node STAGING, JWT/Auth, contratos OpenAPI, Driver Expo, GPS, despacho, reservas, catálogo, ledger simulado, incidentes, KYC y seguridad. Handoffs de A documentan G0–G48; la rama avanzó a G55 al revisar ahora.
- G0 monorepo y aislamiento de trading; G1 Auth sintético/PG/RLS; G2 Driver/vehículo/licencia/seguro; G3/G4 viaje/ofertas privadas; G5 entrega; G6 comercios; G7 tarifas/comisiones/ledger SIMULADOS; G8 incidentes/SOS laboratorio; G9 onboarding; G10 Driver delivery; G11 OpenAPI; G12–G16 outbox/polling/Driver inbox de OFERTAS, TTL/fencing; G17–G22 KYC y Driver/SDK Auth QA; G23–G48 locks G42, PG/RLS y seguridad ampliada; G49–G55 chat y contratos de autorización/lectura QA.
- **Cuidado:** Inbox de OFERTAS del Driver NO es Inbox de MENSAJES privados. El backend de chat G50–G55 seguía marcado x-qore-runtime-wired:false; ningún éxito de Node/PG sintético equivale a conversación operativa.
- A debe seguir dueño de entornos, segredos, Storage/AV, JWT real, RLS, app Driver y servicios comerciales.
- Handoff A previo [G0–G48](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-monorepo-isolated-20261016/docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G48_CONTINUIDAD_2026-10-23.md), con anexos 714 commits/515 archivos AL CORTE G48. NO son el inventario actual A, que avanzó.
- En el HEAD A observado 533fe7, PostgreSQL CI #40080088770 y Node #40080088769 SUCCESS; aislamiento #40080088771 y Expo #40080088776 seguían RUNNING al consultar. El nuevo arquitecto debe verificar el estado definitivo.

# 06. HISTORIA B ANTERIOR: B01–B31 (DEUDA DOCUMENTAL CERRADA)

**No confundir fases históricas B01–B31 con secuencia R1–R33 de mensajería:** se solapan parcialmente. Todo se encuentra detallado en los handoffs y anexos; estos son los logros comprobados.

### B01–B13 — Fundación 22/23 octubre
- Auditoría inicial Cliente/Driver/Expo/OpenAPI, plan de app Cliente separada.
- Pantallas iniciales Cliente y dominios de viaje AUTO, envíos AUTO/MOTO, catálogo/carrito, historial, quote, seguimiento y soporte.
- ClientRuntime, sesión Passenger y gateway HTTP fail-closed, no login real.
- Admin Web separado con roles, KYC/zonas/incidentes/auditoría/Owner finance.
- Idempotencia de mutaciones, bloqueo doble toque, requestKey CSPRNG, prevención de carreras.
- Paginación servidor por cursor, sin límite total de registros y con memoria local acotada.
- Commits históricos de referencia: 86f0ece6 auditoría; 41597e50 tracking; 27a64a86 Admin; 1f4fbc6c sesión/entrega; 4475c97c mutaciones/quote; 86eebd22 anti doble tap; d42b99cb carrito; f461595b corrección UUID; 62cdaeaa polling; b3e4709f historial; 376666b0 Admin sesión.

### B14–B23 — Contratos/seguridad/UX
- **B14:** cancelación visible, propia e idempotente con CSPRNG, no falso cancelado (commits 8aa0b04b, bb053d7a, 57e685e5).
- **B15:** GET RiderStatusV1, revisión/GPS/ETA privados y frescos (1ee127f9, 7e484a17).
- **B16:** cotización server G24 PYG/version/TTL, pantalla y corrección startTracking del mismo viaje (714da69a, 1af182b7, 90d1f718, 3fd42826).
- **B17:** impedir segunda clave tras timeout, historial FlatList y clave compuesta kind+serviceId (492c4989, d14362f2, 97b1b7c9).
- **B18:** JWT Admin/Owner rotado limpia sesión anterior, A05 cursor seguro y 121 incidentes en páginas 50/50/21 (b4442ebc, 1820eb75).
- **B19:** respuesta de KYC/zona/auditoría máximo 50 POR PÁGINA sin cuota global; prueba 123 KYC en 50/50/23 (e27e6e7b, 48fb56dd).
- **B20:** metadata KYC/expiración/rechazo y alcance parcial G30 sin fingir permiso Driver (74a6d50a, b176d904).
- **B21:** triple gate HTTPS Cliente y correcciones QA al fallar fixtures/expiry (29dce2f8, 75c1282e).
- **B22:** preparación segura AUTO/envío y validadores exactos; nunca dispatch/checkout real (c9c575f0, 18752a6b, 55954990).
- **B23:** privateViewRevision JWT/logout desmonta formularios y borra PII de drafts (eadc7df7).

### B24–B31 — Trabajo paralelo seguro con bloqueos A
- Hardening streaming HTTP y tests adversariales de timeouts/UTF8.
- Harness headless de AUTO y de envíos: editar/revisar/descartar con cero red, no presentados como viaje real.
- Comercio por catálogo vigente, invalidación stock/precio/sucursal y bloqueo de checkout sin precondición/receipt autoritativo; g45 QA sin PSP.
- Auditoría delivery-status: respuesta genérica insuficiente para ETA/assignment/custodia, dependencia A abierta.
- Historial servidor ilimitado en número total; stress histórico 100.000/2.000 páginas y ventana 500.
- Accesibilidad/labels/formularios, separación UI QA vs LIVE, soporte privado con cleanup. TalkBack/VoiceOver nativo pendiente.
- Referencias: [Handoff B cierre anterior](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-cliente-admin-parallel-20261022/docs/architect-b/HANDOFF_MAESTRO_B_CIERRE_Y_CONTINUIDAD_2026-10-23.md), [STATUS_Y_CONTRATOS](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-cliente-admin-parallel-20261022/docs/architect-b/STATUS_Y_CONTRATOS.md), [ANEXO 213 commits /214 archivos B](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-cliente-admin-parallel-20261022/docs/architect-b/ANEXO_AUDITORIA_B_213_COMMITS_214_ARCHIVOS_2026-10-23.md). El anexo es corte histórico, no inventario del HEAD 284 commits.

# 07. MENSAJERÍA Y NUEVA CONTINUIDAD R1–R13 (YA IMPLEMENTADO)

- **R1–R5:** seguridad y contratos Cliente/Admin/G44 Buyer-G45. No se inventó checkout real.
- **R6:** passenger-chat-flow, conversación por servicio, JWT/TTL, body 1–500 seguro, ACK servidor e idempotencia, UI mensajes. Reparado bug de validador ACK. Commits 0eb69ca5, 36cbb4e0, f4b49607, df31dd8f, 6ad042c5, ed7bd630, 3f237b5b.
- **R7:** navegación desde servicio al chat; memoria local 500 configurable, cursor sin cap global, revalidación antes de reintento post-expiry (6eb3a3d, 1a3390c, 2f91cf9, 1980f70, c568503).
- **R8:** revocar gates durante awaits, remount draft privado, hints push genéricos sin nombre/cuerpo/teléfono ni push real (71fbe41b, 7ad0f5ff, b5339855, f63fe17b, f089b398).
- **R9:** colisión messageId/ACK parcial rechazado, ACK expirado no marca entrega, harness de dos actores sintéticos, reasignación, timeout postcommit y 640 mensajes sin techo total (595a9a9b, 75524a62, 8cbf3b2f).
- **R10:** passenger-chat-inbox store, paginación/cursor/TTL y UI app/conversaciones.tsx (829304ba, 459637a2).
- **R11:** unreadCount entero amplio, bucles de cursor/filas, orden stable DESC y doble hilo bloqueado (530e724f, 2b816324, 6f33ef48). R32 retiró truncación visual “99+”.
- **R12:** offline mantiene lista stale solo temporalmente y BLOQUEA abrir chats; JWT/TTL limpia, rollback revision reject (65c5955d, f1c9e936).
- **R13:** pin exacto expectedConversationId desde inbox, ruta manipulada rechazada y re-key draft por hilo; corte R13 460/460 Cliente y 185/185 Admin (00344220, 407f093d).
- [Handoff maestro B R1–R13](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-cliente-admin-parallel-20261022/docs/architect-b/HANDOFF_MAESTRO_ARQUITECTO_B_R1_R13_TOTAL_Y_CONTINUIDAD_2026-10-23.md). Ninguna fase demostró transferencia de mensajes real por red a Driver.

# 08. MENSAJERÍA R14–R27: HISTORIAL COMPLETO DE ENDURECIMIENTO

| R | Realizado en B | Documento canónico en docs/architect-b |
| --- | --- | --- |
| R14 | Revisión TTL, tiempo/cursor y frescura de páginas; no aceptar páginas expiradas o ambiguas | CONTINUIDAD_B_R14_CHAT_TTL_CURSOR_FRESHNESS_2026-10-23.md |
| R15 | Regresiones de reasignación de mismo servicio y JWT rotado durante ACK; nunca reenviar nueva clave | CONTINUIDAD_B_R15_CHAT_REASIGNACION_JWT_ACK_2026-10-23.md |
| R16 | Rechazo de rollback de revisión/autorización viejo, JWT y cursores | CONTINUIDAD_B_R16_CHAT_JWT_REVISION_ROLLBACK_2026-10-23.md |
| R17 | ACK serverStored validado aumenta revisión local e invalida cursor anterior; GET antiguo no borra mensaje confirmado | CONTINUIDAD_B_R17_CHAT_ACK_REVISION_CURSOR_2026-10-23.md |
| R18 | Purga física de cuerpos/cursors al caducar TTL, aun con pending; retener solo key/body mínimo de conciliación | CONTINUIDAD_B_R18_R20_CHAT_PRIVACIDAD_LISTA_Y_CURSOR_2026-10-23.md |
| R19 | Chat ScrollView → FlatList virtualizada, no montar miles de filas | mismo doc R18–R20 |
| R20 | Pruebas privadas de orden, cursor, ventana y mensajes; histórico 479 tests Cliente al corte | mismo doc R18–R20 |
| R21 | Eliminar referencia oculta duplicada de mensajes privados en header, que antes sobrevivía a una purga | CONTINUIDAD_B_R21_R22_METADATOS_PRIVADOS_Y_ORDEN_CHAT_2026-10-23.md |
| R22 | Orden newest-first y control de páginas anteriores sin colisiones, histórico 484 Cliente | mismo doc R21–R22 |
| R23 | Clave UI también ligada a conversationId autorizado REAL del mismo servicio, para borrar draft tras reasignar Driver | CONTINUIDAD_B_R23_BORRADOR_PRIVADO_REASIGNACION_2026-10-23.md |
| R24 | Recovery UX al entrar a otro hilo con envío ambiguo; volver al antiguo y reconciliar MISMA requestKey | CONTINUIDAD_B_R24_RECUPERACION_CHAT_PENDIENTE_2026-10-23.md |
| R25 | Gateway HTTP G51 inbox GET autenticado, cursor firmado/header HTTPS y gates OFF | CONTINUIDAD_B_R25_G51_INBOX_HTTPS_OPTIN_2026-10-23.md |
| R26 | JWT/cursor/stream de inbox endurecidos: orden, CRLF, timeout, byte-limit, cancel | CONTINUIDAD_B_R26_R27_G51_SEGURIDAD_HTTP_PAGINACION_2026-10-23.md |
| R27 | Cliente -> sesión -> gateway G51 -> store con páginas sucesivas 100, sin cuota global; historial 511 Cliente/185 Admin | mismo doc R26–R27 |

No repetir desarrollos históricos. Todos esos documentos existen y contienen SHAs/CI específicos; consultarlos al tocar un módulo.

# 09. R28–R33: ÚLTIMOS TRABAJOS DE ESTE RELEVO Y CI

## R28: GET G52 historial privado
- A incorporó contrato G52 GET /v1/staging/chat/services/{serviceKind}/{serviceId}/messages, DTO exacto de hilo/owner/assignment/TTL/revisión/página.
- [Implementación commit 785efbd4](https://github.com/mezas3238-hue/Qore-mobile-/commit/785efbd4a9a70afdac7e041a4849bc0153286cab): g52-chat-history-http-gateway.mjs, JWT Passenger, origin HTTPS pinned, signed cursor header, expectedConversationId, max bytes/timeout, control de redirección, 401/403 session-bound, DTO sin PII y OFF.
- [10 tests commit b7669d7e](https://github.com/mezas3238-hue/Qore-mobile-/commit/b7669d7e5a8b8c5f35d75db8cf9eedf328fbf8b5).

## R29: fijar hilo original al paginar y conciliar
- [Commit d8a0464a](https://github.com/mezas3238-hue/Qore-mobile-/commit/d8a0464aaeb4d6b0a3480b17b812f62cdcf1f674): passenger-chat-flow envía expectedConversationId en GET inicial desde inbox, GET cursor older y refresh del pending ACK; no aceptar Driver/reassign distinto.
- [3 tests 94cf002d](https://github.com/mezas3238-hue/Qore-mobile-/commit/94cf002d4ac0518b4da7b8376fc8cdb9de39631d). Corte R29 524 Cliente / 185 Admin = 709/709 PASS. [Handoff R28–R29](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-cliente-admin-parallel-20261022/docs/architect-b/CONTINUIDAD_B_R28_R29_G52_HISTORIAL_PRIVADO_PINNED_2026-10-23.md).

## R30: GET de lectura autorizado no implica permiso POST
- [Commit 8735e43b](https://github.com/mezas3238-hue/Qore-mobile-/commit/8735e43b1ad6e29ebe277adf7f51a07502eb44fe): motor separa contractReady de sendReady; sin sendMessage certificado retorna CHAT_SEND_NOT_CERTIFIED antes de crear estado pendiente.
- [Commit 9399659e](https://github.com/mezas3238-hue/Qore-mobile-/commit/9399659e75e81798d0c9794dc1a500d392ad509a): lector G52 opcional compuesto en ClientExperience.
- [Commit 7d9b0b41](https://github.com/mezas3238-hue/Qore-mobile-/commit/7d9b0b41ab8fee6db90ce957e2d524e34954eaca): UI chat “solo lectura”, oculta editor y botón enviar hasta writer real.
- [Tests 62e86e4b](https://github.com/mezas3238-hue/Qore-mobile-/commit/62e86e4b2e6ff5a500ef32a3cf35f094cbf8e0a1) y [tests 1661b017](https://github.com/mezas3238-hue/Qore-mobile-/commit/1661b017dfbf07977dbd7e735c127e3a889ddf68) de lectura sin escritor/rotación/capabilities.
- **Error real TS2339**: client-experience.d.mts omitía sendReady; CI falló. [Fix 11af02d6](https://github.com/mezas3238-hue/Qore-mobile-/commit/11af02d649939170850d586df10c60308d840170) y [test logout durante GET 07df8938](https://github.com/mezas3238-hue/Qore-mobile-/commit/07df8938832a960a963ca70615cef137f3be03c7), CI reparada: 529 Cliente, 185 Admin, 45 Driver PASS. No ocultar error histórico.

## R31: POST G53 con ACK duradero
- OpenAPI G53 POST /v1/staging/chat/services/{serviceKind}/{serviceId}/conversations/{conversationId}/messages, JSON requestKey/body, ACK conversationId/serviceId/requestKey/messageId/senderRole/body/createdAt/revision/serverStored.
- [Gateway 8e64ff6d](https://github.com/mezas3238-hue/Qore-mobile-/commit/8e64ff6d8fe4931f0e611100cd5f2a2970581fc6): POST HTTPS pinned/JWT con ACK whitelist, un POST en vuelo, cancellable, body seguro; timeout, 200 corrupto, 409 o fallo de red NO afirman rechazo, se conserva MISMA requestKey.
- [10 pruebas 13a1749b](https://github.com/mezas3238-hue/Qore-mobile-/commit/13a1749b403ded7827354ce3e2d76f157facc900).
- [Composición 52abf136](https://github.com/mezas3238-hue/Qore-mobile-/commit/52abf136f7a9b14fdc767bf73c087dd68c9433ef): G52 reader + G53 writer solo con dos runtimes certificados y origin/pin idénticos; de lo contrario solo lectura.
- [3 pruebas integradas 3701d1db](https://github.com/mezas3238-hue/Qore-mobile-/commit/3701d1db82c87e5811361a98e39f756486b3941f): envío/ACK, gate host distinto y retry MISMA key/body tras ACK corrupto. CI R31 **542 Cliente / 185 Admin / 45 Driver** PASS. [Handoff R31](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-cliente-admin-parallel-20261022/docs/architect-b/CONTINUIDAD_B_R31_G53_ENVIO_IDEMPOTENTE_2026-10-23.md).

## R32: evitar falsa confirmación de lectura
- G51 read-receipt exige throughSeq, mientras G52 ChatHistoryMessageG52 no expone seq. Se bloqueó derivar números desde revision, timestamp, índice o UUID.
- [Gateway 2f912ce1](https://github.com/mezas3238-hue/Qore-mobile-/commit/2f912ce156e80aaa2e4391dacb8d7ebbc2a73e4f): opt-in OFF POST /v1/staging/chat/conversations/{conversationId}/read-receipt con JSON throughSeq, ACK readThrough/qaOnly estricto, JWT, HTTPS, abort, no lecturas automáticas.
- [11 pruebas 4e34752f](https://github.com/mezas3238-hue/Qore-mobile-/commit/4e34752f7d8dc292874095e03d508443c6fbc7bf).
- [UI 46b1914b](https://github.com/mezas3238-hue/Qore-mobile-/commit/46b1914b2459ee39b1f20eeb498822a222e79f2a): muestra 151 unread EXACTOS, ya no 99+; [test 08a25339](https://github.com/mezas3238-hue/Qore-mobile-/commit/08a2533994a13a9cafdb54249153cb809220605c) verifica que GET G52 no envía read receipt ni altera unreadCount.
- CI R32 **554 Cliente / 185 Admin /45 Driver** PASS. [Handoff R32](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-cliente-admin-parallel-20261022/docs/architect-b/CONTINUIDAD_B_R32_G51_RECEPCION_LECTURA_SIN_ACUSE_FALSO_2026-10-23.md).
- **G55 cambió el desbloqueo previsto:** A propuso readMarker opaco y POST mark-visible, de modo que ya NO es imprescindible exponer raw seq a Cliente. Ambos siguen sin HTTP montado.

## R33: purga positiva al reasignar Driver
- [Lógica 271c9b2e](https://github.com/mezas3238-hue/Qore-mobile-/commit/271c9b2ed154c79b5dbefcd41d1b9b2ba94a2452): al recibir Inbox G51 válido no stale, comparar servicio/tipo igual + conversationId diferente; purgar chat anterior, pending ambiguo, hints y borradores por UI re-key. Si no aparece una fila en página parcial o error, NO inferir revocación.
- [4 regresiones 2f4e6fe7](https://github.com/mezas3238-hue/Qore-mobile-/commit/2f4e6fe7454a040c14eebcf5ba66db2ae8248318): distinto hilo, mismo hilo, página vacía/otro servicio/malformada y no reintentar POST ambiguo tras reassign.
- R33 **558/558 Cliente**, **185/185 Admin**, **45/45 Driver** PASS, 3/3 workflows completos. [Handoff R33](https://github.com/mezas3238-hue/Qore-mobile-/blob/962d17ce8cd55bf3bb1c7e8d2698c752c4e33430/docs/architect-b/CONTINUIDAD_B_R33_G54_REVOCACION_CRUZADA_G51_CHAT_2026-10-24.md).
- **Límite:** esta purga frontend no prueba revocación inmediata remota. Cada GET/POST debe ser reautorizado en PostgreSQL/RLS por A.

# 10. NUEVO CONTRATO G55 DE A: EL PRIMER HITO R34

OpenAPI A leído en rama feature/mobility-monorepo-isolated-20261016, versión **1.0.0-g55**, **65 rutas**, blob Git **726a1cd455dd056e547dd5e572470c33433a429d**. Nuevas operaciones:

**GET /v1/staging/chat/services/{serviceKind}/{serviceId}/history-with-read-marker**
- operationId: readChatHistoryWithScopedReadMarkerG55.
- Respuesta ChatHistoryWithMarkerG55 con campos EXACTOS **page, readMarker, qaOnly, productionEnabled**.
- page = ChatHistoryPageG52 (ownerId, conversationId, messages, ttl, assigned, revision, cursor).
- readMarker = null o ChatReadMarkerG55: **marker UUID, messageId UUID, expiresAtMs entero no negativo**.
- Marker únicamente para **mensaje de Driver visible en la página autorizada**, no para mensajes Passenger/otro hilo; no puede escapar de su actor/servicio.
- Endpoint **x-qore-runtime-wired:false, x-qore-qa-only:true**.

**POST /v1/staging/chat/conversations/{conversationId}/mark-visible**
- operationId: markExplicitlyVisibleServerIssuedMessageG55.
- Request EXACTO ChatMarkVisibleRequestG55 **{marker: UUID}**, nunca raw throughSeq.
- Response ChatMarkVisibleReceiptG55 EXACTA **conversationId, messageId, readConfirmed:true, qaOnly:true**. Sólo el ACK persistente confirma lectura; readThrough/seq los resuelve A por ticket CHAT_READ/G54 en backend.
- Endpoint también **x-qore-runtime-wired:false, x-qore-qa-only:true**.

**Huecos técnicos que B debe escalar a A**
- El GET G55, al consultar, incluía serviceKind/serviceId pero NO definía explícitamente cursor paginado ni expectedConversationId equivalentes a G52. Confirmar cómo paginar e inmovilizar el hilo antes de integrar.
- readMarker no lleva conversationId; el backend debe ligarlo a JWT/servicio/hilo, y B debe cotejar su messageId con el mensaje del Driver que aparece en page actual.
- expiresAtMs debe ser comprobado en reloj de QA y revocarse ante cambio de sesión/hilo; marcador no es un permiso permanente.
- No marcar como leído al abrir pantalla, en background, por hint push, por scroll que no muestra mensaje o en página stale. La confirmación requiere señal EXPLÍCITA de visibilidad real y ACK.
- Cliente NO debe usar g51-chat-read-receipt-http-gateway con throughSeq generado del timestamp o revision. La alternativa G55 supersede aquella dependencia de R32, aunque las rutas legacy queden documentadas.
- No confundir contrato OpenAPI con API accesible. Sin runtime montado y certificado triple gate OFF. Registrar cuestión del cursor/pin en issue #9.

# 11. CRECIMIENTO DE PRUEBAS CERTIFICADAS Y ESTADO REAL

| Corte | Cliente PASS | Admin PASS | Driver adicional | Referencias de CI |
| --- | ---: | ---: | ---: | --- |
| R13 | 460 | 185 | Ver jobs | Handoff B R1–R13 |
| R27 | 511 | 185 | Ver jobs | Handoff R26–R27 |
| R29 | 524 | 185 | Ver jobs | #40049177808, #40049177802, #40049177800 |
| R30 | 529 | 185 | 45 | #40050139688, #40050139702, #40050139698 |
| R31 | 542 | 185 | 45 | #40050869570, #40050869557, #40050869683 |
| R32 | 554 | 185 | 45 | #40051661349, #40051661339, #40051661284 |
| **R33** | **558** | **185** | **45** | **#40056756096, #40056756150, #40056756148 SUCCESS** |

**743** = 558 Cliente + 185 Admin, no sumar Driver dentro de esa cifra. QA de Node/TypeScript/Expo WEB/Vite no equivale a APK/IPA, dispositivos físicos, JWT real, PostgreSQL chat integrado ni app comercial funcional.

Workflows obligatorios para cada SHA B:
1. Movete Facil Architect B ownership boundary.
2. Movete Facil Admin web QA (tests, TS, build).
3. Movete Facil two app isolation (aislamiento + Node Cliente/Driver, TS, Expo web export).

Verificar del MISMO SHA status=completed y conclusion=success; leer job logs **# tests, # pass, # fail**. No usar CI de otro SHA ni inventar 3/3 mientras esté queued/in_progress. Un handoff nuevo también crea SHA nuevo y dispara más CI.

# 12. ERRORES YA CORREGIDOS, A MANTENER COMO REGRESIONES

1. Doble tap generaba solicitudes concurrentes: lock ANTES de await.
2. Timeout permitía requestKey nueva: retry cuerpo y key idénticos.
3. JWT viejo/401-403 rotado borraba sesión nueva: comparación antes/después, abort/generation.
4. DTO PII/campos extras/URL/correo/teléfono/bidi entraba al cliente: schemas exactos + rechazo.
5. Formularios y drafts se conservaban tras JWT nuevo/cambio de cuenta: privacyRevision y React re-key.
6. GPS/ETA/placa sin consentimiento o vencidos aparecían: TTL/estado/loss offline.
7. startTracking borraba cotización válida del mismo viaje: retener si subjectId==tripId.
8. UUID coincidía entre distintos tipos de servicio en historial: kind+serviceId.
9. Límite 50 páginas confundido con 50 TOTAL: cursor/ventana RAM.
10. Admin A05 aceptaba demasiadas filas POR PÁGINA: fijado a contrato 50 sin tope global.
11. React 19/React DOM ERESOLVE, regex UUID, fixtures de test con sombras/expiry, tipos JSX: correcciones CI auditadas.
12. R6 ACK helper mal nombrado; reparado y testeado.
13. Mensajes ScrollView montaba demasiadas filas: FlatList y window R19.
14. Autorización header retenía cuerpos después de TTL: separada metadata R21.
15. Cursor circular, orden invertido, doble hilo, rollback revision o ACK collision: fail-closed/clear.
16. Draft podía sobrevivir reasignación de Driver del mismo servicio: key conversationId R13/R23.
17. Pending ACK ambiguo no tenía UI de recuperación: route del hilo original R24.
18. Lector G52 no estaba compuesto y GET exigía POST: separado contractReady/sendReady R30.
19. **TS2339 sendReady** detectado en CI R30: fix en client-experience.d.mts SHA 11af02d6; luego pasó CI completa.
20. POST G53 no manejaba 200 corrupto: conservar incertidumbre y misma key R31.
21. Inbox ocultaba número 151 como “99+”: ahora muestra entero R32.
22. GET historial no confirma lectura: no POST autómatico read-receipt R32.
23. Reasignación confirmada no purgaba chat anterior: clear positivo R33.
24. Nueva G55 debe evitar cualquier throughSeq inventado y readConfirmed sin ACK.
25. En todos los casos frontend NO sustituye JWT/RLS/SQL autorizado en el servidor A.

# 13. PENDIENTES DE A: BLOQUEOS REALES PARA PRODUCCIÓN, NO PARA QA B

**A-P0-01 Auth:** proveedor JWT/JWKS real, roles Passenger/Driver/Admin, sesión/revocación, MFA AAL2 Admin y scopes, pruebas de dos identidades.
**A-P0-02 Infra:** STAGING HTTPS autorizado con Node/PG/RLS, secretos protegidos, sin datos reales, evidencia de runtime y monitorización.
**A-P0-03 Chat:** tablas PostgreSQL conversations/messages, asignación activa por RIDE/DELIVERY/MERCHANT_ORDER, visibilidad exacta actor y Driver actual, reenrutamiento/revocación, antileakage y retención.
**A-P0-04 G53 POST:** requestKey durable con unicidad server-side, ACK original al repetir misma key/body incluso si primera respuesta se perdió DESPUÉS de COMMIT, 409/races/401/403 test.
**A-P0-05 G51/G52/G55:** inbox privado firmado/cursor, historial paginado con TTL, endpoint marker vinculado a mensaje Driver/hilo/actor, mark-visible idempotente desde token opaco, sin saltos de lectura ni future seq. Confirmar cursor/expectedConversationId G55.
**A-P0-06 Driver:** app Driver separada capaz de leer/responder chat real y recibir notificación segura, pruebas reasignación/cierre y offline.
**A-P0-07 KYC:** DB metadata + Storage cifrado documentos/vehículos, MIME/hash del servidor, antivirus y retención, revisión Owner/Admin auditada con URLs temporales; sin papeles reales en staging sin permiso.
**A-P0-08 GPS/dispatch:** zona vs disponibilidad, consent, freshness, antispuffing, concurrencia dos drivers una asignación, status versionado, offline.
**A-P0-09 Tarifas:** prequote antes de crear viaje, AUTO/MOTO con precios Gs diferenciados, versión/TTL, comisiones, ruta y geofence fiables.
**A-P0-10 Comercio:** buyer G44/G45 real, sucursal/productos versionados, stock atómico, reserva/entrega y receipt, sin PSP antes de Owner.
**A-P0-11 Admin backend:** MFA real, decisiones KYC, filtros G41 global EN SERVIDOR, zonas, auditoría, permisos granulares y finanzas autorizadas.
**A-P0-12 Operación:** push FCM/APNs, soporte/SOS con operador real autorizado, antifraude/abuso, backups/restore, privacidad, observabilidad.
**A-P0-13 Pagos:** PSP/ledger real, conciliación y reembolsos, fiscalidad Paraguay, solo aprobación explícita Owner y evaluación legal.
**A-P0-14 Despliegue:** test nativo Android/iOS, publicación stores, QA seguridad, rollback y aceptación Owner.

Una ruta OpenAPI descrita, un ticket G54, o un pipeline SQL QA SUCCESS NO prueban que todo lo anterior está montado. A es responsable de demostrar endpoint HTTPS STAGING funcional con Auth/DB y tests negativos.

# 14. PENDIENTES DE B: SIGUIENTE TRABAJO CONCRETO SIN ESPERAR

**B-P0-01 — R34, inmediatamente: G55 marcador de lectura**
- Leer contrato actual de A (ya G55 65 rutas) y confirmar seguridad/paginación/pin.
- Implementar DTO validador puro: envelope page G52 exacta, marker null u objeto seguro, messageId corresponde a MENSAJE DEL DRIVER incluido en página, owner/servicio/conversación, TTL y expiración, no PII extra.
- Preparar gateway opt-in **OFF por defecto**, HTTPS pinned/JWT/sesión para GET history-with-read-marker y POST mark-visible con body **{marker}** y ACK exacto conversationId/messageId/readConfirmed:true/qaOnly:true.
- NUNCA enviar POST por simple GET ni por mensaje Passenger; solo señal comprobada de visibilidad real en UI; sin datos en disco ni analytics, sin raw throughSeq.
- Testear marker expirado, ajeno a página/hilo/cuenta, Driver reasignado, doble confirmación, sesión rotada/logout en vuelo, ACK falso/corrupto, timeout, respuesta grande, cursor viejo, viewport no visible y error 403.
- Si faltan query de cursor y expectedConversationId en contrato A, documentar solicitud en issue #9, certificar dominio local sin red y empezar otro bloque B.

**B-P0-02 — Chat race/seguridad:** simultanear G51 inbox refresh, G52/G55 GET, G53 POST, logout/cambio JWT/reassign; garantizar jamás reanimar historia, nunca enviar a Driver nuevo o marcar leído en hilo viejo.

**B-P0-03 — Inbox/Historial escala:** pruebas de >100.000 registros sintéticos y cursores firmados/páginas sin techo global; control de memoria local, orden stable, anti-replay y UI FlatList.

**B-P0-04 — Recuperación de envíos:** UX pending requestKey sin duplicar, mensajes exactos sobre incertidumbre, no declarar entregado, pruebas timeout postcommit.

**B-P0-05 — Accesibilidad:** TalkBack/VoiceOver, focus/keyboard/alert, fuentes grandes, navegación en Android/iOS cuando haya entorno; mientras tanto tests y semántica de pantallas B.

**B-P0-06 — Admin adversarial:** JWT/MFA rotación, Owner/Admin cruzados, KYC paginado con múltiples miles, filtros G41 server first, caducidad, URLs prohibidas y finance read-only.

**B-P0-07 — Viajes y envíos:** UX con estados autoritativos, bloqueo de segunda contratación/quote, distinción zona/disponibilidad, GPS expirado, incidentes sin SOS falso.

**B-P0-08 — Comercio:** catálogo/stock/version/cantidad, carrito privado y checkout fail-closed, falsación de respuesta inconsistente; sin activar compra hasta A.

**B-P0-09 — Soporte privado:** TTL/logouts/PII, estado de incidente no reportado vs receipt QA, cero notificación operador sin evidencia.

**B-P0-10 — Documentación/continuidad:** nuevo commit/QA/issue #9/handoff por cada corte, siempre rama B y 3/3 CI de SHA propio.

**Cuando A entregue runtime certificado**: integrar roles JWT reales, G51/G52/G53/G55, Driver receptor, mensajes reales en STAGING autorizado, status/prequote/delivery, Admin backend, luego apps nativas y Lovable (solo UI). Sin dejar apps bajo test sintético y anunciar finalización.

# 15. MATRIZ DE BLOQUEOS: CUÁNDO DETENER UNA ACCIÓN Y CÓMO SEGUIR

**Bloqueos reales de una acción:** falta permiso Owner para deploy/merge/PSP/PII, contrato/endpoint central inexistente para conectar red, JWT proveedor inaccesible, falta secreto o Storage autorizado, CI detecta vulnerabilidad/crash no reparable dentro de B, issue de propiedad A/B, conector GitHub no disponible.

**NO son bloqueos para toda la obra:** workflows corriendo, un test rojo (se corrige), falta Lovable, ausencia temporal de PSP/Auth para QA, falta presupuesto de datos pagos, A todavía sin endpoint de chat real o ausencia de prueba Android física cuando se pueden construir validadores y tests Node independientes.

**Procedimiento:** registrar evidencia exacta en issue #9 (ruta/DTO esperado, actor, JWT, TTL, errores, prueba negativa, SHA) y avanzar inmediatamente otra tarea B de la lista. Si bloquea GitHub completamente, entregar patch/diseño verificable en el chat actual sin afirmar commit no escrito; NO prometer que se hará en segundo plano.

# 16. CHECKLIST INNEGOCIABLE DE CI, SEGURIDAD Y ENTREGA

- [ ] Leer **HEAD A/B vigente**, OpenAPI A vigente y estado PR DRAFT.
- [ ] Elegir cambio útil B acotado, no rehecho; leer módulo/tests y declaración .d.mts.
- [ ] Confirmar no modificar rutas A, root, packages ni CI.
- [ ] Añadir tests positivos y adversariales, con cuentas sintéticas, TTL/errores/401/403, no incluir secretos.
- [ ] Publicar commit en rama B con SHA/blob actual; sin merge/force push.
- [ ] Consultar 3 workflows del **mismo SHA**: boundary, Admin, isolation+Cliente/Driver; leer logs Node y typecheck/export.
- [ ] Corregir cualquier test rojo antes de proclamar PASS; no omitir pruebas.
- [ ] Registrar SHA, conteos, límites QA vs real, nuevas dependencias A.
- [ ] Publicar doc R34 o siguiente y actualizar PR #8 e issue #9; verificar CI del documento nuevo.
- [ ] Continuar con R35 y el resto sin pedir nueva confirmación por cada test seguro.
- [ ] Mantener cuotas de página, NO de total, datos sintéticos, sesiones separadas, no pago ni ubicación inventada.
- [ ] Si Owner autoriza producción más adelante: require E2E real, revisión legal/seguridad/privacidad, backups/rollback y go/no-go.

# 17. ÍNDICE DE DOCUMENTOS ANTERIORES Y AUDITORÍA, NO PERDER ARCHIVOS

**Documentos canónicos de B:**
1. [Handoff B R1–R13 integral](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-cliente-admin-parallel-20261022/docs/architect-b/HANDOFF_MAESTRO_ARQUITECTO_B_R1_R13_TOTAL_Y_CONTINUIDAD_2026-10-23.md) (342 líneas históricas, detalle de R6–R13).
2. [Handoff de cierre B anterior](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-cliente-admin-parallel-20261022/docs/architect-b/HANDOFF_MAESTRO_B_CIERRE_Y_CONTINUIDAD_2026-10-23.md) (B01–B31 e historia Cliente/Admin).
3. [Anexo histórico B 213 commits/214 archivos](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-cliente-admin-parallel-20261022/docs/architect-b/ANEXO_AUDITORIA_B_213_COMMITS_214_ARCHIVOS_2026-10-23.md), CORTE HISTÓRICO, no el HEAD de 284.
4. [R33 último handoff](https://github.com/mezas3238-hue/Qore-mobile-/blob/962d17ce8cd55bf3bb1c7e8d2698c752c4e33430/docs/architect-b/CONTINUIDAD_B_R33_G54_REVOCACION_CRUZADA_G51_CHAT_2026-10-24.md).
5. [R32 lectura](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-cliente-admin-parallel-20261022/docs/architect-b/CONTINUIDAD_B_R32_G51_RECEPCION_LECTURA_SIN_ACUSE_FALSO_2026-10-23.md).
6. [R31 escritura](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-cliente-admin-parallel-20261022/docs/architect-b/CONTINUIDAD_B_R31_G53_ENVIO_IDEMPOTENTE_2026-10-23.md).
7. [R30 solo lectura](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-cliente-admin-parallel-20261022/docs/architect-b/CONTINUIDAD_B_R30_G52_SOLO_LECTURA_INTEGRACION_2026-10-23.md).
8. [R28–R29 histórico G52](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-cliente-admin-parallel-20261022/docs/architect-b/CONTINUIDAD_B_R28_R29_G52_HISTORIAL_PRIVADO_PINNED_2026-10-23.md).
9. [R26–R27 histórico G51](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-cliente-admin-parallel-20261022/docs/architect-b/CONTINUIDAD_B_R26_R27_G51_SEGURIDAD_HTTP_PAGINACION_2026-10-23.md).
10. [STATUS_Y_CONTRATOS B](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-cliente-admin-parallel-20261022/docs/architect-b/STATUS_Y_CONTRATOS.md). Es historia, no fuente del nuevo G55.

**Documentos A y coordinación:**
11. [Handoff A G0–G48](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-monorepo-isolated-20261016/docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G48_CONTINUIDAD_2026-10-23.md).
12. [Anexo A 714 commits al G48](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-monorepo-isolated-20261016/docs/handoff/ANEXO_A_HISTORIAL_GITHUB_714_COMMITS_AL_HEAD_G48_2026-10-23.md); [Inventario A 515 archivos G48](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-monorepo-isolated-20261016/docs/handoff/ANEXO_A_INVENTARIO_515_ARCHIVOS_HEAD_G48_2026-10-23.md).
13. [División formal entre arquitectos](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-monorepo-isolated-20261016/docs/handoff/DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md).
14. [OpenAPI A STAGING en su rama](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-monorepo-isolated-20261016/apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json).
15. [PR #8 Arquitecto B](https://github.com/mezas3238-hue/Qore-mobile-/pull/8), [PR #7 Arquitecto A](https://github.com/mezas3238-hue/Qore-mobile-/pull/7), [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).

Todos los documentos R14–R27 se encuentran en docs/architect-b con nombre CONTINUIDAD_B_RXX... como tabla sección 08, y cada uno contiene SHA/logs y riesgos propios. Consultar fuente precisa al intervenir, NO borrarlos.

# 18. PROCEDIMIENTO EXACTO DEL NUEVO ARQUITECTO: AVANZAR DE VERDAD

1. Abrir este documento, PR #8, PR #7, issue #9 y OpenAPI A; obtener HEAD SHA actual. No confiar en SHA de hace horas, A avanza en paralelo.
2. Revisar CI 3/3 del HEAD B, incluida la ejecución del commit de este handoff. Si falla un job, leer logs y corregir en archivos B; no afirmar verde prematuramente.
3. Empezar **R34 G55** de forma inmediata: validación de server-issued marker y contrato GET/POST fail-closed, sin autopost; identificar vacío de cursor/expectedConversationId con A.
4. Crear pruebas Node y TypeScript/UI coherentes, negativas de session/JWT/reassign, POST no visible, marker caduco/ajeno; no inventar campos ni números seq.
5. Commit GitHub B con SHA actual, verificar los tres workflows y logs del mismo commit; reparar hasta que quede verde.
6. Publicar R34 handoff y comentario PR #8; escalar dependencias específicas a A por issue #9.
7. **No detenerse:** abordar R35 sobre otra mejora B autónoma, después R36, etc. Si una integración exige JWT/PG no montados, registrar bloqueo de ESA integración y trabajar en otros dominios o QA.
8. Antes de declarar una función “operativa”, exigir E2E real Auth+DB+dos actores+Driver+Android/iOS y autorización Owner. Ningún export web es app de tienda.
9. Si el usuario pide otro handoff, actualizar toda la matriz y el SHA, no comenzar desde cero ni perder los anexos.

Comandos en un entorno local autorizado: desde apps/movete-cliente, npm test, npm run typecheck y npm run check; desde apps/movete-admin, npm run check y npm run build. Los workflows CI de B validan export web de Cliente y Driver. Si no hay terminal local, usar GitHub API/Actions y no afirmar comandos no ejecutados.

# 19. PROMPT EXACTO PARA PEGAR EN EL NUEVO CHAT

> Sos el siguiente ARQUITECTO B de QORE MOBILE / MOVETE FÁCIL. Continuá el desarrollo REAL SIN DETENERTE SALVO BLOQUEO REAL. Fuente soberana GitHub: mezas3238-hue/Qore-mobile-. Lee el archivo docs/architect-b/HANDOFF_MAESTRO_INTEGRAL_B_R1_R33_G55_CONTINUIDAD_AUTONOMA_2026-10-24.md, los históricos y QA, PR #8 DRAFT, PR #7 DRAFT e issue #9. Tu rama es feature/mobility-cliente-admin-parallel-20261022. EDITÁ EXCLUSIVAMENTE apps/movete-cliente/**, apps/movete-admin/** y docs/architect-b/**; no Driver, PostgreSQL, backend, OpenAPI, root ni CI del Arquitecto A. Último corte B certificado R33 558/558 Cliente +185/185 Admin = 743/743, Driver 45/45 adicional, 3/3 workflows SUCCESS. El A ya expuso OpenAPI G55 65 paths con GET history-with-read-marker y POST mark-visible pero x-qore-runtime-wired:false; no activar red ni marcar leído automáticamente. Empezá R34 con contrato y gateway opt-in seguro de marcador, manteniendo JWT/owner/conversationId/TTL, pregunta técnica específica de cursor/pin a A por issue #9 sin detener las demás tareas. Añadí código real, tests adversariales, commit GitHub, verificá CI del mismo SHA 3/3, corregí fallas, documentá nuevo handoff y SEGUÍ con el siguiente módulo B inmediatamente. Si bloquea Auth/endpoint, documentalo y cambia de módulo. NO MERGE / NO LIVE / NO deploy / NO PSP / NO PII real / NO force-push sin orden expresa del Owner. No llamar app terminada a QA sintética ni export web. Entregá siempre links GitHub auditables.

---

**VEREDICTO FINAL HONESTO:** Cliente/Admin tienen amplia cobertura de dominios y protección probada hasta R33; existe PR B DRAFT con CI 743 Cliente+Admin PASS y 45 Driver PASS. A ha avanzado contratos e infraestructura hasta G55, pero chat HTTP/RLS real y Driver receptor, KYC privado en operación, tarifas/dispatch/GPS calle, PSP, SOS y E2E nativo aún requieren evidencia e integración. El siguiente arquitecto debe CONTINUAR sin interrupciones con todo trabajo B no bloqueado, NO anunciar una app comercial lista.
