# QORE MOBILE — MOVETE FÁCIL
## HANDOFF MAESTRO INTEGRAL DEL ARQUITECTO A — G0–G55
### Continuidad soberana: histórico completo + trabajo G49–G55 + pendientes + ejecución sin pausas

**Fecha de corte:** 24 octubre 2026, Paraguay. **Repositorio:** https://github.com/mezas3238-hue/Qore-mobile- (termina con guion).
**Arquitecto A:** PR [#7 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/7), rama `feature/mobility-monorepo-isolated-20261016`, basado en main.
**Arquitecto B:** PR [#8 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/8), rama `feature/mobility-cliente-admin-parallel-20261022`, base rama A.
**Coordinación viva:** [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).
**Último SHA FUNCIONAL G55 CERTIFICADO:** `44326e01006f9456fa711e55df22dfe03702cee5`, 4 workflows SUCCESS.
**SHA B observado al auditar:** `962d17ce8cd55bf3bb1c7e8d2698c752c4e33430`, reconsultar si cambió.
**ATENCIÓN:** los dos anexos nuevos y este handoff generan commits posteriores al SHA funcional G55. NO atribuir su matriz 4/4 al HEAD documental nuevo si aún no se verificaron sus propios workflows.

> **MANDATO DEL OWNER:** el siguiente arquitecto debe continuar de inmediato y sin detenerse, salvo BLOQUEO REAL de una acción concreta. Puede leer GitHub, implementar código/SQL/Node/UI Driver en laboratorio, agregar pruebas, corregir CI, publicar commits y documentación y pasar al siguiente gate SIN preguntar «¿avanzo?». Si una acción requiere credenciales, permiso de conexión remota, interpretación legal o decisión empresarial pendiente, documentar el bloqueo de esa acción, dejarla OFF y continuar otra tarea segura. Nunca prometer trabajo en segundo plano.

> **PROHIBICIONES:** NO MERGE, NO LIVE, NO DEPLOY, NO VPS, NO SQL remoto sin autorización, NO PSP/cobros reales, NO cuentas/datos personales genuinos en CI, NO push real, NO publicar APK/IPA, NO secretos en repo, NO alterar archivos del Arquitecto B, NO mezclar trading. Mantener ambos PR DRAFT. El objetivo es terminar una app real y segura, NO acumular certificaciones de laboratorio confundidas con disponibilidad comercial.

---

# 01. Fuentes de verdad y anexos de auditoría

1. **Handoff completo anterior G0–G48**: [docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G48_CONTINUIDAD_2026-10-23.md](./HANDOFF_MAESTRO_ARQUITECTO_A_G0_G48_CONTINUIDAD_2026-10-23.md). Este documento nuevo conserva abajo su historia implementada G0–G48, pero **NO reproduce como pendientes vigentes su viejo plan de G49–G55**, porque esas etapas ya se hicieron.
2. **Handoff A G0–G42**: [HANDOFF_MAESTRO_ARQUITECTO_A_G0_G42_CONTINUIDAD_2026-10-23.md](./HANDOFF_MAESTRO_ARQUITECTO_A_G0_G42_CONTINUIDAD_2026-10-23.md), detalles de correcciones y decisiones anteriores.
3. **Anexo previo G48, 714 commits**: [ANEXO_A_HISTORIAL_GITHUB_714_COMMITS_AL_HEAD_G48_2026-10-23.md](./ANEXO_A_HISTORIAL_GITHUB_714_COMMITS_AL_HEAD_G48_2026-10-23.md).
4. **Anexo previo G48, 515 archivos**: [ANEXO_A_INVENTARIO_515_ARCHIVOS_HEAD_G48_2026-10-23.md](./ANEXO_A_INVENTARIO_515_ARCHIVOS_HEAD_G48_2026-10-23.md).
5. **Anexo NUEVO G48→G55, 104 commits SHA completos**: [ANEXO_A_G48_A_G55_104_COMMITS_2026-10-24.md](./ANEXO_A_G48_A_G55_104_COMMITS_2026-10-24.md).
6. **Anexo NUEVO G55, 566 archivos y hashes Git blob**: [ANEXO_A_G55_INVENTARIO_566_ARCHIVOS_SHA_2026-10-24.md](./ANEXO_A_G55_INVENTARIO_566_ARCHIVOS_SHA_2026-10-24.md).
7. **División de tareas A/B**: [DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md](./DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md).
8. **Estado B actual en su rama**, de solo lectura para A: `docs/architect-b/STATUS_Y_CONTRATOS.md`, `CONTINUIDAD_B_R33_G54_REVOCACION_CRUZADA_G51_CHAT_2026-10-24.md` y el último handoff B disponible, **no** asumir que R13 es el más reciente.
9. **Contrato API A**: `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json`, versión observada G55 `1.0.0-g55`; la existencia de una ruta en YAML/JSON NO prueba que un servidor la atienda.
10. **CI**: `.github/workflows/mobility-g4-postgres-disposable.yml`, `mobility-staging-node-contracts.yml`, `mobility-ci.yml`, `movete-apps-isolation.yml`; siempre comprobar las cuatro en el **mismo head_sha**.

**Verificación nueva de GitHub:** compare `201a687abf68df13b4947296f230b53b2f361fd6...44326e01006f9456fa711e55df22dfe03702cee5` devolvió `ahead_by=104`, `total_commits=104`, dos páginas 100+4, sin duplicados. El árbol recursivo del SHA G55 devolvió `truncated=false`, 566 blobs y 603 entradas contando directorios. Los anexos preservan los SHA de cada commit y cada archivo. La suma de historia cubierta: 714 commits alcanzables hasta G48 + 104 posteriores = 818 commits alcanzables hasta el SHA funcional G55. **No adjudicar todos a un solo arquitecto ni confundir commits de documentación con desarrollo productivo.**

**Esta transferencia tiene dos niveles de evidencia:** G0–G48 se toma del handoff anterior históricamente verificado; G49–G55 se detalla a continuación con SQL/Node/CI individual. El HEAD documental final requiere su propia comprobación CI posterior.

---

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

# 21. Estado colaborativo de Arquitecto B y dependencia del backend

**Rama B revisada:** `feature/mobility-cliente-admin-parallel-20261022`, PR #8 DRAFT. SHA observado `962d17ce8cd55bf3bb1c7e8d2698c752c4e33430`, puede cambiar mientras A trabaja. A no debe escribir bajo `apps/movete-cliente`, `apps/movete-admin` ni `docs/architect-b`.

**Existen en B:** App Cliente Expo independiente, flujos de cuenta, AUTO/envíos/comercio, cotizaciones, pagos fail-closed, GPS/ETA privado, historia escalable, UI local de chat y adaptadores HTTPS opt-in G51 inbox/read, G52 historial y G53 envío. Admin web Vite/React/TypeScript aparte con Owner/Auditoría/KYC/zona/incidentes y control de rol/MFA en UI QA. NO hay Auth real montado ni chat entre dos teléfonos.

**Hallazgo B R33 (24 Oct):** `docs/architect-b/CONTINUIDAD_B_R33_G54_REVOCACION_CRUZADA_G51_CHAT_2026-10-24.md` documenta purga inmediata de historia/mensajes/draft si un inbox válido informa nuevo conversationId para el MISMO servicio. B NO toma ausencia en una sola página como revocación. R33 cita resultados Cliente 554/554 y Admin 185/185 del **corte R32 anterior**, no necesariamente del HEAD B actual.

**G55 no se implementó todavía en la rama B en este corte**: B debe agregar contrato sidecar y evento visible, nunca cambiar Header G52 ni usar `throughSeq` derivado. Publicado contrato en [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9) y descripción de G55. Pedir a B exclusivamente adaptador/interfaz y tests de su ownership; A deberá completar su servidor.

**No extrapolar** un test Driver/Cliente web export a Android/iOS instalables, ni un Admin TypeScript OK a KYC real. El CI del HEAD B debe consultarse aparte.

---

# 22. Matriz P0 de BLOQUEADORES REALES de producción, separados de QA

| ID | Lo que todavía falta y resultado exigido | Propietario/condición |
|---|---|---|
| P0-01 | Conectar Auth/JWT/JWKS auténtico, issuer/aud, rotación de claves, sesión/remoto y revocación, alta privada y MFA Admin AAL2 | A backend + Owner proveedor |
| P0-02 | Sustituir `*_mint_owner_qa` por emisor seguro no-owner con DB privileges exactos; **NO** publicar owner RPC ni service_role en móvil | A backend; credenciales remotas requieren aprobación |
| P0-03 | Servidor HTTPS real STAGING separado dev/staging/prod, TLS, secrets, RLS/IAM, políticas de CORS y recuperación | A; despliegue autorizado Owner |
| P0-04 | Tests Auth de 2 cuentas sintéticas con tokens reales: actor ajeno, sesión revocada, Driver reasignado, error 401/403, AAL2 real | A+B, STAGING |
| P0-05 | Chat real Cliente ↔ Driver asignado; ruta Driver propia, inbox, send, history, lectura, persistencia, offline y mensajes genéricos push | A backend/Driver, B Cliente; G50–G55 solo QA |
| P0-06 | Política de lectura realmente visible/contigua; ACK G53 en replay tras revisión avanzada; no salto ni acuse falso | A API + B UI |
| P0-07 | Documentos KYC almacenados central y privadamente, bytes cifrados, magic MIME, SHA bytes, scanner malware, expiración/retención y borrado legal | A + legal, sin datos reales no consentidos |
| P0-08 | Conductor/vehículo autorizado y licencia, inspección, seguro, restricciones municipales; **MOTO pasajeros** bloqueado hasta dictamen | Owner jurídico + A |
| P0-09 | Ubicación real smartphone, consentimientos OS, caducidad, anti-spoof, zonas, disponibilidad verificada y optimización despacho | A Driver + B Cliente |
| P0-10 | Push móvil real con token device, rate, revocación, silent hints sin texto sensible; recepción/ACK y background físico | A+B |
| P0-11 | Tarifa aprobada por categoría AUTO/MOTO carga, PYG server-authoritative, Maps/route evidence real, comisión, impuestos y mínimos | Owner comercial + A |
| P0-12 | Privilegios comercio/stock/orden con nuevas RPC JWT sin restaurar G46, KYC comercial, devoluciones y audit receipts | A + B UI |
| P0-13 | PSP aprobado, tokenización, conciliación, liquidación Driver, cargos/reembolsos bancarios y antifraude | Owner finanzas+A; no dinero real todavía |
| P0-14 | Admin Web lectura/escritura auditada, Owner separado, MFA y revisión KYC/suspensiones genuinas | A backend + B Admin |
| P0-15 | SOS real y atención humana, seguridad física, responsabilidades y manual de incidentes | Owner operaciones + A/B |
| P0-16 | Almacenamiento persistente escalable, backups/restore, auditoría sin PII, secretos/KMS y monitoreo, métricas p95 | A |
| P0-17 | Carga miles conductores, aceptación concurrente, failover, consistency, reintentos ambiguos, sin límite global de registros | A |
| P0-18 | E2E físicos Android/iOS, accesibilidad TalkBack/VoiceOver, Admin browser, piloto de zonas, QA independiente y GO/NO-GO Owner | A+B+Owner |
| P0-19 | Distribución stores, privacidad/condiciones, soporte, legalidad municipal/seguros y operación logística | Owner + legal + A/B |

**NO afirmar una app comercial lista.** Hay código importante y pruebas reales PG descartable, pero estas conexiones/validaciones/operaciones siguen sin terminar.

---

# 23. Matriz prioritaria de CHAT Cliente-Driver para el siguiente arquitecto

| Prioridad | Falta hacer de forma concreta | Responsable |
|---|---|---|
| CHAT-01 | Rol SQL delegado específico **Driver** sin usar Passenger G49 como Driver, conversación vinculada a asignación actual, scopes OPEN/HISTORY/SEND | A |
| CHAT-02 | UI Driver con lista mensajes, lectura, compose/send, Auth sesión, estados confirmados, reintento idempotente, bloqueo durante conducción | A apps/movete-driver |
| CHAT-03 | Servidor HTTPS con GET G51, GET G52/G55, POST G53/G55 y Driver APIs, Auth/JWK/sesión real y SQL executor mínimo | A |
| CHAT-04 | B: incorporar G55 sidecar, correlación del messageId visible y POST explícito; conservar gates OFF hasta backend | B por issue #9 |
| CHAT-05 | Garantizar lectura «read-through» CONTIGUA/por mensaje visible, sin marcar más antiguos invisibles | A contrato SQL + B UI |
| CHAT-06 | ACK G53 del requestKey viejo tras header G52 fresco, relectura sin mensajes duplicados ni estado «entregado» falso | A+B |
| CHAT-07 | Dispositivo logout/revocation/reassignment mientras red en curso, borrar cache y borrador del hilo viejo | A+B |
| CHAT-08 | Push sin texto chat, reporte/bloqueo de abuso, retención y supresión de chat al concluir servicio | A+B+legal |
| CHAT-09 | Carga de 205+ mensajes/3 páginas y miles hilos, índices/TTL/GC, sin tope global | A |
| CHAT-10 | E2E real de dos móviles/roles, Driver A asignado → Cliente → entrega → lectura real, revocación, cancelación, baja de línea | A+B cuando autorizado |

**Importante:** `apps/movete-driver/app/mensajes.tsx` hoy es una página INFORMATIVA sobre G50. No hay mensajería comercial instalada, aunque SQL soporte senderRole driver internamente.

---

# 24. Matriz de otras tareas funcionales pendientes

- **AUTO y RIDE**: pricing por rutas verificadas, AUTO económico/confort/XL, conductor con licencia/seguro, aceptación, llegada, estado, tarifa/cancelación y GPS seguro; sin usar política `eligible_by_policy=false` como éxito.
- **AUTO/MOTO delivery**: pesos/categorías, actor asignado, operación farmacia OTC, rechazo de contenido restringido, custodia/entrega y prueba privada, garantías y disputa.
- **Comercios**: registrar negocio legal, sucursal/stock, catálogo versionado, orden atomizada, ETA/operador, entrega; NO usar `service_role` DML heredado G6/G9.
- **Driver documentos**: persistir KYC real en backend central, no exclusivamente en el dispositivo Driver; Admin firma revisión y registra auditoría legal.
- **Zonas**: cada municipio/categoría/servicio con política legal/seguro/cobertura/disponibilidad distintas; sin deducir disponibilidad de GPS observado.
- **Dinero**: comisión/balance ledger PYG y liquidaciones solo desde API autorizada, sin inventar costos o ofrecer PSP mientras siga simulación.
- **Seguridad**: SOS con flujo real humano, rate limiting, moderación, anti abuso, exclusión de PII entre actores, logs mínimos.
- **Escala**: memoria del Cliente paginada no equivale a un máximo de registros global; streaming/keyset/índices PostgreSQL, backups y recuperación.
- **Lovable**: interfaz definitiva DESPUÉS de terminar infraestructura y poder conectarla con seguridad; no trasladar Auth/RLS/dispatch/saldos a frontend.
- **QA física**: build y permisos Android/iOS, GPS, push, conexión mala, accesibilidad, App Store/Play, certificación seguridad/privacidad/legal.

---

# 25. Peligros conocidos, fallos descubiertos y correcciones que NO deben deshacerse

1. **G37:** REVOKE DML rompió SELECT FOR UPDATE: encapsular lock en RPC privilegiada mínima, no restaurar grants amplios.
2. **G42:** token firmado ≠ autorización de subject; validar usuario/sesión/rol/fuente actual y firma/issuer/audience.
3. **G43:** check HTTP fuera de SQL no bloquea revocación antes de commit; usar G42_lock_session misma transacción.
4. **G44:** no caps globales de 50/100; usar keyset/HMAC/pages.
5. **G45:** no aceptar stock/precio/monto de Cliente; colisión requestKey con payload diferente rechazada.
6. **G46:** CI requería G9 previo y revocación de grants comerciales peligrosos; no conceder service_role por comodidad.
7. **G47:** fixtures no persistidos/keys collision, problemas de orden SQL, default OpenAPI; corregidos, no hacer skips.
8. **G48:** regex UUID Node tenía cuatro grupos; siempre cinco, con pruebas.
9. **G49:** UUID bien formada no prueba ticket válido. Distinguir formato, existencia, binding y privilegio.
10. **G52:** test hardcoded versión G52 fallaba cuando creció OpenAPI; permitir evolución versionada sin desactivar guardas.
11. **G53:** ACK replay original conserva revisión original: no inventar ACK actualizado; coordinar re-sincronización B.
12. **G54:** simular llamadas como propietario no prueba que el rol NOLOGIN tenga privilegio correcto: `SET LOCAL ROLE` real.
13. **G55:** marker compartido en adaptador generaba fuga potencial entre requests; state por invocación, sin global mutable.
14. **G55:** `FOR SHARE` en ticket history habría causado upgrade conflictivo; usar `FOR UPDATE`.
15. **G55:** OpenAPI nuevas rutas omitieron default error/bearer y rompieron G11/G12; agregado y tests verdes.
16. **G55:** HMAC corto se detectaba tarde; constructor lo niega al inicializar.
17. **G55:** servidor sabe mensaje SERVIDO, no mensaje físicamente visto; UI debe probar visibilidad; «read-through» puede sobreleer mensajes no vistos.
18. **B R33:** una página de inbox que omite un servicio NO prueba reassign, pero fila del mismo servicio con conversationId distinto sí exige purga.
19. **G49/G54/G55:** funciones `*_owner_qa` y tickets owner sintéticos NO se exponen jamás a client SDK ni se llaman como servicio comercial.
20. **CI:** solo 4/4 del MISMO head_sha, no trasladar evidencia del commit G55 al commit documental nuevo.

---

# 26. Plan de ejecución SIN PAUSAS para A: G56 → G57 → G58

## G56 / A38 — completar CHAT DRIVER en QA, iniciar inmediatamente
1. Inspeccionar HEAD A/B, issue #9, `apps/movete-driver/app/mensajes.tsx`, dominio de sesión Driver, G50/G49/G53/G55, y las rutas de Driver existentes.
2. Implementar wrappers SQL **Driver-only** con un rol nuevo o grants más estrictos: OPEN, inbox, history, send y ack con JWT/sesión G42 y asignación actual. Jamás usar el rol Passenger ni conceder G50 owner RPC al SDK.
3. Tests SQL con conductor asignado, segundo Driver/antiguo Driver, actor ajeno, sesión revocada, servicio terminado, payload prohibido, replay, carrera dos conexiones, pageSize y cursors.
4. Node adaptador con verification independiente, request exacta, rate gates; no decir `serverStored` antes de commit.
5. Diseñar app Driver UI de chat **en rutas A**: lectura y composer conectables, sin simulación de envíos, fail-closed si no hay gateway.
6. DTOs en OpenAPI marcados runtime OFF y comentario issue #9 con límites; 4/4 CI mismo SHA antes de certificar.

## G57 / A39 — asegurar semántica de lectura y ACK con B
1. Diseñar marcador por mensaje o bloque contiguo visible; no permitir que ver un mensaje reciente marque automáticamente mensajes anteriores invisibles.
2. Conservar DTO G52 exacto; sidecar G55 se añade fuera de página. Event UI de visibilidad real debe ser responsabilidad B, no el GET.
3. Resolver revisión de ACK idempotente viejo G53 frente a header nuevo; recuperar estado desde DB, nunca reescribir ACK persistido por comodidad.
4. Probar scroll invertido, paginación, cancelación, reassign, sesión cambiada, timeout ambiguo y reloj adelantado.
5. Documentar contrato mínimo en issue #9; B implementa UI sin editar A. Mantener operaciones OFF sin runtime.

## G58 / A40 — gateway backend de STAGING aislado y mínimo privilegio
1. Componer router **loopback/local autorizado** para ensayos G49/G54/G55 + Driver G56 y verificador JWT firmado con issuer/audience/JWKS de fixture. No hacer despliegue remoto sin autorización.
2. Preparar executor SQL no-owner transaccional, sin privilegiar servicio, sin exportar issuer/secretos privados al cliente. Separar token validation de session grant G42.
3. Probar request HTTP Cliente/Driver/Admin con dos identidades sintéticas, RLS, cancelación, revocación mientras DB opera, propagación idempotente y errores versionados.
4. Cuando exista entorno remoto aprobado, parametrizar Auth real y hacer STAGING E2E; antes, mantener todo x-qore-runtime-wired:false.
5. Paralelamente continuar KYC/comercio/tarifas/Driver offline y tareas P0 que no necesiten credenciales.

**No esperar permiso para código seguro de laboratorio; para credenciales/despliegues sí.** El owner desea finalizar infraestructura antes de Lovable. Si G56 se termina, continuar G57/G58 sin pedir «Ok».

---

# 27. Definición de DONE y pasos del próximo arquitecto

1. Leer este handoff, G0–G48, G0–G42, anexos, documentos individuales G49–G55, `docs/handoff/DIVISION_*`, issue #9.
2. Consultar GitHub PR #7/#8: SHA, draft, merge, ramas y estado de B; NO asumir SHA fijo de B o HEAD del documento.
3. Verificar Actions del HEAD REAL (G55 44326e0 tiene 4/4 SUCCESS) y del HEAD documental nuevo si cambió. Si algún test rojo, logs y reparación.
4. Elegir **G56** y hacer cambios SOLO A. Cuando un paso está bloqueado por proveedor/Owner, moverse a otra función segura en A.
5. Cada gate: SQL guard PostgreSQL16 desechable+ASSERT, tests adversariales, Python 2 conexiones cuando hay carrera, Node adapter/DTO/role, OpenAPI versionada con default errors y bearer, Expo/Driver UI si corresponde.
6. GitHub commit en rama A sin merge, Actions, comparar SHA. Reparar rojos hasta 4/4 MISMO SHA.
7. Publicar `docs/architecture/G56_*` y comentario issue #9 si B depende; no tocar código B.
8. Continuar siguiente gate, priorizando desbloquear backend real sobre nuevos módulos sintéticos de baja utilidad.
9. Etiquetar con rigor: QA, STAGING real comprobado o LIVE aprobado, jamás mezclar.
10. No realizar trabajo en segundo plano; cada petición del Owner debe terminar con resultados ya publicados/enlaces verificables.

**Bloqueo real de UNA ACCIÓN**: falta de autorización para merge/deploy, proveedor/secretos/Auth remoto inaccesibles, permiso legal/seguros, riesgo de fuga o choque de ownership, GitHub caído o defecto crítico de CI. Documentar y continuar otras tareas.

**NO bloqueo global:** workflows en curso, primer test rojo, Lovable aún sin UI, falta de PSP pago, falta un contrato B, falta permiso remoto para una etapa concreta, datos reales inexistentes. QA segura puede continuar.

---

# 28. Criterios de salida comercial — todos requieren evidencia externa adicional

Para STAGING conectado: cuentas JWT realmente verificadas, issuer/JWKS, revocación, roles/claims/AAL2, executor SQL mínimo no-owner, HTTPS, RLS/ACL, antiabuso, rate limit, auditoría y retención, sin PII en logs, pruebas de dos cuentas y fallos.

Para LIVE: licencias/seguros/política municipal, disponibilidad física, GPS y push OS, documentación KYC escaneada y conservada centralmente, tarifas/PSP conciliadas, atención SOS humana, dispositivos Android/iOS instalados y testados, continuidad operativa, backup/restore, seguridad externa y autorización Owner formal. NO considerar un workflow PostgreSQL sintético como certificación de usuarios reales.

---

# 29. Texto listo para iniciar el nuevo chat, orden OWNER

**ORDEN DE CONTINUIDAD QORE MOBILE / MOVETE FÁCIL — ARQUITECTO A.**

Continúa sin detenerte salvo bloqueo real. Repositorio GitHub mezas3238-hue/Qore-mobile- (con guion), rama A feature/mobility-monorepo-isolated-20261016 PR #7 DRAFT. Lee inmediatamente `docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G55_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md` y sus anexos 104 commits/566 archivos al HEAD G55, más los anexos G48 de 714 commits/515 archivos; lee el handoff G0–G42, G49–G55 y issue #9. Inspecciona PR #8 DRAFT del Arquitecto B sin editar su rama.

G55 QA está completo con SHA `44326e01006f9456fa711e55df22dfe03702cee5` y 4 workflows SUCCESS (PG 40057044336, Node 40057044337, Expo 40057044376, aislamiento 40057044342). El nuevo HEAD de handoff es posterior y debe verificarse por sí solo. No repetir G0–G55. Comienza G56: Driver chat realista QA y rol Driver de permisos mínimos con SQL/Node/UI propia, transacciones seguras y pruebas concurrentes. Luego G57 marcador visible contiguo y re-sync ACK con B por issue #9; después G58 gateway Auth HTTPS interno/real cuando sea autorizado. Commit, CI 4/4 mismo SHA, documentación, comunicación B y siguiente gate SIN pedir «¿avanzo?». No merge/Live/Deploy/VPS/SQL remoto/PSP/push real/PII/secrets ni cambios en B sin orden explícita del Owner.

---

# 30. Cierre y estado real

**G0–G55:** infraestructura lógica y tests sintéticos muy extensa, con G55 último SHA funcional certificado 44326e01006f9456fa711e55df22dfe03702cee5, 4/4 SUCCESS. Anexos nuevos cubren 104 commits posteriores al G48 y 566 archivos del árbol exacto G55; anexos previos conservan G48, 714 commits y 515 archivos. PR A #7 y B #8 permanecen DRAFT, sin merge ni lanzamiento. **NO hay sistema comercial completo, ni PSP real, ni chat conectado en teléfonos, ni servidor HTTPS/issuer SQL productivo certificados.**

La prioridad no es reescribir lo conseguido: es cerrar los puentes reales de identidad, permisos mínimos, Cliente↔Driver, KYC, GPS, tarificación y operaciones y luego certificar dispositivos antes del GO del Owner.

**FIN — HANDOFF MAESTRO G0–G55.**
