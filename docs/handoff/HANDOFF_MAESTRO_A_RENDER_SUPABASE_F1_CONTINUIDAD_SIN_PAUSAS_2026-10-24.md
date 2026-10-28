# QORE MOBILE / MOVETE FÁCIL — HANDOFF MAESTRO INTEGRAL
## Arquitecto A: continuidad operativa desde Render + Supabase + F1, sin pausas salvo bloqueo real
**Fecha del corte:** 24-10-2026 (Paraguay). **Owner:** dirección del proyecto QORE Mobile. **Estado de producto:** NO_GO, no comercial.
**Fuente soberana:** https://github.com/mezas3238-hue/Qore-mobile- (atención: termina en guion).
**MANDATO PRINCIPAL:** terminar productos instalables y funciones completas certificadas. El éxito NO se mide en cantidad de commits, documentación, líneas, unit tests o web exports. Medir verticales de punta a punta con persistencia, Auth, dos teléfonos y Admin. El siguiente arquitecto continúa implementando sin detenerse salvo un bloqueo real de una acción concreta: documenta esa dependencia, realiza el siguiente trabajo desbloqueado, corrige CI y nunca espera aprobación para tareas QA ya autorizadas.

---

## 0. LECTURA DE 60 SEGUNDOS: LA VERDAD ACTUAL

- Arquitecto **A**: rama **feature/mobility-monorepo-isolated-20261016**, PR **#7 DRAFT**: https://github.com/mezas3238-hue/Qore-mobile-/pull/7
- HEAD A **verificado antes de publicar este documento**: **420b898603da367c6d47a354db8710f8b92d5bb3**.
- Ese HEAD A pasó **4/4 CI SUCCESS**, en el mismo SHA:
  - Node contratos STAGING: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40154151364
  - PostgreSQL 16 efímero: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40154151378
  - Expo aislado: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40154151384
  - Aislamiento de dos apps: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40154151486
- Arquitecto **B**: rama **feature/mobility-cliente-admin-parallel-20261022**, PR **#8 DRAFT**: https://github.com/mezas3238-hue/Qore-mobile-/pull/8
- HEAD B leído en este corte: **552b9a55d13f36bbdf421853437c72d8669a7244**; **3/3 CI SUCCESS** (Admin Web, ownership B, aislamiento de apps). Comprobar de nuevo, A y B avanzan concurrentemente.
- Coordinación única: https://github.com/mezas3238-hue/Qore-mobile-/issues/9 ; avance B/otros contratos: issue #11.
- Manifiesto de lanzamiento: **docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json**. Estado NO_GO: **17 bloqueos, 15 blocked y 2 qa-only; 0 GO**.
- Matriz de recorridos B: **docs/architect-b/CERTIFICACION_INTEGRAL_R60_MATRIZ_VERIFICABLE_2026-10-24.json**: **20/20 BLOCKED** para la prueba integrada comercial.
- **No hay ningún backend Render desplegado; la API HTTPS no tiene URL real comprobada; no existe certificado E2E Cliente–Driver–Admin sobre PostgreSQL STAGING persistente.**
- Después de añadir este handoff, el HEAD A cambiará. **No atribuir CI del SHA anterior al nuevo commit**. Si GitHub crea workflows nuevos, revisar conclusión exacta.
- **LO PRIMERO tras abrir otro chat es ejecutar trabajo P0**, no reescribir este documento.

## 1. Gobierno no negociable

**PROHIBIDO sin orden expresa Owner:** MERGE; activar producción/LIVE; crear/desplegar infraestructura cloud con posible gasto; aplicar migraciones SQL a una base remota; PSP/cobros/reembolsos comerciales; usar o exponer PII/biometría reales; subir selfies/fotos de ciudadanos reales de QA; exponer service_role en cliente; enviar notificaciones push/SMS reales; publicar APK/AAB/IPA o abrir operativa comercial; tocar trabajo de otro arquitecto; force-push/rebase destructivo.

**PERMITIDO y obligatorio para avanzar:** código en ramas DRAFT dentro de la propiedad de cada arquitecto; ensayos unitarios, de integración Node y PostgreSQL16 desechable; tests HTTP en loopback; builds de QA no publicados; revisiones remotas de solo lectura; evidencia en GitHub con SHA y workflow; coordinación issue #9. Si se descubre un riesgo, falla CI o incompatibilidad, corregirlo, no declarar bloqueo global.

Una invitación a conectar Render/Supabase NO equivale a permiso para crear servicios, cobrar o desplegar. Una configuración render.yaml en GitHub NO es un servicio creado.

## 2. Qué producto estamos terminando (decisiones Owner firmes)

**Movete Fácil, Paraguay, con activación progresiva por zonas.** Meta de experiencia superior a Bolt y Uber, incluida logística/comercios. No copiar marcas ni diseños propietarios.

1. **Cliente**: aplicación nativa Expo separada; viajes pasajeros **AUTO**, pedido de vehículo, oferta oficial en guaraníes, envío particular/comercial, compras, historial, GPS/ETA, chat, soporte.
2. **Driver**: aplicación nativa Expo separada; conductor/repartidor, vehículos, documentación, ofertas, navegación, aceptación, viaje/carga, GPS, chat y prueba de entrega.
3. **Admin Web**: backoffice separado; permisos y MFA; KYC, zonas/seguro/compliance, incidentes/SOS, soporte, operaciones, auditoría, dinero y Owner.
4. **Backend + DB/Auth + almacenamiento privado** común, con identidad y roles server-side, APIs versionadas, SQL transaccional, auditoría y persistencia.
5. **Servicios**: AUTO viajes; AUTO/MOTO reparto de paquetes; supermercados, restaurantes, farmacias solo rubros permitidos y otros comercios.
6. **No moto para pasajero** sin dictamen legal y autorización posterior. Moto de carga tampoco debe saltar habilitaciones.
7. **Tarifas PYG/guaraníes** exclusivamente de backend, diferenciadas por vehículo/modalidad/zona, con vigencia y consentimiento. No inventar ETA, GPS ni precio.
8. **Chat privado Cliente↔Driver/delivery** únicamente durante asignación vigente, con revocación y límites por actor.
9. **Documentos Driver privados**: licencia/registro, cédula frente y reverso, cédula verde, habilitación, seguro, inspección y selfie; 8 clases. Vencimiento bloquea automáticamente elegibilidad y muestra aviso; renovación sube PENDING y solo verificación independiente completa permite restaurar elegibilidad documental. Suspensión administrativa sigue bloqueando.
10. Cobertura no significa conductores disponibles. **Sin límite global de 50 registros**; paginación de 50 es tamaño de página, no tope poblacional.
11. Lovable únicamente para la fase de interfaz final; código/backend/certificación fuente en GitHub.

## 3. División A/B — evitar conflictos absolutamente

| Área/ruta | Propietario | Regla |
|---|---|---|
| apps/mobility-expo/**, backend, SQL, Auth, G1–G80, OpenAPI, Driver shared runtime | **A** | B solo consume contratos |
| apps/movete-driver/** | **A** | no editar desde B |
| apps/movete-cliente/** | **B** | no editar desde A |
| apps/movete-admin/** | **B** | no editar desde A |
| docs/architect-b/** | **B** | no editar desde A |
| docs/handoff/**, docs/architecture/**, workflows y render.yaml | **A** | B coordina con issue #9 |
| issue #9 | **A y B** | acuerdos DTO, URLs, Auth, errores, evidencia; no permiso para editar código ajeno |

PR #7 y #8 **siguen DRAFT**. No hacer merge para sincronizarlos sin la orden correspondiente. B puede llevar un HEAD/base de A atrasado: leer SHAs y acordar DTOs/versiones explícitas.

## 4. Trabajo histórico A realizado — contratos y pruebas, NO servicio comercial

**G0–G22**
- Aislamiento de apps, ambientes, CI, Expo; PostgreSQL/RLS/sesiones y políticas privadas; elegibilidad Driver+vehículo AUTO/MOTO; G3/G4 solicitud/oferta/aceptación e idempotencia, competidores en SQL, eventos; envíos y prueba; comercio/stock; tarifas PYG y comisiones; incidentes y SOS; outbox/push de QA, auditoría y navegación.
- Migraciones con nombres **POSTGRES_CI_ONLY** son ensayos en base desechable. **No ejecutarlas directamente en Supabase/producción.** Los 8 RPC legacy del antiguo backend Lovable fueron bloqueados en su momento; no suponer que ello constituye backend STAGING funcional.

**G23–G48**
- Historial, cursores firmados, keyset, paginación ilimitada global; roles Admin/Owner y mínimo privilegio; zonas legales/cobertura, GPS consentido, prevención de replay/fraude, vehículos/licencias; G36 slot único atomizado y G38 zonas; incidentes, soporte, recibos; G42 JWS/JWKS de laboratorio y revocación de sesión, AAL2 Admin; catálogos/sucursales, reservas atómicas y accesos privados.
- Ensayos SQL con dos conexiones prueban atomicidad de modelos, **no** GPS/driver real.

**G49–G66**
- Chat privado con SEND idempotente, historia/ACK/read markers contiguos, aislamiento de actor y reasignación; recuperación de POST tras ACK perdido; integración local de Driver y estados. G61 mantiene gates NO_GO. G63/G64 oferta aceptada/rechazada con receipt y reconciliación; G65 ciclo Driver AUTO accepted→arriving→in_progress→completed; G66 entrega pickup→delivered/return/dispute con custodia QA.
- Todo sin push proveedor ni dos teléfonos productivos.

**G67–G70**
- G67 exige que proofRef de entrega sea evidencia real de QA privada, vigente, autorizada y consumida bajo el mismo COMMIT; rechaza falsificación/replay, reemplazo, revocación.
- G68 permite estado privado del remitente, DTO mínimo sin identidad/location innecesarias.
- G69 lectura de custodia SQL bajo delegación NOLOGIN, token opaco TTL corto y consumo único; carreras/revocación.
- G70 lectura local en 127.0.0.1 con JWT ES256 de QA y sesión G42; tests de IDOR, host, origen y timeout. **HTTP con test doubles y SQL de CI no forman un E2E PostgreSQL remoto único.**

**KYC Driver y vencimientos, posterior a G70**
- Intake de ocho evidencias incluyendo selfie; inspección de MIME/hash/ruta owner y malware como proveedor independiente; JPEG/PNG hasta 5MiB; bucket diseñado privado; cámara Expo para selfie y permisos/consentimiento; buffer de foto borrado, recibo PENDING.
- Validación de identidad/issuer/documento original, vínculo de vehículo, liveness/facial **a nivel interfaces/QA**; por sí sola NO activa cuenta. Aprobación atómica owner-only asociada al **último documento G17** con locks/session, evita foto obsoleta y races.
- Estado por reloj PostgreSQL de cada documento, aviso de próximos 30 días, vencido/revisión/suspendido/READY_QA. Provider Driver en pantalla/index/ofertas/documentos actualiza en foreground con limpieza en logout, **opt-in OFF** por defecto.
- **PENDIENTE CRÍTICO: el bloqueo KYC de ocho documentos aún debe aplicarse server-side en TODOS los RPC G4/G10/G36 de asignación/aceptación/despacho bajo transacción**, no solo ocultar ofertas en UI. Una pantalla bloqueada no protege SDK antiguo ni RPC directo. Rehabilitación documental READY_QA NO levanta sanción administrativa ni habilita operaciones comerciales automáticamente.
- Sin verificación documental oficial real, sin SMS/push OS con app cerrada, sin prueba móvil física ni bucket operativo.

**F1 viajes, fases G73–G80 y SQL**
- G73: ruta/cotización versionada→reserva AUTO atómica de QA en PostgreSQL16 desechable, requestKey idempotente, sin duplicar ante timeout.
- G74: recuperación de estado propio del mismo tripId (Passenger).
- G75: lectura/auditoría Admin del mismo tripId con AAL2/mínimos.
- G77: contrato de Google Routes opcional con costos/proveedor controlados, atestaciones de cobertura/peaje; **no activar Google de pago sin aprobación**.
- G78/G80: rechazos fail-closed cuando **G36 vehículo/slot** o **G38 zona legal** impiden asignación Driver. No presentar estas pruebas negativas como dispatch logrado.
- G80: GET privado **/v1/staging/driver/kyc/validity** montado en transport G4 local con comprobación de proveedor/atestaciones independientes; sin HTTPS STAGING real.
- En SQL de test **G80_F1_EIGHT_DOC_KYC_LEGAL_ZONE_DENIAL_ASSERT_POSTGRES_CI_ONLY.sql** se corrigió expectativa errónea: puede fallar primero fence G36 con SQLSTATE **G3601** o fence G38 con **G3801**. El test debe aceptar ambos como rechazo legítimo sin afirmar qué condición disparó primero. Corregido en commit **3a68be801174e6234a55a0792b8ca4835f361f16**, con 4/4 CI PASS en ese corte.
- **Hasta hoy F1 no tiene aceptación positiva de Driver, GPS/chat/trip completed/Admin sobre UNA base remota y teléfonos.**

## 5. TRABAJO NUEVO de esta continuidad — Render, Supabase y backend HTTPS STAGING

### 5.1 Diagnóstico remoto auténtico (lectura solamente)

**Render**:
- Conector autenticado, workspace **My Workspace** con ID de herramienta **tea-dbem1ilg1s2s7381fic0**. list_services(includePreviews=true) devolvió null; list_postgres_instances: No Postgres instances found; list_key_value: No Key Value instances found.
- Interpretación precisa: conector operativo, **ningún servicio web/backend ni base Render confirmado**, sin logs/URL/health de app. NO se creó ningún recurso.

**Supabase**:
- Conector responde y lista una organización (ID **qtibiplbewfyazoskrch**), pero list_projects devuelve **[]** para cuenta enlazada. No se creó proyecto.
- En **Lovable QORE Mobility STAGING** proyecto ID **9c677bb2-746b-419f-ad9c-dd6d26bab944**, get_database_status devuelve **enabled=true, stack=supabase**. En el último intento, tres SQL read-only incluyendo **SELECT 1** respondieron **400 query_error: Database is possibly not accessible at the moment**. Esto prueba que el esquema/DB **NO es verificable ni accesible actualmente**, aunque la ficha diga enabled.
- El Lovable viejo con otro ID es un sistema distinto: **NO usarlo accidentalmente como STAGING nuevo**. No migrar SQL remoto ni usar credenciales de un proyecto no verificado.
- Resolver acceso de la base preexistente/propietario antes de provisionar nueva base pagada por inercia. Si el Owner autoriza un STAGING separado, primero identificar costos, proyecto, Auth, migración idempotente y política de acceso.

**Railway está descartado** por dificultad de conexión comunicada por el Owner. Render para web Node STAGING, Supabase Auth+PostgreSQL+Storage privado son el camino propuesto, no servicios ya desplegados.

### 5.2 Corrección concreta de arranque G4 local

- **apps/mobility-expo/server/run-g4-local-staging-radar.mjs** exigía **QORE_MOBILITY_ENV=isolated_staging**, pero el constructor **prepareQoreG4StagingRuntime** exige valor **staging**. Launcher arreglado en commit **4de2b38b82b8b8243a0eb0290556d4c83d4948dd**.
- **run-g4-local-staging-radar.test.mjs** añade rechazo valor obsoleto y fail-closed sin credenciales (commit **9396f336e8964069c6b03c3543d6ff93af066388**).
- Mantenimiento de servidor estrictamente loopback en **g4-loopback-http-transport.mjs**: solo 127.0.0.1, sin exponer a teléfonos/red.
- CI en descendiente SHA **09370f93d62b781089f93a92da185f34ca8fbd8a**: 4/4 SUCCESS (Node #40153099715, PG #40153099650, Expo #40153099668, aislamiento #40153099717).

### 5.3 Nueva puerta Render STAGING — NO PUBLICADA

**Archivo nuevo: apps/mobility-expo/server/render-staging-ingress.mjs**
- Adapter HTTP para alojar G4 **internamente en 127.0.0.1** y servir peticiones por borde Render TLS: separación explícita de red y núcleo G4, sin relajar override .listen del transport local.
- Exige Host pinneado con formato *.onrender.com, **x-forwarded-proto=https** y una sola cabecera, sin cookies/Proxy-Authorization, browser Origin permitido SOLO si coincide exactamente con Admin origin configurado.
- CORS opt-in seguro de Admin, preflight limitado; Bearer obligatorio GET/POST, nunca enviar cookie/origin al backend; solo rutas /v1/staging/...; límite 2KiB cuerpo JSON, 32KiB respuesta JSON, 7s upstream timeout, redirecciones bloqueadas y cache no-store.
- Rate limit 90 solicitudes/min por digest SHA256 de Bearer en un proceso con memoria acotada. **No es rate-limit distribuido/WAF ni blindaje para producción.** No afirmar que el digest está salteado; no se agregó sal.
- Health **/_qore/liveness** reporta **PROCESS_UP_ONLY, commercialRidesEnabled:false**: solo vida del proceso, jamás DB/Auth/E2E readiness.
- Sólo 1 hostname fijado, un G4 loopback, sin proxy arbitrario ni parámetro upstream aportado por móvil.

**Archivo nuevo: apps/mobility-expo/server/run-g4-render-staging.mjs**
- Arrancador NO LIVE, requiere explicitamente QORE_RENDER_STAGING_APPROVED=true, QORE_RENDER_NO_COMMERCIAL_TRIPS=true, QORE_MOBILITY_ENV=staging, LIVE_TRIPS_ENABLED=false y PORT válido.
- Valida hostname y browser origin ANTES de cargar privilegios de Supabase; inicializa runtime G4, inspecciona política Auth y tablas G4 al conectar, luego lo escucha local y abre ingress en puerto Render. Fallar seguro si faltan datos/secretos/DB.
- No se ejecutó contra proyecto Supabase real por falta de proyecto accesible/credenciales, y no se levantó en Render.

**Archivo nuevo: apps/mobility-expo/server/render-staging-ingress.test.mjs**
- Pruebas Node HTTP para envío booking/cotización de laboratorio y consulta Driver al mismo servidor interno; Host/TLS/CORS/browser Admin, Bearer ausente, body inválido, GET malformado, tamaño de respuesta, upstream inválido, rate limit, startup sin autorización.
- El primer ensayo Node falló debido a que **fetch de Node reescribía Host a 127.0.0.1**. Se corrigió el fixture con **node:http request** y length explícito, sin reducir protección del ingress.
- Segundo fallo de tests: petición GET con cuerpo malformado ensuciaba la conexión persistente. Se separó socket con **Connection: close**; CI posterior pasó.
- Advertencia esencial: estos tests prueban **transporte sintético con backend de laboratorio**, no reserva/dispatch real con DB durable.

**Archivo nuevo: render.yaml (raíz de PR #7, NO main)**
- Blueprint para un servicio **movete-facil-staging-api** Node sobre apps/mobility-expo, **autoDeployTrigger: off**, previews off, un proceso, variables LIVE_TRIPS_ENABLED=false y condiciones STAGING; secretos via **sync:false**.
- Plan free se propuso pero **NO se validó con Render CLI/Blueprint schema en la infraestructura real**. Comprobar compatibilidad, costo/condiciones vigentes y gateway seguro antes de cualquier Apply. No contiene Postgres, pues se pretende usar Supabase separada.
- NO se creó servicio. El fichero en rama feature DRAFT no equivale a Blueprint integrado a default branch; no fusionarlo para desplegar sin aprobación.

**Certificación exacta de esta entrega**
- Último SHA A funcional comprobado: **420b898603da367c6d47a354db8710f8b92d5bb3** con **4/4 SUCCESS**:
  - Node: 40154151364
  - PostgreSQL: 40154151378
  - Expo: 40154151384
  - aislamiento: 40154151486
- Hubo CI intermedias en rojo mientras se depuraban fixtures: NO borrar historial ni omitir que se corrigieron.
- Confirmación en issue #9:
  - Diagnóstico infra y orden A/B: https://github.com/mezas3238-hue/Qore-mobile-/issues/9#issuecomment-6392268456
  - Certificación arreglo launcher G4: https://github.com/mezas3238-hue/Qore-mobile-/issues/9#issuecomment-6392277760
  - Nueva puerta Render y matrices: https://github.com/mezas3238-hue/Qore-mobile-/issues/9#issuecomment-6392415316

### 5.4 Riesgos técnicos que sucesor DEBE resolver antes de despliegue

1. **No confundir forwarded header con TLS genuino**: validar con la plataforma Render y su proxy oficial si sobrescribe/normaliza x-forwarded-proto y Host, y que cliente externo no pueda falsear esquema/host. Agregar pruebas de red reales STAGING autorizadas, WAF/abuso y límites por IP.
2. **La puerta NO es una API pública comercial certificada**. Debe revisarse seguridad de los métodos y rutas permitidas, manejo de errores, Auth+revocación G42, roles AAL2 Admin, DTO/PII, traceId, durabilidad, graceful shutdown y salud de DB.
3. **El path filter actual no acepta query strings**: contrastar contra OpenAPI, paginación/cursor de Cliente/Admin e implementar de forma segura si se necesita, sin SSRF ni redirecciones. No declarar interoperabilidad B hasta pruebas consumer-provider.
4. **Body 2KiB/reply 32KiB y GET/POST únicamente** pueden impedir rutas legítimas (historial, chat y archivos). Revisar mínimos necesarios por contrato y limitar por ruta. Documentos biométricos **no deben ir por este JSON**, solo Storage privado autorizado.
5. **Rate limit local por JWT** no es distribuido, ni protege bien tráfico anónimo/abusivo a múltiples instancias. Añadir seguridad per-edge, rate-limit distribuido, replay/idempotencia y logs sanitizados; no volcar JWT al log.
6. **Supabase projectRef/IdP/AUTH real son bloqueos duros**. Preparar un preflight read-only de SQL/schema, pero no ejecutar CI_ONLY en remoto sin aprobación.
7. **El liveness no equivale a readiness**. Introducir endpoint separado protegido para dependencias, con comprobaciones limitadas para operaciones/monitor; no revelar secretos/datos.
8. **El Blueprint no ha sido validado por CLI ni probado en Render**; rama y plan free podrían necesitar revisión. Render puede cobrar según plan, cuota o proveedor; nunca asumir costo $0.
9. No exponer service_role ni firma de cursores a Cliente, Driver, navegador, CI logs o archivos públicos.

## 6. Situación B — trabajo completado en QA y dependencia A

La rama PR #8 permanece independiente y DRAFT. HEAD B actualizado en lectura: **552b9a55d13f36bbdf421853437c72d8669a7244**, **3/3 CI SUCCESS**.
- **apps/movete-cliente/**: navegación y UI nativas; AUTO draft y estados; booking POST opt-in con requestKey y receipt tipado, reconciliación read-only ACK incierto, status monotónico y foreground poll, GPS/ETA con TTL; cotización PYG de servidor; cancelación, historial con propietario, envíos, comercios/carrito, soporte y chat.
- **apps/movete-admin/**: React/Vite/TypeScript; roles/Owner y MFA como contratos; cola KYC, decisiones pendientes, zonas, auditoría, incidentes, comisiones/finanzas no inventadas; paginación sin límite global. Sin aprobación real de documentos.
- R1–R66/F1 están detallados en **docs/architect-b/HANDOFF_MAESTRO_ARQUITECTO_B_R1_R66_F1_PRIORIDAD_FUNCIONES_CERTIFICADAS_2026-10-24.md**. Leerlo; no tocar sus fuentes desde A.
- Estado: pantallas y gateways defensivos con opt-in OFF **no** son servicio operativo. B no ha probado reserva Driver/Cliente/Admin por misma DB e IdP real ni Android/iOS físicos.
- B debe consumir los contratos versionados nuevos de A y probar 2 actores, reintentos, CORS Admin, revocación, mismo tripId y estado/finanzas sin leaks.

## 7. Prioridad P0: entregar UNA función completa certificada antes de dispersarse

### F1 AUTO — recorrido de aceptación obligatorio

**F1.0 Identidad y DB**: un único proyecto STAGING real accesible (Supabase/PG/Auth/Storage segregados). Dos usuarios Passenger, dos Driver ficticios y Admin con MFA/rol servidor. Sin PII. Validar RLS, token revocado y cross-account; respaldos/durabilidad. El backend Render no está desplegado todavía y necesita orden expresa si conlleva exposición/gastos.

**F1.1 Ruta y tarifa**: Cliente elige origen/destino legítimos AUTO; backend calcula **prequote oficial Gs** con zona, routeId, quoteId, tarifa/version, expiración y consentimiento. Precio vencido no es reservable. Sin simular ETA real.

**F1.2 Booking**: único POST con quoteId+requestKey propio, SQL INSERT/COMMIT persistente, receipt estricto y GET de recuperación después de ACK perdido. Doble toque, body cambiado con mismo requestKey, usuario ajeno, logout, token caduco, restart y dos conexiones.

**F1.3 Matching**: backend verifica KYC ocho documentos vigentes (y seguro/zona/suspensión), G36 slot, G38 zona legal y sesiones bajo locks; dos Driver compiten, **solo uno gana**. Rechazos legales no son prueba de aceptación positiva. Driver acepta, recibe asignación y puede rechazar bajo reglas.

**F1.4 Ciclo en calle**: accepted→arriving→in_progress→completed; GPS consentido con frescura, permisos Android/iOS, reconexión, chat Cliente↔Driver solo durante servicio, cancelaciones y seguridad. Sin saltos de estado ni entregas ficticias. Cliente ve el mismo tripId y progreso Server-authoritative.

**F1.5 Admin + ledger**: Admin ve mismo tripId, conductor, zona, versión y auditoría con AAL2; completado aparece en historial propio. Tarifa final/ledger/comisión en PYG conciliados, **sin cobrar o procesar PSP**.

**F1.6 Certificación**: prueba real en UN STAGING HTTPS con base duradera y dos móviles (Android/iOS) + navegador Admin, log sanitizado (tripId sintético, SHA A/B, revisión SQL, códigos y tiempos, GPS ficticio o consentido), ejecución negativa de IDOR y revocación, reinstalación/reinicio/red intermitente; certificado por función independiente. Esto es E2E/NATIVE, distinto de GO comercial.

### Estados obligatorios de comunicación

| Etiqueta | Permite afirmar | NO permite |
|---|---|---|
| CODED | Archivo/DTO/UI implementado | operable |
| QA_PASS | Pruebas unitarias/HTTP local/PG efímero en SHA preciso | DB real, dos teléfonos |
| STAGING_E2E_PASS | Mismos usuarios, IdP, DB, HTTPS y tripId con trazabilidad | firmado para usuarios |
| NATIVE_PASS | Android/iOS físicos, sensores, fallos, permisos | legalidad, PSP |
| COMMERCIAL_GO | 17 gates + 20 recorridos según alcance, aprobaciones Owner/legal/ops | asumirlo por CI |

**Hoy F1 sigue bloqueado en STAGING_E2E_PASS; el ingress nuevo está QA_PASS de transporte.**

## 8. Los 17 gates y 20 recorridos que NO se pueden omitir

**Gates / dueño responsable (manifiesto 24-10):**
1. IDP_BACKEND_AUTH — A, blocked.
2. HTTPS_BACKEND — A, blocked.
3. POSTGRES_PERSISTENCE — A, qa-only.
4. DRIVER_ONBOARDING — A, blocked.
5. DRIVER_LIVE_TRIPS — A, blocked.
6. CLIENT_LIVE_BOOKINGS — B, blocked.
7. PAYMENT_SETTLEMENT — A/B, blocked.
8. PRIVACY_KYC — A/B, blocked.
9. EMERGENCY_SAFETY — A/B, blocked.
10. MAPS_GPS_DEVICE — A/B, blocked.
11. DELIVERY_MERCHANTS — A/B, blocked.
12. CHAT_PHYSICAL — A/B, qa-only.
13. ADMIN_OPERATIONS — B, blocked.
14. NATIVE_RELEASES — A/B, blocked.
15. LEGAL_COMPLIANCE — Owner, blocked.
16. OPS_24_7_MONITORING — Owner/A/B, blocked.
17. PROD_GO_NOGO — Owner, blocked.

**20 recorridos B (matriz R60; TODOS BLOCKED)**
1. AUTH_PASSENGER
2. AUTH_DRIVER_KYC
3. FARE_QUOTE_GS
4. AUTO_BOOKING
5. DRIVER_DISPATCH
6. GPS_TRACKING
7. TRIP_COMPLETION_CANCELLATION
8. MOTO_CARGO_DELIVERY
9. AUTO_CARGO_DELIVERY
10. SUPERMARKET_ORDER
11. PHARMACY_OTC_ORDER
12. RESTAURANT_ORDER
13. CUSTOMER_DRIVER_CHAT
14. PAYMENTS_REFUNDS
15. COMMISSIONS_PAYOUTS
16. ADMIN_KYC_ZONES
17. EMERGENCY_RESPONSE
18. DATA_PRIVACY
19. SIGNED_NATIVE_RELEASES
20. ZONE_ACTIVATION_SUPPORT

No afirmar "terminado" por haber implementado 20 pantallas o 17 manifiestos. Cada uno exige evidencia de negocio/seguridad/operaciones y entorno real.

## 9. Secuencia autónoma precisa de tareas pendientes

### P0.1 — Resolver bloqueo físico de infra sin inventar progreso
**A**:
- Confirmar por lectura el HEAD nuevo A y B, workflows, y proyecto STAGING existente. Supabase list_projects está vacío; comprobar conexión/cuenta/proyecto con Owner si necesita acción humana. No copiar claves a chats/commits.
- Reintentar **una vez** consulta PG STAGING read-only al recibir señal de restauración: SELECT 1 + inventario de tablas/RLS/funciones G1/G3/G4/G73/G75/G80 y Auth, sin escribir ni dar por ejecutada migración.
- Si PG remoto sigue inaccesible, registrar error 400/fecha, declarar bloqueada **solo la certificación externa**. Continuar P0.2/P0.3 y tests de código.
- No duplicar DB hasta comparar alternativas y solicitar aprobación de costo/seguridad.

**Aceptación:** proyecto ref+URL identificados, SELECT 1 real, tabla/RLS/roles/auth revocación comprobados; nunca inferirlo de enabled=true.

### P0.2 — Finalizar seguridad e interoperabilidad del ingreso Render
**A**:
- Auditar files render-staging-ingress.mjs, run-g4-render-staging.mjs, render.yaml.
- Validar Blueprint contra docs vigentes/CLI; no desplegar para validar sintaxis. Verificar compatibilidad Node, rootDir, plan, rama, secretes, autoDeploy off, Render Host y forwarded TLS. Revisar códigos 404/401/403 y CORS/OPTIONS Admin.
- Añadir/verificar manejo seguro de query params de cursor, respuesta JSON grande/chunked, rate-limit edge, TLS proxy real, bloqueo de host spoof, WAF, revocación session G42, MFA AAL2, auditoría y duración.
- Con autorización específica de Owner para crear STAGING, configurar recurso desde su dashboard/Render y secretos del servicio sin exponer; desplegar solo NON-COMMERCIAL y recopilar logs/probe. No despliegue LIVE ni en branch con PR mergeado por inercia.

**Aceptación:** GET/POST real por HTTPS desde dos clientes con roles y mismo PostgreSQL, host verificado y logs seguros; respuesta process-up no basta.

### P0.3 — Cerrar KYC universal dentro de transacción de despacho
**A, tarea realizable SIN servicios cloud**, salvo tests de CI desechable:
- Localizar operaciones SQL G3/G4/G10/G36/G38 G63 y todos los caminos de ofrecer/aceptar/confirmar.
- Insertar guard Server/SQL KYC de ocho documentos recientes, con bloqueo de expiración/suspensión bajo locks y reloj PG **antes de asignar**.
- Rechazar datos falsos, documento revocado/reemplazado, selfie sin liveness/issuer confiable, coche sin seguro/zone, Driver con sesión revocada, competencia de dos conexiones.
- Ensayos: vencimiento en mitad de dispatch, renewal pending, renovado VERIFIED, sanción que persiste; sin autorización comercial automática. Actualizar endpoint privado de validación a la misma fuente transaccional.
- 4/4 CI del HEAD, registrar SHA y logs en issue #9. No desplazar esta tarea solo por crear otra documentación.

**Aceptación:** en CI ningún RPC protegido admite Driver no elegible, incluso sin app abierta.

### P0.4 — Recorrido F1 de punta a punta
**A+B**:
- Congelar contrato DTO/OpenAPI versionado de prequote→book→status→offer→accept→driver trip→Admin history, en issue #9. Contrastar B f1_* y A G73–G80.
- Resolver prueba positiva real del Driver: la actual negativa G36/G38 no prueba entrega de oferta.
- Una vez STAGING disponible y autorizado, desplegar backend con IdP real y DB; B conecta Cliente/Admin opt-in al origin aprobado en sus carpetas; Driver tiene app independiente.
- Hacer e2e con un mismo tripId y SQL durable, incluyendo GPS/chat/completado/ledger/observación Admin. Documentar FAIL con bloqueo específico en vez de declarar ficticiamente PASS.

### P1 — verticales siguientes (en orden de cierre, no en paralelo infinito)

**F2 Driver/KYC end-to-end**: cámara ocho documentos y selfie, privada Storage, escáner/issuer oficial, consentimiento biométrico/liveness, automático cuando todo sea legítimo, cola Admin humana para excepciones, bloqueo por caducidad y notificación cuando app cerrada, sustitución y renovación/suspensión transaccional. Protección de retención/eliminación, appeals.

**F3 Envíos particulares AUTO/MOTO**: solicitar→cotizar→aceptar Driver→recoger→chat→proof real de entrega→retorno/disputa/reembolso permitido, mismo deliveryId y ledger. Motocicleta solo carga conforme póliza/licencia/ley.

**F4 Comercios**: sucursales, inventario real y reservas atómicas, precio/tasas/horarios, carrito/substituciones, pedido y preparación→courier→proof→recibo. Categorías de farmacia de venta autorizada, restricciones legales.

**F5 Chat+GPS**: notificaciones OS reales bajo aprobación, lectura persistida, privacidad y revocación tras reasignación, consentimiento y TTL GPS, recuperación de red, maps/routing y señal antifraude.

**F6 Admin/SOS/finanzas**: operación real KYC MFA/Owner, fraude e incidentes, soporte humano/SOS y protocolos, zonas, historial/auditoría y reconciliación de comisiones sin PSP ficticio.

**F7 Distribución y operaciones**: builds Android/iOS firmados, permisos/teléfonos, observabilidad, alertas, backups/restore, carga real, escalabilidad sin cap 50, soporte, privacidad, seguro y validación legal Paraguay, PSP sandbox solo tras aprobación.

## 10. Instrumentos para revisar, probar y reproducir

**Repo/ramas**
- A PR #7, branch feature/mobility-monorepo-isolated-20261016.
- B PR #8, branch feature/mobility-cliente-admin-parallel-20261022.
- Issue #9 para CONTRATOS; no cruzar límites de edición.

**Núcleo de archivos**
- app backend local: apps/mobility-expo/server/g4-staging-runtime.mjs, g4-loopback-http-transport.mjs, run-g4-local-staging-radar.mjs.
- Render nuevo: apps/mobility-expo/server/render-staging-ingress.mjs, run-g4-render-staging.mjs, render-staging-ingress.test.mjs y raíz render.yaml.
- Persistencia CI F1: apps/mobility-expo/docs/backend/staging_only/, con G73/G74/G75/G80 y SQL fixtures.
- OpenAPI canónico: apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json.
- Driver: apps/movete-driver/**.
- Cliente y Admin: apps/movete-cliente/**, apps/movete-admin/** (leer, no editar desde A).
- Lanzamiento: docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json.
- Funciones B: docs/architect-b/CERTIFICACION_INTEGRAL_R60_MATRIZ_VERIFICABLE_2026-10-24.json.

**CI A que DEBEN aprobar juntas sobre mismo SHA**
- .github/workflows/mobility-staging-node-contracts.yml
- .github/workflows/mobility-g4-postgres-disposable.yml
- .github/workflows/mobility-ci.yml
- .github/workflows/movete-apps-isolation.yml

**CI B del mismo SHA B**
- Movete Facil Admin web QA
- Movete Facil Architect B ownership boundary
- Movete Facil two app isolation

**Historial exhaustivo que no se debe perder**
- docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G66_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md
- docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G70_KYC_RENOVACION_CONTINUIDAD_2026-10-24.md
- docs/handoff/HANDOFF_MAESTRO_A_FUNCIONES_CERTIFICADAS_Y_CONTINUIDAD_2026-10-24.md
- docs/handoff/ANEXO_A_TRABAJOS_PENDIENTES_Y_PRIORIDAD_KYC_2026-10-24.md
- docs/architect-b/HANDOFF_MAESTRO_ARQUITECTO_B_R1_R66_F1_PRIORIDAD_FUNCIONES_CERTIFICADAS_2026-10-24.md
- issue #9 y #11, SQL y OpenAPI al HEAD.

No repetir documentación ya existente sin razón funcional; estos enlaces preservan detalles previos G0–G80, notas de regresión y contratos.

## 11. Matriz de bloqueos vs acciones concretas continuables

| Bloqueo real | Trabajo suspendido SOLO en esa parte | Seguir sin pausa con |
|---|---|---|
| Supabase list_projects vacío / Lovable PG SELECT 1 error | SQL E2E remoto, IdP real y Storage reales | KYC despacho SQL desechable, contratos F1, ingress hardening, QA adversarial |
| Render sin servicio / sin aprobación explícita despliegue | Deploy/STAGING pública, TLS plataforma | código ingress, Blueprint validación, pruebas HTTP loopback y contratos |
| Google Maps/Routes de pago no aprobado | rutas/ETA cobrables y routing productivo | cotizador QA con evidencia controlada, validación y rechazos |
| PSP no aprobado | cobros/abonos/comisiones bancarias | ledger sintético, conciliación sin desembolso |
| Fotos/documentos reales, facial/issuer oficial no autorizado | onboarding automático real | metadata privado, versiones, expiración y SQL fences synthetic |
| Jurisdicción/seguro moto no validado | pasajeros en moto y operaciones comerciales | auto pasajero, moto carga QA según restricciones y deny-fail |

**Solo se detiene un frente dependiente, jamás todo QORE Mobile.** Si hay una CI roja o regresión, leer log, corregir bug, correr nueva CI, documentar SHA. No solicitar respuestas ya conocidas ni abrir tareas de relleno.

## 12. Formato obligatorio de las próximas entregas al Owner

Cada actualización debe incluir:
1. Función/vertical concreta que ahora hace algo antes imposible.
2. Qué componente real une Cliente, Driver, Admin, API, DB; y qué sigue falso/simulado/opt-in.
3. Rama/PR/SHA exactos; workflows concluidos en el mismo SHA, pruebas de seguridad y resultado.
4. Estado CODED / QA_PASS / STAGING_E2E_PASS / NATIVE_PASS / COMMERCIAL_GO.
5. Bloqueo real (si existe), responsable y acción mínima que lo libera.
6. Próximo trabajo funcional inmediato. **No centrar informe en recuento de commits.**

### Texto listo para iniciar el siguiente chat (Arquitecto A)

**ORDEN DE CONTINUIDAD DEL OWNER — QORE MOBILE / MOVETE FÁCIL**

Asumo el rol de Arquitecto A de QORE Mobile. Repositorio soberano mezas3238-hue/Qore-mobile-, PR #7 DRAFT, rama feature/mobility-monorepo-isolated-20261016. Debo leer el handoff maestro Render/Supabase/F1 de 24-10-2026, el maestro histórico A G0–G70, el maestro B R1–R66 F1, manifests 17 gates y 20 recorridos, y el issue #9. Comparo inmediatamente HEAD actual y CI, no doy por válido un SHA anterior. Continúo construyendo funciones completas y certificables sin detenerme salvo un bloqueo real de una acción concreta. La prioridad absoluta es F1 AUTO completo (prequote oficial Gs → reserva idempotente → Driver elegible acepta → GPS/chat → complete → Cliente y Admin mismo tripId en PostgreSQL duradero), y antes cierro el guard transaccional KYC G36/G38 y seguridad de ingreso Render que puede ensayarse sin cloud. Render conectado pero sin servicios; Supabase organización accesible pero sin proyectos listados; Lovable STAGING enabled=true pero SELECT 1 falla. No crear otra base ni desplegar para tapar un problema de acceso. Cumplo la división A backend+Driver e infraestructura y B Cliente+Admin; no piso su código ni fuerzo rebase. Cada cambio funcional debe tener pruebas adversariales, misma SHA CI y reporte de límites. NO MERGE, NO LIVE, NO DEPLOY, NO SQL remoto, NO PSP, NO PII/biometría real ni gasto sin orden expresa. Si un proveedor está bloqueado, continúo inmediatamente la siguiente tarea QA realizable. El proyecto sigue NO_GO hasta E2E, Android/iOS y aprobación legal/Owner.

---

**FIN DEL HANDOFF. El sucesor ejecuta trabajo real, no otro handoff como sustituto.**
