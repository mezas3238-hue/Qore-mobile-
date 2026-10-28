# QORE MOBILE — MOVETE FÁCIL
## HANDOFF MAESTRO INTEGRAL ARQUITECTO A — G0–G58E
### Transferencia soberana, historial completo, matrices P0, evidencias y continuidad sin pausas

**Corte:** 24 octubre 2026, Paraguay. **Repo GitHub:** https://github.com/mezas3238-hue/Qore-mobile- (**termina con guion**).
**A:** rama `feature/mobility-monorepo-isolated-20261016`, PR [#7 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/7), base main.
**B:** rama `feature/mobility-cliente-admin-parallel-20261022`, PR [#8 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/8), base A. **Separación irreversible de archivos.**
**Coordinación activa:** [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).
**SHA A funcional G58E 4/4 SUCCESS verificado:** `842143d2d82e03c7c10041051341f3daa643f783`.
**SHA B solo lectura observado:** `0261878d2ed12af1ff15f3b60f770691000d27c0`. B continúa en paralelo; revalidar HEAD y último R.
**IMPORTANTE:** este documento y sus dos anexos crean commits nuevos después del corte funcional G58E. **Verificar CI 4/4 en el HEAD documental más reciente antes de declarar su propia certificación.**

> **ORDEN OWNER DE CONTINUIDAD:** el próximo arquitecto debe trabajar desde GitHub de forma autónoma, empezando **G58F**, sin detenerse salvo **bloqueo real de una acción concreta**. Leer repositorio, implementar SQL/Node/tests en QA, corregir errores de CI y volver a probar, publicar commits/docs y pasar al siguiente gate SIN preguntar «¿avanzo?». Si una actividad exige permiso de despliegue, proveedor externo, credenciales/secretos, decisión legal, PSP o colisión de ownership A/B, NO ejecutarla; documentar el bloqueo y continuar otra tarea segura. No prometer trabajo futuro en segundo plano.

> **LÍMITES INNEGOCIABLES:** NO MERGE, NO LIVE, NO DEPLOY, NO VPS, NO SQL remoto, NO PSP/pagos ni push real, NO KYC/PII verdaderos en pruebas, NO secretos en código, NO publicación APK/IPA, NO tocar Cliente/Admin de B, NO unir apps. PR #7 y #8 permanecen DRAFT. **4/4 SUCCESS QA no significa app comercial lista.**

---

# 01. Fuentes de verdad, historial y auditoría nueva

1. Handoff A G0–G55 (historia detallada que se incorpora a continuación en secciones 02–20): [HANDOFF_MAESTRO_ARQUITECTO_A_G0_G55_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md](./HANDOFF_MAESTRO_ARQUITECTO_A_G0_G55_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md), 581 líneas; sus secciones 21–30 son **históricas**, porque G56–G58E ya se completaron en QA.
2. [Handoff A G0–G48](./HANDOFF_MAESTRO_ARQUITECTO_A_G0_G48_CONTINUIDAD_2026-10-23.md) y [G0–G42](./HANDOFF_MAESTRO_ARQUITECTO_A_G0_G42_CONTINUIDAD_2026-10-23.md).
3. [Anexo histórico G48, 714 commits](./ANEXO_A_HISTORIAL_GITHUB_714_COMMITS_AL_HEAD_G48_2026-10-23.md) y [515 archivos Git blob SHA](./ANEXO_A_INVENTARIO_515_ARCHIVOS_HEAD_G48_2026-10-23.md).
4. [Anexo G48→G55 104 commits](./ANEXO_A_G48_A_G55_104_COMMITS_2026-10-24.md) y [566 archivos G55](./ANEXO_A_G55_INVENTARIO_566_ARCHIVOS_SHA_2026-10-24.md).
5. **NUEVO:** [Anexo G55→G58E, 107 commits completos y SHA](./ANEXO_A_G55_A_G58E_107_COMMITS_2026-10-24.md). GitHub Compare desde `44326e01006f9456fa711e55df22dfe03702cee5` hasta `842143d2d82e03c7c10041051341f3daa643f783` devuelve `ahead_by=107, behind_by=0, total_commits=107`, 107 entries, sin paginación parcial.
6. **NUEVO:** [Inventario HEAD G58E, 621 blobs + 37 directorios = 658 entradas](./ANEXO_A_INVENTARIO_ARCHIVOS_HEAD_G58E_2026-10-24.md), SHA Git blob, ruta y tamaño de **cada archivo**. GitHub Tree `truncated=false`. La rama posterior incorpora además estos anexos y el handoff.
7. [División A/B](./DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md).
8. Fuente B solo lectura: `docs/architect-b/STATUS_Y_CONTRATOS.md`, `docs/architect-b/CONTINUIDAD_B_R43_BANDEJA_CASOS_COMERCIALES_ADMIN_2026-10-24.md` y handoff B R1–R33. B puede haber continuado después.
9. OpenAPI: `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json`; al corte versión `1.0.0-g57`, con contratos futuros runtime OFF incluso para G58. Auditoría B R43 contabilizó 72 rutas, **no 72 APIs públicas montadas**.
10. CI A: `.github/workflows/mobility-g4-postgres-disposable.yml`, `mobility-staging-node-contracts.yml`, `mobility-ci.yml`, `movete-apps-isolation.yml`. Confirmar siempre las cuatro en **un mismo SHA**, no mezclar cortes.

## 01.1. Evidencia del último corte funcional G58E

| Workflow | Run | Resultado sobre SHA `842143d2d82e03c7c10041051341f3daa643f783` |
|---|---|---|
| PostgreSQL16 disposable | [#595](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40092996629) | SUCCESS |
| Node STAGING contracts | [#965](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40092996631) | SUCCESS |
| Expo isolated CI | [#1638](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40092996630) | SUCCESS |
| Two-app isolation | [#1139](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40092996654) | SUCCESS |

---

# HISTORIA 02–20: TRANSFERIDA LITERALMENTE DEL HANDOFF A G0–G55
**Esta parte conserva la evidencia histórica y los gates realizados. No seguir su viejo plan G56/G57/G58; el plan ACTUAL comienza en `# 35` de este documento.**

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

---

# 14. G49 / A35 — JWT pinneado a delegación privada de chat

**YA IMPLEMENTADO Y CERTIFICADO EN QA**, no lo planifiques otra vez. SHA funcional `68f3918b7eaf90f824ee335501ccf1b397f17344`. Documento `docs/architecture/G49_PROVIDER_PINNED_CHAT_DB_DELEGATION_QA_2026-10-23.md`.

**Archivos principales A:**
- `apps/mobility-expo/docs/backend/staging_only/G49_SCOPED_CHAT_AUTH_BRIDGE_POSTGRES_CI_ONLY.sql` y `_ASSERT_POSTGRES_CI_ONLY.sql`.
- `apps/mobility-expo/server/g49-pinned-chat-scoped-bridge-qa.mjs`, `.test.mjs`, `g49-pinned-chat-scoped-bridge-openapi-contract.test.mjs`.
- Actualizaciones OpenAPI y workflow PostgreSQL.

**Trabajo exacto:**
1. Rol PostgreSQL `mobility_g49_chat_gateway_ci` **NOLOGIN NOINHERIT** sin permiso DDL, SUPERUSER, tablas de mensajes/tickets/grants ni owner RPC.
2. Capacidad opaca UUID aleatoria con hash SHA-256 de almacenamiento, duración 20 segundos, un solo uso, propósito CHAT_OPEN / CHAT_HISTORY / CHAT_SEND, ligada a pasajero, sesión, token iat, servicio, tipo de servicio y conversación.
3. Solo tres wrappers delegadas `mobility_stage_g49_open_qa`, `mobility_stage_g49_history_qa`, `mobility_stage_g49_send_qa`; denegadas para `anon`, `authenticated`, `service_role`, G48 y APIs de cliente. Mint owner-only exclusivo QA sintético.
4. SELECT FOR UPDATE + G42_lock_session y chequeo de rol Passenger exclusivo y fuente de asignación de Driver **en la misma transacción**. Reassignment/session revoke/purpose ajeno/replay: rechazo.
5. Node compone verificador JWT JWS criptográfico G42 (fixture **ES256 firmado realmente** en tests), lectura independiente de usuario/sesión/provider grant, rate gate y rol Passenger; rechaza actorId/role/subject enviados por el móvil.
6. Se probó falsificación de firma, issuer, audience, sesión, rol Driver, desconocidos, token expirado, ticket y recibo alterado, caída provider/DB.
7. Se reparó test negativo que confundía UUID válido con ticket autorizado; formato de UUID ≠ permiso.

**4/4 SUCCESS mismo SHA G49:** PostgreSQL [#40050970947](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40050970947), Node [#40050970985](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40050970985), Expo [#40050970992](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40050970992), aislamiento [#40050971001](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40050971001).

**NO es Auth real**: `mint_owner_qa` es emisor sintético ejecutado por propietario del laboratorio; no hay credenciales SQL de gateway real, proveedor Auth remoto, endpoints montados ni HTTPS público. Un rol NOLOGIN no se conecta por sí solo a Supabase.

---

# 15. G50 / A31 — chat privado Cliente ↔ Driver por servicio

**YA IMPLEMENTADO EN QA.** Documento `docs/architecture/G50_PRIVATE_ASSIGNMENT_CHAT_QA_2026-10-23.md`.

**Archivos:**
- `G50_PRIVATE_SERVICE_CHAT_POSTGRES_CI_ONLY.sql` y `G50_PRIVATE_SERVICE_CHAT_ASSERT_POSTGRES_CI_ONLY.sql`.
- `server/g50-private-chat-qa.mjs`, `g50-private-chat-qa.test.mjs`, `g50-private-chat-openapi-contract.test.mjs`, `g50-private-chat-concurrency-ci.py`.
- Pantalla propia A `apps/movete-driver/app/mensajes.tsx`.

**Trabajo:**
1. Conversación UUID específica de tipo `RIDE`, `DELIVERY`, `MERCHANT_ORDER` y de servicio; pasajero y conductor/courier **actualmente asignado**.
2. Cambio de Driver cierra hilo anterior y crea otro conversationId; antiguo conductor no puede leer ni enviar ni reusar cursor del hilo antiguo.
3. `requestKey` idempotente por conversación y emisor, body coincidente devuelve recibo persistido; body distinto con el mismo key da `G5009`.
4. Validación SQL y Node de cuerpo <=500 caracteres sin emails, teléfonos, URLs, caracteres de control/bidi o HTML; sin material KYC o ubicación en mensajes ni texto sensible en push.
5. Historial por keyset/seq y páginas máximo 100, sin límite global de mensajes/usuarios.
6. Rol y sesión G42, asignación, servicio activo, todo reevaluado dentro de transacción PG; carrera con dos conexiones para open/send/revocación.
7. Driver tiene **pantalla de navegación Mensajes**, pero solo muestra que el backend está en preparación: **no hay controles operativos de envío**, no confundir pantalla con chat real.

OpenAPI de G50 declara rutas futuras para abrir/leer/enviar; `x-qore-runtime-wired:false`. No conectar a la app real saltando Auth.

---

# 16. G51 / A32 — inbox, actividad, unreadCount y read receipts

**YA IMPLEMENTADO QA.** Documento `docs/architecture/G51_CHAT_INBOX_HMAC_READ_RECEIPT_QA_2026-10-23.md`.

SQL `G51_CHAT_INBOX_MONOTONIC_POSTGRES_CI_ONLY.sql` + ASSERT; Node `server/g51-chat-inbox-qa.mjs` + test/contrato.

- Tablas privadas de actividad por conversación, read watermark monotónico por pasajero, revisión inbox específica del titular y triggers de cambio.
- Lista paginada ordenada por actividad solo con hilos ACTIVE y fuente Driver vigente; 205 conversaciones en 3 páginas QA. **pageSize <=100 NO es un tope global.**
- Cursor HMAC SHA-256 ligado a identidad, sesión, iat, revisión, keyset y expiración.
- Proyección estricta de `unreadCount` por actor; soporte de cursor revisado y denegación de roles ajenos/revocados.
- `mobility_stage_g51_mark_read_owner_qa` no permite futuro ni retroceso de watermark. No está montada como API.
- **Dependencia descubierta:** Cliente B no dispone del `seq` real en G52; jamás inferirlo desde `revision`, tiempo o UUID. Se resolvió en QA mediante **G55 readMarker** separado.

---

# 17. G52 / A33 — historial privado de mensajes versionado, contrato exacto Cliente B

**YA IMPLEMENTADO QA.** Documento `docs/architecture/G52_SIGNED_PRIVATE_CHAT_HISTORY_QA_2026-10-23.md`.

SQL `G52_CHAT_HISTORY_KEYSET_POSTGRES_CI_ONLY.sql` + ASSERT, Node `g52-chat-history-qa.mjs`+test+OpenAPI, Python `g52-chat-history-concurrency-ci.py`.

- Tabla de revisiones por conversación y versiones inmutables por mensaje; trigger eleva revision al insertar mensaje.
- SELECT FOR SHARE sobre fila versionada hasta commit impide intercalación de inserción con lectura G52 inconsistentemente.
- 205 mensajes paginados en tres páginas, cursor HMAC ligado a actor/session/conversación/tipo de servicio/revisión/expiración.
- Encabezado DTO **EXACTO**: `conversationId,serviceId,serviceKind,ownerId,counterpartRole,assignmentVerified,state,revision,generatedAt,expiresAt,messages,nextCursor,canSend,productionEnabled`.
- Mensaje DTO **EXACTO**: `messageId,senderRole,body,createdAt,revision`.
- No agregar `seq`, `throughSeq` ni campos extra a Header/Message porque B los rechaza estrictamente. G55 anida página y adjunta sidecar.
- Cursor o revisión stale, JWT/session/actor/servicio/reasignación no coincidente → fail-closed.
- CI G52 funcional SHA `6f73b0b7b4d366e27fa25f4a41f72ebe2d82d9c1`; la cadena G55 posterior continúa probándolo.

---

# 18. G53 / A34 — ACK durable e idempotencia de envío Passenger

**YA IMPLEMENTADO QA.** Documento `docs/architecture/G53_DURABLE_PASSENGER_CHAT_ACK_QA_2026-10-23.md`.

Archivos SQL `G53_PASSENGER_CHAT_SEND_POSTGRES_CI_ONLY.sql`+ASSERT; Node `g53-passenger-chat-send-qa.mjs`+test+OpenAPI; Python `g53-passenger-chat-send-concurrency-ci.py`.

- ACK persistido con **exactamente** `conversationId,serviceId,requestKey,messageId,senderRole,body,createdAt,revision,serverStored`; epoch ms, senderRole passenger.
- Dos envíos mismo requestKey/body no insertan dos mensajes y retornan la revisión histórica original; cuerpo distinto rechaza colisión.
- Revocación G42, rol, servicio terminal, cambio de Driver y replays son denegados incluso después de una respuesta anterior.
- Python carrera PostgreSQL de dos conexiones con misma key y cierre de sesión; comparación de recibos originales.
- OpenAPI G53 apunta al futuro POST con `x-qore-runtime-wired:false`.
- Reparado test G52 anterior que fijaba una versión OpenAPI ya superada.

**4/4 G53 SHA `6f81e870bc6576252aa863d5d022ec8810197b8f`:** PostgreSQL [#40050157725](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40050157725), Node [#40050157813](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40050157813), Expo [#40050157741](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40050157741), aislamiento [#40050157726](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40050157726).

**Deuda real:** si B actualizó su header G52 durante retry de requestKey, el ACK original puede tener `revision < header.revision`. Nunca inventar revision nueva para satisfacer UI; reconciliar mediante reconsulta segura G52 y solicitud idempotente, coordinando con B.

---

# 19. G54 / A36 — tickets de un uso para inbox y confirmaciones de lectura

**YA IMPLEMENTADO, CERTIFICADO QA.** SHA `49c1d19913242774ec6dff03d5d838b7dae80235`. Documento `docs/architecture/G54_SCOPED_CHAT_INBOX_READ_RECEIPTS_QA_2026-10-23.md`.

Archivos: `G54_SCOPED_CHAT_INBOX_READ_POSTGRES_CI_ONLY.sql`+ASSERT; Node `g54-scoped-chat-inbox-read-qa.mjs`+test+OpenAPI; Python `g54-scoped-chat-inbox-read-concurrency-ci.py`.

- Tabla de tickets separada de G49, solo `CHAT_INBOX` y `CHAT_READ`, SHA-256 de UUID aleatorio, 20 s, un uso, actor/sesión/iat/conversación.
- Rol NOLOGIN `mobility_g49_chat_gateway_ci` obtiene SOLO wrappers g54_inbox_qa/g54_mark_read_qa; **no** tabla ni RPC Owner G51.
- Revalidación transaccional de G42 session-lock/rol Passenger/hilo Driver actual; `FOR UPDATE` sobre el ticket.
- Tests SQL usan `SET LOCAL ROLE mobility_g49_chat_gateway_ci` real, no una llamada privilegiada simulada.
- Python dos conexiones compiten por mismo ticket, solo una gana; revocación G42 espera commit de operación que ya tiene bloqueo.
- Node reutiliza cursor HMAC inbox G51 y valida DTO estricto de marca de lectura.
- DTO `conversationId,readThrough,qaOnly` existe para backend QA; **no** hacer que B invente `throughSeq` para consumirlo.
- OpenAPI futuras rutas siguen OFF.

**4/4 SUCCESS G54:** PostgreSQL [#40051851951](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40051851951), Node [#40051851922](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40051851922), Expo [#40051851919](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40051851919), aislamiento [#40051851910](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40051851910).

---

# 20. G55 / A37 — marcador opaco de lectura emitido desde historial real de SQL

**YA IMPLEMENTADO, CERTIFICADO QA.** SHA **`44326e01006f9456fa711e55df22dfe03702cee5`**. Documento `docs/architecture/G55_G52_HISTORY_BOUND_READ_MARKERS_QA_2026-10-24.md`.

Archivos:
- SQL `G55_SERVER_ISSUED_READ_MARKERS_POSTGRES_CI_ONLY.sql`+ASSERT (en apps/mobility-expo/docs/backend/staging_only).
- Node `server/g55-private-read-markers-qa.mjs`, `.test.mjs`, `g55-private-read-markers-openapi-contract.test.mjs`.
- Python `server/g55-private-read-markers-concurrency-ci.py`; OpenAPI 1.0.0-g55 y workflow PostgreSQL.

**Implementación concreta:**
1. Tabla privada de markers guarda SHA-256 de UUID opaco, pasajero, sesión, token iat, hilo, messageId del Driver, seq **interna**, revisión histórica G52, emisión, expiry 60 s y consumedAt. SDK y rol gateway no tienen acceso directo.
2. `mobility_stage_g55_history_marker_qa` consume ticket G49 `CHAT_HISTORY`, toma una página **autorizada de G52** y crea marcador SOLO para el mensaje más reciente del **Driver** incluido en esa página. Si no hay mensaje Driver, devuelve null.
3. Sidecar futuro: `{page,readMarker,qaOnly:true,productionEnabled:false}`, donde page conserva exactamente DTO G52, y readMarker es null o `{marker,messageId,expiresAtMs}`. No añade `seq` a DTO de B.
4. `mobility_stage_g55_mark_viewed_qa` exige **DOS pruebas** independientes: marker G55 de página entregada y ticket NUEVO G54 `CHAT_READ` de la misma cuenta/sesión/iat/conversación; revalida Driver, mensaje/revisión G52 y servicio vigente. Deriva `message_seq` solo en SQL. Consume marker una vez.
5. Respuesta al futuro Cliente `{conversationId,messageId,readConfirmed:true,qaOnly:true}`. Ni `throughSeq` ni raw `seq` salen al móvil.
6. Trigger G51 corregido para no aumentar revisión de inbox cuando una relectura no cambia watermark. G55 es idempotente para ese estado sin actividad falsa.
7. En pruebas SQL se asume realmente el rol delegado NOLOGIN; Python dos transacciones reales intentan mismo marker con tickets distintos: exactamente una confirma, otra recibe `G5505`. Sesión revocada → `G5401`.
8. Adaptador Node compone G52 JWT/session/HMAC con wrappers G49/G55 y mantiene marker **por invocación** para no mezclar concurrentes. Sin ruta HTTP montada.
9. OpenAPI G55 registra futuras rutas **OFF**:
   - `GET /v1/staging/chat/services/{serviceKind}/{serviceId}/history-with-read-marker`.
   - `POST /v1/staging/chat/conversations/{conversationId}/mark-visible`, body SOLO `{marker}`.
10. Corregidos cinco errores detectados por CI: UUID regex de cinco grupos; marker compartido entre solicitudes; lock `FOR UPDATE` history ticket en vez de upgrade conflictivo; respuestas de error default + bearer exigidas por G11/G12; rechazo inmediato de clave HMAC débil.

**4/4 CI MISMO SHA G55:**
| Workflow | Enlace exacto | Resultado |
|---|---|---|
| PostgreSQL #490 | [40057044336](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40057044336) | SUCCESS |
| Node STAGING #805 | [40057044337](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40057044337) | SUCCESS |
| Expo #1458 | [40057044376](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40057044376) | SUCCESS |
| Aislamiento #925 | [40057044342](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40057044342) | SUCCESS |

**ADVERTENCIA DE VERDAD DE USO:** G55 prueba que un mensaje estaba contenido en una respuesta autenticada de historia. **NO** prueba que un humano realmente lo vio en pantalla. El Cliente B debe disparar POST solo cuando se observe explícitamente el mensaje en la UI, NO al recibir historial, abrir chat, hacer scroll implícito o recibir push. Un marker caduca a los 60 s. **Nuevo riesgo:** marcar leído hasta la secuencia de un mensaje puede abarcar otros más antiguos que el pasajero todavía no visualizó, si la UI no garantiza lectura **contigua**. Resolver esta semántica con B antes de ofrecer read receipts reales, o introducir proof por mensaje/segmento verificado. No inventar readThrough desde revision ni timestamp.

---


---

# 21. Nuevo corte G56–G58E: alcance y rigor de certificación

Desde el corte G55, GitHub registra **107 commits** hasta el HEAD funcional G58E; los nombres/fechas/SHA están en el anexo nuevo. Se agregaron pruebas y contratos de mensajería **Driver y Passenger separados** y barreras Auth/SQL/HTTP de laboratorio. **No** hay infraestructura de usuarios reales conectada, URL HTTPS pública, SMS/push real, SEND HTTP activo ni despliegue en dispositivos reales. Las pruebas de PostgreSQL16 disposable no prueban configuración de credenciales de producción; la firma ES256 del JWT en CI es verdadera criptográficamente, pero el issuer/provider/session y el owner ticket son datos sintéticos.

# 22. G56 / A38 — CHAT DRIVER de scope exclusivo

**Hecho:** motor Driver de OPEN/HISTORY/SEND en SQL QA con rol delegado **`mobility_g56_driver_gateway_ci` NOLOGIN/NOINHERIT**, nunca reutilizar el rol Passenger G49 para Driver. Ticket UUID opaco 20s de un uso, ligado a Driver/servicio/conversación/asignación actual, session G42 y token JWT iat. La reasignación invalida el hilo anterior. Se comprueban permisos en transacción. Cuerpo de mensaje seguro y requestKey idempotente, ACK servidor SQL, controles de sesión y rol, sin actores falsificados en UI.

**Fuentes:** `G56_DRIVER_SCOPED_CHAT_POSTGRES_CI_ONLY.sql` + `_ASSERT` en `apps/mobility-expo/docs/backend/staging_only/`; `server/g56-driver-scoped-chat-qa.mjs` y test; `server/g56-driver-scoped-chat-concurrency-ci.py`, test OpenAPI; [detalle G56](../architecture/G56_DRIVER_CHAT_DELEGATED_NODE_SQL_QA_2026-10-24.md). SQL Driver puede enviar en QA, pero **no existe POST SEND HTTP productivo**.

# 23. G56B — inbox Driver privado, sin cap global

**Hecho:** lectura Driver de conversaciones activas por actividad con rol/asignación correctos; prueba **205 hilos 100/100/5**, HMAC de cursor, revisión monotónica, unreadCount y paginación sin tope total de 50 usuarios/registros. SQL/ASSERT `G56B_DRIVER_SCOPED_INBOX_*`; Node `server/g56b-driver-private-inbox-qa.mjs` y test; Python `g56b-driver-private-inbox-concurrency-ci.py`, OpenAPI, [doc G56B](../architecture/G56B_DRIVER_PRIVATE_INBOX_QA_2026-10-24.md). Pruebas de rol ajeno, nueva asignación, replay y revocación fail closed.

# 24. G56C — controlador de estado de chat Driver, SIN montaje de red

`apps/movete-driver/src/domain/driver-chat-inbox.mjs` y `.d.mts`, test de sesión/logout/identidad, páginas y respuesta de otro owner. El estado visible evita token, PII y cursores SQL. La pantalla `apps/movete-driver/app/mensajes.tsx` **todavía NO tiene composer ni conexión real**, es informativa. No afirmar Driver chat operativo en teléfonos. [G56C](../architecture/G56C_DRIVER_MOBILE_CHAT_INBOX_FAIL_CLOSED_2026-10-24.md).

# 25. G57 / A39 — lectura CONTIGUA Passenger de mensajes Driver

**Hecho:** se corrigió el riesgo conceptual G55 de marcar hasta el último mensaje servido saltando previos no visibles. SQL G57 genera marcador opaco **por cada mensaje entrante Driver en historia G52 autorizada**; marker 60s, ticket CHAT_READ 20s de un uso. PostgreSQL marca solamente el **PRIMER mensaje entrante no leído** en orden bajo `pg_advisory_xact_lock`, G42 sesión/transacción y asignación. `G5708` salta-a-mensaje-posterior rechazado; `G5709` marcador ya leído. La UI no ve `seq`, solo `{marker,messageId,expiresAtMs}` por mensaje en sidecar `{page,readMarkers,qaOnly,productionEnabled}`. Las antiguas funciones delegadas G54/G55 de skip fueron REVOKED; **no restaurarlas**.

**Archivos:** `G57_ORDERED_VISIBLE_RECEIPTS_POSTGRES_CI_ONLY.sql` y ASSERT; `server/g57-ordered-visible-qa.mjs` + tests/OpenAPI; `server/g57-ordered-visible-concurrency-ci.py`. Dos conexiones prueban carreras de read/revoke. [Doc G57](../architecture/G57_ORDERED_VISIBLE_READ_RECEIPTS_2026-10-24.md).

**Límite:** SQL prueba marker emitido a una página autorizada y ACK contiguo; **NO prueba viewport real**. El Cliente B debe enviar ACK SOLO por visibilidad efectiva y en orden, no por GET/push/abrir chat/scroll implícito.

# 26. G57B / A40 — lectura CONTIGUA Driver de mensajes Passenger

**Hecho:** lado inverso simétrico y **rol Driver dedicado**. G56 Driver HISTORY emite marker por cada mensaje de `senderRole:'passenger'`; Driver MARK_VISIBLE de un uso bajo G42/asignación; `G5718` skip y `G5719` leído anteriormente. Node mantiene DTO G56 exacto y entrega sidecar separado. SQL bloquea el primer entrante; watermark G51 solo avanza contiguamente. Python con dos conexiones y sesión revocada. [Doc G57B](../architecture/G57B_DRIVER_INCOMING_PASSENGER_ORDERED_READ_2026-10-24.md).

**Archivos:** `G57B_DRIVER_ORDERED_VISIBLE_POSTGRES_CI_ONLY.sql` + ASSERT; `server/g57b-driver-ordered-visible-qa.mjs`, test y OpenAPI; `server/g57b-driver-ordered-concurrency-ci.py`.

**G57/G57B corte combinado certificado:** `2e99c6f140030a7ff1ea33d76415e4bae8c00b74`; PG [#554](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40086651370), Node [#889](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40086651216), Expo [#1562](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40086651302), aislamiento [#1060](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40086651306): **4 SUCCESS mismo SHA**.

# 27. G58 / A41 — transporte HTTP LOCAL con SQL delegado

**Hecho:**
- `server/g58-chat-loopback-transport-qa.mjs`: servidor Node sin escuchar al importarlo; `listen()` solo a `127.0.0.1` y puerto efímero. Cinco rutas QA: Driver Inbox, Driver historia, Passenger historia, Driver MARK_VISIBLE y Passenger MARK_VISIBLE. Exige Bearer encaminado al adaptador servidor (no confía en actor de JSON). Métodos/path/body/query exactos, cookies/origin/referrer denegados, respuestas sin JWT, sessionId, raw seq, SQL, credenciales, PII. **No hay POST SEND**.
- `server/g58-delegated-chat-sql-qa.mjs`: allowlist de **6** consultas (CHAT_OPEN Passenger G49 + Driver Inbox/History/Mark y Passenger History/Mark), BEGIN, `SET LOCAL ROLE` dedicado, verificación `current_user`, `current_database=qore_disposable_chain` y `application_name=qore_ci_disposable_chain`, una consulta SQL parametrizada y COMMIT/ROLLBACK. Funciones y nombres de roles CONSTANTES; no SQL ni owner mint desde HTTP.
- `server/g58-delegated-role-isolation-ci.py`: PostgreSQL16 real local para grants de Driver/Passenger NOLOGIN/NOINHERIT, mutual exclusion, owner mint inaccesible, tablas privadas inaccesibles y recuperación del rol tras COMMIT.
- `server/g58-chat-loopback-transport-qa.test.mjs`, `g58-delegated-chat-sql-qa.test.mjs`, OpenAPI futuro runtime OFF. Ver [doc G58](../architecture/G58_LOCAL_CHAT_TRANSPORT_AND_DELEGATED_SQL_QA_2026-10-24.md).
- Nuevo wrapper Auth G58 inicial fue bloqueado por controles de publicación del conector, **no** existe ese archivo. En G58B se reutilizó G42 existente sin bypass.

**G58 corte:** `6a2d9419c958569a5b311d9aae7114f9f4ca6b81` 4/4: PG #564, Node #907, Expo #1580, aislamiento #1079.

# 28. G58B / A42 — G42 JWT firmado a historia/lectura HTTP localhost

**Hecho:** `server/g58b-local-auth-chain-qa.mjs` compone G42 verificador ES256 JWK pinneado, issuer/audience, proveedor usuario/sesión/grant G42 inyectado e independiente, rol exclusivo, emisor de ticket **sintético QA**, ejecutor SQL G58 y los cinco handlers G56B/G57A/G57B. Un JWT ES256 de CI se firma con par efímero verdadero; es criptográficamente verificable, pero proveedor/usuario/DB del ensayo E2E son simulados, no Auth comercial.

**Archivos:** `server/g58b-local-auth-chain-qa.mjs`, `.test.mjs`, ajuste de allowlist SQL `CHAT_OPEN` vía `public.mobility_stage_g49_open_qa($1)` y grant Passenger. Dos capas de prueba: HTTP con mock DB, y por separado rol/grants reales sobre PostgreSQL16 desechable. Negativos: firma/issuer/audience/role/iat/exp inválidos, actor ajeno, sesión revocada, marker no autorizado, sesión/servicio ajenos. Se corrigió regex UUID de cuatro grupos a cinco.

**G58B corte:** `3bb5e57f4c59b4c48021f8561f8d2f2341844f83`; PG #570, Node #919, Expo #1592, aislamiento #1096: SUCCESS. [Doc G58B](../architecture/G58B_PINNED_AUTH_DELEGATED_CHAT_E2E_QA_2026-10-24.md).

# 29. G58C / A43 — rate limit interno por identidad

**Hecho:** `server/g58c-local-chat-rate-gate-qa.mjs`, integrado a G58B, máximo **30 peticiones por minuto POR actor verificado G42**; hasta 512 actores contados en memoria, reloj hacia atrás/capacidad agotada → fail closed, solo cinco operaciones de lectura/acuse. Un test HTTP envía 30 requests Driver válidos, request 31 obtiene 429 SIN acuñar otro ticket y usuario Passenger independiente conserva cuota. No confiar en IP ni actorId del cliente ni agregar scopes extra. `server/g58c-local-chat-rate-gate-qa.test.mjs` + integración G58B; [doc G58C](../architecture/G58C_LOCAL_CHAT_RATE_BUDGET_QA_2026-10-24.md).

**G58C corte:** `cda87026ebeb5e2d5724bbf6862f09077629287d`; PG #577, Node #931, Expo #1604, aislamiento #1103 SUCCESS. **No es rate limiting distribuido real**.

# 30. G58D / A44 — límites SQL y cliente envenenado

**Hecho:** `server/g58d-bounded-sql-leases-qa.mjs` controla hasta **4** leases SQL simultáneos en G58B, acquire timeout **800 ms**, query timeout **2500 ms**. Tras timeout/error destruye conexión mediante `release(true)`, no la devuelve reusable; una conexión adquirida TARDE también se descarta. El SQL delegado ejecuta dentro de transacción tres `SET LOCAL` fijos: `statement_timeout=2500ms`, `lock_timeout=500ms`, `idle_in_transaction_session_timeout=3500ms`; reset por COMMIT/ROLLBACK. No permitir que HTTP los cambie.

**Archivos:** `server/g58d-bounded-sql-leases-qa.test.mjs`; `server/g58d-disposable-sql-timeouts-ci.py`, workflow PG; test real de `pg_sleep` cancelado y advisory lock de dos conexiones, recuperación tras rollback. Fixture Node G58B se adaptó a reconocer estos tres SET LOCAL exactos (primer CI falló y se corrigió). [Doc G58D](../architecture/G58D_BOUNDED_DB_TIMEOUTS_QA_2026-10-24.md).

**G58D corte:** `0ad30f1e8109b64455c037940c2b2271564d94b4`; PG #588, Node #951, Expo #1624, aislamiento #1125 SUCCESS.

**Advertencia crítica:** al vencer tiempo DURANTE COMMIT, el estado del mensaje/pedido puede quedar INDETERMINADO para HTTP. No asumir rollback; reconciliar con requestKey idempotente y consulta servidor. Nunca reintento ciego de mutaciones.

# 31. G58E / A45 — protección de HTTP lento, capacidad y revalidación tickets

**Hecho en `server/g58-chat-loopback-transport-qa.mjs`:**
- Socket local obligado, `maxHeaderSize=8192` bytes; `maxHeadersCount=32`; `headersTimeout=2000 ms`, `requestTimeout=3000 ms`, `server.timeout=3000 ms`, keepalive 1000 ms; `maxRequestsPerSocket=10`, `maxConnections=16` y **12 handlers concurrentes**. Handler 13 devuelve 503 `G58E_GATEWAY_CAPACITY` sin entrar en Auth/SQL.
- Timeout de handler **2400 ms** responde 503 `G58E_OUTCOME_UNKNOWN`. **NO significa COMMIT abortado** y nunca debe disparar reenvío de una escritura sin idempotencia. Node puede cortar exceso de cabeceras con **431 SIN JSON**, no tratar como pérdida de seguridad ni esperar parse JSON siempre.
- `server/g58e-loopback-hardened-qa.test.mjs`: 12 requests activos, request 13 rechazado, deadline sin ACK falso, cabeceras excesivas, no LIVE.

**Hecho en `server/g58e-audited-qa-ticket-issuer.mjs`:** wrapper QA server-only sobre emisor propietario SINTÉTICO (no RPC real): exactamente seis scopes DRIVER_INBOX, DRIVER_HISTORY, DRIVER_MARK_VISIBLE, CHAT_OPEN, CHAT_HISTORY, CHAT_READ, actor UUID, sesión, token iat, clase de servicio y conversación. Revalida rol exclusivo y G42 sesión **antes y DESPUÉS** de invocar fixture mint. Si se revoca sesión o cambia rol durante mint, el ticket no se entrega. Ticket TTL <=20s, qaOnly:true, productionEnabled:false. `server/g58e-audited-qa-ticket-issuer.test.mjs` prueba falsas identidades/scopes/operaciones, revocación antes/durante, cambio de rol y rechazo Live. G58B usa `scopedIssuer`, variable renombrada tras fallo de `const issuer` duplicado.

**CI G58E funcional** `842143d2d82e03c7c10041051341f3daa643f783`, **4/4 mismo SHA**: PG [#595](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40092996629), Node [#965](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40092996631), Expo [#1638](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40092996630), aislamiento [#1139](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40092996654). [Doc G58E](../architecture/G58E_LOCAL_HTTP_HARDENING_TICKET_FENCE_2026-10-24.md).

**Límite NO resuelto:** SQL owner-only mint sigue sintético; el wrapper Node no convierte a issuer productivo. No se ha conectado Auth provider remoto, pool/login SQL con permisos mínimos real, servidor HTTPS, SEND HTTP, smartphone físico ni UI de chat Driver. Revalidar en Node dos veces NO garantiza atomicidad hasta COMMIT: se requiere lock G42 en PostgreSQL.

# 32. Colaboración B verificada al corte — no modificar su trabajo

**PR #8 DRAFT**, HEAD observado `0261878d2ed12af1ff15f3b60f770691000d27c0`; se basa en A y avanza independientemente. \`docs/architect-b/CONTINUIDAD_B_R43_BANDEJA_CASOS_COMERCIALES_ADMIN_2026-10-24.md\` describe R43: bandeja **Cliente/Admin para casos MERCHANT_ORDER en QA**, no servicio real, sin endpoint montado, operadores humanos, SMS o SOS. Cliente cuenta con adaptadores HTTP fail-closed para G51/G52/G53/G55, soporte/comercios y UX; Admin Web con controles QA. No atribuir estos módulos a A ni editarlos.

**Dependencias A reclamadas por B:** contrato Auth Passenger/MFA Admin REAL; backend de casos comerciales filtrando `subjectKind=MERCHANT_ORDER` **antes** de paginar (no reutilizar G41 OTHER), permisos por organización, revisión/TTL, agentes y ACK idempotente; comunicación segura Cliente↔comercio/soporte distinta del Driver; DTO Rider/Delivery status server-authoritative; contrato de stock/catálogo/pedidos versionado; conciliación G53 ACK histórica con historia G52 actual; marcadores G57 sin sobrerlectura. Publicar contratos y tests A en issue #9, B consume en sus rutas.

# 33. Matriz P0 de TRABAJOS AÚN FALTANTES para producto real

| ID | Trabajo pendiente y aceptación obligatoria | Responsable |
|---|---|---|
| P0-01 | Proveedor real JWT/issuer/audience/JWKS con rotación de claves, usuario/sesión/roles actuales, revocación, AAL2 Admin verificable | A + Owner |
| P0-02 | Emisor de tickets **NO-owner expuesto**, con permisos mínimos/SECURITY DEFINER auditado y G42 lock transaccional. No usar fixture mint como endpoint. | A G58F |
| P0-03 | Login de gateway PostgreSQL real de privilegio mínimo, pool, grants exactos, TLS/secretos/KMS, migraciones controladas | A; requires approval |
| P0-04 | Servidor HTTPS STAGING real separado dev/staging/prod, auth middleware, threat model, rate limiting distribuido y proxy | A; deploy autorizado |
| P0-05 | HTTP SEND Cliente/Driver server-confirmed, idempotencia requestKey, sin fuga PII; inbox/reassign/history/read conectados | A backend/Driver + B Cliente |
| P0-06 | G53 ACK replay con revisión histórica y re-sync G52 de versión más nueva; no inventar revision ni respuesta serverStored | A+B |
| P0-07 | UI viewport real que solo ACK mensajes verdaderamente visibles y contiguos (G57A/B), paginación inversa, crash/reconnect | A Driver + B Cliente |
| P0-08 | Pantalla Driver mensajes real, composer, historial, no envío durante conducción, logout/cambio actor segura | A Driver |
| P0-09 | Push/provider OS real, tokens device y entrega segura sin contenido chat privado, caducidad y suspensión | A+B |
| P0-10 | KYC físico central cifrado, storage con signed URL efímera, MIME real, SHA bytes, malware scanner, retención/borrado legal, Admin revisión | A+legal |
| P0-11 | Elegibilidad y documentos vehículo/conductor, licencias/seguros/inspección y permisos municipio; MOTO pasajero aún prohibido | A+Owner legal |
| P0-12 | GPS real móvil con consentimiento OS, caducidad, anti-spoof, routing maps y dispatch efectivo, cobertura ≠ disponibilidad | A+B |
| P0-13 | Tarifas por AUTO/MOTO cargo y categoría, comisión/IVA, ruta real, pricing server-side PYG, cancelación y no-show | A+Owner |
| P0-14 | Comercio/sucursales/catálogo/stock/pedidos, farmacia OTC, verificación de comerciante, sin grants viejos G6/G9 | A+B |
| P0-15 | Admin/Owner MFA y scopes reales, casos MERCHANT_ORDER, soporte humano, SOS operacional, auditoría, seguridad física | A+B+Operaciones |
| P0-16 | PSP real autorizado, tokenización, conciliación, saldo/ganancias, liquidación, antifraude y reembolsos | A+Owner finanzas |
| P0-17 | Persistencia/índices GC tickets/markers/backups/restore, miles de usuarios/cursos y cero cap global de registros | A |
| P0-18 | E2E físico Android/iOS, GPS/Push, pérdida de conexión, accesibilidad, dos binarios independientes, apps stores | A+B+Owner |
| P0-19 | Legalidad municipal, contratos y seguros, privacidad de datos, retención, operación humana, piloto zonal, go/no-go formal | Owner/legal/A+B |
| P0-20 | Lovable solo interfaz definitiva tras backend seguro; NO reconstruir roles, tarifas o pagos en frontend | A+B |

**Regla de verdad:** QA con datos sintéticos puede validar contrato, no habilita viajes/comercios/cobros con usuarios genuinos. La v1 no se puede limitar a 50 registros totales por decisión de Owner.

# 34. Riesgos y fallas que NO se deben repetir

1. G37: cerrar DML rompió SELECT FOR UPDATE; encapsular lock en función mínima, NO devolver grants anchos.
2. G42: JWT con firma válida de otro subject ≠ autorización; issuer/aud y proveedor sesión/grant/rol externos obligatorios.
3. G43/G58E: check Node doble antes/después NO reemplaza lock SQL G42 hasta COMMIT.
4. G44/G56B: pageSize 50/100 NO tope global; lectura por keyset cursor.
5. G46: no restaurar service_role o buyer/admin DML heredado.
6. G48/G58B: regex UUID de cuatro grupos causó CI fail cerrado; usar CINCO grupos en test y runtime.
7. G52: DTO exacto de B NO admite seq ni throughSeq; sidecar separado; tests OpenAPI versión evolutiva, no hardcode g52.
8. G53: ACK idempotente conserva revisión histórica; no falsificar nueva revisión para UI.
9. G54/G55: tokens y marker owner QA no van a SDK. Revocar rutas delegadas antiguas que permiten skip; G57 reemplaza semántica.
10. G55: estado por request, no shared marker; history ticket lock FOR UPDATE, no upgrade de SHARE.
11. G57: SQL solo sabe mensaje servido, no visto en viewport físico; cada acuse visible debe tener evidencia real de UI.
12. G58: first wrapper nuevo Auth bloqueado por conector; G58B reusa G42, sin bypass.
13. G58: info.version OpenAPI debe conservar suffix numérico g57; intento g57b falló contrato.
14. G58B: el Passenger necesita CHAT_OPEN G49 antes de primera history; mantener grant solo Passenger.
15. G58C: rate gate acepta únicamente scope actorId/userId y operación exactos, no extras.
16. G58D: tres SET LOCAL nuevos rompieron fixture antigua; reparada admitiendo solo SQL fijos. Cliente con query timeout es POISONED, force-release(true).
17. G58E: hubo colisión sintáctica const issuer entre JWT issuer y objeto scopedIssuer; corregido. HTTP parser Node puede contestar 431 cuerpo vacío por exceso headers; no exigir JSON.
18. G58E: timeout en COMMIT deja resultado UNKNOWN, no implicar rollback ni reintentar envío sin reconciliación.
19. Riesgo a revisar: Node G57A/B puede detectar messageId mismatch DESPUÉS de SQL. Un gateway productivo debe validar identidad de mensaje ANTES de grabar y confirmar commit; SQL es autoridad y marker liga al mensaje; revisar el caso adversarial.
20. El único significado de 4/4 es que esas cuatro pruebas acabaron SUCCESS EN EL MISMO SHA; un commit documental posterior no hereda tal estado.

# 35. PLAN DEL SIGUIENTE ARQUITECTO: INICIAR G58F SIN DETENERSE

## G58F / A46 — issuer SQL mínimo y sesión revocada dentro de transacción

1. Inspeccionar `G42_*`, `G43_*`, `G49_*`, `G54_*`, `G56_*`, `G57_*`, `G57B_*` y G58E. Verificar propietario/GRANT de funciones, `search_path`, uso de SECURITY DEFINER.
2. Diseñar en **PostgreSQL16 LOCAL descartable** una función emisora acotada de ticket para roles/servicios chat. No permitir que caller envíe actorId/role/iat sin prueba criptográfica de proveedor. Si la fuente confiable aún no existe, la función debe quedarse DENY/OFF, con tests de denegación en vez de producir un mint explotable.
3. `SECURITY DEFINER` solo con owner SQL específico NOLOGIN, `search_path` fijo, mínimo EXECUTE, REVOKE PUBLIC/anon/authenticated/service_role, sin acceso general del rol gateway al mint, tablas de mensajes o grants.
4. Emisión y consumo con `G42_lock_session` bajo misma transacción. Probar **dos conexiones reales**: revocación antes/durante/después, ticket replay, expiración, otro usuario, Driver anterior, servicio fin, cambio de rol, iat nuevo/antiguo y carreras; nunca permitir atajo por G55/G54.
5. Python CI compara grants efectivos bajo `SET LOCAL ROLE` y `pg_proc.prosecdef`, owner y search_path; Node tests negativos actor JWT ajeno/claim, no certificados reales, OpenAPI futuros runtime OFF.
6. Publicar SQL, ASSERT, Python, Node, documento `docs/architecture/G58F_*.md`, comentario issue #9 y 4/4 CI mismo SHA; avanzar a G59 automáticamente.

**BLOCKER que NO detiene todo:** la emisión productiva requiere provider real, backend con credenciales restringidas y confianza entre procesos. No crear endpoint remoto ni propagar secretos para solventarlo.

## G59 — idempotencia y continuidad post-timeout

- Reconciliar operaciones cuyo resultado HTTP/SQL/COMMIT es incierto: consultar recibo persistido por requestKey, mismos datos no duplican; payload distinto para misma clave rechazado.
- Resolver G53 ACK vieja vs revisión G52 más nueva con re-sincronización explícita; no reescribir recibo original ni marcar serverStored por intuición.
- Mejorar rate limiting distribuido solo cuando haya infra autorizada; diseñar circuit breaker, estadísticas sin PII, recuperación y GC TTL de tickets/markers.
- Diseñar contrato HTTPS del backend común, implementación remota SOLO con aprobación explícita Owner.

## G60 — chat Driver + Client real con B

- Montar `apps/movete-driver/app/mensajes.tsx` solo sobre Auth real y servidor autorizado: inbox/paginación, historial, composer, SEND, markers G57B y navegación accesible.
- Coordinar B Cliente G57A y G53 por issue #9, sin editar sus pantallas. No leer mensajes por GET/push automática, no mostrar ACK falso.
- Probar Driver reasignado durante POST, logout, token vencido, offline, reintentos, 2 cuentas, carrera SQL y viewport real; E2E físico Android/iOS cuando haya dispositivos/servicios autorizados.

## G61+ — cierre de plataforma, no laboratorios interminables

- AUTO (viajes), AUTO/MOTO cargas, promociones/tarifas PYG, GPS y rutas reales, dispatch, elegibilidad y zonas.
- Supermercados/farmacias OTC/restaurantes y otros comercios, stock/reservas/sucursales, orders, courier y privacidad.
- KYC real central, admin MFA, incidentes/SOS humano, casos comerciales, finanzas PSP después de aprobación Owner.
- Pruebas rendimiento con miles sin cap global, restore/backups, seguridad, accesibilidad, dos apps nativas distintas; certificar antes de interfaz final Lovable y pilotos por zonas con GO/NO-GO del Owner.

# 36. Qué es y NO es un bloqueo real

**Avanzar ahora sin permiso nuevo:** leer GitHub, abrir PRs/logs, programar QA, probar contra PostgreSQL16 localhost descartable, hacer tests adversariales, documentar OpenAPI runtime OFF, corregir CI, publicar commits en rama A, coordinar por issue #9.

**No ejecutar la acción que depende de autorización:** SQL remoto, secretos reales/credentials, DNS o TLS público, infraestructura/VPS/deploy, correo/SMS/push real, PSP, uso de datos personales/legales auténticos, cambiar rama base de B, merge a main, distribuir APK/IPA o habilitar operación comercial. Bloquear SOLO esa acción, documentarla y cambiar a otra tarea segura.

**No son motivos para detenerse:** workflows en curso, un test rojo corregible, que Lovable aún no tenga UI, que PSP no esté disponible, que no exista staging remoto mientras se programe laboratorio o que B aún no haya implementado una pantalla. Seguir todo lo que sí se pueda terminar.

# 37. Protocolo de reentrada paso a paso en un chat nuevo

1. Abrir este documento y los dos anexos G58E; leer las secciones G0–G55 históricas y la continuidad 21–36.
2. Consultar GitHub PR #7, `head_sha`, `draft=true`, `merged=false`; PR #8 solo lectura y nuevo R de B; issue #9.
3. Obtener Actions del **HEAD REAL** A y comprobar PG, Node, Expo, aislamiento para mismo SHA. Si falla, abrir logs, corregir y no certificar prematuramente.
4. Leer contratos ``G42/G43/G49/G54/G56/G57/G57B`` y G58E. Empezar G58F con seguridad SQL mínima y pruebas de revocación concurrente.
5. Cada gate requiere: SQL CI-only+ASSERT, prueba PG real y dos conexiones si hay carrera, Node DTO/rol/Auth adversarial, OpenAPI runtime OFF, CI 4/4, docs y issue #9.
6. No tocar `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`; no merge o LIVE.
7. Publicar SHA final verificado, resultados y próximo gate; continuar desarrollo seguro sin volver a preguntar por aprobación para QA.

# 38. Texto listo para abrir un nuevo chat (mandato Owner)

> **ORDEN OWNER DE CONTINUIDAD QORE MOBILE / MOVETE FÁCIL — ARQUITECTO A.** Lee de inmediato el handoff `docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G58E_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md` del repo `mezas3238-hue/Qore-mobile-` (guion final), sus anexos de **107 commits G55–G58E** y **621 blobs/658 entradas G58E**, los handoffs previos G0–G55 y PR #7 DRAFT rama `feature/mobility-monorepo-isolated-20261016`. Inspecciona PR #8 DRAFT B y issue #9 **sin modificar sus rutas**. El último SHA funcional G58E fue `842143d2d82e03c7c10041051341f3daa643f783`, con 4/4 CI SUCCESS; verifica el HEAD documental más reciente por separado. **NO rehagas G0–G58E**. Inicia G58F **AHORA**: issuer SQL seguro con rol mínimo y G42 lock, PostgreSQL16 desechable + pruebas de dos conexiones, Node adversarial, no exponer owner mint ni TLS público; después G59 reconciliación de COMMIT incierto, G60 Driver chat y G61+ cierre del producto. Commit, prueba 4/4 del mismo SHA, documentación y issue #9, y continúa **sin detenerte salvo bloqueo real**. No merge/LIVE/deploy/VPS/SQL remoto/PSP/secretos ni editar B sin orden expresa. QA aprobada no es operación comercial.

# 39. Cierre y estado real

**G0–G58E:** infraestructura de negocio, roles/SQL/RLS, Auth JWT pinneado, pruebas de PostgreSQL16 local desechable, inbox y chat Driver/Passenger, marcadores de lectura contigua, gateways QA localhost y controles de rate/timeout y tickets sintéticos. **No** hay servidor HTTPS comercial, proveedor Auth real ni emisión de tickets productiva, no hay chat conectado a teléfonos, GPS/push/dispositivos físicos certificados, KYC real, seguros legales ni dinero real. No es app terminada comercialmente aunque el laboratorio 4/4 haya pasado.

El siguiente arquitecto no debe perder lo avanzado: debe **cerrar las integraciones verdaderas** y seguir de G58F en adelante, con evidencia GitHub y sin pausas innecesarias.

**FIN — HANDOFF MAESTRO INTEGRAL A G0–G58E — 24 OCT 2026.**
