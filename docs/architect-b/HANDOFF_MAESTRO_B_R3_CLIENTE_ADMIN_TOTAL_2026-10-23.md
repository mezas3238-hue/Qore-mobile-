# QORE MOBILE / MOVETE FÁCIL — HANDOFF MAESTRO R3
## Arquitecto B · Cliente (pasajero), Admin Web, trazabilidad integral y continuidad sin pausas

**Fecha:** viernes 23 de octubre de 2026, Paraguay.
**Orden del Owner:** el siguiente arquitecto debe **continuar el desarrollo inmediatamente, sin detenerse salvo BLOQUEO REAL**. No empezar desde cero ni pedir autorización en cada commit ordinario de QA. Mantener las prohibiciones sobre merge, producción, dinero y datos reales.
**Repositorio soberano:** https://github.com/mezas3238-hue/Qore-mobile-
**Arquitecto B:** rama feature/mobility-cliente-admin-parallel-20261022 · PR #8 https://github.com/mezas3238-hue/Qore-mobile-/pull/8 · DRAFT, sin merge.
**Último HEAD B verificado ANTES de crear R3:** 515d9fdc8e4aa32f356cb96b768cd0feb6ee85bb.
**Arquitecto A:** rama feature/mobility-monorepo-isolated-20261016 · PR #7 https://github.com/mezas3238-hue/Qore-mobile-/pull/7 · DRAFT, sin merge.
**Último HEAD A observado:** 165997ec4a3f353c608d503c9006dc472701a58a. Puede cambiar simultáneamente.
**El PR #8 tiene como BASE la rama de A**, no main; no rebase/merge o force-push unilateral.
**Coordinación A/B:** https://github.com/mezas3238-hue/Qore-mobile-/issues/9
**OpenAPI A:** apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json; versión verificada 1.0.0-g41 (48 paths), aún contratos solo QA.
**Trazabilidad COMPLETA:** [Anexo con los 153 commits históricos de PR #8](./HANDOFF_R3_ANEXO_153_COMMITS_2026-10-23.md). Al publicar este R3 habrá un nuevo commit adicional; el número 153 se refiere al corte técnico ANTERIOR al handoff.
**Documentación precedente que se conserva:**
- [Handoff histórico extenso Cliente/Admin](./HANDOFF_MAESTRO_INTEGRAL_ARQUITECTO_B_CLIENTE_ADMIN_CONTINUIDAD_2026-10-23.md)
- [Handoff R2](./HANDOFF_MAESTRO_B_R2_CLIENTE_ADMIN_CONTINUIDAD_2026-10-23.md)
- [Handoff de cierre anterior](./HANDOFF_MAESTRO_B_CIERRE_Y_CONTINUIDAD_2026-10-23.md)
- [STATUS_Y_CONTRATOS](./STATUS_Y_CONTRATOS.md)

> **ATENCIÓN:** Los tres handoffs anteriores tienen fechas, SHAs y conteos históricos. Este R3 es el corte de continuidad más reciente. Para el estado ACTUAL releer GitHub, PR #7/#8, las Actions y el OpenAPI al iniciar el nuevo chat.

---

## 1. RESUMEN EJECUTIVO DE HECHOS VERIFICADOS

| Tema | Corte técnico previo al handoff |
|---|---|
| PR B #8 | DRAFT, unmerged; 153 commits, 181 archivos cambiados, 13.579 adiciones y 85 eliminaciones reportadas por GitHub antes de R3 |
| HEAD B | 515d9fdc8e4aa32f356cb96b768cd0feb6ee85bb |
| PR A #7 | DRAFT, unmerged; HEAD 165997ec4a3f353c608d503c9006dc472701a58a |
| Cliente independiente | 313/313 tests PASS, cero FAIL, TypeScript y Expo web export SUCCESS |
| Admin Web independiente | 180/180 PASS, cero FAIL, TypeScript y Vite build SUCCESS |
| Suite total Cliente + Admin | **493/493 PASS, 0 FAIL** (Driver tiene checks independientes, no sumar números inexistentes) |
| CI de aislamiento | Driver typecheck/export SUCCESS, dos apps aisladas SUCCESS |
| CI de propiedad | SUCCESS; cambios dentro de apps/movete-cliente, apps/movete-admin y docs/architect-b |
| Estado workflow | 3/3 SUCCESS en el HEAD B técnico previo a R3 |
| Backend | Contratos simulados, QA y documentación. G40/G41 marcados x-qore-runtime-wired=false; NO concluir disponibilidad real |
| Pagos, SOS, incidentes reales, marketplaces, dispatch, GPS real, tiendas móviles | **NO certificados / NO operativos**, no están autorizados LIVE |

**Evidencia Actions exacta del HEAD B anterior a R3:**
- [Cliente + Driver + aislamiento, run #39988751442](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39988751442): SUCCESS, 313/313 Cliente, TypeScript y Expo web export; Driver typecheck/export SUCCESS y aislamiento SUCCESS.
- [Admin Web, run #39988751619](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39988751619): SUCCESS, 180/180 Admin, TypeScript y Vite build.
- [Arquitecto B ownership, run #39988751519](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39988751519): SUCCESS.
- **Acción posterior obligatoria:** el commit de esta documentación cambia HEAD; volver a verificar 3/3 workflows de su SHA. Nunca adjudicar el CI viejo al SHA nuevo.

**Qué significa y qué NO significa:** Son pruebas unitarias, sintéticas, contratos y exportación web; NO son certificación nativa Android/iOS, E2E multiusuario con JWT real, procesamiento financiero, despacho de viajes, emergencias, ni app pública funcionando.

## 2. MANDATOS INALTERABLES DEL OWNER

1. Marca y mercado: **Movete Fácil**, movilidad y logística en Paraguay con activación por zonas; experiencia competitiva con Bolt/Uber y tarifas diferenciadas.
2. **Dos apps móviles completamente distintas:** apps/movete-cliente para pasajero/comprador/remitente y apps/movete-driver para conductor/repartidor. No fusionarlas. **Admin** en apps/movete-admin es una web aparte.
3. Viajes de pasajeros en AUTO. Servicios de carga/envíos particulares en AUTO/MOTO y entregas de supermercados, restaurantes, farmacias OTC sin receta y otros comercios habilitados. MOTO_PASSENGER bloqueado mientras falten normativa/seguros y autorización.
4. Todos los registros de usuarios, vehículos, zonas, viajes, pedidos, incidentes y documentos deben escalar: **50/100 por respuesta es tamaño de página, jamás tope global de registros**. No prometer cardinalidad ilimitada de DB sin probar infraestructura.
5. Cobertura de una zona != conductor disponible, aceptación, ETA, asignación ni seguridad. No inventar posicionamiento GPS, nombres/placas, tarifas ni pedidos.
6. Tarifas, distancias, descuentos, promociones, stock, comisiones, impuestos y cobros **autoridad del servidor**, siempre PYG/Gs para dinero del Paraguay; no usar estimado UI como precio final.
7. KYC/documentación conductor central y privada del backend. Driver captura documentación, Admin autorizado examina metadatos/evidencias, sin documentos en frontend ni storage público.
8. Lovable aporta principalmente **interfaz visual final**, nunca backend, auth/RLS, motor de despachos, tarifas ni dinero.
9. GitHub es fuente de verdad; nunca mezclar con qore-core trading, Trader Lab o VPS.
10. **NO MERGE, NO LIVE, NO DEPLOY, NO tiendas, NO PSP/pagos reales, NO PII real, NO producción ni secretos** sin orden Owner. QA/STAGING con datos sintéticos únicamente.
11. PRs de A/B continúan DRAFT. Al detectar contrato faltante, registrarlo en issue #9 y pasar inmediatamente a otro trabajo seguro de B.

## 3. PROPIEDAD DE ARCHIVOS — NO PISARSE A/B

**B sí puede editar/commitear:**
- apps/movete-cliente/**
- apps/movete-admin/**
- docs/architect-b/**

**A es propietario (B NO editar):**
- apps/movete-driver/**, apps/mobility-expo/** y backend/API STAGING
- SQL/Postgres/migraciones, storage/KYC documental, Auth/JWT/RLS/MFA, dispatch, motor tarifas, comisiones, PSP, servicios comerciales
- .github/**, scripts/lockfiles de raíz, configuración CI global, docs/architecture/** y docs/handoff/**

**Procedimiento Git:** Leer HEAD de PR #8, árbol/commit SHA, hacer commit con parent EXACTO, actualizar ref con expected_sha como lease, nunca force. Si cambió HEAD, reevaluar y reconciliar. Mantener ownership check verde. PR #8 se basa en rama A; no introducir commit de A en B de modo unilateral.

## 4. INVENTARIO DE CLIENTE YA CONSTRUIDO — NO REHACER

### 4.1 Estructura y pantallas de la app del pasajero
- App Expo / React Native / Expo Router, paquete independiente y compilación web Expo. Vistas Inicio, Viaje AUTO, Envíos de carga AUTO/MOTO, Comercios, Cotización, Seguimiento, Historial, Cuenta, Pagos/recibos y Soporte.
- `src/ClientRuntime.tsx`, `src/ClientUI.tsx` y `src/domain/client-experience.mjs` concentran identidad/presentación pública, listeners, snapshots, limpieza de sesión y acciones privadas sin unirse a Driver.
- Base de accesibilidad en `CLIENT_ACCESSIBILITY_FOUNDATION_2026-10-23.md`: etiquetas/hints, botones táctiles y estructura; falta audit manual con lectores de pantalla/dispositivos.
- `client-session.mjs`: Passenger, token efímero no serializado, revocación, TTL, cambio de token/rol/cuenta; `privateViewRevision` fuerza remontar formularios de viaje, envíos y soporte.
- `client-gateway.mjs`: HTTPS pinned, JWT inyectado, rutas y operaciones whitelisted, triple gate de contrato explícito, validación DTO/HTTP, tiempos, 401/403/409/429/503, sin mutación real por defecto.
- `client-mutations.mjs`: requestKey UUIDv4 segura, preparación immutable de mutaciones, control de doble toque/race **antes del await**, retry con misma clave, incertidumbre tras timeout/409, no segundo viaje/entrega con otra key sin conciliación.
- `client-request-preparation.mjs`: formularios revisados de AUTO Económico/Confort/XL y envíos por MOTO/AUTO de carga; categorías DOCUMENTS/PARCEL/GROCERIES/RESTAURANT/PHARMACY_OTC, pesos/dimensiones y restricciones. Sin despachar.
- `quote-view.mjs`, `fare-quote-gateway.mjs`, `fare-quote-flow.mjs`: cotización server-priced PYG G7/G24, revisión/version/TTL, viaje propio, aceptaciones seguras, sin calcular dinero local ni declarar pago.
- `rider-status.mjs`, `rider-polling.mjs`, `ride-status-gateway.mjs`: seguimiento propio por revision y estado, GPS/ETA únicamente con señales explícitas frescas, conductor/placa tras asignación persistida, purga tras desconexión/expiración/rotación. Todavía no validación nativa GPS en calle.
- `ride-cancellation.mjs` y `secure-cancel-key.mjs`: cancelación idempotente; confirmación UI con UUID OS; retry misma clave y nueva consulta status autoritativo después de ACK; no reembolso estimado.
- `client-history-gateway.mjs`, `history-feed.mjs`, vista `historial.tsx`: cursor HMAC de A por cabecera, propietario, TTL, revisión, composite key kind:serviceId, virtualización y ventana de memoria; múltiples páginas, **no 50 registros globales**.
- `support-draft.mjs`, `support-draft-session.mjs`, `soporte.tsx`: borrador voluntario **LOCAL** de soporte con límites y heurísticas que rechazan datos sensibles habituales; sin storage persistente/red y sin SOS. Borrado por sesión/logout, no afirmar filtrado perfecto de PII.
- `response-bytes.mjs`, `bounded-http-response.mjs`: UTF-8 compatible con Hermes, lector incremental con límite de bytes, abort/read cancel, reject JSON inválido y respuestas tardías; aplicado a historia/GPS/quote/cancelaciones/solicitudes. **Fallback sin stream usa text() antes de comprobar tamaño** y no garantiza límite de memoria previo.
- `SAFE_AUTO_UI_JOURNEY_HARNESS_2026-10-23.md` y `SAFE_DELIVERY_UI_JOURNEY_HARNESS_2026-10-23.md`: recorridos sintéticos sin negocio real.

### 4.2 Incidentes G40 — implementados PERO desconectados
- Código `incident-g40-gateway.mjs`: POST /v1/staging/safety/incidents/report y GET /v1/staging/safety/incidents/{incidentId}/status; DTO tipado de 5 campos, receipt 7 campos con `RECEIVED_IN_QA_DATABASE_ONLY`. HTTPS pinned, JWT Passenger, estado/version, triple gate y bounded JSON.
- Código `incident-report-flow.mjs`, integrado a `client-experience.mjs`: preparar/enviar/reintentar/consultar estado/descartar SOLO si no enviado. Conservar requestKey en timeout; no duplicar caso, ni mostrar ACK de JWT antiguo.
- `client-incident-intent.mjs`, UI `soporte.tsx`: elección RIDE/DELIVERY/MERCHANT_ORDER, motivo SAFETY/LOSS/DISPUTE/FRAUD/QUALITY, gravedad LOW/MEDIUM/HIGH; UUIDv4 Expo Crypto; sección estructurada visible solo si `incidentReport.contractReady` es real. No CRITICAL/SOS ni detalles libres.
- **Realidad:** OpenAPI A g41 declara `x-qore-runtime-wired=false`, `x-qore-qa-only=true`. Estado por defecto inactivo. Un recibo "QA database only" NO significa atención humana, emergencia ni llamado SOS.

### 4.3 Comercios, catálogo, carrito y futuro checkout
- `commerce-draft.mjs`: proyección de catálogo versionado y TTL, sucursal UUID, tags, class GENERAL/PHARMACY_OTC, precios PYG y stock reportado; carrito LOCAL máximo 50 líneas como protección UI (no máximo global productos), cantidad 1..999 según stock.
- Cálculo local únicamente de **subtotal estimado** para los artículos del snapshot. `finalTotalPyg=null`; no PSP, pago ni stock reservado. Revisión cambiada/precio/stock cambiado invalida compras hasta revalidar.
- `commerce-catalog-flow.mjs`, integrado a `client-experience.mjs`: lector de catálogo inyectado con triple gate, identidad Passenger minimizada, revocación/logout, cambios de cantidad/vehículo, preview expresamente `submissionAllowed=false`. No hay URL ficticia.
- `app/comercios.tsx` y `catalog-branch-lookup.mjs`: pantalla de artículos autorizados, actualizar stock/precios, código UUID técnico de sucursal, MOTO/AUTO carga y subtotal. **Sección no aparece sin catálogo real certificado**; compra final bloqueada.
- `commerce-catalog-pages.mjs`: pager INDEPENDIENTE de catálogo comprador con cursor opaco, página visible 100, navegación anterior/siguiente y hasta 130 páginas / 13.000 ítems en QA sintética sin tope global. Consistencia `branchId/version/expiresAt`, evita mezcla de sucursales/sesiones, sin guardar antiguas páginas de precios y sin doble consulta mientras identidad se carga.
- **MUY IMPORTANTE:** el pager multi-página todavía NO está integrado al carrito/UX. El carrito actual opera sobre **una respuesta de una sucursal**. El backend A g41 no tiene GET Buyer catálogos/sucursales ni contrato de checkout atómico. No inventar endpoints, inventario, geocoding ni pedidos.

## 5. INVENTARIO DE ADMIN WEB YA CONSTRUIDO — NO REHACER

- App React/TypeScript/Vite independiente `apps/movete-admin`, proyecto distinto de Cliente y Driver. Admin y Owner tienen roles con superficies separadas.
- `admin-session.mjs`, `admin-experience.mjs`, `AdminRuntime`: identidad efímera con MFA declarado, Auth revision, caducidad y purga de datos ante logout/JWT rotado; ninguna credencial service_role en browser.
- `admin-read-gateway.mjs`: contrato de cinco GET A05 (KYC metadata, zonas, incidentes, auditoría parcial, Owner finance) con pinned HTTPS, whitelist, JWT/MFA, cursor opaco, limite 50 por página, 401/403/429/503 y fail closed. `bounded-json-response.mjs` lee stream acotado en bytes.
- KYC: `kyc-queue.mjs`, `kyc-page-view.mjs`, UI de colas y filtros. Documentación válida NO habilita conductor automáticamente. No mostrar fotos/identificadores personales sin autorización real.
- Zonas: AUTO_RIDE/AUTO_DELIVERY/MOTO_DELIVERY, cobertura != oferta/densidad de conductores, TTL/revisión.
- Finanzas Owner: PYG reconciliado y revisión contable solo si backend verifica rol; nunca saldos bancarios ni cobros inventados.
- Auditoría G30: proyección **parcial** de algunos eventos de vehículos/incidentes/suspensiones, no bitácora universal de plataforma.
- `incidents-overview.mjs`, `incident-page-triage.mjs`: prioridades/filtros **solo sobre página visible** A05, conteos "esta página", privacidad y no SOS.
- G41: `incident-g41-gateway.mjs` filtra gravedad/estado EN SERVIDOR antes de paginar, usa tokens/cursor firmado propuesto y exige JWT Admin MFA; `incident-g41-flow.mjs` coordina páginas y filtros ligados a sesión; AdminRuntime y `main.tsx` muestran panel G41 solo si CERTIFICADO. Botones anterior/siguiente, anclas de cursor en memoria, sin registros anteriores persistentes ni total global imaginario.
- **Realidad:** G41 tiene `x-qore-runtime-wired=false` en OpenAPI A, por lo tanto NO se muestran consultas globales reales. A05 asimismo documenta gateway solo QA. No activar flags para "que aparezca algo".
- Sin acciones para aprobar KYC, suspender cuentas, gestionar emergencia o manipular dinero en browser sin backend autorizado y auditado.

## 6. CRONOLOGÍA DETALLADA DE IMPLEMENTACIONES — DESDE PR INICIAL HASTA HEAD 515d

**Auditoría exhaustiva de 153 commits en:** [Anexo completo](./HANDOFF_R3_ANEXO_153_COMMITS_2026-10-23.md); sus SHA y mensajes exactos vienen de la API GitHub, no de memoria. Esta sección es un índice funcional de grupos, no un sustituto de dicho anexo.

### Etapa B inicial · 22-oct a 23-oct temprano
1. Creación/aislamiento del Cliente Expo y Admin Web; formularios viaje AUTO/envíos AUTO-MOTO carga, cotizaciones borrador, pagos simulados, soporte local, dominio de comercios con catálogo cerrado, rutas principales de navegación.
2. Client session/JWT efímero, backend HTTP fail-closed y mutaciones con requestKey. Seguimiento GPS/ETA y polling condicional con caducidad. Historial privado paginado, botones y virtualización.
3. Admin session MFA, KYC metadata, zonas, auditoría parcial, Owner finance, cola de incidentes. CI propio Admin, límite 50/RESPUESTA sin tope global, separación de responsabilidades.
4. Corregidos en etapas sucesivas fallos de UUID, React 19/React DOM typings, JSX TS, shadowing fixture, datos stale, reintentos y duplicación. Documentos previos contienen detalle y commits de estos hitos.
5. Handoff R2 y cierre anterior a los commits modernos: 194/194 Cliente y 131/131 Admin; esos conteos son HISTÓRICOS.

### Etapa intermedia B · 23-oct, continuidad Work/B-07
1. `93cb5bf1`: mutaciones ligadas a revisión de privacidad de sesión.
2. `916db657`, `06e4eebe`: harness sintético de recorrido viaje/envío, sin negocios reales.
3. `f969a526`, `b470ee02`: commerce checkout guard realista, auditoría DTO de estado envíos.
4. `b1b4ad94`, `6a3b8576`: historia con memoria acotada y cursor sin límite global.
5. `6350f701`, `c31d097a`: accesibilidad base de Cliente y QA.
6. `80841187`: borrador soporte efímero con heurística de privacidad, purga logout, pruebas.
7. `0682bd9b`: triaje solo de página para incidentes Admin con filtros/orden y contadores.
8. En `80841187` se verificaron 226/226 Cliente y 131/131 Admin; en `0682bd9b` 138 Admin, Cliente y Driver verdes.

### Etapa red, HTTP y seguridad · commits exactos
1. `2dd3a780`: Admin rechaza HTTP tardío e impide 401 post-deadline invalidar nueva sesión; UTF-8 bytes reales.
2. `e0d051fd`: igual en historial privado Cliente.
3. `9f5bf7bb`: respuestas GPS/estado y cotizaciones PYG, contador UTF-8 compatible Hermes.
4. `18f3a108`: cancelación propia y gateway genérico con requestKey idempotente; 393/393 Cliente/Admin verdes.
5. `4b4c5192`: streaming Admin bounded HTTP, abort, strict UTF-8 antes de acumular bytes.
6. `8c03a5f5`: streaming bounded para cinco gateways HTTP Cliente. CI 255 Cliente + 151 Admin = 406 pruebas.
7. **Límite pendiente:** fallback `Response.text()` puede recibir todo antes de medir; certificar React Native/Hermes en dispositivo.

### Etapa contratos de incidentes G40/G41 · commits exactos
1. `8193db54`: adaptador G40 con recibo tipado de QA; sin llamada SOS/operador.
2. `b561614a`: adaptador Admin G41 para filtros globales en servidor, cursor opaco, MFA, fail closed.
3. `6ddfcd5e`: flujo idempotente G40 por sesión, doble tap/timeout/revision/GET status.
4. `16c7c156`: integración inicial G40 a ClientExperience; **CI detectó 3 fallos por snapshot**.
5. `bc334c25`: reparación del snapshot anon/auth; CI volvió a 3/3 SUCCESS.
6. `2bb26aa8`: navegación G41 ligada a filtros/identidad y no cuenta total global.
7. `29a6ef6a`: runtime Admin G41, gate apagado.
8. `30866c0a`: panel de UI para triaje global, visible solo si certificado. CI 283 Cliente + 175 Admin = 458.
9. `badef70f`: anterior/siguiente G41 con anclas reconsultadas, 120 páginas de QA.
10. `7ab461a7`: UI formulario G40 en soporte condicionada a contrato realmente montado; 289 Cliente + 180 Admin = 469.

### Etapa comercios, catálogo y escalado · commits exactos
1. `a04a14d4`: flujo comprador de catálogo, inyectado, sin URL HTTP inventada.
2. `73c234ca`: carrito versionado privado, JWT/logout, cantidades, MOTO/AUTO carga, subtotal PYG y veto checkout.
3. `cbda074c`: UI Comercios condicional a catálogo certificado; no productos ficticios.
4. `7c6c6bf0`: QA corrige expectativa de identidad minimizada; 298 Cliente + 180 Admin = 478.
5. `36cde946`: entrada de UUID de sucursal, consulta/refresh de precios vigentes, no compra. 301 Cliente + 180 Admin = 481.
6. `8c28dc3b`: pager independiente Buyer, 100 por página, prueba 130 páginas/13.000 artículos, no tope global.
7. `515d9fdc`: lock de consulta pager ANTES de espera de identidad, pruebas doble tap/logout/cambio rol; **313 Cliente + 180 Admin = 493; CI 3/3 SUCCESS**.
8. El pager Buyer queda aislado: NO integrar pedidos multi-página hasta que A defina catálogo/stock/version atómico y cursores seguros.

## 7. ERRORES Y DEFECTOS REALMENTE DETECTADOS / CORREGIDOS

| ID | Defecto original | Estado B / evidencia |
|---|---|---|
| F01 | UUID o formato de validación erróneo de catálogo/solicitud | Corregido; tests domain, CI verde |
| F02 | React 19 / react-dom/types / TS JSX en Admin | Corregido; Vite/TS Admin green |
| F03 | Doble pulsación con autorización asíncrona generaba requests paralelos | Corregido antes de await en mutaciones y pager Buyer 515d |
| F04 | Generación de otra requestKey tras timeout/409 | Corregido: misma key o conciliación obligatoria |
| F05 | HTTP 200/201 o 401/403 tardíos contaminaban nueva sesión | Corregido en gateways Admin, historia, GPS, quote y cancel |
| F06 | Cuerpo Unicode excedía límite al medir caracteres JS y no bytes | Corregido: bytes UTF-8, bounded stream si existe |
| F07 | Conservar PII de formularios tras logout/JWT nuevo | Corregido: revision privada/remount y borrador efímero |
| F08 | Colisiones de UUID de historia entre diferentes tipos de servicio | Corregido con kind:serviceId |
| F09 | Cotización válida borrada al empezar tracking DEL MISMO viaje | Corregido con subjectId/tripId coherente |
| F10 | KYC marcado habilitado solo por evidencia "documento válido" | UI corregida, operación real sigue pendiente |
| F11 | Contar 50 como total global o 51 en respuesta de 50 | Corregido con cursores, contadores "esta página", pruebas 121/130/151 páginas |
| F12 | Estado Admin retenido de sesión vieja tras JWT/MFA nuevo | Corregido por revocación/purga y revisión |
| F13 | G30 comunicado como auditoría integral | Alcance UI corregido: auditoría parcial |
| F14 | Fixture sombras y expiraciones variables hacían fallar CI | Corregido tras no silenciar tests |
| F15 | Exponer recibo G40 en snapshot anónimo duplicado y omitir autenticado | CI de 16c7 detectó 3; corregido en bc334c |
| F16 | Test de lector Buyer exigía rol extra no enviado por minimización | Corregido en 7c6c: subject y sessionRevision solamente |
| F17 | Cursor reutilizable entre filtros/sesiones del Admin | Aislado por filtro/actor y limpieza de anclas |
| F18 | Falseación de emergencias: "recibo QA" interpretado como alerta SOS | Bloqueado explícitamente en UI/domino; NO SOS |
| F19 | Página de comercios sin forma de pedir catálogo aun tras certificación | UI con selector técnico de sucursal, 36cde946 |
| F20 | Catálogo anterior visible tras error/logout/version mismatch | Purga del carrito y página, tests sintéticos; integración servidor pendiente |

**Importante:** "corregido" significa cubierto en QA B; NO demuestra autorización real, inyección de fallos en nube, pruebas de dispositivos físicos o seguridad de producción.

## 8. BLOQUEOS REALES EXTERNOS (NO DETENER TODO B)

| Bloqueo | Propietario | Resultado requerido |
|---|---|---|
| A01 Auth Passenger/Driver/Admin/Owner real | A | Emisión/revocación JWT, aud/iss, TTL, MFA AAL2 Admin, RLS/ownership, E2E cross-actor; cero credenciales en frontend |
| A02 Prequote ANTES de dispatch | A | Crear draft/subjectId propio servidor sin buscar conductor; cotización PYG y aceptación explícita antes de búsqueda |
| A03 Viajes / despacho / notificaciones | A | POST idempotente con recibo tipado y GET estado, drivers elegibles, aceptación push, timeout, cancelación/reintento |
| A04 Estado real de envíos AUTO/MOTO | A | DTO versionado, revisión monotónica, origen/destino/cobertura, estados, destinatario autorizado; no inventar entrega |
| A05 GPS/Mapas/routing y consentimiento | A y proveedor aprobado | Geocoding/ruta/costo verificable, TTL, privacidad y condiciones de cobertura/offline, pruebas calle |
| A06 Precios, comisiones y tasas PYG | A + Owner reglas | Matriz auto/moto/zonas, tarifa server-side, total, impuestos, neto conductor, conciliación y reembolso |
| A07 KYC/documentos conductores | A | DB privada + storage cifrado + retención y acceso de evidencias temporal; auditoría Admin; protección LGPD/PY según revisión legal |
| A08 Backend Admin A05 y G41 | A | GET realmente montados, JWT/MFA/RBAC/RLS, cursores firmados por filtros/sesión, paginación, 401/403/429/503 |
| A09 Incidentes G40 | A | POST/GET montados STAGING, recibo durable DB QA, idempotencia, propiedad, revocación, aviso operador solo con servicio realmente operativo |
| A10 Catálogo Buyer / sucursales | A | GET descubrimiento por zona, disponibilidad y catálogo paginado, version/TTL, precios stock propios y cursor firmado |
| A11 Pedidos comerciales | A | Receipt tipado por backend, precondición stock/catálogo, transacción atómica, deduplicación requestKey, conciliación y cancelación |
| A12 Pagos PSP/Wallet/reembolsos | A + Owner autorización | Procesamiento regulado, ledger reconciliado, split, webhooks idempotentes, anti fraude; nunca token PSP en app |
| A13 Dev/STAGING/PROD y observabilidad | A | Deploy controlado, env/secret management, backup/rollback, capacidad/load, no abrir producción sin autorización |
| A14 Legal/operación Paraguay | Owner/asesoría | Términos, privacidad, retención KYC, seguro, municipalidad, capacidad transporte moto, facturación/regulación |
| A15 Notificaciones/realtime Driver ↔ Cliente | A | Push/FCM/APNs, online/heartbeats, aceptación/expiración, correlación, GPS y E2E multi dispositivo |
| A16 Certificación nativa Android/iOS | A/B/QA | Builds de las DOS apps separadas, permisos GPS, notificaciones, offline, sesión, batería, accesibilidad, dispositivos reales |
| A17 Lovable/UI final | Owner y B | Conectar SOLO frontend visual a APIs certificadas sin trasladar lógica de seguridad/backend |

**Estado OpenAPI verificado:** v1.0.0-g41 contiene 48 paths. G40 POST incidentes + GET propio y G41 GET triaje aparecen explícitamente con `x-qore-runtime-wired=false` / `x-qore-qa-only=true`. Para comercio se observa POST merchant/catalog/upsert y buyer/orders/request, pero **no** GET Buyer branches/catalog paginado ni receipt de checkout con stock/reconciliación comprobado. Nombre de endpoint + test sintético NO demuestra servicio montado.

## 9. PENDIENTES ESPECÍFICOS B — TAREAS EJECUTABLES SIN DEPENDER DE A

### P0-B — realizar de inmediato
1. **Auditar carrera en `commerce-catalog-flow.mjs`**: `loadCatalog` espera `getActor()` antes de poner `loading=true`. El nuevo pager Buyer ya lo corrige en `515d9fdc`, pero el flujo del carrito de una sucursal debe usar lock antes del primer await, con tests doble tap, dos sucursales, revocación y errores. Es un trabajo B sin bloqueo externo.
2. Añadir pruebas property/fuzz de normalización catálogos, itemTag, UUID, version, expiresAt y cantidades, de modo que PII extra, campos desconocidos, cifras peligrosas y revisión inconsistente sean rechazadas conservadoramente. Distinguir snapshot del servidor vs cálculo local.
3. Revisar condición de sincronización UI Comercios: al refrescar catálogo debe mostrar carga/feedback de error y NO cifras viejas; no permitir limpiar carrito/editar mientras refresh está en vuelo; propagar status sin datos sensibles.
4. Preparar un `staging-contract-smoke` desconectado por defecto para el futuro GET catálogo Buyer: handshake de contrato, fixture sintético autorizado, corte ante 401/403/404/409/429/503, cursors, TTL; **NO inventar ruta ni activar red**.
5. Añadir tests de integridad a G40: 409 con misma requestKey, baja de JWT a mitad de post, recibo de otra cuenta, respuesta streaming sobredimensionada, sin SOS. Formulario no debe aparecer mientras runtime esté apagado.
6. Añadir tests G41 de filtrado/cursor al expirar MFA, reload entre páginas, invalidación TTL, alta tasa de expedientes, campo inesperado PII y 120+ páginas sin límite global.
7. Corregir cualquier CI roto del HEAD técnico y volver a 3/3 verde, sin silenciar tests.

### P1-B — continuar mientras espera A
8. E2E local UI real de Expo Client en emulador/dispositivo controlado si existe acceso; snapshots de viajes, envíos, pagos bloqueados, soporte y comercio, sin datos reales. No afirmar Android certificado sin build/install/captura y evidencias.
9. Admin Web E2E en navegador con sesión sintética, MFA y KYC/zonas/owner finance/incident filtros, navegación teclado, screenreader contrast. Bloquear Owner de Admin incident/KYC.
10. Mejorar volumen: historial con ventana acotada y scroll accesible, pages desordenadas, revocación, 10k+ registros sintéticos; separar límites de memoria locales de cardinalidad del servidor.
11. Revisar internacionalización es-PY, formateo PYG, unidades kg/cm, números inválidos, truncado de etiquetas; no inventar tarifas.
12. Crear contrato de interfaz Adapter/DTO para descubrimiento de sucursales y stock sin URL; coordinar con A en issue #9. Páginas multi-producto se deben vincular al carrito solo cuando servidor firme cursor y gestione precondición de pedido.
13. Preparar plan de Lovable limitado a UI, navegación, diseño responsive y estados vacíos/errores, sin persistir secretos. No desplegar ni configurar backend Lovable autónomo.
14. Actualizar handoff/PR #8/issue #9 con SHA, PASS, problemas y pasos; preservar todos los documentos anteriores.

### Integración B tras desbloqueo A, orden seguro
15. Validar OpenAPI y evidencia de servicio real en STAGING para Auth Passenger/Admin. Comprobar revocación JWT, roles cruzados, subject ownership y MFA AAL2. Inyectar origen HTTPS pinned, habilitar SOLO rutas efectivamente certificadas.
16. Integrar backend viaje: prequote => mostrar total servidor => aceptar => request idempotente => asignación Driver => tracking seguro => finalización/cancelación/reconciliación. E2E 2 dispositivos.
17. Integrar envíos de AUTO/MOTO carga y comerciales: despacho, estados, entrega sin mensajes inventados, cobertura vs disponibilidad, backend de rutas.
18. Integrar G40 solo cuando runtime esté montado, con recibo QA verificable, sin SOS hasta un servicio de atención autorizado y probado.
19. Integrar G41 y A05 Admin con roles, filtros server side y cursores firmados, KYC con evidencia privada y acciones auditablemente autorizadas.
20. Integrar catálogos Buyer paginados por zona, stock/currency PYG/version/TTL y **orders atómicos**. Tras transacción validada, solo entonces flujo PSP bajo autorización explícita del Owner.
21. Certificar Android/iOS y Admin Web con E2E, pruebas de red caídas, 409, concurrencia, 401, seguridad, protección de datos, perf/carga, rollback y auditoría; reportar hallazgos.

## 10. MATRIZ DE ACEPTACIÓN — ESTADO REAL

| Gate | Estado | Lo que falta para cerrarlo |
|---|---|---|
| B-BASE aislamiento de 2 apps + Admin Web | **PASS QA sintética** | Verificar en cada HEAD |
| B-UNIT tests, TS y export web | **493/493 PASS en SHA anterior a R3** | Tests E2E/nativos aún no cubiertos |
| B-AUTH JWT Passenger/Admin real | BLOQUEADO A | API montada, MFA, RLS, revocación y ataque cross-account |
| B-RIDE request / dispatch / status en red | BLOQUEADO A | Contrato/camino completo prequote y Driver |
| B-DELIVERY auto/moto + prueba de recepción | BLOQUEADO A | Delivery status/auth/dispatch + E2E |
| B-G40 recibo incidente QA real | BLOQUEADO A | `x-qore-runtime-wired=true` comprobado y seguridad server |
| B-G41 triaje global real | BLOQUEADO A | Servicio firmado, filtros server-side, MFA/RBAC, paginación |
| B-COMMERCE buyer catalog paginado | BLOQUEADO A | GET catálogo/branches real firmado y cursor |
| B-ORDER transacción stock/payment | BLOQUEADO A / Owner | PSP, contrato atómico, idempotencia, ledger, legales |
| B-ANDROID/iOS builds nativas | PENDIENTE | Builds/instalación E2E de apps separadas |
| B-ADMIN navegador real | PENDIENTE | E2E con provider real, MFA, accesibilidad |
| B-LOVABLE UI definitivo | PENDIENTE | Trabajo visual separado tras API/gates certificados |
| B-LIVE/PRODUCCIÓN | **NO AUTORIZADO** | Certificación integral y orden explícita Owner |

**No existe una puntuación honesta 1–10 de app "terminada" basada solo en número de tests; requiere evaluación trazable por gate anterior y A.**

## 11. RIESGOS ABIERTOS DE ALTA PRIORIDAD — NO OCULTAR

- R01. Una respuesta OpenAPI exitosa puede ser solo simulación de contrato sin servidor montado. Exigir evidencia runtime-wired.
- R02. Una sesión JWT mock no prueba firma ni RLS. Exigir issuer/audience/claims, revocación y pruebas entre cuentas.
- R03. El G40 solo registra en DB QA, NO atención real ni SOS; el texto del frontend debe mantenerlo explícito.
- R04. G41 orden global de servidor es prometido por DTO, no está demostrado multi-millones; filtros locales de A05 no sustituyen filtros globales.
- R05. Cursor de 50/100 filas no implica límite del repositorio. Test 13k sintético no demuestra rendimiento de 13k real.
- R06. Carrito local con máximo 50 líneas es un límite UX intencional, NO límite de usuarios, stock, comercios o registros; discutir aumentar con UX posterior si negocio lo requiere.
- R07. Catálogo Buyer paginado está construido como dominio aislado y **no** abastece carrito multi-página; integrar a medias crearía stock/versión inconsistentes.
- R08. Una captura de GPS requiere permiso y consentimiento; ubicación inferida no prueba ruta/ETA.
- R09. Pagos simulados no son conciliación PSP; no presentar ingresos/comisiones como dinero real.
- R10. El backend A podría avanzar entre commits; no basarse en SHA histórico. Reconciliar HEAD y contrato cada día.
- R11. Stream `Response.text()` fallback puede superar memoria antes de validar bytes. Test real Android/Hermes.
- R12. Validaciones client-side de PII son heurísticas; backend debe tener políticas/retención/access control.
- R13. Paquetes npm y builds web no significan APK/IPA instalados o notificaciones push.
- R14. Filtros de Admin solo locales pueden ocultar críticos de otras páginas; UI rotula "esta página" hasta activar G41 global.
- R15. Dispositivos Android pequeños, conexiones 2G/offline, batería y rotación sesión pueden revelar bugs solo E2E.
- R16. Regulatory/seguros/permiso municipal/tributación y farmacia OTC no están certificados.
- R17. Asignación/aceptación Driver y disponibilidad en zona son indispensables antes de salir al mercado.
- R18. No confundir CI del commit anterior con CI de un nuevo handoff solo documentación.
- R19. Concurrencia de auth en flujo carrito actual (**P0-B pendiente**) vs pager nuevo arreglado.
- R20. JSX/labels/screenreader de formularios comerciales requiere prueba manual de accesibilidad real.
- R21. Vendor Lovable no debe reemplazar seguridad ni reglas server-side.
- R22. Backups, rollback, migraciones SQL con datos reales, secretos y auditoría financiera siguen propiedad A.
- R23. Cualquier intervención en archivos globales CI, drivers, APIs o base principal sin coordinación viola propiedad.
- R24. Tiempo de CI no justifica saltar pruebas, inventar PASS o usar secretos productivos para acelerar.

## 12. PROCEDIMIENTO OPERATIVO DEL SUCESOR — SIN DETENERSE

1. Abrir PR #8, PR #7, issue #9 y este handoff con el anexo de TODOS los commits; verificar HEAD B/A y estado DRAFT en GitHub. **No empezar desde cero.**
2. Leer OpenAPI A en su HEAD nuevo, recuperar todos los resultados CI últimos y confirmar funciones realmente montadas (`x-qore-runtime-wired`), no solo esquema.
3. Escoger P0-B INDEPENDIENTE (recomendación: race `commerce-catalog-flow.mjs` antes del await Auth), crear/adaptar tests adversariales sintéticos, hacer cambio mínimo y commit protegido por expected_sha.
4. Esperar el resultado CI necesario dentro de la misma sesión de trabajo, inspeccionar logs si failure, corregir y volver a publicar hasta PASS. No declarar verde antes de conclusión.
5. Anotar SHA, tests y cambios en docs/architect-b/** y comentario PR #8. Si A necesita un contrato, comentario issue #9 con JSON/DTO, TTL, estado y errores exactos; avanzar inmediatamente a otro P0-B.
6. Repetir implementación/prueba/commit por bloques independientes mientras haya trabajo viable. No pausar por simple falta de respuesta de un endpoint ajeno.
7. Consultar con Owner solo cuando implique cambio de alcance, dinero real, usuarios/PII reales, merge, despliegue o LIVE; esas prohibiciones permanecen.
8. Hacer handoff nuevo al cambiar de chat, con HEAD/CI/evidencias actuales, y mantener historial antiguo legible.

**Comandos de QA orientativos (usar versiones lockfiles existentes, NO tocarlos sin coordinación):**
```bash
cd apps/movete-cliente
npm install --no-audit --no-fund --ignore-scripts
npm run check
npx expo export --platform web --output-dir dist

cd ../movete-admin
npm install --no-audit --no-fund --ignore-scripts
npm run check
npm run build
```

**Estrategia si el entorno de chat no puede hacer Work continuo:** usar el conector GitHub en cada turno, ejecutar tantos bloques autónomos como sea posible con CI y commit, no prometer trabajo en segundo plano ni fingir que un proceso continúa cuando se acaba el turno. Si hay bloqueo real, documentar evidencia y avanzar en otro componente autorizado.

## 13. MENSAJE DE TRANSFERENCIA LISTO PARA CHAT NUEVO

> Actúa como **Arquitecto B de QORE Mobile / Movete Fácil** en el repositorio https://github.com/mezas3238-hue/Qore-mobile-. Tu misión es CONTINUAR el PR #8 DRAFT en `feature/mobility-cliente-admin-parallel-20261022`, cuyo base es el PR #7 del Arquitecto A. **No te detengas a menos que exista un BLOQUEO REAL: sigue implementando bloques independientes, pruebas adversariales, CI, fixes, commits y documentación sin pedir aprobación por cada paso.** Lee `docs/architect-b/HANDOFF_MAESTRO_B_R3_CLIENTE_ADMIN_TOTAL_2026-10-23.md` y el anexo `HANDOFF_R3_ANEXO_153_COMMITS_2026-10-23.md`, además de los handoffs anteriores. Comprueba HEAD/CI/contratos ACTUALES antes de editar. Tu propiedad EXCLUSIVA es `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`; no toques Driver, backend, SQL, CI global ni archivos del Arquitecto A. Dos apps móviles separadas y Admin WEB aparte. Comienza P0 corrigiendo la carrera auth en `commerce-catalog-flow.mjs`, prueba doble tap y rotación/logout, publica cambio con expected_sha y sigue. Backend A es responsable de Auth/JWT/RLS, G40/G41, catálogo Buyer y pedidos/PSP; si no están montados, documenta en issue #9 y continúa otro bloque B. OpenAPI previa: g41 con G40/G41 UNMOUNTED. Último HEAD B técnico antes de R3: 515d9fdc8e4aa32f356cb96b768cd0feb6ee85bb; Cliente 313 PASS, Admin 180 PASS, 3/3 workflows SUCCESS, **no producción**. No inventes servicios, tarifas, GPS, stock, pedidos, dinero, usuarios ni alertas. **NO MERGE, NO LIVE, NO DEPLOY, NO VPS, NO PSP, NO PII real** sin orden Owner. Mantén PR DRAFT y entrega resultados verificados en GitHub. Lovable se usará esencialmente para UI final, sin lógica backend. Continúa el trabajo hasta completar el ámbito B o un bloqueo auténtico.

---

## 14. ENTREGABLES DE LA TRANSFERENCIA

- Este handoff maestro R3 completo con inventario, 493 tests previos verificados, problemas cerrados, riesgos, matriz de responsables, P0/P1 y guion de continuidad.
- [Anexo auditable de 153 commits previos](./HANDOFF_R3_ANEXO_153_COMMITS_2026-10-23.md), generado desde GitHub.
- Handoffs históricos R1/R2/cierre conservados sin eliminación.
- Issue #9 abierto para dependencias A y PR #8 DRAFT para trabajo B.
- **Obligación inmediata post-publicación:** verificar SHA nuevo del commit R3 y sus 3 workflows, informar resultados exactos. No realizar merge ni LIVE.

**FIN DEL HANDOFF MAESTRO R3 — siguiente arquitecto: continuar directamente con código, pruebas y commits, sin reiniciar el proyecto.**
