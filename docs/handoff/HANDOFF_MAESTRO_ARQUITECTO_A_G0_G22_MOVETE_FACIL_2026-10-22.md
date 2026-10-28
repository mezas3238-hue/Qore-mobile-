# QORE MOBILE / MOVETE FÁCIL — HANDOFF MAESTRO INTEGRAL DEL ARQUITECTO A, G0–G22

**Corte de transferencia:** 22 de octubre de 2026, hora de Paraguay (America/Asuncion).
**Destino:** próximo arquitecto en un chat nuevo o ChatGPT Work. **Idioma operativo:** español.
**Repositorio soberano:** mezas3238-hue/Qore-mobile-
**Rama A:** feature/mobility-monorepo-isolated-20261016
**PR A:** https://github.com/mezas3238-hue/Qore-mobile-/pull/7 — DRAFT, abierto, NO MERGE.
**Último HEAD de código A confirmado ANTES de escribir este handoff:** 29885d1c2b3c4b8c831bb27e160df6d1f3d25a12
**Rama B:** feature/mobility-cliente-admin-parallel-20261022
**PR B:** https://github.com/mezas3238-hue/Qore-mobile-/pull/8 — DRAFT, abierto, NO MERGE.
**HEAD B verificado:** 79e52792d96bec6b41875b960f37a99a0e9aaa04

> **MANDATO DEL PROPIETARIO: seguir construyendo sin repetir planes.** Primero completar infraestructura segura y funcionamiento en QA; luego integrar interfaz definitiva en Lovable, sin delegar lógica de servidor a Lovable. NO merge, NO LIVE, NO VPS, NO SQL remoto, NO pagos, cobros, GPS, push o despliegues reales ni publicación de apps sin autorización explícita. Trabajar con datos sintéticos y PostgreSQL desechable. No tocar repositorio de trading mezas3238-hue/qore-core.

## 0. LEER PRIMERO — ESTADO REAL, SIN EXAGERACIONES

Este handoff integra trabajo efectivamente publicado por el Arquitecto A en QORE Mobile, los estados observados del Arquitecto B y las tareas que siguen abiertas. **CI SUCCESS equivale a contratos y builds de QA**, NO certifica funcionamiento en la calle ni un APK/IPA firmado.

1. **Existen DOS apps móviles diferentes**, instalables en principio como binarios distintos: apps/movete-driver y apps/movete-cliente. NO deben reunirse en una sola app de roles. Driver Android/iOS: com.movetefacil.driver, deep link movetefacildriver. Cliente Android/iOS: com.movetefacil.cliente, deep link movetefacilcliente.
2. **Admin es WEB, no móvil**: apps/movete-admin en rama B. Backend central compartido entre los tres; autorización y permisos desde el servidor.
3. El laboratorio histórico apps/mobility-expo contiene buena parte de backend, PostgreSQL, contratos, motores, pruebas y Expo de QA. **NO convertirlo en app final ni confundirlo con las dos apps separadas.**
4. **G21 ya enlaza UI Driver a estado privado** de sesión, documentos, licencia y ofertas, pero **sin Auth/API configurada en el layout por defecto**; muestra not-configured y no inventa servicios.
5. **G22 es un puente de Auth inyectable, probado con dobles**, no un login real ni sesión productiva. Requiere SDK Auth real, backend de QA autorizado y configuración segura.
6. **G17/G19 no permiten documentos reales aún:** falta Storage privado con versionado confiable y escáner antimalware real. Solo licencia tiene ruta de admisión de referencia bajo las reglas SQL revisadas; otras categorías están bloqueadas. La aprobación de una licencia **no habilita** al conductor.
7. **G20** endurece preflight AUTO y carga con la **licencia más reciente y aprobada** al crear/aceptar oferta. Los pasajeros MOTO permanecen cerrados. Migraciones nuevas en SQL de **CI desechable**, no desplegadas en Supabase productivo.
8. B avanzó independientemente en Cliente y Admin web, pero **todavía no tiene integración de Auth/backend LIVE** ni un build Admin web certificado por job propio de CI. Evitar afirmaciones de completitud.

### Última evidencia verde observada de A — commit 29885d1c

- PostgreSQL 16 desechable: workflow **QORE G4 PostgreSQL disposable smoke #149 SUCCESS** — https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39887977155
- STAGING Node contracts: **#306 SUCCESS** — https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39887977273
- Expo aislado/laboratorio: **#845 SUCCESS** — https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39887977342
- Movete Facil two app isolation: **#188 SUCCESS** — https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39887977205

**Estos cuatro checks corresponden al commit de código indicado, ANTES de publicar este documento.** El siguiente arquitecto debe obtener HEAD actual y comprobar los checks que correspondan a ese SHA; no atribuir al documento un resultado aún no consultado.

### Evidencia reciente B, solo por lectura

- Branch B HEAD 79e52792; PR #8 DRAFT, sin merge.
- Checks en ese HEAD: **Movete Facil Architect B ownership boundary #50 SUCCESS** (https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39890889314) y **Movete Facil two app isolation #198 SUCCESS** (https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39890889457).
- Comparación A...B observada: ramas **divergidas**, B 53 commits ahead y 98 behind; 69 archivos comparados, **cero fuera de apps/movete-cliente, apps/movete-admin, docs/architect-b**. Estos números cambiarán con los próximos commits.
- El PR B dispone de UI Cliente y estructura Admin web, pero esos checks **NO ejecutan aún npm run check + npm run build en Admin web** y no certifican su operatividad.
- **Issue de contratos B→A:** https://github.com/mezas3238-hue/Qore-mobile-/issues/9
- Ver docs/architect-b/STATUS_Y_CONTRATOS.md, QA_INTEGRACION_FRONTENDS_2026-10-22.md y OWNER_DASHBOARD_FINANCE_RBAC_2026-10-22.md **en la rama B**.

## 1. OBJETIVO DE NEGOCIO Y ARQUITECTURA NO NEGOCIABLE

Movete Fácil / QORE Mobile opera en Paraguay, con expansión **por zonas** y validación operacional/legal previa. Busca competir con Bolt y Uber en servicio, fiabilidad, seguridad, claridad de tarifa, ingreso de conductores y sostenibilidad económica.

Alcance aprobado:
- **AUTO pasajeros**: solicitud, cotización Gs, búsqueda/radar de conductores elegibles, oferta privada, aceptación única, identidad/vehículo visible solo según estado autorizado, GPS y ETA comprobados, seguimiento, cierre, historia, soporte y calificación.
- **MOTO pasajeros**: NO habilitar a nivel comercial hasta verificar regulación y seguro por municipio/zona. No confundir autorización de mensajería MOTO con transporte de personas.
- **ENVÍOS particulares**: paquetes, documentos, compras, capacidad/peso/dimensiones, cadena de custodia, cancelaciones, prueba de entrega y devoluciones.
- **ENTREGAS DE COMERCIOS**: supermercados, farmacias solo artículos no regulados/OTC hasta norma comprobada, restaurantes y otras tiendas; catálogo, sucursal, pedido, preparación, reparto y recibos.
- **Admin WEB**: KYC, conductores/vehículos, documentación privada con controles de acceso, zonas, incidentes/SOS, operaciones, auditoría, reportes; dashboard Owner segregado por permisos del servidor.
- **Backend central**: roles y Auth, PostgreSQL/RLS, Storage privado, GPS consentido, despacho, tarifas/comisiones, ledger, notificaciones, seguridad.
- **Lovable**: presentación visual/interfaz definitiva; NO SQL, RLS, pricing, Auth privilegiado, política legal, dinero real ni despliegue automático.

### Mapa objetivo de repositorio

Qore-mobile-/
- apps/movete-driver/ — app móvil Driver, EXCLUSIVA A
- apps/movete-cliente/ — app móvil Cliente, EXCLUSIVA B
- apps/movete-admin/ — panel WEB, EXCLUSIVA B, hoy vive en rama B
- apps/mobility-expo/ — backend/laboratorio de QA histórico, EXCLUSIVA A
- docs/architecture/ y docs/handoff/ — arquitectura global y handoffs A
- docs/architect-b/ — notas B exclusivas
- .github/workflows/ y scripts/ — CI, gates y controles, EXCLUSIVA A
- backend/, database/, packages/ — separación futura del backend/contratos, A si se crean

**No asumir que cada carpeta objetivo existe ya en la rama A.** apps/movete-admin pertenece a B y está en su rama.

## 2. DIVISIÓN DEL TRABAJO — EVITAR SOLAPAMIENTO

### Arquitecto A, sucesor de este chat

**Único propietario** de apps/movete-driver/**, apps/mobility-expo/**, backend/**, database/**, packages/**, .github/**, scripts/**, docs/architecture/**, docs/handoff/** y controles raíz.

Responsable de todas las APIs, SQL, Auth/RLS, Storage, elegibilidad, disponibilidad, GPS, despacho, pricing, ledger, push/recovery, seguridad, backend Admin/Owner, Driver y CI integral. Puede leer B sin editar sus carpetas.

**Prohibición A:** NO modificar apps/movete-cliente/**, apps/movete-admin/** ni docs/architect-b/**. Para cambiar frontend B o solicitar pruebas, abrir/actualizar issue, entregar contrato y dejar B integrar.

### Arquitecto B, colaborador en PR #8

**Único propietario** de apps/movete-cliente/**, apps/movete-admin/** y docs/architect-b/**. B crea UI Cliente/Admin, adaptadores de consumo y sus pruebas; puede leer backend/contratos A pero NO modifica código backend, SQL, workflows, Driver, packages centrales ni documentos A.

**Ramas independientes**: nunca compartir rama ni lockfile. PR #8 tiene base en la rama A; revisiones y actualización frente a nuevos commits A deben coordinarse con B. No auto-merge y NO forzar rebase de otro propietario. Antes de cualquier integración, revisar contratos, evolución de dependencias, conflictos y CI. La regla .github/workflows/movete-architect-b-boundary.yml es un gate, no sustituto de revisión humana.

**Documento de división de 13 bloques:** docs/handoff/DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md

## 3. HISTORIAL DE BACKEND QUE EXISTÍA ANTES DE G16 — G0 A G15

**Carpetas:** apps/mobility-expo/server/** y apps/mobility-expo/docs/backend/staging_only/**. Para detalles finos consultar los handoffs históricos al final. En general, contratos/fixtures STAGING no equivalen a servicios provisionados.

| Fase | Implementación y propósito | Prueba / limitación |
|---|---|---|
| G0 | Scaffold de Auth/users/roles **sintéticos** para PostgreSQL 16 CI; guardas contra BD real | NO es una migración de Auth productiva |
| G1 | baseline Supabase aislado; roles y perfiles, ubicación, almacenamiento privado inicial, RLS y defaults de pasajero | Bucket inicial solo contempla licencia; reglas de Storage requieren verificación antes de QA remoto |
| G2 | aplicaciones de conductor/vehículo, compliance AUTO/MOTO, revisión administrativa, inventario pendiente, auditabilidad, preflight de licencia/seguros/ubicación | No identifica documentación real ni valida derecho comercial local por sí mismo |
| G3 | solicitudes/transiciones de viajes AUTO de demostración, idempotencia y estado persistido | No hay tráfico comercial ni mapa en vivo |
| G4 | radar candidatos, enrutamiento vial inyectado, ofertas privadas AUTO, aceptación de un ganador, outbox push y gateway HTTP autenticado; concesiones/locks | Proveedor push real y receipts dispositivos pendientes |
| G5 | cadena de custodia de envíos, remitente, tipos/dimensiones/vehículo, recogido/entregado, comprobantes y control de repartidor | Solo casos sintéticos; no entregas comerciales reales |
| G6 | órdenes de comercios, sucursal, stock/categoría y estados de pedidos | Falta integración de catálogos de comercios y UI cliente con backend real |
| G7 | tarifas Gs versionadas y categorías diferenciadas; pagos simulados, comisiones/ledger y repositorios/gateway | NO dinero, PSP, pasarela, factura o liquidación real |
| G8 | incidentes y SOS, suspensiones, revisión/auditoría operativa en SQL/gateway | No centro de respuesta real, policía, seguro ni telefonía SOS |
| G9 | gestión de comercio: onboarding, review, sucursales/catálogo, permisos por propietario/manager y auditoría | Aprobación comercial real y abastecimiento de catálogo pendientes |
| G10 | despacho privado de repartidores AUTO/MOTO carga, elegibilidad/ruta, fanout limitado, outbox y aceptación persistida; bloquea atajo antiguo G5 | Exige gateway propio y vigilancia de carreras; sin proveedor real |
| G11 | catálogo OpenAPI 3.1 versionado de endpoints STAGING G2–G10 y ampliaciones posteriores | Contrato no equivale a endpoint desplegado, ni todas las respuestas están completamente tipadas para B |
| G12 | claim/ACK de push de entrega con SKIP LOCKED, exclusión de workers, limpieza de claims expirados, tests SQL y sesiones PostgreSQL independientes | ACK proveedor NO prueba recepción en móvil; primer diseño at-most-once |
| G13 | fencing de leases y outcomes ambiguos de push, revocación legado, prueba dos workers/claims | Dedupe con proveedor real, receipts e integración de dispositivos pendientes |
| G14 | ensayo Python de **dos repartidores** compitiendo sobre PostgreSQL real de QA; único ganador | Concurrencia probada solo en BD desechable |
| G15 | polling privado de ofertas courier como fallback del push, TTL e identidad destino | No descubre estado de un servidor remoto no desplegado |

Módulos adicionales verificados en server/**: gps-staging-contract.mjs (consentimiento, precisión/frescura), fare-engine.mjs, fare-verification.test.mjs, dispatch-synthetic.mjs, dispatch-persistence-contract.mjs, staging-zone-policy.mjs, staging-driver-eligibility.mjs, staging-operations-audit.mjs, staging-e2e-orchestrator.mjs, staging-ledger.mjs, g4-staging-runtime.mjs, g4-loopback-http-transport.mjs y repositorios de G5–G10.

**Reglas de precios:** AUTO y MOTO no deben tener el mismo precio solo por categoría; diferenciar pasajeros, carga y comercio. Referencias como comisión 15% AUTO y 12% MOTO son **supuestos de estudio, no tarifas aprobadas**. Investigación de Bolt/Uber PY, tiempos/km, picos, mínimos, comisiones reales e impuestos sigue abierta; documentar cotizaciones actuales comparables en distintas rutas antes de fijar precios.

## 4. TRABAJO REALIZADO POR ESTE ARQUITECTO DESPUÉS DE LA DIVISIÓN — G16 A G22

### G16 — Bandeja privada unificada Driver (AUTO + DELIVERY)

**SQL CI:** G16_DRIVER_PRIVATE_AUTO_POLL_POSTGRES_CI_ONLY.sql y su ASSERT. RPC service-role-only mobility_stage_poll_driver_auto_offers(driver UUID), con rol Driver exclusivo, destinatario de oferta/outbox coincidentes, viaje searching, TTL válido y exclusión de ofrecimientos expirados/aceptados.

**Backend:** server/g16-driver-private-inbox-repository.mjs combina G16 AUTO y G15 courier. server/g16-driver-private-inbox-gateway.mjs filtra por actor JWT confirmado, rol, rate limit y no expone PII, GPS ni datos de push. HTTP local GET /v1/staging/driver/inbox integrado al runtime y OpenAPI.

**Driver:** src/domain/driver-inbox.mjs, driver-inbox-session.mjs, driver-offer-decision.mjs, declaraciones .d.mts y pruebas unitarias. Lectura de ofertas privada y decisión accept/decline STAGING con requestKey UUID estable, sin enviar driverId/price/actor en body. No muestra LIVE ni confirma push/device receipt.

**Ensayos:** privacidad, caller incorrecto, expiración, replay, 401/403/429/503, CORS/cookies, worker y dos actores. PostgreSQL real de CI aprobó ofertas AUTO y entregas.

### G17 — Documentos privados y revisión administrativa inmutable

**SQL:** G17_PRIVATE_DRIVER_DOCUMENTS_POSTGRES_CI_ONLY.sql, assertions y tablas mobility_stage_driver_documents / mobility_stage_driver_document_reviews. Registra REFERENCIAS privadas y SHA, no bytes. Estados pending/approved/rejected; reviewer admin exclusivo; una revisión por documento y requestKey; audit append-only.

**RPC:** mobility_stage_register_driver_document, mobility_stage_review_driver_document, mobility_stage_read_driver_document_status. Grants restringidos a service_role; anon/authenticated no leen ni escriben tablas privadas directamente. El gateway deriva owner/admin desde JWT, no del cuerpo de petición.

**Rutas:** GET /v1/staging/driver/documents; POST /v1/staging/driver/documents/observe; POST /v1/staging/admin/driver-documents/review.

**Endurecimiento:** evidencia original de owner, hash, ruta y tipo inmutable después de registro; solo columnas de estado/revisión modificables por servicio. Solo 'licencia' registrable por ahora porque las demás categorías carecen de Storage aprobado. El admin NO puede dar autorización LIVE desde el teléfono.

**Driver:** src/domain/driver-documents.mjs y pruebas: consulta saneada de estado y denegación fail-closed.

### G18 — Inscripción exclusiva Driver

SQL G18_DRIVER_ROLE_ENROLLMENT_POSTGRES_CI_ONLY.sql y assertions. RPC mobility_stage_enroll_exclusive_driver requiere consentimiento explícito, clave idempotente y cuenta con rol pasajero inicial **único, sin historial de viajes o envíos como pasajero**; la transforma de modo transaccional a rol Driver exclusivo y crea auditoría inmutable pending_compliance.

Rutas/servicio: POST /v1/staging/driver/enrollment con bearer confirmado y actor derivado; gateway/repository g18-driver-enrollment-*.mjs. App Driver src/domain/driver-enrollment.mjs + tipos/tests; cero signup real y sin autocreación de compliance, licencias o vehículos.

### G19 — Observación de Storage privado, versionada y con escáner externo obligatorio

server/g19-private-driver-evidence-observer.mjs: createVerifiedPrivateDriverEvidenceObserver({getObjectMetadata,downloadObject,scanBytes}) verifica bucket privado, dueño, objeto/versión, longitud, MIME, magic, SHA-256, verdict 'clean' de un motor externo, y metadatos iguales antes/después. Limita 5 MiB y copia temporal en memoria; devuelve solo metadata apta para registrar G17.

**PRINCIPIO:** no instalar un scanner fake en QA compartido o LIVE. Escáner real y un backend de Storage con versionado/pinning garantizado **AÚN NO EXISTEN INYECTADOS**. El runtime usa privateEvidenceAdapters=null por defecto y RECHAZA registro. La presencia del observer no constituye KYC legal ni detección AV certificada.

Test g19-private-driver-evidence-observer.test.mjs + g19-evidence-to-g17-integration.test.mjs, con bytes mínimos únicamente sintéticos.

### G20 — Última licencia revisada obligatoria en AUTO y courier

SQL G20_DRIVER_KYC_PREFLIGHT_FENCING_POSTGRES_CI_ONLY.sql añade RPC interno mobility_stage_driver_current_license_approved y modifica ambos preflights reales de G2 AUTO y G5 courier sin quitar requisitos previos.

Exige que la evidencia MÁS RECIENTE de licencia esté approved con audit admin consistente, evitando rescatar una licencia antigua cuando existe otra pendiente/rechazada; rol driver único y admin reviewer único. Se revalida en **creación y aceptación** de ofertas AUTO/carga, junto a vencimiento real de licencia G2, seguros, ubicación y capacidad. Pasajero MOTO **cerrado**.

Ensayo G20_DRIVER_KYC_PREFLIGHT_ASSERT_POSTGRES_CI_ONLY.sql: denial por pendiente/rechazo, rectificación admin, aceptación bloqueada ante documento nuevo, vencimiento, dos clases de vehículo y protección de la asignación concurrente ya existente.

Backend GET /v1/staging/driver/license-readiness, service repository y gateway g20-driver-kyc-readiness-*; respuesta mínima booleano currentLicenseApproved, driverEligible=false, liveOperationsEnabled=false. App Driver src/domain/driver-license-readiness.mjs/tests/tipos. **Una licencia validada NO significa permiso comercial, seguro completo ni disponibilidad online.**

### G21 — Estado privado compartido y pantallas funcionales Driver en QA

Nuevo src/domain/driver-workspace.mjs + driver-workspace.d.mts + driver-workspace.test.mjs. Compone en una instantánea SOLO de lectura: Auth efímero, ofertas, estados KYC y resultado G20.

- No hace lecturas sin Auth adapter + URL; fase not-configured por defecto.
- Una lectura privada fallida deja todo offline, sin conservar ofertas/documentos previos.
- Invalida estado de manera inmediata en logout, cambio de cuenta o token/rol inválido.
- Generaciones monotónicas impiden que una respuesta HTTP antigua de cuenta A sobreescriba a cuenta B.
- Snapshots inmutables omiten JWT, userId, claves de Storage, hash, precios y PII; liveEnabled/driverEligible siempre false.
- Test de refresh simultáneo, listener fallido, timeout/offline, actor ajeno, JWT malformado, identidad cambiada.

Nuevo src/DriverWorkspaceProvider.tsx conectado al layout Expo Driver (app/_layout.tsx). Cambios en:
- app/index.tsx: estado de sesión y revisión licencia, revalidación manual; disponibilidad todavía interruptor LOCAL DEMO, no GPS real.
- app/documentos.tsx: borra datos privados al perder sesión, muestra últimos estados KYC autorizados; formulario nombre/placa solo borrador local, sin upload.
- app/ofertas.tsx: bandeja AUTO y envíos únicamente del actor verificado, cuenta regresiva TTL y cierre al caducar; decisiones comerciales deshabilitadas.
- app/ganancias.tsx permanece demostración sin ingresos reales.

**PUNTO DE HONESTIDAD:** en el layout Driver authAdapter=null y apiOrigin=null. Las pantallas están conectadas AL CONTROLADOR, pero no a Auth ni a un backend remoto instalado. Estado inicial visible: not-configured, sin ofertas/documentos privados.

### G22 — Puente a Auth real preparado, inyectable y opt-in

src/domain/driver-staging-auth.mjs + .d.mts + tests; src/domain/driver-staging-auth-workspace.test.mjs (integración con G21).

createDriverStagingAuthAdapter({auth,apiOrigin,request,now}) pide SDK Auth público con getSession/getUser/onAuthStateChange, UUID, JWT con vigencia >30 s, cuenta confirmada y no anónima, mismo userId verificado por Auth. Luego GET privado /driver/license-readiness verifica **rol en backend**, no en metadata del móvil. La suscripción notifica eventos SIN devolver token al árbol de UI.

Adapter y los readers actuales aceptan SOLO http://127.0.0.1:puerto LOCAL QA; NO aceptar URL remota por configuración improvisada. En teléfono físico 127.0.0.1 apunta al teléfono, NO al servidor de escritorio. Auth real/seguridad de tokens, HTTPS STAGING aprobado y sesión de dispositivo todavía pendientes.

**G21/G22 demostraron composición con dobles de SDK/API** y test de cierre de sesión, revocación/cambio de actor y caída de red; no hubo acceso a usuarios, proveedores o claves de producción.

### Documentación G16–G22 ya existente

- docs/architecture/G16_DRIVER_PRIVATE_INBOX_AND_SESSION_QA_2026-10-22.md
- docs/architecture/G17_G18_DRIVER_IDENTITY_AND_PRIVATE_KYC_2026-10-22.md
- docs/architecture/G19_PRIVATE_DRIVER_STORAGE_OBSERVATION_2026-10-22.md
- docs/architecture/G20_CURRENT_LICENSE_KYC_ACCEPTANCE_FENCE_2026-10-22.md
- docs/architecture/G21_G22_DRIVER_SESSION_UI_AUTH_BRIDGE_2026-10-22.md

**No existe un SQL G19, G21 ni G22:** son capas Node/Driver. No existe una migración G14; G14 es ensayo de concurrencia. No asumir que todos los números son SQL desplegado.

## 5. ESTADO DE CLIENTE Y ADMIN WEB DE B — NO ADUEÑARSE

El segundo arquitecto (PR #8, 79e52792) ya creó/potenció:
- apps/movete-cliente: Expo separado, navegación para viajes, cotización, envíos, comercios, seguimiento, historial, pagos simulados, cuenta, soporte; adaptadores de sesión, idempotencia, quote, estado/revisión monotónica y expiración GPS, sin LIVE ni API real predeterminada.
- apps/movete-admin: WEB React/Vite independiente, panel con KYC, revisión, zonas, incidentes, y dashboard financiero Owner; modelo de autorización admin/owner/posible MFA en frontend, sin autoridad del servidor ni documentación real.
- docs/architect-b/STATUS_Y_CONTRATOS.md, QA_INTEGRACION_FRONTENDS_2026-10-22.md, OWNER_DASHBOARD_FINANCE_RBAC_2026-10-22.md.
- Pedido de contratos ISSUE #9: https://github.com/mezas3238-hue/Qore-mobile-/issues/9

**PENDIENTE PARA A** según B: DTOs de respuesta versionados (viajes/revisión, ETA/GPS, cotización/revisión/vencimiento, cancelación, historia, comercio/catálogo), Auth Passenger/Admin y MFA backend, RBAC de acciones, lectura de KYC/zonas/incidentes, informe financiero owner solo agregados desde ledger conciliado, staging seguro; evitar service_role en móviles/browser.

**FALTA JOB ADMIN WEB EN CI DE A:** .github/workflows/movete-apps-isolation.yml comprueba Driver y Cliente, no compila Vite Admin. A debe agregar job propio aislado usando carpeta de B SIN EDITAR archivos B, ejecutar npm install --no-audit --no-fund --ignore-scripts, npm run check y npm run build, revisar package scripts antes, y comprobar resultados en GH Actions. No declarar Admin certificado antes del SUCCESS real.

**Integración de ramas:** PR #8 ha divergido respecto a A. NO hacer merge/rebase/cherry-pick sin coordinación de propiedad, revisión de los contratos y autorización del Owner.

## 6. PROBLEMAS ENCONTRADOS Y RESUELTOS — NO REPETIR INVESTIGACIÓN

1. **G1 asigna rol passenger por defecto** al crear auth.users, incluso si las pruebas quieren un usuario Driver o Admin. Se corrigieron los fixtures G12/G14/G16/G17/G18 para quitar el rol sintético anterior y crear un rol exclusivo. G18 propone transición controlada; no mezclar roles.
2. **G16 SQL** tuvo referencia PL/pgSQL ambigua a offer_id en real-chain; se calificaron columnas con alias. SQL cadena SUCCESS.
3. **G16/G18 fixtures** chocaron con G1 por INSERT duplicado/default de pasajero; se reemplazaron roles sintéticos o se comprobó el default sin duplicarlo.
4. **G20** reusaba conductor con un viaje ficticio ya aceptado, chocando con la restricción de un viaje activo; el test cierra previamente ese viaje en lugar de debilitar el índice. La protección de producción permanece.
5. **G20 UUID Node** omitía un segmento, rechazaba incluso UUID válidos; se corrigió patrón canónico 8-4-4-4-12 y se reejecutó CI.
6. **G12 push** inicialmente quedó en estado at-most-once/worker desconocido tras claim; G13 añadió fencing/lease y resolución de estados ambiguos, sin prometer exactamente una notificación recibida.
7. **G17** empezó solo con metadata privada y observador nulo; G19 incorporó versiones de objeto y scanner inyectado, SIN instalar un proveedor/escáner real.
8. **Riesgo de KYC antiguo**: G2 licencia aprobada sin consultar evidencia G17 actual; G20 lo exige al crear/aceptar.
9. **Apps mezcladas**: inicialmente existía laboratorio Expo mixto; se crearon dos apps separadas + comprobador CI de límites, paquetes/deep links diferentes.
10. **Falsas apariencias de LIVE**: UI Driver adaptada para enseñar no-configured, offline, sin sesión o estado QA honesto; ninguna operación comercial habilitada.
11. **CI B** validó separación de archivos pero no Admin build; no extrapolar éxito de Expo a web Admin.

**Atención:** la solución de fixtures no sustituye un proceso auditado real de onboarding, revocación y migración en una BD aprobada.

## 7. PROBLEMAS ABIERTOS, RIESGOS Y BLOQUEOS VERDADEROS

**P0, seguridad/operación:**
- No existe entorno STAGING remoto certificado y autorizado que contenga G17/G18/G20; los SQL **solo existen/testean** en PostgreSQL 16 desechable. Las migraciones con nombre DO_NOT_APPLY_PRODUCTION / CI_ONLY jamás ejecutarse contra DB remota sin revisión y orden.
- Auth Driver real, cuentas, confirmación, sesión móvil, revocación, rotación, TLS, manejo de credenciales publicables y device-keystore NO conectados. El puente G22 es opt-in/inyección.
- El endpoint local QA solo escucha 127.0.0.1. No expone endpoint HTTPS teléfono. No usar URL insegura ni inventar credenciales de Supabase.
- Sin observación Storage garantizada por versión + scanner real de malware/imagen; por eso G17 observe sigue bloqueado. No usar escáner fake ni procesar identificaciones reales.
- No se ha demostrado legalidad nacional para MOTO pasajeros, capacidad de seguros/permiso municipal, farmacia regulada, T&C, privacidad y retención.
- No hay PSP ni cobros reales, ni reconciliación bancaria/facturación, ni soporte real de incidentes críticos/SOS.
- No hay credenciales/proveedor push real ni confirmación de entrega a dispositivo; push ACK de proveedor no equivale a recepción, sin false claims.
- Sin apps Android/iOS firmadas, pruebas de GPS real/restricciones background, redes móviles y reconexiones; Expo web export NO basta.

**P0/P1, ingeniería/concurrencia/integración:**
- Reconciliación de estados de ofertas y decisiones con push pérdida/doble recepción/out-of-order, provider dedupe real, permisos y actor, reintentos con requestKey estable, timeout y carrera en dos dispositivos.
- KYC: revisión/expiración documental, seguros, vehículos, identidad/fraude, consentimientos, revocación y disponibilidad por zona; lectura admin privada y accesos temporales.
- Definir migrations baseline repetibles/idempotentes, rollback y estrategia evolutiva para STAGING distinto del CI, sin romper G1/G2.
- Exposición de DTOs completos a B: viaje/cotización/envío/orden/estado pago/entrega/recibo, historial, RBAC/MFA Admin/Owner. Abrir issue/especificación revisable sin cambiar UI B.
- G6/G7/G8/G9 necesitan E2E adverso multi-actor sobre integración full-schema/ambiente autorizado; su presencia en catálogo no certifica flujos reales.
- Falta job Admin web independiente en CI A; B no puede modificar .github/.
- Ramas A y B divergentes; sincronización contractual y pruebas conjuntas bajo PRs DRAFT sin fusionar.
- Cifras de comisión/tarifa 15% AUTO / 12% MOTO y valores unitarios de propuestas antiguas **no ratificados**; investigar precios Bolt/Uber PY documentados antes de reglas económicas.
- Cobertura geográfica != conductores disponibles; geofence/piloto local por zona, no activar todo Paraguay por defecto.

## 8. ROADMAP EJECUTABLE PARA EL SUCESOR A (ORDEN Y DEFINITION OF DONE)

### A0 — Verificar HEAD y no perder tiempo
1. Abrir PR #7 y SHA actual. Leer este handoff, las decisiones de dos arquitectos y docs/architecture/G21_G22... antes de editar.
2. Consultar runs **del nuevo SHA**, identificar jobs de Node/PostgreSQL/Expo/aislamiento. Asegurar que todos los cambios de A queden en rutas A. PR siempre DRAFT.
3. Leer issue #9 y status B en su rama. Identificar DTOs/bloqueos sin editar sus carpetas.
4. Repetir un ciclo: implementar código funcional + test + commit + CI + corregir fallo. No abrir handoff nuevo hasta un hito o petición del Owner.

### A1 — CI Admin web, primera tarea paralelizable sin credenciales (P0)
1. Inspeccionar apps/movete-admin/package.json **en rama B** para scripts check/build. Nunca cambiarlo.
2. Añadir en .github/workflows/... **de A** job/admin-web separado o workflow de PR B que checkout rama del PR y haga install, check, build en apps/movete-admin; sin secretos ni despliegue.
3. Verificar CI real en PR #8, no reportar SUCCESS si solo corrieron boundary/two-app checks. Cuidar que checkout de PR B lea código B aunque Admin no exista aún en rama A.
4. B corrige sus propios errores de frontend; A corrige solo workflow y backend.

### A2 — DTOs de contrato B / issue #9 (P0)
1. Generar DTOs de respuesta estrictos, ejemplos sintéticos y status/error codes para AUTH, RIDER, TRIP STATUS/CANCEL, FARES, DELIVERY, MERCHANT, PAYMENT, HISTORY, KYC ADMIN, ZONES, INCIDENTS. Usar OpenAPI 3.1 como base única.
2. Limitar identidades y precios a valores derivados de Auth/DB; no aceptar driverId, passengerId, senderId, adminId, fare/commission inventados por cliente.
3. Añadir test de contrato que demuestre la equivalencia real ruta HTTP ↔ esquema ↔ permiso RLS ↔ actor/verificación ↔ expiración.
4. Publicar issue/tabla de cambios para B y dejarle integrar exclusivamente frontend; no importar código server al bundle.

### A3 — Auth Driver STAGING (P0, requiere ambiente autorizado)
1. Revisar y aprobar proveedor Auth/URL STAGING privado/HTTPS por el Owner. Sin autorización, mantener no-configured y avanzar en tests de SDK/Auth inyectado.
2. Separar app Driver/Cliente, exclusividad Driver vs pasajero, credenciales publicables (no service_role), refresh/revocación, secure storage/device-keystore, cambio cuenta/recuperación y logout.
3. Ligar G22 al layout de Driver solo en configuración revisada, con feature flag false por defecto fuera de QA autorizado.
4. E2E de cliente/servidor: JWT válido/expirado, cuenta ajena, role downgrade, user swap con respuesta tardía, baja, desconexión y polling.
5. No habilitar aceptaciones ni disponibilidad online por un simple login.

### A4 — Documentos, vehículos y KYC real (P0, requiere Storage/escáner aprobados)
1. Construir proveedor getObjectMetadata/downloadObject con versionado inmutable y propiedad verificable, integrarlo a G19 y usar malware scanner real de imágenes/bytes con cuarentena y límites.
2. Ampliar Storage por tipo documental con migraciones de permisos revisadas: licencia, identidad, cédula verde, seguros, inspección, habilitación. Nunca aceptar documentos directamente con flags proporcionados por el móvil.
3. Retención/caducidad, cifrado, URLs temporales auditadas y permisos de revisión admin por acción, sin exposición de PII.
4. Conectar G17 a aprobación real con G2 y G20, renovación/rechazo, suspensiones y recurso del conductor; pruebas multiusuario y de carreras.
5. UI Driver permite carga solamente cuando existe ambiente validado, caso legalmente autorizado y consentimiento explícito.

### A5 — Flujo Driver funcional STAGING (P0/P1)
1. Ofertas G16 AUTO/DELIVERY y sus decisiones G4/G10: resync, TTL, idempotencia estable, aceptación privada y coherencia con G20 en cada transición. No ofrecer 'Aceptar' hasta integración de Auth y backend real.
2. Disponibilidad GPS consentida, actualización TTL, background, consent revocation y geofences; no mostrar disponibilidad ficticia.
3. GPS/ruta/mapas/ETA verificados y actualizaciones de estado de viaje, courier pickup/delivered con evidencia privada.
4. Ganancias/liquidaciones sintéticas consumidas de ledger server-owned y formato entero Gs; no inventar saldo ni calcular comisión en frontend.
5. Navegación, permisos y pruebas adversas Android/iOS sintéticas. Conservación y restauración segura al cambiar de app/red.

### A6 — Backend central para Cliente/Admin (P0/P1)
1. Servicios AUTO, MOTO carga y comercios con cálculo de tarifa versionada por tipo; revisión económica y cotizaciones reales locales pendientes Owner.
2. Endpoints de Rider/Envios/Comercios/Pagos simulados/Historia con response DTO de estado monotónico, idempotencia y autorización RLS; B conecta UI.
3. Admin web: endpoints KYC/vehículos/zonas/incidentes/reportes con MFA y permisos de acción; auditoría siempre en servidor.
4. Owner financiero: solo lectura agregada conciliada, rol owner del lado servidor + MFA, sin heredar permiso de KYC, sin exposición de cuentas/documentos; no inventar ganancias. Ver solicitud de B en OWNER_DASHBOARD_FINANCE_RBAC.
5. OpenAPI y Node/PG E2E con múltiples identidades; client adapter B NO es certificado de backend.

### A7 — Certificación de QA y lanzamiento (requiere aprobación expresa)
1. Suite reproducible PostgreSQL 16 descartable + staging aislado con datos ficticios; roles, concurrencia multi-worker/courier, ACL/RLS, KYC, pricing, payments simulated, reversals, seguridad y procesos de recuperación.
2. Binarios Android/iOS distintos y Admin web, builds/releases y pruebas reales de dispositivos/red/latencia/estados/Push sandbox, GPS consentimiento y privacidad.
3. Legal Paraguay por zona/servicio, seguros, licencias, reglamentación MOTO, farmacias OTC, protección de datos, impuestos, contratos y soporte.
4. Piloto geográfico controlado y rollback; **NO PRODUCCIÓN** ni ampliación nacional sin orden Owner.

### Definition of Done de un bloque

- Código en carpetas del responsable; PR DRAFT con SHA y enlace.
- Test positivo + negativo/adversarial que falle antes del arreglo y pase después; contratos/fixtures sintéticos; PostgreSQL real desechable cuando toca SQL.
- CI completo del SHA reportado con jobs SUCCESS y sin conclusión inventada.
- Ninguna llave, PII, KYC real, push/PSP/GPS LIVE ni SQL remoto.
- Estado de lo completado claramente diferenciado de bloqueos y requisitos de autorización.

## 9. COMANDOS / ARCHIVOS DE ENTRADA — NO INVENTAR OTRO REPO

**GitHub (soberano):**
- Branch A: https://github.com/mezas3238-hue/Qore-mobile-/tree/feature/mobility-monorepo-isolated-20261016
- PR A: https://github.com/mezas3238-hue/Qore-mobile-/pull/7
- PR B: https://github.com/mezas3238-hue/Qore-mobile-/pull/8
- CI A: https://github.com/mezas3238-hue/Qore-mobile-/actions
- Issue de contratos B→A: https://github.com/mezas3238-hue/Qore-mobile-/issues/9

**Matriz/puertas CI:**
- .github/workflows/mobility-ci.yml
- .github/workflows/mobility-staging-node-contracts.yml
- .github/workflows/mobility-g4-postgres-disposable.yml
- .github/workflows/movete-apps-isolation.yml
- .github/workflows/movete-architect-b-boundary.yml
- scripts/check-mobile-boundaries.mjs
- apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json

**Verificaciones locales si un entorno de archivos autorizado está conectado:**
- cd apps/movete-driver && npm install --no-audit --no-fund --ignore-scripts && npm run check && npx expo export --platform web
- cd apps/movete-cliente && npm install --no-audit --no-fund --ignore-scripts && npm run check && npx expo export --platform web  [ejecutar por B, A no modifica archivos]
- cd apps/mobility-expo && npm run check / revisar scripts reales del package.json antes de usar
- PostgreSQL: ejecutar solo dentro del workflow GitHub Actions disposable con guardas de qore_disposable_chain; **jamás usar conexiones SQL remotas por analogía**.
- Admin web en rama B: revisar package scripts primero; pendiente job de A.

**Documentación histórica obligatoria:**
- docs/handoff/DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md
- apps/mobility-expo/docs/handoff/HANDOFF_MAESTRO_WORK_MOVETE_FACIL_INFRAESTRUCTURA_2026-10-22.md
- apps/mobility-expo/docs/handoff/HANDOFF_MAESTRO_INTEGRAL_TARIFAS_INFRAESTRUCTURA_2026-10-22.md
- apps/mobility-expo/docs/handoff/HANDOFF_MAESTRO_CONTINUIDAD_G12_CI_VERDE_2026-10-22.md
- docs/architecture/G16_DRIVER_PRIVATE_INBOX_AND_SESSION_QA_2026-10-22.md
- docs/architecture/G17_G18_DRIVER_IDENTITY_AND_PRIVATE_KYC_2026-10-22.md
- docs/architecture/G19_PRIVATE_DRIVER_STORAGE_OBSERVATION_2026-10-22.md
- docs/architecture/G20_CURRENT_LICENSE_KYC_ACCEPTANCE_FENCE_2026-10-22.md
- docs/architecture/G21_G22_DRIVER_SESSION_UI_AUTH_BRIDGE_2026-10-22.md
- docs/architect-b/* SOLO EN BRANCH B, para consulta.

## 10. MENSAJE LISTO PARA PEGAR EN UN NUEVO CHAT

Soy el propietario de QORE Mobile / Movete Fácil. Continuá como **ARQUITECTO A** del repositorio GitHub mezas3238-hue/Qore-mobile-, en branch feature/mobility-monorepo-isolated-20261016 y PR #7 DRAFT. Primero leé el HANDOFF_MAESTRO_ARQUITECTO_A_G0_G22_MOVETE_FACIL_2026-10-22.md y el documento DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md bajo docs/handoff. Verificá HEAD y CI. Tenés exclusividad de Backend, SQL, Auth/RLS, contratos, GPS, dispatch, Driver y .github; **NO toques** apps/movete-cliente, apps/movete-admin ni docs/architect-b, reservados a Arquitecto B en PR #8. G21/G22 ya conectan pantallas Driver con un controlador de sesión seguro y puente Auth inyectable, pero sin credenciales reales ni conexión LIVE. Prioridad: cierre de CI Admin para B, DTOs/código backend solicitado en issue #9 y continuar Auth/Storage/KYC/Driver en QA con tests reales. Dos apps móviles separadas, Admin web separado; Lovable solo UI posterior. Ningún merge, deploy, VPS, SQL remoto, pagos ni operaciones LIVE sin orden expresa. **No hagas otro handoff como primer trabajo; seguí implementando y probando cambios efectivos y reportá SHA + workflow SUCCESS.**

---
**Fin del handoff maestro.** Mantener el PR #7 abierto y DRAFT. Este documento no sustituye el código ni la verificación del nuevo HEAD: es la transferencia verificable a partir del commit base 29885d1c.