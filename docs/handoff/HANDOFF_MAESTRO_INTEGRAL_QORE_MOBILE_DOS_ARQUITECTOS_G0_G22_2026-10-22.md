# QORE MOBILE / MOVETE FÁCIL — HANDOFF MAESTRO INTEGRAL DE CONTINUIDAD
## DOS ARQUITECTOS · INFRAESTRUCTURA G0–G22 · DRIVER / CLIENTE / ADMIN WEB
**Corte verificado:** 22/10/2026 (noche PY; commits y runs consultados en GitHub en esta transferencia).
**Destino:** arquitecto sucesor / nuevo chat ChatGPT Work.
**Repositorio SOBERANO:** \`mezas3238-hue/Qore-mobile-\` (NO \`mezas3238-hue/qore-core\`, que es TRADING y está fuera de alcance).
**Rama Arquitecto A:** \`feature/mobility-monorepo-isolated-20261016\`
**PR Arquitecto A:** https://github.com/mezas3238-hue/Qore-mobile-/pull/7 — **ABIERTO, DRAFT, NO MERGED**
**HEAD A verificado antes de publicar este documento:** \`29885d1c2b3c4b8c831bb27e160df6d1f3d25a12\`.
**Rama Arquitecto B:** \`feature/mobility-cliente-admin-parallel-20261022\`
**PR Arquitecto B:** https://github.com/mezas3238-hue/Qore-mobile-/pull/8 — **ABIERTO, DRAFT, NO MERGED**
**HEAD B verificado:** \`79e52792d96bec6b41875b960f37a99a0e9aaa04\`.
**Solicitud de APIs de B a A:** https://github.com/mezas3238-hue/Qore-mobile-/issues/9 — **ABIERTA**.
**Handoff de división obligatorio:** \`docs/handoff/DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md\`.

> ESTE DOCUMENTO ES UNA TRANSFERENCIA EJECUTABLE, NO UN CERTIFICADO DE PRODUCCIÓN. Los SQL indicados son **CI disposable / DO_NOT_APPLY_PRODUCTION**. Los endpoints OpenAPI son contratos STAGING y no demuestran servidor desplegado. Web export Expo no es APK/IPA. Los datos usados en pruebas son sintéticos. No se ejecutaron cobros, recorridos, documentos ni push con personas reales.

---

# 0. ORDEN SOBERANA DEL OWNER Y REGLAS NO NEGOCIABLES

El objetivo es terminar la plataforma paraguaya **Movete Fácil**, aspirando a una experiencia competitiva frente a Bolt/Uber, para:
- viajes de pasajeros en **automóvil** con categorías que determine el backend;
- motocicletas: **entrega de carga** como permiso distinto; **pasajeros en MOTO BLOQUEADOS** hasta comprobar legalidad, licencias y seguros por municipio/servicio;
- **envíos particulares**: documentos, paquetes y otras categorías permitidas;
- **entregas comerciales**: supermercados, restaurantes, farmacias OTC autorizadas y otros comercios por zona;
- tarifas por clase AUTO/MOTO/DELIVERY/COMERCIO, en **guaraníes (Gs.)**, siempre originadas en el servidor, sin equiparar el precio AUTO al precio MOTO;
- seguridad, verificación de conductores/vehículos, privacidad, auditoría, cobertura por zonas ≠ disponibilidad de conductor.

El Owner ordenó **DOS APLICACIONES MÓVILES DIFERENTES Y SEPARADAS**: una para CONDUCTORES/REPARTIDORES, otra para PASAJEROS/CLIENTES, y **un panel ADMIN WEB independiente**. El backend central se comparte, pero sus permisos se verifican siempre en el servidor, no según un toggle UI. Lovable, si se integra posteriormente, **solo construye la interfaz** y no reemplaza Auth, SQL/RLS, despacho, cálculo económico ni seguridad.

**Prohibido sin orden explícita del Owner:** hacer MERGE, pasar a LIVE, desplegar backend o frontend públicos, lanzar apps en tiendas, levantar VPS, usar SQL de producción/remoto, ejecutar pagos reales, generar notificaciones push reales o recopilar documentos/identidades reales. Mantener PR #7 y #8 **DRAFT** y LIVE flags falsos. No tocar qore-core.

**Modo de trabajo esperado:** inspeccionar estado real, escribir código en la rama correspondiente, ejecutar CI, diagnosticar/corregir fallos, actualizar evidencia y continuar. No afirmar que terminó una funcionalidad solo por haber pasado tests unitarios con mocks. No crear un nuevo PR alternativo si los DRAFT existentes sirven.

---

# 1. FUENTE DE VERDAD, ARQUITECTOS Y NO COLISIONAR

## 1.1 Arquitecto A (quien continúa backend + Driver)
**ÚNICO editor de:** 
- \`apps/movete-driver/**\`;
- \`apps/mobility-expo/**\` (laboratorio histórico, API local, SQL y contratos);
- \`backend/**\`, \`database/**\`, \`packages/**\` si se crean;
- \`.github/**\`, \`scripts/**\`, documentación transversal \`docs/architecture/**\` y \`docs/handoff/**\`, raíz;
- backend de permisos/servicios para el panel ADMIN, nunca sus pantallas.

**A NO toca:** \`apps/movete-cliente/**\`, \`apps/movete-admin/**\`, \`docs/architect-b/**\`. Si necesita DTO/cambio de UI del B, abrir issue o comentario de contrato, no editar sus archivos.

## 1.2 Arquitecto B (Cliente y Admin WEB)
**ÚNICO editor de:**
- \`apps/movete-cliente/**\` — segundo binario móvil para pasajeros y usuarios de envíos;
- \`apps/movete-admin/**\` — web React/TypeScript/Vite, NO app móvil;
- \`docs/architect-b/**\` — avances, pruebas, problemas y solicitudes a A.

**B NO toca:** backend, Driver, SQL, G* migrations, OpenAPI, CI, scripts ni raíz; solo lee. Requiere contratos de A vía issue #9.

Las ramas son independientes. La rama B/PR #8 tiene BASE = rama A, no main. **Dato verificado de divergencia al corte:** comparación \`A...B\` = \`diverged\`, **B ahead 53, behind 98 commits**. NO integrar con merge/rebase/cherry-pick cruzado de forma automática. Coordinar primero contratos, mantener propiedad de archivos y esperar orden Owner para MERGE. El control \`.github/workflows/movete-architect-b-boundary.yml\` impide archivos ajenos en PR8.

---

# 2. ARQUITECTURA EXACTA Y ESTADO DE EJECUCIÓN

\`\`\`text
mezas3238-hue/Qore-mobile-
├── apps/
│   ├── movete-driver/       ← BINARIO MÓVIL DRIVER, A
│   ├── movete-cliente/      ← BINARIO MÓVIL CLIENTE, B
│   ├── movete-admin/        ← WEB ADMIN, B (EXISTE EN RAMA B, NO EN RAMA A)
│   └── mobility-expo/      ← LABORATORIO HISTÓRICO MIXTO, A; NO LANZAR
│       ├── server/         ← Gateway local Node y tests G1–G20
│       ├── docs/backend/staging_only/
│       │                   ← SQL CI G0–G20, no producción
│       ├── docs/backend/openapi/movete-facil-staging.openapi.json
│       └── docs/handoff/   ← Handoffs históricos G0–G12
├── docs/
│   ├── handoff/            ← propiedad A, incluye división/handoff actual
│   ├── architecture/       ← G16 a G22, propiedad A
│   └── architect-b/        ← propiedad B, solo en rama B
├── scripts/check-mobile-boundaries.mjs
└── .github/workflows/
    ├── mobility-g4-postgres-disposable.yml
    ├── mobility-staging-node-contracts.yml
    ├── mobility-ci.yml
    ├── movete-apps-isolation.yml
    └── movete-architect-b-boundary.yml
\`\`\`

- \`movete-driver\` = Expo separado; Android/iOS identificador \`com.movetefacil.driver\`, deep link \`movetefacildriver\`. Rutas: \`index\`, \`documentos\`, \`ofertas\`, \`ganancias\`.
- \`movete-cliente\` = Expo separado; Android/iOS identificador \`com.movetefacil.cliente\`, deep link \`movetefacilcliente\`; rutas actuales B incluyen viaje, envíos, comercios, cotización, pagos de prueba, seguimiento, historial, cuenta y soporte. No funciones Driver.
- \`movete-admin\` = WEB separada en rama B; login Admin/Owner diseñado con MFA/roles inyectados, vistas KYC/zonas/incidentes/finance; **no hay aprobación/pagos reales ni CI propio certificado**.
- \`mobility-expo\` = DEMO/QA heredada con pantallas mixtas; **no** renombrar ni distribuirla como app final. Su README puede mencionar \`ViajeYa\`, \`com.qore.viajeya\` y backend Lovable histórico: ese legado NO representa las dos apps finales ni una conexión STAGING confirmada.
- El backend central está **desarrollado en SQL/servicios y probado con datos desechables**, pero **NO** está desplegado y certificado como infraestructura operativa móvil.
- OpenAPI \`info.version=1.0.0-g11\`: **40 paths** al corte (incluidos G16–G20); esquema de rutas, **no disponibilidad real**.
- Componentes G21/G22 en Driver son composición de sesión y pantallas, **sin un proveedor Auth configurado en el layout por defecto**; por ello se muestra \`not-configured\` intencionalmente.

---

# 3. ESTADO CI VERIFICADO AL RECIBIR LA TRANSFERENCIA

**A HEAD \`29885d1c...\`**: los **cuatro workflows** asociados finalizaron **SUCCESS**, verificados mediante GitHub:
1. **STAGING Node contracts #306** — https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39887977273
2. **Expo isolated CI #845** — https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39887977342
3. **PostgreSQL disposable #149** — https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39887977155
4. **Dos apps aislamiento #188** — https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39887977205

**B HEAD \`79e52792...\`**: propiedad exclusiva/PR boundary #50 **SUCCESS** https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39890889314 ; two-app isolation #198 **SUCCESS** https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39890889457 . **ESOS NO PRUEBAN el build ni los tests de \`movete-admin\`**.

Workflow A PostgreSQL: \`.github/workflows/mobility-g4-postgres-disposable.yml\` mantiene **dos jobs**:
- \`sql-concurrency\` (DB \`qore_disposable\`) — fixtures G12, claims concurrentes en sesiones independientes.
- \`real-schema-chain\` (DB \`qore_disposable_chain\`, \`PGAPPNAME=qore_ci_disposable_chain\`) — esquema real G1,G2,G3,G4,G5,G10,G12 → asserts → G13 y carreras → G14 aceptación competidora → G15 polling → G16 AUTO polling → G17 documentos → G18 onboarding → G20 fencing y sus asserts.
Pruebas G6/G7/G8/G9 se ejecutan también en el workflow \`mobility-ci.yml\` mediante scripts SQL desechables separados; NO confundir con una única cadena integrada G1–G20 en producción.

Node: \`node --test *.test.mjs\` en \`apps/mobility-expo/server\`. Expo CI anterior verifica tests + export web y PostgreSQL efímero; \`movete-apps-isolation.yml\` valida identidades y ejecuta TypeScript/tests/export web por binario Driver/Cliente. Ninguno certifica APK/IPA, mapas físicos, push de dispositivo o PSP.

**HIGIENE DE CONTINUIDAD:** después de publicar este documento el nuevo commit HEAD A será diferente del snapshot anterior; los resultados SUCCESS anteriores son del commit verificado, no atribuirlos automáticamente al commit de documentación si GitHub aún no concluyó nuevos runs. Consultar por HEAD/PR actual.

---

# 4. INVENTARIO DE TRABAJO YA REALIZADO — FASES G0–G15 (HISTÓRICO, BACKEND)

Los bloques anteriores pueden provenir de distintas sesiones/agentes A; están en el repositorio y handoffs históricos. Todas las capacidades «probadas» se refieren a QA sintético salvo que se demuestre lo contrario.

## G0/G1 — Fundaciones
- Repositorio/monorepo aislado y pipeline Expo/Node/PostgreSQL; Auth ficticio SQL para CI; \`G0_DISPOSABLE_AUTH_SCAFFOLD_POSTGRES_CI_ONLY.sql\`.
- Baseline SQL G1: usuarios, roles, registros iniciales, control de acceso, RLS y seguridad. \`G1_ISOLATED_SUPABASE_BASELINE_DO_NOT_APPLY_PRODUCTION.sql\`.
- Bucket privado de evidencia / licencia como esquema STAGING: \`G1_PRIVATE_DOCS_BUCKET_STAGING_ONLY.sql\`. Política vigente conocida solo admite licencias; no habilitar silenciosamente DNI/seguro por tener enum G17.
- **Limitación:** no hay backend real conectado/publicado por estas migraciones.

## G2 — Driver y vehículo, elegibilidad inicial
- Intake de solicitud de alta, vehículos AUTO/MOTO, documentación y review audit en SQL de staging:
  \`G2_APPLICATION_INTAKE_DO_NOT_APPLY_PRODUCTION.sql\`,
  \`G2_AUTO_MOTO_COMPLIANCE_DO_NOT_APPLY_PRODUCTION.sql\`,
  \`G2_REVIEW_AUDIT_DO_NOT_APPLY_PRODUCTION.sql\`,
  \`G2_LOCK_IMMUTABLE_APPLICATION_STAGING_ONLY.sql\`,
  \`G2_APPLICATION_TO_PENDING_INVENTORY_STAGING_ONLY.sql\`,
  \`G2_SERVER_PREFLIGHT_DO_NOT_APPLY_PRODUCTION.sql\`.
- Control de licencia, seguros, inspección, autorización municipal, categoría del vehículo, disponibilidad y consentimiento GPS; preflight server-side; «pendiente» no es «aprobado».
- Restricción MOTO pasajeros cerrada; MOTO carga con validación específica.
- Gateways \`server/g2-*.mjs\`, scripts y tests PostgreSQL desechables.

## G3/G4 — Viaje AUTO y despacho privado
- \`G3_AUTO_DEMO_TRIP_CONTRACT_POSTGRES_CI_ONLY.sql\`: solicitud con idempotencia, estados, transiciones, no más de una asignación activa por conductor; carreras de aceptación.
- \`G4_PRIVATE_AUTO_OFFERS_POSTGRES_CI_ONLY.sql\`: ofertas dirigidas al Driver, TTL, aceptación/rechazo, servicio elegible, auditoría; sin solicitudes de pasajeros en el teléfono Driver.
- \`G4_PUSH_OUTBOX_AT_MOST_ONCE_POSTGRES_CI_ONLY.sql\`: outbox privada; provider ACK ≠ recepción del teléfono.
- Gateways Node: \`g4-qore-radar-core.mjs\`, \`g4-rider-status-gateway.mjs\`, \`g4-offer-gateway.mjs\`, \`g4-trip-command-gateway.mjs\`, \`g4-loopback-http-transport.mjs\`, \`g4-staging-runtime.mjs\`; router vial/Google potencial con pruebas y sin credenciales/productividad.
- El servidor HTTP de QA corre sobre **127.0.0.1**, no es endpoint público ni accesible directamente como 127.0.0.1 desde otro móvil físico.

## G5 — Entregas, custodia y prueba
- \`G5_DELIVERY_CUSTODY_POSTGRES_CI_ONLY.sql\`: solicitudes de entrega particulares con tipo AUTO/MOTO, categoría/carga/peso/dimensiones, custodias y transición recogido/entregado con prueba; permisos de remitente/transportista.
- \`server/g5-delivery-command-gateway.mjs\`, repositorio y tests. Envíos comerciales dependientes de comercio y geocobertura.
- No opera físicamente en vías públicas, sin pruebas con repartidores reales.

## G6/G9 — Comercios
- \`G6_MERCHANT_ORDERS_POSTGRES_CI_ONLY.sql\`, \`G9_MERCHANT_MANAGEMENT_POSTGRES_CI_ONLY.sql\`.
- Comercios, sucursales, catálogo, stock/orden, preparación, vinculación de órdenes con entrega; revisión y restricciones.
- Gateways Node \`g6-merchant-order-gateway\`, \`g9-merchant-management-gateway\`, repositorios y tests.
- **Pendiente:** integración integral de comercios reales/autorizados, stock actualizado, pagos simulados end-to-end, normativa de farmacia.

## G7 — Tarifas, comisiones y pagos SIMULADOS
- \`G7_FARES_SIMULATED_PAYMENTS_POSTGRES_CI_ONLY.sql\`, \`g7-finance-gateway\` y repositorio.
- Cotización basada en versión, guaraníes, categorías de servicio, transiciones de pago y ledger simulado con verificaciones de conciliación.
- Investigaciones previas de Bolt/Uber, FairPrice, comisiones y escenarios no constituyen tarifas comerciales aprobadas ni una comparación pareada y vigente. Nunca usar un precio ficticio como cotización real.
- **Pendiente:** reglas por zona/tráfico/servicio y costos reales, impuestos, PSP, reembolsos, regulación, aprobación Owner.

## G8 — Seguridad y auditoría
- \`G8_SAFETY_OPERATIONS_POSTGRES_CI_ONLY.sql\`, gateway \`g8-safety-gateway.mjs\`.
- Reporte/estado de incidentes, SOS de prueba, suspensión y operaciones auditadas; políticas y tests sintéticos.
- **SOS de prueba no equivale a atención de emergencia activa**. Privacidad, retención y operación 24/7 siguen pendientes.

## G10 — Ofertas privadas de delivery
- \`G10_PRIVATE_DELIVERY_OFFERS_POSTGRES_CI_ONLY.sql\`: oferta por courier, vencimiento, único ganador al aceptar, bitácora y outbox; pruebas de idempotencia y roles.

## G11 — OpenAPI + gates
- \`apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json\`.
- Tests \`server/g11-openapi-contract.test.mjs\` y \`g12-openapi-integrity.test.mjs\`: referencias, rutas, auth/error/schemas en evolución.
- **Importante:** el catálogo aún tiene gaps de DTO/role contract (issue #9); version \`1.0.0-g11\` es etiqueta histórica, no versionado desplegado.

## G12/G13/G14/G15 — Push resiliente y concurrencia
- G12 \`G12_DELIVERY_PUSH_CLAIM_ACK_POSTGRES_CI_ONLY.sql\`: worker claim \`SKIP LOCKED\`, owner ACK, expiración y limpieza de claim; at-most-once, sin device receipt ficticio.
- G13 \`G13_DELIVERY_PUSH_FENCED_DISPOSABLE_CI_ONLY.sql\`: lease/fencing contra antiguos workers, ACK y fallos ambiguos, test SQL + Python en dos sesiones.
- G14 \`server/g14-competing-courier-acceptance-ci.py\`: dos couriers por una entrega; aceptación exclusiva; colisiones reales en PostgreSQL de prueba.
- G15 \`G15_COURIER_PRIVATE_OFFER_POLL_POSTGRES_CI_ONLY.sql\`: recuperación privada por polling al courier cuando push no llega, TTL, privacidad, rol Driver exclusivo.
- **No demostrado en real:** entrega push al dispositivo, receipts de fabricante, red móvil, reintentos de proveedor con garantía exactly-once, despliegue o notificaciones comerciales.

---

# 5. TRABAJO YA REALIZADO — FASES G16–G22 (ARQUITECTO A, ÚLTIMOS BLOQUES)

## G16 — Bandeja privada unificada AUTO + DELIVERY
**Archivos:**
- \`docs/backend/staging_only/G16_DRIVER_PRIVATE_AUTO_POLL_POSTGRES_CI_ONLY.sql\`
- \`G16_DRIVER_PRIVATE_AUTO_POLL_ASSERT_POSTGRES_CI_ONLY.sql\`
- \`server/g16-driver-private-inbox-repository.mjs\`
- \`server/g16-driver-private-inbox-gateway.mjs\`
- \`server/g16-driver-private-inbox.test.mjs\` y \`g16-driver-inbox-loopback.test.mjs\`
- Driver \`src/domain/driver-inbox.mjs\`, \`driver-inbox-session.mjs\`, tipos y tests.
**Logro:** \`GET /v1/staging/driver/inbox\` (servicio local de QA) une ofertas AUTO y DELIVERY solo del Driver con JWT confirmado/rol server-side, TTL, sin PII de pasajero. Se mantiene \`pushDelivered=false\` y \`deviceReceived=false\`. La aceptación real todavía no se activa en UI.
**CI:** SQL sobre cadena real + HTTP localhost y Node + app por separado.
**Documento:** \`docs/architecture/G16_DRIVER_PRIVATE_INBOX_AND_SESSION_QA_2026-10-22.md\`.

## G17 — Manifiesto documental privado y revisión Admin inmutable
**Archivos:**
- \`G17_PRIVATE_DRIVER_DOCUMENTS_POSTGRES_CI_ONLY.sql\` y \`G17_PRIVATE_DRIVER_DOCUMENTS_ASSERT_POSTGRES_CI_ONLY.sql\`;
- \`server/g17-driver-document-repository.mjs\`, \`g17-driver-document-gateway.mjs\`, tests Node/HTTP;
- Driver \`src/domain/driver-documents.mjs\`, tipo y test.
**Logro:** tabla \`mobility_stage_driver_documents\` guarda SOLO referencia privada, formato, tamaño y SHA-256 (no bytes). \`mobility_stage_driver_document_reviews\` conserva revisión inmutable con requestKey, revisor Admin exclusivo y reasonCode. RPC registrar/revisar/leer estado con grants exclusivos para \`service_role\`, RLS, sin acceso de \`anon/authenticated\`. Un documento registrado es **pendiente**, no habilitado.
**Correcciones:** no modificar propietario, object key, tamaño, hash ni clase una vez registrado; service_role solo puede actualizar columnas de decisión; categorías distintas de \`licencia\` no se pueden registrar actualmente porque faltan políticas Storage revisadas.
**API:** \`GET /v1/staging/driver/documents\`; \`POST /v1/staging/driver/documents/observe\`; \`POST /v1/staging/admin/driver-documents/review\` (A desarrolla servidor; B desarrolla solo UI).
**Bloqueo:** upload observa archivo **solo** tras verificación segura externa. Runtime predeterminado falla cerrado.

## G18 — Onboarding Driver con rol exclusivo
**Archivos:** SQL \`G18_DRIVER_ROLE_ENROLLMENT_POSTGRES_CI_ONLY.sql\` + asserts; Node \`g18-driver-enrollment-gateway/repository\` y tests; Driver \`driver-enrollment.mjs\`, tipo/test.
**Logro:** \`POST /v1/staging/driver/enrollment\` acepta solo identidad JWT verificada con consentimiento explícito + requestKey; conversión SQL atómica desde rol pasajero inicial **sin historial** hacia un único rol \`driver\`. Rechaza rol mixto/admin/cuenta ya usada para viajes/envíos de pasajero. Audita \`pending_compliance\` con replay idempotente.
**Crítico:** DRIVER de onboarding NO implica licencia, autorización comercial, GPS, vehículo ni derecho de aceptar ofertas. No hay signup real conectado a la nueva app.

## G19 — Verificación de evidencia Storage
**Archivos:** \`server/g19-private-driver-evidence-observer.mjs\`, \`g19-private-driver-evidence-observer.test.mjs\`, \`g19-evidence-to-g17-integration.test.mjs\`, runtime G4 actualizado.
**Logro:** adaptador inyectado \`getObjectMetadata + downloadObject(version-pinned) + scanBytes\`. Valida bucket privado, objeto UUID, propietario, revisión inmutable, MIME/extensión/magic, tamaño <=5 MiB, hash SHA-256 calculado de bytes reales, veredicto \`clean\` de escáner externo y revisión repetida de metadatos después del escaneo.
**Bloqueo REAL:** NO existe proveedor Storage versionado/escáner antivirus auténtico conectado. Sin esos 3 adaptadores el runtime no permite registro. Los scanner tests son fakes SINTÉTICOS, no evidencia de archivo real libre de malware.
**Documento:** \`docs/architecture/G19_PRIVATE_DRIVER_STORAGE_OBSERVATION_2026-10-22.md\`.

## G20 — La licencia más reciente condiciona el despacho
**Archivos:** \`G20_DRIVER_KYC_PREFLIGHT_FENCING_POSTGRES_CI_ONLY.sql\` y asserts, \`server/g20-driver-kyc-readiness-repository.mjs\`, gateway y tests HTTP, Driver \`driver-license-readiness.mjs\` + tipos/test.
**Logro:** RPC servicio \`mobility_stage_driver_current_license_approved\` requiere la **evidencia de licencia más reciente** aprobada por Admin exclusivo y auditada; no rescata antigua licencia aprobada si hay nueva pendiente/rechazada. Endurece preflights originales AUTO y courier antes de ofrecer y **al aceptar** oferta. No ignora licencia vencida, seguro, ubicación o regulaciones; MOTO pasajeros continúa DENEGADO.
**API:** \`GET /v1/staging/driver/license-readiness\` con respuesta mínima \`currentLicenseApproved\`; siempre \`driverEligible=false\`, \`liveOperationsEnabled=false\`, \`verificationScope=CURRENT_LICENSE_REVIEW_ONLY\`.
**Documento:** \`docs/architecture/G20_CURRENT_LICENSE_KYC_ACCEPTANCE_FENCE_2026-10-22.md\`.

## G21 — Integración real de módulos de UI Driver (aún sin Auth remoto)
**Archivos:**
- \`apps/movete-driver/src/domain/driver-workspace.mjs\`
- \`src/domain/driver-workspace.d.mts\`, \`driver-workspace.test.mjs\`
- \`src/DriverWorkspaceProvider.tsx\`
- \`app/_layout.tsx\`, \`app/index.tsx\`, \`app/documentos.tsx\`, \`app/ofertas.tsx\`.
**Logro:** un único estado efímero que agrega ofertas, estados documentales y licencia revisada, con actualización atómica, cache privada borrada al logout, cambio de cuenta, caída de conexión o error de token/rol. Control de generaciones bloquea respuestas tardías de otro actor. Estado UI \`not-configured/signed-out/loading/connected/offline/authorization-required\`.
**Pantallas:** Inicio muestra estado honesto; Documentos presenta revisiones minimizadas solo cuando hay sesión; Ofertas muestra SOLO ofertas privadas vigentes y su TTL cuando hay sesión. Disponibilidad sigue siendo switch **local DEMO**, sin publicar GPS; aceptación/rechazo no activada.
**Bloqueo:** \`DriverWorkspaceProvider\` monta \`authAdapter=null,apiOrigin=null\` por defecto. Esto es intencional; no hay login real configurado ni usuarios reales.

## G22 — Puente SDK Auth preparado, verificación doble
**Archivos:** \`apps/movete-driver/src/domain/driver-staging-auth.mjs\`, \`.d.mts\`, \`.test.mjs\`, \`driver-staging-auth-workspace.test.mjs\`.
**Logro:** interfaz para SDK público de Auth inyectado: valida \`getSession\` y caducidad, corrobora identidad vía \`getUser(jwt)\`, confirma usuario no anónimo/email-teléfono confirmado, exige que coincidan IDs y consulta backend Driver \`license-readiness\` por bearer para validar rol con el servidor; usa \`onAuthStateChange\` sin propagar credenciales a UI. Test end-to-end en memoria SDK → servidor falso → G21 verifica logout/cambio de cuenta/conexión y borra estados.
**Límite:** NO se incluye ni configura proveedor Supabase real, URL remota, llaves, almacenamiento seguro de JWT ni el adaptador conectado al layout. Los adaptadores \`127.0.0.1\` QA no funcionan tal cual desde teléfonos físicos (apuntan al propio teléfono). No trasladar el backend a LIVE sin diseño STAGING seguro, TLS y aprobación.

**Documento único G21/G22:** \`docs/architecture/G21_G22_DRIVER_SESSION_UI_AUTH_BRIDGE_2026-10-22.md\`.

---

# 6. PROGRESO ACTUAL DEL ARQUITECTO B (OBSERVADO, NO APROPIADO POR A)

Rama B \`79e52792...\`; **PR #8 DRAFT**; control de edición y aislamiento SUCCESS. Su rama NO está incorporada en A y ha divergido, por lo que no comparar la UI de A directamente con archivos B ausentes.

**Cliente B:**
- App independiente \`apps/movete-cliente\`: inicio, viaje AUTO, envíos, comercios, cotización, cuenta, pagos simulados, seguimiento, historial y soporte.
- Estado de sesión y Auth inyectados con invalidación de datos al logout/cambio de usuario. Sin sesión real.
- \`client-experience\`, \`client-mutations\`, \`client-gateway\`, \`quote-view\`, \`rider-status\`, \`rider-polling\`, \`history-feed\`, \`commerce-draft\`, \`delivery-form\` y validadores, con pruebas Node y web export bajo \`movete-apps-isolation\`.
- Estados y respuestas fail-closed: no inventar conductor asignado, GPS/ETA, precios, stock, pagos ni historial. Riders MOTO siguen deshabilitados.
- Contratos backend reales faltantes bloquean solicitudes/cobros/tracking.

**Admin WEB B:**
- \`apps/movete-admin\` (Vite + React + TypeScript) **solo en rama B**.
- \`AdminRuntime\`, \`admin-session\`, \`admin-experience\`, \`admin-access\`, cola KYC, revisión de borrador, zonas, incidentes y dashboard financiero solo Owner, todos en modo QA sin datos operativos.
- Separa \`owner\` (indicadores de ganancias, sin privilegios KYC heredados) y \`admin\` (revisión KYC con permisos) bajo MFA simulada/injectada; no Auth backend real ni finanzas reales.
- Modelo DTO financiero en Gs, reconciliación, revisión monotónica y ausencia de PII en interfaces. NO hay endpoint backend Owner-finance certificado; es una solicitud a A en issue #9.
- **ALERTA P0:** ni tests ni TypeScript/build web específicos de \`apps/movete-admin\` estaban integrados en los workflows globales al corte. Los checks verdes de PR #8 no certifican este binario WEB. **A debe añadir job aislado en \`.github/workflows/**\`**, que B no puede editar, por ejemplo: \`cd apps/movete-admin && npm install --no-audit --no-fund --ignore-scripts && npm run check && npm run build\`. Poner triggers por \`apps/movete-admin/**\`, preservar frontera de propiedad.

**Handoff diario B:** \`docs/architect-b/STATUS_Y_CONTRATOS.md\`, \`QA_INTEGRACION_FRONTENDS_2026-10-22.md\`, \`OWNER_DASHBOARD_FINANCE_RBAC_2026-10-22.md\`, \`ADMIN_ZONAS_INCIDENTES_SEGURIDAD_2026-10-22.md\`.
**Issue backend:** https://github.com/mezas3238-hue/Qore-mobile-/issues/9 — sigue ABIERTO.

---

# 7. PROBLEMAS ENCONTRADOS Y LECCIONES (NO OCULTAR)

| Clave | Hallazgo | Medida realizada / pendiente |
|---|---|---|
| P01 | Antiguo proyecto \`mobility-expo\` mezcla conductor/pasajero/admin DEMO. | Se crearon dos apps Expo separadas; **NO lanzar el laboratorio mixto**. |
| P02 | Pruebas de push asumían ACK proveedor equivalente a entrega al teléfono. | G12/G13 separan claim/ACK/receipt, con fencing y polling G15/G16; receipts físicos aún pendientes. |
| P03 | Carrera de dos workers/couriers podía duplicar asignación. | \`SKIP LOCKED\`, pruebas concurrentes G12/G13/G14 y un ganador; faltan pruebas carga y caídas reales. |
| P04 | Sin fallback polling, Driver perdía ofertas aunque existían. | G15 courier y G16 AUTO, privados y con TTL. |
| P05 | Fixture Auth G1 crea rol pasajero por defecto, chocaba con rol Driver/Admin sintético. | Tests de roles exclusivos y G18 reemplazo atómico controlado; aún falta Auth real. |
| P06 | Solicitudes KYC podían aceptar metadatos afirmados por la app. | G19 obliga observación desde Storage+hash+escáner; **scanner/proveedor real NO instalado**. |
| P07 | Registro de licencias no impedía usar antigua aprobación ante nuevo documento pendiente. | G20 enlaza última revisión al preflight en creación/aceptación. |
| P08 | SQL de pruebas inicialmente creaba pasajero duplicado por trigger. | Fixture G20 corregido para comprobar único rol en lugar de insertarlo dos veces. |
| P09 | CI G20 encontraba conductor con un viaje sintético activo previo. | Fixture cierra/cancela viaje G16 conforme índice \`one-active-driver\`, sin deshabilitar restricción. |
| P10 | Patrón UUID mal formado en gateway G20 causó fallo Node con identificadores válidos. | Expresión \`8-4-4-4-12\` corregida, revalidación posterior en CI. |
| P11 | Un usuario pudiera ver ofertas/documentos de otra sesión por respuestas tardías. | G21/G22 invalidan estado y usan generación monotónica; Auth real/dispositivo aún por probar. |
| P12 | El backend/cliente no tienen proveedor STAGING HTTPS autorizado. | Se mantienen \`127.0.0.1\` y ausencia de configuración; se requiere TLS y revisión de red antes de conectar móviles. |
| P13 | OpenAPI contiene rutas pero DTO Passenger/Admin, roles y respuestas no están cerrados. | Issue #9, contratos versionados y adversarial CI pendientes de A. |
| P14 | Rama B diverge de A y puede estar atrasada sin tocar carpetas comunes. | Propiedad exclusiva y CI boundary; coordinar integración por contrato, **sin merge automático**. |
| P15 | UI/Admin WEB no tiene gate de \`npm run check && npm run build\`. | Pendiente P0 de A en \`.github/**\`; NO declarar Admin certificado. |
| P16 | Comisiones 10/15/12 %, tarifas AUTO/MOTO y costos de mapas aparecen en investigaciones DEMO. | No son contratos económicos productivos; falta prueba de mercado actualizada, rentabilidad y aprobación por Gs/servicio/zona. |
| P17 | MOTO pasajeros y farmacia tienen restricciones legales/seguros por categoría/zona. | Mantener bloqueos; investigación/aprobación jurídica pendiente. |
| P18 | Web export y TypeScript no demuestran APK/IPA, GPS callejero ni UX en señal débil. | E2E físico, instalación firmada y permisos pendientes. |
| P19 | No hay descarga privada real para Admin ni política de retención de KYC. | Diseñar enlaces efímeros, autorización por acción, redacción PII, acceso auditado, borrado y seguridad jurídica. |
| P20 | Calificación de soporte/SOS en UI puede confundirse con seguridad activa. | Etiquetar siempre QA/no live hasta operacionalización, proveedores y protocolos. |
| P21 | G17 revisión de un solo documento no habilita automáticamente todos los documentos/vehículo. | G20 comprueba solo última licencia, se requieren otros gates y política documental completa. |
| P22 | No hay botón operativo de aceptar ofertas ni almacenamiento de JWT en el layout Driver. | Mantener bloqueado hasta Auth seguro y E2E real; no fingir función completa. |

Los fallos históricos de CI (G12 quoting/shell, G16 rol, G18 usuario fixture, G20 UUID/estado activo, B carrito UUID) tienen correcciones documentadas y pasaron checks posteriores. No reproducirlos haciendo cambios innecesarios en producción.

---

# 8. TODO LO QUE FALTA — ROADMAP PRIORIZADO PARA PRÓXIMO ARQUITECTO A

## P0 — iniciar inmediatamente, sin tocar B
**A01. Confirmar el estado soberano**: consultar PR #7/#8, SHA HEAD por rama, checks asociados al nuevo HEAD (no al anterior), issue #9, diff de propiedad. Leer este handoff y docs/architecture G16–G22. NO MERGE.
**A02. Certificación CI Admin WEB**: agregar **solo en \`.github/workflows/**\`** un workflow dedicado para \`apps/movete-admin/**\` de PR #8 (y opcional ejecución manual) con Node 22, \`npm install\`, \`npm run check\`, \`npm run build\`; paths correcto en PR vs base A; diagnosticar si falla y pedir a B que corrija archivos B. El workflow no debe desplegar ni usar credenciales. Agregar validaciones de secretos al output si aplica. Esta es dependencia clara de B.
**A03. Contratos a B / issue #9**: crear schemas OpenAPI estrictos y pruebas de Auth Passenger/Admin (incluye owner solo para finanzas), MFA servidor Admin, códigos 401/403/409/410/429/503, roles exclusivos, fallos y expiración. Fijar estructuras de respuesta, versiones, paginación, autorización de recurso y revocación. Publicar SHA al B por issue.
**A04. Contrato viaje Cliente**: \`GET /v1/staging/rider/trips/{tripId}/status\` con \`revision\` monotónica y \`locationObservedAt\`, sin exponer datos antes de asignación confirmada; \`POST cancel\` idempotente, carreras y fee/reembolso simulado.
**A05. Contrato cotización Cliente**: \`POST /v1/staging/fares/quote\` con \`quoteId\`, \`amountGs\` entero, \`fareVersion\`, expiración, \`routeEvidence\`, distancia/tiempo verificados. Sin montos inventados por front; separar AUTO viajes, MOTO carga y comercial; MOTO pasajeros cerrados.
**A06. APIs Admin / dueño**: rol \`admin\` para cola KYC, revisión, zonas, suspensiones/incidentes y URL de lectura KYC efímera; rol separado \`owner\` para dashboard financiero Gs conciliado y sin permisos KYC. Ningún usuario web conoce llave \`service_role\`. MFA/permiso por acción/auditoría en servidor; CSRF/origen según sesión transportada.
**A07. Contratos B comercio/historial/soporte**: catálogo/stock sucursal por zona, pedidos y pagos simulados, historial paginado propio, recibo, incidente, estados de entrega y cancelaciones; privación por usuario/merchant, TTL y no PII.
**A08. Mantener integración sin sobrescribir B**: B rama diverge; pactar payloads y errores, no copiar archivos entre apps y no hacer rebases/merges sin orden. Revisión cruzada de contratos en PRs DRAFT.

## P1 — Auth y KYC Driver / backend auténtico de STAGING
**A09. Diseño de entorno STAGING seguro**: autorización Owner primero; separate dev/staging/prod, credenciales propias, TLS, URLs permitidas, aislamiento de datos sintéticos, secreto fuera del repositorio y límites de costo. \`127.0.0.1\` QA no es servicio accesible en móviles físicos.
**A10. Auth Driver real (STAGING autorizado)**: elegir SDK público/configuración segura, persistencia cifrada de sesión, refresh/revocación, cleanup/logout/cambio de usuario, roles exclusivos; conectar G22 al \`DriverWorkspaceProvider\` solo por composición segura. No aceptar JWT local sin \`getUser\` y verificación backend. Verificar 401/403/429/503 en dispositivos.
**A11. Storage privado real de prueba**: objetos versionados inmutables, bucket por usuario, validación de propietario, MIME/bytes/huella, escáner real actualizado, cuarentena, límites CPU/tamaño, retención/borrado y URL admin temporal auditada. **No habilitar G17 si G19 no puede observar con version fencing.**
**A12. Tipos de KYC y cumplimiento**: licencia, cédula, seguros, autorización municipal, revisión de antecedentes donde legal, propietario de vehículo, expiraciones/recordatorios y categorías de documentos auditadas por localización. Retener RLS y revisión Admin explícita, no autoaprobar.
**A13. Elegibilidad G2/G20 E2E**: vehículo AUTO/MOTO, licencia más reciente, seguros vigentes, inspección, consentimiento GPS, cargo permitido, status zona. Probar revocación durante oferta, viaje y reconexión; política de viaje ya iniciado distinta de comenzar uno nuevo, con seguridad.
**A14. Completar UI Driver funcional en QA autorizado**: onboarding, estados pendientes/aprobados/rechazados, subida privada auditada, disponibilidad con consentimiento y revocación, buzón ofertas, aceptar/rechazar con clave de idempotencia estable, navegación y pruebas de entrega, ganancias de ledger simulado. No dar por completo si solo hay adaptador .mjs.
**A15. Dispositivos y accesibilidad**: dos apps separadas instaladas en Android/iOS test, permisos GPS y notificaciones consentidas, background/foreground, señal mala, suspensión, token revocado, cuenta equivocada, caídas y sincronización. Sin publicación tiendas por defecto.

## P2 — Backend logístico y económico completo
**A16. Despacho/GPS reales**: ranking de conductores elegibles por zona y ubicación fresca, backoff, TTL, confirmación servidor, ETA por carreteras verificadas, radars sin revelar GPS antes de aceptación, reasignación cuando conductor rechaza.
**A17. Delivery/custodia/merchant**: proceso de tienda/compra, picking, asignación, recogida, OTP/prueba entrega, retorno/fallo, sustitución/no stock, cancelación, reembolso simulado; farmacias OTC con control regulatorio; límites carga MOTO.
**A18. Push/resync**: proveedor con garantías de idempotencia/outcome probado, ACK vs device receipt, fallback polling, expiración, múltiples workers, offline/recovery, métricas y costes; nunca declarar exactamente-una-entrega sin evidencia.
**A19. Economía**: estudio actualizado competidores, matriz de tarifas por servicio/zona/autos/motos/carga, costos Google Maps/rutas, elasticidad, márgenes/ganancias de conductores/empresa, impuestos, descuentos, comisiones y ledger/reembolsos. Tratar porcentajes históricos como escenarios no aprobados. PSP real solo con aprobación/legales.
**A20. Seguridad e incidentes**: SOS operativo revisado legalmente, soporte humano/protocolo, suspensiones, rate limit, antifraude, auditoría, minimización de datos, consentimientos, borrado y recuperación. Nunca confundir demo con emergencias reales.
**A21. Robustez/certificación**: pruebas de carga, RLS real, multi-tenant/usuarios y comercios, carreras en dos sesiones PG, pruebas E2E cliente ↔ conductor ↔ backend ↔ admin, replay, observabilidad, backups, restore, costos y amenazas.
**A22. Entrega operativa y Lovable**: infraestructura certificada primero; Lovable/UI solo después bajo propiedad de cada arquitecto. Preparar despliegues/dev builds solo con autorización Owner, validación legal, seguridad y producto. Mantener rollback seguro.

## P0/P1 del Arquitecto B — sin que A edite B
**B01–B10:** completar pantallas Cliente, contratos HTTP fallando cerrado, Auth Passenger, cotización, solicitud/cancelación AUTO, seguimiento solo tras aceptación, envíos particulares/comerciales, comercios, pago simulado, historia y soporte; pruebas Expo y dispositivos.
**B11:** Admin web + Owner dashboard con Auth/MFA y permisos backend, cola KYC/redacción PII, zonas e incidentes; build propio CI solicitado a A.
**B12–B13:** interfaz final Lovable solo UI en su ámbito, pruebas E2E e informe/PR #8 DRAFT con evidencia y issue #9.
**B NO implementa** SQL, Auth privileged, tarifas, CI central ni endpoint owner; B solicita a A contratos.

---

# 9. CRITERIOS PARA LLAMAR «COMPLETO» Y NO ENGAÑAR AL OWNER

| Capa | Hecho ahora | Lo que falta para declarar completa |
|---|---|---|
| Separación apps | 2 proyectos Expo independientes y boundary CI | APK/IPA firmadas/test en móviles físicos y pipeline separado de release |
| Driver UI | Pantallas conectadas a controlador G21, Auth bridge G22 preparado | Auth STAGING real, GPS consentido, upload real, oferta/decisión E2E |
| Backend despacho | SQL y Node QA G1–G20 + carreras/concurrencia | STAGING seguro operativo, API/DTO completos, carga/fallo/resiliencia, revisión legal |
| KYC | Manifest, auditoría, fencing licencia, tests sintéticos | Storage/escáner real, admin autorizado, reglamentos, vigencia y revocaciones |
| Cliente | Vistas/validadores/servicios QA en B | API Auth Passenger, backend y tracking/cart/PSP simulados integrados, E2E |
| Admin web | Vite UI aislada, roles/finance modelo en B | CI build propio, MFA y APIs reales autorizadas, KYC privado E2E |
| Economía | Laboratorio de cotización y ledger simulado | Mercado/contratos/PSP/impuestos/costos y autorización Owner |
| Push/GPS/mapas | Outbox/fencing/fallback y rutas demo | Dispositivos, permisos, geocodificación/ETA verificables, proveedores y monitoreo |
| Lanzamiento | NINGUNO | Seguridad/cumplimiento/soporte/observabilidad y orden explícita Owner |

No afirmar que *toda la plataforma funciona ya*, que solo falta Lovable, o que un CI verde equivale a servicio operativo.

---

# 10. COMANDOS Y VERIFICACIONES DE ARRANQUE PARA NUEVO CHAT

**Primero usar el conector GitHub** para confirmar \`HEAD A\`, \`HEAD B\`, estado DRAFT PR #7/#8, issue #9, CI del commit más reciente, antes de editar.

Rutas y comandos cuando se ejecute en clon/runner autorizado:
\`\`\`bash
# Leer por API GitHub o clon de las ramas; NO usar main como fuente de este trabajo.
git status --short
git branch --show-current
git log -1 --format='%H %s'

# Backend A: contratos sintéticos, sin tocar una base real.
cd apps/mobility-expo
npm install --no-audit --no-fund
npm run check
node --test server/*.test.mjs

# Driver A independiente:
cd ../movete-driver
npm install --no-audit --no-fund --ignore-scripts
npm run check
npx expo export --platform web

# Cliente B independiente — B ejecuta/modifica, A puede leer resultados:
cd ../movete-cliente
npm install --no-audit --no-fund --ignore-scripts
npm run check
npx expo export --platform web

# Admin WEB B — A debe añadir job CI; no modificar source de B:
cd ../movete-admin
npm install --no-audit --no-fund --ignore-scripts
npm run check
npm run build
\`\`\`

**Atención CI PostgreSQL:** usar exclusivamente jobs GitHub Actions que crean sus servicios desechables con guardas \`PGHOST=localhost\`, \`PGDATABASE=qore_disposable_chain\`, \`PGAPPNAME=qore_ci_disposable_chain\`. **No ejecutar** archivos \`docs/backend/staging_only/*\` contra Supabase real/remoto ni sin su scaffold.

**Antes de publicar cambios:**
1. no secrets, PII ni credenciales en diff;
2. paths solo de A (o B si ese es el agente B) sin cruces;
3. rutas/response OpenAPI, permisos y flags LIVE en falso;
4. CI completo por SHA, diagnosticar logs y corregir, no dar «SUCCESS» a job que sigue en cola;
5. commit, link, pruebas, bloqueos y próximos pasos en docs/architecture o handoff;
6. PR continúa DRAFT; no merge por iniciativa propia.

---

# 11. REFERENCIAS OBLIGATORIAS — DOCUMENTACIÓN HISTÓRICA EN GITHUB

En rama A:
- \`docs/handoff/DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md\` — límites exclusivos, checklist B01–B13.
- \`docs/architecture/MOVETE_TWO_MOBILE_APPS_2026-10-22.md\` — apps y binarios separados.
- \`docs/architecture/G16_DRIVER_PRIVATE_INBOX_AND_SESSION_QA_2026-10-22.md\`.
- \`docs/architecture/G17_G18_DRIVER_IDENTITY_AND_PRIVATE_KYC_2026-10-22.md\`.
- \`docs/architecture/G19_PRIVATE_DRIVER_STORAGE_OBSERVATION_2026-10-22.md\`.
- \`docs/architecture/G20_CURRENT_LICENSE_KYC_ACCEPTANCE_FENCE_2026-10-22.md\`.
- \`docs/architecture/G21_G22_DRIVER_SESSION_UI_AUTH_BRIDGE_2026-10-22.md\`.
- \`apps/mobility-expo/docs/handoff/HANDOFF_MAESTRO_WORK_MOVETE_FACIL_INFRAESTRUCTURA_2026-10-22.md\` (etapas históricas backend y decisiones).
- \`apps/mobility-expo/docs/handoff/HANDOFF_MAESTRO_CONTINUIDAD_G12_CI_VERDE_2026-10-22.md\` (pruebas de dos sesiones y push).
- \`apps/mobility-expo/docs/handoff/HANDOFF_MAESTRO_INTEGRAL_TARIFAS_INFRAESTRUCTURA_2026-10-22.md\` (tarifas/estudios).
- \`apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json\` (catálogo).

En rama B (NO copiar ni editar por A):
- \`docs/architect-b/INICIO_ARQUITECTO_B_CLIENTE_ADMIN_2026-10-22.md\`.
- \`docs/architect-b/STATUS_Y_CONTRATOS.md\` (cronología y bloqueos B).
- \`docs/architect-b/QA_INTEGRACION_FRONTENDS_2026-10-22.md\`.
- \`docs/architect-b/OWNER_DASHBOARD_FINANCE_RBAC_2026-10-22.md\`.
- \`docs/architect-b/ADMIN_ZONAS_INCIDENTES_SEGURIDAD_2026-10-22.md\`.

**Punto único de coordinación:** [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9) — Auth Passenger/Admin, DTO rider status/quote/cancel, comercios, historial, KYC Admin, zonas, incidentes, finanzas Owner.

---

# 12. INSTRUCCIÓN LISTA PARA PEGAR EN NUEVO CHAT

> Soy el siguiente Arquitecto A de QORE Mobile / Movete Fácil. Debes CONTINUAR TRABAJANDO, no reiniciar desde cero. GitHub es fuente soberana: repo \`mezas3238-hue/Qore-mobile-\`, rama \`feature/mobility-monorepo-isolated-20261016\`, PR #7 DRAFT. Lee primero \`docs/handoff/HANDOFF_MAESTRO_INTEGRAL_QORE_MOBILE_DOS_ARQUITECTOS_G0_G22_2026-10-22.md\` y el handoff de división de dos arquitectos. El Arquitecto B trabaja en rama \`feature/mobility-cliente-admin-parallel-20261022\`, PR #8 DRAFT, solo \`apps/movete-cliente/**\`, \`apps/movete-admin/**\`, \`docs/architect-b/**\`. YO como A solo edito Backend/Driver, OpenAPI, SQL, CI y docs comunes; NUNCA invado B.
>
> Verifica nuevos HEAD y CI, y comienza de inmediato la prioridad P0: 1) añadir gate CI independiente Admin WEB en \`.github/workflows/**\` para que B tenga certificación real de \`npm run check && npm run build\` sin que tú edites su fuente; 2) cerrar issue #9 mediante DTOs Auth Passenger/Admin, status/cancel/quote, Admin KYC/Owner-finance con permisos probados y OpenAPI de A; 3) continuar conexión segura de Driver G21/G22 a Auth STAGING sin falsificar usuarios, documentos o viajes. Mantener dos apps separadas, TODO en QA sintético, PostgreSQL desechable, sin merge ni LIVE ni despliegue, corregir errores hasta CI verde. En cada bloque dejar commit y estado verificable en GitHub. Si hay un bloqueo externo, documentarlo y avanzar en otro trabajo independiente.

# FIN DEL HANDOFF — CONTINUIDAD SIN PÉRDIDA DE CONTEXTO
