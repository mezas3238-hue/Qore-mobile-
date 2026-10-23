# QORE MOBILE / MOVETE FÁCIL — HANDOFF MAESTRO INTEGRAL G22

**Fecha de corte:** 22 de octubre de 2026, Paraguay.
**Estado:** handoff para INICIAR NUEVO CHAT, mantener continuidad 100% y ejecutar trabajo de construcción; no es autorización de LIVE.
**Repositorio soberano GitHub:** mezas3238-hue/Qore-mobile-
**Rama Arquitecto A:** feature/mobility-monorepo-isolated-20261016
**PR Arquitecto A:** https://github.com/mezas3238-hue/Qore-mobile-/pull/7 — OPEN DRAFT, NO MERGED.
**HEAD Arquitecto A verificado ANTES de este documento:** 29885d1c2b3c4b8c831bb27e160df6d1f3d25a12.
**Rama Arquitecto B:** feature/mobility-cliente-admin-parallel-20261022
**PR Arquitecto B:** https://github.com/mezas3238-hue/Qore-mobile-/pull/8 — OPEN DRAFT, NO MERGED.
**HEAD Arquitecto B verificado:** 79e52792d96bec6b41875b960f37a99a0e9aaa04.
**Issue de contratos abiertos B→A:** https://github.com/mezas3238-hue/Qore-mobile-/issues/9.
**Documento original de división:** docs/handoff/DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md.

## 0. ORDEN DE CONTINUIDAD Y REGLAS NO NEGOCIABLES

**El nuevo arquitecto debe continuar trabajando en el mismo turno y en los sucesivos, sin pedir confirmaciones reiterativas, salvo bloqueo REAL (credenciales, aprobación legal, cambio económico, despliegue o acceso no disponible).** Primero inspeccionar GitHub y CI más recientes, después crear código, pruebas y commits en una rama propia de A, manteniendo PR DRAFT. No inventar resultados, no confundir demo/UI, export web o contratos documentados con servicio desplegado y certificado.

**Decisión central Owner: dos APPS MÓVILES INDEPENDIENTES:**
1. **Movete Fácil Driver** — EXCLUSIVA conductores y repartidores. Proyecto: apps/movete-driver; Android com.movetefacil.driver; iOS bundle ID separado; esquema movetefacildriver.
2. **Movete Fácil Cliente** — EXCLUSIVA pasajeros, remitentes y compradores. Proyecto: apps/movete-cliente; Android com.movetefacil.cliente; iOS bundle ID separado; esquema movetefacilcliente.
3. **Admin web** — tercer proyecto WEB distinto, apps/movete-admin; NO es una tercera app móvil ni parte de Driver o Cliente.
4. **Backend único compartido** (Auth, PostgreSQL, Storage privado, despacho, GPS, tarifas Gs, envíos, comercios, ledger, seguridad), con identidad y autorización impuestas en servidor y permisos diferentes por actor.
5. **apps/mobility-expo es LABORATORIO HISTÓRICO MIXTO y harness CI, NO la app final**. No borrar porque contiene las migraciones, contratos y suites validadas. Extraer/adaptar infraestructura a dos apps sin volver a mezclarlas.

**No realizar bajo ninguna circunstancia sin orden expresa Owner:** MERGE, LIVE, despliegues, VPS, publicación Android/iOS, SQL remoto, pagos reales, notificaciones push reales, captación de datos personales reales, KYC real, mover secretos a código o liberar viajes MOTO de pasajeros. Trabajar solo con datos sintéticos, PostgreSQL desechable y entorno STAGING/QA local aislado. PR siempre DRAFT.

## 1. DIVISIÓN DE PROPIEDAD ENTRE DOS ARQUITECTOS (NO PISARSE)

### ARQUITECTO A — este hilo y siguiente chat

Propiedad EXCLUSIVA:
- apps/movete-driver/**: aplicación móvil de conductores y repartidores, acceso, documentos, vehículos, ofertas, navegación, ganancias.
- apps/mobility-expo/**: servidor experimental STAGING, SQL G0-G22, OpenAPI, pruebas Node/PG, simuladores y contratos.
- backend/**, database/**, packages/** si nacen: servicios centrales, RPC, identidad, RLS, auditoría y dominios.
- scripts/**, .github/**, docs/architecture/**, docs/handoff/**, raíz del repo: CI, reglas y handoffs.
- Infraestructura de endpoints y permisos para Cliente/Admin cuando B lo pida, SIN editar sus pantallas.

**Arquitecto A NO puede editar:** apps/movete-cliente/**, apps/movete-admin/**, docs/architect-b/**. Si necesita cambiar comportamiento del frontend B, documentar el contrato, comentar issue #9 y que B haga su propio cambio.

### ARQUITECTO B — colaborador paralelo

Propiedad EXCLUSIVA:
- apps/movete-cliente/**: pasajeros, solicitud AUTO, envíos, comercios, cotizaciones, seguimiento, historial, pagos simulados, soporte, Auth Passenger.
- apps/movete-admin/**: panel WEB; KYC read-only/decisiones autorizadas, zonas, incidentes, seguridad, vista financiera Owner, RBAC frontend.
- docs/architect-b/**: handoff y QA de B.

**Arquitecto B NO toca:** SQL/RPC/backend/Driver, .github, scripts, contratos centrales, docs/handoff o raíz. Si necesita API, abrir issue y redactar DTO propuesto en su carpeta; solo A certifica e implementa servicio central.

Rama B tiene PR #8 DRAFT sobre rama A; no comparar ciegamente con main ni integrar por fuerza. Al corte, ramas DIVERGIDAS: B 53 commits ahead / 98 behind de A (resultado temporal de compare; recalcular antes de integrar). Conservar trabajo de ambos, no pisar lockfiles ni resolver conflictos escogiendo unilateralmente código de B o A. Coordinar mediante interfaces versionadas/issue #9 y CI de control de propiedad.

Las reglas automáticas: .github/workflows/movete-apps-isolation.yml, .github/workflows/movete-architect-b-boundary.yml y scripts/check-mobile-boundaries.mjs. A debe adicionar un job específico de test/build de apps/movete-admin sin modificar archivos exclusivos de B.

## 2. OBJETIVO DE NEGOCIO Y ALCANCE APROBADO

Movete Fácil, Paraguay primero, habilitación por zonas con cobertura != disponibilidad efectiva. Servicios:
- Viajes en AUTOMÓVIL: categorías conforme capacidad/compliance, búsqueda de conductores elegibles, notificación privada, aceptación atómica, identidad/vehículo visibles al pasajero solo cuando asignación está confirmada, GPS y estados transaccionales.
- Viajes en MOTOCICLETA: **NO ACTIVAR pasajeros** hasta aprobación normativa municipal/seguros/compliance. No confundir con MOTO carga.
- Envíos particulares AUTO/MOTO: origen/destino, pesos/dimensiones/categoría, recogida/custodia/prueba de entrega, estados y control de carga permitida.
- Entregas comerciales: supermercados, farmacias, restaurantes y otras empresas, con órdenes, stock/custodia e identidad segregada por comercio. Medicamentos de receta y productos restringidos requieren políticas específicas; no asumir disponibilidad legal.
- Comisiones/tarifas competitivas en Gs con categorías auto/moto distintas, tarifas versionadas, simulación de pagos, ledger, reembolsos y liquidaciones; **ninguna cifra/porcentaje o beneficio real se fija en app ni se inventa**.
- Seguridad integral: documentación central privada de conductores, consentimiento GPS, expiración de localización, accidentes/incidentes, auditoría y roles segmentados.
- Lovable SOLO aportará interfaces definitivas de los dos productos por separado, después de consolidar backend y funcionalidad; aún no hay integración Lovable final verificada.

## 3. HISTÓRICO GLOBAL ANTERIOR — FUNDACIONES YA CONSTRUIDAS

Etapa inicial del repositorio (18–22 octubre):
- Handoffs técnicos del monorepo y plataforma QORE Mobile; contratos G1–G4, >200 tests automáticos en hitos tempranos y múltiples workflows PostgreSQL/STAGING/Expo verdes.
- Motor base: GPS consentido; despachos por candidatos; tarifas enteras Gs; zonas, validación de elegibilidad; reserva/aceptación; persistencia; auditoría; comisiones y simulaciones.
- CI PostgreSQL efímero y servidor local Node STAGING con bloqueo de producción.
- Separación posterior de dos apps Expo independientes, identificadores Android/iOS únicos, distintos package.json/app.json/routes y test check-mobile-boundaries; conservar legacy lab.
- Documentación de división de trabajo publicada y PR #8 abierto en rama independiente.

No afirmar que los primeros handoffs significan que todas las operaciones reales están desplegadas. Son ingeniería, SQL de laboratorio y pruebas aisladas.

## 4. CATÁLOGO BACKEND POR GATE: G0 → G22

**Referencias principales:** apps/mobility-expo/docs/backend/staging_only/**, apps/mobility-expo/server/**, apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json.

**G0** — scaffold sintético PostgreSQL 16: roles Auth/RLS para CI desechable. Nunca usar como modelo de credenciales reales.

**G1** — baseline Auth/roles, Storage privado inicial de licencias, permisos y conceptos de usuario/ubicación. G1 genera rol pasajero inicial; su conversión a Driver se controla con G18. No mezclar dos roles accidentalmente.

**G2** — compliance Driver + vehículo AUTO/MOTO, licencias, seguros, inspección y autorización municipal, consentimiento GPS, service preflight. Diferenciar MOTO pasajeros de carga MOTO. Denegar cuando alguna condición vence.

**G3** — ciclos de viaje AUTO DEMO: solicitud, estados, cambios idempotentes, dueño pasajero y controles de una asignación activa. El entorno es DEMO, no despacho en carretera.

**G4** — ofertas privadas AUTO: despacho a conductor elegible, expiración, aceptación atómica, reintentos; outbox/ACK de notificación servidor. ACK proveedor NO significa recepción por teléfono.

**G5** — entrega particular: transporte AUTO/MOTO cargo, peso/dimensiones, custodia/pickup/entrega, comprobantes, rechazo de carga fuera de política.

**G6** — merchant/orders/catálogos bajo laboratorio. Integración empresarial real y gestión de stock siguen pendientes.

**G7** — simulaciones de pagos, tarifas y ledger; NO cobros/PSP reales ni liquidaciones reales. Todo importe confirmado siempre nace en servidor.

**G8** — seguridad/incidentes y controles de abuso en QA.

**G9** — administración de comercios, permisos, flujos de gestión y validación de órdenes; aún no plataforma comercial LIVE.

**G10** — ofertas de envío privadas y aceptación/rechazo; outbox por repartidor.

**G11** — OpenAPI STAGING, adaptadores de gateway y validadores de contratos; es documentación de endpoints de QA y servidor local, no promesa de URL pública.

**G12** — worker de claim/ACK privado para push de envíos, transacciones SKIP LOCKED, ACK solo del worker dueño, barrido de claims expirados; persistencia y privacidad. Nunca afirmar que proveedor-ACK = device receipt. Ensayos G0-G12 real-schema en PostgreSQL.

**G13** — protección de reintentos/recuperación de mensajes ambiguos con idempotencia controlada; no reenvíos ciegos capaces de duplicar notificaciones.

**G14** — competición concurrente de múltiples couriers en PostgreSQL con dos conexiones: único ganador; prueba de races y rechazo de doble aceptación.

**G15** — polling privado de ofertas de envío en caso de push perdido; JWT/rol/identidad servidor y TTL de oferta. Entrega solo IDs y fecha de caducidad, no datos personales.

**G16** — nueva bandeja privada unificada Driver: viajes AUTO + DELIVERY, GET /v1/staging/driver/inbox. Control de rol Driver exclusivo, auth JWT, rate limit, sin datos de pasajero; fuente de verdad en PG. Aceptar/rechazar QA por rutas separadas con requestKey UUID estable, no desde UI LIVE. Cliente móvil Driver de solo lectura y controlador de sesión que borra ofertas al logout/cambio de cuenta. Documentación: docs/architecture/G16_DRIVER_PRIVATE_INBOX_AND_SESSION_QA_2026-10-22.md.

**G17** — registro privado de evidencia conductores y revisión admin:
- Tabla documentos: metadatos mínimos (owner, object key, tipo, SHA256, bytes, fecha, estado pending/approved/rejected).
- Tabla audit de revisión append-only: revisor admin, motivo y requestKey de idempotencia.
- Sólo service_role manipula RPC; anon/authenticated no acceden directamente.
- Driver lee estado saneado, sin foto, hash, ruta Storage ni identidad del revisor; revisión ADMIN obligatoria, jamás autorrevisión.
- Sólo documentos de **licencia** habilitados dentro del contrato actual; resto de clases requieren política Storage auditada. **Registrar documento no habilita conductor**.
- API: GET /v1/staging/driver/documents; POST /v1/staging/driver/documents/observe; POST /v1/staging/admin/driver-documents/review.
- Sin observador real de Storage la subida/observación se rechaza.

**G18** — inscripción EXCLUSIVA de Driver con consentimiento explícito y auditoría:
- RPC de servicio convierte cuenta con rol pasajero inicial, **sin historial de pasajero**, a un solo rol Driver; bloquea roles múltiples/Admin/doble solicitud.
- POST /v1/staging/driver/enrollment con bearer JWT; no recibir userId/rol desde móvil.
- Estado **pending_compliance** y driverEligible=false. NO crea licencia, vehículo ni disponibilidad. Contrato Driver con requestKey estable.
- Si existen viajes/entregas como pasajero, requiere identidad separada, no reutilizar cuenta híbrida.

**G19** — verificador de documentación privada con triple adaptador de servidor: getObjectMetadata, downloadObject version-pinned y scanBytes antimalware.
- Comprueba bucket privado, titular, objectId, versión inmutable, bytes reales <= 5 MiB, MIME/cabecera, SHA256, verdict clean del escáner y reread de metadatos para detectar sustitución.
- Runtime FAIL-CLOSED sin proveedor versión-inmutable/escáner REAL conectado. Tests con scanner sintético no prueban malware real.
- Endurecimiento de privilegios SQL: owner/object key/hash/bytes/categoría NO actualizables por service_role después de registrar evidencia; sólo campos acotados de revisión se actualizan.
- Documento: docs/architecture/G19_PRIVATE_DRIVER_STORAGE_OBSERVATION_2026-10-22.md.

**G20** — vínculo estricto licencia KYC **más reciente** ↔ elegibilidad preflight G2/G5:
- SQL CI-only G20_DRIVER_KYC_PREFLIGHT_FENCING_POSTGRES_CI_ONLY.sql. Función interna mobility_stage_driver_current_license_approved comprueba un rol Driver exclusivo, última licencia, revisión auditable por Admin, timestamps coherentes.
- Actualiza preflights AUTO y courier preservando controles G2/G5, por lo que ofertas **creadas antes** de un documento nuevo pendiente/rechazado NO pueden ser aceptadas mientras falle la condición.
- En pruebas se verificó vieja aprobada + nueva pendiente, rechazo y readmisión tras nueva aprobación, expiración legal G2, MOTO carga apta vs MOTO pasajeros prohibido.
- API de lectura propia Driver: GET /v1/staging/driver/license-readiness. Respuesta booleana sobre licencia revisada, pero driverEligible=false; no exponer documentos ni identidad de tercero.
- Cliente de Driver con bearer QA local, tests Node/PG/Expo. Documento: docs/architecture/G20_CURRENT_LICENSE_KYC_ACCEPTANCE_FENCE_2026-10-22.md.

**G21** — NUEVA integración de módulos de Drive en UI independiente:
- apps/movete-driver/src/domain/driver-workspace.mjs, .d.mts, .test.mjs.
- Controller de estado: consulta ofertas G16 + documentos G17 + licencia G20 como una sola fotografía coherente de UI, sin incluir JWT/PII/identidad en snapshot público.
- Fases: not-configured, signed-out, loading, connected, offline, authorization-required.
- Invalidación inmediata y protección de race por generación/epoch: logout, cambio de cuenta, role revoked, tokens vencidos y respuestas tardías NO resucitan ofertas/documentos anteriores.
- apps/movete-driver/src/DriverWorkspaceProvider.tsx: estado React compartido en layout; app/_layout.tsx lo envuelve.
- apps/movete-driver/app/index.tsx informa conexión/autorización de QA; app/documentos.tsx muestra estado saneado si hay sesión; app/ofertas.tsx muestra solo ofertas vigentes y cuenta regresiva, sin botones LIVE.
- El interruptor de disponibilidad es DEMO LOCAL; nunca publica GPS ni registra online Driver.

**G22** — NUEVO puente Auth preparado, aún **NO conectado en la app real**:
- apps/movete-driver/src/domain/driver-staging-auth.mjs, .d.mts, .test.mjs.
- SDK público Auth inyectado solo para STAGING autorizado, getSession con vencimiento, getUser(jwt) para verificar actor, rol Driver comprobado otra vez en backend mediante G20, callbacks de cambio de sesión sin revelar tokens.
- Rechaza URLs externas; solo http://127.0.0.1:puerto en QA. Los teléfonos físicos NO acceden al servidor de PC por 127.0.0.1.
- Prueba adicional **driver-staging-auth-workspace.test.mjs** une Auth G22 y controlador/UI G21: identidad verificada, consulta 3 servicios, logout, cambio de cuenta con rol no autorizado, desconexión, borrado del snapshot.
- El layout por defecto **NO inyecta SDK/Auth real**, por eso la pantalla está honesta en not-configured hasta que haya staging autorizado y conexión segura.
- Documento: docs/architecture/G21_G22_DRIVER_SESSION_UI_AUTH_BRIDGE_2026-10-22.md.

## 5. ESTADO EXACTO DE LAS DOS APPS / ADMIN EN EL CORTE

### DRIVER — Arquitecto A
**Existe proyecto independiente con validación CI**: apps/movete-driver, con pantallas Inicio, Documentación, Ofertas y Ganancias; UI de STAGING controlada por un controller común G21, capaz de mostrar snapshots saneados y vaciarlos por privacidad.

Implementados e integrados para QA: capa de lectura de bandeja G16, registro G18, consulta documental G17, readiness G20, adaptador G22, requestKey de decisiones G16 y controller de sesión/race.

**NO implementados/activados realmente en Driver**: login UI real con identidad del proveedor, Auth SDK instalado/provisionado, endpoint TLS accesible desde celular, alta con documentación física, subida segura/antimalware real, GPS online, trabajo comercial, pagos, push real, APK/IPA firmada, asignación efectiva en producción. Ganancias muestran 0 DEMO, no ledger real.

### CLIENTE — Arquitecto B, PR #8
B ha avanzado paralelamente sin tocar Driver: UI Expo Cliente con cuenta, solicitud AUTO, envíos, cotización, seguimiento, historial, comercios, pagos simulados y soporte; providers de sesión/cotización/experiencia; borradores y protección contra expiración, doble toque y datos ajenos.

**NO afirmar conexión backend real**: provider por defecto desconectado, Auth Passenger/no GPS real, DTOs y endpoints pendientes de A. Ver docs/architect-b/STATUS_Y_CONTRATOS.md y QA_INTEGRACION_FRONTENDS_2026-10-22.md en rama B para información más detallada y actualizada.

### ADMIN WEB — Arquitecto B, PR #8
Existe apps/movete-admin WEB con React/Vite: interfaz KYC, seguridad/incidentes, zonas, revisión, reportes y Owner Finance. Sesión diferenciada owner/admin y MFA propuesta; lectura en modo entrenamiento/sintético, sin acceso a documentos reales, fondos o aprobación persistida.

Backend A debe proveer contratos ADMIN autorizados; B solicita job CI independiente que ejecute npm run check y npm run build en apps/movete-admin. No equiparar éxito CI de apps móviles con Admin web certificado. Ver docs/architect-b/OWNER_DASHBOARD_FINANCE_RBAC_2026-10-22.md.

## 6. EVIDENCIA DE CI VERIFICADA EN EL CORTE (NO INVENTAR SUCCESS)

**HEAD A 29885d1c2b3c4b8c831bb27e160df6d1f3d25a12 — TODOS COMPLETED/SUCCESS**:
- QORE Mobility STAGING Node contracts run **#306**, ID 39887977273.
  https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39887977273
- QORE Mobility Expo isolated CI run **#845**, ID 39887977342.
  https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39887977342
- QORE G4 PostgreSQL disposable smoke run **#149**, ID 39887977155.
  https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39887977155
- Movete Facil two app isolation run **#188**, ID 39887977205.
  https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39887977205

HEAD B 79e52792d96bec6b41875b960f37a99a0e9aaa04:
- Architect B ownership boundary **#50** run ID 39890889314 COMPLETED/SUCCESS.
- Two app isolation **#198** run ID 39890889457 COMPLETED/SUCCESS.
- **No afirmar que Admin web build está certificado**: esos dos checks no equivalen a su build/QA E2E.

El commit que incluye ESTE handoff será posterior al HEAD A anterior. Verificar su SHA y CI de nuevo y actualizar reportes sin inventar resultados. Los SUCCESS anteriores prueban código y contratos en CI, NO funcionamiento comercial en teléfonos.

## 7. PROBLEMAS HALLADOS Y RESOLUCIONES YA EJECUTADAS

1. Antes se mezclaban pantallas piloto; separación realizada en dos proyectos Expo + Admin web separado. Legacy mobility-expo se conserva solo como harness.
2. Autenticación inicial crea rol pasajero; fixtures Driver produjeron doble rol y fallaron. Se corrigió QA y G18 creó enrolamiento controlado de un rol exclusivo, con historial de pasajero bloqueado.
3. Push ACK del proveedor no garantizaba entrega a teléfono: se distinguieron receipt confirmado vs ticket proveedor y G15/G16 añadieron polling privado.
4. Reclamos concurrentes/reintentos ambiguos podían duplicar operaciones: G12/G13 fencing y G14 dos conexiones para probar un solo courier ganador.
5. Driver AUTO sin fallback cuando falla push: G16 bandeja conjunta privadas AUTO/DELIVERY, JWT y TTL.
6. Documentos podían registrarse como metadatos sin revisión administrativa: G17 estado pending y audit Admin inmutable.
7. Falta de escáner/Storage reales: G19 introdujo validación segura e inyección explícita, fail-closed sin proveedores.
8. Riesgo de editar propietario/SHA del documento: columnas G17 inmutables desde servicio, solo permite campos de revisión acotados.
9. Evidencia documental antigua aprobada mientras nueva está pendiente/rechazada: G20 usa documento MÁS RECIENTE y revalida al aceptar.
10. G20 CI detectó fixtures con rol duplicado creado por trigger G1 y conductor con viaje previo activo; se corrigieron fixtures respetando restricciones reales, sin aflojar índices ni permisos.
11. G20 gateway Node tenía validador UUID incompleto; se corrigió a UUID 8-4-4-4-12 y CI regresó verde.
12. Estado privado UI de Driver se mostraba solo como demo estática: G21 provider/UI integra 3 lecturas, borrado por logout y carreras de sesiones.
13. Auth real no conectada: G22 bridge independiente, requiere SDK público y servidor aislado con validación rol; sin credenciales la UI falla cerrado.
14. La app Cliente/Admin B progresa en rama divergente; NO intentar merge automático sin revisión ni pisar carpetas.
15. Estado documental aprobado no sustituye licencias con fecha, seguros, municipios, vehículo, zonas, consentimiento GPS ni status persistido completo.
16. Trabajos Expo exitosos comprueban TypeScript/pruebas/export web; **NO** equivalen a APK/IPA firmadas, instalación ni aprobación de tiendas.

## 8. BLOQUEOS REALES PENDIENTES — P0/P1/P2

### P0 — PASOS DE ARQUITECTO A PARA CONTINUAR DE INMEDIATO
1. Revisar HEAD real de PR #7 y latest CI antes de editar. No reiterar handoffs ni preguntar por decisiones ya aprobadas.
2. Actualizar y ampliar pruebas de integración reales G21/G22: expiración de sesión durante triple GET, eventos Auth, cuentas múltiples concurrentes, limpieza de última lectura, respuestas 401/403, fallos de red, race de render y pruebas de no contaminación de PII.
3. Completar seguridad real de frontend Driver sin activar servicios: definir contrato Auth configurado por entorno QA, safe token lifecycle, limpieza local, cancelar queries pendientes; no colocar service_role, email/password, usuarios reales o tokens en repo. Los adaptadores localhost son para QA, no usar como endpoint físico.
4. Entregar API Owner/Admin y Cliente pedidas por issue #9: contrato de respuesta versionado y pruebas para Passenger Auth + cancelación idempotente, quote PYG/version/TTL, rider status revision y ubicación consentida, history own-only, commerce, support; Admin MFA/RBAC y KYC queue sin PII, Owner ledger agregado conciliado.
5. Añadir job de CI Admin WEB en .github/** sin editar UI Admin del B, con npm install --ignore-scripts, npm run check y npm run build; corregir fallos bajo coordinación por issue, dejar B dueño de Admin code.
6. Refactorizar adaptadores de legacy backend a paquete común SOLO cuando exista contrato probado y una estrategia sin riesgo de doble mantenimiento, sin introducir imports cruzados desde Driver/Cliente.
7. Validar que G20 preflight cubra **todos** los caminos de despacho, reasignación, expiración, cancelación y aceptación, también después de revocación Auth/KYC. Ampliar pruebas reales de regresión SQL sin cambiar negocio.
8. Documentar cambios en docs/architecture y actualizar handoff en docs/handoff; commits en rama A y PR DRAFT.

### P1 — DEPENDENCIAS EXTERNAS / APROBACIONES OWNER
9. Cuenta/entorno STAGING aislado (Supabase u otro proveedor elegido) con endpoint HTTPS accesible desde dispositivos, credenciales publicables autorizadas, reglas JWT/revocación, secretos server-side fuera del código, sin usuarios reales.
10. Storage privado con objeto de versión inmutable y owner confiable, upload seguro firmado, verificación servidor SHA/MIME/tamaño, escáner malware/decodificación de imágenes real, retención/descarga temporal y permisos de revisores. G19 default debe seguir fail-closed.
11. KYC de documentos adicionales: licencia, identidad ambos lados, cédula verde, seguro, inspección, habilitación; políticas separadas por tipo/municipio/vencimiento. No abrir tipos a subida por mero cambio de enum.
12. Servicio geolocalización/mapas/rutas/precios basado en evidencia GPS con consentimiento, precisión y caducidad, geofencing por zonas y ETA fiable; cobertura nunca significa conductor disponible.
13. Push provider real con dedupe por idempotencyKey/reconciliación provider-side y confirmación explícita de recepción si disponible; jamás reenviar claim ambiguo a ciegas.
14. Políticas económicas aprobadas para Paraguay: precios AUTO/MOTO separados, distancias/tiempos, mínimos, demanda, envíos, comisiones, impuestos, liquidaciones. No inferir % Bolt/Uber ni inventar rentabilidad.
15. Cumplimiento local para pasajeros MOTO, seguros y operación de servicios regulados (farmacias, datos personales), con autorización Owner para cada zona.
16. Pruebas E2E móviles nativas con dispositivos reales, sesiones/roles sintéticos, GPS, reconexión, push, navegación, pruebas de seguridad; nunca proclamar funcionalidad 100% antes de esto.

### P2 — PRE-LANZAMIENTO/PRODUCCIÓN (SÓLO TRAS ORDEN)
17. Observabilidad, métricas, alertas, backups/restore, protección DDoS/rate-limits reales, runbooks incidentes, secrets manager, rotación, alta disponibilidad, DR, costo por transacción.
18. Integración de PSP real, fraude, chargeback, reembolsos, comisiones y conciliación auditable; Owner determina tasas y aprobación de pagos.
19. Administración web con RBAC/MFA y logs probados; zona activa comercial según verificación, no habilitación general arbitraria.
20. Diseño de UX definitiva en Lovable **solo después** de contratos confiables, entregando diseños separados para Driver y Cliente; asegurar código/export y QA propio de cada binario.
21. Build Android/iOS firmadas por aplicación, permisos/accesibilidad, privacidad/políticas de tienda, reviews, piloto cerrado y rollout zonal progresivo, solo con autorización Owner.
22. Revisión de seguridad externa, cumplimiento regulatorio, firma Owner de aceptación final.

## 9. PRIMERAS TAREAS CONCRETAS PARA EL PRÓXIMO ARQUITECTO A

**No pedir al Owner que repita información ni retroceder a planeamiento solamente. Ejecución técnica inmediata:**
1. Fetch PR #7, HEAD del branch A y tres/cuatro workflows más recientes; verificar CIs y si cambió base B.
2. Fetch issue #9 y documentación docs/architect-b/QA_INTEGRACION_FRONTENDS_2026-10-22.md / STATUS_Y_CONTRATOS.md en la rama B, para priorizar dependencia que desbloquee más pantallas de B.
3. Implementar **job CI específico para Admin web** (solo .github/**), ejecutar Node typecheck/build; si falla por fuente de B, reportar exacto y dejar corrección para B.
4. Completar y probar un **contrato de respuesta tipado de Rider status/cancel** y **Auth Passenger** en servidor, con roles y claims verificados, 401/403/409/429, revision/TTL, datos privados mínimos. Publicarlo en OpenAPI y en issue #9; nunca editar Cliente.
5. Continuar Driver G21/G22 con pruebas de expiración/Auth y pantalla segura, sin crear login ficticio; integrar endpoint solo si STAGING queda autorizado y TLS/config disponibles.
6. Endurecer SQL/G20 por caminos restantes de despacho; dar evidencia CI de revisión KYC durante aceptación y cancelación.
7. Mantener PR #7 DRAFT; no resolver PR #8 por merge automático, no entrar en carpetas B.

**Definición de terminado del próximo bloque:** commit GitHub verificable, ruta/contrato de API documentado, tests adversariales, CI comprobado SUCCESS en su SHA, lista de pendientes actualizada y cero archivos B tocados. Si algo no puede verificarse, declararlo pendiente, no SUCCESS.

## 10. RUTAS/REFERENCIAS PARA ORIENTACIÓN SIN BUSCAR A CIEGAS

- docs/handoff/DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md
- docs/architecture/MOVETE_TWO_MOBILE_APPS_2026-10-22.md
- docs/architecture/G16_DRIVER_PRIVATE_INBOX_AND_SESSION_QA_2026-10-22.md
- docs/architecture/G17_G18_DRIVER_IDENTITY_AND_PRIVATE_KYC_2026-10-22.md
- docs/architecture/G19_PRIVATE_DRIVER_STORAGE_OBSERVATION_2026-10-22.md
- docs/architecture/G20_CURRENT_LICENSE_KYC_ACCEPTANCE_FENCE_2026-10-22.md
- docs/architecture/G21_G22_DRIVER_SESSION_UI_AUTH_BRIDGE_2026-10-22.md
- apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json
- .github/workflows/mobility-g4-postgres-disposable.yml
- .github/workflows/mobility-staging-node-contracts.yml
- .github/workflows/mobility-ci.yml
- .github/workflows/movete-apps-isolation.yml
- .github/workflows/movete-architect-b-boundary.yml
- scripts/check-mobile-boundaries.mjs
- apps/movete-driver/app/_layout.tsx
- apps/movete-driver/app/index.tsx
- apps/movete-driver/app/documentos.tsx
- apps/movete-driver/app/ofertas.tsx
- apps/movete-driver/app/ganancias.tsx
- apps/movete-driver/src/DriverWorkspaceProvider.tsx
- apps/movete-driver/src/domain/driver-workspace.mjs
- apps/movete-driver/src/domain/driver-staging-auth.mjs
- apps/movete-driver/src/domain/driver-staging-auth-workspace.test.mjs
- apps/mobility-expo/docs/backend/staging_only/G20_DRIVER_KYC_PREFLIGHT_ASSERT_POSTGRES_CI_ONLY.sql
- apps/mobility-expo/server/g20-driver-kyc-readiness-gateway.mjs
- docs/architect-b/STATUS_Y_CONTRATOS.md **(leer en rama B)**
- docs/architect-b/QA_INTEGRACION_FRONTENDS_2026-10-22.md **(rama B)**
- docs/architect-b/OWNER_DASHBOARD_FINANCE_RBAC_2026-10-22.md **(rama B)**

## 11. PROMPT LISTO PARA EL NUEVO CHAT (ARQUITECTO A)

«Continúa como Arquitecto A de QORE Mobile / Movete Fácil desde el handoff maestro G22 en el repositorio mezas3238-hue/Qore-mobile-. Abre PR #7 DRAFT y verifica HEAD/CI recientes. Mantén dos apps independientes: DRIVER exclusivamente para conductores/repartidores y CLIENTE exclusivamente pasajeros/remitentes; panel ADMIN es web separado. Yo trabajo solo en apps/movete-driver/**, apps/mobility-expo/**, backend compartido, SQL, contratos y CI. Arquitecto B trabaja exclusivamente en apps/movete-cliente/**, apps/movete-admin/** y docs/architect-b/** mediante PR #8 DRAFT. NO edites sus carpetas ni hagas merge/LIVE/deploy/SQL remoto/pagos reales. La infraestructura G0–G22 está en QA con CI verde al corte; Driver G21 tiene pantallas con provider, G22 Auth SDK preparado pero sin credenciales ni STAGING desplegado. Debes avanzar técnicamente SIN detenerte salvo bloqueo real: primero agregar CI para Admin web, atender issue #9 con contratos del backend y continuar seguridad/funcionalidad Driver. Cada avance: commits, pruebas, CI y documentación, con veracidad de lo que está pendiente».

## 12. NOTAS DE VERACIDAD FINAL

- «Todo CI verde» NO quiere decir «app terminada»; nunca afirmar 100% ni listo para usuarios.
- No existe evidencia en este handoff de APK/IPA instaladas y certificadas ni de servicios comerciales activos.
- G0-G22 en este contexto son gates de ingeniería y pruebas, no permisos de operar en Paraguay.
- Las operaciones de Storage permanecen inactivas sin scanner real; documentación aprobada no sustituye legalidad ni seguros.
- No mezclar en ningún momento QORE Mobile con qore-core, trading o traders.
- Si se reciben cambios nuevos de B, primero fetch/sincronizar contratos; **no sobrescribir sus resultados**.

**FIN DEL HANDOFF MAESTRO — continuidad asegurada mediante el repositorio y sus evidencias, sin autorizar producción.**
