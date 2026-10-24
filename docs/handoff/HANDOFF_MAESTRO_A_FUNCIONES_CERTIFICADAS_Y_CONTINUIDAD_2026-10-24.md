# QORE Mobile — Movete Fácil
# HANDOFF MAESTRO INTEGRAL DEL ARQUITECTO A
## Continuidad G0–G70, KYC, selfie, bloqueo por vencimientos y prioridades para completar la aplicación
**Corte verificado:** 24 de octubre de 2026. **Repositorio:** https://github.com/mezas3238-hue/Qore-mobile- (guion final).

**DIRECTIVA DEL OWNER:** continuar el desarrollo sin detenerse salvo bloqueo real de una acción específica. Priorizar entregar funciones completas y certificadas, **no aumentar commits**. Una falla corregible de CI no es un bloqueo real. Si falta autorización para proveedor externo, datos reales o despliegue, documentar solo esa dependencia y avanzar en otra tarea QA autorizada. No volver a pedir instrucciones respondidas.

**PROHIBICIONES:** NO MERGE, NO LIVE, NO DEPLOY, NO VPS, NO SQL remoto, NO PSP/pagos reales, NO uso de PII/biometría real en QA, NO secretos ni push/SMS reales sin orden, NO publicar binarios ni editar las carpetas del Arquitecto B. PR abiertos DRAFT.

---

## 0. Fuente de verdad y foto actual de GitHub

- Repo: https://github.com/mezas3238-hue/Qore-mobile-
- **A:** rama feature/mobility-monorepo-isolated-20261016, [PR #7](https://github.com/mezas3238-hue/Qore-mobile-/pull/7), base main, DRAFT, no merge.
- **B:** rama feature/mobility-cliente-admin-parallel-20261022, [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8), base rama A, DRAFT, no merge.
- Coordinación técnica: [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).
- Último **SHA funcional** A: **2685e478c606a3b2335a90920965460c7e3ddb41**, 4/4 SUCCESS QA.
- HEAD B observado: **ac7ad3561972e28ddd3b428ba14038fe627f7fdc**, 3/3 SUCCESS QA propia.
- A tenía 761 blobs Git en el corte, árbol no truncado. Es auditoría, no avance de producto.
- Estado comercial: **NO_GO**. Matriz canónica [G61 17 gates](../architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json) sin evidencia integral; B mantiene 20 recorridos comerciales sin E2E real certificado.
- **Importante:** el commit del handoff es documental, posterior al SHA funcional. **Nunca atribuir el 4/4 del código anterior al nuevo SHA documental** sin comprobar workflows propios.

### Historia obligatoria para el sucesor
- [Handoff A G0–G66, 463 líneas](./HANDOFF_MAESTRO_ARQUITECTO_A_G0_G66_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md): historial técnico exhaustivo G0–G66.
- [Handoff A G0–G58E](./HANDOFF_MAESTRO_ARQUITECTO_A_G0_G58E_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md) y handoffs G55/G48/G42/G36.
- [Anexo histórico G58E→G66](./ANEXO_A_G58E_A_G66_175_COMMITS_2026-10-24.md), [inventario G66](./ANEXO_A_G66_INVENTARIO_709_ARCHIVOS_SHA_2026-10-24.md): son cortes históricos, no HEAD actual.
- [Último Handoff maestro B R1–R66 + F1](../architect-b/HANDOFF_MAESTRO_ARQUITECTO_B_R1_R66_F1_PRIORIDAD_FUNCIONES_CERTIFICADAS_2026-10-24.md), 398 líneas; B continúa en paralelo.

---

## 1. Requisitos soberanos del producto

**Movete Fácil**: movilidad y logística en Paraguay. Objetivo de experiencia superior a Bolt/Uber (no hay benchmark comercial certificado). Dos apps nativas Expo **completamente independientes**: Driver para conductor/repartidor, Cliente para pasajero/remitente/comprador. Tercera superficie Admin WEB. El directorio histórico apps/mobility-expo corresponde a infraestructura/backend compartido de A, NO a una tercera app Driver.

Servicios aprobados: viajes de pasajeros en **AUTO**; envíos particulares/comerciales por AUTO o MOTO de carga; supermercados, farmacias de categorías permitidas, restaurantes y otros. **MOTO PASAJEROS NO AUTORIZADO**. Tarifas y comisiones en Gs/PYG calculadas en servidor, diferenciadas por vehículo, servicio y zona; nada de pagos reales sin PSP aprobado.

Cliente↔Driver/repartidor con chat privado durante servicio vigente. Seguridad/ubicación GPS consentida y servicio SOS con humanos solo cuando exista operación real. La zona cubierta no equivale a disponibilidad de conductores. **Sin límite global de 50 usuarios/registros** (50 solo puede ser tamaño de página). KYC documental centralizado y protegido, nunca documento privado como estado público de app. Lovable únicamente para interfaz final sin rehacer backend.

### Estados de certificación que NO deben confundirse
1. **CODIGO/CONTRATO**: SQL, adaptador, UI, esquema, OpenAPI.
2. **QA_PASS**: pruebas automatizadas locales, PostgreSQL16 desechable, Node, Expo, JWT/test doubles.
3. **STAGING_E2E_PASS**: mismo IdP real autorizado, servidor HTTPS, DB persistente, Cliente y Driver con mismo servicio/estado.
4. **DISPOSITIVO_PASS**: Android/iOS físicos con permisos, cámara, GPS, push, offline/ACK.
5. **COMMERCIAL_GO**: 17 gates, privacidad/legal/seguro/soporte/PSP si aplica, decisión expresa Owner.

**Lo que existe ahora llega a QA para las funciones citadas, NO a STAGING_E2E ni GO comercial.**

---

## 2. Fronteras absolutas Arquitecto A y Arquitecto B

| Ruta / responsabilidad | Arquitecto A | Arquitecto B |
|---|---|---|
| apps/mobility-expo/** backend SQL Node Auth OpenAPI | ESCRIBE | consume contratos |
| apps/movete-driver/** Expo Driver | ESCRIBE | no editar |
| apps/movete-cliente/** Expo Cliente | no editar | ESCRIBE |
| apps/movete-admin/** Admin Web | no editar | ESCRIBE |
| docs/architecture/** y docs/handoff/** | ESCRIBE | solo lectura |
| docs/architect-b/** | no editar | ESCRIBE |
| workflows y scripts compartidos | A edita con coordinación | B coordina |
| issue #9 | informar código, contratos, pruebas y bloqueos | informar consumo y diferencias |

PR #8 tiene de base una revisión de A que puede estar atrasada. No rebasar/mergear/forzar HEAD de B. Actualizar issue #9 con contratos precisos. Los dos arquitectos trabajan en paralelo sin pisarse.

---

## 3. Historia G0–G66 ya implementada y probada en QA — no rehacer

### G0–G22
- G0 repo/ramas/CI/ambientes y aislamiento de apps.
- G1 PostgreSQL/RLS/Auth sintética, esquemas y políticas privadas.
- G2 Driver/vehículo, licencias, seguros, inspección, AUTO/MOTO.
- G3/G4 AUTO solicitud/búsqueda/ofertas/aceptación/llegada/inicio/fin, idempotencia, event ledger, doble aceptación.
- G5 envíos AUTO/MOTO, límites de carga, pickup/deliver/return/dispute/proof.
- G6 comercio/stock/catálogo/preparación.
- G7 tarifas PYG y comisiones contables QA, sin PSP.
- G8/G9 incidentes/SOS/auditoría y alta de comercios.
- G10–G15 courier dispatch, outbox push, fencing, carrera dos repartidores y polling alternativo. No proveedor push real.
- G16/G17 bandeja Driver y KYC metadata privado.
- G18 rol exclusivo Driver y bloqueo Passenger+Driver dual.
- G19/G20 observación de documentación y vigencia de licencia/vehículo.
- G21/G22 navegación Driver y Auth STAGING fail-closed.

### G23–G48
- G23–G26 historial/cursor/keyset/MVCC/paginación sin límite global.
- G27–G30 Owner/Admin RBAC, KYC, incidentes, auditoría con ámbitos.
- G31 zonas/municipios, cobertura vs disponibilidad.
- G32–G35 GPS consentido, cuarentena/replay/fraude, licencia y vehículo.
- G36 slot atómico único por Driver AUTO/DELIVERY (dos conexiones).
- G37/G38 fences DML transaccionales y bloqueo LIVE sin autorización.
- G39–G41 incidentes/soporte/recibos/Admin.
- G42/G43 JWT firmados pinneados, proveedor/sesión verificados, revocación bajo lock SQL, AAL2 Admin.
- G44/G45 catálogos, sucursales, stock/reservas atómicas buyer.
- G46–G48 SQL mínimo privilegio, evidencia KYC, tickets opacos de lectura.

### G49–G66
- G49–G53 chat privado, SEND idempotente, inbox/historia/ACK.
- G54–G57 marcadores READ contiguos por mensaje efectivamente visible, no por notificación.
- G58–G58F pruebas JWT/local HTTP, Host/cookie/origen, token opaco de uso único.
- G59/G59B recuperación READ-ONLY de SEND tras timeout, sin segundo mutador ciego.
- G60A–D Driver chat y gateway SQL mínimo/HTTP local.
- G61 17 gates NO_GO y SDK HTTPS opt-in; G62 runtime Driver autenticado unificado, por defecto deshabilitado.
- G63/G64 accept/decline privado AUTO/DELIVERY y recuperar recibo original después de COMMIT incierto.
- G65 Driver lifecycle AUTO accepted→arriving→in_progress→completed y pantalla de viaje QA.
- G66 Driver delivery pickup→delivered/return/dispute con prueba independiente obligatoria y pantalla de custodia QA.

**La documentación detallada G0–G66 mantiene SHA, SQL, criterios, fallos y pruebas de cada etapa. No repetir esos 66 bloques solo para sumar commits.**


---

## 4. Nuevos trabajos ejecutados tras G66: custodia de entregas y lectura Cliente

### G67 — comprobante de entrega atómico en SQL (QA)
**Debilidad cerrada:** G5 admitía proofRef UUID no nulo sin verificar que pertenecía a una evidencia autorizada; un callback previo Node no bastaba frente a RPC legado y carreras.

**Hecho:**
- G67_DELIVERY_PROOF_ATOMIC_FENCE_POSTGRES_CI_ONLY.sql + ASSERT crean registro de evidencia sintética estrictamente privado, RLS, propietario, actor/entrega, hash, MIME, tamaño, sesión G42, vigencia, revocación y consumo único.
- Trigger mobility_stage_g67_proof_at_commit ante picked_up→delivered bloquea comprobante y sesión bajo el mismo COMMIT G5. Consume prueba, registra evento, libera slot o revierte todo si hay conflicto.
- Revocar y sustituir evidencia no reactiva el UUID antiguo.
- Python g67-delivery-proof-atomic-race-ci.py ensaya 2 conexiones PostgreSQL16, falsificación, sesión revocada, replay, rollback; Node g67-courier-proof-authority-qa.mjs y tests deniegan actor ajeno/PII.
- [Informe G67](../architecture/G67_DELIVERY_PROOF_ATOMIC_CUSTODY_POSTGRES_QA_2026-10-24.md).
- **4/4 QA SHA d4950cf21e8b37aa01ae3da7434842f29087ce5e:** [PG #786](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40118170554), [Node #1204](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40118170468), [Expo #1904](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40118170437), [aislamiento #1658](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40118170480).
- **FALTA:** evidencia de foto/recepción real en Storage cifrado, receptor/consentimiento, firma, antifraude y retención; QA_SERVER_ATTESTED_NO_CONTENT no acredita entrega física.

### G68 — estado privado remitente de un envío
- SQL G68_SENDER_OWNED_DELIVERY_READ_POSTGRES_CI_ONLY.sql + ASSERT, server/g68-sender-custody-status-qa.mjs/repository/tests.
- JWT y G42 rol Passenger exclusivo; filtros deliveryId+sender_id; verificación G67 para estado terminal, DTO SELLADO de 11 campos sin proofRef, courierId, teléfono, GPS o dato ajeno.
- B R65/R66 implementó gateway HTTPS opt-in y estado monotónico. G68 certificado QA 4/4 en corte anterior a G69. No asumir servidor HTTPS montado.

### G69 — delegación SQL mínima para remitente
- SQL G69_SCOPED_SENDER_CUSTODY_EXCHANGE_POSTGRES_CI_ONLY.sql y ASSERT: roles NOLOGIN definer/execute, prueba opaca hash SHA256 con TTL máximo 12 segundos y consumo único, sin grants de mint ni acceso directo a owner.
- Python g69-sender-custody-scoped-read-race-ci.py: carreras 2 sesiones, expiración, Passenger ajeno y revocación G42. Node g69-trusted-sender-read-qa.mjs/test.
- OpenAPI GET /v1/staging/sender/deliveries/{deliveryId}/custody, 11 campos exactos B, x-qore-runtime-wired:false. No ruta pública de mint.
- [Informe G69](../architecture/G69_MIN_PRIVILEGE_SENDER_CUSTODY_SQL_EXCHANGE_QA_2026-10-24.md).
- **4/4 QA SHA 134a35b2d9e4d46ba2bebd0b993d9227cc22db78:** PG #802, Node #1225, Expo #1931, aislamiento #1693.

### G70 — JWT firmado y GET HTTP real LOCAL
- g70-pinned-sender-local-chain-qa.mjs integra JWS ES256 firmado de laboratorio, proveedor JWT/JWKS pinneado, sesión G42 Passenger y autoridad G69.
- g70-sender-custody-loopback-qa.mjs monta GET solo 127.0.0.1; prohíbe cookies, Origin/Host ajenos, rutas/cuerpos/métodos alternativos; timeout con resultado incierto sin retry ciego.
- Test HTTP con firma real en proceso QA, dos usuarios, JWT alterado/revocado, datos de otro Driver, respuesta maliciosa. SQL G69 y HTTP G70 fueron ensayados por separado (HTTP usa doubles, no la misma PostgreSQL remota).
- [Informe G70](../architecture/G70_PINNED_PASSENGER_HTTP_LOCAL_CHAIN_QA_2026-10-24.md).
- **4/4 QA SHA a63620031cfe9dd6f96db266e97a85c90e9a995f:** PG #809, Node #1238, Expo #1944, aislamiento #1709.
- **FALTA:** IdP real, HTTPS STAGING remoto autorizado, un mismo PostgreSQL persistente enlazado, dos dispositivos y pruebas de entrega calle.

---

## 5. Nueva prioridad desarrollada: ALTA DRIVER con ocho documentos y FOTO DEL ROSTRO

### 5.1 Requisito Owner / negocio
Documentación requerida desde app Driver: licencia o registro de conducir, cédula identidad frente y dorso, cédula verde del vehículo, habilitación, seguro, inspección y **selfie del rostro**. Aprobación automática **solo** tras comprobar identidad, vínculo conductor/vehículo, autenticidad por fuente confiable, fechas de vencimiento, consentimiento de selfie, presencia real (liveness) y coincidencia con cédula. Una foto subida NO es aprobación. Inconsistencia → revisión humana y mecanismo de corrección/apelación. Protección estricta de biometría/PII.

### 5.2 Validador de las ocho evidencias
- server/driver-kyc-auto-approval-qa.mjs + tests: esquema exacto de ocho clases, última identidad/vehículo, autenticidad/issuer/fecha, consentimiento, liveness y comparación facial de proveedor.
- READY_FOR_ATOMIC_APPROVAL es **solo** requisito previo; siempre accountApproved:false, driverEligible:false.
- Deniega selfie ausente, liveness incorrecto, documento falso/vencido, vehículo ajeno, sesión revocada, doble rol o proveedor indisponible.
- **4/4 QA SHA 6f04e56b089db360012e6f317bd05f0063fd455f:** PG #811, Node #1242, Expo #1948, aislamiento #1723.

### 5.3 Aprobación en transacción SQL con documentos actuales
- DRIVER_KYC_EIGHT_DOCS_ATOMIC_ONBOARDING_POSTGRES_CI_ONLY.sql y ASSERT.
- Tabla mobility_stage_kyc_verified_evidence_qa asocia una evidencia validada a source_document_id del **último registro G17 de ese tipo y conductor**, no a un UUID cualquiera. Foto reemplazada invalida aprobación anterior.
- RPC owner-only mobility_stage_kyc_atomic_approve_owner_qa revalida rol exclusivo Driver, sesión G42 con lock, vehículo asignado, ocho pruebas bajo locks, fechas y requestKey idempotente.
- Registra solo QA_ONBOARDING_APPROVED_NOT_COMMERCIAL. mobility_stage_kyc_current_onboarding_owner_qa recalcula vigencia actual; la aprobación histórica NO es autorización perpetua.
- server/driver-kyc-onboarding-command-qa.mjs + tests: lector autenticado de atestaciones independientes y POST SQL. COMMIT perdido no autoriza reintento falso.
- **4/4 QA SHA 7f23c635ad511c886de7b768581cdc46615a5559:** [PG #822](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40124216881), [Node #1255](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40124216922), [Expo #1968](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40124216941), [aislamiento #1774](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40124216913).
- **FALTA:** aprobador real conectado a proveedores y DB remota autorizada; estas migraciones están marcadas POSTGRES_CI_ONLY.

### 5.4 Soporte de ocho clases G1/G17/G19 y estados Driver
- G1_PRIVATE_DOCS_BUCKET_STAGING_ONLY.sql: paths privados de ocho clases JPEG/PNG, RLS owner; no bucket real habilitado.
- G17_PRIVATE_DRIVER_DOCUMENTS_POSTGRES_CI_ONLY.sql: enum incluye rostro_selfie, identidad/vehículo/licencia/seguro/inspección/habilitación, metadata document_id propio; registro inicia pending (no verificado).
- server/g17-driver-document-gateway.mjs, repository y tests: JWT/actor/rol, objectKey propio, comprobación Storage independiente antes de registrar.
- server/g19-private-driver-evidence-observer.mjs y tests: path owner, versión, bytes/mime, SHA256 y escaneo obligatorio. Reconstruido desde archivo original luego de detectar reemplazo de texto fallido.
- apps/movete-driver/src/domain/driver-documents.mjs y driver-workspace.mjs: aceptan los ocho estados; app/documentos.tsx los muestra.
- **4/4 QA SHA 59f7306e6cb723d3222b8085a2602ed142fa6b9c:** [PG #829](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40134176503), [Node #1267](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40134176549), [Expo #1982](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40134176546), [aislamiento #1794](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40134176523).

### 5.5 Cámara nativa y subida privada
- src/native/driver-evidence-camera.ts, Expo image-picker 57 y app.json con permisos explícitos: selfie **solo cámara** y consentimiento; otros documentos cámara/galería.
- src/domain/driver-base64-image.mjs + tests: decodificación acotada. src/domain/driver-document-upload.mjs + test: JPEG/PNG <=5MiB, owner path, sesión Driver, subida privada, segunda comprobación de sesión, POST G17 observe, recibo solo pending-review. Elimina bytes de cámara al terminar o fallar, no reintenta mutador ante ACK incierto.
- src/domain/driver-storage-supabase-adapter.mjs + tests: bucket privado mobility-staging-driver-evidence, sin service_role/URL pública, upsert=false, ruta owner, mismo JWT.
- DriverDocumentUploadProvider.tsx, driver-staging-runtime.mjs y app/documentos.tsx: botones y estado con opt-in, captureEvidence y uploadPrivateObject **ambos o ninguno**; por defecto null y sin subida real.
- **4/4 QA SHA 37d8c5b772824d8af9b5e18b845b6a547e350f88:** [PG #837](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40135171119), [Node #1275](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40135171115), [Expo #1990](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40135171121), [aislamiento #1814](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40135171114).
- **FALTA:** conectar SDK de Auth/Storage/escáner externos autorizados y probar cámara/dispositivos físicos. Ninguna imagen personal real se recibió ni se aprobó comercialmente.
