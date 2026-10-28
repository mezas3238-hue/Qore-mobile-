# QORE Mobile / Movete Fácil — HANDOFF MAESTRO ARQUITECTO A
## Continuidad integral G0–G70 + cierre funcional Driver KYC, selfie, vencimientos y renovación — 24/10/2026
### Instrucción operativa para un nuevo chat: **continuar implementando y certificando sin pausas salvo bloqueo real**

> **DIRECTIVA OWNER VIGENTE Y PRIORITARIA:** El objetivo es **entregar funciones completas, integradas y certificadas**, NO acumular commits, módulos, líneas ni numeraciones de gates. El siguiente arquitecto debe seguir **escribiendo, probando y corrigiendo código en GitHub en este mismo chat**, sin paralizar el desarrollo por detalles ya conocidos. Un bloqueo externo frena **solo** la actividad que exige autorización/proveedor; continuar otra parte técnica autorizada.

> **RESTRICCIONES INALTERABLES:** NO MERGE, NO LIVE, NO DEPLOY, NO VPS, NO habilitar cobros/PSP, NO SQL contra bases externas, NO documentos/fotos/selfies reales ni secretos en QA, NO push o SMS reales, NO firmar/publicar builds comerciales, NO habilitar MOTO pasajeros, NO cambiar la base o forzar rebase de PR B ni pisar carpetas del otro arquitecto sin nueva autorización Owner. Mantener PR #7 y #8 DRAFT.

---

# 01. FUENTE DE VERDAD Y ESTADO VERIFICADO DE TRANSFERENCIA

| Campo | Valor exacto comprobado |
|---|---|
| Proyecto/mercado | **Movete Fácil / QORE Mobile**; movilidad, envíos y comercios en Paraguay |
| Repositorio soberano | [`mezas3238-hue/Qore-mobile-`](https://github.com/mezas3238-hue/Qore-mobile-) (**guion final obligatorio**) |
| Arquitecto A | [PR #7 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/7), `feature/mobility-monorepo-isolated-20261016` contra `main` |
| **Último SHA FUNCIONAL A con 4/4 SUCCESS** | `2685e478c606a3b2335a90920965460c7e3ddb41` |
| Arquitecto B | [PR #8 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/8), `feature/mobility-cliente-admin-parallel-20261022` contra la rama A |
| SHA B observado en esta transferencia | `ac7ad3561972e28ddd3b428ba14038fe627f7fdc` (puede cambiar por trabajo paralelo) |
| Coordinación formal A/B | [Issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9) |
| Resultado de producto | **NO_GO**. No hay certificación de operación comercial, IdP/HTTPS/DB externo autorizado ni dispositivos físicos end-to-end |
| Árbol A del SHA funcional | **761 archivos blob**, `truncated=false` (NO significa 761 funciones) |
| Árbol B del SHA observado | **669 archivos blob**, `truncated=false`; rama independiente y diferente historia |
| Último alcance específico A | G67 prueba de entrega SQL; G68 remitente; G69 grants; G70 localhost JWT; **onboarding Driver de 8 documentos y selfie + renovaciones/vencimientos QA** |

**IMPORTANTE SOBRE SHAs:** Este Handoff será un commit exclusivamente documental posterior a `2685e478c606a3b2335a90920965460c7e3ddb41`. Las cuatro matrices de abajo certifican **el código funcional en ese SHA**, no se debe atribuirlas automáticamente al SHA nuevo del documento; verificar ejecuciones nuevas si GitHub las dispara por rutas.

## 01.1 Evidencia verificable A — los cuatro workflows en el mismo SHA

| Workflow | Run | Estado observado |
|---|---|---|
| PostgreSQL 16 disposable: SQL, G42/G17/KYC/vencimientos, roles y carreras | [#843](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40136334678) | **SUCCESS** |
| Node STAGING: contratos, HTTP/autorización, tests adversariales | [#1282](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40136334663) | **SUCCESS** |
| Expo: tipos, tests y export web | [#1999](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40136334667) | **SUCCESS** |
| Driver/Cliente separados: aislamiento, tipos, tests y export web | [#1823](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40136334723) | **SUCCESS** |

**Evidencia independiente B:** en `ac7ad3561972e28ddd3b428ba14038fe627f7fdc` aprobó [ownership #521](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40136416339), [Admin Web #477](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40136416451) y [aislamiento #1824](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40136416399), **3/3 SUCCESS para B, NO un E2E conjunto A+B**.

**Definiciones honestas de certificación:**
- `CODIGO/CONTRATO_QA`: implementación + unit/integration tests sintéticos + SQL PG descartable y CI. Esta es la máxima evidencia actual.
- `STAGING_E2E_REAL`: las dos apps usan **el mismo backend HTTPS autorizado**, IdP con sesiones reales y PostgreSQL persistente, los mismos IDs, sin dobles que sustituyan piezas esenciales.
- `NATIVE_PASS`: Android/iOS físicos, permisos cámara/GPS/push, reconexiones y casos adversariales.
- `COMMERCIAL_GO`: todos los 17 gates y circuitos de negocio, legal, seguros, PSP y soporte; orden Owner expresa. **Hoy NO_GO**.

---

# 02. MANDATO DE PRODUCTO Y DECISIONES DE OWNER

Movete Fácil debe aspirar a superar funcionalmente Bolt/Uber/PedidosYa con interfaz propia (no copiar activos visuales protegidos) y operar por **zonas/municipios de Paraguay** cuando estén autorizados. Se construyen TRES productos, sin mezclar roles ni binarios:

1. **`apps/movete-driver/` — Expo Driver independiente**: conductores AUTO y repartidores de AUTO/MOTO, documentación KYC, selfie, vehículos, ofertas/aceptación, viajes/custodia, chat, ganancia/soporte (según habilitación).
2. **`apps/movete-cliente/` — Expo Cliente independiente**: pasajeros AUTO, remitentes y compradores; cotización, reservas/seguimiento, delivery AUTO/MOTO, pedidos de supermercados, farmacias permitidas y restaurantes, chat, historial.
3. **`apps/movete-admin/` — Admin Web separado**: revisión humana KYC, RBAC/MFA, zonas, comercios, auditoría, incidentes, fraude, soporte, liquidaciones.

**Backend** `apps/mobility-expo/`: SQL PostgreSQL, Node, Auth, RLS, GPS/zonas, pricing en guaraníes, dispatch, custodia, chat, contratos y seguridad. Su nombre histórico NO implica que sea una tercera aplicación Driver.

- **Moto pasajero NO aprobada:** MOTO solo cargas/envíos, nunca pasajeros.
- **Tarifas Gs/PYG** deben provenir del backend, variar por AUTO/MOTO/carga/zona; no inventar precio, GPS, ETA, conductor asignado ni stock comercial.
- **Cobertura ≠ disponibilidad ≠ elegibilidad**; las tres son gates distintos. Una zona documentada no activa viajes.
- **No tope global de 50 registros**: `pageSize=50` puede ser página, nunca límite de conductores, usuarios o viajes.
- Cliente↔Driver/repartidor **debe** poder enviarse mensajes con asignación válida y privacidad.
- **Lovable solo UI final** después de cerrar backend/seguridad; no rehacer lógica de negocio o Auth en Lovable.
- Prioridad operativa actual Owner: alta completa del conductor (documentos + rostro), aprobación automática **solo tras verificación independiente**, bloqueo al vencimiento, aviso visible y recuperación tras renovación verificada.
- La seguridad infantil/vial, privacidad, consentimientos, legalidad paraguaya y resolución humana ante falsos rechazos son requisitos del producto, no adornos.

---

# 03. DIVISIÓN DE ARQUITECTOS — PROHIBIDO PISARSE

| Área | A (este sucesor) | B |
|---|---|---|
| `apps/mobility-expo/**` (Node, SQL, OpenAPI, contratos comunes) | **EDITAR** | Solo consumir/coordinar |
| `apps/movete-driver/**` (cámara, documentos, conductor, courier) | **EDITAR** | No editar |
| `apps/movete-cliente/**` | No editar | **EDITAR** |
| `apps/movete-admin/**` | No editar | **EDITAR** |
| `docs/architecture/**`, `docs/handoff/**` | **EDITAR** | No editar |
| `docs/architect-b/**` | No editar | **EDITAR** |
| `.github/workflows/**`, `scripts/**` comunes | A, coordinar cambios de contrato | B solicita/certifica su alcance |
| [Issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9) | Publica contratos A y evidencias | B publica dependencias y conformidad |

**Handoff propio B, LEER antes de tocar contratos compartidos:**
[`docs/architect-b/HANDOFF_MAESTRO_ARQUITECTO_B_R1_R66_F1_PRIORIDAD_FUNCIONES_CERTIFICADAS_2026-10-24.md`](../architect-b/HANDOFF_MAESTRO_ARQUITECTO_B_R1_R66_F1_PRIORIDAD_FUNCIONES_CERTIFICADAS_2026-10-24.md).
B R1–R66 + F1 prioriza circuito **AUTO pasajero** y exige pre-cotización real antes del despacho, booking idempotente, origen/destino, reconciliación y STAGING HTTPS+DB compartida. La app B muestra contrato Cliente/seguimiento/custodia y Admin Web, pero **20 circuitos comerciales siguen sin certificación E2E**. Los resultados 3/3 B son QA, no aprobación real.

**No forzar merge o rebase:** B usa una base A que evoluciona. Comunicar cambios DTO/API y requisitos en issue #9 sin editar sus rutas.

---

# 04. HISTORIA INTEGRAL A — DESDE EL ARRANQUE HASTA G66

Los trabajos siguientes están **implementados y probados en QA**; no representar como funcionalidades comerciales operativas. NO rehacerlos desde cero: consultar historial, tests y riesgos.

**G0–G22 (fundaciones y negocio):**
- G0: aislamiento del monorepo y del negocio trading, dos apps nativas separadas, rama A/CI/entornos; G1 roles/RLS/esquema PostgreSQL; G2 conductor/vehículo/licencia/seguro/inspección.
- G3: viaje AUTO idempotente con estados `searching→accepted→arriving→in_progress→completed`; G4: dispatch/ofertas privadas, concurrencia, outbox, ACK y TTL.
- G5: envíos particulares AUTO/MOTO, custodia, recogida/entrega, disputa/devolución y proof; G6: comercios/catálogo/stock/pedidos/preparación; G7: tarifas PYG y comisiones/ledger sintético.
- G8: SOS/incidentes/auditoría; G9 onboarding comercios; G10 oferta/aceptación courier; G11 OpenAPI/contratos; G12–G15 outbox y leases/retries de push courier, concurrencia de repartidores y polling.
- G16 bandeja privada Driver; G17 referencias y estados privados KYC; G18 rol Driver exclusivo; G19 verificación de archivo/categoría/MIME/hash/antivirus externo por contrato; G20 actualidad documental y preflight SQL; G21 primeras pantallas Driver; G22 auth/logout fail-closed.

**G23–G48 (consistencia, escala, seguridad):**
- G23–G26 historia privada, cursores/keyset/MVCC, decenas de miles de registros sin límite arbitrario.
- G27–G30 owner/admin, KYC, incidentes, auditoría por permisos/paginación.
- G31 política por zonas; G32–G35 GPS consentido, anti-replay/spoof y vigencia documental; G36 slot atómico de conductor compartido entre AUTO/DELIVERY.
- G37–G38 fencing DML/transiciones, prohibición de despacho sin gates y sin grants peligrosos; G39–G41 seguridad criptográfica, incidentes y administración.
- G42–G43 JWS ES256/RS256/EdDSA con `issuer/audience/kid` pinneados, sesión proveedor, MFA Admin contractual, bloqueo G42 en COMMIT y revocación concurrente.
- G44–G46 catálogo/sucursales/stock/reservas buyer, cursor HMAC, cierre de grants legacy; G47 Storage KYC/proof leases y metadatos privados; G48 rol NOLOGIN/ticket de un uso para datos protegidos.

**G49–G60D (mensajería y receipts):**
- G49–G50 chat Passenger con capacidades restringidas, conversación por viaje/entrega/orden, SEND idempotente.
- G51–G52 inbox/historial/cursor, unread, READ sin saltos; G53–G55 ACK y marker vinculado a mensajes visibles.
- G56–G57B canal Driver, roles privados, paginación, READ contiguo y protección contra falsas lecturas.
- G58–G58E loopback HTTP/Auth G42, rate/timeout, cierre de conexiones y control de leakage/commit incierto.
- G58F NOLOGIN exchange de prueba opaca; G59/G59B reconciliación Passenger/Driver de SEND tras timeout; G60A/B UI de chat Driver y loopback; G60C/D intercambio SQL mínimo y cadena local firmada.

**G61–G66 (composición y circuitos Driver):**
- G61 matriz de 17 gates NO_GO, controles de integración, contratos de sesión y entornos.
- G62 runtime único opt-in Driver para Auth privado, bandeja, documentación, chat; desactivado sin autorización.
- G63 aceptar/rechazar ofertas AUTO y DELIVERY desde Driver; G64 reconciliar decisión con `requestKey` original después de ACK perdido, sin repetir post a ciegas.
- G65 viaje AUTO Driver: aceptar → consultar estado privado → llegada → recogida de pasajero → finalización, con revisión del backend y recuperación de incertidumbre; pantalla `app/viaje.tsx`, dominio `driver-trip-lifecycle*`, servidor `g65-*`. Contrato E2E **sintético**, no dos móviles reales.
- G66 custodia AUTO/MOTO Driver: aceptar reparto → recogida → tránsito → entrega/disputa/devolución con obligación de proof independiente; pantalla `app/entrega.tsx`, dominios `driver-custody*`, `g66-*`. `obtainVerifiedProof:null` por defecto: no fingir foto/entrega real.

**Historia extensa obligatoria, no duplicar commits históricos:**
1. [Handoff A G0–G66](./HANDOFF_MAESTRO_ARQUITECTO_A_G0_G66_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md), 463 líneas, fundamentos, riesgos y transferencia previa.
2. [Handoff A G0–G58E](./HANDOFF_MAESTRO_ARQUITECTO_A_G0_G58E_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md), 617 líneas, QA de DB, Node, chat, ACL/secretos.
3. [Anexo G58E→G66, 175 commits documentados](./ANEXO_A_G58E_A_G66_175_COMMITS_2026-10-24.md); [inventario de 709 blobs del corte G66](./ANEXO_A_G66_INVENTARIO_709_ARCHIVOS_SHA_2026-10-24.md); handoffs G0–G55/G0–G48 y anexos anteriores. **Estos inventarios son históricos**: el HEAD funcional actual tiene 761 blobs.
4. [División de trabajo A/B](./DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md).

---

# 05. G67–G70 — TRABAJO HECHO DESPUÉS DEL ÚLTIMO HANDOFF HISTÓRICO

## G67: comprobante de entrega unido ATÓMICAMENTE a la transición SQL
- SQL `apps/mobility-expo/docs/backend/staging_only/G67_DELIVERY_PROOF_ATOMIC_FENCE_POSTGRES_CI_ONLY.sql` y ASSERT: G5 no puede cerrar una entrega usando solo un UUID, consulta Node, foto ficticia ni comprobante vencido; la validación/consumo del proof y el cambio de estado deben estar protegidos por el mismo COMMIT transaccional.
- Pruebas reales PostgreSQL16 de dos conexiones (consumo único/replay/revocación/carrera/rollback) en `server/g67-delivery-proof-atomic-race-ci.py`; rechazar SDK/roles delegados que intenten emitir/ver evidencias.
- [Documento técnico G67](../architecture/G67_DELIVERY_PROOF_ATOMIC_CUSTODY_POSTGRES_QA_2026-10-24.md). **NO implica fotografía/recepción física real**: fixture no sustituye bucket cifrado, identidad receptor y retención legal.

## G68: estado privado del envío para el REMITENTE Passenger
- SQL owner-only `G68_SENDER_OWNED_DELIVERY_READ_POSTGRES_CI_ONLY.sql` enlaza `deliveryId+senderId`, rol exclusivo Passenger, G42 y proof G67 para terminales; Node `g68-sender-custody-status-qa.mjs`, `g68-sender-custody-repository.mjs` y tests.
- DTO mínimo de **11 campos exactos** (`mode,deliveryId,ownerId,state,revision,vehicleKind,assignmentPersisted,proofVerified,qaOnly,productionEnabled,liveDeliveriesEnabled`) sin GPS, PII, courier ni prueba cruda. Compatible con B R62/R65.
- [Documento G68](../architecture/G68_SENDER_PRIVATE_DELIVERY_CUSTODY_QA_2026-10-24.md). La ruta lógica no estaba montada en HTTPS.

## G69: delegación SQL de mínimo privilegio para lectura privada remitente
- SQL `G69_SCOPED_SENDER_CUSTODY_EXCHANGE_POSTGRES_CI_ONLY.sql` y ASSERT: definer/caller NOLOGIN, prueba opaca SHA256 corta/un uso, sin mint para SDK/sitio/web/servicio genérico, lock G42 hasta COMMIT.
- Dos Passengers, dos conexiones, intento ajeno, vencimiento, revocación y grants denegados se comprueban en `server/g69-sender-custody-scoped-read-race-ci.py`.
- Node `g69-trusted-sender-read-qa.mjs` requiere JWT + sesión + rol + rate + atestación owner-only; OpenAPI `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json` `1.0.0-g69` documenta `GET /v1/staging/sender/deliveries/{deliveryId}/custody`, pero **`x-qore-runtime-wired:false`**.
- [Documento G69](../architecture/G69_MIN_PRIVILEGE_SENDER_CUSTODY_SQL_EXCHANGE_QA_2026-10-24.md).

## G70: JWT REALMENTE FIRMADO de laboratorio y transporte HTTP localhost
- `g70-pinned-sender-local-chain-qa.mjs` integra JWS ES256 de test, adaptador de sesión G42, rol Passenger y G69 privado en un servidor HTTP de prueba `127.0.0.1` (`g70-sender-custody-loopback-qa.mjs`).
- Rutas estrictas, sin cookie/redirect/query, proof de un uso sin retry, timeout, no-store, mínimos campos; tests positivos/adversos con `node:http`.
- La capa HTTP G70 usa **exchange mock en memoria**, mientras G69/G67 hacen pruebas SQL por separado. NO equivale a una sola API HTTPS con PG real persistente.
- [Documento G70](../architecture/G70_PINNED_PASSENGER_HTTP_LOCAL_CHAIN_QA_2026-10-24.md).

---

# 06. ENTREGA MÁS RECIENTE: ALTA DRIVER + SELFIE OBLIGATORIA + APROBACIÓN AUTOMÁTICA EN QA

El Owner confirmó que toda cuenta Driver debe presentar **registro/licencia, cédula de identidad frente y dorso, cédula verde, habilitación, foto de rostro y, cuando corresponda al servicio, seguro e inspección**. La política QA implementada exige **8 categorías** (7 documentos + selfie). El backend debe verificar autenticidad y vigencia por proveedor independiente, que identidad/foto/vehículo correspondan al conductor, consentimiento/liveness y ausencia de fraude. La foto recibida NO prueba identidad; dato de vencimiento declarado por móvil NO autoriza aprobar.

## 06.1 Captura y transporte privados — Código implementado
- `apps/mobility-expo/docs/backend/staging_only/G1_PRIVATE_DOCS_BUCKET_STAGING_ONLY.sql`: paths privados owner-scoped para los 8 tipos con JPEG/PNG, sin bucket público ni documento ajeno.
- `G17_PRIVATE_DRIVER_DOCUMENTS_POSTGRES_CI_ONLY.sql` + ASSERT: enum de ocho clases, referencia G17 por conductor/tipo, registro pendiente y lectura sin medios; `g17-driver-document-gateway.mjs` y repository + tests.
- `server/g19-private-driver-evidence-observer.mjs` + tests: comprobación estricta de ruta y dueño, bytes/MIME real/huella y escaneo externo como contrato. **Fue reconstruido desde su versión original después de que una sustitución automática dañara el archivo**; verificar que no se vuelva a duplicar ni se pierda el regex de ocho tipos.
- Driver `src/domain/driver-workspace.mjs`, `driver-documents.mjs/.d.mts` y pantalla `app/documentos.tsx` admiten ocho estados y no rechazan un expediente completo.
- Driver `src/native/driver-evidence-camera.ts`, `src/domain/driver-base64-image.mjs`: Expo 57 `expo-image-picker`, permiso de cámara/galería explícito, selfie **solo cámara** y consentimiento requerido, base64 temporal acotado y validaciones JPEG/PNG. No exponer fotos en estado persistente.
- Driver `src/domain/driver-document-upload.mjs`: selección/captura → validación → privado `mobility-staging-driver-evidence` con `upsert:false` → relectura de sesión → `POST /v1/staging/driver/documents/observe` → `pending-review`, nunca `approved`. Buffer temporal borrado, reintento automático bloqueado si el resultado de persistencia es incierto.
- Driver `src/domain/driver-storage-supabase-adapter.mjs`: SDK privado opt-in, chequeo de mismo usuario/token/path/tipo, datos ArrayBuffer sin URL pública; `DriverDocumentUploadProvider.tsx` y runtime UX en `documentos.tsx`. **Por defecto deshabilitado** sin composición STAGING+Storage+IdP autorizada.
- Se corrigió el validador UUID del adaptador en QA; no restaurar la versión de cuatro segmentos.

## 06.2 Autoaprobación basada en evidencias comprobadas — Código implementado
- `server/driver-kyc-auto-approval-qa.mjs` exige ocho atestaciones exactas, vigencia, emisor, vehículo, consentimiento, selfie+liveness+face-ID match. Devuelve `READY_FOR_ATOMIC_APPROVAL` sin crear aprobación comercial.
- `server/driver-kyc-onboarding-command-qa.mjs` comprueba JWT, sesión no revocada, rol Driver exclusivo, rate y documentos/rostro/vehículo independientes antes del SQL owner-only.
- SQL `DRIVER_KYC_EIGHT_DOCS_ATOMIC_ONBOARDING_POSTGRES_CI_ONLY.sql` y ASSERT: evidencia vinculada al **último documento G17** del conductor, locking del vehículo/documentos/G42, decisión idempotente de onboarding QA `mobility_stage_kyc_atomic_approve_owner_qa`, más estado actual `mobility_stage_kyc_current_onboarding_owner_qa`. Una aprobación archivada no da pase vitalicio y un documento reemplazado invalida la atestación anterior.
- No se convierte `accountApproved:true` en despacho LIVE. Los fixtures `QA_INDEPENDENT_ATTESTOR_NO_MEDIA` **no son verificadores documentales ni biométricos reales**.

## 06.3 Vencimientos automáticos, aviso y renovación — ÚLTIMO BLOQUE HECHO
**Mandato del Owner:** al vencer un documento obligatorio, bloquear la cuenta para nuevos servicios, indicar qué venció en la pantalla y permitir subir fotos nuevas para re-habilitar **solo después de verificar autenticidad/vigencia**, automáticamente sin revisión humana redundante si todo está correcto.

- SQL `DRIVER_KYC_EXPIRY_RENEWAL_STATUS_POSTGRES_CI_ONLY.sql` y ASSERT: RPC owner-only `mobility_stage_kyc_expiry_snapshot_owner_qa(driver,vehicle)` recalcula con **reloj del servidor y ocho documentos actuales G17**: `BLOCKED_EXPIRED`, `BLOCKED_REVIEW`, `SUSPENDED`, `READY_QA`. Devuelve categorías vencidas, pendientes, avisos ≤30 días y próxima expiración en ms, pero **no PII ni archivos**.
- **Vencimiento:** bloqueo QA desde la evaluación vigente del servidor incluso con la app cerrada (en el laboratorio se prueba la consulta del servidor; NO hay todavía integración completa en despacho). Una foto renovada aún `pending` mantiene bloqueo. Al verificarse por fuentes independientes y vincularse al último archivo G17, retorna `READY_QA` automáticamente. Suspensiones administrativas nunca se levantan por renovar.
- Node `server/driver-kyc-expiry-status-qa.mjs` + tests: JWT/session G42/rol exclusivo/vehículo propio, respuesta exacta, no filtrar nombres, teléfono, token, archivo ni IDs.
- Driver `src/domain/driver-kyc-expiry.mjs` + tipos/tests: lector HTTPS pinneado opt-in `GET /v1/staging/driver/kyc/validity`, etiquetas en español de vencido, renovación pendiente, suspensión y próximo vencimiento.
- `DriverKycExpiryProvider.tsx`: refresca al abrir, al regresar a primer plano y cada 60 segundos con app activa; limpia estado tras cambio de sesión.
- Pantallas `app/documentos.tsx`, `app/index.tsx`, `app/ofertas.tsx`: aviso visible, acceso a renovar y bloqueo UI del interruptor local y aceptación de ofertas de prueba cuando no sea `READY_QA`.
- `driver-staging-runtime.mjs` expone `kycValidityAdapter` solo con `enableKycExpiryStatus:true` explícito. **Default OFF**. No hay push con app cerrada ni ruta HTTPS externa desplegada.
- Pruebas PG: documento que vence, foto reenviada sin verificar, recuperación tras atestación nueva, alerta ≤30 días, no levantar `SUSPENDED`, prohibir SQL desde service_role genérico.
- **CRÍTICO:** aún NO se integró este nuevo KYC completo en **TODOS los caminos de aceptación/asignación G3/G4/G10/G36/G38** como último guard transaccional. El bloqueo de la pantalla es seguridad UX, no sustituye un rechazo del servidor. Ese es el **P0 técnico inmediato del sucesor**.

---

# 07. ESTADO REAL POR CIRCUITO — HECHO, PARCIAL, BLOQUEADO

| Función | Evidencia de código/QA | Qué falta para considerar ENTREGADA |
|---|---|---|
| **KYC Driver registro/carga selfie** | Cámara nativa+Storage SDK privado opt-in, G1/G17/G19, ocho tipos y tests | Montaje real IdP/Storage HTTPS, antivirus, OCR/documento oficial, liveness, cámara en dispositivo, retención, consentimiento y Admin |
| **Autoaprobación de alta** | Motor Node + decisión PostgreSQL owner-only/locks; no despacho comercial | Verificador de fuentes y rostro independientes reales, backend/SQL persistente autorizado, estado de cuenta real |
| **Expiración/renovación/re-habilitación** | Snapshot server-clock, bloqueo QA, alerta visible, revalidación/latest G17, re-habilitación QA por SQL, 4/4 SUCCESS | **Gate transaccional en TODAS ofertas/dispatch**, servidor STAGING accesible, push en app cerrada, restauración comercial autorizada |
| **Viaje AUTO** | G3/G4 + G63/64/65; Cliente B borrador/cotización/booking en QA | Pre-cotización/booking durables, dos apps conectadas a la misma DB, GPS real, cancelación/incidente/soporte y dispositivos |
| **Entrega AUTO/MOTO** | G5/G10 + G66/67 + G68/69/70 sender DTO/proof, CI | Comprobante independiente verdadero, receptor, devoluciones, reconciliación, misma DB/HTTPS y teléfonos |
| **Comercios** | G6/G9/G44/G45 y Cliente B catálogo/carrito/admin QA | Inventario real/merchants, checkout autorizado, preparación/reparto, soporte y conciliación |
| **Chat privado** | G49–G60D, Driver y Cliente B contrato, READ ordenado | Servidor autorizado, dos teléfonos, push real, entrega/lectura comprobadas, reconexión |
| **GPS/navegación y zonas** | G31–G35 QA política/consentimiento, contratos móviles | Permisos/campo, mapas reales, accurate background, zonas aprobadas, fraude |
| **Admin Web/KYC humano** | Panel B, contratos de casos y privilegios en QA | MFA real, Storage/expedientes, revisión/rechazo/apelación, audit trail operativo |
| **SOS/operación/PSP** | Contratos G7/G8/G40 y B pantallas QA | Personas/equipos/contratos, PSP legal, respuesta a emergencias, conciliación |
| **Apps nativas publicables** | Expo web export + typecheck separados | APK/AAB/IPA físicos y firmas, pruebas de dispositivo, aprobación Owner |

**RESULTADO GLOBAL:** **NINGÚN** circuito comercial está certificado end-to-end real. CI 4/4 confirma pruebas, no servicio habilitado.

---

# 08. PENDIENTES ORDENADOS — PLAN EJECUTABLE SIN NUEVOS GATES DECORATIVOS

## P0-A — CERRAR EL BLOQUEO POR VENCIMIENTO EN EL SERVIDOR, INCLUSO CON APP CERRADA

1. Leer SQL de mutación/asignación y su test de concurrencia: `apps/mobility-expo/docs/backend/staging_only/G3_*`, `G4_*`, `G10_*`, `G20_*`, `G36_*`, `G38_*`, además del SQL `DRIVER_KYC_*`.
2. Identificar exactamente las funciones SQL que **aceptan oferta AUTO, aceptan courier, asignan slot y despachan**. No depender de `app/ofertas.tsx` ni de `staging-driver-eligibility.mjs` únicamente.
3. En la **misma transacción que altera oferta/asignación**, comprobar estado actual de ocho documentos G17/atestaciones, vigencia del reloj del servidor, sesión G42, identidad Driver, vehículo asignado, suspensión administrativa, zona/seguro/clase. Aplicar bloqueo/locks o estrategia equivalente que evite carrera entre comprobación y commit. Reutilizar G37/G38 y no abrir EXECUTE/DML a service_role/anon.
4. Si documento vencido/caducado/pending/ajenado o proveedor sin confirmación: **rechazo de aceptación y nuevas asignaciones en el servidor**. No invalidar acciones pasadas silenciosamente ni falsear su resultado; gestionar servicios ya en curso con política segura/soporte y auditoría (definir caso).
5. Debe incluir **dos conexiones PostgreSQL16**, Driver A/B diferentes, segundo intento concurrente, sesión revocada, límite de vencimiento, reemplazo mientras acepta, fallo/backout, cuenta suspendida; prueba que la **renovación verificada** vuelve a permitir *elegibilidad QA* sin saltarse G38/comercial NO_GO.
6. Refrescar Driver Inicio/Ofertas/Documentos con respuesta exacta y comprobar que ningún mensaje visual sustituye el fence del backend. Publicar contrato privado para B Admin en issue #9.

**Definición de cierre QA:** las funciones de asignación/aceptación SQL rechazan siempre el conductor expirado, aunque el frontend esté cerrado o un cliente envíe POST directo; el caso renovado exige evidencia independiente y todos los otros gates. 4 workflows SUCCESS en mismo SHA, sin grants peligrosos.

## P0-B — COMPLETAR DE VERDAD LA ALTA Y RENOVACIÓN DOCUMENTAL

1. Integrar `expo-image-picker` y `driver-evidence-camera.ts` **en un build nativo probado**, y proveer instancia autorizada `createDriverSupabasePrivateStorageAdapter` + Auth G42 para `DriverApplicationProviders`. Sin proveedor aprobado, el runtime permanece `null`.
2. Comprobar RLS de bucket owner, subida sin `upsert`, hash MIME real/virus, conservación mínima, cifrado, consentimiento facial, restricciones de visualización, retención y borrado; nunca loggear cédula, selfie, biometría, paths ni URLs.
3. Montar endpoint real y privado `/v1/staging/driver/documents/observe` en **HTTPS STAGING autorizado** con JWT pinneado, sesión revocada, rol Driver, rate, G19 observador; devolver `pending` en recepción, NUNCA `approved` por foto subida.
4. Integrar fuentes verificables de autenticidad/vencimientos y liveness/face matching **con autorización y garantías legales**, con alternativa humana ante falso rechazo.
5. Llevar atestaciones a SQL atómico, último G17 + G42 hasta COMMIT, resultado Driver visible. Renovación verificada cambia a válido; vencimiento/denuncia/reemplazo lo invalida. Probar rollback, duplicidad y una renovación iniciada por una cuenta distinta.
6. **Arquitecto B**, en su PR, implementa cola Admin de excepciones, revisión manual/rechazo, re-subida, apelación, documentación y auditoría con MFA/RBAC; A coordina API y no toca su código.

**Definición de cierre real:** Driver toma/sube ocho evidencias a bucket cifrado desde Android/iOS y recibe resultado verificable de un servidor compartido con persistencia; un caso totalmente válido obtiene autorización documental, un caso no verificable espera revisión humana y un vencido se bloquea. No afirmar ese resultado con fixtures.

## P0-C — VIAJE AUTO CLIENTE→DRIVER COMO FUNCIÓN COMPLETA

- Con B validar DTO y orden: Cliente origen/destino→tarifa server PYG vigente→booking `requestKey` idempotente→dispatch→oferta exclusiva→Driver acepta con comprobante durable→llegada→inicio→fin/cancelación→historial ambos→Admin visibilidad/incidente.
- Revalidar ubicación/zonas/GPS/seguro/KYC justo en la mutación, no por el estado guardado en UI. Tratar POST incierto con original requestKey y recibo.
- Dos cuentas reales autorizadas STAGING, una DB duradera, dos teléfonos y escenarios de desconexión, cambios de conductor, fraude; no inventar GPS/ETA ni cambiar OpenAPI `runtime-wired` sin mount real.

## P0-D — ENVÍOS/CUSTODIA Y RESTO DE PRODUCTO

- Entregas AUTO/MOTO con carga, pickup, prueba real independiente, entrega/retorno, remitente informado vía G68/G69 y reclamaciones. Consumir proof G67 en COMMIT; no confirmar delivery por selfie del conductor.
- Comercios: catálogo/stock real, pedidos/preparación, delivery, sustituciones, farmacias con restricciones, cancelación y soporte. Dinero y PSP solo con autorización.
- Chat Cliente↔Driver por servicio, lecturas realmente visibles y push en móviles; GPS con consentimiento; Admin KYC/zonas/SOS/operación; pagos/comisiones/soporte, 17 launch gates y binarios de dos apps.
- Priorizar **un circuito de punta a punta** antes de abrir otro lote de ficheros que no cierre funcionalidad.

---

# 09. DEUDA, RIESGOS Y POSIBLES REGRESIONES QUE EL SUCESOR DEBE AUDITAR

**KYC/expiración:**
1. El RPC de vencimientos `mobility_stage_kyc_expiry_snapshot_owner_qa` es **owner-only CI**, sin endpoint real accesible desde el teléfono. Su test prueba cambios de estado en una DB PG descartable; **no existe push en background**. El banner local se actualiza cada 60 s con app activa, al abrir/foreground; si está offline debe mostrar aviso de estado desconocido/bloqueado.
2. `kycValidityAdapter` se activa explícitamente con `enableKycExpiryStatus:true`; el runtime de producción/por defecto es `null`. No activar valor por UI sin el backend.
3. `READY_QA`/onboarding previamente aprobado **NO equivale** a `dispatchAuthorized` o a restauración de suspensión administrativa; una renovación nunca debe levantar sanciones de soporte, fraude o seguridad.
4. Todo documento pendiente o más nuevo que el atestado debe bloquear; los ocho tipos son exigidos por el fixture actual. Confirmar política legal por tipo/zona antes de flexibilizar seguro/inspección.
5. La fecha de vencimiento sale de metadatos validados del **servidor/proveedor**, no del dispositivo. Revisar clock skew, operaciones a medianoche y concurrencia exacta con COMMIT; evitar booleanos precalculados que sobrevivan a una expiración.
6. La notificación inmediata al conductor con la app **cerrada** necesita push/scheduler/infra autorizada; un polling cada minuto en app abierta no satisface todavía esa parte del requisito.

**Integración/Auth/SQL:**
7. G17 referencia de archivo recibido ≠ documento legítimo; G19 escáner contractual ≠ antivirus real; `QA_INDEPENDENT_ATTESTOR_NO_MEDIA` ≠ emisor oficial ni proveedor biométrico. No autoaprobar con alegaciones del cliente.
8. El SQL G67 consumo de comprobante, G42 locking de sesión, G64 resultado incierto y G36 slots compartidos deben persistir tras añadir fences KYC. No provocar deadlocks ni abrir grants.
9. G69 definer/caller NOLOGIN nunca puede exponerse como endpoint de emisión abierta ni como `service_role` embebido en React Native; G70 localhost/mock no es HTTPS real.
10. Pantallas pueden ocultar aceptar cuando vencido, pero cliente hostil puede enviar POST; **principal agujero P0** es el rechazo backend en todo despacho.
11. Dos arquitectos y ramas diferentes: no asumir que B consume inmediatamente el HEAD A; PR #8 tiene base A y puede ser históricamente divergente. No mezclar frontends ni hacer force-push.
12. Revisar integridad de rutas de Storage/MIME, buffers de selfie al fallar, permisos cámara/reconexión/consentimiento, Android/iOS y protección del contacto del pasajero.
13. Certificados `Expo web export` no son builds de tiendas ni QA de cámara/GPS en dispositivo; pruebas Node y PostgreSQL por separado no prueban flujo operativo conjunto.
14. No inventar un empleo automático comercial solo por detectar documento renovado: si estaba `SUSPENDED` o hay otro requisito comercial vencido, continúa bloqueado.
15. El archivo [`DRIVER_KYC_SELFIE_AUTOAPPROVAL_FUNCTIONAL_SCOPE_2026-10-24.md`](../architecture/DRIVER_KYC_SELFIE_AUTOAPPROVAL_FUNCTIONAL_SCOPE_2026-10-24.md) contiene una sección histórica de brechas **anteriores a las integraciones posteriores** de cámara/Storage; preferir ESTE handoff y HEAD actual para el estado más reciente.

**Negocio/entorno:**
16. Sin IdP/JWKS remotos aprobados, hostname TLS, DB persistente, proveedor Storage/KYC y autorización de tratar PII, no se pueden hacer pruebas de calle ni dar cuentas reales de alta.
17. El frontend Admin B debe revisar excepciones con MFA/AAL2 y RBAC/roles; no permitir que un browser apruebe falsamente o lea un bucket ajeno.
18. Cobertura de zonas no significa disponibilidad; moto no transporta pasajeros; catálogo farmacias solo rubros permitidos. Tarifas y comisiones en servidor, no en móviles.
19. El recuento de commits es trazabilidad, jamás KPI de finalización. La matriz de funciones es la fuente de avance, con **prueba y entorno**.
20. Evitar doble commit al recuperar error; si un HTTP timeout ocurre tras una mutación, obtener recibo original/reconciliación antes de repetir. En KYC upload, recibir `pending` no implica validación biométrica.

---

# 10. 17 GATES DE LANZAMIENTO: FOTOGRAFÍA REAL NO_GO

Fuente soberana: [`docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json`](../architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json).

| Gate | Responsable | Estado al corte |
|---|---|---|
| `IDP_BACKEND_AUTH` | A | BLOCKED |
| `HTTPS_BACKEND` | A | BLOCKED |
| `POSTGRES_PERSISTENCE` | A | QA_ONLY |
| `DRIVER_ONBOARDING` | A | BLOCKED |
| `DRIVER_LIVE_TRIPS` | A | BLOCKED |
| `CLIENT_LIVE_BOOKINGS` | B | BLOCKED |
| `PAYMENT_SETTLEMENT` | A/B | BLOCKED |
| `PRIVACY_KYC` | A/B | BLOCKED |
| `EMERGENCY_SAFETY` | A/B | BLOCKED |
| `MAPS_GPS_DEVICE` | A/B | BLOCKED |
| `DELIVERY_MERCHANTS` | A/B | BLOCKED |
| `CHAT_PHYSICAL` | A/B | QA_ONLY |
| `ADMIN_OPERATIONS` | B | BLOCKED |
| `NATIVE_RELEASES` | A/B | BLOCKED |
| `LEGAL_COMPLIANCE` | Owner | BLOCKED |
| `OPS_24_7_MONITORING` | Owner/A/B | BLOCKED |
| `PROD_GO_NOGO` | Owner | BLOCKED |

**Total:** **15 BLOCKED + 2 QA_ONLY, 0 de 17 PASS comercial.** B mantiene matriz adicional de **20 recorridos comerciales: 0 certificados E2E**. No modificar estados sin evidencias independientes; NO_GO hasta aprobación Owner.

---

# 11. PRUEBAS Y PROCEDIMIENTO EXACTO PARA CONTINUAR EN NUEVO CHAT

## 11.1 ARRANQUE SIN PREGUNTAS INNECESARIAS
1. Consultar **último HEAD** de PR #7/PR #8 en GitHub, rama y DRAFT; consultar issue #9, este documento y handoff B R1–R66/F1. Este SHA es un corte, no una prohibición de seguir avanzando.
2. Leer archivos `DRIVER_KYC_EIGHT_DOCS*`, `DRIVER_KYC_EXPIRY*`, `server/driver-kyc-*`, `server/g17-* / g19-*`, `driver-staging-runtime.mjs`, `driver-kyc-expiry.mjs`, `DriverKycExpiryProvider.tsx`, `app/ofertas.tsx` y `app/documentos.tsx`.
3. Ir directo al **P0-A**: localizar las mutaciones G3/G4/G10/G36/G38; incorporar la comprobación de vigencia de los ocho documentos en COMMIT antes de aceptar/asignar/despachar. No empezar con otro handoff o renombrar G72 por sí mismo.
4. Añadir tests PG16 reales (dos conexiones, reversión, expiración, carga de renovación, revocación), Node y Driver; corregir fallos hasta 4/4 SUCCESS **en el mismo SHA**, con ACTA en issue #9.
5. Inmediatamente continuar P0-B y AUTO según autorizaciones disponibles, sin esperar instrucciones repetidas. Si IdP/Storage externo está bloqueado, seguir pruebas locales/de seguridad de las partes que sí pueden cerrarse; reportar el bloqueo exacto.
6. Mantener ramas A/B aisladas y abrir/priorizar PR DRAFT, jamás merge sin orden.
7. Reportar al Owner con **función entregada, recorrido comprobado, entorno, evidencia del mismo SHA, qué aún no está completo y siguiente acción real**. No resaltar conteos de commits como logro.

## 11.2 Comandos verificados del repositorio, cuando exista checkout Node 22
```bash
# Backend/Expo dominio (no opera infraestructura real)
cd apps/mobility-expo
npm install --no-audit --no-fund
npm run check
cd server && node --test *.test.mjs

# Driver independiente
cd apps/movete-driver
npm install --ignore-scripts --no-audit --no-fund
npm run check
npx expo export --platform web

# Cliente solo lectura/test de separación por A. Código B sólo B.
cd apps/movete-cliente
npm install --ignore-scripts --no-audit --no-fund
npm run check
npx expo export --platform web

# Boundaries y lanzamiento, desde raíz
node scripts/check-mobile-boundaries.mjs
node --test scripts/check-movete-launch-gates.test.mjs
node scripts/check-movete-launch-gates.mjs --json
node scripts/check-movete-launch-gates.mjs --require-go
# El último debe fallar mientras haya NO_GO comercial.
```

**PostgreSQL16 QA:** ejecutar **solo** workflow [`.github/workflows/mobility-g4-postgres-disposable.yml`](../../.github/workflows/mobility-g4-postgres-disposable.yml), con DB `qore_disposable_chain`, `PGHOST=localhost`, `application_name=qore_ci_disposable_chain`; **jamás lanzar scripts `*_CI_ONLY` en Supabase/base real**.

**Workflows A:** PostgreSQL disposable, STAGING Node contracts, Expo isolated, Movete Facil two app isolation. **Workflows B:** ownership boundary, Admin web QA, two app isolation sobre SHA B. No combinar SHAs distintos ni afirmar certificación nueva sobre documentación cuando no se corrieron workflows.

## 11.3 ACCIÓN SI ALGO FALLA
- **Error de test, schema, migración, typado, carrera, contrato:** leer los logs GitHub, corregir y repetir. **No es bloqueo real; continuar.**
- **Falta proveedor externo (IdP/Storage/biometría/certificado) o permiso legal:** suspender SOLO esa conexión real; seguir codebase/QA seguros, especificar autorización exacta necesaria. No crear VPS ni enviar datos personales por iniciativa propia.
- **Choque con B:** respetar ownership, comunicar en issue #9, continuar archivo A independiente. No merge/rebase forzado.
- **Bloqueo de seguridad de PII/cobros/producción:** no simular habilitación, no despliegue; documentar NO_GO y continuar otra función segura.

---

# 12. INSTRUCCIÓN DIRECTA PARA COPIAR EN EL SIGUIENTE CHAT

> **Soy el sucesor Arquitecto A de QORE Mobile — Movete Fácil.** Abrí el Handoff Maestro `docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G70_KYC_RENOVACION_CONTINUIDAD_2026-10-24.md` y releé PR #7 DRAFT, PR #8 DRAFT, issue #9 y handoff B R1–R66/F1. **Trabajá en GitHub de inmediato, sin preguntas repetidas y sin detenerte salvo un bloqueo real de la acción concreta**. Cumplí la prioridad Owner: **funciones completas y certificadas antes que commits**. Primero cerrá el bloqueo transaccional de aceptación/asignación AUTO+DELIVERY cuando cualquiera de los ocho documentos Driver haya vencido, sido reemplazado, sea inválido o esté pendiente; incluí suspensión administrativa, 2 conexiones y restauración automática solo tras verificación independiente. Ya existen SQL KYC, latest G17, selfie, cámara Expo 57, Storage privado opt-in, consulta vencimiento/avisos y 4/4 QA en `2685e478c606a3b2335a90920965460c7e3ddb41`. **Eso todavía no equivale a app real terminada.** Continuá con IdP/HTTPS/Storage/STAGING/dispositivos solo cuando haya autorización para esos recursos; si faltan, avanzá otra integración QA segura y dejá el bloqueo especificado. **NO MERGE, NO LIVE, NO DEPLOY, NO VPS, NO PSP, NO PII real, NO editar áreas B.** Reportá funciones, no cifras de commits.

---

# 13. CONCLUSIÓN DE TRANSFERENCIA

- El **último trabajo nuevo funcional** es el sistema QA de **bloqueo automático al vencimiento, aviso en Driver y recuperación tras renovación verificada**; el SHA `2685e478c606a3b2335a90920965460c7e3ddb41` obtuvo **4/4 SUCCESS**.
- La deuda más crítica y accionable SIN proveedores externos es el **enforcement SQL dentro de TODAS las mutaciones de aceptación, asignación y despacho**, no solo la UI.
- La deuda de integración externa sigue explícita: HTTPS/IdP/Storage/documental+facial, notificación push fuera de app, teléfonos físicos, Admin/operación/legales/PSP; sin autorización para dichas acciones no ejecutarlas.
- Se prohíbe confundir resultado QA o “READY_QA” con “cuenta conductor habilitada comercialmente”.
- El siguiente arquitecto **debe continuar sin pausas**, con mínima fricción, corrigiendo CI y cerrando circuitos comprobables, no abriendo etapas artificiales.

**Fuente final:** GitHub. **PR #7 DRAFT + PR #8 DRAFT. NO_GO comercial.**
