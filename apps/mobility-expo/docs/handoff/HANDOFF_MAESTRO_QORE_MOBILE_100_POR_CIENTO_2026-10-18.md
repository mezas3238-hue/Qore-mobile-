# HANDOFF MAESTRO — QORE MOBILE / MOVILIDAD
## Continuidad integral, inventario técnico, diagnóstico honesto y plan hasta plataforma operativa al 100 %

**Corte:** 18 de octubre de 2026 (estado comprobado en este handoff).  
**Propietario:** proyecto QORE Mobile, plataforma de movilidad en Paraguay.  
**Destinatario:** siguiente arquitecto/ingeniero; debe continuar ejecutando, no empezar desde cero.  
**Fuente primaria vigente:** PR #7 del monorepo y Lovable **STAGING aislado**.  
**Estado comercial:** **NO LIVE; NO se pueden aceptar viajes ni cobrar clientes.**  
**Regla fundamental:** distinguir ALWAYS evidencia real de staging, CI sintética, interfaz demostrativa y funciones futuras. Un test verde no es un negocio operativo.

> **LEER PRIMERO:** el handoff histórico anterior `docs/handoff/CONTINUIDAD_G0_G1_2026-10-16.md` (incluye >20 rondas de decisiones, problemas y correcciones), el original `docs/handoff/HANDOFF_MAESTRO_QORE_MOBILE_MOVILIDAD_2026-10-16.md` (historia anterior y PR #3), y la documentación G4. **Este archivo es el índice MAESTRO ACTUAL y prevalece frente a datos históricos que ya cambiaron** (por ejemplo: Auth signup antes abierto, ahora cerrado; antes 0 usuarios, ahora 3 usuarios).

---

## 0. MENSAJE PARA EL SIGUIENTE ARQUITECTO — ACCIÓN INMEDIATA

**Continúa el proyecto QORE Mobile de transporte AUTO/MOTO, no el proyecto de trading.** El usuario exige una plataforma moderna, distinta de Bolt/Uber, con búsqueda real de conductores, alertas al conductor, aceptación exclusiva, foto/nombre/modelo/color/chapa verificados, posición del conductor acercándose, **distancia POR CALLE y minutos con tráfico** que se actualicen para el pasajero; también mejores condiciones económicas para conductores, tarifas transparentes, seguridad y capacidades originales validadas. Quiere poder probarlo en celulares **cuanto antes**, no solo laboratorios.

**Prioridad inmediata al abrir el nuevo chat:**
1. Leer este handoff y verificar los HEAD reales de PR #7/#2, última CI y estado Auth/RLS STAGING; no asumir que todo está en `main`.
2. **Resolver el bloqueo real del frontend de Lovable:** la implementación del panel diagnóstico de Auth/RLS en el commit Lovable `c5bd715b71cb1e5cd197d101f773af2aece4a393` dejó errores TypeScript de query builders dinámicos en `src/lib/staging-diagnostic.ts`. La siguiente petición al agente Lovable fue rechazada por falta de créditos. **NO afirmar que el nuevo preview compila**; comprobar cuota, corregir, pasar tests/build, comprobar preview restringida sin publicar.
3. El propietario sí pudo probar con su Android una herramienta HTML de diagnóstico **V3 externa a la app Lovable**. Su captura confirma **PASS V3 · Pasajero** con Auth y RLS de perfil/rol y tablas vacías, ligada a la cuenta correcta. Otra captura de **V2 con Conductor B seleccionado** es **AMBIGUA** porque V2 conservaba un PASS previo al cambiar de cuenta. Solicitar PASS **V3 vinculado a Conductor A y a Conductor B**, o certificar con JWT reales de forma segura sin compartir contraseñas.
4. Añadir **datos de prueba de propietarios distintos** solo de forma controlada/consentida, para comprobar RLS no vacua de solicitudes/vehículos y Storage privado; establecer proceso de limpieza. Lo ya probado en PostgreSQL de CI NO equivale a ese E2E remoto.
5. Preparar y revisar migraciones G3/G4 **para el NUEVO staging**, con rollback, permisos, controles de integridad, supervisión y acuerdo para pruebas. Ahora esas tablas existen **solo en CI efímera**. Luego desplegar backend HTTPS privado, conectar Expo, GPS, Google Routes, notificaciones y Realtime para hacer la primera prueba real **1 pasajero + 2 conductores**.
6. No pasar a viajes comerciales hasta gates técnicos, legales, aseguradores, de seguridad y pagos. MOTO no está habilitada comercialmente; no activar por bandera sin aprobación separada.

**Prohibiciones:** no fusionar PR #2, no trabajar en el Supabase antiguo, no publicar staging, no cambiar `main`, no poner claves/secrets/JWT/passwords en código/chat/logs, no activar `LIVE_TRIPS_ENABLED`, no hacer facturación ni envíos reales en silencio. Un cambio de roles autorizado del propietario ya se ejecutó y se verificó; no revertirlo ni otorgar admin. Evitar ciclos interminables de documentación sin integración tangible.

---

## 1. IDENTIFICADORES Y AISLAMIENTO — VERIFICADOS EN ESTA RONDA

| Elemento | Identificador / dirección | Estado |
|---|---|---|
| Repositorio | https://github.com/mezas3238-hue/Qore-mobile- | Monorepo compartido |
| **PR #7 MOVILIDAD** | https://github.com/mezas3238-hue/Qore-mobile-/pull/7 | **DRAFT, OPEN, NOT MERGED** |
| Rama de movilidad | `feature/mobility-monorepo-isolated-20261016` | Código correcto para continuar |
| HEAD observado PR #7 antes de crear este documento | `975fd439e9f85c8e1960fae80dbd45c3b2d89472` | Se actualizará al guardar este handoff |
| **PR #2 TRADING** | https://github.com/mezas3238-hue/Qore-mobile-/pull/2 | DRAFT, OPEN, separado |
| HEAD trading observado | `4608aeb2519262cef42f722b43caffdfd455701b` | **No tocar** |
| Rutas modificadas | PR #7: **152**; PR #2: **192** | **0 rutas coincidentes** |
| App movilidad en monorepo | `apps/mobility-expo/` | Expo/React Native |
| CI de movilidad | `.github/workflows/mobility-ci.yml` | Jobs Expo + PostgreSQL efímero |
| Lovable **NUEVO** | https://lovable.dev/projects/9c677bb2-746b-419f-ad9c-dd6d26bab944 | **QORE Staging Sandbox**, NO PUBLICADO |
| Preview Lovable restringida | https://id-preview--9c677bb2-746b-419f-ad9c-dd6d26bab944.lovable.app | Existe URL; compilación de diagnóstico nuevo **sin certificar** |
| Supabase **NUEVO** staging | ref `hylgkfgkcyrddokloljm` | Único backend admisible para pruebas nuevas |
| Supabase **ANTIGUO PROHIBIDO** | ref `qdqrlgzlotnfdxzpacxs` | **No consultar, migrar ni modificar** |
| Lovable antiguo | `2fa91fe1-e7a0-4fff-a16f-7d457b2d6eed` | Histórico «Movete Fácil»/ViajeYa, no reutilizar |
| Estado LIVE | `LIVE_TRIPS_ENABLED=false` | Debe seguir así |
| Plataforma destino | Paraguay, PYG | Foco inicial Asunción / Gran Asunción |

**Atención especial:** el proyecto Flutter de supervisión/trading en PR #2 es otro producto completamente distinto. También hubo un PR de transporte más antiguo (#3) y una rama histórica `feature/viajeya-expo-mvp-20261015`: **no regresar automáticamente a ese backend o PR**. La arquitectura vigente de movilidad es PR #7 y Lovable STAGING nuevo.

---

## 2. ÚLTIMA EVIDENCIA REAL — 18/10/2026

### 2.1 GitHub CI completamente verde para el HEAD previo

- Último PR run https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39149229928 — **SUCCESS**.
- Push run https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39149225629 — **SUCCESS**.
- **207 / 207 pruebas de código**: 102 tests dominio Expo, 83 tests servidor, 5 tests gate Auth, 8 tests Storage REST offline, 9 tests tres identidades.
- Jobs adicionales PostgreSQL 16 **efímero**: G1 esquema/RLS/Storage, G2 preflight/revisión vehículo, G3 viaje AUTO sintético y carrera entre dos conductores, G4 ofertas privadas TTL/consentimiento, carrera atómica, outbox push y competencia de dos workers. Ver logs del run #39149229928.
- TypeScript y `expo export --platform web` correctos, guard de `LIVE_TRIPS_ENABLED=false` correcto.
- **No** hay certificación Android/iOS firmada, Push real, GPS en tres dispositivos, Google Maps/Routes real, Supabase remoto con G3/G4 ni operaciones comerciales.

**Al crear este handoff se generará un nuevo HEAD y nueva CI. Citar el RUN del HEAD FINAL cuando termine, no confundir con la ejecución previa.**

### 2.2 Lectura directa del Supabase STAGING NUEVO

Consultas agregadas READ-ONLY (sin exponer UUID/correos) realizadas en esta ronda:

| Comprobación | Resultado |
|---|---|
| `auth.users` | **3** |
| Cuentas con email confirmado | **3 / 3** |
| Cuentas que ya iniciaron sesión alguna vez | **3 / 3** (NO equivale a PASS RLS V3 de las tres) |
| `public.profiles` | **3** |
| `public.user_roles` | **3** |
| `passenger` | **1** |
| `driver` | **2** |
| `admin` | **0** |
| Tablas `public` | **10** |
| Tablas con RLS habilitado | **10 / 10** |
| Solicitudes de vehículo | **0** |
| Vehículos aprobados/registrados | **0** |
| Documentos en `storage.objects` | **0** |
| Bucket evidencia STAGING | **Existe (1)** |
| RPC G2 de pending para authenticated | **EXECUTE=false**, no expuesta directamente |
| G3 tabla de viajes de ensayo | **NO INSTALADA** |
| G4 tabla ofertas privadas | **NO INSTALADA** |

En revisión anterior del Auth NATIVO `GET /auth/v1/settings` sobre el ref de staging, se confirmó **HTTP 200 + `disable_signup=true`** el 18/10/2026 a las 02:47:57 UTC; el propietario activó **Disable sign-up** personalmente. Email funciona, autoconfirm desactivado y Auth anónimo deshabilitado. **No se certificó `password_hibp_enabled`** porque ese campo no estaba expuesto; jamás emplear `configure_auth` a ciegas, ya que puede reescribir configuraciones colaterales. Revalidar `disable_signup` antes de cualquier fase nueva de staging.

### 2.3 E2E auténtico con navegador Android: evidencia y límites

El propietario ejecutó el HTML QA `QORE_Staging_Diagnostico_3_Cuentas_V3.html` **desde su Chrome Android** y envió capturas:
- **PASS · Pasajero — acceso y permisos verificados**; registro público deshabilitado, `auth/v1/user` verifica identidad al principio/final, lectura no filtrada muestra **exactamente un perfil propio** y **único rol pasajero sin admin**, sin filas ajenas de solicitudes/vehículos y una segunda validación de la misma identidad.
- Screenshot con **Conductor B seleccionado y PASS en V2** NO prueba inequívocamente Conductor B: V2 tenía bug de estado UI (cambiabas selector y se conservaba PASS anterior). Se produjo V3 que invalida resultado al cambiar de cuenta/servidor y exige resultado con nombre de la cuenta realmente autenticada. **No se recibieron todavía capturas inequívocas PASS V3 de A y B**.
- Los tres usuarios muestran login alguna vez en Auth según SQL, pero **el login no demuestra RLS por sí solo**.
- Como `mobility_vehicle_applications` y `mobility_vehicles` están vacías, los resultados «sin filas ajenas» en estas tablas son **vacíos no concluyentes**. Para certificar aislamiento real deben existir objetos sintéticos de dos propietarios y negarse su lectura cruzada.
- La herramienta HTML fue entregada como archivo descargable **en conversación**; no equivale al frontend integrado de Lovable y no está versionada en PR #7. El código de esa herramienta tuvo pruebas JS **offline**, además del PASS de pasajero real. No almacenar contraseñas/tokens, no pedir credenciales al usuario.

---

## 3. INVENTARIO DE TRABAJO HECHO — DESDE EL INICIO

### 3.1 Producto, investigación y economía

1. Se aclaró que la referencia era **Bolt para pedir viajes** y Uber, no Bolt.new. El dueño quiere diferenciarse por tecnología, experiencia, calidad, transparencia y ganancias del conductor.
2. Se diseñaron las tres figuras: pasajero, conductor (auto/moto) y operador; pasajeros y conductores se registran, los vehículos necesitan identificación, chapa, modelo, color, categoría, póliza, licencia, documentación e inspección.
3. Investigación de comisiones y viajes en Paraguay, rutas orientativas publicadas, costos de combustible/tiempo improductivo, competitividad, rentabilidad por hora del conductor y tarifa asequible. Documentos históricos en `docs/research/`; confirmar precios actuales con fuentes/recibos, no tomarlos como cotizaciones vigentes.
4. Comisión de referencia **10 % DEMO** favorable a conductores frente a porcentajes históricos investigados; antiguo backend tenía 15 %, pero NO se utiliza para producción. **NINGUNA tasa comercial definitiva aprobada.** No prometer conductor gana más sin medir **ingreso neto tras combustible/seguro/tiempo/costos**, cancelaciones y operación de la plataforma.
5. Laboratorios `src/domain/fairprice.ts` y `src/domain/tariff-lab.ts`: aritmética hipotética de guaraníes, pisos conductor/plataforma, tarifa base/km/minutos, fracción de comisión, hipótesis de moto, sin pagos ni cotizaciones vinculantes.
6. Estrategia futura pagos: efectivo, QR local y tarjeta mediante PSP autorizado, manejo de deuda de comisión de conductor por efectivo, wallet/ledger inmutable, liquidaciones, conciliación, devoluciones/contracargos, impuestos y facturación. **Diseñado, no implementado operativamente**.
7. Diferenciadores propuestos: QORE Camino Claro, FairMatch, Encuentro Inteligente, Escudo, Confianza Radical; valorar seguridad, transparencia y operación en redes débiles. NO afirmar exclusividad frente a Bolt/Uber sin benchmarking.

### 3.2 Aplicación Expo / React Native / UX actual

Stack Expo SDK 57, React Native 0.86, React 19, Expo Router, TypeScript; app en `apps/mobility-expo/`. Existe shell/rutas de prototipo: inicio, demo pasajero, conductor, admin ficticio, historial, registro, login, alta conductor, perfil, revisión, mapas, precios FairPrice, privacidad/acerca. Algunas vistas son DEMO de un mismo dispositivo con `RideContext`: **NO interconectan usuarios reales**, no persisten un viaje en el backend nuevo.

Componentes de navegación Google Maps/Waze por deep link y mapas de prueba; `expo-maps` requiere compilación de desarrollo con claves Android restringidas. No existe build Android/iOS certificado del producto multiusuario. `production-api.ts` falla de forma segura con LIVE deshabilitado.

Trabajo de `src/domain/qore-radar-feed.ts` y `qore-radar-polling.ts` con revisiones monotónicas de servidor, origen de API HTTPS fijado (`pinnedApiOrigin` antes de enviar JWT), invalidación de información caducada y fichas de conductor solo tras aceptación. **Todavía no se montaron como experiencia real en pantallas Android/iOS conectadas**.

### 3.3 Backend aislado y seguridad G0/G1/G2

1. Se corrigió una contaminación arquitectónica peligrosa: transporte/Expo frente a Flutter trading; PR #7 creado como módulo aislado con su propia CI. Nunca desplazar apps de trading.
2. Se creó Lovable STAGING nuevo en lugar de aprovechar el viejo backend de ViajeYa. Base PostgreSQL Supabase separada, 10 tablas propias de staging, todas RLS, bucket privado de evidencia y funciones de control de estado/vehículo.
3. G1: perfiles por dueño, roles seguros, Storage privado por carpeta/propietario, pruebas SQL de grants/RLS y MIME/ruta; `auth.users` gestionado por Admin Auth nativo y no por INSERT directo.
4. G2: revisión de solicitud/vehículo, estado pendiente, validez del expediente, preflight de habilitación; roles de usuario no tienen EXECUTE sobre acciones administrativas. Tests SQL de elegibilidad/auto, bloqueo de MOTO y abuso.
5. `scripts/staging-auth-policy-gate.mjs`: consulta Auth settings nativos, exige `disable_signup=true`; ref antigua prohibida, no secretos service-role en cliente. `scripts/staging-auth-readonly.mjs`, `staging-storage-readonly.mjs` para pruebas futuras con JWT reales; resultados reales de Storage **pendientes**.
6. Tres cuentas de ensayo en nuevo staging, declaradas ficticias por el dueño; distribución aprobada: **pasajero y dos conductores**. Dos actualizaciones SQL atómicas y con pre/postcondiciones exclusivamente en `public.user_roles`; verificación independiente de 3 roles, 0 admin. No se modificaron contraseñas de las cuentas.
7. `scripts/staging-three-actors-readonly.mjs` y tests: procedimiento de 3 sesiones Auth verificadas, lectura de perfiles/roles propios y ajenos; requiere ref correcto y UUID pin para las tres Gmail QA, variables de entorno privadas, y signup cerrado. Solo pruebas mocked en CI; flujo E2E completo no ejecutado en un entorno automatizado con tres JWT entregados al script.
8. Se evitó pasar credenciales a chat o GitHub y se desactivó el registro abierto nativo. **No habilitar signup solo para facilitar pruebas.**

### 3.4 G3 — viaje AUTO sintético, lifecycle y bloqueo transaccional

Archivos:
- `docs/backend/staging_only/G3_AUTO_DEMO_TRIP_CONTRACT_POSTGRES_CI_ONLY.sql`
- `scripts/sql/g3_auto_demo_trip_smoke.sql`
- `scripts/sql/g3_concurrent_accept_ci.sh`

Con contratos PostgreSQL 16 **solo en base desechable CI** se validó crear viaje AUTO de prueba, revisión monotónica/audit trail, transiciones `searching → accepted → arriving → in_progress → completed`, rechazo de cambios inválidos y doble aceptación; dos conexiones SQL distintas compiten por el mismo viaje y solo un conductor es adjudicado. Preflight vehículo y bloqueo de moto.

**No existe G3 en Supabase remoto.** En el nuevo backend no hay tabla ni viaje real que el móvil pueda solicitar. No afirmar que el pasajero puede actualmente pedir transporte desde tres teléfonos.

### 3.5 G4 QORE Radar — búsqueda, matching, ofertas y llegada del conductor

**Contratos y pruebas versionados**:
- `server/g4-qore-radar-core.mjs`: filtra consentimiento y GPS impreciso/desactualizado, revisa conductor y vehículo elegible, ordena candidatos con ETA por calle y bonificación justa acotada. No divulga ubicación de conductores sin asignación. AUTO-only.
- `server/g4-google-road-router.mjs`: adaptador Google Routes `computeRouteMatrix` con `TRAFFIC_AWARE`, sin usar fallback como ETA real, cuotas previstas. **No conectada clave/proyecto Google ni tráfico real**.
- `docs/backend/staging_only/G4_PRIVATE_AUTO_OFFERS_POSTGRES_CI_ONLY.sql`: oferta por conductor+vehículo, TTL 5–30 segundos, límite fanout de 5, rechazo/idempotencia, preflight en oferta y aceptación, un ganador bajo lock de viaje, ofertas perdedoras retiradas. Revoca el viejo atajo G3 de aceptar sin oferta **solo donde se aplique el contrato G4**, hoy CI.
- `scripts/sql/g4_offers_smoke.sql` y `g4_concurrent_offer_accept_ci.sh`: pruebas SQL con conductores distintos y el mismo viaje.
- `server/g4-offer-gateway.mjs`: GET oferta propia y POST aceptar/rechazar, JWT confirmado y rol conductor desde servidor, payload sin `driverId` falsificable.
- `server/g4-rider-status-gateway.mjs`: snapshot del pasajero AUTORIZADO por su `passengerId` Auth, conductor/ficha solo tras aceptación, ETA y GPS solamente frescos y verificables, sin seguimiento de llegada después del encuentro.
- `server/g4-loopback-http-transport.mjs`: HTTP entre tres actores de QA únicamente en **127.0.0.1**, no accesible públicamente; rutas y JSON limitados, sin CORS browser abierto.
- `server/g4-staging-runtime.mjs` y `run-g4-local-staging-radar.mjs`: adaptadores server-only a Auth/SQL, arranque fail-closed cuando signup abierto, ref no autorizada o G3/G4 no instalados; requiere `QORE_G4_LOCAL_QA_ONLY=true`, secretos separados y LIVE false. **Por diseño no arrancará con el Supabase remoto actual porque faltan G3/G4**.
- `server/g4-expo-push-offers.mjs`: contratos de push privado al token consentido de conductor; «ticket aceptado para procesamiento» NO equivale a entrega/aceptación.
- `docs/backend/staging_only/G4_PUSH_OUTBOX_AT_MOST_ONCE_POSTGRES_CI_ONLY.sql`: outbox privada y claim exclusivo `FOR UPDATE SKIP LOCKED`, evita que dos workers reclamen la misma oferta; auditoría de ticket de procesamiento.
- `server/g4-private-push-outbox-worker.mjs`: worker de contrato **no ejecutado como daemon**, vuelve a validar permiso/estado/consentimiento, excluye oferta caducada y token ajeno. Es **at-most-once**: un fallo de worker puede perder aviso; no prometer fiabilidad comercial hasta introducir leases/reintentos/dead-letter/receipts.
- `src/domain/qore-radar-feed.ts`, `qore-radar-polling.ts`: estado versionado, evita replay y ETA falsa; pin de host API antes de enviar el JWT.
- `server/g4-vertical-radar-journey.test.mjs`, `g4-loopback-http-transport.test.mjs`: prueba completa **simulada** pasajero + dos conductores por HTTP local, oferta/push mock, un ganador, ficha y ETA de fixture; no son móviles reales.
- Restricción de moto en todos los contratos AUTO de G4, aun si una ficha llega mal clasificada.

**NO realizados:** índice geoespacial productivo de conductores en línea, tablas posiciones GPS/consentimiento e historial, proveedor de rutas vivo, FCM/APNs en teléfonos, Realtime privado, sesión backend HTTPS pública segura, fichas verificadas con foto/placa verdaderas, integración de G4 en vista Expo móvil o snapshot seguro del viaje remoto.

### 3.6 Lovable STAGING — UI, corrección fallida y alternativa HTML V3

- Existía pantalla React/TanStack de login con `supabase.auth.signInWithPassword`, `getUser` y lectura de datos propios `StagingRecords`.
- Se solicitó un botón `Diagnóstico de permisos de staging` que lea `profiles`, `user_roles`, solicitudes/vehículos **sin `.eq(owner)`** para que RLS limite filas por sí misma; identidad verificada antes/después, manejo de logout y cancelación, mensajes sanitizados.
- El agente Lovable implementó `src/lib/staging-diagnostic.ts`, `src/components/staging-diagnostic.tsx`, tests de `src/test/staging-diagnostic.test.ts`, commit `c5bd715b71cb1e5cd197d101f773af2aece4a393`.
- **INCIDENCIA BLOQUEANTE:** errores TypeScript en builder genérico `supabase.from(table).select(columns).order(...).range(...).abortSignal(...)` por uniones incompatibles; no se certificó build ni test. El pedido de corrección fue rechazado por **créditos Lovable agotados en ese momento**. Verificar disponibilidad actual; resolver TS tipando la consulta por tabla, no recurriendo a `any` indiscriminado, y ejecutar build/test ANTES de dar al usuario preview. `project.status=ready` no es demostración de que el último commit compila.
- Para no esperar, se creó un archivo **HTML standalone** de diagnóstico Auth/RLS y luego V2 con errores precisos. Primer FAIL `Auth/REST no disponible` mejoró al corregirse credenciales/conexión. V2 mostró PASS pero se detectó error de persistencia visual de resultado al cambiar selector; por ello no se adjudica V2 PASS a Conductor B.
- V3 añadió invalidez inmediata del resultado al cambiar cuenta/servidor, cierre de sesión y etiqueta explícita de cuenta autenticada y hora. La captura del usuario confirma **PASS V3 · Pasajero** conectado a Supabase directo.
- HTML V3 **no está integrado al repositorio/preview Lovable**; entregado en chat como archivo descargable. No tratarlo como APK.
- El usuario NO debe proporcionar passwords, bearer JWT ni service-role. Evitar incluir contraseñas en capturas; mostrar solo el cartel de resultado.

---

## 4. MATRIZ DE FUNCIONALIDADES — QUÉ FUNCIONA Y QUÉ NO

| Módulo / capacidad | Estado actual | Qué falta para considerar funcional |
|---|---|---|
| Shell Expo, pantallas demo y CI | **Código y tests PASS** | QA y UX real nativo |
| Autenticación Supabase nuevo | **Auth nativo cerrado, 3 usuarios confirmados** | Integrar UX estable de app y recuperación/control de sesión |
| Roles y permisos administrativos QA | **1 passenger / 2 driver, 0 admin, confirmados** | End-to-end de los tres roles con RLS y fixtures cruzados |
| Diagnóstico Android | **PASS V3 pasajero** | V3 driver A y B inequívocos, y CI/UX integrada |
| RLS perfiles y roles propios | **PASS pasajero visible desde Android; tests de CI** | Prueba real otros dos JWT |
| RLS vehículo/solicitud / Storage | **Tablas vacías, pruebas CI** | Dos owners con objetos sintéticos, acceso cruzado denegado y limpieza |
| Registro y aprobación de conductor/vehículo | **Esquema G1/G2 + contratos** | Formularios multiusuario completos, evidencia, revisión humana, vehículos de prueba |
| Localización de conductores ONLINE | **Algoritmo G4 en tests** | API consentida en móviles, GPS real, geospatial index, guard de frescura |
| Búsqueda/ranking QORE Radar | **Algoritmo puro probado** | Servicio vivo indexado + métricas de ETA/reparto |
| Solicitud de viaje | **Demo local + contrato G3 CI** | G3 remoto seguro, endpoint HTTPS, autorización, cancelación y persistencia |
| Oferta al conductor | **G4 SQL/HTTP sintético** | DB migrada, push token de dispositivo, workers ejecutados/observabilidad |
| Notificaciones reales | **Mock Expo y outbox at-most-once** | FCM/APNs, dev builds, receipts, leases/reintentos idempotentes |
| Aceptación exclusiva | **2 conductores SQL simultáneos CI PASS** | Prueba JWT real, 2 teléfonos distintos y DB staging |
| Tarjeta conductor/auto | **Contratos sanitizados** | Identidad/placa/modelo/foto verificados y políticas de visibilidad |
| Posición y ETA de aproximación | **Adaptadores y reglas anti-stale** | Google Routes pago/con cuotas, GPS conductor real, tracking privado, Realtime |
| Waze/Google Maps navegación | **Deep links / prototipo** | QA rutas nativas, manejo deeplinks/destino, navegación por sesión |
| Comisiones / FairPrice | **Laboratorio de hipótesis** | Tarifas reales, cotizaciones en vivo, impuestos/costos, pricing server-side |
| Cobros y pagos | **Diseño** | PSP local, efectivo/QR/tarjeta, conciliación, saldos, reembolsos, antifraude |
| Soporte, PIN, seguridad, SOS | **Conceptos** | Producto, integraciones oficiales, QA de emergencias y privacidad |
| Admin de operación | **Prototipo + G2** | Consola segura y auditoría de usuarios, seguros, viajes, pagos, incidentes |
| AUTO comercial | **Bloqueado deliberadamente** | Legal/seguro/soporte/PSP/métricas/QA, decisión explícita |
| MOTO comercial | **Bloqueado deliberadamente** | Estudio y aprobación independiente de normativa + seguros + ingeniería |
| Publicación Google Play / App Store | **No realizada** | Builds firmados, pruebas, políticas, cuentas, distribución y operación 24/7 |

**No informar «X % completado» como medición rigurosa:** hay pruebas y contratos sustanciales, pero el circuito principal aún no funciona en dispositivos. El progreso a 100 % se mide por gates de operación reales, no por número de tests.

---

## 5. PLAN DE TRABAJO RESTANTE — CAMINO CRÍTICO HASTA 100 %

### FASE A — QA REAL DE AUTH/RLS Y FRONTEND SIN ROMPER STAGING [PRIORIDAD INMEDIATA]

**A1. Corregir Lovable compilación.** Revisar `src/lib/staging-diagnostic.ts` y consultas tipadas de cuatro tablas, manejo de paginación sin filtros owner, logout/invalidez de resultados; ejecutar `npm run test`, `npm run build`, revisar lint y consola Chrome Android. No publicar. Si no hay créditos, usar el HTML V3 vigente para QA y mantener backlog compilación visible.

**A2. Obtener evidencia real V3 de 3 roles:** con teléfonos de prueba y sin compartir contraseñas: `PASS · Pasajero` YA RECIBIDO; **Conductor A y B PENDIENTES**. Verificar que cambiar selector limpia PASS anterior. Comprobar fecha/hora del resultado y titular Auth obtenido de servidor.

**A3. Comprobar permisos NO vacuos.** Crear en staging **solo datos totalmente sintéticos** bajo flujo administrativo autorizado (solicitudes de vehículos A y B, evidencias «SYNTHETIC», jamás cédulas/licencias reales), con precondiciones de propietario, y verificar por cada JWT: puede leer su fila, no la del otro, passenger cero vehículos de driver, anon sin documentos. Guardar reporte solo agregado, luego cleanup explícito del operador. Antes de mutar decidir mecanismo de fixtures y rollback seguro.

**A4. Completar STAGING storage.** Revisar MIME/folder private bucket `mobility-staging-driver-evidence`, ACL/RLS con tokens verdaderos, URL signed temporal, revocación, usuario ajeno denegado, no listar objetos públicos y limpieza. Ejecutar `staging-storage-readonly.mjs` solamente una vez creadas las fixtures autorizadas.

**Salida Fase A:** tres PASS verificables y una batería RLS no vacua (incluye Storage), sin exposiciones y con inventario/cleanup documentados.

### FASE B — G3/G4 EN SUPABASE STAGING AUTORIZADO [BLOQUEO ESTRUCTURAL]

**B1. Revisión migraciones.** Los SQL `G3_AUTO_DEMO_TRIP_CONTRACT_POSTGRES_CI_ONLY.sql`, `G4_PRIVATE_AUTO_OFFERS_POSTGRES_CI_ONLY.sql`, `G4_PUSH_OUTBOX_AT_MOST_ONCE_POSTGRES_CI_ONLY.sql` fueron escritos para PG CI con identidades falsificadas y datos de prueba. **NO EJECUTARLOS TAL CUAL EN REMOTO**. Crear migraciones versionadas revisadas, sin fixtures ni cambios colaterales; revisar search_path, grants, RLS, restricciones, índices, estado, funciones, locks y efecto sobre G1/G2.

**B2. Estrategia y rollback.** Plan SQL `BEGIN`, preflight del proyecto/usuario/schema/ref, snapshot y migración irreversible, permisos service_role, EXPLAIN y limpieza; registrar hash, dry run en DB clonada, aprobación responsable. Cambios remotos deben limitarse al nuevo Supabase y no habilitar datos productivos.

**B3. API HTTPS privado.** Desplegar únicamente en entorno STAGING respaldado, con Auth verificado, service role exclusivamente servidor, CORS explícito, rate limit distribuido, antiabuso/validación de petición, observabilidad sanitizada y política de secretos. El loopback `127.0.0.1` de G4 no es un servidor público, **no abrirlo a 0.0.0.0**.

**B4. Viajes de ensayo persistentes.** Solicitud autenticada de pasajero a DB, cotización ficticia claramente marcada, evento versionado, cancelación y auditoría. Aceptación 2 JWT simultáneos de conductores ya habilitados, con idempotencia y confirmación de pasajero server-only.

**Salida Fase B:** un pasajero solicita un **viaje ficticio** y solo uno de dos conductores lo acepta sobre la **misma DB staging** (no 2 mocks), y el pasajero recibe el cambio de estado.

### FASE C — GPS, ROUTING Y ETA VERDADEROS

**C1. Onboarding conductor AUTO.** Verificar edad/licencia/vehículo/foto, seguro, categoría y vigencias con proceso administrativo human-in-the-loop; mantener MOTO prohibida. El tipo `profiles` G1 mínimo carece de foto/nombre/score verificados: crear modelo de visualización separado y privado. Verificación sintética en ensayo, no presentarla como KYC real.

**C2. Ubicación y disponibilidad.** Implementar consentimiento explícito por dispositivo/propósito, GPS foreground y si se justifica background con permisos de plataforma, fechas/precisión, GPS stale y anti-fraude, tasa de actualización/batería, retención/expiración y supresión al terminar; almacenamiento y canal privado, nunca ubicación pública de todos los conductores.

**C3. Rutas por calle:** integrar Google Routes v2 (o alternativa evaluada) mediante API de servidor con clave restringida, cuotas/costos, Route Matrix para candidatos y ruta asignada para ETA real con tráfico; registrar latencia, jitter y error respecto al tiempo REAL. Si proveedor falla, **ocultar ETA**. Haversine es distancia recta y no sirve para los «minutos reales» que pide el propietario.

**C4. Realtime privado:** canal por viaje con autorización RLS/JWT de pasajero y driver asignado, orden de `serverRevision` + `trackingSequence`, re-suscripción tras reconexión y snapshot autoritativo; separar origen/ubicación precisa, data minimization, gestión de usuario suspendido/cancelación.

**Salida Fase C:** el pasajero en un segundo móvil ve conductor/vehículo verificados y **ruta/duración/distancia calculada por calles** que se actualizan realmente, y desparecen al caducar. Medir error ETA y consumo.

### FASE D — NOTIFICACIONES Y CONDUCTORES EN SEGUNDO PLANO

- `expo-notifications`, FCM Android, APNs iOS, development builds firmados, permisos push y registro token vinculado a Auth y dispositivo consentido.
- Ejecutar worker privado real con auditoría, TTL, push receipts, token inválido/revocación, deduplicación, backoff y cola con lease/reintentos. La versión actual at-most-once puede **perder** mensajes si falla un proceso; decidir semántica de entrega robusta.
- Apertura desde notificación lleva a consulta JWT propia; la notificación no expone placa de un conductor no aceptado ni datos de pasajero, no equivale a aceptación.
- Pruebas Android en primer plano, segundo plano, pantalla apagada, mala red; incluir iOS, ventanas breves, latencia máxima y comportamiento de ahorro de batería.

**Salida Fase D:** Conductor A y B reciben ofertas privadas reales en dispositivos separados. Solo uno gana, pasajero ve cambio sin refresco manual. Reclamos y tiempo de espera transparentes.

### FASE E — TRAYECTO, PAGOS, NEGOCIO, OPERACIONES Y SEGURIDAD

**E1. Ciclo completo:** llegar, PIN/encuentro, iniciar, en ruta, finalizar, cancelar, conductor no se presenta, pasajero no se presenta, disputas, rebotes/reintentos y soporte. Distinguir localización de recogida de seguimiento en viaje con consentimiento y políticas separadas.

**E2. Tarifa y comisiones reales:** investigación cuantificada por ciudad y hora de Bolt/Uber y oferta local; variables base/km/min, demanda, peajes, lluvia, espera, costos por auto/moto, cálculo del ingreso neto del conductor y equilibrio de la plataforma. Versionado, quote firmado server-side, expiración, geozonas, máximo/mínimo y simulación sin manipular precios desde el cliente. Estudiar cómo permitir menores comisiones sostenibles; 10 % DEMO no equivale a tarifa elegida.

**E3. Pagos/ledger:** efectivo y comisión por cobrar; integrar PSP local contratado para QR/tarjetas si aplica, PCI/tokenización externa, ledger doble entrada, idempotencia, payouts, conciliación, fraude, chargeback/reembolsos, facturación/tributación. No procesar ni guardar PAN.

**E4. Seguridad de usuarios:** denuncia, emergencia/ubicación compartida consentida, verificación PIN, contacto enmascarado, soporte 24/7 **solo si hay personal**, retención, eliminación, privacidad, modales accesibles y guaraní/español, sistema de apelaciones/suspensiones y auditoría de aprobaciones.

**E5. Administración:** panel producción protegido con gestión de conductores, expedientes/seguros, tarifas, viajes, incidencias, balances, configuraciones por ciudad, herramientas antiabuso, métricas y reportes de auditoría; ninguna operación admin concedida por frontend.

**E6. Operación y cumplimiento local:** asesoría legal en Paraguay y municipios habilitados, seguro de transporte remunerado, licencia/inspección/tasas, tratamiento de datos y condiciones de servicio, política de cancelación y daños, régimen tributario, contrato del conductor, cobertura emergencia. **AUTO necesita verificación real**; MOTO requiere diagnóstico legal y asegurador independiente y aprobación posterior.

**Salida Fase E:** flujo de viaje piloto AUTO end-to-end con tarifa transparente, soporte, seguridad y liquidación controlada **cuando esté permitido legalmente**. No habilitar MOTO por defecto.

### FASE F — CERTIFICACIÓN, LANZAMIENTO Y OPERACIÓN 100 %

- QA física mínimo 3 teléfonos con Android e iOS representados; builds de desarrollo y producción firmadas EAS, push background, GPS Android/iOS, red inestable, batería baja, permisos revocados, offline→online, duplicados, edad del GPS, rutas imposibles, spoofing y recuperación.
- Pruebas de concurrencia/estrés y seguridad: RLS no vacua, IDOR, JWT vencidos, usuarios suspendidos, SQL injection, CSP/CORS, secrets scan, rate limiting y webhooks PSP validados, gastos y cuotas Maps/Push.
- Datos, observabilidad y operaciones: backups/restauración, DR/runbooks, monitoreo uptime/error, colas, latencia despacho/ETA, SLA soporte e incidentes, métricas por ciudad y cohortes, presupuestos de API.
- Accesibilidad y UX: diseño visual distintivo probado con pilotos y conductores, español/guaraní, botones seguros al conducir, inclusión, baja conectividad, mapa intuitivo, formularios de emergencia.
- Distribución: Google Play Console, Apple Developer, identificadores, certificados, privacidad, textos/consentimientos de tiendas, restricciones background location, permisos push, revisión, políticas de datos.
- Piloto cerrado con usuarios reales **solo con aprobación consciente, seguros, legal, pagos y cobertura**; medir tiempo asignación, ETA predicha vs real, tasa entrega push, cancelaciones, ingresos netos del conductor, satisfacción, disponibilidad y economía unitaria.
- Lanzamiento gradual por zonas, feature flags, rollback, soporte y control permanente. «100 %» significa **criterios de aceptación y operación estable aprobados**, no «cero bugs para siempre».

---

## 6. BLOQUEOS / ERRORES ENCONTRADOS Y CÓMO SE RESUELVEN

| ID | Problema encontrado | Estado / acción obligatoria |
|---|---|---|
| P0-A | Auth nativo STAGING `disable_signup=false` a pesar de UI sin signup | **RESUELTO**: usuario activó Disable sign-up, verificado nativamente `true`. Vigilar regresión. |
| P0-B | `configure_auth` del agente podía sobrescribir HIBP u otras opciones | **NO se ejecutó**; usar ajuste aislado manual, HIBP sigue sin certificar. |
| P1-A | Antes no había identidades | **RESUELTO**: 3 cuentas ficticias confirmadas y 1+2 roles, 0 admin. |
| P1-B | Un trigger asignaba pasajero a TODOS, incluidos conductores | **RESUELTO**: dos roles corregidos mediante SQL transaccional y corroborados. |
| P1-C | JWT de conductores sin RLS E2E V3 documentada | **PENDIENTE**: capturas/resultados PASS A/B, validación no vacua y Storage. |
| P1-D | V2 del diagnóstico conservaba PASS anterior tras cambiar selector | **CORREGIDO EN HTML V3**; V2 conductor no es evidencia concluyente. |
| P1-E | Diagnóstico Lovable React nuevo falla build TypeScript | **ABIERTO P0 de experiencia de prueba**; refactor `staging-diagnostic.ts`, test/build. Créditos agotados en último intento. |
| P1-F | Lovable créditos volátiles | **ABIERTO según disponibilidad actual**; reintentar cuando existan, no afirmar resuelto sin comprobación. |
| P2-A | Tabla solicitudes/vehículos vacías producen falso verde por ausencia de terceros | **ABIERTO**: fixtures de dos propietarios/Storage, RLS cruzada, cleanup. |
| P2-B | G3/G4 solo CI, no en Supabase STAGING | **ABIERTO CRÍTICO**: migración auditada, no copiar fixture CI directamente. |
| P2-C | G3 viejo ofrecía aceptar sin oferta individual | **MITIGADO EN G4 CI** al revocar atajo; validar en remoto al migrar. |
| P2-D | Push enviado/ticket de Expo podía confundirse con entrega | **MITIGADO EN CONTRATOS**, receipts/dispositivos y política de reintentos aún faltan. |
| P2-E | 2 workers podían reclamar misma notificación | **RESUELTO EN SQL CI** con `SKIP LOCKED`; no desplegado. |
| P2-F | At-most-once pierde avisos en crash | **ABIERTO PARA PILOTO**: leases, reintentos/idempotencia/receipts y app polling alternativo. |
| P2-G | API HTTP loopback podría abrirse accidentalmente a red externa | **MITIGADO EN TESTS**: listener raw exige 127.0.0.1; producción requiere API HTTPS nueva. |
| P2-H | JWT podía enviarse a HTTPS alternativo configurable | **MITIGADO** con `pinnedApiOrigin` comprobado antes de fetch. |
| P2-I | GPS/ETA ficticio o ubicación de conductor sin asignar | **MITIGADO EN REGLAS/TESTS**, proveedores vivos no integrados. |
| P2-J | MOTO podía aparecer erróneamente en pantalla AUTO | **MITIGADO** por guardas AUTO-only; aprobación comercial MOTO aún abierta. |
| P3-A | Diferencia 10 % comisión DEMO vs 15 % viejo backend | **NO USAR VIEJO BACKEND**, investigar y decidir tarifa productiva independiente. |
| P3-B | Falta seguro/normativa municipal/PSP | **ABIERTO CRÍTICO PARA LIVE**. |
| P3-C | No hay builds Android/iOS nativos certificados | **ABIERTO**. |
| P3-D | PR #2 Flutter y PR #7 Expo misma raíz potencial conflicto | **AISLADO EN PR #7** 0 archivos solapados; nunca merge directo indiscriminado. |

---

## 7. PROPUESTA DE TECNOLOGÍA DISTINTIVA — NO SOLO CLON DE BOLT/UBER

No registrar como función existente algo todavía no implementado. Crear **experimentos medibles** para competir por experiencia y rentabilidad.

- **QORE Camino Claro:** mostrar ETA por carretera, intervalo de confianza/última ubicación, explicación de cambios de minutos, cancelación informada si ETA incierta. Benchmark error absoluto por zona/tráfico.
- **QORE FairMatch:** menor kilómetros de recogida improductivos y reparto de oportunidades entre conductores, con límites de equidad, demanda y calidad; medir neto por hora conectado/ocupado después de costos.
- **QORE Encuentro Inteligente:** detectar lado correcto de vía, punto seguro para frenar, accesibilidad, referencias verificadas sin exponer dirección de casa en push ni datos de terceros.
- **QORE Escudo:** verificación placa y foto en persona, código PIN de inicio, alertas de emergencia, operación humana real, privacidad y protocolos policiales/médicos.
- **QORE Confianza Radical:** diferencia explícita ESTIMADO/VERIFICADO/DESACTUALIZADO/DEMO; no animar un vehículo falso ni cronómetro que continúe sin GPS, cancelar cuando sea necesario.
- **Driver OS + Wallet honesta:** ofrecer distancia de recogida, precio a recibir, costos orientativos, resumen neto y liquidaciones transparentes; no sugerir ingresos garantizados.
- **Accesibilidad/español/guaraní y red débil**: implementar como ventaja operativa local.
- Mantener módulos independientes y antifraude; nunca basar permisos/autorización/seguridad en IA sin verificaciones auditables.
- Investigar productos rivales actualizados antes de afirmar «ninguna otra app lo tiene».

---

## 8. PRUEBAS, COMANDOS, ENTORNOS Y TRAZABILIDAD

Desde la rama PR #7, dentro de `apps/mobility-expo`:

```bash
npm install --no-audit --no-fund
npm run check
node --test server/*.test.mjs
node --test scripts/staging-auth-policy-gate.test.mjs
node --test scripts/staging-storage-readonly.test.mjs
node --test scripts/staging-three-actors-readonly.test.mjs
node --check server/run-g4-local-staging-radar.mjs
npx expo export --platform web
```

Para PostgreSQL G1-G4, usar el workflow de GitHub (PG16 efímero) `.github/workflows/mobility-ci.yml`; no ejecutar SQL CI-only en el backend remoto. Revisar nombres de rutas actuales en workflow si cambian.

**Variables que pueden requerirse para futuros tests privados**, sin publicar valores:
`QORE_MOBILITY_ENV=staging`, `LIVE_TRIPS_ENABLED=false`, `QORE_STAGING_PROJECT_REF=hylgkfgkcyrddokloljm`, clave pública STAGING y passwords/UUID esperados suministrados **solo a entorno seguro de QA**. Para las tres cuentas Gmail autorizadas el script exige `QORE_STAGING_APPROVED_GMAIL_QA=true` y tres expected Auth UUID. **No poner variables con passwords en el historial de comandos**, GitHub Actions plain logs, commits ni mensajes ChatGPT.

Para el gateway local G4: requiere Auth nativo cerrado, G3/G4 instalados, claves anon/service privadas y permiso explícito `QORE_G4_LOCAL_QA_ONLY=true`; escucha solo `127.0.0.1`. **Actualmente no se puede activar en staging** porque falta migrar G3/G4; no utilizarlo para producción.

**Documentación clave adicional**:
- `docs/backend/G4_QORE_RADAR_DISPATCH_REALTIME_ETA_2026-10-17.md`
- `docs/backend/G4_PRIVATE_OFFERS_ATOMIC_ACCEPTANCE_2026-10-17.md`
- `docs/backend/G4_AUTHENTICATED_RIDER_STATUS_VERTICAL_FLOW_2026-10-17.md`
- `docs/backend/G4_LOOPBACK_HTTP_AND_EXPO_POLLING_CONTRACT_2026-10-17.md`
- `docs/backend/G4_STAGING_RUNTIME_AUTH_GATES_2026-10-17.md`
- `docs/backend/G4_PRIVATE_PUSH_OUTBOX_ONE_SHOT_CI_2026-10-17.md`
- `docs/backend/STAGING_AUTH_CLOSED_THREE_ACTOR_FIXTURE_GATE_2026-10-18.md`
- `docs/security/G1_STORAGE_AUTH_E2E_READONLY_RUNBOOK_2026-10-17.md`
- Handoff acumulativo `docs/handoff/CONTINUIDAD_G0_G1_2026-10-16.md`
- Handoff histórico `docs/handoff/HANDOFF_MAESTRO_QORE_MOBILE_MOVILIDAD_2026-10-16.md`

---

## 9. CRITERIOS FINALES DE ACEPTACIÓN — «FUNCIONA 100 %»

El siguiente arquitecto debe usar checklists de **evidencia**. NO marcar aprobado por tests mock o por screenshots ambiguos.

- [ ] Tres usuarios autorizados, confirmados, sesión Auth revocable, roles correctos y RLS no vacua cruzada con objetos/documentos privados, recuperación de contraseña y fuga cero.
- [ ] Driver y vehículo verdaderamente verificados; licencias, seguro vigente, documentación/legal y control de suspensión.
- [ ] Pasajero puede solicitar una carrera en dos apps distintas; la solicitud se persiste en backend de staging/producción según gates.
- [ ] El servidor localiza candidatos ONLINE verdaderos con GPS opt-in preciso/fresco, sin exponer identidades antes de asignar.
- [ ] Conductores A y B reciben ofertas reales con Push o un polling confiable y control de expiración; primero que acepta obtiene el viaje de forma ATÓMICA, segundo denegado y auditado.
- [ ] Pasajero ve confirmación inmediata, foto/nombre/marca/modelo/color/chapa correctos y autorizados.
- [ ] Mapa muestra seguimiento del CONDUCTOR ASIGNADO con GPS real, distancia **por calle** y ETA tráfico medida/calibrada; recalcula minutos o informa estado desactualizado sin crear datos falsos.
- [ ] Cancelar, llegar, iniciar, finalizar, asistencia, calificar, recibo e historial funcionan entre dispositivos y tras reconexión.
- [ ] Precio/ingreso conductor/comisión explicables y versionados, conciliación/cobro efectivos y/o PSP según fase autorizada, auditoría de fraude y soporte.
- [ ] Realtime, Push, GPS/ubicación, permisos y batería probados en Android/iOS reales con app cerrada, permisos revocados, offline/reconexión, carreras concurrentes y picos de carga.
- [ ] Pruebas de seguridad IDOR, RLS, sesión, SQL/HTTP/pagos, backups, retención/privacidad, métricas, alertas, rollbacks y soporte de incidentes.
- [ ] Revisión legal/municipal/seguros/contratos/facturación y aprobación de piloto AUTO.
- [ ] Para MOTO, aprobación separada de regulación, seguro, seguridad y experiencia/conductores.
- [ ] Builds firmados, tiendas/requisitos, publicación y rollout gradual con control operativo.
- [ ] El propietario revisa y acepta una **demostración funcional** de pasajero + dos conductores, con GPS, rutas, ETA y notificaciones de verdad. Recién entonces declarar finalizado.

---

## 10. DECISIONES QUE REQUIEREN AL PROPIETARIO (NO INVENTAR NI BLOQUEAR TAREAS INOCUAS)

- Confirmar piloto AUTO por ciudad/geozona y luego MOTO, sujeto a asesoría legal y seguro; ninguna promesa comercial de moto sin revisión.
- Seleccionar proveedor de mapas/rutas y presupuesto mensual (Google Routes vs alternativa), PSP/QR local, política de efectivo, contrato de conductores y comisiones final basado en costos.
- Autorizar migración G3/G4 hacia STAGING tras plan técnico validado (NO aplicar fixtures CI crudas), creación de vehículos/documents sintéticos y su eliminación, soporte y privacidad.
- Contratar o designar revisión de conductor/KYC, soporte y operador de incidentes antes del piloto; no representar que existe un equipo 24/7 si no existe.
- Revisar qué subdominio, branding final, políticas y cuentas de Google Play/Apple utilizará QORE.
- Si Lovable sigue sin créditos, priorizar reparación del frontend en entorno alternativo **sin reusar backend antiguo**; nunca pedir passwords/tokens por chat.

---

## 11. PROMPT PARA INICIAR NUEVO CHAT (COPIAR SI SE DESEA)

> Actúa como ARQUITECTO PRINCIPAL e INGENIERO DE EJECUCIÓN de QORE Mobile — aplicación de movilidad paraguaya AUTO/MOTO. Lee primero el handoff maestro actual en el repositorio privado `mezas3238-hue/Qore-mobile-`, rama `feature/mobility-monorepo-isolated-20261016`, archivo `apps/mobility-expo/docs/handoff/HANDOFF_MAESTRO_QORE_MOBILE_100_POR_CIENTO_2026-10-18.md`, y la continuidad histórica `CONTINUIDAD_G0_G1_2026-10-16.md`. Mantén PR #7 DRAFT aislado de Flutter trading PR #2. Backend NUEVO de staging Lovable `9c677bb2-746b-419f-ad9c-dd6d26bab944` y Supabase ref `hylgkfgkcyrddokloljm`. NO tocar backend antiguo `qdqrlgzlotnfdxzpacxs`. Auth disable_signup=true verificado; 3 cuentas ficticias con 1 rol passenger y 2 driver, 0 admin. Android demostró PASS V3 del pasajero; faltan resultados inequívocos V3 de conductores y RLS cruzada NO vacua/Storage. GitHub PR #7 pasó CI con 207/207 tests y G1-G4 SQL efímero, pero G3/G4 NO están instalados en STAGING remoto. Lovable intentó añadir panel diagnóstico y falló TypeScript, después reportó créditos agotados; corrige eso al tener capacidad y CERTIFICA BUILD. Objetivo: avanzar hasta probar con 3 teléfonos REALMENTE conectados, GPS consentido, Google Routes por calles, ofertas Push y aceptación SQL atómica, ficha del conductor/auto y ETA actualizable. No hay viajes/pagos LIVE ni MOTO comercial. Trabaja con código, tests y evidencias verificables; documenta y actualiza PR #7 y handoff, prioriza integración real, no declares terminado lo no probado. No pidas contraseñas ni imprimas secretos. No pares innecesariamente por tareas técnicas normales; solicita aprobación solamente para cambios regulatorios, gastos, secretos/credenciales o migraciones remotas relevantes.

---

## 12. DECLARACIÓN FINAL DE ESTADO

**Sí está hecho:** estrategia e investigación inicial; prototipo Expo; reglas de dominio y tarifas DEMO; arquitectura aislada; Supabase staging Auth/RLS base; tres identidades y roles QA; Auth registro público cerrado; **PASS V3 pasajero**; CI 207/207; contratos G3/G4 de viaje, búsqueda, push, aceptación atómica, seguimiento/ETA y pruebas PostgreSQL concurrencia **en laboratorio**.

**No está hecho:** app multiusuario plenamente conectada; G3/G4 remotos; dos conductores V3 probados inequívocamente; RLS no vacua/Storage remotos; conductor/vehículo reales verificados; GPS y ETA por calle reales; notificaciones FCM/APNs y push receipts reales; Realtime privado; API HTTPS desplegada; precios definitivos, PSP/ledger, requisitos legales/seguros, soporte operativo y builds App Store/Play.

**Dictamen honesto:** hay una base técnica valiosa y comprobada, pero **QORE Mobile no funciona todavía al 100 %**. El cuello de botella real es pasar de **CI sintética + Auth STAGING básico** a **backend G3/G4 STAGING seguro + 3 dispositivos autenticados + geolocalización/rutas/Push REALES**, y luego cerrar pagos/legal/operaciones/tiendas. El siguiente arquitecto debe avanzar esos gates con evidencia y sin mezclar proyectos.

**FIN DEL HANDOFF MAESTRO — 18/10/2026**.
