# QORE MOBILE — MOVETE FÁCIL
## HANDOFF MAESTRO INTEGRAL ARQUITECTO A — G0–G66
### Historia verificada, código entregado, bloqueos y continuidad autónoma sin pausas

**Corte funcional certificado:** 24 octubre de 2026, SHA `4232ff32a7432a7a8006ebd4dbfb018c9e9ab62f`.
**Repositorio soberano:** https://github.com/mezas3238-hue/Qore-mobile- (**con guion final**).
**Arquitecto A:** rama `feature/mobility-monorepo-isolated-20261016`, [PR #7](https://github.com/mezas3238-hue/Qore-mobile-/pull/7) **DRAFT, NO MERGED**.
**Arquitecto B:** rama `feature/mobility-cliente-admin-parallel-20261022`, [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) **DRAFT, NO MERGED**; HEAD B observado `19149c7ca3ebeec4f3fe807778a715e0d15b867f`. B puede seguir avanzando: siempre volver a leer PR #8.
**Coordinación oficial:** [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).
**PR #7 observado:** 1.099 commits, 708 archivos cambiados contra `main`, HEAD G66 SHA arriba. **Inventario exacto:** 709 blobs y 37 directorios (746 entradas), árbol Git completo con `truncated=false`; sus dos nuevos anexos y este handoff son commits posteriores y se verifican aparte.
**Decisión comercial:** **NO_GO**. El código QA no habilita producción: 0 de 17 gates comerciales verificados, 15 `blocked` y 2 `qa-only` en manifiesto G61.

> **MANDATO DEL OWNER:** continuar construyendo y certificando Movete Fácil **sin detenerse, sin solicitar confirmaciones repetidas**, salvo cuando exista un **bloqueo real de la acción específica**. Leer GitHub, escribir código en rama A, corregir CI, añadir tests, publicar pruebas, documentar y pasar al siguiente bloque. Si una actividad requiere autorización externa no dada, **bloquear esa actividad, registrar su dependencia y avanzar con otra tarea autorizada de QA**. No interpretar la ausencia de hosting/PSP/IdP como prohibición de continuar el código seguro y sus pruebas.

> **RESTRICCIONES INALTERABLES:** **NO MERGE, NO LIVE, NO DEPLOY, NO VPS, NO SQL REMOTO, NO PSP ni pagos reales, NO PII/KYC real en QA, NO secretos en repositorio ni mensajes, NO push o SMS reales, NO firmar/publicar APK/AAB/IPA, NO forzar merge/rebase de B, NO tocar carpetas B** sin orden expresa del Owner. Los PR permanecen DRAFT. Una prueba `4/4 SUCCESS` prueba solamente el alcance de QA del mismo SHA, NO una aplicación comercial terminada.

---

# 01. EMPEZAR POR AQUÍ: FUENTES Y EVIDENCIAS

1. **Este handoff** es el índice más reciente del Arquitecto A G0–G66. No usar el plan G58F del handoff anterior; ya se ejecutó.
2. [Handoff exhaustivo A G0–G58E](./HANDOFF_MAESTRO_ARQUITECTO_A_G0_G58E_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md) — 617 líneas, historial G0–G58E con decisiones, SQL, Node, CI, fallos y correcciones. Se incorpora por referencia como fuente histórica obligatoria, sin duplicar literalmente sus 617 líneas.
3. [Handoff A G0–G55](./HANDOFF_MAESTRO_ARQUITECTO_A_G0_G55_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md) y [handoff G0–G48](./HANDOFF_MAESTRO_ARQUITECTO_A_G0_G48_CONTINUIDAD_2026-10-23.md), más handoffs G0–G42/G0–G36.
4. **NUEVO — 175 commits G58E→G66:** [Anexo con los 175 SHA completos, fecha y asunto](./ANEXO_A_G58E_A_G66_175_COMMITS_2026-10-24.md). Comparación REST verificada `842143d2d82e03c7c10041051341f3daa643f783...4232ff32a7432a7a8006ebd4dbfb018c9e9ab62f`: `ahead_by=175, behind_by=0, total_commits=175`, dos páginas 100+75 y último SHA coincidente.
5. **NUEVO — inventario HEAD G66:** [709 rutas, tamaños y blob SHA](./ANEXO_A_G66_INVENTARIO_709_ARCHIVOS_SHA_2026-10-24.md), árbol de 746 entradas sin truncamiento. Este inventario documenta **el corte funcional previo a los anexos**, no el HEAD documental posterior.
6. [Anexo G55→G58E de 107 commits](./ANEXO_A_G55_A_G58E_107_COMMITS_2026-10-24.md), [inventario G58E 621 blobs](./ANEXO_A_INVENTARIO_ARCHIVOS_HEAD_G58E_2026-10-24.md), [inventario 566 blobs G55](./ANEXO_A_G55_INVENTARIO_566_ARCHIVOS_SHA_2026-10-24.md), [inventario 515 blobs G48](./ANEXO_A_INVENTARIO_515_ARCHIVOS_HEAD_G48_2026-10-23.md) y anexo de 714 commits de G48.
7. [División A/B](./DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md). En B, leer `docs/architect-b/HANDOFF_R60_CERTIFICACION_TOTAL_SIN_AMBIGUEDADES_2026-10-24.md`, `CONTINUIDAD_B_R61_CONTRATO_LIFECYCLE_CLIENTE_G65_2026-10-24.md`, `CONTINUIDAD_B_R62_ESTADO_ENVIO_Y_PRUEBA_CUSTODIA_G66_2026-10-24.md` y el nuevo handoff de B que pudiera haberse creado después.
8. **Control de salida soberano:** [17 gates G61 en JSON](../architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json) y `scripts/check-movete-launch-gates.mjs`. **Probar `--require-go`: debe fallar** mientras existan pendientes.
9. [OpenAPI STAGING](../../apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json); muchos contratos son **futuros, no montados**. No deducir que un path OpenAPI es una URL que funciona desde un teléfono.

## 01.1 Último corte funcional G66 — CI 4/4 sobre un solo SHA

| Workflow GitHub | Run exacto | Conclusión |
|---|---|---|
| PostgreSQL16 desechable, cadena/roles/carreras | [#756](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40110756956) | **SUCCESS** |
| Node STAGING contratos adversariales | [#1159](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40110756960) | **SUCCESS** |
| Expo infraestructura, tests y export web | [#1849](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40110756975) | **SUCCESS** |
| Aislamiento Driver/Cliente, TypeScript, domain tests y export | [#1587](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40110756939) | **SUCCESS** |

**SHA certificado en esas cuatro acciones:** `4232ff32a7432a7a8006ebd4dbfb018c9e9ab62f`. **Atención:** este handoff y anexos agregan commits documentales, y los workflows usan filtros de rutas: no declarar 4/4 de un HEAD documental posterior salvo comprobar ejecuciones del mismo SHA. La certificación de funcionalidades sigue anclada al SHA funcional anterior.

---

# 02. PRODUCTO, REQUISITOS Y DECISIONES DEL OWNER

**Movete Fácil**: plataforma de movilidad y logística en Paraguay, activada por municipios/zonas cuando haya autorización legal, soporte y oferta real. Meta de calidad superior a Bolt/Uber es **objetivo comercial**, no benchmarking demostrado.

**Tres productos separados:**
- `apps/movete-driver/**` — una aplicación Expo nativa autónoma para conductores de AUTO y repartidores de carga AUTO/MOTO. Propiedad del Arquitecto A.
- `apps/movete-cliente/**` — una aplicación Expo nativa independiente para pasajeros, remitentes y compradores. Propiedad del Arquitecto B.
- `apps/movete-admin/**` — panel Admin **WEB** separado, propiedad del Arquitecto B.
- `apps/mobility-expo/**` — backend/migraciones/contratos comunes e infraestructura técnica, propiedad de A. Su nombre histórico `mobility-expo` no equivale a una tercera aplicación de conductor ni a un backend desplegado.

**Servicios:** viajes en **AUTO**; delivery/carga particular y comercial en **AUTO o MOTO**; supermercados, farmacias **solo OTC**, restaurantes y comercios adicionales permitidos; chat privado Cliente↔Driver. **MOTO PASAJEROS desactivado** hasta legalidad, seguro, política y orden Owner. No habilitar entrega de fármacos sujetos a receta, alcohol o bienes restringidos por inferencia del catálogo.

**Economía:** tarifas en guaraníes (Gs/PYG) calculadas **solo en servidor**, diferenciadas por servicio, auto/moto/carga, zona y condiciones autorizadas; comisión contable central, sin cálculo monetario decisorio en apps. No activar cobro real sin PSP/finanzas Owner.

**Base de datos:** almacenamiento de documentos KYC **central, protegido y auditable**; la app sólo transporta referencias/snapshots mínimos autorizados. Retención, antivirus, cifrado, firma, borrado y revisión Admin reales aún no certificados. **Prohibido limitar a 50 registros totales**: `pageSize=50/100` es paginación, nunca tope global de usuarios, viajes, órdenes o historial.

**Cobertura ≠ disponibilidad ≠ elegibilidad:** la existencia de una zona, licencia, conductor o tarifa no activa despacho comercial si faltan permisos, vehículo aprobado, ubicación confiable o disponibilidad. Mantener `eligible_by_policy=false` y barreras G31/G38 cuando corresponda.

**Lovable** exclusivamente para interfaz final cuando backend, seguridad y flujos estén certificados. No rehacer Auth, tarifas, RLS, despacho o pagos en Lovable. No introducir sistemas de trading.

---

# 03. DIVISIÓN DE DOS ARQUITECTOS / ZERO COLLISION

| Ruta/área | Arquitecto A (este handoff) | Arquitecto B |
|---|---|---|
| `apps/mobility-expo/**` SQL, Node, API, OpenAPI, seguridad compartida | **Editar** | Leer/consumir contrato |
| `apps/movete-driver/**` (Expo Driver, conductor/repartidor) | **Editar** | No tocar |
| `apps/movete-cliente/**` (Expo Cliente) | No tocar | **Editar** |
| `apps/movete-admin/**` (Admin Web) | No tocar | **Editar** |
| `docs/architecture/**` y `docs/handoff/**` | **Editar** | No tocar |
| `docs/architect-b/**` | No tocar | **Editar** |
| `.github/workflows/**` y scripts raíz comunes | Coordinar y editar con cautela desde A | Observar/solicitar a A |
| [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9) | Publicar contratos, bloqueo y CI | Publicar consumo, pruebas y dudas |

**Importante:** PR B #8 usa como base una revisión de la rama A que puede estar desactualizada frente al HEAD funcional G66. **No** forzar rebase, force-push, merge ni cambio de base sin instrucciones de coordinación explícitas. Las interfaces se coordinan por issue #9; B puede consumir un contrato QA con mocks sin que A edite su código.

**Estado de B leído en GitHub:** HEAD `19149c7ca3ebeec4f3fe807778a715e0d15b867f` al corte, PR #8 DRAFT, trabajos R60 matriz estricta **NO_GO** de 17 gates y 20 circuitos; R61 consistencia de estados AUTO Passenger; R62 adaptador privado de custodia del remitente y 16 tests QA. **R62 pide específicamente a A un endpoint sender-owner con rol Passenger y un comprobante independiente real**. El DTO Driver G66 NO sirve directamente al Cliente.

---

# 04. HISTORIAL DE IMPLEMENTACIONES G0–G22 (YA HECHAS EN QA)

| Gate | Trabajo efectivamente implementado y ensayado | Límite comercial |
|---|---|---|
| **G0** | Monorepo separado, GitHub fuente de verdad, ramas, límites A/B, cuatro CI y ambientes. | No binarios distribuidos |
| **G1** | PostgreSQL roles, RLS, Auth sintética, schema aislado. | No IdP real |
| **G2** | Conductor/vehículo/licencia/seguro/inspección y preflights. | Sin verificación legal real |
| **G3** | Viajes AUTO `searching→accepted→arriving→in_progress→completed`, aceptación/eventos, idempotencia. | No viaje físico |
| **G4** | Ofertas privadas de AUTO, TTL, bandeja, ACK, outbox, polling y concurrencia. | No dispatch calle/push |
| **G5** | Envíos AUTO/MOTO, capacidad peso/volumen, categorías, custodia, pickup/deliver/proof/disputa/devolución, RLS. | No comprobante físico |
| **G6** | Comercio/catálogo/stock/preparación/pedidos y vínculo con reparto. | No inventario real |
| **G7** | Tarifas PYG, comisiones, autorizaciones/ledger sintéticos. | No PSP/banco |
| **G8** | Incidentes/SOS/auditoría/suspensiones como contratos QA. | No equipo emergencia |
| **G9** | Alta y revisión de comercios/sucursales/catálogos sintéticos. | No onboarding real |
| **G10** | Ofertas privadas courier y aceptación exclusiva. | No despacho comercial |
| **G11** | OpenAPI, DTOs y tests de integridad contractuales. | Paths no son APIs montadas |
| **G12** | Outbox notificaciones courier, claim/ACK/retry en PG. | No entrega push al SO |
| **G13** | Lease/fencing para workers push; concurrencia real PG. | No proveedor push |
| **G14** | Dos repartidores compiten: gana uno solo en SQL. | No dos móviles reales |
| **G15** | Polling de ofertas courier como respaldo del push. | No conexión 4G real |
| **G16** | Bandeja privada Driver AUTO/DELIVERY. | No app autenticada real |
| **G17** | Metadatos KYC centralizados y estados administrativos. | No documentos físicos |
| **G18** | Alta rol Driver exclusiva y bloqueo dual Passenger+Driver. | No habilitación laboral |
| **G19** | Contrato de huella/MIME/escáner de evidencias KYC. | No scanner/storage real |
| **G20** | Vigencia de licencia/seguro en preflight SQL. | No registros externos |
| **G21** | UI/navegación Driver inicial sobre contratos. | No app de tienda |
| **G22** | Bridge sesión Driver con logout fail-closed. | No proveedor IdP certificado |

**No rehacer G0–G22**; rutas, commits, decisiones, SQL y pruebas históricas se conservan en handoffs G0–G55 y G0–G58E. Leerlos para depurar o extender.

---

# 05. HISTORIAL G23–G48 — ESCALABILIDAD Y SEGURIDAD (YA HECHO QA)

| Gates | Implementación verificada en histórico | Precaución |
|---|---|---|
| **G23–G25** | Histórico privado de viajes, envíos, tarifas/estados, keyset y contratos de identidad. | Proteger propietario y revisión |
| **G26/G26.x** | Paginación MVCC sin límite global; ensayos >30.000 filas, keyset y carrera. | No imponer tope de 50 |
| **G27–G30** | Separación Owner/Admin, incidentes/KYC/auditoría por cursor y ámbitos. | Owner ≠ KYC Admin |
| **G31/G31.2** | Cobertura y elegibilidad por zona/municipio/servicio; decenas de miles de filas sin tope. | Zona ≠ conductor disponible |
| **G32–G35** | GPS cuarentenado, consentimiento versionado, secuencia, rechazo replay/spoof, salud de licencia y señal. | GPS sintético no autoriza viaje |
| **G36** | Slot atómico compartido de conductor para AUTO y delivery, dos conexiones. | Evitar doble asignación |
| **G37–G38** | Fence DML de estados, eventos inmutables, carrera y política de no aceptación comercial sin requisitos; corrección de locks. | No restaurar DML service_role |
| **G39–G41** | Pruebas criptográficas de oferta, recibos de incidentes, Admin triaje/casos, estado y cursor. | SOS no implica operador |
| **G42** | JWT JWS firmado/pinneado (ES256/RS256/EdDSA), issuer/audience, iat/exp, proveedor de sesión, AAL2 Admin, G42 lock SQL. | Un JWT sintético no es IdP |
| **G43** | Revocación de sesión bloqueada durante COMMIT SQL, carrera real PG y reconcilio de proveedor. | Check antes de COMMIT no basta |
| **G44** | Catálogo/sucursales buyer por cursor HMAC, revisiones/stock y zona, 13.000 items en test sin cap global. | Precio/stock siempre servidor |
| **G45** | Reserva/cancelación de compra buyer con stock atómico, idempotencia y conflictos, sin cobro. | No reservar pago real |
| **G46** | Cierre de grants heredados de comercio, RLS, DML/RPC; preflight HTTPS seguro sin habilitar. | Prohibido reabrir service_role |
| **G47** | Lease evidencia KYC/metadata privados, grants mínimos, auditoría, revisión. | Sin storage/antivirus reales |
| **G48** | Delegación SQL de solo lectura y tickets opacos 30 s, 1 uso, rol NOLOGIN; carrera y revocación. | No exponer mint owner al web |

**Fuentes detalladas:** `docs/architecture/G23...G48`, handoffs G0–G48/G0–G55. Cada tabla de prueba PostgreSQL es sintética y la mayoría de las rutas OpenAPI están desconectadas.

---

# 06. HISTORIAL G49–G58E — CHAT Y PRIVACIDAD (YA HECHO QA)

| Gates | Implementación | Límite |
|---|---|---|
| **G49** | JWT G42 pinneado a capacidades opacas de chat Passenger con rol SQL de menor privilegio. | Emisión fixture owner-only |
| **G50** | Conversaciones privadas por RIDE/DELIVERY/MERCHANT_ORDER, asignación actual, SEND idempotente y body seguro. | No mensajes remotos reales |
| **G51** | Inbox paginado HMAC y unreadCount, lectura monotónica sin tope total. | No viewport |
| **G52** | Historial G52 versionado y keyset, DTO exacto compatible con B. | No agregar `seq` en DTO |
| **G53** | ACK Passenger durable, original requestKey/body/Revision, replay idempotente. | No fabricar ACK |
| **G54–G55** | Tickets INBOX/READ, marker opaco asociado a historial real sin exponer `seq`. | Marker de página ≠ visibilidad |
| **G56/G56B** | Chat SEND/HISTORY/INBOX Driver con rol delegado Driver separado, paginado sin cap. | No IdP real |
| **G56C** | Estado seguro de inbox móvil Driver, logout, paginación y epoch guard. | UI no estaba conectada |
| **G57/G57B** | READ markers por mensaje **en orden contiguo** Passenger y Driver; controles de salto y doble confirmación. | UI debe verificar mensaje visible |
| **G58/G58B** | Integración chat localhost y JWT G42 firmados en pruebas, permisos Passenger/Driver separados. | Solo 127.0.0.1 |
| **G58C/G58D** | Presupuesto de rate/timeout, consultas SQL acotadas, conexiones envenenadas cerradas. | No rate distribuido |
| **G58E** | Hardening HTTP local de host/origen/cookie/headers, proof/ticket fence y resultado COMMIT incierto. | Sin HTTPS comercial |

**Detalle técnico obligatorio:** [G0–G58E](./HANDOFF_MAESTRO_ARQUITECTO_A_G0_G58E_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md), ``21–36. No repetir permisos READ antiguos G54/G55 que fueron revocados cuando G57 corrigió lectura no contigua.

---

# 07. G58F–G60D — MÍNIMO PRIVILEGIO, COMMIT INCIERTO Y CHAT DRIVER (HECHO QA)

## G58F / A46: ticket exchange sin dueño expuesto
- SQL `G58F_MIN_PRIVILEGE_TICKET_EXCHANGE_POSTGRES_CI_ONLY.sql` y ASSERT: roles `mobility_g58f_definer_ci`/`mobility_g58f_exchange_ci` NOLOGIN, tabla con hash SHA-256 de atestación UUID opaca, TTL <=15 s, una sola redención, sesión G42 bloqueada hasta COMMIT.
- Se prohíbe emisor de ticket productivo; la prueba inicial solo la crea el propietario del fixture QA. Node `g58f-qa-ticket-exchange.mjs`, Python de carreras de dos conexiones y pruebas de grants/rol/cambio de sesión.
- [Documento G58F](../architecture/G58F_MIN_PRIVILEGE_QA_ATTESTED_TICKET_EXCHANGE_2026-10-24.md).

## G59/G59B / A47–A48: recuperar SEND Passenger y Driver post-timeout
- Funciones SQL owner-only `mobility_stage_g59_reconcile_passenger_owner_qa` y `mobility_stage_g59b_reconcile_driver_owner_qa` consultan el ACK por misma conversación, actor, requestKey y cuerpo. Nunca reinsertan ni reescriben la revisión original.
- `NOT_YET_OBSERVED` implica resultado **indeterminado, retrySafe:false**, jamás permiso para segundo SEND. `COMMITTED` exige el recibo persistido original de G53/G56; si hay revisión posterior, `historyRefreshRequired`.
- Tests Node adversariales, Python PostgreSQL real 2 sesiones y control de revocación/reasignación/roles/grants.
- [G59](../architecture/G59_UNKNOWN_COMMIT_CHAT_RECONCILIATION_QA_2026-10-24.md), [G59B](../architecture/G59B_DRIVER_UNKNOWN_COMMIT_RECOVERY_QA_2026-10-24.md).

## G60A/G60B / A49: interfaz Driver chat y transporte localhost
- `apps/movete-driver/src/domain/driver-messaging.mjs` (+ TS/test), `src/DriverMessagesProvider.tsx` y `app/mensajes.tsx`: inbox/historial/paginación, composer, envío, reconcile original, read markers explícitos y verificación de vehículo detenido desde fuente confiable; snapshots sin token, marker o cursor.
- `server/g60b-driver-write-loopback-qa.mjs` (+ test): HTTP `127.0.0.1` POST SEND/RECONCILE con URL y payload allowlist, rechazo de Origin/cookie/host ajenos, tamaño/timeout y `OUTCOME_UNKNOWN` sin replay.
- La carga/scroll/inbox/push **no significa leído**. Sólo UI con prueba de visibilidad y orden puede confirmar.
- [G60A/B](../architecture/G60A_G60B_DRIVER_CHAT_UI_LOOPBACK_QA_2026-10-24.md).

## G60C/G60D / A50–A51: intercambio SQL Driver y Auth firmado end-to-end de laboratorio
- `G60C_DRIVER_MIN_PRIVILEGE_WRITE_EXCHANGE_POSTGRES_CI_ONLY.sql`: prueba opaca con 12s TTL, rol `mobility_g60c_execute_ci` solo EXECUTE de función mínima, definer NOLOGIN, G42 lock transaccional, SEND idempotente y RECONCILE solo lectura.
- `g60d-pinned-driver-local-chain-qa.mjs`: JWT G42 ES256 verificado contra issuer/aud/clave fija, usuario y sesión de proveedor, rol Driver exclusivo, atestación vial fresca ligada a Driver/servicio, SQL G60C y HTTP G60B localhost.
- Pruebas HTTP con JWT firmado de laboratorio, sesiones revocadas y ataques; **el ejecutor SQL del test Node es mock contractual** mientras Python prueba PostgreSQL real por separado.
- [G60C](../architecture/G60C_DRIVER_SINGLE_USE_SQL_WRITE_EXCHANGE_QA_2026-10-24.md), [G60D](../architecture/G60D_PINNED_DRIVER_AUTH_WRITE_LOCAL_CHAIN_QA_2026-10-24.md).

---

# 08. G61–G62 — SDK HTTPS STAGING, SEGURIDAD Y RUNTIME UNIFICADO (HECHO QA)

## G61 / A51–A52: infraestructura de integración sin habilitar producción
- `driver-chat-https-staging.mjs`: transporte Driver con **origen DNS HTTPS STAGING explícitamente aprobado**, redirect:'error', no cookies, no-store, bearer solo en header, cinco rutas chat, longitud/payload allowlist y timeout UNKNOWN; requiere CSPRNG/atestación vial inyectados.
- `driver-https-staging-auth.mjs`: SDK Auth inyectado, sesión expirable, `getUser` independiente, usuario confirmado, consulta de rol Driver exclusivo en servidor; no confiar en `app_metadata` o rol declarado local.
- **Control salida obligatorio**: `docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json`, `scripts/check-movete-launch-gates.mjs`, test y CI de aislamiento. No aceptar GO únicamente por bool modificado o CI verde sin verificaciones externas.
- [G61](../architecture/G61_LAUNCH_CLOSURE_HTTPS_DRIVER_AND_GO_NOGO_2026-10-24.md).

## G62 / A52: composición única Driver Auth / ofertas / KYC / chat
- `driver-status-origin.mjs` permite lecturas en localhost QA o HTTPS STAGING pinneado bajo opt-in, con verificación exacta de host.
- `driver-inbox.mjs`, `driver-documents.mjs` y `driver-license-readiness.mjs` admiten el origen autorizado, sin cambiar sus DTOs strict o abrir datos.
- `driver-staging-runtime.mjs` + tipos TS compone el mismo Auth/host para readers de ofertas, licencia/documentos, chat y posteriores acciones; delimita exactamente tres GET para status de conductor.
- `DriverApplicationProviders.tsx` y `app/_layout.tsx` montan la raíz **Driver solamente**; por defecto `runtime=null`, no hay IdP/backend real ni cuentas o viajes falsos.
- Pruebas de integración en memoria, POST incierto, confirmación posterior, logout/role swap, JWT malo y SDK real con prototipo.
- [G62](../architecture/G62_DRIVER_SINGLE_STAGING_AUTH_WORKSPACE_CHAT_2026-10-24.md).

---

# 09. G63–G64 — ACEPTAR OFERTAS Y RECUPERAR COMPROBANTE (HECHO QA)

## G63 / A53: aceptar y rechazar AUTO/DELIVERY
- `driver-offer-decision.mjs` y tipos: POST exacto `{offerId,requestKey}` al endpoint STAGING pinneado. Solo respuesta autoritativa con `liveEnabled:false` confirma.
- `driver-offer-actions.mjs`: rol Driver, oferta vigente, licencia revisada, decisión manual de una sola vez por oferta, requestKey CSPRNG, sin duplicación y sin cuerpo de actor/rol falsificado. Estados sending / confirmed / uncertain / blocked.
- `DriverOfferActionsProvider.tsx`, `app/ofertas.tsx`: botones de aceptar/rechazar **solo en runtime autorizado de QA**, no aceptaciones comerciales; bloqueo sin licencia, oferta o sesión válida.
- SQL G38 sigue bloqueando habilitación real. [G63](../architecture/G63_DRIVER_PRIVATE_OFFER_ACCEPT_DECLINE_STAGING_2026-10-24.md).

## G64 / A53: recibo durable por clave original después de timeout
- `G64_DRIVER_OFFER_DECISION_RECOVERY_POSTGRES_CI_ONLY.sql`: función owner-only `mobility_stage_g64_reconcile_offer_decision_owner_qa`, lee decisión G4 AUTO/G10 DELIVERY con G42_lock_session, rol/propietario/clave/acción exactos y devuelve el evento **original**. Si no está observado, `retrySafe:false` y NO second POST.
- Python `g64-driver-offer-decision-recovery-ci.py`: carreras/revocación/rol ajeno, dos conexiones, replay no insert, prueba de grants.
- Node `g64-driver-offer-reconcile-qa.mjs`: backend JWT/rol/session, rate y recibos comprobados. `driver-offer-actions.mjs` conserva key original **en memoria privada**; `app/ofertas.tsx` da botón de consulta aun si la oferta desaparece.
- **Límite:** una operación incierta puede perderse al matar/reinstalar app, porque la clave pendiente está solo en memoria. Diseñar mecanismo seguro de recuperación por servidor/identidad, no meter secretos persistentes en UI.
- [G64](../architecture/G64_DRIVER_OFFER_UNKNOWN_COMMIT_RECOVERY_2026-10-24.md).

---

# 10. G65–G66 — VIAJE AUTO Y CUSTODIA DE ENVÍOS (ÚLTIMO TRABAJO HECHO QA)

## G65 / A54 — ciclo AUTO de Driver hasta viaje completado
**Código backend:**
- `server/g65-driver-trip-status-qa.mjs`: GET lógico `/v1/staging/driver/trips/{tripId}/status`, actor JWT/sesión G42/rol Driver, rate, vehículo y asignación vigente. DTO privado `tripId,state,revision,nextEvent` sin teléfono, ubicación ni PII.
- `server/g65-driver-trip-status-repository.mjs`: SELECT con `eq('id',tripId).eq('driver_id',actorId)`, ambos predicados en SQL.
- `server/g65-driver-trip-status-qa.test.mjs`, `g65-client-driver-auto-lifecycle-qa.test.mjs`: contrato sintético Passenger request → oferta privada Driver → aceptación → arrival → pickup → complete; rol ajeno y revisión.

**Código Driver:**
- `driver-trip-lifecycle-http.mjs` (+ .d.mts): GET status + POST `/v1/staging/trips/{tripId}/transition`, cuerpo solo `{event,eventKey}`.
- `driver-trip-lifecycle.mjs` (+ .d.mts): `accepted→arrive→arriving→pickup→in_progress→complete→completed`, estados terminales/cancelación, consulta obligatoria antes/después, no resultado optimista ni envío automático tras COMMIT incierto.
- `DriverTripProvider.tsx`, `app/viaje.tsx` y navegación `app/ofertas.tsx`: pantalla de viaje desde aceptación confirmada, identidad SQL del conductor, ninguna ETA/GPS de ficción.
- [Documento G65](../architecture/G65_DRIVER_AUTO_TRIP_LIFECYCLE_CROSS_APP_STAGING_QA_2026-10-24.md).

## G66 / A55 — entrega AUTO/MOTO de Driver, recogida y comprobante
**Código backend:**
- `server/g66-courier-custody-status-qa.mjs`: GET lógico `/v1/staging/courier/deliveries/{deliveryId}/custody` para **courier autenticado**, sesión no revocada, rol Driver exclusivo, revisión/etapa y proofVerified sin PII.
- `server/g66-courier-custody-repository.mjs`: SQL `id=deliveryId AND courier_id=actorId`; sin permitir consultar otro envío por saber su UUID.
- `server/g66-courier-custody-transition-qa.mjs`: POST lógico `/v1/staging/courier/deliveries/{deliveryId}/custody-transition` con `pickup/deliver/return` y requestKey. Para `deliver` exige `verifyIndependentProof`: fuente **independiente del teléfono** vinculada a actor/envío/prueba, **antes** de invocar G5. La prueba real aún NO EXISTE conectada.
- Tests `g66-courier-custody-qa.test.mjs` y `g66-sender-courier-custody-contract-qa.test.mjs`, sintéticos: remitente solicita → courier acepta → recoge → comprobante previamente registrado en fixture independiente → entrega; revocación, roles, no fuga de remitente y no duplicación. SQL G5 real de PostgreSQL16 disposable en workflow independiente.

**Código Driver:**
- `driver-custody-http.mjs` (+ .d.mts), `driver-custody-controller.mjs` (+ .d.mts), `DriverCustodyProvider.tsx`, `app/entrega.tsx`, enlaces desde `app/ofertas.tsx` y raíz `DriverApplicationProviders.tsx`.
- Estados `accepted→pickup→picked_up→deliver→delivered` y `disputed→return→returned`; consulta posterior valida revisión; ante error/timeout `UNKNOWN_COMMIT` bloquea reenvío.
- La app no obtiene `proofRef` de un campo libre ni puede crear uno arbitrario para simular entrega. **En runtime actual `obtainVerifiedProof:null`, por tanto “Entregado” está bloqueado** hasta fuente y registro independiente del servidor.
- [Documento G66](../architecture/G66_DRIVER_DELIVERY_CUSTODY_VERIFIED_PROOF_STAGING_2026-10-24.md).

**Hechos comerciales:** G65/G66 están probados con respuestas HTTP sintéticas y SQL local independiente; **NO** están ejecutados en dispositivos reales conectados por HTTPS a un mismo backend. Los nuevos GET/POST de G65/G66 son rutas **lógicas de servidor QA**, no servicios públicos montados. Los eventos de custodia requieren autorización/atestación y almacenamiento real antes de operar.

---

# 11. MATRIZ ÚLTIMAS CERTIFICACIONES FUNCIONALES POR CORTE

Los siguientes cortes se comprobaron previamente 4/4 SUCCESS en sus respectivos SHA. Solo G66 es el **último** corte funcional; nunca combinar tests de fechas/SHA distintos para declarar un HEAD nuevo certificado.

| Tramo | SHA funcional 4/4 QA | Nota |
|---|---|---|
| G58E | `842143d2d82e03c7c10041051341f3daa643f783` | HTTP localhost y Auth fences |
| G60C/G60D | `62c47d0cfbbe43525f69e9d8cdc91e0adbf4e07f` | JWT real firmado en fixture, SQL racing por separado |
| G61 | `f2d268adaf50c5d557500d94e5a625214c85120c` | HTTPS/SDK solo opt-in y matriz NO_GO |
| G62 | `5a54e4d960cc368cc8ce85815da5fdce0c256bc2` | Runtime Driver Auth+workspace+chat |
| G63 | `c12c3daa5844c19cc76da2d4d569a056f5d1b4f5` | Accept/decline Driver |
| G64 | `dff966f340fd463f4597df7014853ed3912b5f19` | Recovery AUTO/DELIVERY original decision |
| G65 | `87f6be603ce46a714df26402baf57b324d564485` | Driver AUTO trip lifecycle |
| **G66** | **`4232ff32a7432a7a8006ebd4dbfb018c9e9ab62f`** | **Courier delivery custody; 4/4 runs #756/#1159/#1849/#1587** |

G58F/G59/G60A/B y todo tramo intermedio quedan también cubiertos en la evolución final G66 de tests de regresión y documentos individuales. No deducir que un test de PG y uno de HTTP usaron automáticamente el mismo servidor: varios son cadenas y mocks deliberadamente separados.

---

# 12. ESTADO DEL ARQUITECTO B — PARA COORDINAR, NO EDITAR

En rama B observada hasta R62:
- Expo Cliente independiente con Auth Passenger fail-closed, formularios de solicitud AUTO/MOTO carga, tarifas en Gs, historial paginado, cancelación, reintentos idempotentes y recuperación de booking incierto, estado privado de viaje, chat Passenger y seguimiento, catálogo/sucursales/carrito con versión de stock, soporte e incidencias. Los adaptadores exigen origen HTTPS STAGING aprobado; no hay checkout/PSP habilitado.
- Admin Web distinto con gestión de roles/casos/KYC/zonas/comercios/auditoría, accesibilidad y control NO_GO; backend real Admin y MFA externo pendientes.
- R60 instaló matriz de **17 gates y 20 circuitos funcionales**, todos sin certificación comercial. No tratar un test de simulación como certificado de operación.
- R61 corrigió DTO/`revision` cruzados en status Passenger G65, sin consumir datos privados Driver ni inventar GPS/ETA.
- R62 agregó `sender-custody-flow.mjs` y contrato Passenger sintético de seguimiento de paquete; **no** existe todavía un GET remitente autorizado por A. Solo se permite cuando `enabled + contractCertified + stagingRuntimeVerified`.
- Fuente autorizada para detalles B: `docs/architect-b/**` en su HEAD más reciente, PR #8, nunca editar esas rutas desde A.

**Contrato P0 solicitado por B:** servidor A debe ofrecer DTO Passenger **propio**, autorizado con `sender_id=JWT.subject` y rol Passenger, para GET status de una entrega; NO reutilizar la ruta `/courier/.../custody` de Driver. Mantener revisión monotónica, `proofVerified` basado en registro independiente real, sin remitente/Driver/contacto/GPS o `proofRef` en respuesta. Coordinar forma exacta, errores y OpenAPI por issue #9 antes de que B conecte red.

---

# 13. BLOQUEOS COMERCIALES — 17 GATES CANÓNICOS

Fuente exacta: `docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json`. Estado 24-10-2026: **0/17 verificados**; los dos QA_ONLY no son PASS de negocio. No se pueden cambiar para alterar una cifra sin evidencia independiente y revisión Owner.

| ID | Responsable | Estado | Qué falta para cierre real |
|---|---|---|---|
| IDP_BACKEND_AUTH | A | BLOCKED | IdP de proveedor, JWKS/issuer/aud/rotación, sesiones y roles G42 reales, MFA Admin |
| HTTPS_BACKEND | A | BLOCKED | API HTTPS STAGING aprobada, DNS/TLS, acceso desde teléfonos, rate/observabilidad y roles SQL mínimos |
| POSTGRES_PERSISTENCE | A | QA_ONLY | DB protegida autorizada, durabilidad, restore, migraciones, privilegios y concurrencia sobre STAGING real |
| DRIVER_ONBOARDING | A | BLOCKED | Registro físico, KYC documento/vehículo, revisión Admin, elegibilidad legal verificada |
| DRIVER_LIVE_TRIPS | A | BLOCKED | Oferta→aceptación→trayecto→cierre real, 2 teléfonos, política zonas/GPS y seguridad vial |
| CLIENT_LIVE_BOOKINGS | B | BLOCKED | Identidad Passenger, tarifa vigente, request/receipt durable, revocación y dispositivo físico |
| PAYMENT_SETTLEMENT | A/B | BLOCKED | PSP autorizado, cobro/reembolso idempotente, ledger/conciliación/liquidación |
| PRIVACY_KYC | A/B | BLOCKED | Storage real cifrado, scanner, lease, retención, borrado, controles de auditoría y acuerdo legal |
| EMERGENCY_SAFETY | A/B | BLOCKED | SOS operativo, persona de guardia, seguimiento, incidentes y tiempos de atención |
| MAPS_GPS_DEVICE | A/B | BLOCKED | GPS/Maps OS físico, consentimiento, anti-spoof, reconexión, background y batería |
| DELIVERY_MERCHANTS | A/B | BLOCKED | Comercios/stock real, custodia, comprobante no forjable, ETA, soporte y delivery físico |
| CHAT_PHYSICAL | A/B | QA_ONLY | Mensajería bidireccional, push privado/markers realmente visibles y dispositivos físicos |
| ADMIN_OPERATIONS | B | BLOCKED | Acceso MFA/role Admin real, KYC, zonas, fraude, reembolsos, auditoría e incidentes |
| NATIVE_RELEASES | A/B | BLOCKED | Android AAB + iOS IPA firmados de **dos apps separadas**, tests de dispositivo |
| LEGAL_COMPLIANCE | Owner | BLOCKED | Permisos Paraguay/municipales, seguro, contratos, protección de datos y tributos |
| OPS_24_7_MONITORING | Owner/A/B | BLOCKED | Logs sin PII, alertas, on-call, backups, incident-response, presupuesto |
| PROD_GO_NOGO | Owner | BLOCKED | 17 evidencias verificadas + decisión explícita Owner para producción por separado |

En R60, B también definió **20 circuitos de negocio** a certificar: `AUTH_PASSENGER`, `AUTH_DRIVER_KYC`, `FARE_QUOTE_GS`, `AUTO_BOOKING`, `DRIVER_DISPATCH`, `GPS_TRACKING`, `TRIP_COMPLETION_CANCELLATION`, `MOTO_CARGO_DELIVERY`, `AUTO_CARGO_DELIVERY`, `SUPERMARKET_ORDER`, `PHARMACY_OTC_ORDER`, `RESTAURANT_ORDER`, `CUSTOMER_DRIVER_CHAT`, `PAYMENTS_REFUNDS`, `COMMISSIONS_PAYOUTS`, `ADMIN_KYC_ZONES`, `EMERGENCY_RESPONSE`, `DATA_PRIVACY`, `SIGNED_NATIVE_RELEASES`, `ZONE_ACTIVATION_SUPPORT`. **Ninguno certificado comercialmente**; estado sin certificación no significa ausencia total de código.

---

# 14. RIESGOS TÉCNICOS / DEUDA P0 QUE NO DEBE OCULTARSE

1. **Falta el producto operacional:** hoy existen piezas sólidas en QA, pero no hay proveedor IdP autorizado conectado, backend HTTPS montado, dispositivos físicos E2E, PSP ni cierre legal. No usar la expresión «app 100% terminada» por tener 4/4 CI.
2. **Prueba de entrega G66 inexistente de verdad:** `proofRef` UUID sintético no verifica foto, recepción ni identidad. G66 emplea callback de autoridad independiente; hay que crear fuente inmutable con DB + almacenamiento cifrado/auditado y revocación. Sin esta fuente `deliver` siempre queda OFF.
3. **Posible TOCTOU entre comprobante y mutación:** el callback `verifyIndependentProof` anterior a la transacción de G5 no garantiza por sí solo que el comprobante siga vigente hasta COMMIT. **G67 debe consumir/verificar el proof en la misma transacción SQL que confirma `deliver` o emplear fence SQL equivalente**. Ensayar concurrencia/retirada/reutilización.
4. **Entrega con devolución/disputa:** no mostrar `returned` ni permitir `return` sin verificar actor, estado, reclamo y custodia G5; devolución no equivale a reembolso PSP.
5. **Sesiones/revisión:** Node pre-check/Auth externa no reemplaza G42_lock_session bajo COMMIT, ni un JWT firmado autoriza automáticamente la acción. G42 tiene que mantener exclusividad y revocación.
6. **Aceptar ofertas tras timeout:** no reenviar `accept/decline` con requestKey nuevo; G64 recupera clave original. El pending solo en memoria se pierde en crash/reinstalación: falta reconciliación server-side por identidad/oferta.
7. **G65/G66 lifecycle con ACK perdido:** GET estado con revisión posterior confirma progreso, no identifica causalmente qué POST produjo el evento. No fabricar recibo de transición ni permitir otra acción con estado viejo.
8. **Lectura de chat:** sidecar G57/G57B requiere mensaje realmente visible y en orden, nunca automáticamente por GET ni push; TTL/epoch/cursor y reasignación contra PII.
9. **No restaurar grants peligrosos:** G37/G46/G47 revocaron DML y EXECUTE antiguos; `service_role` jamás se expone en app/browser; roles gateway NOLOGIN solo EXECUTE mínimo y no inventar un atestador owner abierto.
10. **No construir URLs a partir de datos de usuarios:** DNS HTTPS STAGING pinneado por integración aprobada; no confiar en redirects, Origin, cookies o hostname proporcionado por push/pasajero.
11. **No superar capacidad:** MOTO carga sujeto a dimensiones/seguro G5; MOTO pasajeros no habilitado. Farmacias solo OTC. No asumir legalidad o zona a partir de datos sintéticos.
12. **Escalabilidad:** listas paginadas por cursor/keyset y pruebas >30k filas. Nunca agregar límite 50 a DB o usuarios por confundir pageSize.
13. **Auth Admin:** AAL2/MFA y separación Owner/Admin. No habilitar casos reales por un rol local del navegador.
14. **Cliente/Driver contratos distintos:** respuestas Driver privadas no se pueden enviar al Cliente; especialmente G65 trip status y G66 custody. Coordinar DTO Passenger con B.
15. **OpenAPI vs runtime:** ruta declarada o unit test sintético no es endpoint HTTPS vivo. Comprobar mount, permisos, rate/timeout, DB y device real.
16. **CI no prueba Android/iOS:** Expo web export y TypeScript no son AAB/IPA firmados; no declarar pruebas físicas.
17. **Trazabilidad:** no combinar workflows de SHAs distintos, no certificar automáticamente commits de docs que no disparan CI por filtros de paths; verificar URL exacta y conclusión.
18. **Sin operaciones en paralelo sin colisiones:** A no edita carpetas B, ni incorpora cambios de B por cherry-pick/merge sin Owner/plan de integración.

---

# 15. TRABAJO QUE FALTA, ORDEN ESTRICTO DE CONTINUIDAD

## G67 / A56 — PRIORIDAD INMEDIATA, HACER SIN PREGUNTAR
**Objetivo:** subsistema realista de **comprobante seguro de entrega** con custodia PostgreSQL16 disposable y APIs QA; no activar datos reales, almacenamiento remoto ni cámara sin aprobación.

**Secuencia técnica concreta:**
1. Inspeccionar `G5_DELIVERY_CUSTODY_POSTGRES_CI_ONLY.sql`, `G66` SQL contract, `g66-courier-custody-transition-qa.mjs`, `g66-courier-custody-status-qa.mjs`, roles G42/G46/G47/G48/G58F y R62 de B. Identificar estados y GRANTS correctos.
2. Diseñar tabla **owner-only de proofs** en base PostgreSQL16 local desechable: `proof_ref` opaco, `delivery_id`, `courier_id` de sesión, tipo de evidencia, hash SHA-256 del contenido sintético, tamaño/MIME allowlist, emisión, expiración, estado verificado/revocado, actor revisor, revisión, timestamps/retención y auditoría append-only. No subir bytes reales de fotos/KYC.
3. Función de registro/attestation solo para proveedor **server-side confiable** (en CI sintético). Rechazar mint desde body de teléfono, estados no `picked_up`, asignación ajena, prueba cruzada, duplicados, MIME impropio y proofs sin revisión. Separar captura/upload de autorización del acto de entrega.
4. **Atomicidad de cierre:** verificar proof y su estado vigente **DENTRO de la misma transacción** que ejecuta G5 `mobility_stage_delivery_transition(...,'deliver',...,proofRef)`; impedir que el proof se revoque, reasigne, reuse o caduque mientras se confirma. Si resulta imposible sin tocar RPC viejo inseguro, proponer wrapper `SECURITY DEFINER` mínimo, owner-only, tests que demuestren grants; no volver a abrir permisos amplios.
5. Pruebas SQL ASSERT y Python con dos conexiones: dos intentos de consumo mismo comprobante, expiración/revocación concurrente, otro courier/otro delivery, rollback entre verificación y COMMIT, payload distinto con misma key, roles anon/authenticated/service_role/gateway sin privilegios, estado previo/cancelado y comprobante privado.
6. Node QA `g67-*`: JWT G42/rol/session/rate, no identidad/price/location en body, DTO público mínimo. Cualquier fallo storage/proof/SQL => `NO_GO/UNKNOWN_COMMIT`, jamás «entregado» por booleano en pantalla.
7. Tests Driver con `obtainVerifiedProof` inyectado y **sin** proveedor por defecto. El runtime no debe inventar URL HTTPS ni API key. UI de estado comprobada sin mostrar proof raw/PII.
8. Documentar `docs/architecture/G67_*`, dejar migración `*_CI_ONLY.sql`, Node y Python, modificar workflow PostgreSQL **para correr nueva QA** sin despliegue, comprobar cuatro workflows **SUCCESS mismo SHA**, registrar evidencia en issue #9, continuar a G68.

**Bloqueo verdadero parcial G67:** integrar S3/Storage reales, cámara, cifrado KMS, virus scanner, acceso físico, retención y sujetos reales requiere proveedores y aprobación del Owner. **No detener G67 QA por eso**; dejar esos adaptadores OFF y testear denegación.

## G68 / A57 — sender-owner status pedido por Arquitecto B R62
1. Publicar contrato independiente `GET /v1/staging/sender/deliveries/{deliveryId}/custody` o URL versionada acordada en issue #9. JWT Passenger, sesión G42, role exclusivo y SQL con `id=deliveryId AND sender_id=JWT.subject`.
2. Respuesta exacta y mínima para Cliente: identidad de propietario interna solo si contrato B lo requiere, `state/revision/vehicleKind/assignmentPersisted/proofVerified` autenticados, sin proofRef, remitente/courier privado, GPS/telefono o metadata de almacenamiento.
3. `proofVerified` debe derivarse **del proof server-side G67**, no de un campo que B inyecta; estados `delivered/disputed/returned` deniegan si proof no verificable.
4. Comparar DTO propuesto en `sender-custody-flow.mjs` de B sin cambiarlo directamente; coordinar errores/cancelación/disputa en issue #9. Probar dos roles sobre la **misma fila SQL** y sesiones revocadas en carrera.

## G69 — montaje y seguridad del backend HTTPS STAGING (CUANDO AUTORIZADO)
1. Obtener orden Owner para proveedor IdP, base persistente STAGING, DNS/TLS y gestionador de secretos; el código puede adelantarse con factories inyectables, pero **no desplegar** antes de orden.
2. Montar rutas HTTP de Passenger/Driver/Commerce/Admin protegidas por JWT JWKS pinneado, sesión G42/rol y grants SQL mínimos, rate, correcciones de fallback y timeouts; no exponer owner-only fixture/tickets.
3. Migraciones firmadas, backups/restore, key rotation y logs sin PII; prueba positiva y negativa con datos sintéticos sobre HTTPS autorizado.
4. Revisión de amenazas auth/session/SQL/service_role/SSR, clock skew, race con revocación, firmas, cookies, CORS, dependencias y regresión con múltiples usuarios.

## G70 — E2E funcional sobre dos aplicaciones nativas reales (CUANDO AUTORIZADO)
1. Dos teléfonos, Passenger ↔ Driver: signup/roles, KYC autorizado, cotización PYG, solicitud, oferta/aceptación, seguimiento, llegada, inicio, cierre/cancelación, historial, soporte y chat privado.
2. AUTO/MOTO **solo carga para moto**: request, oferta courier, pickup, comprobante cifrado/verificado, deliver/return/dispute, avisos sin PII, soporte.
3. Pruebas adversariales física/concurrente: permisos GPS, background/app kill, pérdida conexión tras COMMIT, doble tap, token expirado/revocado, Driver reasignado, vehículo en movimiento, tiempo y zona, drop push y sesiones cruzadas.
4. Evidencia reproducible: build firmada, IDs de dos dispositivos, ambiente, SHA, logs redaccionados, PostgreSQL snapshot auditado y caso de usuario con autorización legal. Sin evidencia, gate sigue BLOCKED.

## G71+ — cierre de todos los demás circuitos de negocio
- Cerrar KYC real Driver/vehículo + Admin AAL2 con documentación protegida y retención; catálogo comercios/stock/reservas/fulfillment/cancelación/sustituciones.
- GPS/Maps navegación con licencia, anti-spoof y zonas legales; cálculo tarifa/servicio/autos/moto envíos y comisiones server-side.
- Chat bidireccional real con lectura verdaderamente visible, push OS sin texto PII, carrera reasignación, SOS y operador humano con respuesta.
- PSP aprobado, cash/online policy, conciliación, ledger, reembolsos, payouts, antifraude, impuestos; **no dinero real antes de aprobación**.
- Rendimiento, backups, disaster recovery, soporte, privacidad paraguaya, seguros, permisos municipales, Store build Android/iOS y piloto con zona aprobada.
- UI definitiva Lovable solo cuando no reemplace backend/seguridad; Owner firma gates 17/17 y GO/NO-GO explícito en otro acto.

**Foco:** evitar seguir produciendo solo «harness» si se puede integrar una funcionalidad end-to-end bajo infraestructura aprobada. Si no se aprueba STAGING real, continuar QA de G67/G68 con garantías técnicas, aclarando exactamente qué no puede concluirse.

---

# 16. CÓMO REENTRAR Y TRABAJAR SIN DETENERSE

1. Leer este handoff y anexos; abrir PR #7/PR #8/issue #9 para HEAD nuevos. **No usar SHAs viejos como HEAD vigente**.
2. Leer las rutas `apps/mobility-expo/docs/backend/staging_only/G5_*`, ``G42/G43/G47/G58F/G60C/G64` y ``server/g65-*/g66-*`, `apps/movete-driver/src/domain/driver-staging-runtime.mjs`, `driver-custody-controller.mjs` y `app/entrega.tsx`.
3. Inspeccionar pruebas previas y rollback/grants. Implementar G67 directamente en rama A: SQL CI ONLY + ASSERT + Python concurrencia + Node adversarial + componente Driver solo cuando exista autoridad, docs + issue #9.
4. En cada corte: confirmar que no se cambió `apps/movete-cliente/**` / `apps/movete-admin/**` / `docs/architect-b/**`; scripts compartidos solo con cuidado.
5. Revisar Actions **mismo SHA**: PG, Node, Expo, two-app isolation. Si hay failure: buscar logs, corregir y relanzar con nuevo commit. No disimular un fallo de test ni declarar «terminado» prematuramente.
6. Comunicar contrato a B en issue #9; no implementar su pantalla dentro de A. Continuar G68 y siguientes automáticamente hasta que haya bloqueo real.
7. **Si aparece bloqueo externo** (hosting, idP, PSP, legal, PII, deploy, colisión), anotar acción, fuente de autorización faltante y plan alternativo de QA; continuar las otras tareas. Nunca prometer trabajo asíncrono ni detener todo el proyecto porque un proveedor no esté aprobado.
8. Mantener PR #7/#8 DRAFT; sin merge/main ni LIVE. Al terminar un corte, documentar SHA y diferenciar QA, integración real STAGING, dispositivo real y producción comercial.

### Comandos de desarrollo y control existentes (verificados en package/workflows)

Desde checkout local autorizado, Node 22:
```bash
# Backend dominios Expo
cd apps/mobility-expo && npm install --no-audit --no-fund && npm run check
cd server && node --test *.test.mjs

# Driver independiente
cd apps/movete-driver && npm install --ignore-scripts --no-audit --no-fund
npm run check
npx expo export --platform web

# Cliente, solo B o verificación de aislamiento; A NO edita sus archivos
cd apps/movete-cliente && npm install --ignore-scripts --no-audit --no-fund
npm run check
npx expo export --platform web

# Reglas cross-app y lanzamiento, desde raíz
node scripts/check-mobile-boundaries.mjs
node --test scripts/check-movete-launch-gates.test.mjs
node scripts/check-movete-launch-gates.mjs --json
# Debe salir NO_GO/no cero mientras no existan 17 evidencias + orden Owner:
node scripts/check-movete-launch-gates.mjs --require-go
```

**PostgreSQL:** no ejecutar manualmente migraciones CI-only en bases ajenas; usar [workflow `mobility-g4-postgres-disposable.yml`](../../.github/workflows/mobility-g4-postgres-disposable.yml) con PostgreSQL16 ephemeral/localhost/`qore_disposable_chain` y `application_name=qore_ci_disposable_chain`. El pipeline incluye sus fixtures, Python y roles especiales. **No usar contra Supabase real sin autorización**.

### CI que se debe observar

- [PostgreSQL16 disposable](../../.github/workflows/mobility-g4-postgres-disposable.yml): SQL, RLS, grants, 2 conexiones, pruebas de G64 y gates anteriores.
- [Node STAGING](../../.github/workflows/mobility-staging-node-contracts.yml): `server/*.test.mjs`.
- [Expo backend](../../.github/workflows/mobility-ci.yml): TypeScript, contratos, safety/export web, PG G1–G10 ephemeral.
- [Aislamiento dos apps](../../.github/workflows/movete-apps-isolation.yml): boundaries, QA NO_GO, TypeScript + Node + export web por app.
- B maneja sus propios workflows de ownership/Admin; certificar su SHA **en su rama B**, no inferirlo desde CI A.

---

# 17. CRITERIOS DE BLOQUEO REAL VS CONTINUIDAD SEGURA

**NO detiene el desarrollo:** test rojo corregible; CI en cola; endpoint HTTPS aún no autorizado cuando se puede diseñar SDK/factory y CI-only; falta de PSP cuando se puede robustecer idempotencia/auditoría; funciones B pendientes que admitan contrato A y coordinación; ausencia de Lovable cuando se está construyendo backend.

**Sí bloquea únicamente esa acción:** cargar datos o documentos personales reales; desplegar API/DNS/VPS/TLS/DB externo; conectar/guardar secretos o proveedor; procesar dinero; activar funciones comerciales; permitir motocicletas con pasajero; hacer merge, rebase destructivo, cambiar base PR B; publicar binarios en Stores; enviar push/SMS real; aceptar legalidad, seguros o certificaciones sin autoridad. Informar dependencia y seguir otra tarea segura.

**Exigir verdad de evidencias:**
- `CI_SUCCESS_QA` → contratos/comportamiento probado con datos sintéticos; no equivale a `REAL_STAGING_E2E`.
- `REAL_STAGING_E2E` → dos aplicaciones conectadas a un mismo servidor autorizado y DB duradera con pruebas negativas verificadas.
- `DEVICE_CERTIFIED` → builds firmadas y pruebas físicas Android/iOS; export web no alcanza.
- `COMMERCIAL_GO` → 17 gates y 20 flujos evidenciados, legal/operación, aprobación Owner explícita.
- Un contrato con `productionEnabled:false` no puede promocionarse a LIVE cambiando un booleano.

---

# 18. INSTRUCCIÓN LISTA PARA PEGAR EN EL NUEVO CHAT

> **ORDEN OWNER — QORE MOBILE / MOVETE FÁCIL — ARQUITECTO A.** Continuá la construcción de la plataforma de movilidad y logística Paraguay en el repo GitHub `mezas3238-hue/Qore-mobile-` (**guion final**). **LEÉ EN PRIMER LUGAR** `docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G66_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md`, el handoff histórico G0–G58E, el anexo de **175 commits G58E→G66** y el inventario de **709 archivos**; auditá el HEAD actual de [PR #7 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/7), [PR #8 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) (solo lectura) e [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9). Último SHA **funcional** G66 `4232ff32a7432a7a8006ebd4dbfb018c9e9ab62f` con 4/4 SUCCESS en PostgreSQL #756, Node #1159, Expo #1849 y aislamiento #1587; los commits documentales posteriores deben verificarse por separado. **No rehagas G0–G66; empezá YA G67**: custodia PostgreSQL16 real QA de comprobantes de entrega con verify+commit atómico, roles mínimos, RLS, grants, carreras 2 conexiones, Node JWT/G42 y tests Driver, manteniendo la prueba real desconectada por defecto; después **G68** GET sender-owner privado para B R62 y siguientes etapas seguras. Cada gate: código, pruebas adversariales, CI 4/4 del mismo SHA, documentación, issue #9 y continuar sin pedir confirmación. **NO detengas el trabajo salvo bloqueo real**; si una integración requiere proveedor externo, secretos, VPS, LIVE, pago, PII, legal o autorización Owner, dejá esa acción en NO_GO y continuá otra parte segura. **NO MERGE / NO LIVE / NO DEPLOY / NO PSP / NO secretos / NO editar Cliente/Admin B / NO unir apps**. El producto comercial NO está terminado: **0/17 gates comerciales**. Informá honestamente diferencia entre QA y calle.

---

# 19. CIERRE DE TRANSFERENCIA

**Realizado por Arquitecto A hasta G66:** arquitectura y SQL PostgreSQL/RLS; motor de viajes AUTO; ofertas privadas; delivery AUTO/MOTO y custodia; comercio/stock sintético; contabilidad PYG QA; incidentes; zonas/GPS cuarentenado; KYC metadata; Auth JWT firmada y revocación; gateways privados con capacidades mínimas; chat Passenger/Driver, historia/markers contiguos y recuperación de ACK incierto; Driver Expo independiente con bandeja de ofertas, aceptar/rechazar, mensajes, estado AUTO y pantalla de custodia delivery; HTTPS STAGING **opt-in**, seguridad vial, proof-gate y tests de integración. **Verificable con 709 blobs y 175 commits nuevos desde G58E**, más históricos anexados.

**Falta obligatoriamente:** proveedor real IdP y DB duradera con TLS/HTTPS autorizado, registrar comprobantes de entrega protegidos G67, estado privado remitente G68, conectar Cliente/Driver/Admin por la misma infraestructura, KYC y SOS físicos, GPS/Mapas, push, comercios/stock real, PSP, soporte, legal Paraguay, builds nativas y verificación exhaustiva de 17 gates/20 flujos. **El estado comercial es NO_GO; esto no es una demo para vender como app terminada**.

**Siguiente arquitecto:** empieza G67 al abrir el nuevo chat; documenta cada cambio, mantiene A/B sin colisiones y sigue avanzando sin detenerse salvo ante bloqueo real de una acción concreta.
