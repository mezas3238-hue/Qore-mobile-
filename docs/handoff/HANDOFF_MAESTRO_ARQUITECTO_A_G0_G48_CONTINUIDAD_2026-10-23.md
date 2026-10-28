# QORE MOBILE — MOVETE FÁCIL · HANDOFF MAESTRO INTEGRAL DEL ARQUITECTO A
## Transferencia G0–G48 · Trabajos realizados, historial verificable, pendientes, riesgos y continuidad sin pausas

**Corte de desarrollo certificado:** 23 de octubre de 2026, Paraguay. **Repositorio soberano:** [mezas3238-hue/Qore-mobile-](https://github.com/mezas3238-hue/Qore-mobile-), termina en guion; NO confundir con qore-core del trading.

**Arquitecto A:** [PR #7 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/7), rama feature/mobility-monorepo-isolated-20261016, base main.
**Arquitecto B:** [PR #8 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/8), rama feature/mobility-cliente-admin-parallel-20261022, base rama A.
**Coordinación:** [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).

**Último HEAD funcional A certificado antes de este handoff:** 201a687abf68df13b4947296f230b53b2f361fd6 (G48, cuatro workflows SUCCESS).
**HEAD B observado:** f95852564f06191e6083263d1fb276056513c302 (handoff R1–R13, trabajo B independiente).

**ATENCIÓN A LAS FECHAS Y COMMITS:** los dos anexos y este handoff son nuevos commits POSTERIORES al SHA G48. El resultado 4/4 solo se atribuye a 201a687a hasta que las Actions del SHA documental nuevo también se comprueben. Recuperar el nuevo HEAD antes de iniciar otro trabajo.

> **ORDEN OWNER:** el siguiente arquitecto debe continuar trabajando SIN DETENERSE, salvo bloqueo real. Ciclo obligatorio: inspeccionar GitHub → implementar código + SQL + tests → publicar commit → verificar CI → reparar → siguiente tarea. Nunca preguntar «¿avanzo?» para código de QA aislada aprobado. Si se bloquea una acción que exige credenciales, autorización, licencia o servicio externo, documentar el obstáculo de ESA acción y pasar a otra tarea A segura. No prometer trabajo futuro en segundo plano.

> **GOBERNANZA INNEGOCIABLE:** NO MERGE, NO LIVE, NO DEPLOY, NO SQL remoto, NO VPS, NO PSP ni dinero real, NO PII/documentos auténticos en CI, NO credenciales en repo, NO tiendas, NO producción, NO operación física ni cambios en rutas del Arquitecto B sin permiso. PRs #7 y #8 siempre DRAFT hasta nueva orden.

---

# 01. LECTURAS Y ANEXOS QUE NO SE DEBEN PERDER

1. **Handoff anterior A G0–G42 (548 líneas)**: [abrir documento histórico](https://github.com/mezas3238-hue/Qore-mobile-/blob/201a687abf68df13b4947296f230b53b2f361fd6/docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G42_CONTINUIDAD_2026-10-23.md). Conserva las implementaciones G0–G42, R01–R50, commits, archivos, fallos/soluciones, roles A/B y hojas de ruta originales.
2. **Otros handoffs A:** docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G36_CONTINUIDAD_2026-10-23.md, G0_G26_4 y división de trabajo de dos arquitectos, todos en GitHub.
3. **Anexo integral de 714 commits:** [ANEXO A - historial GitHub, SHA completos y fechas](./ANEXO_A_HISTORIAL_GITHUB_714_COMMITS_AL_HEAD_G48_2026-10-23.md). Es TODO el historial alcanzable desde 201a687a, no 714 commits atribuibles al arquitecto actual.
4. **Anexo integral de 515 archivos:** [ANEXO A - inventario, bytes y hash blob](./ANEXO_A_INVENTARIO_515_ARCHIVOS_HEAD_G48_2026-10-23.md). Git tree no truncado del SHA 201a687a; no incluye los nuevos archivos de documentación por ser posteriores.
5. **Arquitecto B R1–R13:** [handoff B de 342 líneas](https://github.com/mezas3238-hue/Qore-mobile-/blob/f95852564f06191e6083263d1fb276056513c302/docs/architect-b/HANDOFF_MAESTRO_ARQUITECTO_B_R1_R13_TOTAL_Y_CONTINUIDAD_2026-10-23.md), más su [anexo 213 commits y 214 archivos](https://github.com/mezas3238-hue/Qore-mobile-/blob/f95852564f06191e6083263d1fb276056513c302/docs/architect-b/ANEXO_AUDITORIA_B_213_COMMITS_214_ARCHIVOS_2026-10-23.md).
6. **Contrato vivo:** apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json, versión 1.0.0-g48, 57 rutas.
7. **CI:** .github/workflows/mobility-g4-postgres-disposable.yml para SQL PG16, workflows Node/Expo/aislamiento, verificación SIEMPRE por el HEAD actual.
8. **Issue #9** para coordinación y dependencias A↔B.

## 01.1 Inventario exacto de la historia

- Árbol recursivo verificado: **515 archivos**, no truncado, bajo SHA 201a687a. De ellos 410 en apps/mobility-expo, 41 en apps/movete-driver, 32 en docs/architecture, 8 en docs/handoff, 6 workflows GitHub y 15 ficheros Cliente heredados, entre otros.
- Historia alcanzable desde el mismo SHA: **714 commits**. Son ancestría total del repo; el anexo NO atribuye todos a un único arquitecto.
- Los anexos contienen el inventario individual completo para no inventar archivos ni repetir trabajos. Recalcular si se exige un corte posterior al commit de este handoff.

---

# 02. PRODUCTO Y ALCANCE APROBADOS

**Movete Fácil** es la plataforma de movilidad y logística proyectada para Paraguay con activación gradual por zonas y municipios. Se aspira a competir con Bolt/Uber en calidad, precio y seguridad como objetivo de negocio, NO afirmación de mercado verificada.

**Tres superficies separadas:**
- **Driver**: apps/movete-driver/**. Aplicación móvil independiente para choferes AUTO y repartidores AUTO/MOTO. Exclusiva A.
- **Cliente**: apps/movete-cliente/**. Aplicación móvil independiente para pasajeros, remitentes y compradores. Exclusiva B.
- **Admin Web**: apps/movete-admin/**. Panel web distinto de ambas aplicaciones. Exclusiva B.

**Backend común** apps/mobility-expo/**: SQL, RLS, Node, Auth, ofertas, despacho, tarifas Gs, catálogos, documentos KYC, incidentes y OpenAPI. Exclusiva A.

**Servicios:** viajes pasajeros en AUTO, envíos particulares/comerciales AUTO y MOTO (restaurantes, supermercados, farmacia solo OTC y otros rubros). **MOTO pasajeros NO habilitado** sin legalidad/seguros/Owner. Cobertura de zona ≠ disponibilidad de conductor ≠ habilitación real. G31 conserva eligible_by_policy=false. Tarifas AUTO/MOTO diferenciadas en PYG, cálculo siempre servidor. Sin límites totales arbitrarios de 50/99/100 registros; pageSize pequeño NO es límite del histórico.

**Lovable:** aportará interfaz definitiva después de infraestructura y certificación real. No reemplazar Auth/SQL/RLS/dispatch/finanzas con lógica de frontend. NO mezclar código de trading en este repositorio.

---

# 03. MATRIZ DE PROPIEDAD NO NEGOCIABLE

| Ruta/capacidad | Arquitecto A | Arquitecto B |
|---|---|---|
| apps/mobility-expo/**, SQL, server, API, OpenAPI | Editar | Solo consumir contratos |
| apps/movete-driver/** | Editar | No tocar |
| apps/movete-cliente/** | No tocar | Editar |
| apps/movete-admin/** | No tocar | Editar |
| docs/architecture/** y docs/handoff/** | Editar | No tocar |
| docs/architect-b/** | No tocar | Editar |
| .github/**, scripts raíz, CI común | A coordina con cautela | Observar/coordinar |
| Issue #9 | Informar, solicitar contrato UI y publicar backend | Informar y validar front |

La rama B tiene como base la rama A; no rebase/force-push/merge ni cambiar la base de B. No solucionar errores de Cliente editando código de B. Si falta funcionalidad B, publicar contrato y tests A en issue #9.

---

# 04. G0–G22 — TRABAJOS EXISTENTES QUE NO HAY QUE REHACER

| Gate | Lo desarrollado y probado en QA | Qué todavía NO representa |
|---|---|---|
| G0 | Monorepo y aislamiento móvil frente a trading, ramas y CI. | Binario distribuido. |
| G1 | Auth sintético, baseline PostgreSQL, roles, RLS. | Proveedor JWT real. |
| G2 | Modelos de conductor, vehículo, licencia, seguro e inspección. | Revisión legal genuina. |
| G3 | Estado de viaje AUTO, solicitud, oferta, eventos, idempotencia. | Viaje en calle. |
| G4 | Ofertas privadas AUTO, TTL, inbox/polling, outbox y transporte localhost. | Push/GPS reales. |
| G5 | Entregas AUTO/MOTO, categorías, custodia, estados. | Logística física. |
| G6 | Comercios, catálogo, pedidos y stock. | Venta/cobro real; grants legados cerrados en G46. |
| G7 | Tarifas, comisiones, pagos y ledger **simulados** PYG. | PSP/banco. |
| G8 | Incidentes, suspensiones, lógica SOS de laboratorio. | Operador de emergencia. |
| G9 | Onboarding/aprobación/sucursales e ítems comerciales sintéticos. | Comercio autorizado real. |
| G10 | Ofertas delivery privadas, aceptación sin atajos. | Delivery productivo. |
| G11 | Contratos OpenAPI y DTO estables. | API desplegada. |
| G12 | Outbox de push, claim/ACK/retry de courier. | Notificación recibida en teléfono. |
| G13 | Lease y fencing PostgreSQL contra claim vencido. | Proveedor push real. |
| G14 | Dos repartidores, un ganador de aceptación SQL. | Uso en calle. |
| G15 | Polling courier como respaldo. | Offline/dispositivo probado. |
| G16 | Inbox privado AUTO y DELIVERY Driver. | Auth real. |
| G17 | Registro y revisión central KYC de metadatos privados. | Fotos/escaneo reales. |
| G18 | Alta Driver de rol exclusivo; evita identidad Cliente+Driver simultánea. | Habilitación legal automática. |
| G19 | Contrato hash, MIME y scanner KYC inyectable. | Antivirus y Storage de verdad. |
| G20 | Continuidad de licencia revisada y caducidad en preflights. | Verificación externa real. |
| G21 | Interfaz/flujo Driver inicial basado en contratos. | App Android/iOS terminada. |
| G22 | Puente de Auth SDK Driver y logout seguro de QA. | Cuenta Auth remota certificada. |

El histórico detallado de estos trabajos, fechas, ficheros y errores está en el handoff G0–G42 y el anexo de 714 commits. **No rehacerlos.**

---

# 05. G23–G36 — TRABAJOS HISTÓRICOS CONSERVADOS

- **G23–G25:** historial privado de viaje/entrega, paginación por cursor, contratos de estado, identidad y cotizaciones iniciales. Revisar handoff G0–G36 para nombres de ficheros específicos.
- **G26/G26.3/G26.4/G26.5:** lectura ilimitada por keyset, 1200 filas en 24 páginas, más de 30000 registros y MVCC tardía con dos sesiones, índices y origen inmutable.
- **G27:** autoridad independiente Admin vs Owner/finanzas; un Owner no obtiene permiso KYC Admin.
- **G28:** cola incidentes Admin privada por cursor (>100 expedientes).
- **G29:** KYC Admin basado en fuentes revisadas (121 filas), sin convertir MOTO pasajeros en legal.
- **G30:** lectura de eventos de auditoría Admin, cursor y scopes.
- **G31/G31.2:** cobertura por servicio/zona, 30030 filas y 601 páginas, eligible_by_policy=false. Cobertura no da permiso.
- **G32/G32.2:** cuarentena GPS Driver, secuencia/consentimiento/replay con carreras PG, sin disponibilidad confirmada.
- **G33:** diagnóstico interno de telemetría cuarentenada.
- **G34:** versionado/auditoría append-only del consentimiento GPS; retirada/re-opt-in invalida señal anterior.
- **G35:** diagnóstico de licencia/seguro/señal/estado sin autorización de despacho.
- **G36:** slot atómico único de conductor para viajes y envíos, probado con dos conexiones.

**No introducir topes globales de registros al optimizar; todos los límites cortos son por página o por una operación.**

---

# 06. G37–G42 — ENDURECIMIENTOS CONSERVADOS EN HANDOFF PREVIO

**G37 / A18:** cierre DML de viajes/envíos y protección de identidad, origen, revision/eventos y estados terminales. Primer cierre quebró SELECT FOR UPDATE de una aceptación; se corrigió trasladando locking a función privilegiada acotada, NO reabriendo service_role. Commit funcional 75e3bee1e8d8f3635dede6438149d1c6b2f8529c; documento docs/architecture/G37_TRIP_DELIVERY_STATE_DML_FENCE_QA_2026-10-23.md.

**G38 / A19:** disputa/retorno del envío sin mantener slot ocupado; revalidación de elegibilidad/offer dentro de transacción; se niegan GPS falsos, prueba forjada y despacho ilegal por zona.

**G39 / A20:** prueba de oferta con verificación criptográfica Ed25519, sin conceder autoridad a datos del Cliente o a un JWT de rol autodeclarado.

**G40 / A21:** recibos de incidentes, estado persistido e idempotencia, acceso por propietario. SOS de QA NO es intervención real.

**G41 / A22:** triaje Admin global por prioridad/severidad/estado y cursor privado sin tope total.

**G42 / A23:** verificador JWS ES256/RS256/EdDSA con JWK pinneada, issuer/audience/kid, sesión, expiración, iat y nbf. Read providers independientes, MFA AAL2 requerida para backoffice, tabla SQL de grant sintético, G42_session_active y G42_lock_session. No existe servidor proveedor/Auth real. El test histórico que rechazaba un token firmado para otro sujeto se corrigió: firma válida != autorización. SHA final funcional 165997ec4a3f353c608d503c9006dc472701a58a; cuatro Actions SUCCESS (PostgreSQL #321, Node #562, Expo #1156 y aislamiento #505).

Para detalle técnico y cronológico G37–G42 ir al handoff anterior, secciones 05–14, no copiar sus pendientes antiguos como si G43–G48 no existieran.

---

# 07. G43 / A24 — REVOCACIÓN EN LA MISMA TRANSACCIÓN

**Documento:** docs/architecture/G43_TRANSACTIONAL_SESSION_REVOCATION_AND_PROVIDER_SYNC_QA_2026-10-23.md.

**Archivos:** G43_TRANSACTIONAL_SESSION_FENCE_POSTGRES_CI_ONLY.sql + ASSERT, g43-session-revocation-race-ci.py, g43-provider-session-reconciliation-qa.mjs/test.

**Construido:** función guardada que toma G42_lock_session y realiza efecto SQL en la misma transacción; dos conexiones comprueban ambos órdenes operación→revocación y revocación→operación. Adaptador Node de observación independiente usuario/sesión, revisión monotónica/CAS requerido, rechazo de proveedor caído, identidad cruzada y AAL2 falsa. DB owner-only, todo QA. No deducir que una consulta HTTP anterior garantiza un commit posterior.

---

# 08. G44 / A25 — SUCURSALES Y CATÁLOGO BUYER ILIMITADO EN TOTAL

**Documento:** docs/architecture/G44_BUYER_BRANCH_CATALOG_UNBOUNDED_QA_2026-10-23.md.

**SQL:** G44_BUYER_DISCOVERY_CATALOG_POSTGRES_CI_ONLY.sql + ASSERT. Mapeo sucursal/zona/municipio/servicio G31, revisión de catálogo invalidada por cambios de stock, sucursal, comercio o mapeo, G42 session lock, rol passenger exclusivo, código de revisión caducada G4409. PageSize 100, SIN límite global.

**Node:** g44-buyer-catalog-qa.mjs/test, cursor HMAC SHA256 ligado a actor, sesión, filtros, branch, revision y rotación de secreto. 205 productos SQL en 3 páginas; simulación Node de 13000 productos en 130 páginas y 241 sucursales. OTC permitido; no prescripción. OpenAPI GET branches/catalog marcados runtime-wired:false y orderEnabled:false.

**SHA funcional:** a34f052627c71b1976dac98e5a9e8ea3b338f377, matriz 4/4 SUCCESS. Los grants antiguos de service_role fueron revocados posteriormente en G46, NO restaurarlos.

---

# 09. G45 / A26 — RESERVAS ATÓMICAS DEL COMPRADOR SIN PAGOS

**Documento:** docs/architecture/G45_BUYER_ORDER_ATOMIC_STOCK_QA_2026-10-23.md.

**SQL:** G45_BUYER_ORDER_STOCK_FENCE_POSTGRES_CI_ONLY.sql + ASSERT, recibos inmutables de reserva/cancelación. G42 session lock y rol buyer, control catalogVersion G44, stock bloqueado y precio PYG **del servidor** vía G6. requestKey idempotente, payload/actor cruzado → G4509; cancelación repone una sola vez sin reembolso PSP. Solo AUTO en esta simulación.

**Node:** g45-buyer-order-reservation-qa.mjs/test, g45-buyer-order-race-ci.py con dos conexiones y último stock, g45-buyer-openapi-contract.test.mjs. DTO QA_RESERVED_NO_PAYMENT; prohibido precio, monto, PII o rol falsos. 50 líneas es límite de UN carrito, no del histórico.

**SHA certificado:** e6ed9fc72f951d77060ff9fd526756d4d9b22837; PG #359, Node #620, Expo #1225, aislamiento #599, todos SUCCESS. NO comprador real, cobro, stock físico, reembolso bancario ni servicio HTTPS.

---

# 10. G46 / A27 — CIERRE DE PERMISOS COMERCIALES P0

**Documento:** docs/architecture/G46_MERCHANT_PRIVILEGES_AND_HTTPS_STAGING_PREFLIGHT_2026-10-23.md.

**Hallazgo:** G6/G9 daban DML y RPC de service_role con actor UUID de parámetro. Eso podría suplantar comerciantes, buyer o Admin si se conectase sin Auth transaccional.

**Corrección:** G46_MERCHANT_COMMERCE_PRIVILEGE_LOCKDOWN_POSTGRES_CI_ONLY.sql + ASSERT revocan privilegios directos en **8 tablas** para PUBLIC/anon/authenticated/service_role y EXECUTE de **11 funciones** G6/G9/G44/G45. Prueba 168 comprobaciones de tablas + 33 EXECUTE, ataques directos de service_role, todo denegado. Workflow agregó instalación G9 que antes faltaba, tras G45 y antes de G46. No se restauran permisos solo para facilitar una UI.

**Preflight Node:** g46-merchant-staging-preflight-qa.mjs/test y guardia OpenAPI: aprobación Owner, TLS, issuer/aud/JWKS, roles, MFA, sesión, legalidad de zona, secretos y flags. Aunque diez pruebas sintéticas sean positivas, activationPermitted:false.

**SHA certificado:** c7d5bd098dae7615a71acde3295dc3b67528494f; PG #370, Node #636, Expo #1244, aislamiento #613, todos SUCCESS.

---

# 11. G47 / A28 — KYC PRIVADO Y AUDITORÍA, SIN BYTES DE DOCUMENTOS

**Documento:** docs/architecture/G47_PRIVATE_DRIVER_EVIDENCE_SESSION_LEASES_2026-10-23.md.

**SQL:** G47_PRIVATE_DRIVER_EVIDENCE_LEASES_POSTGRES_CI_ONLY.sql + ASSERT. Revoca DML y 3 RPC antiguas G17 de service_role. Huella de objeto sintético SHA/MIME/size vinculada a licencia existente G17, sin certificado de scanner/storage real. Lease de 60 segundos Driver self-view o Admin review pendiente, G42 bloqueo en misma transacción, requestKey, revocación idempotente y auditoría append-only que no puede alterarse.

**Node:** g47-driver-evidence-lease-qa.mjs/test y OpenAPI guardia. Exige JWT verificado por fuente inyectada, sesión, rol Driver exclusivo y para Admin AAL2 genuina independiente, limiter y DTO sin path/hash/URL/bucket/bytes. No URLs firmadas ni descarga física.

**Errores CI encontrados y corregidos:** fixture anterior que no persistía, conflicto de objectKey sintético, evaluaciones de función mutante sin orden de ejecución garantizado, projectRef de STAGING inválido y respuestas default omitidas en contrato. Se arreglaron, no ocultar.

**SHA certificado:** 4a4bdb51fa7e1f32ae6b0328acc92952a5c23805; PG #383, Node #653, Expo #1268, aislamiento #662, todos SUCCESS.

**Nota:** 60 s caduca el LEASE, no el expediente legal. La retención KYC y purga/cifrado siguen sin implementar.

---

# 12. G48 / A29 — DELEGACIÓN DE SOLO LECTURA Y TICKET DE UN SOLO USO

**Documento:** docs/architecture/G48_SCOPED_GATEWAY_CAPABILITIES_AND_SESSION_FENCE_2026-10-23.md.

**SQL G48_SCOPED_DB_DELEGATION_POSTGRES_CI_ONLY.sql:** nuevo rol **mobility_g48_gateway_ci NOLOGIN NOINHERIT**, sin acceso a tablas privadas ni RPC heredadas G6/G9/G17/G47. Emisión de ticket UUID opaco de 30 s únicamente por DB owner de QA, hash SHA-256 persistido con actor, sesión, iat, scope, resource y auditoría inmutable. El rol delegado NO PUEDE crear tickets.

**Consumo:** SELECT FOR UPDATE sobre proof, una sola utilización y G42_lock_session en la misma transacción; revalida rol exclusivo/owner del recurso. G4804 indica consumed/expired, G4801 revocación, G4803 scope ajeno.

**Solo 3 funciones ejecutables por rol delegado:** estado sanitizado Driver, probe de lease G47 y catálogo G44 por sucursal + versión, precios PYG servidor y 100 ítems por página sin cap global.

**Node:** g48-scoped-db-gateway-qa.mjs/test exige JWT/sesión/rol inyectados, limiter, emisor owner-only QA; rechaza actorId/role/PII/precios falsificados o comprobantes inseguros. Error regex UUID de 4 en vez de 5 grupos detectado/corregido.

**Carrera real PG:** g48-scoped-db-delegation-race-ci.py con dos conexiones sobre mismo ticket; exactamente una gana, la otra G4804; al revocar sesión antes de usar nuevo ticket devuelve G4801. **NO es conexión con proveedor Auth real.**

**OpenAPI 1.0.0-g48:** 57 paths, 3 contratos futuros GET status Driver, POST lease probe y GET catálogo Buyer. Todos runtime-wired:false, qa-only:true, provider-to-db-proof-wired:false.

**SHA funcional certificado G48:** 201a687abf68df13b4947296f230b53b2f361fd6.

| Workflow exacto del SHA G48 | Run | Resultado |
|---|---|---|
| [PostgreSQL #395](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40026148256) | 40026148256 | SUCCESS |
| [Node #670](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40026148196) | 40026148196 | SUCCESS |
| [Expo #1289](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40026148182) | 40026148182 | SUCCESS |
| [Aislamiento #687](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40026148446) | 40026148446 | SUCCESS |

**LÍMITE:** el emisor owner-only usa grants sintéticos; NO hay real JWT→DB, proveedor remoto, HTTPS STAGING, tickets de producción, cliente comercial conectado, ni PSP. No transformar 4/4 QA en “lista para usar”.

---

# 13. ARCHIVOS Y PRUEBAS MODIFICADOS RECIENTEMENTE, PARA REENTRADA RÁPIDA

**Bajo apps/mobility-expo/docs/backend/staging_only:** archivos G43_*, G44_*, G45_*, G46_*, G47_*, G48_* y los ASSERT asociados. Cada migración tiene guardas de base descartable, y la sucesión del workflow instala G9 antes del cierre G46.

**Bajo apps/mobility-expo/server:**
- g43-provider-session-reconciliation-qa.mjs/test y g43-session-revocation-race-ci.py.
- g44-buyer-catalog-qa.mjs/test y g44-buyer-openapi-contract.test.mjs.
- g45-buyer-order-reservation-qa.mjs/test, g45-buyer-order-race-ci.py, g45-buyer-openapi-contract.test.mjs.
- g46-merchant-staging-preflight-qa.mjs/test, g46-merchant-cutover-contract.test.mjs.
- g47-driver-evidence-lease-qa.mjs/test, g47-driver-evidence-openapi-contract.test.mjs.
- g48-scoped-db-gateway-qa.mjs/test, g48-scoped-db-delegation-race-ci.py, g48-delegation-openapi-contract.test.mjs.
- g42-provider-pinned-jwt-auth-qa.mjs usado como autoridad criptográfica de QA.

**Compartidos:** apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json y .github/workflows/mobility-g4-postgres-disposable.yml. No omitir g11-openapi-contract.test.mjs ni g12-openapi-integrity.test.mjs: default error y schema sellado requieren regresión.

**Detalles de cada archivo:** anexo de 515 paths y SHA blob; **detalles de cada cambio:** anexo de 714 commits/fechas, más documentos individuales G43–G48.

---

# 14. PENDIENTES P0 — LO QUE FALTA REALMENTE PARA UNA APP OPERATIVA

| Código | Pendiente crítico | Responsable | Restricción |
|---|---|---|---|
| P0-01 | JWT/JWKS/issuer/audience proveedor auténtico con sesiones/revocación y MFA AAL2 real | A | Conectar externo exige aprobación y credenciales |
| P0-02 | Puente Auth probado hacia emisor privilegiado mínimo G48, no el owner-only QA | A | No exponer ticket mint ni reabrir service_role |
| P0-03 | HTTPS STAGING real, IAM/RLS/DB y secretos fuera de código | A | NO deploy ni SQL remoto sin autorización Owner |
| P0-04 | **Chat persistente Cliente↔Driver por servicio, hilos privados y reasignación** | A backend/Driver; B Cliente/Admin | B R6–R13 ya espera backend A |
| P0-05 | Nuevas RPC de escritura G6/G9 con actor vinculado a JWT y privilegio mínimo | A | G46 cerró acceso antiguo intencionalmente |
| P0-06 | Nueva API de carga/revisión KYC G17 sin actor falsificable, auditable | A; interfaz Admin B | G47 cerró RPC antiguas |
| P0-07 | Storage privado auténtico, SHA de bytes del servidor, MIME mágico, scanner AV, cifrado y retención | A + legal | No usar documentos reales sin autorización |
| P0-08 | Cumplimiento Paraguay, licencias, seguro AUTO/MOTO, zonas municipales | Owner/legal + A | G31 elegibilidad false |
| P0-09 | GPS real + anti-spoof, permisos OS, heartbeat, consentimiento revocable | A/Driver | No extrapolar señales sintéticas |
| P0-10 | Push real + ACK dispositivo, retry/offline y notificación sin texto sensible | A/Driver; B Cliente | Outbox QA no prueba recepción física |
| P0-11 | Tarifas finales AUTO/MOTO PYG, comisiones, IVA/tributación, costos de ruta | Owner producto + A | No confiar en precios del teléfono |
| P0-12 | PSP, conciliación, reembolsos bancarios, liquidación conductor, antifraude | Owner finanzas + A | No dinero real sin GO |
| P0-13 | Incidentes/SOS y soporte humano real con protocolo de seguridad | Owner ops + A/B | G40 no garantiza socorro real |
| P0-14 | E2E cross-app Cliente/Driver/Admin, dispositivos Android/iOS físicos, caídas y recuperación | A+B por separado | Expo web != pruebas móviles |
| P0-15 | Backups, restore, escalabilidad, métricas, logs y controles abuse distribuidos | A | CI efímera != persistencia real |
| P0-16 | Revisión seguridad/legal independiente, tiendas, rollout zonas y GO/NO-GO | Owner + arquitectos | PR DRAFT hasta orden |

**Nunca prometer “100% lista”, “producción ya disponible”, “pagos habilitados” ni “se puede llamar un conductor” sobre QA.**

---

# 15. PLAN DE EJECUCIÓN DEL SIGUIENTE ARQUITECTO SIN PEDIR NUEVAS ÓRDENES

## G49 / A30 — identidad comprobada y permiso mínimo, inicialmente QA

1. Leer G42, G43, G46, G47, G48 y recuperar HEAD A/B + issue #9.
2. Diseñar un puente que acepte únicamente JWT firmado por un proveedor autorizado, valide pinning/issuer/audience/JWKS y obtenga usuario/sesión independiente y rol exclusivo; jamás confiar en actor UUID desde body.
3. Mantener G42 row-lock y emisor/consumidor G48 dentro de transacción con ámbito de actor/recurso. El emisor G48 owner-only de laboratorio NO se monta para usuarios reales.
4. Añadir tests de session revoke entre comprobación y mutación, JWKS rotada, firma inválida, role claim falso, AAL2 vencida, provider offline, ticket replay/cross-scope y rate limit.
5. SQL/test Node/OpenAPI, negativas de privilegios y dos conexiones PG. No conceder service_role legacy G6/G9/G17.
6. Antes de conectar proveedor real/SQL remoto/HTTPS solicitar solamente la autorización o credencial verdaderamente indispensable; si no está, dejar integración apagada y continuar G50 sintético.

## G50 / A31 — backend de CHAT, BLOQUEO DE INTEGRACIÓN MÁS URGENTE DE B

**Este gate puede avanzar por completo en QA sintética sin permiso de proveedor real.**
1. Leer handoff B R1–R13 y comentarios issue #9. B tiene inbox y navegación de chat Cliente, pero A no tiene backend chat real ni la interfaz de mensajes del Driver.
2. Modelar conversación immutable por conversationId vinculada a serviceId, serviceKind (RIDE, DELIVERY, MERCHANT_ORDER), passenger, Driver/repartidor actualmente asignado y revision de asignación.
3. Ante reasignación: invalidar hilo viejo, crear nuevo conversationId, prohibir que el Driver anterior escriba/lea; limpiar cualquier hint/cursor antiguo.
4. Persistir mensaje con requestKey idempotente, serverStored:true solo después del commit; lectura con cursor firmado/keyset, página finita pero SIN tope de mensajes/usuarios.
5. Revalidar actor, G42 y estado de servicio en cada GET/POST dentro de transacción PG; no confiar en navegación B ni JWT AAL2 autoafirmado.
6. Crear inbox/respuesta en apps/movete-driver/** (A), no editar apps/movete-cliente/** ni Admin B. Push genérico, sin texto de mensajes en notificaciones.
7. Probar dos conexiones, mensajes simultáneos, actor cruzado, replay key, red tardía, rol revoked, Driver cambiado, TTL, spam/rate limiting y outage.
8. Publicar contratos exactos en OpenAPI y en issue #9 para que B integre. Mantener runtime-wired:false hasta HTTPS verificable.

## G51 / A32 — comercio y documentos con RPC nuevas y mínimas

- Sustituir G6/G9 invoker/UUID por RPC privilegiadas con identidad derivada, sesión locked en la misma transacción, scopes por comprador/mercante/admin y auditoría.
- Reutilizar G45 para precio, stock, reserva, TTL/cancelación; mantener PSP OFF.
- Reemplazar G17 funciones de registro/revisión con rol mínimo, Admin con MFA verificada, no autoaprobación, objeto SHA/MIME/AV real cuando autorizado; no restaurar service_role.
- Ataques de actor confuso, stock exhausto, revisión/branch cruzadas, cancelación doble y suspensión de comercio.

## G52–G55 — componentes que siguen tras P0

- **G52:** geofencing/zona/seguros y consentimientos/GPS certificados, sin bypass de G31/G36.
- **G53:** push real, resiliencia en celular/batería/background/offline y E2E Driver/Cliente/Admin.
- **G54:** pagos, conciliación, soporte/emergencias, tasas/antifraude cuando haya autorizaciones.
- **G55:** escala, backup/restauración, observabilidad, revisión legal/seguridad y GO/NO-GO de tiendas/servicio.

**Si G49 depende de credenciales bloqueadas, comenzar G50 inmediatamente; si G50 depende de un contrato B, definir uno estable A y seguir con pruebas adversariales/Driver.**

---

# 16. BLOQUEOS REALES VS EXCUSAS PARA DETENER EL DESARROLLO

**Bloqueo real DE UNA ACCIÓN:** autorización Owner ausente para merge/deploy/conexión real; proveedor/KMS/secretos inaccesibles; datos/seguros/licencia legal no disponibles; riesgo de filtración PII; defecto crítico comprobado por CI; conflicto de propiedad A/B; conector GitHub inaccesible. Registrar evidencia y continuar otro módulo seguro.

**NO bloquear todo por:** Action pendiente; primera prueba roja (corregir); falta UI Lovable; no tener proveedor Auth de producción para construir QA; esperar a B; falta de fondos para servicios pagos; consulta de precio Bolt/Uber todavía incompleta; un único módulo externo pendiente. El trabajo de laboratorio y documentación puede continuar.

---

# 17. ERRORES DETECTADOS Y CORREGIDOS QUE NO DEBEN REINTRODUCIRSE

1. G37 revocó DML y apareció fallo de SELECT FOR UPDATE: reparar en RPC mínima, NO conceder escrituras indiscriminadas.
2. G42 separó autenticidad de token firmado frente a autorización del actor real.
3. G43 demostró que Auth check HTTP separado no cierra carrera de revocación: usar mismo bloqueo y transacción.
4. G44 descartó máximo global de artículos/zonas: keyset con páginas, sin limitar registros totales.
5. G45 no acepta monto cliente ni reenvío con requestKey modificado; stock calculado servidor.
6. G46 encontró esquema G9 ausente del CI integral y grants históricos peligrosos; instaló G9 y cerró G6/G9.
7. G47 arregló fixtures que no persistían, colisión de ruta sintética, orden SQL de revocación, projectRef QA y respuesta default OpenAPI.
8. G48 corrigió validador UUID Node de cuatro grupos en lugar de cinco; exigir test CI de JWT/rol/UUID.
9. Nunca atribuir 4/4 de SHA anterior al SHA documental nuevo ni confundir export web Expo con Android/iOS real.
10. Chat B R13 enlaza conversationId exacto y debe invalidarse en reasignación; el backend A futuro debe conservarlo.

---

# 18. PROCEDIMIENTO OPERATIVO AUTOMÁTICO DEL SIGUIENTE CHAT

1. Recuperar en GitHub head_sha/draft de PR #7 y #8; B está basado sobre rama A. Revisar issue #9.
2. Abrir este handoff, el de G0–G42, ambos anexos y la documentación del último G que se vaya a ampliar. No reescribir lo existente.
3. Confirmar cuatro workflows completed/success del MISMO HEAD; ver job logs si no pasa.
4. Elegir la primera tarea P0 que NO requiera permiso externo. Implementar en archivos A únicamente.
5. Cada gate debe incorporar SQL migración+ASSERT, pruebas de roles/PII, Node adapter+tests, contrato OpenAPI sellado, tests de concurrencia si afecta stock/chat/asignación/sesión y paso CI.
6. Commit en la rama A, nunca merge/force-push/deploy. Corregir rojos hasta 4/4 same SHA, no fingir.
7. Publicar documento técnico nuevo G49 y comentario issue #9 si hay API/dependencia B.
8. Continuar con el siguiente gate; el usuario explícitamente prohíbe interrupciones salvo bloqueo real.
9. Ante problema de red/herramienta no solucionable, registrar causa exacta y próximos comandos; no inventar un SHA/URL.
10. Mantener PRs DRAFT, datos sintéticos, no secretos, no PSP, no LIVE, no SQL remoto.

---

# 19. CRITERIOS DE ACEPTACIÓN PARA USUARIOS REALES — TODOS PENDIENTES HASTA PRUEBA

JWT Auth real y revocación, AAL2 Admin, RLS/IAM, HTTPS STAGING autorizado; documentos KYC bytes cifrados y scanner/retención; registros de comercio legal y geofencing; licencia/seguro; GPS/push físico; cálculos PYG/rutas; Driver slot+concurrencia real; chat privado Cliente↔Driver; SOS operativo; PSP/conciliación; respaldo/recovery; pruebas Android/iOS reales, seguridad/privacidad y aprobación Owner de rollout. **Ningún gate verde de QA sustituye cualquiera de estos requisitos.**

---

# 20. INSTRUCCIÓN LISTA PARA COPIAR AL NUEVO CHAT A

**ORDEN OWNER — CONTINUIDAD QORE MOBILE, ARQUITECTO A.**

Continúa construyendo Movete Fácil desde el repositorio GitHub mezas3238-hue/Qore-mobile-, PR #7 DRAFT y rama feature/mobility-monorepo-isolated-20261016. Lee inmediatamente el archivo docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G48_CONTINUIDAD_2026-10-23.md y los anexos de 714 commits y 515 archivos al HEAD G48; lee el handoff histórico G0–G42 y el último del B R1–R13. Recupera HEAD A/B y Actions actuales, no supongas que el commit funcional G48 201a687a sigue siendo HEAD, aunque su CI sí tiene 4/4 SUCCESS. Empieza G49 con Auth/sesión/JWKS y roles SQL mínimos en laboratorio; ante bloqueo de proveedor real, sigue sin pausa con G50: backend privado de chat Cliente↔Driver/repartidor y mensajería Driver que necesita B. NO pidas aprobación para cada paso seguro. Implementa SQL, Node, OpenAPI, pruebas adversariales y de dos conexiones, publica GitHub, exige 4/4 success del mismo SHA, informa issue #9 y pasa al siguiente bloque. Jamás pises apps/movete-cliente/**, apps/movete-admin/** o docs/architect-b/**. No merge, no deploy, no VPS, no LIVE, no PSP, no SQL remoto, ni secretos/PII reales sin orden explícita Owner.

---

# 21. CIERRE DE TRANSFERENCIA

**Estado real final previo a estos documentos:** G0–G48 construidos/certificados en diversos grados de QA, G48 SHA 201a687abf68df13b4947296f230b53b2f361fd6, cuatro workflows SUCCESS. Anexos históricos auditados cubren 714 commits alcanzables y 515 archivos al SHA funcional G48. PR A #7 DRAFT y PR B #8 DRAFT. No existe operación de calle ni Auth/proveedor/Storage/PSP/HTTPS STAGING reales conectados y certificados.

**Siguiente entrega exigida:** primer commit G49 o G50 real en rama A con CI verificado y nuevo documento de arquitectura, SIN reiniciar G0–G48 ni pedir nuevas órdenes para QA segura. Si algún permiso real falta, continuar otra tarea segura en el mismo ciclo.

**FIN DEL HANDOFF MAESTRO A G0–G48.**
