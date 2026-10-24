# QORE MOBILE / MOVETE FÁCIL — HANDOFF MAESTRO INTEGRAL A+B, G0–G22

**Fecha de corte:** 22 de octubre de 2026 (Paraguay, America/Asuncion; registros GitHub de algunos eventos son del 23/10 UTC).  
**Destino:** siguiente arquitecto/chat que recibe el rol **Arquitecto A: Backend central + Movete Fácil Driver + integración**.  
**Repositorio soberano:** https://github.com/mezas3238-hue/Qore-mobile-  
**Rama A:** `feature/mobility-monorepo-isolated-20261016`  
**PR A:** https://github.com/mezas3238-hue/Qore-mobile-/pull/7 (**OPEN, DRAFT, SIN MERGE**)  
**HEAD A verificado ANTES de escribir este handoff:** `29885d1c2b3c4b8c831bb27e160df6d1f3d25a12`.  
**Rama B:** `feature/mobility-cliente-admin-parallel-20261022`  
**PR B:** https://github.com/mezas3238-hue/Qore-mobile-/pull/8 (**OPEN, DRAFT, SIN MERGE**).  
**HEAD B observado:** `79e52792d96bec6b41875b960f37a99a0e9aaa04`.  
**Bloqueo transversal:** https://github.com/mezas3238-hue/Qore-mobile-/issues/9 (**OPEN**).  
**Documento de propiedad de dos arquitectos:** [DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md](./DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md).  

> **ORDEN DEL OWNER:** terminar toda la infraestructura y conectar después las interfaces, sin pausas injustificadas y sin solaparse con el Arquitecto B. **NO MERGE; NO LIVE; NO VPS; NO despliegue; NO SQL remoto; NO push, pagos o identidades reales; NO reconfiguración de producción sin aprobación expresa.** Trabajar en PR DRAFT, staging/CI desechable y datos sintéticos. Esta transferencia NO declara la app comercial lista.

## 0. RESUMEN EJECUTIVO — QUÉ ESTÁ HECHO Y QUÉ NO

- Están creadas **dos aplicaciones móviles Expo INDEPENDIENTES**: `apps/movete-driver` (conductores y repartidores) y `apps/movete-cliente` (pasajeros y remitentes), con paquetes, esquemas y navegaciones separados. El panel de administración es **web independiente** en `apps/movete-admin`, creado por B en su rama. Un backend central compartido controla identidad, GPS, tarifas, despacho, viajes, envíos, comercios, seguridad, documentación y liquidación.
- El antiguo `apps/mobility-expo` conserva un **laboratorio mixto histórico** y las implementaciones Node/SQL/contratos de backend. **NO se debe publicar como una tercera aplicación final ni volver a mezclar pantallas Driver/Cliente.**
- A implementó y probó el historial G0–G20 en Node/PostgreSQL desechable, y últimamente la orquestación de UI Driver G21 + el adaptador opcional Auth G22. Las pantallas Inicio/Documentos/Ofertas consumen un estado de sesión compartido con borrado de datos tras logout/cambio de identidad. **La app se inicia sin Auth configurada** porque todavía no existe conexión STAGING autorizada; las ofertas siguen solo lectura y no se activan servicios reales.
- B avanzó de manera independiente en la app Cliente y en la estructura React/Vite de Admin Web, incluidos UI/QA de viajes, envíos, cotizaciones, historial, comercios, soporte, zonas, incidentes y panel Owner. **No es backend conectado ni finanzas reales.** El build y las pruebas propias de Admin NO estaban certificados en su CI al corte.
- **Verificación CI del HEAD A `29885d1c`: los cuatro workflows terminaron SUCCESS**:
  - PostgreSQL desechable #149: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39887977155
  - Contratos Node STAGING #306: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39887977273
  - Expo laboratorio #845: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39887977342
  - Dos apps aisladas #188: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39887977205
- Esos SUCCESS validan **fixtures sintéticos, contratos, TypeScript y exportación web**, NO APK/IPA, permisos y GPS reales, KYC documental real, depósitos/pagos, precios comerciales, pruebas legales ni producción.
- **No hacer merge de #8 en #7 ni rebase forzado automáticamente.** Las ramas avanzaron en paralelo. El siguiente arquitecto debe verificar sus HEAD y permisos antes de cualquier integración solicitada.

## 1. MODELO DE PRODUCTO Y DECISIONES INMUTABLES

### Aplicaciones, backend y separación

| Capa | Directorio | Usuario / función | Estado |
|---|---|---|---|
| Movete Fácil Driver, móvil Expo | `apps/movete-driver/**` | Conductor/repartidor: identidad Driver, KYC, vehículo, disponibilidad, ofertas, rutas, ganancias | Código y QA G16–G22; Auth y operaciones reales OFF |
| Movete Fácil Cliente, móvil Expo | `apps/movete-cliente/**` | Pasajero/remitente: viajes AUTO, envíos, comercios, estado, tarifa, pagos simulados | UI/contratos B en rama exclusiva; sin backend LIVE |
| Movete Fácil Admin, web React/Vite | `apps/movete-admin/**` | Operador KYC/zonas/incidentes; vista Owner FINANZAS con rol diferente | UI B; falta Auth/MFA real y CI propio de build |
| Backend central | Hoy `apps/mobility-expo/server/**` y `docs/backend/staging_only/**` | Auth/RLS, GPS, cotización, despacho, ofertas, estados, push, pagos simulados, seguridad, documentos | Contratos y PG desechable; extracción a servicios definitivos pendiente |
| Laboratorio Expo histórico | `apps/mobility-expo/app/**` | Harness mixto anterior | **No lanzar ni confundir con Driver o Cliente finales** |

IDs propios: Driver `com.movetefacil.driver` / `movetefacildriver`; Cliente `com.movetefacil.cliente` / `movetefacilcliente`. Son **dos binarios distintos**, incluso si usan backend y marca común. Admin Web NO es tercer móvil.

**Servicios funcionales previstos**: viajes en automóvil, servicio de moto para pasajeros **solo si** municipio/seguros/legalidad autorizan (por defecto CERRADO), envíos particulares y reparto comercial (restaurantes, supermercados, farmacias solo productos OTC permitidos y otros comercios). MOTO carga/reparto se autoriza independientemente de MOTO pasajeros. Cobertura geográfica ≠ conductor disponible. Activación gradual por zonas con políticas verificadas, no habilitación global ficticia.

## 2. PROPIEDAD EXCLUSIVA / TRABAJO EN PARALELO SIN PISARSE

**A, único responsable de:**
- `apps/movete-driver/**` (todas sus pantallas, código, Auth de Driver, estados, tests).
- `apps/mobility-expo/**` (backend histórico, SQL, gateways Node, integraciones, OpenAPI y harness).
- `backend/**`, `database/**`, `packages/**` si se crean (backend/contratos nuevos).
- `.github/**`, `scripts/**`, archivos raíz, `docs/architecture/**`, `docs/handoff/**`, CI global, auditoría y fronteras de acceso.
- Endpoints internos de Admin, tarifas, Auth, RLS, inventario, GPS, push y seguridad. **NO sus pantallas**.

**B, único responsable de:**
- `apps/movete-cliente/**`: UI y adaptadores del pasajero/remitente/comercios.
- `apps/movete-admin/**`: UI y adaptadores del panel WEB, dashboards y presentación.
- `docs/architect-b/**`: evidencias, bloqueos, reportes, solicitudes de contratos.

**Prohibido A:** modificar o crear archivos en `apps/movete-cliente/**`, `apps/movete-admin/**` o `docs/architect-b/**`.  
**Prohibido B:** modificar Backend, Driver, SQL, OpenAPI global, workflows, carpetas raíz/arquitectura o archivos de A.  
B puede **leer** y solicitar cambios por issue. A puede leer el código de B, pero publica contratos en su área y deja su adaptación visual a B.

**Protecciones existentes:**
- `scripts/check-mobile-boundaries.mjs`: impide imports cruzados entre dos binarios, paquetes duplicados y atajos LIVE.
- `.github/workflows/movete-apps-isolation.yml`: test + export web independiente de Driver y Cliente.
- `.github/workflows/movete-architect-b-boundary.yml`: PR que apunta a A, compara rutas y rechaza archivos fuera del territorio B.
- PR B #8 tiene **69 archivos cambiados de Cliente/Admin/docs B** al corte; sus HEAD divergen porque ambas ramas evolucionan. Revisar diferencias antes de cualquier acción de integración. PR A #7 permanece aparte.

## 3. HISTORIAL COMPLETO DE INFRAESTRUCTURA BASE — G0 A G15

**G0 — aislamiento de productos.** Monorepo de movilidad separado físicamente del stack trading. ADR `docs/adr/0010-two-product-isolation.md`. Nunca mezclar Supabase/MT5/Gateway del trading, secretos ni despliegues con Movete Fácil.

**G1 — Supabase/Postgres y Auth.** Migraciones aisladas para identidades/roles, grants y RLS, privacidad, revisiones de archivos, bucket privado de evidencias de conductor y protección contra SQL abierto. Restricción de signup; el scaffold CI crea identidades sintéticas y roles `anon`/`authenticated`/`service_role`. G1 asigna rol pasajero inicial, por eso G18 introduce conversión controlada a Driver. La existencia de SQL no prueba despliegue remoto.

**G2 — AUTO/MOTO, conductor, vehículo y documentos.** Alta y revisión de solicitudes, licencias, seguros, inspección, habilitación municipal, vencimientos, clases de vehículo, preflight de autorización en el servidor. MOTO pasajeros sigue fail-closed; MOTO carga tiene reglas propias.

**G3 — viaje AUTO demo persistido.** Solicitud idempotente, registro de viaje y transiciones, actor de sesión, snapshots autorizados, reconciliación de estado y pruebas de carrera entre dos aceptantes con PostgreSQL sintético.

**G4 — QORE Radar despacho.** Geolocalización consentida y con antigüedad limitada, zonas, rutas inyectadas, ofertas privadas dirigidas al conductor AUTO, expiración, aceptación atómica primer ganador, rechazo y transiciones de viaje. Outbox push de una sola emisión con deduplicación de servidor. Nunca confundir proveedor push ACK con entrega al dispositivo.

**G5 — envíos con custodia real en PostgreSQL de CI.** AUTO/MOTO carga; peso/dimensiones, artículo permitido, solicitud y clave idempotente, estado pedido/recogido/entregado, prueba de entrega, RLS por actor, verificación de courier/vehículo.

**G6 — catálogo/pedidos comerciales.** Comercios/sucursales, stock/catálogo, órdenes, preparación, enlace a entregas y actor autorizado. OTC en farmacia: no recetados/controlados sin proceso legal.

**G7 — motor de tarifas y finanzas SIMULADAS.** Versiones de reglas por zona/servicio, guaraníes enteros, tarifa base/distancia/tiempo/mínimo, cotización inmutable y comisión en bps; ruta y tráfico de adaptador validado, no del móvil. ``SIMULATED_CASH`` / ``SIMULATED_CARD``; autorizar, capturar, cancelar y reembolsar en ledger sintético privado; **sin PSP, tarjetas, cobro bancario, facturación ni liquidaciones reales**. Tarifas/porcentajes comerciales exactos no aprobados.

**G8 — seguridad operativa.** Incidentes/SOS como contratos, roles, suspensiones, auditoría, estados de revisión y acceso mínimo. No hay respuesta de emergencia real conectada.

**G9 — administración de comercios.** Alta/verificación, sucursales, catálogo y permisos; panel B consume solo APIs que A certifique.

**G10 — ofertas privadas de envíos.** Asignación exclusiva de courier con ventana TTL, aceptación/rechazo atómicos, idempotencia, seguridad contra actor distinto y cadena G5 de custodia.

**G11 — OpenAPI soberano STAGING.** `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json`, OpenAPI 3.1, `info.version=1.0.0-g11`; 39 paths observados al corte, operaciones rol-específicas. En ningún caso 39 rutas = 39 endpoints publicados: son contratos para simulación/integración.

**G12 — delivery push claim/ACK.** Outbox privado, `FOR UPDATE SKIP LOCKED`, worker claim/ACK propietario, proveedor ticket, limpieza de ofertas vencidas sin atribuir ACK al teléfono. Pruebas de dos sesiones independientes PG y G12 E2E en esquema auténtico.

**G13 — fencing/lease de push.** Protege reclamos desfasados y workers rivales; evita reenvíos con resultado ambiguo sin contrato verificable de idempotencia con proveedor. No declarar push exactly-once ni presencia en dispositivo.

**G14 — carrera de dos couriers.** Harness Python+PostgreSQL sobre esquema real: dos couriers compiten por un mismo envío y se debe garantizar un único aceptante; escenarios de repetición/expiración.

**G15 — consulta courier privada.** Pull de ofertas DELIVERY del actor Driver verificado aunque falle push, TTL y control de roles; sin exposición de ofertas de otros repartidores.

**Archivos SQL/Gates (ruta base):** `apps/mobility-expo/docs/backend/staging_only/`; `G0_DISPOSABLE_AUTH_SCAFFOLD_POSTGRES_CI_ONLY.sql`, `G1_ISOLATED_SUPABASE_BASELINE_DO_NOT_APPLY_PRODUCTION.sql`, `G2_AUTO_MOTO_COMPLIANCE_DO_NOT_APPLY_PRODUCTION.sql`, `G2_SERVER_PREFLIGHT_DO_NOT_APPLY_PRODUCTION.sql`, `G3_AUTO_DEMO_TRIP_CONTRACT_POSTGRES_CI_ONLY.sql`, `G4_PRIVATE_AUTO_OFFERS_POSTGRES_CI_ONLY.sql`, `G5_DELIVERY_CUSTODY_POSTGRES_CI_ONLY.sql`, `G6_MERCHANT_ORDERS_POSTGRES_CI_ONLY.sql`, `G7_FARES_SIMULATED_PAYMENTS_POSTGRES_CI_ONLY.sql`, `G8_SAFETY_OPERATIONS_POSTGRES_CI_ONLY.sql`, `G9_MERCHANT_MANAGEMENT_POSTGRES_CI_ONLY.sql`, `G10_PRIVATE_DELIVERY_OFFERS_POSTGRES_CI_ONLY.sql`, ``G12``, ``G13``, ``G15``. **No aplicarlos como bloque directamente en Supabase remoto**; las cadenas de CI tienen prerequisitos, fixtures y roles específicos.

## 4. ARQUITECTO A — BLOQUES RECIENTES G16–G22 (DETALLE)

### G16: AUTO + DELIVERY en la bandeja privada Driver
- SQL `G16_DRIVER_PRIVATE_AUTO_POLL_POSTGRES_CI_ONLY.sql`: consulta privada de ofertas AUTO destinadas al conductor, sin confiar en push, con expiración vigente, rol único Driver y acceso service_role solamente.
- Gateway `server/g16-driver-private-inbox-gateway.mjs` + repositorio `server/g16-driver-private-inbox-repository.mjs`; combina G16 AUTO y G15 courier. Endpoint `GET /v1/staging/driver/inbox`, JWT confirmado, rol servidor y rate limit.
- Respuesta mínima contiene `kind='AUTO_RIDE'|'DELIVERY'`, `offerId`, `serviceId` y `expiresAtMs`; no nombres, documentos, teléfonos, coordenadas privadas ni ACK ficticio.
- Driver `src/domain/driver-inbox.mjs`, `driver-inbox-session.mjs`, `driver-offer-decision.mjs`, tipos y tests. Aceptar/rechazar usan `requestKey` UUID estable, pero **la UI de ofertas todavía no habilita botones operativos**.
- CI PG/Node/HTTP localhost cubre actor ajeno, expiración, 401/403, fallo de RPC, logout y ACK que no prueba entrega.

### G17: documentación privada + auditoría administrativa
- SQL `G17_PRIVATE_DRIVER_DOCUMENTS_POSTGRES_CI_ONLY.sql` y `...ASSERT...`: registro de **referencias** a objetos privados (no bytes), tipo/tamaño/hash SHA-256, estado `pending/approved/rejected`, revisión auditada append-only, una decisión por evidencia y claves idempotentes.
- Registro service-role exige Driver exclusivo; revisión exige Admin exclusivo, prohíbe autorrevisión; lectura de estado saneada, sin rutas/bytes/hash/identidad revisora.
- Gateway/repositorio `server/g17-driver-document-*`, endpoints `GET /v1/staging/driver/documents`, `POST /v1/staging/driver/documents/observe`, `POST /v1/staging/admin/driver-documents/review`.
- Se endureció UPDATE a columnas de revisión únicamente; no alterar propietario/huella/objeto. Actualmente el bucket G1 autoriza **solo licencias**, y G17 rechaza otras categorías hasta migración auditada. Registrar archivo ≠ aprobarlo; aprobar licencia ≠ habilitar conductor.
- **Sin proveedor/verificador real, `observe` falla cerrado**, no hay subida documental real.

### G18: enrolamiento exclusivo Driver
- SQL `G18_DRIVER_ROLE_ENROLLMENT_POSTGRES_CI_ONLY.sql`: conversión explícita y auditada de un único rol `passenger` inicial a único `driver`, solo consentimiento verdadero + identidad verificada, y sin historial previo de viajes/envíos de pasajero.
- Control transaccional, serialización por actor, idempotencia y auditoría `pending_compliance`. Bloquea dual rol y conversión de Admin; no crea licencias/vehículos ni aprueba elegibilidad.
- `POST /v1/staging/driver/enrollment`, gateway/repo en `server/g18-driver-enrollment-*`, cliente Driver `src/domain/driver-enrollment.mjs` y tests.

### G19: observación privada de Storage, condicionado a escáner REAL
- `server/g19-private-driver-evidence-observer.mjs` implementa contracto de 3 adaptadores independientes del servidor: `getObjectMetadata`, `downloadObject` (versión fijada) y `scanBytes` (motor real).
- Requiere bucket privado correcto, dueño JWT, object ID, versión que cambia en overwrite, tamaño ≤5 MiB, JPEG/PNG, descarga real, SHA-256 calculado en servidor, resultado de malware `clean` ligado al hash y segunda comprobación de metadatos para detectar sustitución.
- Tests sintéticos con scanner de doble `TEST_ONLY_SCANNER`, no puede usarse en STAGING real. No se ha provisto Storage con versionado ni antimalware real.
- `g4-staging-runtime.mjs` solo admite `privateEvidenceAdapters` inyectados; valor por defecto null → denegado. No habilitar sin verificación de objeto y scanner independiente.

### G20: licencia más reciente aplicada al preflight y a la aceptación
- `G20_DRIVER_KYC_PREFLIGHT_FENCING_POSTGRES_CI_ONLY.sql` agrega helper `mobility_stage_driver_current_license_approved(driver_id)` (service-role) y conserva más controles originales de G2/G5.
- La licencia **más reciente** debe estar aprobada y auditada por Admin exclusivo; una anterior no sustituye una última pendiente/rechazada. Es un control adicional en `mobility_vehicle_preflight` y `mobility_stage_delivery_courier_preflight`.
- G4/G10 vuelven a comprobar preflight **en oferta y en aceptación**: una licencia que vence o es reemplazada por evidencia pendiente impide aceptar incluso una oferta antes emitida. Mantener comprobación de fecha G2, permisos zona, seguros, consentimientos, cupos y MOTO pasajeros apagado.
- CI `G20_DRIVER_KYC_PREFLIGHT_ASSERT_POSTGRES_CI_ONLY.sql`: aprobación/rechazo, nueva pendiente, caducidad licencia G2, competencia/aceptación AUTO/MOTO carga.
- Endpoint solo lectura `GET /v1/staging/driver/license-readiness` con `currentLicenseApproved` booleano y `driverEligible=false` siempre en QA. Repositorio y gateway `server/g20-driver-kyc-readiness-*`; cliente Driver `src/domain/driver-license-readiness.mjs`.

### G21: interfaz Driver alimentada por sesión única, pero SIN Auth real
- `apps/movete-driver/src/domain/driver-workspace.mjs`: orquesta **en una misma lectura** ofertas, documentos y licencia. Devuelve fases `not-configured`, `signed-out`, `loading`, `connected`, `offline` o `authorization-required`; no tokens ni actor en UI pública. En logout/cambio de cuenta/401/403/fallo de red borra toda la vista privada; rechaza respuestas tardías y ofertas vencidas.
- `src/DriverWorkspaceProvider.tsx` integra estado con React; `app/_layout.tsx` crea proveedor común.
- `app/index.tsx` muestra estado de conexión y licencia revisada; interruptor de disponibilidad continúa SIMULACIÓN LOCAL sin GPS real.
- `app/documentos.tsx` muestra la lista saneada solo si conectado; formulario nombre/chapa es borrador local. No sube documentos.
- `app/ofertas.tsx` muestra ofertas AUTO/DELIVERY solo si conectado y con cuenta regresiva de TTL; **no hay botón de aceptar LIVE**.
- ``driver-workspace.test.mjs`` valida cambios de cuenta, logout, revocación, fallos y estado no contaminado.

### G22: adaptador Auth opcional (no instalado en el composition root)
- `apps/movete-driver/src/domain/driver-staging-auth.mjs`, `.d.mts` y tests: interfaz para SDK Auth público inyectado. Consulta `getSession()`, `getUser(bearer)` en servidor Auth, misma identidad, cuenta confirmada, expiración ≥30s y verifica rol Driver de forma indirecta con `GET /v1/staging/driver/license-readiness`.
- `onAuthStateChange` emite solo aviso de cambio; G21 invalida snapshots y vuelve a leer. `driver-staging-auth-workspace.test.mjs` ensaya el flujo unido con datos sintéticos y carreras de sesión.
- La app **NO contiene SDK ni credenciales configuradas**: `DriverWorkspaceProvider` se monta con `authAdapter=null` y `apiOrigin=null` → `not-configured`. **Una compilación web exitosa no es login funcionando.**
- Los adaptadores QA actuales solo permiten `http://127.0.0.1:puerto`. En un teléfono físico, 127.0.0.1 es el teléfono y NO el PC/gateway. Diseñar posteriormente STAGING HTTPS con certificados, token storage adecuado y autorización Owner; **no quitar el pinning por atajo inseguro**.
- CI de G21/G22: Node tests del Driver + TypeScript/exportación Expo independiente; no E2E con Auth genuina ni APK/IPA.

## 5. ARQUITECTO B — ESTADO REAL EN SU PR #8 (NO REIMPLEMENTAR)

El Arquitecto B ya creó y avanzó `apps/movete-admin/**`, y amplió `apps/movete-cliente/**`. En su rama, al último examen, PR #8 tiene 69 archivos modificados exclusivos en Cliente, Admin y `docs/architect-b/**`, y HEAD `79e52792`.

**Cliente:** controlador de sesión pasajero efímera (fail-closed), mutaciones idempotentes con exclusión de doble toque, borradores de viaje AUTO y envíos, visualización condicionada de cotizaciones Gs, tracking por revisiones monotónicas/frescura GPS, historial propio paginado, formularios/comercios/carrito sintético, soporte, pantallas Cuenta/Cotización/Viajes/Envíos/Seguimiento/Comercios/Pagos. `ClientRuntime` común, pero **sin datos/backend/auth real**.

**Admin Web:** proyecto Vite/React autónomo con `AdminRuntime`, UI de cola KYC segura (datos de entrenamiento o metadatos mínimos), sesión Admin con MFA propuesta, zonas, incidentes y auditoría de presentación. Nueva vista **Owner FINANZAS** con roles `owner` y `admin` distintos (Owner no obtiene KYC por defecto), tarjetas de bruto, comisión, payouts, reembolsos, costos/neto en guaraníes; se muestra “—” sin ledger verificado. Nada monetario opera en LIVE.

**ADVERTENCIA PRIORITARIA:** Los workflows A actuales **NO ejecutan `cd apps/movete-admin && npm run check && npm run build`**. Los checks de aislamiento de Cliente/Driver y frontera PR B no certifican Admin. Añadir un job A de CI específico de Admin en `.github/workflows/**` sin modificar un solo archivo fuente del Arquitecto B.

**Documentos B para consultar, no editar:**
- `docs/architect-b/STATUS_Y_CONTRATOS.md` (bitácora B01–B13 + sesiones de avance)
- `docs/architect-b/QA_INTEGRACION_FRONTENDS_2026-10-22.md`
- `docs/architect-b/OWNER_DASHBOARD_FINANCE_RBAC_2026-10-22.md`
- `docs/architect-b/ADMIN_ZONAS_INCIDENTES_SEGURIDAD_2026-10-22.md`
- `docs/architect-b/INICIO_ARQUITECTO_B_CLIENTE_ADMIN_2026-10-22.md`

**Issue #9** sigue abierto: https://github.com/mezas3238-hue/Qore-mobile-/issues/9. A debe resolver CONTRATOS y APIs, no tocar la UI B.

## 6. ENDPOINTS STAGING EXISTENTES — CATÁLOGO, NO DESPLIEGUE

Fuente de verdad: `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json`. Version `1.0.0-g11` (el sufijo es histórico aunque se hayan agregado rutas posteriores). En el corte aparecen 39 paths con bearer; no exponer al cliente APIs de service_role ni inferir que son accesibles desde internet.

**Driver/identidad:**
- `POST /v1/staging/driver/enrollment`.
- `GET /v1/staging/driver/documents` y `POST /v1/staging/driver/documents/observe`.
- `GET /v1/staging/driver/license-readiness`.
- `GET /v1/staging/driver/inbox`.
- `GET /v1/staging/driver/offers/{offerId}`; `POST /v1/staging/driver/offers/accept` y `decline`.
- `GET /v1/staging/courier/delivery-offers`; detalle/`accept`/`decline` privados.
- `POST /v1/staging/trips/{tripId}/transition` y `POST /v1/staging/deliveries/{deliveryId}/transition`.

**Cliente/comercios/finanzas simuladas:**
- `POST /v1/staging/rider/trips/request`, `GET /v1/staging/rider/trips/{tripId}/status`.
- `POST /v1/staging/sender/deliveries/request`, `GET /v1/staging/deliveries/{deliveryId}/status`.
- `POST /v1/staging/fares/quote`.
- `POST /v1/staging/buyer/orders/request`, ``/v1/staging/orders/{orderId}/status``; operaciones merchant de catálogo/sucursal/preparación.
- `POST /v1/staging/payments/authorize`, ``/v1/staging/payments/{paymentId}/transition`` y ``/status`` (SOLO simulados).

**Admin:**
- `POST /v1/staging/admin/vehicle-reviews` y `POST /v1/staging/admin/materialize-pending`.
- `POST /v1/staging/admin/driver-documents/review`.
- Incidentes/suspensiones, alta/revisión de comercio y mutaciones servidor.
- **No hay endpoint Owner-finance certificado ni servicio de sesión Admin/MFA probado desde navegador.** No confundir propuesta de B en issue #9 con implementación.

## 7. GATES DE CI, COMANDOS Y PRUEBAS EXACTAS

**HEAD A último comprobado antes del documento:** `29885d1c2b3c4b8c831bb27e160df6d1f3d25a12`. Ejecutados y **SUCCESS** (no inferir mismo estado de un SHA posterior sin verificar):

| Workflow | Nº | Actions run ID | Cobertura |
|---|---:|---:|---|
| QORE G4 PostgreSQL disposable smoke | 149 | 39887977155 | Fixture claim + cadena real G1/G2/G3/G4/G5/G10/G12/G13/G15/G16/G17/G18/G20 |
| QORE Mobility STAGING Node contracts | 306 | 39887977273 | Tests Node ESM de gateways, Auth, KYC, dispatcher y mocks |
| QORE Mobility Expo isolated CI | 845 | 39887977342 | TS, dominio, servidor, seguridad NO LIVE, export web laboratorio y PG G1–G10 |
| Movete Facil two app isolation | 188 | 39887977205 | Frontera entre Driver/Cliente, TypeScript, tests y export web por app |

**Archivos de workflows:**
- `.github/workflows/mobility-g4-postgres-disposable.yml`.
- `.github/workflows/mobility-staging-node-contracts.yml`.
- `.github/workflows/mobility-ci.yml`.
- `.github/workflows/movete-apps-isolation.yml`.
- `.github/workflows/movete-architect-b-boundary.yml`.

**Comandos de reproducción local** (Node >=22, sin claves privadas ni despliegues):

```bash
# En el clone del repositorio y en la rama A
git fetch origin
git checkout feature/mobility-monorepo-isolated-20261016
git rev-parse HEAD

cd apps/movete-driver
npm install --no-audit --no-fund --ignore-scripts
npm run check
npx expo export --platform web
cd ../..

cd apps/mobility-expo
npm install --no-audit --no-fund
npm run check
(cd server && node --test *.test.mjs)
node scripts/check-safety.mjs
cd ../..

node scripts/check-mobile-boundaries.mjs

# Solo PostgreSQL 16 DESECHABLE, jamás supabase remoto:
# reproducir secuencia G0→G20 usando workflow de PostgreSQL,
# PGDATABASE=qore_disposable_chain
# PGAPPNAME=qore_ci_disposable_chain
```

**Admin B (solo A configura CI sin editar fuentes B):**
```bash
cd apps/movete-admin
npm install --no-audit --no-fund --ignore-scripts
npm run check
npm run build
```
B debe revisar cualquier fallo de SU código en su rama; A solo puede publicar el job en `.github/**`. Ejecutar desde la rama que contenga los archivos B; la rama A aún no los tiene.

**Gates de seguridad:** JWT real confirmado + roles desde servidor, RLS, no PII cruzada, requestKeys estables, dos sesiones competidoras, cancelación, TTL, Auth revoked, estados monotónicos, rate limit, test de un único aceptante, pruebas contra SQL real. La exportación web de Expo NO es build nativa.

## 8. PROBLEMAS, RIESGOS Y BLOQUEOS VIGENTES (NO DISFRAZARLOS)

| ID | Problema | Severidad | Decisión o remediación |
|---|---|---|---|
| P0-01 | No hay **Auth real instalado** en nueva app Driver/Cliente; G22 es adaptador inyectable no conectado | Bloqueador | Definir STAGING autorizado, cuentas sintéticas, SDK público, almacenamiento seguro de sesión, logout/revocación, test multiusuario. No service_role móvil |
| P0-02 | Gateways QA aceptan **solo 127.0.0.1** y no son API HTTPS para teléfono físico | Bloqueador | Diseñar STAGING TLS separado, auth servidor, configuración por ambiente revisada. No abrir a 0.0.0.0 indiscriminadamente |
| P0-03 | **G19** requiere Storage con revisión inmutable + observador real + escáner malware decodificador | Bloqueador KYC | No permitir uploads de documentos reales hasta validación/retención/privacidad; actualmente registra solo licencia si el scanner existe |
| P0-04 | G17 bucket solo admite **licencia**; demás clases necesitan normas/políticas privadas | Alto | Extender con migraciones revisadas y scan/ACL por clase, sin ampliar permisos por defecto |
| P0-05 | Aprobación documental ≠ autorización de vehículo; permisos por municipio/seguros pendientes de aceptación legal | Bloqueador LIVE | Pruebas formales por tipo/zona, seguros y caducidad; MOTO pasajeros sigue OFF |
| P0-06 | **Admin Web no se compila ni prueba en su propio job CI** (solo ownership/mobile) | Alto | A añade workflow aislado para Admin, B corrige cualquier error de su código y documenta SHA/CI |
| P0-07 | **Issue #9**: faltan APIs/DTOs completos para Auth Passenger/Admin+MFA, historial, cancelación, tarifas, comercio, KYC, Owner-finance | Bloqueador integración | A acuerda contratos tipados y pruebas con B; no duplicar backend en B |
| P0-08 | PR #8 tiene avances importantes **divergidos** de PR #7 | Integración | Mantener ramas, revisar base/HEAD/diffs; no cherry-pick/merge/rebase automático sin Owner |
| P1-09 | GPS/ETA y navegación son contrato con rutas inyectadas; no existe evidencia E2E en equipos físicos | Alto | Validar consentimiento, permisos iOS/Android, drift, desconexión, revocación, cuotas y licencias de Maps |
| P1-10 | Push ACK proveedor no prueba entrega en teléfono, y resultado ambiguo no autoriza reenvío indiscriminado | Alto | Reconciliación privada G12/G13/G15/G16, callback/receipt de dispositivo verificable y dedupe de proveedor |
| P1-11 | Algunas migraciones solo funcionan en CI y usan Auth sintético: no instaladas ni auditadas en un proyecto remoto | Bloqueador STAGING real | Runbook con backup, SQL review, grants/RLS, secuencia idempotente, plan rollback en entorno autorizado |
| P1-12 | Precios, comisiones, pagos, impuestos, seguro y ganancias **no tienen operación comercial aprobada** | Alto | Investigación/reglas Paraguay; cotizaciones con ruta verificada y ledger conciliado; simular pagos hasta PSP autorizado |
| P1-13 | No hay integración end-to-end real Cliente↔Backend↔Driver↔Admin para un viaje/envío | Bloqueador piloto | Construir tests multisesión y Android/iOS con fixtures, reportes, cancelación, reconexión y escenarios adversariales |
| P1-14 | Mercados/regulación: pasajeros moto, farmacias OTC, tratamiento de datos/seguridad y cobertura territorial | Alto | Revisión legal/documental específica por municipio y servicios, responsable administrativo y política de retención |
| P1-15 | No hay generación/firma/distribución de dos paquetes nativos listos de tiendas | Bloqueador lanzamiento | Certificación Android/iOS separada, iconos/permisos/store listings y seguridad después de QA y aprobación Owner |
| P2-16 | Lovable no implementado como UI definitiva | Pendiente posterior | Lovable solo UI; consumir contratos/backend ya auditados, sin entregar Auth/RLS/seguridad a Lovable |

## 9. ROADMAP PRIORITARIO PARA EL SIGUIENTE ARQUITECTO A

### P0 — PRIMERA CONTINUACIÓN (alta prioridad, sin pedir redefinir lo acordado)

1. **Refrescar el HEAD de PR #7 y CI**: comprobar ramas, SHA, workflow runs, issues #9 y que no haya merges. Leer este handoff, división A/B y G21/G22.
2. **Agregar CI aislado Admin WEB**, solo desde `.github/workflows/**` de A, activado por cambios `apps/movete-admin/**` en PR #8, con Node 22, `npm install --ignore-scripts`, `npm run check` y `npm run build`; no desplegar. Solicitar a B reparación de fuentes si falla.
3. **Resolver issue #9 por contrato**, priorizando Auth Passenger/Admin/Owner con MFA, roles exclusivos y DTO de APIs con 401/403/409/410/429/503. Publicar JSON schemas/respuestas mínimas y tests Node/SQL. No conceder a Owner acceso KYC por herencia.
4. **No activar Auth real sin STAGING autorizado**. Diseñar composición central de Driver/Cliente con SDK publicable, rol verificado en backend, revocación, cierre de sesión, almacenamiento seguro móvil y TLS en QA. Si no hay credenciales autorizadas, continuar con adaptadores inyectados/fail-closed y tests negativos.
5. **Integrar G21/G22 UI Driver por estados**, probar a nivel de componentes que se borran ofertas/KYC al expirar token y ante dos identidades; nunca dejar estado conectado falso. Mantener disponibilidad local de prueba OFF en backend.
6. **G19 Storage/escáner:** definir una implementación verificable de `getObjectMetadata`/`downloadObject`/`scanBytes` y contratos de versión/propietario sin secretos en app. No ejecutar cargas ni desactivar denegación por defecto sin aprobación y test E2E.

### P1 — BACKEND OPERATIVO COMPLETO PARA STAGING CERRADO

7. Completar autorizaciones API por actor, matrices RLS y acciones sobre KYC/vehículos, seguros/expiraciones y revisión de documentos con auditoría; evitar doble rol.
8. Definir disponibilidad real y GPS consentido en Driver: aprobación previa, zona, frescura, ubicación confiable, desactivar/offline, no enviar GPS sin consentimiento y no confundir cobertura/disponibilidad.
9. Unir cancelación, reasignación, rechazo/aceptación, estados de viaje y envíos con el backend transaccional; probar carreras con dos conductores y dos clientes, retiros y comprobantes privados.
10. Garantizar fallback privado de ofertas con G15/G16 y reconciliación de notificación con G12/G13, sin notificaciones reales fuera de sandbox autorizado.
11. Entregar a B DTOs verificados para status viaje/cancel/quote, versiones/TTL, catálogo/stock, pedidos, historial, soporte/seguridad, liquidación y panel KYC/zonas.
12. Construir endpoint **Owner-finance solo agregado y conciliado** detrás de rol Owner+MFA, 403 para Admin/Driver/Passenger y NO PII, según propuesta B en issue #9. Primero diseñar y probar, no declarar existente.
13. Simular flujo end-to-end completo de viaje AUTO, envío en moto carga, comercio, devolución/pago/reembolso Gs, suspensión/zonas, KYC; registrar trazas de autorización y accesos.
14. Probar permisos y consentimiento para ubicaciones, documentos y prueba de entrega; política de retención/rotación de secretos y auditoría.

### P2 — VALIDACIÓN Y PRE-LANZAMIENTO (requiere autorizaciones)

15. CI completo de tres interfaces (Driver Expo, Cliente Expo, Admin WEB) y cadena PostgreSQL en ambiente de pruebas controlado, sin exponer público.
16. E2E de múltiples usuarios sintéticos en dispositivos Android/iOS reales y navegadores; build nativa de las DOS apps por separado, rendimiento y recuperación offline.
17. Legalidad, protección de datos, seguros, categorías farmacéuticas, zonas de Paraguay, términos/privacidad, incidentes y soporte.
18. Tarifa real de AUTO/MOTO/envíos, comisión de la plataforma, impuestos/retenciones y políticas de cancelación basadas en investigación actual de competencia; Owner debe aprobar antes de tarifario LIVE.
19. PSP y facturación SOLO después de conciliación, KYC, controles antifraude y autorización comercial; hoy TODO SIMULADO.
20. Diseño definitivo con Lovable para interfaces aprobadas y pruebas de usabilidad, sin transferir autoridad de backend a Lovable.
21. Gate de lanzamiento por zona con controles de suministro de conductores, soporte, monitorización, rollbacks y autorización **expresa** del Owner. Nunca hacer deploy autónomamente.

## 10. MATRIZ DE PRUEBAS MÍNIMAS QUE DEBE CONSERVARSE

| Dominio | Casos de éxito/cierre obligado |
|---|---|
| Rol/seguridad | Passenger no acepta, Driver no ve otro Driver, Admin no factura Owner, Owner no revisa KYC; anon 401 y cross-role 403 |
| Auth | Token expirado/revocado, cambio de cuenta, logout en vuelo, dos refresh competidores, doble rol, cuenta anónima, pérdida de conexión |
| KYC/Storage | Archivo no existe, bucket público, dueño falso, MIME/magic/bytes/sha discordantes, malware, objeto sustituido, latest pending/rejected, auto-revisión |
| AUTO | Cotización pendiente, solicitud idempotente, búsqueda, doble conductor, TTL, licencia nueva pendiente durante oferta, aceptación exclusiva y cierre |
| Envíos | MOTO carga legal/capacidad, peso/dimensiones, artículo restringido, doble courier, retirada, prueba de entrega, cancelación |
| Comercios | Stock desactualizado, otro local, carrito manipulado, catálogo prohibido, doble pedido, cancelación y comisión transporte |
| Pagos | Solo simulado, precios en Gs enteros, captura tras cierre, reversión/refund con asientos equilibrados, actor ajeno, reintento |
| GPS/push | Consentimiento, ubicación obsoleta, zonas, ruta falsa, pérdida de red, push ambiguo, resync/receipts |
| Admin | MFA/rol único, consultas Owner solo agregadas, KYC auditable, incidentes/SOS semánticamente no operativos sin servicio, filtros PII |
| Binarios | No imports entre Cliente/Driver, IDs nativos distintos, pruebas/web export separados y build Admin independiente |

## 11. DOCUMENTOS, CÓDIGO Y CONTINUACIONES PARA LEER PRIMERO

**Arquitectura / división:**
- [División obligatoria A/B](./DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md)
- [Dos aplicaciones móviles, una API, Admin web](../architecture/MOVETE_TWO_MOBILE_APPS_2026-10-22.md)
- [ADR aislamiento trading/movilidad](../adr/0010-two-product-isolation.md)

**G16–G22 explicados:**
- [G16: inbox privado Driver](../architecture/G16_DRIVER_PRIVATE_INBOX_AND_SESSION_QA_2026-10-22.md)
- [G17–G18: KYC privado/alta Driver](../architecture/G17_G18_DRIVER_IDENTITY_AND_PRIVATE_KYC_2026-10-22.md)
- [G19: Storage versionado/escáner](../architecture/G19_PRIVATE_DRIVER_STORAGE_OBSERVATION_2026-10-22.md)
- [G20: latest KYC preflight](../architecture/G20_CURRENT_LICENSE_KYC_ACCEPTANCE_FENCE_2026-10-22.md)
- [G21/G22: UX de sesión y Auth inyectado](../architecture/G21_G22_DRIVER_SESSION_UI_AUTH_BRIDGE_2026-10-22.md)

**Infraestructura histórica:**
- `apps/mobility-expo/docs/handoff/HANDOFF_MAESTRO_CONTINUIDAD_G12_CI_VERDE_2026-10-22.md`
- `apps/mobility-expo/docs/handoff/HANDOFF_MAESTRO_INTEGRAL_TARIFAS_INFRAESTRUCTURA_2026-10-22.md`
- `apps/mobility-expo/docs/handoff/HANDOFF_MAESTRO_WORK_MOVETE_FACIL_INFRAESTRUCTURA_2026-10-22.md`
- `apps/mobility-expo/docs/backend/G5_PERSISTENT_DELIVERY_CUSTODY_2026-10-22.md`
- `apps/mobility-expo/docs/backend/G6_MERCHANT_CATALOG_ORDERS_2026-10-22.md`
- `apps/mobility-expo/docs/backend/G7_VERSIONED_FARES_SIMULATED_PAYMENTS_2026-10-22.md`
- `apps/mobility-expo/docs/backend/G8_SAFETY_OPERATIONS_2026-10-22.md` y `G9_MERCHANT_MANAGEMENT_2026-10-22.md`
- `apps/mobility-expo/docs/backend/G13_G15_FENCED_PUSH_AND_PRIVATE_POLL_STAGING_2026-10-22.md`.

**Puntos exactos de integración:**
- `apps/movete-driver/src/DriverWorkspaceProvider.tsx`
- `apps/movete-driver/src/domain/driver-workspace.mjs` + `driver-staging-auth.mjs` + test `driver-staging-auth-workspace.test.mjs`.
- `apps/movete-driver/app/_layout.tsx`, `app/index.tsx`, `app/documentos.tsx`, `app/ofertas.tsx`.
- `apps/mobility-expo/server/g4-staging-runtime.mjs` y `g4-loopback-http-transport.mjs`.
- `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json`.
- `apps/mobility-expo/docs/backend/staging_only/G20_DRIVER_KYC_PREFLIGHT_FENCING_POSTGRES_CI_ONLY.sql`.
- `docs/architect-b/STATUS_Y_CONTRATOS.md` EN RAMA B (solo lectura).
- [Issue de contratos A↔B #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).

## 12. INSTRUCCIÓN LITERAL PARA PEGAR EN EL SIGUIENTE CHAT

**«Actúa como Arquitecto A de QORE Mobile / Movete Fácil. Repositorio mezas3238-hue/Qore-mobile-, PR #7 DRAFT, rama feature/mobility-monorepo-isolated-20261016. Lee COMPLETO el handoff `docs/handoff/HANDOFF_MAESTRO_INTEGRAL_QORE_MOBILE_ARQUITECTO_A_G0_G22_2026-10-22.md` y la división A/B. Continúa desde G22 sin rehacer G0–G20: verifica GitHub y CI; añade primero la certificación Admin WEB en workflow de A; atiende contratos abiertos issue #9, Backend + Driver G21/G22, Auth segura y Storage/escáner con gates fail-closed. Arquitecto B es dueño exclusivo de apps/movete-cliente/**, apps/movete-admin/** y docs/architect-b/**. No modifiques sus archivos. Dos apps móviles distintas y Admin WEB separado. No merge, no LIVE, no despliegues ni SQL remoto sin orden expresa. Publica avances verificables (SHA, PR, CI, riesgos) sin detenerte salvo bloqueo real».**

## 13. ACTA DE CIERRE Y SIGNIFICADO DE «TERMINADO»

- El presente archivo es **transferencia de arquitectura, código, decisiones, fallos y plan de ejecución**. La transferencia puede estar cerrada aunque el producto todavía NO esté terminado.
- **No equiparar** CI verde a aplicación comercial: faltan credenciales STAGING reales autorizadas, Storage versionado, escáner real, APIs/DTO faltantes, build Admin CI, E2E nativo, aprobación legal/seguros por zona, política de tarifas/comisiones y lanzamiento.
- Los PR #7 y #8 continuarán DRAFT; ninguna acción de este handoff ordena fusionarlos.
- El siguiente arquitecto debe continuar **en el mismo repositorio y propiedad A**, actualizar este documento cuando haya evidencia de nuevas gates y documentar los contratos A↔B en el issue #9. **Respetar los límites de seguridad y el mandato del Owner.**
