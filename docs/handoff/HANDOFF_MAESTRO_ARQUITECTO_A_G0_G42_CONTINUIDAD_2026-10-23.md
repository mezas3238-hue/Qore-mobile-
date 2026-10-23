# QORE MOBILE / MOVETE FÁCIL — HANDOFF MAESTRO INTEGRAL DEL ARQUITECTO A
## Transferencia G0–G42 · trabajo realizado, historia verificada, problemas, riesgos, pendientes y ejecución sin pausas

**Corte:** 23 de octubre de 2026, Paraguay. **Responsable:** Arquitecto A (backend compartido, Driver, SQL, CI y OpenAPI).  
**Repositorio soberano:** https://github.com/mezas3238-hue/Qore-mobile-  
**PR A:** https://github.com/mezas3238-hue/Qore-mobile-/pull/7 — rama `feature/mobility-monorepo-isolated-20261016`, DRAFT, SIN MERGE.  
**PR B:** https://github.com/mezas3238-hue/Qore-mobile-/pull/8 — rama `feature/mobility-cliente-admin-parallel-20261022`, DRAFT, SIN MERGE.  
**Issue de coordinación:** https://github.com/mezas3238-hue/Qore-mobile-/issues/9.  
**HEAD funcional A CERTIFICADO antes de publicar este handoff:** `165997ec4a3f353c608d503c9006dc472701a58a` (G42).  
**HEAD B observado:** `a669cc886dccf3afc5e79cad29b3d6c1e2eae2a9` (Handoff R3).  
**IMPORTANTE:** el commit que publique ESTE documento será distinto del HEAD G42 y deberá verificarse de nuevo. La matriz 4/4 de G42 pertenece exclusivamente al SHA `165997ec`, NO debe adjudicarse sin verificar al commit documental.

> **ORDEN EXPLÍCITA DEL OWNER — CONTINUIDAD SIN DETENCIONES:** El siguiente Arquitecto A debe continuar implementando, probando, corrigiendo, documentando y publicando commits sobre su propia rama. No comenzar de cero, no pedir un «¿avanzo?» después de cada tarea, no aguardar una API de B ni una credencial externa mientras existan otras tareas seguras. Detener SOLO la operación concretamente bloqueada cuando haya una imposibilidad técnica real, un conflicto de propiedad, falta de autorización para acciones sensibles, una dependencia externa indispensable, un riesgo legal/de seguridad o una prueba que demuestre que proseguir es inseguro. Registrar el bloqueo y trabajar de inmediato en otra tarea A. No prometer trabajo asíncrono que no se esté ejecutando.

> **GOBERNANZA NO NEGOCIABLE:** NO MERGE, NO LIVE, NO DEPLOY, NO SQL REMOTO, NO VPS, NO pagos/PSP reales, NO credenciales reales en GitHub, NO usuarios/PII o documentos reales en fixtures, NO publicación en tiendas, NO GPS/push real sin permisos, NO cambios a la rama o archivos de B sin acuerdo/autorización. Mantener PR #7 y #8 DRAFT. Un workflow verde de QA descartable **NO ES** certificación comercial, legal, de dispositivos físicos ni disponibilidad de producción.

---

# 01. Objetivo del producto y arquitectura que se preserva

Movete Fácil es la futura plataforma paraguaya de movilidad y logística, activada progresivamente por zonas y municipios, con precios diferenciados y transparentes en guaraníes. Alcance funcional aprobado: pasajeros en AUTO, entregas particulares y comerciales en AUTO o MOTO (restaurantes, supermercados, farmacias con artículos permitidos/OTC y otros comercios). **MOTO PASAJEROS permanece bloqueada** hasta autorización legal, seguros y política operativa específica. Cobertura de zona ≠ existencia de conductor ≠ disponibilidad ≠ habilitación para despachar. Cualquier tarifa, stock, comisión, asignación y autorización debe ser autoridad del backend.

**Dos aplicaciones móviles instalables, distintas:**
- **Driver**: `apps/movete-driver/**`, solo conductores y repartidores. Propiedad A.
- **Cliente**: `apps/movete-cliente/**`, pasajeros, remitentes y compradores. Propiedad B.
- **Admin Web**: `apps/movete-admin/**`, panel WEB aparte, no mezclado con ambas móviles. Propiedad B.
- **Backend central y prototipos históricos Expo QA**: `apps/mobility-expo/**`, SQL, reglas, contratos HTTP, Auth, GPS, zonas, precios, seguridad, pedidos. Propiedad A.
- **Documentación y CI transversal A**: `docs/architecture/**`, `docs/handoff/**` y `.github/**` con respeto al workflow de propiedad B; jamás modificar los archivos B por conveniencia.
- **Lovable** se reserva esencialmente para la interfaz definitiva después de certificar infraestructura. No aporta un reemplazo seguro para Auth/RLS, asignación, lógica tarifaria ni pagos.

El diseño actual opera en laboratorio con Node.js 22, Expo y PostgreSQL 16 aislado (`qore_disposable_chain`, `PGAPPNAME=qore_ci_disposable_chain`). **No** hay un servicio HTTPS STAGING desplegado/certificado ni API operativa destinada al público. La palabra “STAGING” en nombres/rutas OpenAPI no certifica que el endpoint responda en internet.

---

# 02. Fuentes de verdad y handoffs obligatorios: NO rehacer G0–G36

1. **Handoff A precedente G0–G36 — 465 líneas**: [documento histórico](./HANDOFF_MAESTRO_ARQUITECTO_A_G0_G36_CONTINUIDAD_2026-10-23.md). Es la referencia histórica detallada de G0 a G36: A01–A17, SHA, CI, cambios, problemas, matriz original R01–R36 y protocolos.
2. **Handoff A G0–G26.4 — 416 líneas**: [archivo](./HANDOFF_MAESTRO_ARQUITECTO_A_G0_G26_4_CONTINUIDAD_2026-10-23.md), con los antecedentes de historial, Admin/Owner y pruebas de escala.
3. **Handoff conjunto A/B G0–G22**: [archivo](./HANDOFF_MAESTRO_INTEGRAL_QORE_MOBILE_DOS_ARQUITECTOS_G0_G22_2026-10-22.md).
4. **División de responsabilidades de arquitectos**: [archivo](./DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md).
5. **B Handoff R3 343 líneas**: [leer en rama B, SIN editar](https://github.com/mezas3238-hue/Qore-mobile-/blob/a669cc886dccf3afc5e79cad29b3d6c1e2eae2a9/docs/architect-b/HANDOFF_MAESTRO_B_R3_CLIENTE_ADMIN_TOTAL_2026-10-23.md).
6. **B anexo de 153 commits previos R3 — 169 líneas**: [leer en rama B](https://github.com/mezas3238-hue/Qore-mobile-/blob/a669cc886dccf3afc5e79cad29b3d6c1e2eae2a9/docs/architect-b/HANDOFF_R3_ANEXO_153_COMMITS_2026-10-23.md).
7. **OpenAPI servidor**: `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json`, versión `1.0.0-g41` al HEAD previo al handoff.
8. **Workflow PG16 cadena completa**: `.github/workflows/mobility-g4-postgres-disposable.yml`.
9. **Workflow Node**: `.github/workflows/mobility-staging-node-contracts.yml`.
10. **GitHub issue #9**: estado, solicitudes y cambios de contrato A↔B. Leer sus mensajes recientes, no usar un handoff viejo como si fuera el último.

**Procedimiento de reentrada:** consultar HEAD de ambas ramas y PRs primero, leer este handoff + el anterior, revisar estado exacto de los 4 Actions del HEAD, buscar archivos actuales y continuar por el primer paso P0 no bloqueado. La rama B tiene como BASE la rama A, no `main`; NO rebase ni fusionar unilateralmente.

---

# 03. Trabajos anteriores conservados: resumen verificable G0–G22

| Gate | Entrega existente | Qué NO autoriza |
|---|---|---|
| G0 | Separación de repositorio, Expo/Driver/Cliente, CI y gobernanza de ramas. | No binarios comerciales. |
| G1 | Auth sintético, RLS/RBAC inicial y esquema SQL base. | No JWT/identidad real. |
| G2 | Modelos y elegibilidad básica de conductor, vehículo, licencia, seguro e inspección. | No permiso legal regional automático. |
| G3 | Ciclo de solicitud/aceptación/transiciones AUTO, idempotencia y eventos. | No viaje físico. |
| G4 | Ofertas AUTO privadas, TTL, aceptación exclusiva, outbox y HTTP loopback. | No proveedor de push ni GPS real. |
| G5 | Entregas por AUTO/MOTO, dimensiones, categorías, custodia y pruebas. | No operación física certificada. |
| G6 | Comercios, catálogos, pedidos y stock de laboratorio. | No catálogo buyer HTTP certificado. |
| G7 | Motor de tarifas Gs/PYG, comisiones, ledger y cobros simulados. | No PSP ni ingresos reales. |
| G8 | Incidentes, SOS teórico, suspensiones y auditoría QA. | NO operadora de emergencias. |
| G9 | Registros, comercios, sucursales y funciones QA. | No marketplace en LIVE. |
| G10 | Ofertas DELIVERY privadas; se cierran atajos directos de aceptación. | No conceder acceso extra por comodidad. |
| G11 | OpenAPI y DTO central. | Una ruta declarada no implica URL desplegada. |
| G12 | Push courier: claim/ACK/reintentos y fallback. | ACK servidor no es entrega a teléfono. |
| G13 | Leases/fencing en PostgreSQL y dos sesiones. | No un proveedor push real. |
| G14 | Dos couriers compiten, un ganador transaccional. | No operación física. |
| G15 | Polling privado delivery como respaldo. | No UX certificada offline. |
| G16 | Inbox privado AUTO/DELIVERY Driver y caducidades. | No login de proveedor real. |
| G17 | Registro documental privado, versiones, revisión y metadatos auditados. | No bytes de documentos escaneados realmente. |
| G18 | Onboarding exclusivo Driver, rechazo de rol mixto. | No KYC legal definitivo. |
| G19 | Contrato Storage/hash/MIME/escáner inyectado. | No bucket y antivirus genuino. |
| G20 | Preflight KYC de Driver, licencia y vehículo específico. | No legalidad zonal/seguro real por sí solo. |
| G21 | Workspace Driver con secciones QA. | No app publicada. |
| G22 | Puente Auth SDK de Driver y limpieza de sesión/logout. | No sesión auténtica en nube. |

No reimplementar este bloque. Para archivos, commits y tests específicos, consultar secciones 04–05 del Handoff G0–G36.

---

# 04. G23–G36: capacidades entregadas ANTES de esta continuidad

| Fase | Implementado y comprobado | Límite pendiente |
|---|---|---|
| G23 | CI Admin Web y estado privado de viajes Passenger; JWT/propietario de QA. | GPS/ETA real y autenticación autorizada. |
| G24 | Cotización servidor en Gs con versión, TTL y validación de precio. | Costos externos/mercado y cobro final. |
| G25 | Cancelación idempotente por pasajero con requestKey; sin fee inventado. | Reembolso/penalidad/legalidad productiva. |
| G26.0 | Se detectó y ELIMINÓ error de limitar el historial a 50 en total. | NO reincidir. |
| G26.1–3 | Cursores HMAC, páginas de 50 **sin límite global**, 1.200 filas/24 páginas y 31.200/624 en PG16. | Pruebas externas de capacidad/retención. |
| G26.4 | Inmutabilidad de owner, requestKey y creación histórica; anti-backdating. | Política real de retención/borrado. |
| G26.5 | Dos conexiones PostgreSQL, descubrimiento de cambios MVCC; semántica eventual + refresh. | No prometer snapshot duradero entre páginas. |
| A03 | Secretos HMAC independientes con current/previous, rotación. | Secret manager real y alertas. |
| A04.1/G27 | Admin y Owner exclusivos, scope RBAC, MFA AAL2 inyectado, roles en SQL. | Proveedor Auth real y MFA genuino. |
| G28 | Cola de incidentes con 121 filas, 50/50/21 y autorización exclusiva. | Filtros de prioridad global aún no (resueltos G41). |
| G29 | Cola de 121 expedientes KYC, estado documental sin PII, MOTO pasajeros excluida. | Escaneo binario real. |
| G30 | Auditoría privada 123 eventos/3 páginas, solo fuente existente. | Cobertura total de eventos operativos. |
| G31 | Cobertura por zona/servicio; 30.030 filas/601 páginas; política real OFF. | No disponibilidad de Driver. |
| G32 | Ingreso GPS QA a cuarentena, anti-replay/secuencia/consent, dos sesiones. | No atestación ubicación física. |
| G33 | Agregación diagnóstico GPS, sin ascender a disponibilidad. | Fuente legal/polígono real. |
| G34 | Revisión/retirada de consentimiento GPS, eventos y carrera. | Consentimiento real en dispositivo. |
| G35 | KYC documental por tipo de servicio/vehículo; seguros vencidos y permisos rechazan. | Verificador oficial/seguros reales. |
| G36 | Slot atómico único entre AUTO y DELIVERY; dos órdenes de carreras en PostgreSQL. | Otros tipos de trabajo aún deben entrar al mismo slot. |

**Puntos inmutables:** nunca volver al máximo de 50 registros total (solo `pageSize`), no reactivar G3/G5 accept directo, no tratar GPS de cuarentena como ubicación autorizante, no dar Owner acceso Admin, no habilitar finanzas con G7 simulado, no fusionar Cliente/Driver.

---

# 05. G37 / A18 — cierre de DML y transiciones de viaje/entrega (ESTA CONTINUIDAD)

**SHA funcional final:** `75e3bee1e8d8f3635dede6438149d1c6b2f8529c`.  
**Primer intento:** `d6686f5a6972`; CI detectó fallo de `SELECT FOR UPDATE` en RPC de oferta después del retiro de permisos; corrección final trasladó los bloqueos privilegiados a funciones `SECURITY DEFINER` controladas, no restituyó DML a cliente/service_role indiscriminadamente.  
**Documento:** [G37 técnico](../architecture/G37_TRIP_DELIVERY_STATE_DML_FENCE_QA_2026-10-23.md).

**Archivos principales**:
- `apps/mobility-expo/docs/backend/staging_only/G37_TRIP_DELIVERY_DML_STATE_FENCE_POSTGRES_CI_ONLY.sql`
- `apps/mobility-expo/docs/backend/staging_only/G37_TRIP_DELIVERY_DML_STATE_ASSERT_POSTGRES_CI_ONLY.sql`
- `.github/workflows/mobility-g4-postgres-disposable.yml`.

**Implementación**:
1. Revocados INSERT/UPDATE/DELETE directos `service_role`, `anon`, `authenticated` sobre G3/G5 trips/deliveries y sus eventos.
2. Función/triggers de integridad para identidad original, ruta, tipo, vehículo/conductor asignado, `request_key`, revisión secuencial, inserción inicial válida y máquina de estados sin resurrección terminal.
3. Conservadas solicitudes, cancelaciones y ofertas G4/G10 dentro de RPC privados autorizados; atajos directos de aceptación siguen revocados.
4. SQL adversarial de escrituras service_role, falsificación como database owner de CI, invocación válida y recibos de evento.
5. Revalidada competencia G36 de dos sesiones *después* de los cambios.

**CI final del mismo SHA:** PostgreSQL **#302**, Node **#534**, Expo **#1118**, aislamiento **#458**, todos SUCCESS.  
**Advertencias**: `SECURITY DEFINER` no verifica por sí solo identidad JWT ni regula un despliegue real. Revisar superficies de funciones privilegiadas al integrar Auth y evitar escalamiento accidental.

---

# 06. G38 / A19 — disputa sin slot y elegibilidad de aceptación (ESTA CONTINUIDAD)

**SHA definitivo:** `cdeb943416725950bd18123d2676574bc33c26e3`.  
**Documentación:** [G38](../architecture/G38_DISPUTE_AND_TRUSTED_ACCEPTANCE_FENCE_2026-10-23.md).  
**Commits relevantes:** `9af01136` (base), `90b8799d` (fix TTL y fixture), `ed2538a6` (comparación de ENUM), `dc7d28cb`/`35e3de6e` (ataques G38.2 previos) y `cdeb9434` certificado.

**Archivos clave**:
- `G38_0_DISPUTE_CASE_NO_SLOT_POSTGRES_CI_ONLY.sql` y `G38_0_DISPUTE_CASE_ASSERT_POSTGRES_CI_ONLY.sql`.
- `G38_1_TRUSTED_OFFER_ACCEPTANCE_FENCE_POSTGRES_CI_ONLY.sql` y `G38_1_TRUSTED_OFFER_ACCEPTANCE_ASSERT_POSTGRES_CI_ONLY.sql`.
- `G38_2_FORGED_PROOF_SIGNAL_ASSERT_POSTGRES_CI_ONLY.sql`.
- Todos dentro de `apps/mobility-expo/docs/backend/staging_only/`.

**Entregado**:
1. G38.0 separa la **disputa administrativa** de una misión física. `delivered→disputed→returned` no vuelve a tomar el slot de G36 ya liberado; prueba idempotencia, evento y retorno. Una disputa tardía puede coexistir con otra misión previamente aceptada y no debe cancelarla retroactivamente; las aceptaciones futuras se suspenden por la regla de elegibilidad.
2. G38.1 crea tabla privada de pruebas/atestaciones de oferta exacta; trigger verifica job/offer/Driver/vehículo, TTL, consentimiento revisionado, GPS cuarentenado, KYC y restricciones de zona.
3. La geocerca y el emisor certificados **NO están conectados**; G31 impone `eligible_by_policy=false` en QA. Así la aceptación es **fail-closed incluso con campos sintéticos que aparentan ser válidos**.
4. G38.2 añadió ataque adversarial donde el owner de base descartable fabrica una prueba de oferta y ubicación GPS fresca, marca cobertura `ACTIVE` pero deja elegibilidad legal `false`; la aceptación es denegada sin cambiar viaje, oferta, evento ni slot.
5. Se corrigieron fixtures sin relajar el límite de TTL G4/G10 ni los permisos, y se normalizó comparación de estados de dos ENUM distintos.

**CI definitivo 4/4 SUCCESS:** PostgreSQL **#309**, Node **#541**, Expo **#1132**, aislamiento **#471**.

**Pendiente real:** validador geográfico firmado, legalidad/seguro local, emisor confiable, GPS antifraude y fencing transaccional ante revocación de evidencia real; nueva clase de asignación debe respetar G36.

---

# 07. G39 / A20 — verificación criptográfica Ed25519 de ofertas (ESTA CONTINUIDAD)

**SHA:** `3f0927ed4230574f26699dcd11c08c209c1fa19b`.  
**Documento:** [G39](../architecture/G39_ED25519_SIGNED_OFFER_ADMISSION_QA_2026-10-23.md).  
**Archivos Node:** `server/g39-signed-offer-admission-qa.mjs` y `server/g39-signed-offer-admission-qa.test.mjs` (bajo `apps/mobility-expo/`).

**Implementado y probado**:
1. Verificador de JWS Ed25519 `EdDSA` de ofertas específicas mediante claves públicas SPKI autorizadas por el backend; `kid` permite rotación sin descargar URLs dictadas por el portador.
2. Comprobación de cabecera exacta, JSON/base64url canónicos, SHA-256 de evidencia para auditoría, vencimiento máximo 30 s, no reutilización entre oferta/job/Driver/vehículo/zona/consentimiento/geometría/política/sesión.
3. Admisión de QA exige fuentes independientes para JWT, sesión no revocada, oferta y rate limit, pero **si la firma es correcta igualmente retorna `G39_QA_DISPATCH_LOCKED`**. No emite autorización comercial ni inserta automáticamente G38.
4. Tests de algoritmo alterado, firmas falsas, clave desconocida, rotación/retirada de kid, cambio actor y campos, JSON duplicado, expiración y proveedor caído.

**CI 4/4 SUCCESS:** PostgreSQL **#310**, Node **#543**, Expo **#1134**, aislamiento **#473**.

**Pendiente:** emisor privado auténtico, distribución/rotación de claves de producción, atestación GPS de verdad, certificados/seguros y unión atómica con G38. Las claves privadas de QA se generan en memoria, NO versionadas.

---

# 08. G40 / A21 — incidentes Cliente: recibo idempotente y lectura propia (ESTA CONTINUIDAD)

**SHA final:** `9c69ba5753b4d179fb49e4fdd491324e5e8718e1`.  
**Documentación:** [G40](../architecture/G40_OWNER_INCIDENT_RECEIPT_STATUS_QA_2026-10-23.md).  
**Commits de corrección:** `841279c5` inicial; `d8f6fe2a`/`bf5f2b3f` corrigieron UUID, palabra reservada, versión OpenAPI y regex; `9c69ba57` resolvió colisión `incident_id` entre variable y columna.

**Entregado**:
1. RPC PostgreSQL `mobility_stage_g40_report_receipt` retorna `incidentId`, `receiptId` de un evento persistido real en base de pruebas, estado inicial, revisión y tiempos. `requestKey` idempotente, conflicto 409.
2. `mobility_stage_g40_owner_incident_status` permite lectura exclusiva del reporter, cross-account retorna NULL→404, DTO sin documentos, nombres ni metadatos personales.
3. Gateway Node `g40-incident-receipt-qa.mjs` con JWT externo inyectado, revocación, rate limiter, error handling 400/401/404/409/429/503 y whitelist DTO.
4. OpenAPI versión `1.0.0-g40` publicó dos contratos:
   - `POST /v1/staging/safety/incidents/report`.
   - `GET /v1/staging/safety/incidents/{incidentId}/status`.
5. Marcados `x-qore-runtime-wired:false`; recibo `RECEIVED_IN_QA_DATABASE_ONLY` **no es respuesta de un humano ni envío real**. `SOS` y `CRITICAL` no pasan por esta API sin infraestructura de emergencia certificada.
6. SQL de owner, recibo único, replay, cross-account, intento no participante y SOS rechazado.

**CI final 4/4 SUCCESS:** PostgreSQL **#314**, Node **#550**, Expo **#1142**, aislamiento **#483**.

**Dependencia B:** B preparó formulario Cliente privado, borradores locales y adaptadores G40, pero mantiene visible **NO ENVIADO** y su runtime desactivado hasta URL HTTPS STAGING REAL, Auth y E2E autorizado. A NO debe cambiar `apps/movete-cliente/**`.

---

# 09. G41 / A22 — triaje global Admin por severity/status (ESTA CONTINUIDAD)

**SHA final:** `f7e277122764a7fdbcfcc766d9ca5e3061009915`.  
**Documento:** [G41](../architecture/G41_ADMIN_TRIAGE_GLOBAL_FILTERED_QA_2026-10-23.md).  
**Incidencias de QA:** `20e5ccf4` creó PG; `43513598` corrigió test de claves JSON; `793a6504` añadió Node/OpenAPI; `f7e27712` corrigió regex UUID y fixture Admin exclusivo.

**Entregado**:
1. RPC `mobility_stage_g41_admin_incident_triage_page` filtra **EN POSTGRES ANTES de `LIMIT 51`` por severidad CRITICAL→HIGH→MEDIUM→LOW y estado OPEN/TRIAGED/INVESTIGATING/RESOLVED/CLOSED. Orden global por gravedad, fecha descendente, UUID.
2. Recorre **241 registros en 5 páginas**; 50 son filas **por página**, jamás límite total. Prueba subconjuntos severidad/estado sin ocultar incidentes graves ubicados fuera de una página.
3. Gateway Node `g41-admin-triage-qa.mjs` exige JWT verdadero como adaptador, revocación, rol Admin **exclusivo**, scope, MFA AAL2 del proveedor y rate limiter.
4. Cursor HMAC con TTL 10 min ligado a proyecto, actor, sesión, severity, status y posición; detecta alteración, firma inválida, filtros nuevos, otra cuenta, secreto rotado, expiración y desorden/PII.
5. OpenAPI versión `1.0.0-g41` declara `GET /v1/staging/admin/incidents/triage-queue` con `x-qore-runtime-wired:false`. Lectura anclada/eventualmente consistente, **no snapshot MVCC global**.
6. La prueba de aislamiento tuvo `npm ECONNRESET` transitorio descargando dependencias Driver; se repitió el job fallido, sin cambiar código, y terminó SUCCESS.

**CI final 4/4 SUCCESS:** PostgreSQL **#318**, Node **#556**, Expo **#1150**, aislamiento **#490** (último intento verde).

**Dependencia B:** B tiene UI y gateway de triaje global bajo flag OFF, conserva advertencia de página local mientras A no certifique backend HTTPS real. No alterar esa UI desde A.

---

# 10. G42 / A23 — JWT firmado y autoridad de revocación, QA (ÚLTIMO DESARROLLO)

**SHA funcional:** `165997ec4a3f353c608d503c9006dc472701a58a`.  
**Documento:** [G42](../architecture/G42_PROVIDER_PINNED_JWT_SESSION_REVOCATION_QA_2026-10-23.md).  
**Commits de implementación/QA:** `619948e1` (Node/SQL), `3b04690d` (tests/adversarial), `165997ec` (corrección metodológica).

**Entregado**:
1. `server/g42-provider-pinned-jwt-auth-qa.mjs` comprueba firmas JWS **ES256, RS256, EdDSA**, `kid` contra clave pública JWK **fijada en backend**, sin `jku/x5u` controlado por token, sin claves privadas en el repo y sin algoritmo `none`.
2. Valida issuer HTTPS `.../auth/v1`, audience `authenticated`, `role=authenticated`, `sub/session_id` UUID, expiración, `iat/nbf`, TTL máximo de perfil QA de 1 h y JSON/base64url canónicos. **Interoperabilidad con serialización JWT del proveedor real NO demostrada**; el contrato es deliberadamente estricto.
3. Adaptadores independientes `verifyAccessToken`, `verifySessionNotRevoked`, `verifyBackofficeMfa` piden lectura autoritativa de usuario, sesión vigente del proveedor y grant de sesión PostgreSQL privado; no confían en rol `app_metadata` ni `JWT.aal=aal2` como prueba MFA.
4. SQL `G42_PROVIDER_SESSION_REVOCATION_POSTGRES_CI_ONLY.sql` crea tabla de sesiones sintéticas con RLS, DML cerrado a browser y `service_role`, vigencia, revocación y fecha mínima admitida del JWT.
5. RPC `mobility_stage_g42_session_active` y `mobility_stage_g42_lock_session` (este último `FOR SHARE` **solo si se usa dentro de la MISMA transacción que la mutación**).
6. Ataques Node cubren firmas falsas, mezcla alg/kid, key rotada/retirada, token expirado, usuario cruzado, rol falso, MFA antigua, proveedor inaccesible, revocación y conexión sintética a G41. SQL comprueba expiración/revocación/cross-account/iat/DML.
7. El primer test de G42 asumía erróneamente que un token **bien firmado para otra identidad válida** debía fallar a nivel criptográfico. Se corrigió: firma válida puede pasar, **el proveedor/sesión/propiedad deben rechazar al actor no autorizado**. Mantener esta distinción.

**CI del MISMO SHA 4/4 SUCCESS (verificado):**
- PostgreSQL **#321**: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39981798999
- Node **#562**: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39981799277
- Expo **#1156**: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39981798991
- Aislamiento **#505**: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39981799130

**NO AFIRMAR:** que exista un emisor Auth real, JWT real, permisos de `auth.sessions` productivos, MFA real o HTTPS STAGING. La tabla G42 contiene solo sesiones sintéticas y no tiene un provisionador real; la revocación upstream del proveedor aún no existe. La certificación es SOLO laboratorio.

---

# 11. Cronología de commits DE ESTA CONTINUIDAD (conservar, no repetir)

| Secuencia | SHA | Hecho |
|---|---|---|
| Entrada heredada G0–G36 | `346f9dfcbd2fc3a57cb7951c473120bc8571d88d` | Handoff anterior de 465 líneas, inicio del presente arquitecto. |
| G37 intento | `d6686f5a6972` | Primer cierre de DML; SQL `FOR UPDATE` falló tras retirar permisos. |
| G37 final | `75e3bee1e8d8f3635dede6438149d1c6b2f8529c` | Oferta privada con privilegio confinado, 4/4 CI. |
| G38.0/1 base | `9af01136f11c315938b0cd242560ef8607432c37` | Disputa sin slot y atestación de oferta, primer CI con errores de test. |
| G38 ajustes | `90b8799d`, `ed2538a6` | TTL contractual, fixture y comparación de dos ENUM. |
| G38.2 final | `cdeb943416725950bd18123d2676574bc33c26e3` | Proof+GPS falsificados no activan zona no elegible. |
| G39 | `3f0927ed4230574f26699dcd11c08c209c1fa19b` | Ed25519 de oferta; QA `DISPATCH_LOCKED`. |
| G40 inicio | `841279c5f46fbc3bfc891f05bc3610953643c496` | SQL/Node/OpenAPI para soporte; detectó bugs. |
| G40 fixes | `d8f6fe2a`, `bf5f2b3f`, `9c69ba5753b4d179fb49e4fdd491324e5e8718e1` | Regex UUID, error response/OpenAPI y ambigüedad SQL, 4/4 final. |
| G41 base | `20e5ccf42af1b3018855f3d8be69e931e3e718ef` | SQL clasificación global. |
| G41 mejoras | `43513598`, `793a6504`, `f7e277122764a7fdbcfcc766d9ca5e3061009915` | Test PG, gateway+OpenAPI, rol Admin y UUID; 4/4 final. |
| G42 inicio | `619948e1944947fe63b3022996062253caf2df4f` | Verificador JWK/SQL de sesión. |
| G42 tests | `3b04690dc9a83b2146ac6e0501ae02f859fd5bc5` | Tests adversariales; un test asumía error de firma para actor distinto. |
| G42 final | `165997ec4a3f353c608d503c9006dc472701a58a` | Distinción firma vs autorización, 4/4 final. |

Estas entradas incluyen intentos fallidos deliberadamente: **no esconder ni volver a introducir sus causas**. Ver commits exactos en GitHub y Actions del SHA vigente. El log de commits completo anterior se conserva en los handoffs históricos y en la página de commits del PR #7, no en un conteo inventado.

---

# 12. Matriz de certificación de esta continuidad

| Gate | Commit final | PostgreSQL | Node | Expo | Aislamiento | Resultado sobre ese commit |
|---|---|---|---|---|---|---|
| G37 | `75e3bee1` | #302 | #534 | #1118 | #458 | 4/4 SUCCESS |
| G38 | `cdeb9434` | #309 | #541 | #1132 | #471 | 4/4 SUCCESS |
| G39 | `3f0927ed` | #310 | #543 | #1134 | #473 | 4/4 SUCCESS |
| G40 | `9c69ba57` | #314 | #550 | #1142 | #483 | 4/4 SUCCESS |
| G41 | `f7e27712` | #318 | #556 | #1150 | #490 | 4/4 SUCCESS (aislamiento reintento por ECONNRESET) |
| G42 | `165997ec` | #321 | #562 | #1156 | #505 | 4/4 SUCCESS |

**No fusionar resultados de diferentes SHAs.** Los números # no son pruebas manuales ni garantía de servicio real. El Handoff nuevo genera commit nuevo: consultar sus propios runs; nunca declarar “certificado” sin ver la conclusión de los cuatro.

**Suite de CI recurrente:** `QORE G4 PostgreSQL disposable smoke` (incluye real-schema-chain/SQL concurrency), `QORE Mobility STAGING Node contracts`, `QORE Mobility Expo isolated CI` y `Movete Facil two app isolation`. En fallos investigar job/step/log, corregir causa mínima y repetir sobre SHA único. Los errores de red en npm pueden reintentarse sin alterar negocio.

---

# 13. Relación exacta de archivos NUEVOS/MODIFICADOS por G37–G42

## SQL PostgreSQL QA (bajo `apps/mobility-expo/docs/backend/staging_only/`)
- `G37_TRIP_DELIVERY_DML_STATE_FENCE_POSTGRES_CI_ONLY.sql` — reglas, privilegios, estados.
- `G37_TRIP_DELIVERY_DML_STATE_ASSERT_POSTGRES_CI_ONLY.sql` — ataques y smoke.
- `G38_0_DISPUTE_CASE_NO_SLOT_POSTGRES_CI_ONLY.sql` — disociar disputas de slot.
- `G38_0_DISPUTE_CASE_ASSERT_POSTGRES_CI_ONLY.sql` — entrega→disputa→retorno.
- `G38_1_TRUSTED_OFFER_ACCEPTANCE_FENCE_POSTGRES_CI_ONLY.sql` — atestación de oferta y KYC/GPS.
- `G38_1_TRUSTED_OFFER_ACCEPTANCE_ASSERT_POSTGRES_CI_ONLY.sql` — ausencia prueba, deny.
- `G38_2_FORGED_PROOF_SIGNAL_ASSERT_POSTGRES_CI_ONLY.sql` — zona ACTIVE/no elegible y GPS falso.
- `G40_INCIDENT_RECEIPT_STATUS_POSTGRES_CI_ONLY.sql` — recibo y estado de propietario.
- `G40_INCIDENT_RECEIPT_STATUS_ASSERT_POSTGRES_CI_ONLY.sql` — owner, replay, SOS bloqueado.
- `G41_ADMIN_INCIDENT_TRIAGE_PAGE_POSTGRES_CI_ONLY.sql` — filtro server-side global.
- `G41_ADMIN_INCIDENT_TRIAGE_PAGE_ASSERT_POSTGRES_CI_ONLY.sql` — 241 casos/páginas, cruces.
- `G42_PROVIDER_SESSION_REVOCATION_POSTGRES_CI_ONLY.sql` — ledger y locking de sesión QA.
- `G42_PROVIDER_SESSION_REVOCATION_ASSERT_POSTGRES_CI_ONLY.sql` — revocación/expiración/RBAC.

## Node y tests (bajo `apps/mobility-expo/server/`)
- `g39-signed-offer-admission-qa.mjs` / `g39-signed-offer-admission-qa.test.mjs`.
- `g40-incident-receipt-qa.mjs` / `g40-incident-receipt-qa.test.mjs`.
- `g41-admin-triage-qa.mjs` / `g41-admin-triage-qa.test.mjs`.
- `g42-provider-pinned-jwt-auth-qa.mjs` / `g42-provider-pinned-jwt-auth-qa.test.mjs`.
- Ajuste de `g11-openapi-contract.test.mjs` para versión gN sin congelar `g11`.
- Contrato `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json`: G40/G41.
- Workflow `.github/workflows/mobility-g4-postgres-disposable.yml`: nuevas suites y guardas.
- Documentos `docs/architecture/G37_*`, `G38_*`, `G39_*`, `G40_*`, `G41_*`, `G42_*` (ver enlaces secciones 05–10).

**No se modificaron carpetas** `apps/movete-cliente/**`, `apps/movete-admin/**` ni `docs/architect-b/**` durante esta continuidad A.

---

# 14. Estado actualizado de Arquitecto B y dependencias (NO pisar)

**B R3 publicado**: HEAD `a669cc886dccf3afc5e79cad29b3d6c1e2eae2a9`, Handoff 343 líneas y anexo de 153 commits previos. El handoff reporta en el corte funcional anterior **313/313 Cliente** y **180/180 Admin PASS** (493/493), más 3/3 workflows B; **estos números pertenecen al SHA anterior a la publicación R3**, comprobar CI de B HEAD si se usan como estado nuevo.

El Arquitecto B tiene bajo flags deshabilitados:
- Cliente: cancelación/historial, cotización/estatus, UI G40 de soporte local con **NO ENVIADO**, borradores privados purgables.
- Admin Web: roles/colas G28–G31, UI de incidentes local de página, futuro G41 global con filtros server-side y cursor, **sin RuntimeVerified** hasta backend desplegado.
- Comercio Cliente: catálogo/carrito paginados, búsqueda por sucursal, 100 productos por página y pruebas sintéticas hasta 13.000 ítems, **sin lector HTTP buyer certificado ni checkout/PSP real**.

**Solicitudes vigentes B→A comunicadas en issue #9:**
1. Certificar **montaje HTTPS STAGING** de G40 POST y GET: JWT Passenger real, SQL owner/RLS/revocación, receipt durable, idempotencia, timeouts y errores. Hasta entonces B debe decir “NO ENVIADO”.
2. Certificar **montaje HTTPS STAGING** de G41 Admin: JWT Admin/AAL2 real, scope exclusivo, cursor firmado ligado a filtros/actor/sesión, paginación exhaustiva, casos graves fuera de primera página, E2E. Hasta entonces UI local no anuncia triaje global real.
3. Diseñar y publicar **GET comprador catálogo y sucursales** (ausente en OpenAPI g41): autenticación Buyer, sucursal/municipio/servicio válidos, disponibilidad jurídica, paginación cursor sin límite global; campos `branchId`, `version`, `expiresAt`, `itemId`, `itemTag`, `itemClass` GENERAL/PHARMACY_OTC, `active`, `unitPricePyg`, `stockUnits`. No productos restringidos ni PII. Evitar inventar disponibilidad comercial.
4. Contrato futuro de **pedido comprador transaccional**: requestKey idempotente, versión de catálogo y stock, reservas concurrentes, precio servidor Gs, política de cancelación/reembolso y PSP solo aprobado. B conserva carrito sin checkout.
5. Nunca pedir a B que cambie manualmente flags para fingir que A desplegó un endpoint. **Cualquier integración A↔B requiere evidencia en issue #9** con SHA, URL/STAGING autorizada, OpenAPI, SQL/Auth, CI y E2E reales.

**Separación contractual:** A prepara backend/OpenAPI, tests y guías. B hace Cliente/Admin/Web, tests visuales y activación de UI únicamente cuando haya certificado real y autorización. Si falta una API de A, B documenta dependencia y continúa en otro módulo suyo; recíprocamente A nunca se detiene por esperar cambios de B.

---

# 15. Riesgos vivos R01–R36, reevaluados DESPUÉS de G42

| ID | Clasificación | Estado y siguiente acción |
|---|---|---|
| R01 | P0 | Sin infraestructura STAGING HTTPS auténtica; no desplegar sin autorización Owner. |
| R02 | P0 | JWT real sin emisor conectado. G42 prueba criptografía SOLO con keys sintéticas. |
| R03 | P0 | MFA AAL2 de proveedor no verificado en entorno real. |
| R04 | P0 | Flags del Cliente/Admin permanecen OFF; no habilitar ante CI sintético. |
| R05 | P1 | Rotación de secretos HMAC/JWKS en secret manager pendiente. |
| R06 | P0 | Storage binario KYC, hash y scanner genuino faltantes. |
| R07 | P0 | Migración de roles y RLS del proveedor, revocación de Owner/Admin. |
| R08 | P1 | Audit G30 parcial: expandir cambios/descargas de documentos/acciones operador. |
| R09 | P0 | Cola Admin KYC no constituye revisión documental legal. |
| R10 | P0 | G31 cobertura ACTIVE no implica permiso: `eligible_by_policy=false` correcto. |
| R11 | P0 | Geocercas oficiales Paraguay + geometría revisionada y jurisdicción pendientes. |
| R12 | P0 | GPS real y anti-spoof, consentimientos de sistema y baterías sin certificar. |
| R13 | Controlado | G32 cuarentena no habilita despacho, mantener prohibición. |
| R14 | P0 | Diagnostic idle != Driver realmente online/opt-in/elegible. |
| R15 | P0 | Revocación/consentimiento GPS reales no migrados, versiones/retención. |
| R16 | P0 | G35 no sustituye licencias/seguros legales verificables por tipo de vehículo. |
| R17 | P0 | G36 slot cubre AUTO/DELIVERY; futuros tipos deben reutilizarlo atómicamente. |
| R18 | Mitigado QA | G37 quitó DML amplio, pero auditar SECURITY DEFINER antes de real Auth. |
| R19 | Mitigado QA | G37/G36 protegen identidad/vehículo activo; ampliar auditoría terminal. |
| R20 | P0 | KYC/seguro/GPS concurrentes: fortalecer fencing con Auth y fuente real. |
| R21 | P1 | Push ACK no certifica entrega al teléfono; proveedor/receipt/device offline. |
| R22 | P1 | Historial y G41 consistencia eventual, cursor+refresh, escalado y retención. |
| R23 | P0 antes LIVE | PSP, cobros, refunds, conciliación y chargebacks ausentes. |
| R24 | Bloqueado | Owner finance REAL aún denegado; no usar ledger G7 simulado como ingreso. |
| R25 | P1 | Estudio tarifario por AUTO/MOTO/servicio/zona en PYG, costos e impuestos. |
| R26 | P0 | Incidentes/SOS requieren humanos, procesos, seguros, línea real y protección. |
| R27 | P0 | MOTO pasajeros/medicinas restringidas NO habilitadas. |
| R28 | P0 | Certificación física Android/iOS, redes, background, push, GPS pendiente. |
| R29 | P1 | Lovable sólo UI; no permitir negocio/secrets/routing crítico en frontend. |
| R30 | P0 coordinación | PR B base A puede divergir; issue #9, no merge/rebase unilateral. |
| R31 | P0 | Tests B son mock/QA; falta E2E Cliente↔Admin↔Driver↔backend real autorizado. |
| R32 | P1 | Costos nube, mapa, SMS, push, soporte y almacenamiento no aprobados. |
| R33 | P0 | Seguridad PII: roles, audit, backups, cifrado, borrado legal y gestión secretos. |
| R34 | Control continuo | Siempre verificar CI del SHA nuevo; commits de documentación también cambian HEAD. |
| R35 | P0 coordinación | No duplicar Gateway Cliente o Admin ya construido por B; contrato API A. |
| R36 | P0 | Despliegue por zona requiere niveles separados: cobertura/política/disponibilidad. |

---

# 16. Nuevos riesgos R37–R50 identificados por ESTA continuidad

| ID | Severidad | Riesgo y mitigación siguiente |
|---|---|---|
| R37 | P0 | G37 `SECURITY DEFINER` habilita funciones privilegiadas; revisar search_path, EXECUTE, identidad y todos los call paths con provider JWT real. |
| R38 | P0 | G38.0 disputa liberada del slot físico; nueva misión no debe bloquear disputa tardía ni permitir courier con caso administrativo activo aceptar otra después del hold. |
| R39 | P0 | G38 no tiene geofencing autentificado; proof privada sintética puede ser forjada por CI owner. Nunca admitir en LIVE. |
| R40 | P0 | G39 verifica Ed25519 pero no tiene emisor real ni inserción atómica de proof en DB; bloquear despacho. |
| R41 | P0 | G40 ticket de DB QA ≠ operador o SOS. Mantener contratos 201 QA-only, no divulgar teléfono/emergencia inventado. |
| R42 | P0 | G41 orden global severity/status eventualmente consistente; una mutación de estado puede mover filas entre páginas; refrescar/deduplicar, no prometer instantánea MVCC. |
| R43 | P0 | G42 JWT serializer canónico estricto; compatibilidad con tokens reales del proveedor no validada; NO bajar seguridad ciegamente. |
| R44 | P0 | G42 tabla sessions NO sincroniza auth.sessions real ni crea grants por default; alta/revocación externa requiere emisor privilegiado separado. |
| R45 | P0 | SQL `g42_lock_session` debe ejecutarse en misma transacción de operación; middleware HTTP que consulta antes NO es suficiente ante revocación concurrente. |
| R46 | P0 | La lectura de proveedor MFA AAL2 no se ha implementado; payload JWT `aal=aal2` no prueba factor actual. |
| R47 | P0 | G40/G41 OpenAPI `runtime-wired=false`, B espera HTTPS STAGING; no activar flags hasta evidencia auténtica. |
| R48 | P0 | Falta API catálogo público para Buyer + descubrimiento de sucursales y stock seguro; no inventar ruta para acelerar UI B. |
| R49 | P0 | Pedido/stock/idempotencia/transacciones y política de precio/checkout comprador aún no existen para consumo real. |
| R50 | P1 | Pruebas de aislamiento pueden fallar por `npm ECONNRESET`; distinguir fallo de red de bug, reintentar job con mismo SHA y registrar. |

**Criterio:** mitigado en QA ≠ cerrado para LIVE. No rehacer artificialmente comprobaciones viejas; avanzar P0 real si existe autorización, o contratos aislados que no abran un bypass.

---

# 17. TODO lo que FALTA — roadmap priorizado para el sucesor A (G43 en adelante)

## P0 inmediato: ejecutar sin pedir permiso para cada commit de QA

**G43 / A24 — mecanismo autoritativo de revocación y session binding transaccional (PRIMERA TAREA SUGERIDA).**
1. Leer `G42_PROVIDER_SESSION_REVOCATION_*`, `g42-provider-pinned-jwt-auth-qa.mjs`, G27, G39, G40 y G41 exactamente al HEAD nuevo.
2. Diseñar servicio de sincronización **inyectable** de sesiones confirmadas por proveedor, con mínimos privilegios y fuente independiente; sin DML libre a `service_role` ni secret hardcodeado.
3. Probar revocación simultánea a una mutación privilegiada con dos sesiones PostgreSQL; ejecutar `g42_lock_session` DENTRO de la transacción protegida, o rechazar cambio. Nunca reemplazar transaccionalidad con `verifySessionNotRevoked` HTTP previa.
4. Probar cambio de cuenta, sesión cerrada, token anterior a autorización, rotación de key, sesión revocada entre check y commit, fallos de proveedor, Auth MFA admin y cross-actor.
5. Si falta proveedor real, mantener integración OFF, crear contrato/test QA y seguir directamente con G44/G45 sin fingir disponibilidad. Publicar PR DRAFT, CI y acta.

**G44 / A25 — API de catálogo comprador y sucursales para B (SEGUNDA TAREA PARALELIZABLE).**
1. Auditar G6/G9 SQL (merchant/branch/catalog), RLS, versión de catálogo y precios efectivos. Revisar B R3 para que DTO sea compatible sin cambiar B.
2. Publicar OpenAPI de GET branch discovery y GET catálogo paginado, con `buyer` JWT verificado, `branchId`, servicio/municipio, versión y TTL; clave `nextCursor` HMAC por actor/sucursal/filtros/revisión.
3. Campos permitidos solamente: `branchId/version/expiresAt/itemId/itemTag/itemClass/active/unitPricePyg/stockUnits` y metadatos mínimos necesarios. Bloquear prescripción farmacéutica y artículos restringidos, no exponer PII.
4. 100 artículos por página solo **pageSize**, jamás tope global; test de al menos 13.000 productos, filtro correcto en servidor, cursor invalidado por cambio de versión/cuenta.
5. En caso de que faltan municipios/seguro/política legal, exponer condición `not eligible` y gate OFF. NO declarar ruta runtime-wired.
6. Informar issue #9 al B; B mantendrá lector/comercio apagado hasta STAGING certificado.

**G45 / A26 — pedido comprador durable y reserva de stock simulada.**
1. Contrato de creación por requestKey idempotente, actor comprador, sucursal, revisiones de artículos, precio total PYG calculado por servidor, TTL y límites de cantidades.
2. Transacciones SQL concurrentes sobre stock, tolerancia a reintentos, prevención de overselling, conflicto 409, compensación segura, creación de entrega G5/G6 cuando corresponda y reservas G36 para la asignación física.
3. Recibo estado/revisión/monotonía, cancelación/refund **simulado** documentados sin PSP. No aceptar subtotal del Cliente como total final ni permitir checkout real.
4. QA en PG16 con carreras de 2 o más conexiones, usuarios maliciosos, comercio ajeno, caducidad, stock negativo y duplicación. Revalidar Node/Expo/aislamiento.

**G46 / A27 — integración Auth/Supabase/HTTPS STAGING, SOLO con autorización Owner y prerequisitos externos.**
1. Identificar proyecto STAGING autorizado, proveedor Auth y configuración de JWKS auténtica, issuer/audience exactos, segregación dev/staging/prod, secret manager, credentials no versionadas, RLS e IAM.
2. Verificar identidad/session revocation con usuarios **sintéticos en STAGING**; provider AAL2, token rotate/revoke, cross-actor, no leaks, auditoría sin credenciales. No reutilizar DB descartable como migración de producción.
3. Montar G40 POST/GET y G41 GET en API HTTPS con server-side Auth, control de rate limit, DB RLS y observabilidad; publicar OpenAPI `runtime-wired=true` ÚNICAMENTE tras pruebas reales del runtime y URL verificable; coordinación B.
4. No ejecutar despliegue de apps, backend o SQL remoto sin autorización. Si falta, registrar bloqueo preciso y pasar a G44, G45, G47 o auditoría offline.

**G47 / A28 — Storage documental y KYC seguros.**
- Diseñar proveedor bucket PRIVADO/versionado, presigned URL corta por caso/revisor, no nombres/bytes en DTO, hash SHA-256 de bytes+magic MIME, escaneo antivirus real, revalidación de objeto/revisión antes de aprobar, trazabilidad y borrado/retención legal.
- Probar reuso de URL, colisión, upload sobrescrito, scanner caído, sesión revocada, permisos Admin/Owner separados y auditoría; sin usar documentos personales reales.

**G48 / A29 — GPS/geofencing/legalidad y disponibilidad.**
- Polígonos de zonas versionados y fuente lícita para Paraguay, reglas municipales por servicio, seguros para AUTO/MOTO y especificación de geocerca firmada.
- GPS real con consentimiento revocable, detección spoof/replay, latencia, heartbeat de Driver y políticas para baja señal/background.
- Probar dos conexiones: cambio de zona/KYC/seguro/consent mientras Driver acepta, fencing atómico y mismo slot G36.
- Mantener `eligible_by_policy=false` hasta respaldo legal y Owner; no activar moto pasajeros.

**G49 / A30 — UX/Driver físico y resiliencia del backend.**
- Ensamblar app Driver instalable independiente, login real autorizado, documentos, ofertas polling/push, aceptación/expiración, logout, permisos GPS, batería/foreground/background, red offline, crash recovery.
- Certificar Android/iOS físicos con binarios separados y pruebas de integración Cliente→backend→Driver→Admin. No subir a tiendas antes de GO.

## P1 posterior a P0 o en paralelo si se bloquea proveedor

**G50 — auditoría operativa:** incidentes, roles, KYC, tarifas, geocercas, consentimientos, pagos y descargas de documentos, eventos append-only, alertas, export y retención.  
**G51 — finanzas reales sólo tras habilitación legal:** estudiar Bolt/Uber y tarifas de automóviles vs motos por zona; modelo de precios PYG, comisiones, tasas, costos, antifraude, conciliación, PSP, payout, refund y contracargos. Mantener Owner finance DENEGADO antes de ledger auténtico.  
**G52 — seguridad y carga:** multiusuario, abuse/rate limiting distribuido, circuit breaker, cursor/rotación, backups/restores, secretos, pruebas de miles/millones de filas fuera de los límites del CI sin inventar benchmark, SLO, recovery y rollback.  
**G53 — soporte y emergencias:** diseño con operador humano habilitado, escalamiento legal, SLA, protocolos de seguridad física, mecanismos de seguimiento y SOS genuino; jamás activar por una etiqueta G40.  
**G54 — interoperabilidad B y Lovable:** CI cross-app, contrato y rollout gradual por zonas, Lovable exclusivamente UI, dos apps distintas, panel Admin aparte, no mover lógica segura al cliente.  
**G55 — preparación tiendas/GO-NO-GO:** permisos, privacidad, seguros, regulaciones paraguayas, infraestructura escalable, pruebas físicas E2E, auditorías independientes y consentimiento expreso Owner. Hasta entonces ningún LIVE.

---

# 18. Problemas corregidos que el siguiente arquitecto NO debe reintroducir

1. Límite accidental de 50 historial TOTAL → corregido por G26 (50 solo por página).
2. Entregas AUTO/MOTO a precio inventado idéntico → tarifario server PYG y modelo diferenciado.
3. Atajos de aceptación G3/G5 fuera de oferta → revocados con G4/G10.
4. Asignaciones concurrentes AUTO + DELIVERY a mismo Driver → slot G36.
5. DML directo amplio `service_role` G3/G5 → reducido en G37; RPCs `SECURITY DEFINER` confinados.
6. Oferta privada sin permisos `FOR UPDATE` tras revoke → corregida G37 sin reabrir escritura.
7. `delivered→disputed` intentando readquirir slot → G38.0 caso administrativo.
8. Atestación falsa+GPS sintético como permiso → G38.2 rechaza zona no elegible.
9. Comparación SQL entre dos ENUM distintos → comparar texto en G38.1.
10. TTL inválido de fixture oferta AUTO → corregir tests al contrato, no alargar TTL.
11. Claim de SOS/operador al persistir incidente en QA → G40 recibo rotulado DB QA, SOS bloqueado.
12. Regex UUID sin segmento completo → corregida en G40/G41.
13. Colisión de `incident_id` variable/columna SQL → corregida en G40.
14. OpenAPI versionado pero test congelado a g11 → versión gN validada.
15. G41 filtros solo UI de 50 filas → filtros globales antes de LIMIT, 241 casos.
16. G41 fixtures Admin nativo+backoffice mezclados → exclusividad en fixtures/verificador.
17. Error transitorio `npm ECONNRESET` aislamiento → repetir job sin cambio de negocio.
18. G42 confundir firma válida para actor ajeno con mala firma → separación verificación/autorización.

El siguiente arquitecto debe mantener pruebas de regresión de todos esos casos y evitar relajar seguridad para conseguir “CI verde”.

---

# 19. Cuándo SÍ hay bloqueo real y qué hacer a continuación

**Bloqueo REAL acotado**:
- Falta aprobación Owner para desplegar, cambiar producción, tocar SQL remoto, añadir PSP o exponer datos/usuarios reales.
- No existen credenciales/proveedor/seguro/licencia/consentimiento exigidos para validar operación auténtica.
- Un cambio toca carpetas B o la base de PR8 y no puede aislarse contractualmente.
- Falla integridad/safety: race reproduce duplicación real, bypass RBAC, escalada de permisos o pérdida de datos y el riesgo impide publicar ese gate.
- GitHub deniega acceso/escritura o el checkout/CI está realmente inaccesible y no puede seguirse con trabajo local verificable.

**No es bloqueo REAL para parar todo A**:
- Falta API de B para mostrar UI; A puede completar API/tests/documentación propia.
- Falta proveedor externo: continuar SQL QA, modelos/DTO, contrato seguro, tests adversariales y otro módulo A.
- GitHub Actions en cola, npm ECONNRESET o un test negativo: diagnosticar/reintentar/corregir, no pedir aprobación para cada fix QA.
- Existen resultados sintéticos pero no operación física: informar estado y pasar al siguiente gate, no declarar app terminada.

**Si un gate queda bloqueado:** dejar evidencia en docs/architecture o issue #9 con dependencia exacta, SHA, salida CI/error, riesgo, tipo de autorización requerida y workaround NO LIVE; cambiar inmediatamente a otra tarea A no bloqueada. Nunca saltarse la barrera de seguridad.

---

# 20. Protocolo operativo obligatorio del siguiente chat

1. Abrir repositorio y PR #7/#8. Obtener SHA real HEAD de rama A y B; comprobar DRAFT, base y archivos cambiados.
2. Leer ESTE Handoff y el G0–G36 de 465 líneas, G42 doc y issue #9 últimos mensajes; B R3 solo para conocer contratos y no duplicar.
3. Revisar resultados CI *del HEAD A ACTUAL*, no de un SHA viejo: PostgreSQL, Node, Expo, aislamiento. Si nuevo commit documental no dispara alguno, anotarlo explícitamente y verificar al menos la cadena relevante; no atribuir resultados inexistentes.
4. Identificar primer trabajo pendiente P0 no bloqueado: preferentemente G43 (revocación transaccional), y/o G44 catálogo Buyer; listar dependencias. Prohibido comenzar G37 de cero.
5. Implementar pequeño incremento real de código, scripts de seguridad/SQL y pruebas Node o PG16 descartable; **nunca** ejecutar scripts `CI_ONLY` en Supabase remoto.
6. Revisar permisos `SECURITY DEFINER`, RLS/EXECUTE y actor JWT; lock dentro de mutación, no confianza en cliente.
7. Corregir CI rojo investigando logs; publicar commit sin force push y revisar 4/4 del mismo SHA. Si falla runner por red, reintentar el job específico y dejar traza.
8. Documentar con SHA, rutas/funciones, estado, riesgos que permanecen y CI; registrar cambios de contrato para B en issue #9.
9. Continuar al siguiente gate sin preguntar «¿avanzo?» mientras exista trabajo seguro bajo A. No esperar a Lovable.
10. Si se solicita otro handoff, redactar nueva transferencia ligada al SHA exacto, preservar fuentes históricas, inventariar ejecutado vs pendiente, dejar prompt listo y comprobar nueva CI.

**Definición de terminado de un gate QA:** código en HEAD A, pruebas adversariales adecuadas, regresión PG/Node/Expo/aislamiento, documentación versionada, riesgos/limitaciones explícitos, sin accesos LIVE ni cambios B. **Definición de aplicación lista para operar:** mucho más exigente (sección 21).

---

# 21. Checklist de certificación completa antes de “ya se puede usar”

- [ ] Auth/JWT/refresh/revocación y MFA del proveedor realmente conectados, roles mínimos.
- [ ] HTTPS STAGING autorizado con datos sintéticos, IAM, secretos aislados, CI/RLS/E2E de autorización.
- [ ] Migraciones para STAGING legítimo revisadas/aprobadas, backups y rollback; no copiar SQL descartable.
- [ ] Servicio de despacho y elegibilidad zona por instrumento/legalidad real; AUTO vs MOTO diferenciado.
- [ ] GPS, mapas, ETA, geofence y consentimiento/anti-spoof reales en dispositivos.
- [ ] Driver/courier realmente disponibles, KYC documentos binarios/seguros/licencias verificados.
- [ ] Un único slot cross-service sin duplicidad y aceptación/revocación transaccional.
- [ ] G40 incidentes con equipo humano y flujos de soporte reales, SOS protocolo certificado si se anuncia.
- [ ] Buyer catálogo por sucursales, pedido y stock transaccional, cargos legales.
- [ ] PSP/payout/refund/chargeback/reconciliación regulados y certificados.
- [ ] Cliente y Driver como dos apps Android/iOS independientes, Admin web aislada; batería, offline, push, accesibilidad, estado de sesión.
- [ ] Auditoría, privacidad, retención, cifrado, backup/restore, respuesta a incidentes.
- [ ] Costos/escala/cobertura por zonas viables, pruebas físicas E2E, release gates.
- [ ] Aprobación escrita Owner para deploy/merge/LIVE y planes de retorno a estado seguro.

**NO MARCAR CHECKS POR CI SINTÉTICO.** La app no está certificada aún para operar comercialmente; Lovable sólo podrá aportar interfaz según las decisiones Owner.

---

# 22. INSTRUCCIÓN LISTA PARA PEGAR EN EL NUEVO CHAT DEL ARQUITECTO A

> Actúa como el nuevo **Arquitecto A de QORE Mobile / Movete Fácil**, sin empezar de cero. Fuente soberana `mezas3238-hue/Qore-mobile-`, PR #7 DRAFT, rama `feature/mobility-monorepo-isolated-20261016`. Lee primero `docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G42_CONTINUIDAD_2026-10-23.md`, el precedente G0–G36 de 465 líneas, G42 y issue #9. Verifica HEAD y 4 workflows actuales; no extrapoles CI de SHAs antiguos. G37–G42 ya están implementados y G42 cerró con commit `165997ec` y PostgreSQL #321, Node #562, Expo #1156, aislamiento #505 SUCCESS. Continúa por G43 (revocación/Auth/session fencing transaccional), G44 (catálogo comprador backend y paginación sin límite total), G45 (pedido/stock idempotente) y demás roadmap P0, sin pausas injustificadas. Publica código/tests/docs GitHub con CI; si una dependencia externa falta, regístrala y cambia inmediatamente de tarea A. No modificar B: Driver y backend A, Cliente/Admin B; PR #8 sobre base A, issue #9 coordina. NO MERGE/NO LIVE/NO deploy/NO SQL remoto/NO PSP/NO PII/NO secretos. Solo bloquear operación concreta con riesgo real o autorización externa; no pedir confirmación para cada commit QA.

---

# 23. Cierre verificable de transferencia

Este handoff **no reemplaza ni borra** el historial G0–G36. Lo referencia y agrega la implementación G37–G42, 6 ciclos de QA aprobados y las dependencias nuevas identificadas por B. La documentación es parte de la rama A; se debe publicar con commit nuevo y comprobar que PR #7 sigue DRAFT y PR #8 intacto. El siguiente arquitecto tiene tareas P0 especificadas, orden de trabajo, rutas, contrato de no solapamiento y regla de continuidad **sin detenerse salvo bloqueo real**. Este documento NO autoriza producción.
