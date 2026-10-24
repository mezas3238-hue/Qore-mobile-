# QORE MOBILE / MOVETE FÁCIL — HANDOFF MAESTRO INTEGRAL ARQUITECTO B
## Transferencia al nuevo chat: legado B01–B31 + R1–R43 · trabajos, QA, deudas y ejecución autónoma

**Fecha de corte:** 24 de octubre de 2026, Paraguay. **Responsable de continuación:** próximo Arquitecto B.
**MANDATO DEL OWNER: CONTINUAR SIN DETENERSE SALVO BLOQUEO REAL.**
Este documento es el punto de entrada al trabajo, NO una propuesta de reinicio. El siguiente arquitecto debe leerlo, verificar GitHub y ejecutar código + pruebas + commits en la rama B. Si un módulo requiere contrato A, registrar la dependencia en issue #9 y avanzar inmediatamente a otra tarea propia de B. No invertir turnos en auditorías repetidas o documentos sin implementación.

## 00 · Fuente de verdad, corte verificado y referencias

- Repositorio soberano: https://github.com/mezas3238-hue/Qore-mobile- (**el guion final importa; nunca confundir con qore-core de trading**).
- **Arquitecto B:** \`feature/mobility-cliente-admin-parallel-20261022\`; PR **#8** https://github.com/mezas3238-hue/Qore-mobile-/pull/8 · **OPEN, DRAFT, NO MERGED**, base rama A. HEAD **ANTES** de este nuevo maestro: \`0261878d2ed12af1ff15f3b60f770691000d27c0\`.
- **Arquitecto A:** \`feature/mobility-monorepo-isolated-20261016\`; PR **#7** https://github.com/mezas3238-hue/Qore-mobile-/pull/7 · **OPEN, DRAFT, NO MERGED**, base \`main\`. HEAD A al corte \`842143d2d82e03c7c10041051341f3daa643f783\`. A cambia en paralelo: reconsultar siempre.
- **Coordinación:** https://github.com/mezas3238-hue/Qore-mobile-/issues/9; benchmarks Cliente https://github.com/mezas3238-hue/Qore-mobile-/issues/10 (Driver), /issues/11 (Bolt Cliente y trabajo B) y /issues/12 (Uber Cliente).
- **PR #8 antes de agregar este maestro:** **346 commits y 276 archivos cambiados** según GitHub: **137 rutas Cliente**, **48 rutas Admin**, **91 rutas docs/architect-b**. Cifras congeladas en R43; publicar el maestro añade al menos otro commit/archivo.
- **CI R43 sobre SHA \`0261878d\`:** 3/3 workflows SUCCESS:
  - Ownership Arquitecto B https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40093092853.
  - Admin Web QA https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40093092856, **197/197 PASS**, TypeScript/Vite PASS.
  - Aislamiento/Expo https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40093092850, **Cliente 640/640 PASS**, **Driver 51/51 PASS**; TypeScript, aislamiento y export web SUCCESS. Total **888 pruebas unitarias exitosas en estas tres suites**, no certificación nativa o producción.
- **CI A** en SHA indicado: PostgreSQL #40092996629, STAGING Node #40092996631, Expo aislado #40092996630, two-app isolation #40092996654, **4/4 SUCCESS**, exclusivamente laboratorio/QA.
- **Último OpenAPI de A observado:** \`apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json\`, versión **1.0.0-g57**, **72 rutas**. En G40/G41, Buyer G44/G45 y chat G51–G58 siguen operaciones \`x-qore-runtime-wired:false\` y QA-only. **Un esquema y pruebas sintéticas NO prueban endpoint HTTPS operativo**.
- **Documentación madre preexistente y obligatoria:** [Handoff B R1–R33](./HANDOFF_MAESTRO_INTEGRAL_B_R1_R33_G55_CONTINUIDAD_AUTONOMA_2026-10-24.md) (historial detallado de B01–B31 y R1–R33, ~51 k caracteres). [R34](./CONTINUIDAD_B_R34_G55_MARKER_Y_REFERENCIA_MOVILIDAD_2026-10-24.md) a [R43](./CONTINUIDAD_B_R43_BANDEJA_CASOS_COMERCIALES_ADMIN_2026-10-24.md). [Handoff B R3](./HANDOFF_MAESTRO_B_R3_CLIENTE_ADMIN_TOTAL_2026-10-23.md), [estado y contratos](./STATUS_Y_CONTRATOS.md) y anexos históricos permanecen accesibles.
- **AL PUBLICAR ESTE DOCUMENTO:** su commit será NUEVO HEAD B, diferente de \`0261878d\`; verificar **de nuevo** los tres workflows contra el SHA nuevo. No acreditar QA anterior al nuevo SHA.

## 01 · Alcance aprobado por Owner

Construir **Movete Fácil**, plataforma de movilidad y logística de Paraguay superior en seguridad, funcionalidad y experiencia a Bolt/Uber, con entregas comerciales inspiradas funcionalmente en PedidosYa pero **identidad, código, activos y diseño propios**. Prohibido copiar marca, recursos gráficos, interfaz exacta o precios/promociones ajenos. Funciones aprobadas:
1. Transporte de pasajeros en **automóvil**; categorías según elegibilidad, zonas y disponibilidad real, no GPS simulado.
2. **Envíos de paquetes** particulares en automóvil/motocicleta de carga.
3. Entregas de supermercados, farmacias **solo artículos autorizados sin receta (OTC)**, restaurantes y otros comercios.
4. Mensajería privada Cliente↔Driver/repartidor **asignado a un servicio activo**; contactos con tienda y soporte son canales **distintos**, que requieren autorización separada.
5. Dos apps móviles **independientes**, \`apps/movete-cliente\` y \`apps/movete-driver\`; Admin Web \`apps/movete-admin\` separado.
6. Autenticación y seguridad, GPS consentido, despacho transaccional, tarifas PYG/Gs diferenciadas por modalidad, comisiones/contabilidad, documentación centralizada privada de conductores, soporte/auditoría por roles y crecimiento por zonas.
7. **No permitir MOTO_PASSENGER** sin norma/seguro/aprobación; no introducir Teens, servicios regulados ni productos de farmacia con receta por copiar pantallas competidoras.
8. La infraestructura y lógica se construyen y certifican en QORE Mobile. **Lovable será principalmente interfaz final**, nunca sustituto de Node, PostgreSQL, RLS, Auth, Driver, despacho, dinero ni seguridad.
9. **Sin tope global de 50 registros**: 50/100 **por página o carrito** pueden proteger memoria/transporte, pero jamás equivalen a 50 clientes, pedidos, conductores o comercios en toda la plataforma.
10. **Cobertura ≠ disponibilidad**, borrador local ≠ solicitud enviada, subtotal ≠ precio final, prueba unitaria ≠ integración real, recibo QA ≠ operador avisado, ACK almacenado ≠ leído por destinatario.

## 02 · Gobierno de código y límites inalterables

**Arquitecto B PUEDE ESCRIBIR** exclusivamente:
- \`apps/movete-cliente/**\` — app Expo pasajero/comprador/remitente.
- \`apps/movete-admin/**\` — Admin Web React/Vite/TypeScript.
- \`docs/architect-b/**\` — QA, handoffs, contratos de consumo y trazabilidad B.

**Arquitecto A ES DUEÑO de:**
- \`apps/movete-driver/**\`, \`apps/mobility-expo/**\` (Node/OpenAPI/SQL), PostgreSQL/RLS/storage, infraestructura y contratos, GPS/despacho/precios, Auth JWT/MFA, KYC, chat backend, secretos, \`.github/**\`, root, CI global y \`docs/handoff/**\` de A.
- Leer archivos A y solicitar contrato por issue #9 **NO autoriza editarlos**. Evitar merge/rebase/force-push, ramas ajenas, auto-deploy, live DB, passwords/secretos, información real de usuarios y compras reales.
- PR #8 tiene base A, no \`main\`: verificar diferencias con cuidado. En escrituras GitHub siempre especificar rama B y blob SHA del archivo existente; jamás escribir en \`main\`.

**BLOQUEOS DE ORDEN OWNER (no de trabajo QA):** **NO MERGE, NO LIVE, NO DEPLOY, NO VPS, NO PSP, NO PUBLICACIÓN Android/iOS, NO DATOS/PII REALES** hasta orden explícita Owner. PRs en DRAFT y staging solo sintético. El pedido "avanza" permite desarrollo y certificación de laboratorio, **NO autoriza producción**.

## 03 · Inventario de lo construido en Cliente (legado B01–B31, sin rehacer)

### Aplicación y sesión
- Expo SDK 57, React Native, Expo Router, TypeScript/Node tests; rutas \`app/index.tsx\`, \`viaje.tsx\`, \`envios.tsx\`, \`seguimiento.tsx\`, \`historial.tsx\`, \`comercios.tsx\`, \`cotizacion.tsx\`, \`pagos.tsx\`, \`soporte.tsx\`, \`cuenta.tsx\`, \`mensajes.tsx\`, \`conversaciones.tsx\`.
- \`src/ClientRuntime.tsx\`, \`src/ClientUI.tsx\`, \`src/domain/client-experience.mjs\` y tipado; sesión Passenger en \`client-session.mjs\`; token revocable, revisión de privacidad, rotación de JWT, borrado de estado, remount de formularios privados; sin login efectivo sin proveedor.
- \`client-gateway.mjs\` y adaptadores HTTP con HTTPS origin pinned, JWT, gates múltiples, respuesta de bytes acotada, UTF-8, timeouts, AbortController, anti-replay y limpiado de estado ante 401/403 y cambios de cuenta.
- Mutaciones propias anti-doble toque: lock **antes del primer await**; \`requestKey\` UUID CSPRNG, reconciliar **misma clave + mismo cuerpo** tras timeout postcommit; no confirmar éxito con HTTP 200 genérico.
- Accesibilidad base, etiquetas, mensajes de estado, interfaz QA honesta. **TalkBack/VoiceOver y Android/iOS físicos aún pendientes**.

### Viajes, envíos, cotizaciones, seguimiento
- AUTO passenger: formulario origen/destino, validación/borrador seguro; **no post real**. Gate de viaje, posibilidad de cancelación idempotente del viaje propio, reconciliación 409/races.
- \`ServerPricedQuoteV1\`/G24: quote en guaraníes por backend, caducidad, versión, ruta y titular; no inventar precio/descuento/ETA. \`ride-status\` y \`rider-polling\`: snapshot versionado, GPS consentido/fresco, asignación/ETA solo con evidencia.
- AUTO/MOTO para **carga**: categorías, peso, dimensiones, mercancía permitida, formularios y harness QA; no activar transporte pasajero en moto.
- Historial \`history-feed\`/\`client-history-gateway\` y FlatList/cursor; ventana de memoria acotada (histórico 500), paginación sin techo global. Recuperación y filtros por identidad/servicio.
- Cobertura zona comprobada por backend **nunca implica** conductor disponible ni vehículo asignado.

### Comercio, dinero y soporte
- \`commerce-draft.mjs\`, \`commerce-catalog-flow.mjs\`, \`commerce-catalog-pages.mjs\`, \`g44-branch-directory.mjs\`, \`g44-buyer-contract.mjs\`, \`g45-order-qa-contract.mjs\`, carrito/version/TTL, sucursal, stock, precio server y límites de página. Carrito privado y **checkout/pagos OFF**; toda ejecución comercial precisa PG/stock idempotente y PSP autorizada.
- \`support-draft.mjs\`, \`support-draft-session.mjs\`, \`client-incident-intent.mjs\`, \`incident-g40-gateway.mjs\`, \`incident-report-flow.mjs\`. Incidentes QA con receipt estricto, sin SOS ni atención humana. No conectar soporte al chat Driver.
- \`app/pagos.tsx\`: pantalla honestamente OFF; **no banco, PSP o tarjeta real**.

## 04 · Inventario de Admin Web (legado B01–B31, sin rehacer)

- \`apps/movete-admin\` independiente, Vite + React/TypeScript. \`main.tsx\`, \`AdminRuntime.tsx\`, \`admin-experience.mjs\`, \`admin-session.mjs\` y \`admin-access.mjs\`, vistas Owner/Admin con MFA sujeto a proveedor real. Nunca incluir service-role en navegador.
- \`admin-read-gateway.mjs\`, \`bounded-json-response.mjs\`, \`page-cursor.mjs\`: solicitudes autorizadas con origen seguro, sesión/revisión, filtros/cursor, payload acotado y limpieza tras expiración/logout.
- KYC \`kyc-queue\`, \`kyc-page-view\`, borrador de revisión QA (no habilita conductores), centralización de documentos privados competencia A.
- Zonas/cobertura \`zone-overview.mjs\` sin disponibilidad falsa.
- Incidentes \`incidents-overview.mjs\`, \`incident-page-triage.mjs\`, G41 \`incident-g41-flow/gateway\`: cola, filtrado server-first y conteos de PÁGINA, sin SOS/atención confirmada.
- \`audit-feed.mjs\` alcance parcial G30, no auditoría universal; \`owner-finance.mjs\` ledger reconciliado PYG autorizado (no saldo bancario ni utilidad final ficticia).
- Formularios de práctica KYC son **100% sintéticos**, sin decisiones reales, suspensiones ni usuario real. Auth/MFA, PostgreSQL/RLS, acciones y aprobaciones siguen pendientes de A.

## 05 · Historia R1–R34 de mensajería y endurecimiento — completa por etapas

**R1–R5:** Buyer G44/G45, Cliente y Admin, autenticación/gates, catálogo paginado, transportes y controles fail-closed. Sin checkout comercial real.

**R6–R13:**
- R6 \`passenger-chat-flow.mjs\`, UI \`mensajes.tsx\`, actor Passenger/Driver asignado, RIDE/DELIVERY/MERCHANT_ORDER, mensaje seguro 1–500, requestKey/ACK validado; sin red LIVE.
- R7 cursor, memoria local chat hasta 500 por defecto, caducidad y revalidación al reintentar.
- R8 revocación de gates durante await, limpieza de borradores, hints push sin cuerpos/teléfonos; no push operativo.
- R9 ACK/colisión mensaje, expiración, timeouts, carreras con dos actores sintéticos.
- R10 \`passenger-chat-inbox.mjs\` y \`conversaciones.tsx\`: bandeja privada y paginación.
- R11 conteos no leídos completos, orden/cursores seguros; R12 offline no autoriza chat stale; R13 pin \`expectedConversationId\`, anti-hilo manipulado, desmontar borrador por identidad. Handoff completo [R1–R13](./HANDOFF_MAESTRO_ARQUITECTO_B_R1_R13_TOTAL_Y_CONTINUIDAD_2026-10-23.md).

**R14–R27:**
- R14 TTL/cursor/frescura; R15 reasignación/rotación JWT durante ACK; R16 rollback de revisión, R17 ACK serverStored modifica high-water y descarta cursor anterior.
- R18 purga real de cuerpos de mensajes tras TTL, incluso pending; R19 \`FlatList\` virtualizado, R20 pruebas de ventana/memoria.
- R21 separar metadata de autorización de cuerpos privados duplicados; R22 orden newest-first y páginas previas, R23 borrar draft al cambiar hilo autorizado.
- R24 recuperar envío ambiguo en conversación anterior, reintentar MISMA key; R25 gateway G51 Inbox HTTPS opt-in, R26 endurecer límite de bytes/JWT/cursor/stream, R27 composición Gateway→Flow y varias páginas sin límite total de mensajes.
- Referencias: [R14](./CONTINUIDAD_B_R14_CHAT_TTL_CURSOR_FRESHNESS_2026-10-23.md), [R18–R20](./CONTINUIDAD_B_R18_R20_CHAT_PRIVACIDAD_LISTA_Y_CURSOR_2026-10-23.md), [R24](./CONTINUIDAD_B_R24_RECUPERACION_CHAT_PENDIENTE_2026-10-23.md), [R26–R27](./CONTINUIDAD_B_R26_R27_G51_SEGURIDAD_HTTP_PAGINACION_2026-10-23.md).

**R28–R34:**
- R28 GET G52 historial autorizado con HTTPS/DTO rígido y cursor, R29 pin \`conversationId\` al paginar; R30 separar lectura certificada de \`sendReady\`; R31 POST G53 con idempotencia y ACK exacto; R32 nunca marcar leído por GET, ausencia de "99+" falsa, R33 revocación cruzada y purga al reasignar Driver.
- R34 \`g55-chat-read-marker.mjs\` y tests: marcador G55 solo en DOMINIO QA, sin UI nativa ni POST real; requiere evidencia de mensaje del Driver visible, hilo/actor/TTL y ACK readConfirmed. **No fabricar throughSeq desde índices/timestamps ni marcar leído por GET**. [R34 técnico](./CONTINUIDAD_B_R34_G55_MARKER_Y_REFERENCIA_MOVILIDAD_2026-10-24.md).
- Mensajería G51–G58 sigue **QA-only/x-qore-runtime-wired:false** en último OpenAPI revisado. El chat de Driver es de contraparte ASIGNADA; nunca reutilizar para agente/comercio.

## 06 · Historia R35–R43: todos los trabajos de esta continuidad actual (24-oct)

| Corte | Código real y funcionalidad | Límites seguros y documentación |
|---|---|---|
| **R35** | \`client-route-editor.mjs\`, \`.d.mts\`, tests; \`app/viaje.tsx\`: invertir origen/destino, añadir/borrar/ordenar hasta 8 paradas **por borrador RAM**, validación duplicados/bidi/control, remount sesión | Backend actual rideRequest solo origen/destino; **multiparada jamás se prepara ni cotiza o despacha**. [R35](./CONTINUIDAD_B_R35_EDITOR_RUTA_PARADAS_QA_2026-10-24.md). |
| **R36** | \`ClientRuntime.tsx\` simpleMode RAM, \`ClientUI.tsx\` Action large, \`app/index.tsx\` inicio de accesos esenciales y \`app/cuenta.tsx\` toggle | Accesibilidad parcial, no persistida ni TalkBack nativo; no amplía permisos. [R36](./CONTINUIDAD_B_R36_MODO_SIMPLE_ACCESIBLE_2026-10-24.md). |
| **R37** | \`commerce-storefront.mjs\`, tipos/tests, \`app/comercios.tsx\`: 5 rubros SUPERMARKET/PHARMACY/RESTAURANT/RETAIL/OTHER, cuadrícula, búsqueda normalizada solo sobre página verificada, filtro de sucursales por rubro y limpieza al cambiar sesión | Sin promociones, stock, ETA, ofertas inventados; filtrado en página NO reemplaza filtro servidor; checkout OFF. [R37](./CONTINUIDAD_B_R37_TIENDA_MULTIRRUBRO_PEDIDOS_REFERENCIA_2026-10-24.md). |
| **R38** | \`commerce-checkout-review.mjs\`, tipos y tests, UI desglose carrito/verificación de stock, precio, versión, TTL, duplicados y subtotal PYG | \`deliveryFeePyg/discountPyg/finalTotalPyg=null\`, \`checkoutEnabled=false\`, \`orderConfirmed=false\`; no pedido/transacción. [R38](./CONTINUIDAD_B_R38_REVISION_CARRITO_CERTIFICADA_LOCAL_2026-10-24.md). |
| **R39** | \`commerce-substitution-draft.mjs\`, tipos/tests, UI: por artículo \`OMIT_IF_UNAVAILABLE\` o \`ASK_BEFORE_SUBSTITUTING\`, consentimiento por ítem y limpieza por cambios catálogo/cuenta/JWT/carrito | No contacto ni reemplazo autorizado; no POST; rubro nuevo descarta carrito anterior. [R39](./CONTINUIDAD_B_R39_PREFERENCIAS_SUSTITUCIONES_2026-10-24.md). |
| **R40** | \`merchant-support-guide.mjs\`, tipos/tests, \`app/soporte.tsx\`: guía con ID UUID de pedido, motivos faltante/equivocado/daño/demora/precio/seguridad, categoría G40 y gravedad explícita | Guía **solo local**, no es caso ni contacto/SOS ni prueba de titularidad. [R40](./CONTINUIDAD_B_R40_ASISTENCIA_PEDIDOS_COMERCIALES_2026-10-24.md). |
| **R41** | \`g40-incident-status-view.mjs\`, tipos/tests y Soporte: presentar estados QA únicamente con receipt/autorización/TTL **<45 s**, ocultar estado caduco, refresco G40 existente | \`triaged/investigating/resolved\` de QA no acreditan operador ni resolución humana. [R41](./CONTINUIDAD_B_R41_ESTADOS_INCIDENTES_QA_FRESHNESS_2026-10-24.md). |
| **R42** | \`merchant-contact-preference.mjs\`, tipos/tests, Soporte: preferir MERCHANT o SUPPORT, consentimiento explícito/revocable, TTL 10 min, limpieza JWT, categoría/caso | DISPUTE/SAFETY solo SUPPORT; **NO mensajes/red**. Canal distinto del chat Driver. [R42](./CONTINUIDAD_B_R42_PREFERENCIA_CONTACTO_COMERCIOS_SOPORTE_2026-10-24.md). |
| **R43** | **Admin** \`merchant-case-page.mjs\`, \`.d.mts\`, **12 tests**, \`admin-experience.mjs/.d.mts\`, \`main.tsx\`: bandeja separada de casos \`MERCHANT_ORDER\`, permisos Admin/MFA, TTL/cursor, sin PII y orden estable | \`merchantCases:null\`, \`merchantCaseContractReady:false\` hasta endpoint A, 50 por página NO tope global. [R43](./CONTINUIDAD_B_R43_BANDEJA_CASOS_COMERCIALES_ADMIN_2026-10-24.md). |

**Correcciones de este relevo en CI:** R38 un tipo obsoleto nullable de catálogo; R40 validador de UUID y expectativas de prueba; R41 TypeScript declaró estado G40 demasiado estrecho y se mantuvo validación runtime; R43 empate de orden por caseId requería actualizar prueba. **Cada corrección fue versionada y luego revalidada 3/3**; mantener regresiones. Los datos de referencia de Bolt Driver/Bolt Cliente/Uber Cliente y comercio PedidosYa se tradujeron a requerimientos propios en issues #10/#11/#12, sin copiar assets ni usar precios competitivos como tarifas reales.

## 07 · Qué significa CERTIFICADO y qué NO

**Certificado en HEAD B R43:** 640 tests Cliente, 197 tests Admin, 51 tests Driver PASS; TypeScript, Vite, Expo export web y ownership/isolación 3/3 SUCCESS. **NO CERTIFICADO:** uso real de smartphones Android/iOS, descargas APK/IPA, login JWT proveedor, comunicación física Driver, correo, SMS, backend HTTP STAGING efectivamente accesible, PostgreSQL con usuarios reales, stock transaccional, PSP/ledger productivo, geolocalización/dispatch físico, soporte con operador, SOS y app publicada.
**Regla:** HTTP 200 sin recibo tipado ≠ acción confirmada; backend OpenAPI “existe” ≠ \`x-qore-runtime-wired:true\`; prueba con dos actores sintéticos ≠ un E2E contra cuentas reales; export web ≠ app nativa firmada; cobertura zona ≠ conductor en línea.

## 08 · Pendientes del Arquitecto A: bloqueos reales de integración

**A P0 / Auth-Infra:** JWT/JWKS y revocación/refresh, Passenger/Driver/Admin/Owner, MFA Admin, RLS multiidentidad, HTTPS STAGING pinning, PostgreSQL persistente con migraciones/backups/restore, manejo de secretos y audit de accesos. Prueba positiva/negativa dos cuentas reales de STAGING sintético.
**A P0 / viajes:** despacho/aceptación atómicos (dos conductores compitiendo), GPS fresco/consentido, rutas/geocoding reales, cobertura vs disponibilidad, estados monotónicos y cancelación/recuperación de timeouts. ServerPricedQuoteV1 PYG, tarifa AUTO vs MOTO carga, expiración, descuentos y ETA verificables.
**A P0 / multiparada R35:** contrato versionado del orden de puntos, geocoding, geofence, quote con TTL y server-authoritative reprice, trip request idempotente multi-stop. Mientras falte mantener botones de contratación OFF para stops.
**A P0 / chat G51–G58:** conversación autorizada por asignación Passenger↔Driver, mensajes PostgreSQL, lectura/escritura idempotente, ACK, cursor firmado, TTL, secure read markers con \`expectedConversationId\`, revocación al reasignar Driver, receptor Driver real y notificaciones push sin PII. Aún \`x-qore-runtime-wired:false\` observado.
**A P0 / marketplace:** directorio de sucursales por municipio/rubro filtrado EN SERVIDOR, catálogos/version/stock/TTL/paginación, carrito/pedidos atomizados en PostgreSQL, sustituciones por consentimiento, reprice, delivery quote final Gs, cancelación/reembolso, OTP/POD cuando sea pertinente, despacho repartidor y soporte del comercio.
**A P0 / canales soporte y casos R40–R43:** endpoint explícito \`MERCHANT_ORDER\` con pertenencia JWT, Admin/MFA/RLS, cursor y TTL; no reciclar cola genérica \`OTHER\`. Canal distinto Cliente↔comercio y Cliente↔soporte, consentimiento persistido/revocable, IDs y ACK duraderos, operador real/asignación auditada, estados con significado acordado, gestión de fraudes, PII y retención. **Nunca marcar caseCreated/operatorNotified/contactSent/SOS por un dato local**.
**A P0 / Driver-KYC:** documentación en DB + storage privado cifrado, vencimientos licencia/seguro/vehículo, upload AV/MIME/hash, autorizaciones temporales, Driver Expo separado, onboarding y elegibilidad, bloqueo de documentos inválidos.
**A P0 / Admin:** MFA/RBAC operativo, KYC decisiones con RLS+audit, zonas y disponibilidad, finanzas reconciliadas, G41 filtro global ANTES de paginar, soporte real y sistema de incidencias con seguridad independiente.
**A P0 / dinero:** PSP con mandato explícito Owner, comisiones, liquidación conductor y comercio, conciliación, reembolsos, fiscalidad/regulación Paraguay. Sin PSP ni cargos en STAGING sin aprobación.
**A P0 / operación:** observabilidad, alertas, privacidad y retención, rate-limit, RTO/RPO, restauración, monitoreo GPS/fraude, legales, QA de campo; preparación de Android/iOS/tiendas solo tras gates y Owner.

## 09 · Pendientes del Arquitecto B: orden concreto para R44 en adelante

**R44-P0 · Primero hacer trabajo REAL en código sin invadir A:** 
1. Leer HEAD B/A, OpenAPI y los módulos \`merchant-case-page.mjs\`, \`incident-g41-flow.mjs\`, \`admin-experience.mjs\`, \`main.tsx\` y pruebas. **No crear POST ficticio ni conectar a cola de incidentes genérica**.
2. Implementar en B un **control de coherencia del estado de casos comerciales QA** solo si hay DTO autorizado: evitar refresh obsoleto o scope incorrecto, mostrar TTL y revisiones; proyectar estados SOLO QA. Añadir casos negativos de JWT rotado, permisos revocados, cambio de filtro/página, rollback de revisión y respuesta tardía. No activar \`merchantCaseContractReady\` sin contrato A.
3. Mejorar accesibilidad real del Admin Web y flujos Cliente desde R35–R43: foco/teclado, lectura de mensajes de error, botones accesibles, tamaño grande, referencias correctas, ninguna PII en logs. Probar TypeScript, Vite y tests.
4. Registrar contratos pendientes en issue #9 y pasar a otro módulo B si A sigue sin API. **No quedarse esperando un workflow si se puede programar QA independiente**, pero verificar 3/3 al cerrar cada HEAD.

**B P1 / integración cuando A entregue evidencia:** añadir gateway Cliente/Admin opt-in, configurar runtime solo con URLs HTTPS pinned/JWT/roles/TTL comprobados; R35 multiparada; commerce G44/G45 con checkout server-priced; G51–G58 inbox/historial/mensajes y lectura visible; soporte/tickets reales. Comprometer código sin activar LIVE.
**B P1 / UX:** navegación mapas/selección AUTO, preparación de cotización/ETA real, promociones verificadas, historial/favoritos, onboarding accesible, pedidos/comercio y feedback de repartidores; UI original. Probar con usuarios sintéticos, leer estado servidor, no inventar tarifas/disponibilidad.
**B P1 / seguridad:** pruebas cruzadas Passenger/Driver/Admin/Owner, 401/403/logout/JWT refresh, deadlocks, cuerpos/cursor en memoria, borrado de drafts al modificar asignación o cambiar cuenta, pruebas offline/replay.
**B P1 / Native:** Expo dispositivo Android e iOS (permisos, background/foreground, TalkBack/VoiceOver, push, notificación, App Links/Deep Links, mapas reales cuando A disponga), builds firmadas solo por orden Owner.
**B P2 / Lovable:** preparar guía visual, componentes accesibles, catálogos y navegación final con marca propia una vez infraestructura y endpoints íntegros; Lovable solo UI final.
**B P2 / liberación:** evidencia E2E full-stack STAGING con dos usuarios y roles, contratos reales, conteos de casos/viajes de verdad; pruebas de carga y privacidad, revisión legal, despliegue autorizado y rollback. Nunca inferir producción de un "ci green".

## 10 · Riesgos y definiciones que NO se pueden perder

1. **Seguridad personal:** SOS y llamada a operadores reales son servicios distintos de G40 QA; no crear sensación falsa de auxilio. Problema de seguridad debe derivarse a canales reales oficiales si existe peligro inmediato.
2. **Canales:** Chat Cliente↔Driver SOLO con asignación activa y actor/contra-parte autorizados. MERCHANT y SUPPORT necesitan conversaciones y política distintas; R42 NO es mensajería.
3. **Identidad:** trust boundary en backend A, no un booleano React. La rotación JWT y cierre de sesión purgan estado privado; no compartir usuario anterior.
4. **Dinero e inventario:** nunca calcular precio final ni reserva real desde snapshot UI. Emisión server, TTL, stock atómico, idempotencia, compensación/reembolso y ledger.
5. **Paginación:** límites por respuesta no son cuota global. Cursor/TTL/anti-replay más ventana RAM limitada.
6. **Farmacias:** OTC sin receta bajo política y legalidad; nada controlado o de receta sin decisión legal y sanitaria.
7. **Datos:** staging solo sintético; documentos Driver centrales y secretos fuera de frontend; no clonar a GitHub datos privados de capturas competidoras.
8. **Mapa/UX:** disponibilidad real, ETA y promociones requieren evidencia server; no copiar propiedad intelectual Bolt/Uber/PedidosYa.
9. **A/B:** tocar solo propiedad B; A y B paralelos no hacen merge cruzado sin aprobación; cuestiones en issue #9.
10. **El Owner pidió plataforma REAL:** no llamar finalizada ni ready-to-go a los QA drafts; diseñar para operación real, integrar cuando A certifique.

## 11 · Método operativo continuo, por cada siguiente hito

1. Leer este documento, [Handoff anterior R1–R33](./HANDOFF_MAESTRO_INTEGRAL_B_R1_R33_G55_CONTINUIDAD_AUTONOMA_2026-10-24.md), R34–R43 aplicables, HEAD PR #7/#8 y OpenAPI. **Verificar primero si otro arquitecto modificó archivo o contrato**.
2. Elegir el siguiente módulo propio B que aporte código útil y no dependa de LIVE; preferir R44 en Admin, luego UX/seguridad Cliente. No repetir issues/documentación si se puede implementar.
3. Establecer contratos y entradas no confiables; gates OFF por defecto; agregar pruebas positivas, negativas, límites y carreras; verificar que errores no filtren PII.
4. Crear commits en rama B para archivos propios, con blob SHA actualizado; todos los PR continúan DRAFT.
5. Confirmar **exactamente para el SHA final**: a) ownership B, b) Admin Web QA, c) two-app isolation (Cliente, Driver, TypeScript, Expo WEB). Leer \`status=completed\`, \`conclusion=success\`, jobs y logs. Si falla, diagnosticar y corregir; un nuevo commit exige otra ejecución.
6. Comunicar contratos a A por issue #9, y dejar comentario de avance en issue #11. Jamás llamar "certificado" a un SHA con CI aún in_progress.
7. Añadir documentación/handoff incremental claro con archivos, correcciones, pruebas y pendientes, para que el siguiente chat retome sin reiniciar. **El commit documental también dispara CI**.
8. Si A no tiene API: seguir frontend, validadores, Admin UI, accesibilidad y tests adversariales. **Solo detenerse por bloqueo técnico real, prohibición Owner o amenaza a datos**, no por falta de una respuesta de A ni por estar esperando CI.
9. Nunca prometer trabajo en segundo plano ni publicar app sin autorización. La rama y GitHub son estado persistente.

## 12 · Texto listo para abrir el próximo chat (copiar y ejecutar)

> **Actúa como el siguiente Arquitecto B de QORE Mobile / Movete Fácil. Repositorio mezas3238-hue/Qore-mobile-, PR #8 DRAFT, rama feature/mobility-cliente-admin-parallel-20261022, base rama A PR #7. Lee inmediatamente docs/architect-b/HANDOFF_MAESTRO_INTEGRAL_B_R1_R43_CONTINUIDAD_AUTONOMA_2026-10-24.md y el maestro histórico R1–R33, además de los docs R34–R43. Verifica HEAD A/B actual, OpenAPI y 3/3 CI del commit de este handoff. Continúa el desarrollo desde R44: implementación real de código, pruebas adversariales, TypeScript/build, commits y docs en archivos propiedad B. El backend y Driver son propiedad A; no los edites. Si falta una API, documenta dependencia en issue #9 y sigue con trabajo B independiente, sin pausas salvo bloqueo real. Mantén PR #8 DRAFT, NO MERGE, NO LIVE, NO DEPLOY, NO PSP, NO datos reales sin mandato expreso del Owner. No confundas una prueba QA con app lista para operar. Reporta archivos/SHAs/runs verificables.**
