# HANDOFF MAESTRO EJECUTIVO — QORE MOBILE / MOVETE FÁCIL
## G221 · Cinco recorridos originales QA 5/5 · Plan para terminar cuatro aplicaciones y habilitar STAGING externo
**Corte de verificación: 30 de octubre de 2026 (Paraguay UTC−03).**  
**Owner:** dirección del proyecto QORE Mobile / Movete Fácil.  
**Destino:** siguiente chat / Arquitecto Ejecutivo Principal e Integrador A+B+C+D.  
**Naturaleza:** expediente de continuidad y orden de ejecución. **NO es certificación comercial ni aprobación para desplegar.**

> **INSTRUCCIÓN PRINCIPAL DEL OWNER:** terminar la aplicación y hacerla funcionar; no sumar más cientos de commits, laboratorios sin conexión, prototipos ni handoffs. El nuevo arquitecto debe **modificar código existente en GitHub, conectar las cuatro superficies y demostrar el uso real de STAGING**, sin borrar lo funcional ni afirmar autorización legal o pagos que no existen. No solicitar datos ya aportados. Si una dependencia externa está bloqueada, completar en paralelo todo lo que no la requiera y describir la autorización exacta que falta.

---

## 0. PRIMERA LECTURA OBLIGATORIA Y ESTADO EXACTO

- **Repositorio oficial:** https://github.com/mezas3238-hue/Qore-mobile-
- **Rama soberana de integración actual:** `integration/qore-mobile-e2e-four-apps-20261027` (no trabajar ciegamente en `main`).
- **HEAD técnico verificado inmediatamente antes de publicar este handoff:** `c03a727b2e71f0a6d140656a614ef19f2fd9bdcb`. La publicación de **este** documento crea un nuevo commit; **consultar HEAD y runs de nuevo** antes de escribir código.
- **CI sobre el mismo HEAD técnico, ambos SUCCESS:**
  - A+B+C+D cuatro aplicaciones: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/41051967832
  - PostgreSQL 16 desechable, cadena real de esquema, SQL y concurrencia: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/41051967912
- **G215 al mismo SHA:** `FIVE_QA_CHAINS_CLOSED_EXTERNAL_GATES_PENDING`, **5/5 QA completos**, sin pasos pendientes según auditoría independiente sobre cinco fuentes seleccionadas G202/G221; **0/5 certificados externamente**.
- **G221 al mismo SHA:** `FIVE_QA_SAME_ORIGINAL_IDS_COMPLETE_EXTERNAL_RELEASE_BLOCKED`; mismo `serviceId`, `bookingRequestKey`, versión, eventos y lectura Admin de las cinco operaciones del **PostgreSQL CI desechable**. `commercialLaunchAllowed=false`.
- **Matiz obligatorio:** el 5/5 G221 usa **aceptación inicial sintética** de conductor/repartidor preparada por dueño de la base en CI, algunas barreras de trigger desactivadas **solo durante ese seed** y reactivadas antes de las transiciones reales; `COMMIT` solo en una base aislada que GitHub destruye. No certifica operación humana, municipio, Geoapify en dispositivo, IdP real, transferencia PSP ni permiso de producción.
- **No confundas G221 con PR #41/G226:** este último audita **cinco IDs históricos distintos**: sus dos pasajeros cancelados siguen sin poder completarse y su reporte da **3/5 históricos** + **2/2 viajes nuevos QA**. Ambos resultados son compatibles; **no revivir nunca un viaje cancelado** ni usar G221 para “validar” los cinco IDs anteriores.
- **Veredicto de producto:** `GITHUB_QA_INTEGRATED_GREEN` / `STAGING_EXTERNAL_NOT_CERTIFIED` / `COMMERCIAL_NO_GO`.
- **No se ha autorizado merge, LIVE, gasto, PSP real, nuevas cuentas facturables ni despliegue Render/Supabase.** Conservar esas restricciones salvo orden explícita posterior del Owner.

### Hechos que no deben tergiversarse

| Afirmación | Estado comprobado |
|---|---|
| Existen cuatro superficies de código Cliente, Driver, Comercio y Admin | SÍ; la superficie Comercio aparece en el proyecto web Admin (`apps/movete-admin/comercio.html`) y debe verificarse/aislarse como rol independiente |
| Existe origen original, estados, recepción y comprobante Admin para cinco casos en PostgreSQL CI | SÍ, G221 5/5 con aceptaciones sintéticas |
| Las cuatro apps están autenticadas y conectadas entre sí por HTTPS externo con PostgreSQL Supabase persistente | **NO comprobado** |
| Un conductor con documentos y permisos reales aceptó y terminó viaje nuevo | **NO comprobado** |
| Un destinatario físico confirmó en su propio teléfono una entrega real | **NO comprobado** |
| PSP real/sandbox cobró, reembolsó y concilió cuentas | **NO comprobado** |
| Render y Supabase externos están desplegados y certificados | **NO comprobado; autorización requerida** |
| Backend soporta un millón de clientes simultáneos | **NO probado** |
| App lista para tiendas y operación comercial | **NO-GO** |

---

## 1. ARQUITECTURA QUE NO SE DEBE REHACER

**Cuatro superficies, cinco operaciones, una identidad del servicio:**

1. **A Backend/SQL** — `apps/mobility-expo/server/`; gateway HTTP seguro, PostgreSQL16, identidad/JWT, RLS, despacho y reserva, G38/G71 KYC/legal, sesión G42, G5/G67/G187 custodia, G93/G7 economía y Owner, G155/G157 reputación/antifraude, G197 radio de recogida, G198/G200/G214 objetos perdidos, G138/G142/G145/G146 Admin.
2. **B Cliente** — `apps/movete-cliente/` (Expo Android/iOS): elección libre AUTO/MOTO, paquetes y Comercios, precio/consentimiento, solicitud y recuperación, mapa/ETA/seguimiento, mensajes, calificación, incidencias y entrega.
3. **C Driver/Courier** — `apps/movete-driver/` (Expo Android/iOS): sesión propia, vehículo/servicio legal, documentos, disponibilidad y máximo de distancia real por carretera a recogida, ofertas privadas, aceptación única, navegación y etapas, evidencia de entrega, devolución de objetos y ganancias.
4. **D Admin/Comercio** — `apps/movete-admin/` (React/Vite): panel Admin/Owner con MFA AAL2 y RBAC, auditoría, casos, tarifas/comisiones, fraude, conciliación; portal de **personal de Comercios** servido por `comercio.html` / `src/merchant-main.tsx`. No conceder rol Admin a personal de Comercio. Si el objetivo es cuatro apps **independientemente instalables/desplegables**, resolver el empaquetado del portal Comercio sin compartir sesiones ni privilegios.

**Cinco servicios canónicos:** `AUTO_RIDE`, `MOTO_RIDE`, `DELIVERY_AUTO`, `DELIVERY_MOTO`, `COMMERCE`.

**Autoridad de una operación:** Cliente crea `requestKey` → Backend calcula ruta/cotización `quoteId` → se persiste `tripId`, `deliveryId` u `orderId` → Driver/Comercio actúan **sobre el mismo ID** → SQL valida fases/actores/tiempos → Admin lee independientemente ese ID + eventos + ledger. En `COMMERCE`, conservar además la relación exacta `orderId` ↔ `deliveryId`.

**Regla de seguridad:** las pantallas, la app, las pruebas o el administrador NO son la autoridad de una transición. Respetar `G38`, `G71`, `G42`, `G36`, límites zonales, roles exclusivos, RLS, PK/UNIQUE e idempotencia. No confiar en una bandera del JWT o un `status` presentado por el cliente.

---

## 2. QUÉ QUEDÓ REALMENTE COMPLETADO EN GITHUB (NO REPETIR)

### G215/G220/G221 — cerrar el hueco 0/5 QA
- `apps/mobility-expo/server/g202-five-original-service-journeys-pg-ci.mjs`: G202 detecta el manifiesto G221, selecciona cinco fuentes positivas persistidas en **el mismo PG CI** y utiliza lectura Admin G216 para entregas; conserva modo heredado de fuente pendiente/cancelada si no hay manifiesto.
- `apps/mobility-expo/server/g215-five-journey-e2e-readiness-pg-ci.mjs`: auditor de tabla original, evento, identidad, Driver, Courier/Recipient y Comercio. En workflow está `QORE_REQUIRE_FIVE_QA_CLOSURES=true`: falla si no llega a 5/5 QA.
- `apps/mobility-expo/docs/backend/staging_only/G220_ORIGINAL_PASSENGER_AUTO_MOTO_COMPLETE_QA_ASSERT_POSTGRES_CI_ONLY.sql`: dos reservas **nuevas originales** G73 AUTO y G100 MOTO; fases G177/G213 con G42 real de SQL; G138/G142 Admin; aceptación de oferta SOLO en fixture sintético, `ROLLBACK` de la suite original.
- `G216_VERIFIED_COMPLETED_DELIVERY_ADMIN_ASSERT_POSTGRES_CI_ONLY.sql`: dos entregas G122 AUTO/MOTO → G5 pickup/deliver → prueba G67 consumida → confirmación independiente G187 → Admin G216, fixture de aceptación sintética reversible.
- `G218_COMMERCE_ORIGINAL_ORDER_LINKED_DELIVERY_RECIPIENT_ADMIN_ASSERT_POSTGRES_CI_ONLY.sql`: G150 pedido `ready` con G5 vinculado → Courier → G67 → G187 → dos lecturas Admin G146/G216.
- `G219_ACTIVE_ORIGINAL_DELIVERY_ADMIN_TRACE_POSTGRES_CI_ONLY.sql`: seguimiento aceptado/recogido sin declarar entrega antes de G187.
- `apps/mobility-expo/server/g221-five-original-persistent-e2e-pg-ci.mjs`: repite las tres suites positivas como `COMMIT` controlado en **PG desechable** restaurando triggers; conserva confirmaciones positivas; los negativos originales corren aparte en CI.
- `G221_FIVE_PERSISTED_ORIGINAL_QA_SOURCES_POSTGRES_CI_ONLY.sql`: manifiesto restringido de cinco fuentes originales.
- `apps/mobility-expo/server/g221-five-same-id-qa-certification-pg-ci.mjs`: reconciliación de cinco ID, claves y pasos entre G202 y G215; produce JSON de certificado **SOLO QA**.
- Artefactos GitHub Actions: `qore-g202-five-original-journeys-<sha>`, `qore-g215-five-journey-e2e-reality-<sha>`, `qore-g221-five-same-original-id-qa-<sha>`.
- **CI pasada no prueba** que estas funciones `*_CI_ONLY.sql` existan en un Supabase externo ni que sobrevivan a reinicios de servicios reales.

### Capacidades parciales existentes, probar antes de reescribir
- AUTO: cotización/ruta G72/G73, ofertas privadas G4, persistencia, reintentos G113, aceptación G205, etapas G177, Admin G138, ledger G93, recuperaciones G95/G207.
- MOTO: reserva/cotización G100/G102, legal G118 cerrado, Driver G169/G189, sesión G213, Admin G142/G212, protección de doble viaje G103.
- ENVÍOS: G5, G10, G66/G67, G121/G122 consentimiento y tarifa, G123 fence, G145/G216, G187 destinatario.
- COMERCIO: G45/G139 comprador, G148 preparación, G150 vínculo precio-entrega, G154 despacho solo `ready`, G156 inbox merchant, G173 sesión/rol, G146/G151/G217 Admin.
- Capacidad transversal: límites de recogida G197/G199, objetos G198/G200/G214, G155 calificaciones, G157/G158 antifraude/triage, comisiones Owner G116/G124, Geoapify G128/G129/G130/G134, recuperación nativa y controles de estado.
- Verificar que TODOS estos contratos están conectados a la UI operativa en cada plataforma. Un módulo presente y una prueba unitaria verde **no** equivalen a una función utilizable por un usuario.

---

## 3. RIESGO DE DUPLICACIÓN — PRs EN PARALELO (LEER ANTES DE MERGE)

Al corte, abiertos y en **DRAFT**:

| PR | Qué contiene | Acción para siguiente arquitecto |
|---|---|---|
| [#41 G226](https://github.com/mezas3238-hue/Qore-mobile-/pull/41) | Relectura histórica: **3/5** de cinco fuentes anteriores más dos nuevas de pasajeros, sin revivir canceladas | **Comparar** con G221; utilidad: auditoría de cohortes y prohibición de resucitar canceladas. Apilada en #40 |
| [#40 G225](https://github.com/mezas3238-hue/Qore-mobile-/pull/40) | Cierra con COMMIT QA dos envíos y un Comercio originales históricos | Reutilizar seguridad/negative gates solo tras comparar; apilada sobre #39 |
| [#39 G224](https://github.com/mezas3238-hue/Qore-mobile-/pull/39) | Dos pasajeros **nuevos** completados con COMMIT y leídos desde otras conexiones | Contrastar frente al G221 integrado; apilada en #37/#38 |
| [#38 G223](https://github.com/mezas3238-hue/Qore-mobile-/pull/38) | Manifiesto inmutable con digest SHA-256 y relectura independiente | Evaluar qué añade frente al manifiesto G221; no duplicar registro |
| [#37 G222](https://github.com/mezas3238-hue/Qore-mobile-/pull/37) | Precio de la cotización AUTO mediante campaña Owner G93 para fixture | Comprobar si mejora reglas de pricing sin alterarlas remotamente |
| [#36 G221](https://github.com/mezas3238-hue/Qore-mobile-/pull/36) | Comparación de G202/G215 con cinco casos rollback y barreras G38/G118 | **No es el mismo G221** ya integrado en rama soberana: cotejar nombres, no aplicar a ciegas |
| [#35 G220](https://github.com/mezas3238-hue/Qore-mobile-/pull/35) | Cinco escenarios QA de rollback, otro recorrido de pasajeros | Código equivalente o superado; no fusionar sin revisión |
| [#34, #33, #32, #31, #30, #29, #28, #27](https://github.com/mezas3238-hue/Qore-mobile-/pulls) | Auditorías previas, envíos, chat, locks, escalabilidad | Identificar qué está incorporado al HEAD y qué NO mediante diff/ancestría |
| [#22 Scale](https://github.com/mezas3238-hue/Qore-mobile-/pull/22) | Plan de >2M registros/1M simultáneos, **sin prueba real de carga** | Usar como hipótesis de dimensionamiento, NO como capacidad certificada |

**Orden seguro:** leer HEAD y CI actuales → comparar `merge-base`, `compare` y archivos nuevos → seleccionar mejoras de seguridad/funcionalidad con tests → commit a rama autorizada, CI al SHA exacto → no merge sin orden explícita del Owner. Tratar todas las ramas paralelas como divergentes y potencialmente obsoletas.

---

## 4. BACKLOG EJECUTABLE — P0 BLOQUEANTES PARA APP FUNCIONAL

**P0-A — Migraciones y backend persistente STAGING (mayor bloqueo).**
1. Inventariar las decenas de SQL QA actuales en `apps/mobility-expo/docs/backend/staging_only/`. Son **CI_ONLY** con guards `qore_disposable_chain`, funciones QA y datos sintéticos; **NO ejecutar ni copiar tal cual en Supabase externo**.
2. Crear **migraciones reales, idempotentes y versionadas para Supabase STAGING** con tipos/tablas/constraints/fns/roles/RLS/índices/triggers/fences, sin referencias a fixtures, sin privilegios owner-only expuestos, sin `DISABLE TRIGGER`, sin hardcoding de cuentas y sin condición `current_database()='qore_disposable_chain'`.
3. Hoy `apps/mobility-expo/supabase/migrations/` muestra **solo dos** migraciones base de 16-Oct. Se requiere construir y validar **cobertura completa de esquema** de los cinco servicios en una base STAGING separada, nunca migrar `main` ni LIVE inadvertidamente.
4. Usar migración `up`/verificación de integridad/plan de rollback **seguro**; pruebas de regresión SQL con rol limitado y `service_role` por el backend, no desde apps. Probar instalación en PostgreSQL nuevo y re-aplicación, audit RLS y permisos (anon/authenticated deny), aislamiento y one-winner.
5. Sustituir aceptación sintética por **flujo real autorizado de ofertas/aceptación** G38/G71/G42 con proveedor IdP, legalidad vigente y tracking de actor. La ciudad/servicio no puede hacerse legal por un fixture.

**P0-B — Backend HTTPS real con Render, solo tras autorización específica.**
1. `render.yaml` es blueprint STAGING `free`, `autoDeployTrigger: off`, `LIVE_TRIPS_ENABLED=false`; no inicia servicios por existir en Git.
2. `apps/mobility-expo/server/run-g4-render-staging.mjs` exige `QORE_RENDER_STAGING_APPROVED=true`, hostname TLS fijado, `PORT`, Supabase project ref, clave pública+service key **exclusivamente servidor**, cursor signing key, origen Admin.
3. `render-staging-ingress.mjs` exige HTTPS proxy/Host, `Bearer`, CORS restringido, tamaño limitado y carriles de admisión. `/_qore/liveness` solo dice **PROCESS_UP_ONLY**; añadir readiness **real** de Auth/DB/RPC/roles/rollback/fences, sin exponer secretos ni ser endpoint público peligroso.
4. Con autorización: crear proyecto **Supabase STAGING separado**, config IdP/signup cerrada, identidades sintéticas verificadas, aplicar solo migraciones aptas STAGING, conectar Render a Supabase, DNS/TLS y logs privados. Demostrar tráfico desde **dispositivos separados** y Admin web contra el **mismo backend**. No contratar planes pagos ni cambiar producción sin nueva autorización.
5. Añadir runbooks de backups/PITR, pool de conexiones, timeouts, reinicio, recuperación y secretos/rotación. Registro de quién aprobó, costos, entorno y SHA.

**P0-C — Hacer FUNCIONAR las cuatro interfaces, NO solo módulos.**
- **Cliente:** login/logout reales, onboarding; pestañas AUTO/MOTO seleccionables libremente con tarifas/ETA independientes; reserva sin duplicar, consentimiento de precio, pantalla del viaje con GPS/arribo/inicio/fin, cancelar, reintentos GET, historial y recibo. Envíos con medidas/peso/direcciones/fare/consent + seguimiento; Comercio catálogo, carrito, sustituciones, confirmación, pedido, enlace a delivery, calificaciones.
- **Driver:** proyecto Supabase correcto y KYC legal vigente; `DriverApplicationProviders` hoy declarado sin runtime operativo en `apps/movete-driver/app/_layout.tsx` según README. Integrar el backend HTTP real, oferta privada, expiración/accept atómica, distancia máxima de recogida **por carretera**, disponibilidad, GPS y fases sin perder ID; navegación/restauración foreground/background; prueba G67 y chat.
- **Comercio:** portal identificado hoy dentro de `apps/movete-admin/comercio.html` + `src/merchant-main.tsx`; demostrar personal merchant con rol **merchant** y experiencia independiente de Admin. Catálogo/stock/precio, caja pedidos, aceptar/preparar/ready, courier autorizado, incidencias, cancelación y reembolso, estado cliente. Si el Owner exige distribución separada, empaquetar host/app de Comercio independientemente antes de lanzamiento.
- **Admin:** login IdP real TOTP/AAL2, rol exclusivo, sesión revocable, activar `AdminRuntimeProvider`/G75 y trazas solo cuando backend externo validado. Mostrar mismas cinco órdenes/IDs, Actor/Driver/GPS/custodia, soporte, fraude, pagos, comisiones y casos. **No activar por pasar tests de mocks**.
- Ver los README actuales de Cliente, Driver, Admin: todavía declaran varias capacidades **sin runtime conectado/credenciales reales**. Resolver y actualizar documentación **después** de evidencia funcional.

**P0-D — Probar cinco recorridos reales de STAGING con dos o más participantes independientes.**
1. `AUTO_RIDE`: cuenta B Cliente → tarifa Gs sobre ruta comprobada → reserva nueva → Driver A elegible/real acepta oferta privada → GPS/arribo/pickup/complete → reconciliación de G93 → Admin G138 del **mismo tripId**.
2. `MOTO_RIDE`: B elige MOTO → G100 original → conductor MOTO con permisos **separados para pasajeros** → G118/G213 real → estados → Admin G142. **No sustituir permiso MOTO pasajero por permiso de MOTO cargo**; si permiso municipal falta, informar `LEGAL_BLOCKED` y no habilitarlo.
3. `DELIVERY_AUTO`: remitente B G5/G122 → Courier AUTO elegible G10 → recogida real → evidencia G67 contra orden original → destinatario distinto confirma G187 → Admin G216/G145; disputa y reversión cuando corresponda.
4. `DELIVERY_MOTO`: lo mismo respetando peso, capacidad, clase vehicular MOTO cargo, zona, precio y restricciones legales específicas.
5. `COMMERCE`: B crea `orderId` en G139 → Merchant staff real G148 prepara `ready` → G150 vincula `deliveryId` original precio-consentido → repartidor autorizado completa, receptor valida → comprador y Admin G146+G216 ven **orderId/deliveryId exactos**. No declarar pedido entregado si no hay aceptación independiente.
6. Cada E2E requiere eventos de identidad/token/session, seguridad, fallo/expiración, idempotencia, timestamps, ledger, notificación, GPS y reinicio/dispositivo; artefacto JSON + captura de UI real sin PII. **Nada de usar solo SQL owner, deshabilitar triggers o test fixtures como sustituto**.
7. Modelo de estados de checklist por recorrido: `QA_PG_GREEN`, `STAGING_E2E_GREEN`, `EXTERNAL_LEGAL_BLOCKED`, `PSP_SANDBOX_PENDING`, `GO` únicamente con todos los gates.

---

## 5. P1 IMPRESCINDIBLES PARA OPERACIÓN CONFIABLE

### Pagos, tarifas, comisiones y contabilidad
- Paraguay, importes enteros `PYG/Gs`, sin centavos ficticios.
- Modelo inicial Owner: **AUTO comisión 15% = 85% conductor, 10% subsidio al cliente, 5% empresa**; **MOTO pasajeros comisión 12% = 88% conductor, 10% subsidio al cliente, 2% empresa**. Respetar definición económica oficial y contabilidad; **no confundir subsidio y comisión contable**.
- Owner puede configurar comisiones con MFA, versiones y evidencia: pasajeros 10–30%; envíos/comercios según política 0–30%; **tarifas pactadas históricas no deben recalcularse**. Subsidio 10% bajo campaña con vencimiento **60 días**, prorrogable a **90** con aprobación. Ver G93/G116/G124/G7; comprobar política exacta actual antes de cambios.
- PSP: elegir/contratar proveedor **solo con autorización**; antes programar contrato/adaptador sandbox, webhook firmado y anti-replay, idempotencia de cobro/cancelación/reembolso, ledger doble partida, reservas, payout, fee, subsidio, reembolsos/disputas, settlement diario y reconciliación Admin. No equivaler `PENDING` a cobrado.
- Owner/Admin reportes por servicio con solo conciliación verificable, alertas diferencias, reglas de no-cobro duplicado y dinero protegido en reinicios.

### Identidad, KYC, licencias, zonas
- Completar flujos reales de documento, OCR/revisión humana cuando proceda, estado, expiración/revocación, conductor seguro, cobertura, inspección, municipio y trazabilidad del revisor; rol exclusivo passenger/driver/merchant/admin/owner; no almacenar PII en logs.
- `G38/G71` verdadero para AUTO/carga solo con evidencias de autoridad; `G118` legal de pasajeros MOTO deliberadamente imposible en QA. Requiere autoridad externa municipal para servicio real; no desactivar constraint.
- Multi-servicio Driver `DRIVE` común para AUTO/MOTO con **tarifas/permisos/tipos de vehículo aislados**; mismo Driver no puede aceptar dos servicios simultáneos (G36/G103). Revalidación por cada transición.
- MFA AAL2/TOTP Admin/Owner, servidor valida JWT, expiración, grant G42, revocación instantánea, exclusividad y auditoría; secretos service-role solo en servidor.

### Geolocalización / mapa / radio de recogida
- Geoapify `GEOAPIFY_API_KEY` fue reportada configurada en GitHub, y módulos G128/G134/G129 existen; confirmar la disponibilidad vigente sin imprimir valor. Google Maps se mantuvo sin activar para evitar cargos no autorizados.
- `G130` **limitador propio del laboratorio** exige 300 créditos/día, 100 llamadas/día, 3 créditos/reserva. **No dimensiona una red de un millón de usuarios**. Contratar capacidad/componer caché/servicio alternativo solo con aprobación Owner; separar HTTP routing de GPS en vivo, ETA, navegación, peajes y geofencing.
- Driver elige máximo radio de recogida **en kilómetros de carretera**, no solo Haversine. Respetar también distancia a comercios, vehículos y preferencias, siempre con validación backend/SQL y fuente de ruta; expiración de disponibilidad.
- Permisos de ubicación foreground/background, batería, precisión, señal perdida, viaje sin GPS, protección del domicilio, caducidad del dato, ETA y fallback seguro.
- Android real e iOS real: rutas y cambios de posición, push, interrupciones, regreso del sistema y pantalla apagada.

### Chat, pertenencias, reputación, fraude
- Cliente puede escribir al Driver tras viaje para objetos perdidos; chat dentro de app con ID de viaje, tiempo/límite de acceso documentado, comunicación bidireccional privada, sin revelar teléfono, bloqueo/abuso y escalación Admin. G198/G200/G214 **existen**; probar UI real, reapertura/closure, disputas y privacidad.
- Cliente debe calificar Driver; también calificar **Comercio y repartidor por separado**; añadir reputación de participantes con entrega/servicio verificado, ventana de evaluación, prevención de auto-calificación, 1 evaluación por relación e idempotencia.
- Antifraude inspirado por casos de abuso de plataformas: cuentas falsas, colusión, ubicaciones imposibles, cancelaciones manipuladas, pedidos falsos, evidencias suplantadas, chargebacks, reclamaciones, marketplace abuse, múltiples cuentas; señales separadas de sanción, cola de revisión humana, pruebas, explicabilidad, apelaciones y reversión de errores. G155/G157/G158 como base, **sin ban automático por score o calificación baja**.

### Estabilidad nativa y recuperación
- El Owner rechaza apps que “quedan colgadas”: registrar crash/ANR, p95 navegación, memoria, tiempo en foreground/background, fugas, reintento exponential backoff con jitter, circuit breakers y expiración.
- Prueba crítica: cerrar app/desconectar Wi-Fi durante reserva, aceptación, inicio, finalización y pago; reiniciar, recuperar desde servidor por request key/ID con estado monotónico y **sin repetir POST/cobro**. Validar cambios tardíos no retrocedan estado; incluir Android e iOS físicos.
- Push/APNs/FCM, eventual missed push recuperable por polling, deep link controlado, sesión caducada, revocación, mapa sin cuota, y pantallas offline/errores sin pantalla en blanco.
- Al publicar por tiendas: EAS build firmado, identidades paquete, permisos/background y políticas de privacidad, QA interna/TestFlight/Play internal testing; todavía **no** hay certificación de release.

---

## 6. P2 — ESCALA A MILLONES, COSTOS Y EXPERIENCIA PREMIUM

- Objetivo Owner: **más de 2 millones de cuentas** y horizonte extremo de **1 millón de actores conectados simultáneos**, sin confundir usuarios registrados, sockets, GPS/ticks, RPS, viajes iniciados o peticiones concurrentes.
- `render.yaml` hoy es **Free, una instancia**; en `run-g4-render-staging.mjs` admisión por réplica: `256` lecturas y `128` escrituras activas (límites configurables), `32768` buckets de identidad; no es millones de usuarios, ni requests/segundo certificados.
- PR #22 hace planificación hipotética; **NO** ha probado 1M conexiones. Construir laboratorios reales progresivos: >100k, 500k, 1M sesiones simuladas según capacidad disponible; baseline 1k→10k→100k solicitudes durables con distintas mezclas; medir p50/p95/p99, tasa error, pérdida/duplicación/orden, locks DB, crecimiento de storage, costos, colas y recuperación ante fallo.
- Ingeniería faltante: despacho worker/outbox durable, cola con leasing y DLQ, horizontal replicas, rate limiting distribuido (no solo memoria por instancia), PostgreSQL indexing/partitioning si mediciones lo exigen, PgBouncer/pool/transactions, caché segura, geoindex/geohash/postGIS si disponible, tracking fanout/realtime, backpressure, autoscaling, regional failover, métricas, alertas y DR. Sin logs de ubicación/PII innecesarios.
- Definir SLO concretos de disponibilidad y latencia en condiciones medibles antes de certificar; incluir caos de caída del worker y recuperación sin duplicados.
- UX/UI de cuatro productos debe ser sofisticada y elegante, superior en calidad percibida a alternativas conocidas. Figma “QORE Signature” conectado fue trabajo de diseño previo: recuperar su archivo vigente por Figma, inspeccionar tokens/componentes/pantallas, implementar en Expo/Vite sin reducir accesibilidad, batería, rendimiento ni seguridad; **diseño no sustituye backend**.

---

## 7. PRIMERAS 12 ACCIONES OBLIGATORIAS DEL NUEVO ARQUITECTO

1. Abrir **este handoff completo** y registrar HEAD actual en GitHub, diferencias desde `c03a727...`, últimos dos runs y PRs #35–#41. Si otro arquitecto integró avances, no borrarlos.
2. Obtener artefactos G202/G215/G221 del SHA actual. Confirmar SQL/IDs/5/5 del **mismo** PostgreSQL desechable y el carácter sintético; contrastar los históricos de G226, no mezclar cohortes.
3. Hacer árbol de importaciones/rutas **realmente montadas** en B/C/D/merchant; detectar gates falsamente GREEN y funcionalidades con módulo pero runtime apagado.
4. Inventariar API y schema requerido por 5 servicios; abrir issue/checklist P0 con responsables claros A/B/C/D y **criterios de aceptación**, evitando commits cosméticos.
5. Construir **migraciones Supabase STAGING aptas externas** y pruebas fresh-install, RLS, roles, triggers, idempotencia; no desplegarlas aún.
6. Preparar entorno de STAGING aprobado técnicamente: `.env.example` parametrizado y secretos en store seguro, Render health/readiness, logging privado, migrate/rollback rehearsal, sin crear servicios pagos.
7. Conectar Cliente y Driver a un mismo backend HTTPS STAGING autorizado y dos identidades IdP distintas; comprobar login, revocación y recuperación original antes de intentar dispatch.
8. Cerrar primero **AUTO comercialmente elegible** desde cotización real hasta Driver/Admin y reconciliación; si legal/GPS/IdP externo bloquean, informar el **gate** y avanzar funcionalmente en otras pistas sin falsearlo.
9. Integrar MOTO pasajero con **permiso específico**, y envíos AUTO/MOTO con G10/G5/G67/G187; no habilitar conductor ilegal.
10. Conectar Merchant staff + comprador + courier + Admin con pedido y envío originales; verificar que Comercio tiene UX/roles separados y que conciliación no es ficticia.
11. Integrar chat pertenencias, calificaciones bilaterales/trilaterales, antifraude con apelaciones, radio carretera, Geoapify cuotas y pruebas de dispositivos/reinicios.
12. Ejecutar una **batería final E2E externa** de cuatro apps/cinco servicios + carga/seguridad/resiliencia; preparar release por etapas con aprobación Owner, nunca LIVE o tiendas por defecto.

**No bloquear todo el trabajo de ingeniería esperando una respuesta genérica.** Las únicas confirmaciones que debe pedir el siguiente arquitecto son las necesarias para **crear/contratar/desplegar recursos externos o habilitar operaciones legales/reales**; presentar objeto, costo/riesgo, alcance y rollback.

---

## 8. GATES DE ACEPTACIÓN — ¿CUÁNDO SE CONSIDERA TERMINADA?

Un servicio está **`STAGING_E2E_GREEN`** solo si:
- Cliente registra la **solicitud nueva** en app instalable/HTTPS y puede recuperarla tras reinicio.
- El servidor verifica actor/rol/IdP, cotización congelada, condición legal, geofence, despacho atómico (no fake accept).
- Conductor/Comercio de sesión **independiente** recibe y ejecuta el mismo `tripId/deliveryId/orderId`.
- Eventos/estado final cumplen transiciones, revisión, integridad/orden, compensación/idempotencia, notificaciones y rastreo.
- Destinatario independiente confirma en su dispositivo si es entrega; comercio conserva `orderId` ↔ `deliveryId`.
- Admin autorizado por AAL2 audita esa operación (y roles revocados/forjados NO); ledger verificado sin reportar cobro que no existe.
- La matriz de tests nativos, HTTP real y base persistente sobre **SHA exacto** es VERDE y tiene artefactos trazables, fallos adversariales y revisión de seguridad.
- Para `COMMERCIAL_GO` además se requieren permisos/seguro/contratos oficiales, real GPS/ETA, PSP y conciliación reales, soporte/privacidad, autorización Owner. **No se puede “automatizar” que un municipio autorice una actividad sin prueba oficial.**

**Registro obligatorio visible al Owner:**

| Indicador | Corte G221 | Para STAGING real | Para comercial |
|---|---|---|---|
| 5 escenarios del mismo PG16 con aceptación sintética y Admin | **5/5** | mantener como regresión | solo antecedente |
| 5 recorridos con app instalada ↔ HTTPS ↔ Supabase externo ↔ Admin | **NO VERIFICADO** | 5/5, sin mocks | 5/5 |
| Identidad real, KYC, GPS, permiso municipal, reparto físico | **0/5 externos** | pruebas y gates diferenciados | todos autorizados |
| PSP/ledger conciliado | PENDING sintético | sandbox autorizado + 0 discrepancias | cobros/reembolsos reales conciliados |
| Escala millón simultáneos | No demostrada | medición/costos y arquitectura | capacidad según SLO acordado |

---

## 9. COMANDOS, ARCHIVOS Y OPERACIÓN SEGURA

**Primero inspeccionar y correr CI sin privilegios de producción:**

```bash
git fetch origin
git switch integration/qore-mobile-e2e-four-apps-20261027
git status --short
git rev-parse HEAD
git log --oneline -15

# CI, SHA exacto y artefactos desde GitHub Actions:
# .github/workflows/qore-four-apps-unified.yml
# .github/workflows/mobility-g4-postgres-disposable.yml

cd apps/movete-cliente && npm ci && npm run check
cd ../movete-driver && npm ci && npm run check
cd ../movete-admin && npm ci && npm run check && npm run build
cd ../mobility-expo && npm ci && npm run check
```

- Cada app tiene `package.json` y su propio entorno; no compartir `service_role` con Expo/Vite.
- Backend `run-g4-render-staging.mjs` y `render.yaml` son puntos de partida **solo tras autorización Owner**.
- GitHub `GEOAPIFY_API_KEY` reportada, nunca imprimir valores ni copiar a `EXPO_PUBLIC_*` / `VITE_*`. En navegador/móvil solo claves **publishable**.
- Conservar `LIVE_TRIPS_ENABLED=false`, `QORE_RENDER_NO_COMMERCIAL_TRIPS=true`, `QORE_MOBILITY_ENV=staging`, y las banderas Cliente/Driver/Admin OFF hasta los gates respectivos.
- Nunca usar `G220/G221` como migraciones de terceros; limitadas a `qore_disposable_chain`. GitHub Actions ci verde no sustituye despliegue real ni permiso.
- Revisar tests de migraciones/entrada HTTP, auth, cargo, Commerce, roles, KYC, carrera aceptación, anti replay, cancelación y flujo multi-actor.
- Documentar PR/commit y **resultado final** con fecha/hora, SHA, run URL, casos positivos/negativos, cobertura original y bloqueos reales. El usuario quiere pruebas y app funcionando, no volumen de commits.

---

## 10. DECISIONES DEL OWNER QUE DEBEN SOBREVIVIR A CUALQUIER CHAT

- Mercado inicial **Paraguay**; moneda **PYG/Gs**; operaciones de pasajeros **AUTO y MOTO como elecciones separadas** del Cliente.
- Subsidio 10% pasajeros, AUTO 15%/10%/5%, MOTO 12%/10%/2%; Owner comisiones configurables por servicio con MFA y versionado, no modificar precios pactados.
- Hasta **millones de clientes**; pruebas de cientos/decenas de miles NO bastan como certificación del objetivo, ni límites 256/128 implican 1M.
- **Cuatro apps elegantes:** Cliente, Driver, Comercio, Admin. Priorizar disponibilidad, estabilidad, seguridad, diseño sofisticado de QORE Signature.
- Driver define máximo radio por **distancia real de carretera**, también para recogida en Comercio; no enviar ofertas por debajo/encima de su cobertura declarada de forma incorrecta.
- Cliente contacta al Driver **después** del viaje para recuperar pertenencias; comunicación dentro de app privada, soporte si corresponde.
- Cliente califica a Driver, **Comercio y repartidor**; sistema antifraude que detecta estafas y protege sin sanciones automáticas injustas.
- Autorizaciones de pasajeros MOTO no son las mismas que reparto MOTO.
- Una operación original, un estado durable, Admin independiente; jamás inventar una confirmación de entrega, autorización o PSP.
- Preferencia del Owner: **terminar implementación funcional en GitHub antes de traslado a Render/Supabase**, y no hacer merge, LIVE, contratación, gastos ni distribución de apps sin su instrucción.

---

## 11. PROMPT LITERAL PARA COMENZAR EL SIGUIENTE CHAT

> Actúa como **Arquitecto Ejecutivo Principal e Integrador A+B+C+D de QORE Mobile / Movete Fácil**.  
> Tu misión exclusiva es **terminar la aplicación**, no generar otros handoffs ni prototipos.
>
> Repositorio: https://github.com/mezas3238-hue/Qore-mobile-  
> Rama de trabajo: `integration/qore-mobile-e2e-four-apps-20261027`.  
> **Primero lee íntegramente:** `docs/handoff/HANDOFF_MAESTRO_QORE_MOBILE_G221_CINCO_QA_5DE5_PLAN_FINAL_STAGING_CUATRO_APPS_2026-10-30.md`.
>
> Continúa desde el HEAD actual (el previo fue `c03a727b2e71f0a6d140656a614ef19f2fd9bdcb`; el handoff se publica en un commit posterior). Verifica CI de PostgreSQL y A+B+C+D en ese HEAD, y revisa PR #35–#41, sobre todo #39–#41 apilados, antes de modificar.
>
> **Confirmado:** G215/G221 = 5/5 recorridos originales del mismo PostgreSQL **QA desechable con aceptación sintética**, 0/5 operación real certificada; por lo tanto no repitas esos laboratorios ni proclames aplicación comercial lista.
>
> **ORDEN:** (1) construir backend y migraciones **Supabase STAGING externas** seguras, sin copiar SQL CI_ONLY; (2) conectar las cuatro apps con usuarios y roles reales a un backend HTTPS autorizado; (3) cinco recorridos nuevos y finales Cliente→Driver/Comercio→Admin sobre los mismos IDs, autenticación, GPS, pruebas de entrega y dinero sandbox; (4) perfeccionar chat pertenencias, radio recogida carretera, calificaciones, antifraude, mapas, crash/restart y UX; (5) pruebas de escala, seguridad y dispositivos físicos; (6) preparar Render/Supabase/App Stores **sin desplegar ni gastar sin mi autorización explícita**.
>
> Usa los contratos existentes, corrige de raíz y corre las pruebas. **Cada respuesta debe indicar código cambiado, SHA, CI exacto, cuánto falta para funcionar realmente y bloqueos externos**. No confundas CI verde con IdP, licencias o PSP. No pierdas el contexto ni me hagas repetir decisiones.

---

**FIN DEL HANDOFF MAESTRO · G221 · 30-OCT-2026 · HASTA EL PRÓXIMO HEAD VERIFICADO**.
