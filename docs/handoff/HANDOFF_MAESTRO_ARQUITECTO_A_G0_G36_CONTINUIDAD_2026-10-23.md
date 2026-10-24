# QORE MOBILE / MOVETE FÁCIL — HANDOFF MAESTRO INTEGRAL DEL ARQUITECTO A
## Historial G0–G36, entregables, incidentes, CI, riesgos y continuidad ejecutable
**Fecha de corte:** 23 de octubre de 2026 (Paraguay).  
**Clase:** acta técnica de transferencia entre chats; continuidad sin reiniciar y sin interrupciones injustificadas.  
**Repositorio soberano:** https://github.com/mezas3238-hue/Qore-mobile- (el guion final forma parte del nombre).  
**PR Arquitecto A:** https://github.com/mezas3238-hue/Qore-mobile-/pull/7 — rama **feature/mobility-monorepo-isolated-20261016**, abierta DRAFT.  
**PR Arquitecto B:** https://github.com/mezas3238-hue/Qore-mobile-/pull/8 — rama **feature/mobility-cliente-admin-parallel-20261022**, abierta DRAFT.  
**Issue A↔B:** https://github.com/mezas3238-hue/Qore-mobile-/issues/9.

> ORDEN EXPRESA DEL OWNER: el siguiente Arquitecto A debe CONTINUAR EL TRABAJO SIN DETENERSE, implementar, probar y corregir, pasar a la tarea siguiente tras cada cierre, pedir intervención solamente ante un BLOQUEO REAL de acceso, seguridad, autorización, legalidad, datos externos indispensables o conflicto efectivo de propiedad. Ningún «¿continúo?» repetitivo para commits, pruebas, documentación, diseño o refactor QA dentro del alcance A. Tampoco debe prometer trabajo en segundo plano que no esté ejecutando realmente.

> GOBERNANZA NO NEGOCIABLE: NO MERGE, NO LIVE, NO despliegue, NO SQL remoto, NO PSP ni dinero real, NO VPS, NO usuarios/documentos personales reales, NO tiendas, NO push real, NO secretos en GitHub, NO modificar archivos del Arquitecto B, NO asumir que CI verde equivale a certificación física/comercial. Se mantiene el trabajo en rama y PR DRAFT hasta orden explícita del Owner.

---

# 01. Resumen ejecutivo inequívoco

Movete Fácil es una futura plataforma de movilidad y logística en Paraguay con despliegue gradual por municipios, zonas y servicios; debe contemplar pasajeros en AUTOMÓVIL, envíos particulares, entregas comerciales de supermercados/restaurantes/farmacias OTC y entregas en MOTOCICLETA donde haya habilitación específica. MOTO PASAJEROS permanece BLOQUEADA hasta resolver seguros, legalidad y autorizaciones por jurisdicción. AUTO y MOTO no pueden tener una tarifa inventada idéntica por defecto. Tarifas y comisiones en guaraníes (Gs/PYG) son autoridad del servidor, nunca de la UI.

El producto tiene **dos aplicaciones móviles físicamente independientes**:
- **Driver**, para conductores/repartidores: apps/movete-driver/**, propiedad A.
- **Cliente**, para pasajeros/compradores/solicitantes: apps/movete-cliente/**, propiedad B.
- **Admin Web** es un panel web aparte, no tercera app móvil: apps/movete-admin/**, propiedad B.
- **Backend central** compartido (identidad, asignación, tarifas, pagos, KYC, seguridad, GPS, zonas, auditoría) está en apps/mobility-expo/** y contratos/CI transversales, propiedad A.

El laboratorio G0–G36 contiene una cantidad considerable de infraestructura, verificaciones Node, HTTP loopback y PostgreSQL 16 DESCARTABLE. **No está disponible una plataforma comercial completa**: falta Auth/MFA/JWT de proveedor auténtico, HTTPS STAGING autorizado, Storage y escáner real, geocerca, GPS/anti-spoof/ETA reales, actores y dispositivos E2E, operaciones de seguridad, conciliación real, PSP, documentación legal y decisión de despliegue. Lovable aportará esencialmente la interfaz definitiva **después** de la infraestructura certificada; nunca reemplaza seguridad ni motor operacional.

**Corte exacto PREVIO A ESTE HANDOFF, verificado en GitHub:**
- A: commit **5e8fc6ef601f0778a603d7a3b30172aaf51f70bc** (G36.4). PostgreSQL #299, Node #531, Expo #1113, aislamiento #441: **4/4 SUCCESS** en EL MISMO SHA.
- B: commit **06e4eebe07acfaa03973e1fd84fc41c54b23e728** al revisar su rama. Su handoff B de cierre recientemente leído registra en un corte propio anterior **194/194 pruebas Cliente PASS** y **131/131 Admin PASS**, junto con CI de tres workflows B; verificar CI exacta del HEAD B actual antes de repetir estas cifras como presentes.
- PR #7 y PR #8: OPEN, DRAFT, merged=false; comprobar de nuevo al abrir el chat.
- **La publicación de este handoff crea un NUEVO commit A**, distinto de 5e8fc6ef; hay que consultar CI de ese nuevo SHA y no trasladar automáticamente el SUCCESS histórico al nuevo HEAD.

**Evidencia A G36 4/4 del corte anterior:**
- PostgreSQL #299: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39959725292
- Node #531: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39959725390
- Expo #1113: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39959725298
- Dos apps/aislamiento #441: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39959725649

---

# 02. Ubicación y fuentes soberanas: no empezar desde cero

**Ruta de este handoff**: docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G36_CONTINUIDAD_2026-10-23.md.

**Antecedentes obligatorios, preservar y leer (NO reescribir):**
1. docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G26_4_CONTINUIDAD_2026-10-23.md — 416 líneas de historia, acciones, 36 riesgos, decisiones y plan A01–A17, contiene SHAs y enlaces anteriores.
2. docs/handoff/HANDOFF_MAESTRO_INTEGRAL_QORE_MOBILE_DOS_ARQUITECTOS_G0_G22_2026-10-22.md — origen G0–G22, cientos de líneas de evidencia histórica.
3. docs/handoff/DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md — límites de propiedad A/B.
4. docs/architecture/G24_G26_CLIENT_API_QUOTES_CANCELLATION_HISTORY_QA_2026-10-23.md.
5. docs/architecture/G26_5_HISTORY_MVCC_EVENTUAL_CONSISTENCY_2026-10-23.md.
6. docs/architecture/A03_PRIVATE_HISTORY_CURSOR_KEY_ROTATION_2026-10-23.md.
7. docs/architecture/A04_1_BACKOFFICE_JWT_RBAC_MFA_QA_2026-10-23.md.
8. docs/architecture/G27_A04_2_BACKOFFICE_ROLES_POSTGRES_QA_2026-10-23.md.
9. docs/architecture/G28_ADMIN_INCIDENTS_SQL_READ_QA_2026-10-23.md.
10. docs/architecture/A05_4_G29_G30_BACKOFFICE_KYC_AUDIT_POSTGRES_QA_2026-10-23.md.
11. docs/architecture/A05_5_G31_ZONE_COVERAGE_OBSERVED_AVAILABILITY_QA_2026-10-23.md.
12. docs/architecture/G32_DRIVER_LOCATION_QA_QUARANTINE_CONSENT_RACE_2026-10-23.md.
13. docs/architecture/G33_QA_QUARANTINED_ZONE_AGGREGATION_NO_AVAILABILITY_2026-10-23.md.
14. docs/architecture/G34_LOCATION_CONSENT_REVISION_AUDIT_QA_2026-10-23.md.
15. docs/architecture/G35_DRIVER_DOCUMENTARY_SERVICE_QA_NO_DISPATCH_2026-10-23.md.
16. docs/architecture/G36_CROSS_SERVICE_DRIVER_ATOMIC_SLOT_2026-10-23.md.
17. apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json — contrato OpenAPI central; no inferir que está desplegado.
18. Issue #9: comunicación continua de progreso y requisitos de integración con B.
19. docs/architect-b/HANDOFF_MAESTRO_B_CIERRE_Y_CONTINUIDAD_2026-10-23.md — **LEER exclusivamente desde rama B**, no copiar ni editar sus carpetas.

**Leer código exacto de HEAD actual**, no fiarse de snippets desactualizados ni de la memoria del chat. No tocar qore-core/trading. Los paths anteriores son para ubicar fuentes verificables.

---

# 03. Responsabilidades sin solapamiento

| Área | Arquitecto A (este chat y sucesor) | Arquitecto B (paralelo) |
|---|---|---|
| App Driver instalable | apps/movete-driver/** | NO tocar |
| Backend histórico y Node | apps/mobility-expo/** | NO tocar |
| PostgreSQL, RLS, SQL, OpenAPI central, reglas de negocio | A | leer contratos únicamente |
| Workflows e infraestructura de QA | .github/** y scripts/raíz según corresponda | NO tocar |
| Documentación A y handoffs técnicos | docs/architecture/**, docs/handoff/** | NO tocar |
| App Cliente instalable | NO tocar | apps/movete-cliente/** |
| Admin Web y Owner UI | NO tocar | apps/movete-admin/** |
| Documentos B | NO tocar | docs/architect-b/** |

La PR #8 tiene como base la rama A, por lo que puede divergir. **No rebase, merge, cherry-pick ni force-push** en ninguna de las dos sin acuerdo y orden expresa. La coordinación contractual y de DTO se realiza vía issue #9. A no corrige código B; B no modifica backend A. Probar y documentar con SHA, URL de run, descripción y next steps verificables.

---

# 04. Historial completo G0–G22 construido antes de esta continuidad

| Gate | Construcción y ensayos existentes | Límite no resuelto |
|---|---|---|
| G0 | Monorepo aislado, dos apps móviles Expo separadas y reglas de CI/ramas/PR DRAFT. | Falta binario Android/iOS certificado físicamente. |
| G1 | Auth/RBAC/RLS inicial, Auth scaffold sintético, lockdown histórico, controles de secreto y buckets documentados. | Sin JWT real de proveedor desplegado ni STAGING HTTPS autorizado. |
| G2 | Modelos de Driver/vehículo/licencia/seguro/inspección/municipio y preflight por AUTO/MOTO. | KYC jurídico/documentos de vehículos y licencias reales, moto pasajero bloqueada. |
| G3 | Solicitud/aceptación/transiciones AUTO sintéticas con historial de eventos, claves idempotentes y una carrera activa por Driver. | No viajes físicos, GPS ni precio de cobro. |
| G4 | Ofertas privadas AUTO, TTL, decisión atómica, outbox, HTTP 127.0.0.1, vistas seguras Passenger/Driver. | No push, Auth ni ETA/proveedor GPS de producción. |
| G5 | Envíos AUTO/MOTO por categoría legal, dimensiones/peso, custodia/recibos, revisión de carga y seguro separado de pasajeros. | No courier físico o reclamación real. |
| G6 | Comercios/catálogos/stock/pedidos de QA y vínculos a deliveries. | Datos reales y operaciones comerciales no certificados. |
| G7 | Motor tarifas Gs, comisiones, recibos y ledger de **pagos SIMULADOS**. | Ningún flujo PSP, ingresos reales, contracargos o impuestos certificados. |
| G8 | Incidentes/SOS, moderación, suspensiones y eventos auditables de QA. | Seguridad operativa, emergencias reales y equipo humano pendientes. |
| G9 | Roles/comercios/sucursales/aprobación y operaciones comerciales QA. | Backoffice real, legalidad y stock de negocios pendientes. |
| G10 | Oferta privada courier, aceptación/declinación y revocación del atajo directo G5 bajo service_role. | Sin push y dispositivo real; no reabrir atajo por comodidad. |
| G11 | OpenAPI, contratos y DTO iniciales, validadores de esquema. | Parte de Admin/Owner y errores todavía no completamente certificados. |
| G12 | Push courier claim/ACK/expiry, fencing y reintentos controlados. | ACK servidor no garantiza push entregado a teléfono. |
| G13 | Protección de doble claim, caducidad y recuperación bajo PostgreSQL con sesiones independientes. | Proveedor push real, métricas y monitorización faltan. |
| G14 | Competencia de dos repartidores por un envío: un ganador atómico. | Dispositivo real y riesgo de red pendientes. |
| G15 | Polling privado courier como fallback ante push perdido. | Red de dispositivo y UX offline aún sin certificar. |
| G16 | Inbox y polling AUTO/DELIVERY del Driver; sesiones y revisión de caducidad. | Conectar login, GPS, TTL y notificación real. |
| G17 | Registro documental privado (hash/manifest, MIME, revisiones Admin, metadata auditada). | No contiene bytes, exige Storage + escáner real. |
| G18 | Onboarding de rol Driver EXCLUSIVO, transiciones y bloqueo de doble rol Passenger/Driver. | Autenticación real y verificación documental pendientes. |
| G19 | Observador Storage inyectado, versionado, hash/MIME magic y escaneo simulado/contratado. | No hay proveedor versionado + antivirus genuino certificado. |
| G20 | Última licencia G17 aprobada, licencia G2 vigente y preflight de vehículo para AUTO y courier; rechazo ante nueva pendiente. | No sustituye permiso legal/geocerca/seguro regional ni validación de usuario real. |
| G21 | Workspace Driver con secciones de ofertas, documentos, ganancias y sesión QA. | Aún no es app física operando. |
| G22 | Puente de Auth SDK y manejo de logout, cambio de cuenta, sesión antigua y revocación. | Adaptadores Auth/API siguen fail-closed sin proveedor autorizado. |

El historial documental de G0–G22 está detallado en el handoff original: mantenerlo, no reconstruirlo como nuevas tareas. G23–G26.4 se detallan en el handoff de 416 líneas mencionado arriba.

---

# 05. Fases G23–G26.4 entregadas por el Arquitecto A antes de G26.5

**G23:** CI dedicada al Admin Web en .github/workflows/movete-admin-web-qa.yml sin modificar código B; el primer build falló por dependencias React/tipos, B resolvió. Endpoint estado privado Passenger GET /v1/staging/rider/trips/{tripId}/status y DTO RiderStatusV1; JWT/owner/revisión; ubicación/ETA solo si consentimiento y persistencia verificables. No confundir con GPS real.

**G24:** cotización en Gs derivada exclusivamente del servidor, ID/TTL/versión de tarifa/propietario/sujeto, OpenAPI y controles de rechazo. NUNCA confiar en precio del móvil, nunca inferir autorización moto pasajeros ni PSP real.

**G25:** cancelación idempotente del propietario: POST /v1/staging/rider/trips/{tripId}/cancel con BODY EXACTO que contiene solamente requestKey UUID; rechaza otros actores, estados, duplicados conflictivos; sin inventar fee/refund.

**G26.0:** el primer historial limitaba 50 filas en total; el Owner lo rechazó. ESTE DISEÑO FUE RETIRADO. PROHIBIDO volver a limitar registros globales.

**G26.1–G26.3:** historial de propietario de trips, deliveries, commerce con HMAC, keyset de 50 por página y nextCursor hasta null. Comprobaciones de 1.200 filas/24 páginas y **31.200 filas/624 páginas** en SQL real descartable, sin duplicados, indexado, RLS y pruebas HTTP. El cliente B YA TIENE client-history-gateway.mjs: no duplicarlo. El cursor usa identidad, expiración y proyecto servidor. 50 por página NO significa 50 registros como límite del usuario, Driver, historial, documentos ni pedidos.

**G26.4:** inmutabilidad de owner/request_key/created_at histórico y rechazo de backdating mediante triggers, ensayos reales en PG16; ciclos de vida legítimos siguen permitidos.

Riesgos resueltos: cantidad total ilimitada en páginas, regex UUID 8-4-4-4-12, cálculo correcto de lecturas HTTP, G23 Admin CI, DTO de Rider status. Riesgo abierto al corte G26.4: READ COMMITTED no conserva MVCC snapshot entre páginas.

---

# 06. G26.5 — MVCC real del historial, consistencia eventual

**Commit:** 059063a03dda95be054a28109c414e8a2946b229.  
**Archivos:** apps/mobility-expo/server/g26-history-mvcc-concurrency-ci.py; docs/architecture/G26_5_HISTORY_MVCC_EVENTUAL_CONSISTENCY_2026-10-23.md; workflow PostgreSQL.

- Dos transacciones independientes, 55 viajes y cursor 50/página. Una inserción confirmada tarde detrás del cursor se incorpora en página posterior; otra confirmada delante del cursor requiere **refrescar desde página uno**.
- Declaración técnica precisa: READ COMMITTED + ancla created_at no equivalen a snapshot MVCC duradero de toda la sesión. La semántica defendible es consistencia eventual, resync por refresh y deduplicación por ID+tipo. NO prometer snapshot totalmente estable.
- CI del commit G26.5: PostgreSQL #207, Node #396, Expo #946, aislamiento #307, 4/4 SUCCESS.
- Pendiente: contrato productivo de invalidación/reinicio por cambio de sesión, retención y pruebas de escala fuera de laboratorio.

# 07. A03 — Secreto HMAC dedicado y rotación de cursores

**Commit:** 0e97384d7a6cf09ec731cfb79d9673ce0bf9446c.  
**Archivos:** g26-rider-history-gateway.mjs, g4-staging-runtime.mjs, run-g4-local-staging-radar.mjs, mocks/tests; docs/architecture/A03_PRIVATE_HISTORY_CURSOR_KEY_ROTATION_2026-10-23.md.

- Cursores v1.payload.HMAC-SHA256 firmados con claves current y previous en ventana de rotación, límite 200 caracteres, vinculación a owner/servicio/expiración.
- Clave dedicada QORE_HISTORY_CURSOR_SIGNING_KEY, anterior QORE_HISTORY_CURSOR_PREVIOUS_KEY, ambas **SOLO SERVIDOR**. El servicio rechaza reutilizar serviceKey/anonKey privilegiadas para HMAC; sin secretos reales en GitHub.
- CI: PostgreSQL #208, Node #398, Expo #948, aislamiento #314, 4/4 SUCCESS.
- Pendiente: secret manager y rotación probada sobre un STAGING HTTPS autorizado, métricas sin log de firmas/token y gestión de invalidación productiva.

# 08. A04.1 / G27 — Identidad Admin y Owner independiente en QA

**A04.1 commit:** f10f06befe711efff295a14d11e7a049ed8508d3.  
**G27:** ver docs/architecture/G27_A04_2_BACKOFFICE_ROLES_POSTGRES_QA_2026-10-23.md y sus tests.

- Gateway aislado g27-backoffice-session-gateway.mjs para GET /v1/staging/admin/session y GET /v1/staging/owner/session; necesita JWT verificado por proveedor inyectado, rol exclusivo, sesión vigente/no revocada, MFA AAL2 ligado a user+session reciente, scope preciso y rate limiting. Resultado de QA sin acceso a datos habilitado.
- SQL G27 de registro autoritativo de permisos Admin/Owner en PostgreSQL desechable. Bloquea superposición de permisos nativos, rol secundario, usuarios suspendidos, role mix y acceso Owner→Admin o Admin→Owner indebido. Source scopes mínimos, DB fail-closed.
- Test Node y SQL de rol, JWT falso/expiry/revocación, AAL2 y autorización. El gateway NO está respaldado aún por un proveedor Auth real ni conectado al internet; Admin WEB B se mantiene deshabilitado hasta verificación.
- A04.1 CI 4/4 SUCCESS: PostgreSQL #209, Node #400, Expo #950, aislamiento #315. G27 posteriores incluidos en toda la cadena G36 verde.
- P0 abierto: Auth provider real, issuer/audience, revocación a nivel de sesión, AAL2 real, Owner separado, claves/rotación, RLS end-to-end; configurar HTTPS STAGING sólo tras autorización Owner.

# 09. A05.1–A05.4 / G28–G30 — Backend lectura Admin

**Contratos acordados con B en issue #9:**
1. GET /v1/staging/admin/vehicle-review-queue — admin.kyc.read.
2. GET /v1/staging/admin/zones/overview — admin.zones.read.
3. GET /v1/staging/admin/incidents/queue — admin.incidents.read.
4. GET /v1/staging/admin/audit/events — admin.audit.read.
5. GET /v1/staging/owner/finance/summary — owner.finance.read (**SIN fuente real, permanece DENEGADO**).

- Gateway/composición QA de backend A: g28-backoffice-sql-read-repository.mjs, g28-backoffice-qa-composition.mjs, pruebas de HTTP 127.0.0.1, JWT+AAL2 de adaptadores sintéticos, scope/cursor/fail-closed, no permisos del browser para SQL. B tiene su propia capa de consulta ya implementada pero desactivada. Sin proveedor real no abrir web.
- **G28 incidentes:** lectura privada desde G8 de fuente verdadera de incidentes; prueba 121 eventos sintéticos, páginas 50/50/21, propietario/permisos/rol exclusivos, rechazando Owner y sesiones mixtas. Documento G28_ADMIN_INCIDENTS_SQL_READ_QA_2026-10-23.md.
- **G29 KYC AUTO:** cola desde G2 y documentos G17; 121 expedientes 50/50/21, excluye moto pasajeros y no deriva permisos moto cargo de campos moto pasajero. DTO minimal con vehicleId, vehicleKind, applicationStatus, licenseStatus, insuranceStatus, inspectionStatus, reviewRevision; sin nombre, placa, foto, Storage key ni documentación personal.
- **G29.1 fecha real:** un documento aprobado NO cuenta como vigente si G2 no certifica por separado validez y fecha de expiración. Pruebas de licencia vencida/pendiente/expediente rechazado.
- **G30 auditoría parcial:** lectura de eventos G8 de incidentes, suspensiones y revisión de vehículo G2: 123 eventos en 50/50/23, sin PII; NO es todavía audit log universal de tarifas, consentimiento, KYC, finanzas, accesos, permisos y zonas.
- **CI de último hito G29/G30:** commit 76497dd68fdd17b22049a6e577dc89ad9e5cba57, PostgreSQL #246, Node #459, Expo #1022, aislamiento #372, 4/4 SUCCESS.
- **No confundir** rutas declaradas/testeadas en laboratorio con un Admin conectado por HTTPS a los usuarios. El 5º scope Owner Finance queda fail-closed: G7 usa dinero simulado. No generar balances falsos.

# 10. A05.5 / G31 — Cobertura por zona NO es disponibilidad

**Commit final QA:** 675a4c82b704be13c0026c0457738d3038be9a8f.  
**Doc:** docs/architecture/A05_5_G31_ZONE_COVERAGE_OBSERVED_AVAILABILITY_QA_2026-10-23.md.

- Tabla privada mobility_stage_g31_zone_coverage: combinación zona UUID + servicio AUTO_RIDE, AUTO_DELIVERY o MOTO_DELIVERY, municipio PY, estados ACTIVE/PLANNED/PAUSED/CLOSED. Sin geografía licenciada real; elegibilidad comercial está bloqueada mediante eligible_by_policy=false incluso si coverageStatus=ACTIVE de fixture.
- Tabla separada mobility_stage_g31_zone_observations: observación server-only sintética por zona+servicio, timestamp y número de vehículos de guardia. No almacenar GPS/PII del Driver en el DTO. No se concede INSERT/UPDATE sobre observaciones a navegador ni service_role.
- Lectura Admin privada mediante mobility_stage_g31_admin_zone_page y cursor zona+servicio, máximo 50 por página, sin límite total de municipios o filas. TTL de muestra fresca **60 s**, conforme proyector B. Ante muestra vencida o ausente el transporte responde onDutyVehicles=0,availabilityObservedAt=0 COMO SENTINELA **DESCONOCIDO** (B proyecta availabilityFresh=false/onDutyVehicles=null), NO como certeza de cero conductores.
- Pruebas 121 combinaciones (50/50/21), sensores frescos de AUTO=7 y MOTO_DELIVERY=3, sensores de 70s/10min vencidos, casos sin muestra, scope solo Admin, ID de servicio distinto para misma zona; ensayo grande **30.030 filas, 601 páginas**, 0 duplicados, tiempo medido ~509ms dentro de CI descartable (NO SLA nacional).
- Último CI: PostgreSQL #258, Node #475, Expo #1043, aislamiento #388, 4/4 SUCCESS.
- Pendiente GRANDE: polígonos reales y licencias geográficas de municipios paraguayos, normas de zonificación y legalidad, telemetría confiable y consentimiento, cumplimiento de seguros, disponibilidad/ETA realmente conectados, no confundir observaciones con aptitud del Driver.

# 11. G32 / G31.3 — Ingreso seguro de señales GPS del Driver a CUARENTENA QA

**Commit final:** 5614b3acf4c557c5739f48c74b17e72cf0518b1b.  
**Doc:** docs/architecture/G32_DRIVER_LOCATION_QA_QUARANTINE_CONSENT_RACE_2026-10-23.md.

- Función Node sin listener HTTP: g32-driver-telemetry-intake-qa.mjs; requiere token Driver exclusivo verificado/revocable, rate limit, consentimiento activo anterior a captura, integridad independiente del sensor, geocerca atribuida server-side, elegibilidad por servicio, timestamp de captura reciente y exactitud numérica <=50m. Cliente solo proporciona eventId, sequence, capturedAtMs y location; NO decide conductor, municipio, zona o tarifa. El verificador GPS real sigue sin proveedor.
- Persistencia privada en mobility_stage_g32_signal_quarantine y estado monotónico mobility_stage_g32_signal_state. RPC G32 de PostgreSQL valida de nuevo rol Driver exclusivo G1, consentimiento G2, zona G31, timestamp, secuencia monotónica, UUID único y revocación simultánea mediante advisory lock por Driver y FOR SHARE sobre consentimiento; errores fail-closed. No guarda coordenadas completas en la cuarentena.
- Node persistence QA adapter g32-driver-telemetry-persistence-qa.mjs y pruebas negativas; no filtra service_role ni datos de localización al frontend. Se corrigió un regex UUID que inicialmente rechazaba IDs correctos.
- Dos conexiones PostgreSQL reales: misma secuencia → exactamente UNA inserción; transacción concurrente que revoca consentimiento → siguiente señal rechazada. Pruebas de sesiones, spoof simulado, hora futura/vencida, área PY, rol falso.
- **No existe promoción de G32 a G31**. HTTP positivo 202/LOCATION_QA_QUARANTINED con productionEnabled=false,availabilityConfirmed=false,dispatchAuthorized=false.
- CI final PostgreSQL #270, Node #493, Expo #1064, aislamiento #410, 4/4 SUCCESS.
- Pendiente: proveedores reales Auth, integridad del teléfono, GPS antiburlas, geocercas legales, privacidad de retención, scopes de token y red autorizada, geofencing dentro de normativa.

# 12. G33 / G32.3 — Agregación diagnóstica privada de las señales en cuarentena

**Documento:** docs/architecture/G33_QA_QUARANTINED_ZONE_AGGREGATION_NO_AVAILABILITY_2026-10-23.md.

- SQL G33 obtiene la **última señal global** de cada Driver para no contarlo dos veces al mudarse de zona/servicio; considera recientes solo <=30 segundos, captura/aceptación anteriores al ancla.
- Métricas separadas quarantinedRecentSignals y consentingIdleCandidates. La segunda reevalúa consentimiento vigente, rol Driver exclusivo, driver_locations.available fresco <=60s, ausencia de viaje G3 activo y ausencia de delivery G5 activa. Esto sigue SIN probar KYC, voluntad de aceptar, GPS genuino ni disponibilidad de producción.
- Prueba real: zona origen 5 señales recientes y 1 candidato, otro Driver trasladado aparece solamente en segunda zona, una revocación adicional baja candidatos a 0; consulta de rol Passenger/Owner inválido denegada y MOTO_PASAJERO excluida.
- Nodo interno sin listener g33-private-zone-diagnostic-qa.mjs: JWT, scopes y rol SQL G27, rate limiter y MFA AAL2 ligado a sesión, salida sin UUID de Driver, coordenadas ni PII. No se crea sexto endpoint público.
- Siempre devuelve availabilityConfirmed=false,publishedToG31=false,dispatchAuthorized=false,productionEnabled=false. Sin actualización de G31.
- Riesgo abierto: cálculos son diagnóstico sobre señales sintéticas; no publicarlos como conductores «disponibles» en Cliente/Admin real.

# 13. G34 — Versionado real de consentimiento en PostgreSQL de QA

**Documento:** docs/architecture/G34_LOCATION_CONSENT_REVISION_AUDIT_QA_2026-10-23.md.

- Columna revision monotónica y trigger de auditoría privada en mobility_location_consents, con log append-only mobility_stage_g34_consent_audit (OPT_IN,REVOKE,RE_OPT_IN); no GPS, tokens ni PII en log.
- G32 revalidó consentimiento con bloqueo por Driver + fila y **consentRevision exacta**. Si se revoca la versión 1 y vuelve a otorgarse, solo funciona la versión 3; las señales ligadas a revisión 1/2 son rechazadas.
- Pruebas en transacción ROLLBACK: versionado 1 consentimiento, 2 revocación, 3 reautorización, rechazo de versiones antiguas y ausencia de escritura en G31.
- CI conjunto G33/G34, commit documental 495f56ad48f413f534ccfe26c67da1ac49eabbd8: PostgreSQL #280, Node #505, Expo #1080, aislamiento #420, 4/4 SUCCESS.
- Pendiente de migración real: backfill de consentimientos anteriores, reglas de retención y expiración, consentimiento explícito en teléfono y revocación de tokens de proveedor.

# 14. G35 — Verificación DOCUMENTAL de Driver por servicio, jamás autorización comercial

**Commit final:** 6ec96fc8e4b91dc0e667a68aad6e0fae684ac13e.  
**Doc:** docs/architecture/G35_DRIVER_DOCUMENTARY_SERVICE_QA_NO_DISPATCH_2026-10-23.md.

- RPC privada mobility_stage_g35_driver_documentary_diagnostic con admin.zones.read; reúne señal G32 fresca, revisión G34 igual a consentimiento activo, rol exclusivo Driver, driver_locations.available fresco, ausencia de viaje G3 y envío G5 activos y revisión de vehículo/licencia G17/G20.
- AUTO_RIDE exige vehículo AUTO con preflight pasajeros G20 (licencia, revisión, seguro pasajero, inspección y municipio). AUTO_DELIVERY y MOTO_DELIVERY exigen vehículo de clase correspondiente con permiso de CARGA G5 separado, póliza de carga vigente y revisión independiente.
- Respuesta booleana interna candidateEvidenceComplete significa solo concurrencia de evidencias en QA; **zoneEligibleByPolicy,availabilityConfirmed,dispatchAuthorized,productionEnabled son SIEMPRE false**.
- Pruebas reales con documento pendiente que deniega; RPC G17 genuino de aprobación que permite la evidencia; seguro de carga vencido, viaje activo y consentimiento retirado la vuelven a negar; señal de AUTO no sirve para MOTO y carga no habilita viaje pasajero.
- Función privada Node g35-private-driver-evidence-qa.mjs, JWT/RBAC SQL/MFA AAL2 de adaptadores sintéticos y salida estricta sin datos de documento/GPS/PII. SIN listener HTTP.
- 4/4 CI final: PostgreSQL #286, Node #513, Expo #1090, aislamiento #426.
- Pendientes: proveedor Auth verdadero, expediente completo aprobado, actividad/vehicle selection por solicitud, autorización de cada zona, geofence real y ejecución de viaje en teléfono.

# 15. G36 / G36.4 — Reserva ÚNICA transaccional Driver AUTO + DELIVERY

**HEAD A pre-handoff:** 5e8fc6ef601f0778a603d7a3b30172aaf51f70bc.  
**Doc:** docs/architecture/G36_CROSS_SERVICE_DRIVER_ATOMIC_SLOT_2026-10-23.md.

**Problema técnico resuelto:** G3 tenía índice único para un conductor con viaje AUTO activo, y G5 otro índice único para un courier con entrega activa. Cada tabla impedía duplicados dentro de su servicio, pero **no impedía AUTO+DELIVERY simultáneos** del mismo Driver ante dos transacciones independientes.

- Nuevo SQL G36_CROSS_SERVICE_DRIVER_SLOT_POSTGRES_CI_ONLY.sql: tabla privada mobility_stage_g36_driver_slots con PRIMARY KEY(driver_id) global a ambos servicios y UNIQUE(assignment_kind,assignment_id) (dos tipos pueden tener UUID iguales sin colisión falsa). No otorga SELECT/INSERT/UPDATE/DELETE directos a service_role ni móvil/browser. Triggers BEFORE INSERT/UPDATE de G3 y G5 con SECURITY DEFINER/search_path vacío crean o liberan slot atómicamente en el mismo cambio de estado.
- Estatus protegido AUTO accepted/arriving/in_progress; DELIVERY accepted/picked_up/disputed. Rechaza cambiar Driver, vehículo o ID de un servicio activo, detecta cupo perdido y rechaza dos usos simultáneos. Revalida *vehículo seleccionado* vía G20/G5 en aceptación. Estados terminales liberan la reserva exacta.
- Migración simula adopción de trabajos activos anteriores en el esquema desechable, y aborta si existen dos empleos activos del mismo conductor. No oculta ni sanea silenciosamente errores históricos.
- G36_CROSS_SERVICE_DRIVER_SLOT_ASSERT_POSTGRES_CI_ONLY.sql: prueba un Driver G20 legítimo, bloqueo contra UPDATE directo malicioso, cancelación/liberación de AUTO, aceptación courier legítima, recibos idempotentes, bloqueo AUTO durante entrega, liberación tras entrega, nueva aceptación legítima y namespace UUID entre distintos servicios; todo ROLLBACK.
- g36-cross-service-driver-race-ci.py: dos conexiones PostgreSQL independientes compiten por mismo Driver con los RPC de **ofertas privadas** G4/G10 vigentes; test 1 AUTO gana y DELIVERY rechaza con SQLSTATE G3601; tras liberar, test 2 DELIVERY gana y AUTO rechaza G3601. Siempre 1 reserva durable y 1 trabajo aceptado. No reabrir funciones directas G3/G5: los respectivos permisos de service_role se revocaron en G4/G10. La primera iteración del test falló por usar atajo desautorizado; se corrigió a aceptaciones por oferta.
- Correcciones de QA: la inspección de la tabla privada se realiza solo con DB owner descartable, no se concede SELECT a service_role para hacer pasar el test; corrección final de UNIQUE sobre (assignment_kind,assignment_id), manteniendo PRIMARY KEY(driver_id). Evidencia logs finales en run #299.
- **4/4 CI SUCCESS**: PostgreSQL #299, Node #531, Expo #1113, aislamiento #441; GitHub muestra los cuatro sobre el SHA 5e8fc6ef.
- NO es plataforma LIVE ni cubre cualquier futura tabla de trabajos que no use los triggers G36. G3/G5 tienen permisos DML antiguos amplios bajo service_role; requieren revisión granular y auditoría (G37). Sin E2E real de ofertas/OTP/pagos/GPS.

---

# 16. Relación de los entregables y rutas de código de esta continuidad

| Entregable / función | Ruta principal |
|---|---|
| Historial JWT/HMAC, keyset y endpoint | apps/mobility-expo/server/g26-rider-history-gateway.mjs |
| Repositorio historial 3 orígenes | apps/mobility-expo/server/g26-rider-history-repository.mjs |
| MVCC dos transacciones | apps/mobility-expo/server/g26-history-mvcc-concurrency-ci.py |
| Clave HMAC privada/rotación | apps/mobility-expo/server/g4-staging-runtime.mjs |
| Sesión Admin/Owner | apps/mobility-expo/server/g27-backoffice-session-gateway.mjs |
| Lecturas Admin y composición loopback | apps/mobility-expo/server/g28-backoffice-sql-read-repository.mjs y g28-backoffice-qa-composition.mjs |
| Admin incidentes, KYC, auditoría, zonas | SQL G28, G29, G30, G31 bajo apps/mobility-expo/docs/backend/staging_only |
| Cobertura/observaciones por servicio | G31_ADMIN_ZONE_COVERAGE_POSTGRES_CI_ONLY.sql |
| Ingesta QA de ubicación Driver | apps/mobility-expo/server/g32-driver-telemetry-intake-qa.mjs |
| Cuestionario/consentimiento/latencia G32 | G32_DRIVER_LOCATION_SIGNAL_QUARANTINE_POSTGRES_CI_ONLY.sql |
| Competencia ubicación/revocación G32 | apps/mobility-expo/server/g32-driver-telemetry-concurrency-ci.py |
| Diagnóstico GPS agregado privado G33 | G33_QUARANTINED_ZONE_DIAGNOSTICS_POSTGRES_CI_ONLY.sql y g33-private-zone-diagnostic-qa.mjs |
| Consentimiento revisionado + log G34 | G34_CONSENT_REVISION_AUDIT_FENCING_POSTGRES_CI_ONLY.sql |
| KYC por servicio para Driver G35 | G35_DRIVER_DOCUMENTARY_READINESS_POSTGRES_CI_ONLY.sql y g35-private-driver-evidence-qa.mjs |
| Slot AUTO+DELIVERY único G36 | G36_CROSS_SERVICE_DRIVER_SLOT_POSTGRES_CI_ONLY.sql |
| Ensayo G36 dos conexiones/ambos órdenes | apps/mobility-expo/server/g36-cross-service-driver-race-ci.py |
| CI PostgreSQL cadena completa | .github/workflows/mobility-g4-postgres-disposable.yml |
| OpenAPI central | apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json |
| Coordinación A↔B | Issue #9 |

**Aplicar SQL:** solo en la cadena de PostgreSQL desechable de GitHub; varios scripts contienen guardia que rechaza otro PGDATABASE o application_name. No ejecutarlos en Supabase, infraestructura compartida, staging remoto ni producción sin plan y autorización explícitos.

---

# 17. Cronología de commits principales, incidentes y correcciones

| Hito | SHA verificable | Evidencia destacada |
|---|---|---|
| G26.5 MVCC | 059063a03dda95be054a28109c414e8a2946b229 | late commits y refresh; 4/4 verde |
| A03 HMAC | 0e97384d7a6cf09ec731cfb79d9673ce0bf9446c | secreto dedicado/current+previous |
| A04.1 sesión Admin/Owner | f10f06befe711efff295a14d11e7a049ed8508d3 | AAL2 inyectado, no Auth productivo |
| A05.4 KYC/Audit | 76497dd68fdd17b22049a6e577dc89ad9e5cba57 | KYC 121 y audit 123 eventos |
| G31 cobertura/observación | 675a4c82b704be13c0026c0457738d3038be9a8f | 30.030 filas/601 páginas |
| G32 GPS cuarentena | 5614b3acf4c557c5739f48c74b17e72cf0518b1b | 2 sesiones, consent/replay |
| G33+G34 GPS diagnóstico/audit | 495f56ad48f413f534ccfe26c67da1ac49eabbd8 | revisión 1→2→3 y revocación |
| G35 KYC Driver por servicio | 6ec96fc8e4b91dc0e667a68aad6e0fae684ac13e | cargo insurance caducado se rechaza |
| G36 doble aceptación | 5e8fc6ef601f0778a603d7a3b30172aaf51f70bc | test 2 conexiones y ambos órdenes |

**No duplicar ni restaurar bugs:**
- Nunca limitar registros de usuarios/historia a 50 total; 50 solo por página.
- No volver a activar atajos directos de aceptación G3/G5: G4/G10 los revocaron; sus ofertas privadas son flujo soberano.
- No afirmar que una muestra GPS = Driver disponible, ni que Driver con licencia = legalmente habilitado, ni que zona ACTIVE = elegible comercialmente.
- No interpretar documentos G17 aprobados como licencia G2 vigente sin comprobar fecha y verificación.
- No usar clave service_role como secreto HMAC de historial.
- No ampliar permisos DML a service_role o authenticated para arreglar un test; el fixture o el diseño debe adaptarse al menor privilegio.
- No confiar en atestaciones inyectadas como si fueran proveedor real ni llamar LIVE a un RPC sintético.
- No mezclar Driver con Cliente ni fusionar sus Expo projects.
- No mezclar dinero G7 SIMULADO con finanzas Owner auténticas.
- No omitir una prueba fallida ni copiar un CI PASS de SHA diferente al nuevo commit.

---

# 18. Matriz actualizada de riesgos y problemas pendientes (P0/P1/P2)

| ID | Riesgo concreto | Estado y mitigación requerida |
|---|---|---|
| R01 | PostgreSQL descartable ≠ infraestructura real | P0 abierto: STAGING HTTPS autorizado y aislado, IAM/Storage/GPS reales; no despliegue sin Owner. |
| R02 | JWT/cuenta de Driver autentificada con mocks | P0: conectar proveedor JWT, issuer/aud, expiración, refresh, revocación de sesión real y tests adversariales. |
| R03 | AAL2/MFA Admin y Owner sintéticos | P0: proveedor verificado, MFA fresca ligada a sesión y dispositivo, revocación, recuperación, anti-phishing. |
| R04 | Admin Web B permanece apagado | P0: jamás activar enabled=false/certifiedContracts=[] hasta Auth HTTPS/RBAC backend y aprobación. |
| R05 | Secret HMAC current/previous solo configuraciones QA | P1: secret manager, rotación, alarmas seguras, expiración y rollback sin secreto en logs. |
| R06 | Storage G17/G19 no guarda/verifica bytes reales | P0: almacenamiento privado versionado, scanner malware real, SHA256/magic MIME y revisión efímera auditada. |
| R07 | Roles Admin/Owner cruzados/duplicados | P0: migración RLS/auth real, sin permiso Owner→KYC o Admin→Finanzas por defecto. |
| R08 | Auditoría G30 es parcial | P1: cambios tarifarios, permisos, consentimientos, zonas, cargos, accesos KYC, export y descargas. |
| R09 | Página Admin KYC no es expediente real | P0: metadata mínima + acceso temporal por motivo, binarios seguros, reversión y retención. |
| R10 | G31 ACTIVE no significa despacho | BLOQUEADO por diseño eligibleByPolicy=false, revisar autorización jurídica/municipal antes de habilitar. |
| R11 | Geocercas inventadas a partir de municipio | P0: polígonos georreferenciados de fuente autorizada, licencias, versiones, validación Paraguay. |
| R12 | GPS spoof/mock location/errores y batería | P0: proveedor/SDK, consentimiento foreground/background, atestación y pruebas dispositivos. |
| R13 | G32 quarantine no concede disponibilidad | Correctamente bloqueado; nunca promover a G31 sin autenticidad/elegibilidad/legalidad. |
| R14 | G33 candidatos idle ≠ conductores aceptando ofertas | P0: estado oferta, ocupación por todos los tipos de servicio, heartbeat, revocación y transacción. |
| R15 | G34 cambios de consentimiento no migrados remoto | P0: backfill legal, historial, caducidad/cache/session invalidation y política de privacidad. |
| R16 | G35 verifica evidencia parcial de KYC | P0: completar permisos por tipo, licencias, seguros, ocupación, vehículo efectivo/seleccionado. |
| R17 | G36 solo cubre tablas G3/G5 | P0: futuras asignaciones/comercios usan el mismo slot; no introducir tercera ruta bypass. |
| R18 | service_role posee DML amplio de G3/G5 | **PRÓXIMO G37**: minimizar mutación privilegiada y blindar estados con tests de ofertas privadas. |
| R19 | Otro actor cambia Driver o vehículo mientras activo | G36 bloquea mutación activa en QA; ampliar inmutabilidad histórica y auditoría a estados terminales. |
| R20 | Carrera entre aceptación y cambio de KYC/seguro/GPS | P0: fencing de documentación/revocación/consentimiento por transacción, no solo preflight snapshot. |
| R21 | Push ACK sin prueba real de entrega | P1: proveedor, push opt-in/reintento, device receipt vs provider ACK, fallback polling offline. |
| R22 | Historial eventual READ COMMITTED y retención | P1: refresh/resync, paginación completa, borrado/rectificación legal, millones de filas sin prometer SLA. |
| R23 | Cobro/transacciones/PSP ausentes | P0 previo a LIVE: regulación/contratos, PSP, refunds, antifraude, contracargos, conciliación. |
| R24 | Owner Finance sin ledger real | Mantener owner.finance.read DENEGADO; evitar dar cifras sintéticas como ingresos. |
| R25 | Tarifa AUTO vs MOTO y costeo zonal | P1: estudio de mercado actual, distancia/tiempo/riesgo, costos mapas/soporte/PSP e impuestos. |
| R26 | Soporte, SOS, seguridad física | P0 previo a LIVE: humanos, protocolos, escalamiento, trazabilidad y enlaces locales autorizados. |
| R27 | Farmacias y MOTO pasajero restringidos | Legalidad, licencias/OTC, seguros y responsabilidad por municipio; nunca activar por CI. |
| R28 | Falta E2E Android/iOS físico | P0 previo a disponibilidad pública: dos binarios separados, sesiones, GPS, background, baja señal, push y seguridad. |
| R29 | Lovable podría crear lógica insegura | Limitar Lovable a UI y layouts al final, backend intacto y contratos verificados. |
| R30 | B/PR8 depende de A/PR7 y puede divergir | Coordinar issue #9, no merge/rebase unilateral, respetar ownership/boundary. |
| R31 | El CI Admin B usa simulación para casos de datos | P0: E2E real autorizado navegador + API + RLS; 131 tests Admin no certifican servicio real. |
| R32 | No hay presupuesto/plan de mapas, SMS, push, nube | P1: dimensionar costo y estrategia de operación/rollback con decisión Owner. |
| R33 | Seguridad de secretos y datos personales | P0: secretos aislados, mínimo privilegio, retención/borrado, backup cifrado, auditoría y revisión legal. |
| R34 | CI verde en SHA antiguo tras un commit de doc | Verificar SIEMPRE CI del HEAD actual y registrar enlaces exactos. |
| R35 | Doble trabajo de B con adaptadores ya existentes | No duplicar client-history-gateway, cancelación, Admin read adapters ni módulos visuales. |
| R36 | Futura activación por zona confundida con cobertura | Modelo triestado zona cubierta / oferta aceptable / conductor realmente disponible; no inferencia. |

Las restricciones R01–R36 son una matriz viva, no autorización para solucionar lo externo mediante mocks que aparenten producción. Priorizar según riesgos de integridad y seguridad, no por facilidad de CI.

---

# 19. TODO LO QUE FALTA — Hoja de ruta ejecutable para Arquitecto A

## P0 inmediato: comenzar SIN PREGUNTAR

**A18 / G37 — permisos y máquina de estados de aceptación G3/G5 (PRIMER TRABAJO SIGUIENTE).**
- Leer G3, G4, G5, G10, G20, G35, G36 y workflows exactamente en HEAD vigente. Inventariar permisos INSERT/UPDATE de service_role en trips/deliveries y funciones G4/G10 que requieren escribir.
- Diseñar invariantes de transición: no forjar asignación, no cambiar dueño, request_key, conductor, vehículo, servicio, origen/destino, fecha o términos después de creación/aceptación, no volver de terminal a activo, no auto-habilitar nuevas ofertas. Modo SQL descartable con triggers/permiso mínimo sin romper ofertas privadas ni RLS.
- Agregar pruebas adversariales de escritura directa como service_role y revalidar acceptance G4/G10, G36 2 conexiones en ambos órdenes, reintentos y cancelaciones. No otorgar DML solo para hacer verde una prueba.
- Comprobar posibles reingresos por triggers SECURITY DEFINER y transición de disputa/retorno; no bloquear un estado legítimo sin diagnosticar semántica. El bloqueo de aceptación debe ser atómico respecto a reserva G36 y un fixture limpio.
- 4/4 workflows del SHA final, documentación de riesgo y comentario issue #9 si B necesita cambio de DTO.

**A19 / G38 — disponibilidad y elegibilidad al aceptar una oferta específica.**
- Leer los indicadores G31–G36 sin confundir evidencia con servicio LIVE. Validar en transacción Driver, vehículo **seleccionado**, revisión KYC, seguro, categoría/masa/volumen entrega, bloqueos administrativos, consentimiento GPS revisionado y legalidad/zonas. Mantener eligibleByPolicy=false hasta comprobación externa.
- Fencing de revocación de KYC, licencias o pólizas que ocurre concurrentemente con aceptación. Pruebas de dos sesiones: preflight favorable anterior no debe permitir aceptar si se revoca antes de commit.
- Extender G36 a cualquier nuevo tipo de asignación en cuanto se agregue; diseñar expiración de ofertas, takeover y recuperación sin dupes.

**A20 — Auth/MFA/Owner real, sin desplegar sin permiso.**
- Completar contrato servidor para JWT issuer/audience, revocación, refresh, MFA AAL2, RBAC scopes y RLS con cuentas STAGING sintéticas. Proveer implementación modular y tests con referencias auténticas del proveedor elegido.
- Hasta autorización de infraestructura/secretos, continuar tests aislados y dejar integración real bloqueada explícitamente, no fingir firma/Auth.

**A21 — Storage G17/G19 real y Admin KYC.**
- Preparar adaptador Storage versionado, URLs efímeras por motivo, hash de bytes SHA256 y scanner malware auténtico; trazabilidad de revisión, revocación, eliminación legal, foto/documento restringido.
- QA adversarial de objeto reemplazado, tamaño/MIME falso, virus simulable, carrera/revisión y permisos Owner/Admin; no introducir fotografías reales.

**A22 — OpenAPI y backend Cliente restante.**
- Desarrollar contratos de catálogos/sucursales, stock, pedido, entrega, cancelación/refund simulado y soporte/SOS con recibos tipados e idempotencia. Probar scopes y owner. Preservar endpoints historial y cancelación ya existentes, sin duplicar gateway Cliente B.
- Ajustar/ completar OpenAPI de los cinco GET Admin (4 QA + Owner cerrado), sesiones y errores, sin decir que hay URL desplegada.

**A23 — Continuidad de zonas/geofences GPS.**
- Fuente autorizada de polígonos paraguayos con geometría revisionada, viabilidad legal por servicio, precio/routing, observaciones de presencia verificadas, anti-replay y privacidad. Mantener G31 artificialmente apagado.
- No activar moto pasajeros, medicina restringida, GPS en segundo plano ni tracking real sin autorización/consentimiento y normas revisadas.

**A24 — Conectar Driver instalable al servidor autorizado.**
- Preparar adaptadores SDK/Auth/Storage/mapas/notifications y pruebas Android/iOS, sin despliegue hasta permiso. Conservar separación Cliente/Driver y protección de datos por rol.

## P1: madurez técnica y operaciones

**A25 — Seguridad y auditoría operacional:** registro inmutable de accesos a documentos, acciones Admin/Owner, zonas, tarifas, payouts, consentimientos, resolución de incidentes; monitoreo, alertas y export/retención.
**A26 — Economía y pagos:** tarifario AUTO/MOTO/envío/entrega por zona, pruebas de mercado (fuentes verificadas), motor Gs versión server-only, costos reales, comisiones transparentes, payout/refund/chargeback; PSP solo si autorizado.
**A27 — Resiliencia/escala:** cientos de miles/millones históricos con costes e índices reales, carga de disponibilidad por municipio, backpressure, offline, rate limiting distribuido, retries y reconciliación; no inventar throughput a partir de 30k en CI.
**A28 — QA dispositivo/seguridad física:** dos APK/IPA separados, permisos GPS activos/fondo, latencia y batería, suspensión, push real, SOS/humanos, OTP/custodia y entrega física con protocolos seguros.
**A29 — Integración B sin cruzar permisos:** leer HEAD B y sus gateways, enviar contratos/SHAs/errores a issue #9, no corregir ni fusionar B.
**A30 — Lovable UI definitiva y tiendas:** solo tras infraestructura/Auth/GPS/Storage/operación/ley/economía certificadas y aprobadas por Owner; UI no retiene secretos ni lógica de precios/dispatch.

## Requisitos de salida ANTES de afirmar «completado para usar»

- JWT/Auth, Owner/Admin MFA, roles y RLS genuinos, secretos rotables, revocación verificable.
- Backend HTTPS STAGING autorizado, sin acceso accidental a LIVE, backups/restore y rollback.
- SQL/migraciones auditadas para ambiente legítimo, nunca copiar scripts que dicen CI_ONLY al remoto sin ingeniería de migración y aprobación.
- GPS/geofence/mapas reales, permisos y privacidad, Driver realmente elegible/conductor voluntariamente disponible, tiempo/distancia verificados, precio Gs servidor.
- KYC/bucket privado/escáner reales; pólizas, inspecciones, habilitaciones por municipio y servicio.
- Ofertas/aceptaciones exclusivas cross-service en aplicaciones físicas, idempotencia y recibo de aceptación; pagos y refunds reales con PSP legal.
- Admin Web y Owner leyendo sólo lo autorizado, auditoría, incidentes y soporte humano/SOS.
- Pruebas E2E Cliente→backend→Driver→Cliente→Admin/Owner, offline, cambio de cuenta, desinstalación, tráfico, concurrencia, batería y errores.
- Checklist GO/NO-GO con riesgos y autorización escrita del Owner. Hasta entonces DRAFT, NO MERGE, NO LIVE.

---

# 20. Trabajo paralelo de B: coordinar, nunca pisar

B ya ha construido Cliente Expo, gateways HTTPS pinned con flags fail-closed, experiencia viaje/entrega, historial sin tope global, cancelación segura, quote Gs, no exposición de JWT, Admin Web React/Vite independiente, KYC/zonas/incidentes/auditoría y Owner finance sin ingresos inventados. Su handoff más reciente en rama B reportaba **194/194 tests Cliente y 131/131 Admin**, con workflows Admin/boundary/aislamiento verdes en el SHA que especifica ese handoff. Su HEAD verificado al consultar esta transferencia fue 06e4eebe07acfaa03973e1fd84fc41c54b23e728, pero puede seguir avanzando mientras A escribe.

B tiene ownership exclusivo de:
- apps/movete-cliente/**
- apps/movete-admin/**
- docs/architect-b/**

Pedirle a B mediante issue #9 que preserve HISTORY ilimitado, navegación de dos apps distintas, botones y flujos fail-closed hasta servidores de verdad, sin mostrar conductores G33/G35 ni precios ficticios como datos disponibles, y que integre contratos firmes cuando A entregue Auth/HTTPS/DTO. Nunca copiar ni sobrescribir sus módulos. B decide su propia implementación UI, A decide backend de seguridad.

---

# 21. Protocolo de trabajo continuo obligatorio para el siguiente chat

**Primeros 15 minutos operativos del sucesor, sin preguntas rutinarias:**
1. Abrir repo soberano y verificar SHAs de ramas A/B y PR #7/#8. Confirmar que ambos siguen DRAFT y no merged. Leer los 3 handoffs A y el handoff B más reciente, especialmente G36 y este texto.
2. Inspeccionar issue #9 y comentarios recientes para detectar cambios de contrato. Abrir G3/G4/G5/G10/G20/G35/G36 y los workflows antes de modificar.
3. Arrancar G37: diseño de invariantes/privilegios de la máquina de estados, escribir prueba roja de bypass DML y luego la restricción QA que la haga verde; mantener G36 y pruebas de ofertas privadas.
4. Commit real en rama A, reconsultar HEAD y comprobar PostgreSQL, Node, Expo y aislamiento **del MISMO SHA**. Si CI falla, leer los logs y corregir sin relajar validación.
5. Cerrar docs de G37, comunicar cambio de contrato a B sólo si lo hay, e iniciar G38 o un P0 independiente inmediatamente.

**Cadencia:** diseñar → implementar en carpeta A → pruebas de error/seguridad → GitHub commit pequeño → CI por SHA → corregir/retest → documentar → siguiente bloque. Comunicar resultados útiles (commit, tests, bloqueos) sin requerir permiso tras cada paso. Mantener un handoff actualizado si se cambia de chat.

**Sí constituyen un bloqueo real:** falta de token/permiso GitHub de A; acceso a proveedor externo/secret manager, ley/seguro que impide desarrollar una operación real; despliegue o SQL remoto sin autorización; necesidad de datos personales; PSP/pagos; conflicto de ramas que podría sobrescribir a B. Ante uno de estos: documentarlo, conservar NO LIVE y pasar a otro gate QA seguro en vez de esperar.

**No constituye un bloqueo real:** fixtures sintéticos, tests fallidos corregibles, errores de Node/SQL, falta de UI final Lovable, CI que tarda, ausencia de porcentaje final de progreso, texto de handoff, decisión de una función interna que no compromete producción.

**No prometer trabajo futuro asíncrono sin herramientas de ejecución programada. El trabajo debe realizarse y verificarse en cada turno efectivo.**

---

# 22. Prompt de handoff LISTO PARA PEGAR al nuevo chat

Actúa como el NUEVO ARQUITECTO A de **QORE MOBILE / MOVETE FÁCIL**. Continúa la construcción YA y NO REINICIES. Repositorio soberano GitHub **mezas3238-hue/Qore-mobile-** (guion final). Rama A **feature/mobility-monorepo-isolated-20261016**, PR #7 DRAFT; rama B **feature/mobility-cliente-admin-parallel-20261022**, PR #8 DRAFT. **Lee primero docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G36_CONTINUIDAD_2026-10-23.md**, handoff G0–G26.4, handoff original G0–G22, docs G31–G36 y issue #9; verifica HEAD y CI actuales y no te bases en SHAs antiguos. Tu ámbito es backend, Driver, SQL, OpenAPI, CI y docs de A; B trabaja Cliente y Admin Web, NO edites sus carpetas. Ya existe infraestructura G0–G36, historial ilimitado en páginas, zonas, GPS QA, consentimiento versionado, evidencia KYC, reserva atómica cross-service y pruebas reales de dos conexiones en ambos órdenes. No los dupliques. **PRIMERA TAREA: G37 proteger la máquina de estados/privilegios DML de G3/G5 sin romper las ofertas privadas G4/G10 ni el slot único G36**. Luego G38 elegibilidad transaccional y el roadmap P0–P1 completo. Ejecuta pruebas adversariales y los cuatro workflows por SHA, corrige y publica commits con evidencia; continúa automáticamente al siguiente gate. Mantén dos apps móviles DISTINTAS (Driver y Cliente), Admin sólo WEB; 50 es máximo POR PÁGINA, NUNCA techo de registros. **NO MERGE, NO LIVE, NO deploy, NO SQL remoto, NO PSP, NO VPS, NO cuentas reales, NO secretos, NO tocar B**, y no anuncies app lista ni ingresos reales por CI verde. SOLO DETENTE POR BLOQUEO REAL; si el problema depende de autorización externa, deja ese subpaso bloqueado y ejecuta otro bloque QA independiente sin pedir aprobación reiterada.

---

# 23. Cierre de esta transferencia

Este acta preserva historia, código, seguridad, UI separada, pruebas, fallos corregidos y trabajo restante G0–G36. Su publicación NO sustituye los 416 renglones del handoff G0–G26.4, los documentos G0–G22 ni el corte propio de B; los complementa con el trabajo ejecutado después. **Cada nuevo chat debe empezar revisando la realidad actual de GitHub, no el último mensaje del chat.**

**NO AUTORIZA MERGE, LIVE NI DESPLIEGUE.**
