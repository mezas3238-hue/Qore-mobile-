# QORE MOBILE / MOVETE FÁCIL — HANDOFF MAESTRO INTEGRAL DEL ARQUITECTO B
## CLIENTE MÓVIL + ADMIN WEB · HISTÓRICO COMPLETO, IMPLEMENTACIÓN, DEFECTOS, PENDIENTES Y CONTINUIDAD EJECUTABLE

**Corte de verificación:** viernes 23 de octubre de 2026 (consultado en GitHub en esta entrega).
**Destino:** siguiente arquitecto B en nuevo chat / ChatGPT Work.
**Repositorio soberano:** [mezas3238-hue/Qore-mobile-](https://github.com/mezas3238-hue/Qore-mobile-) — NO confundir con `qore-core` de trading.
**Rama B exclusiva:** `feature/mobility-cliente-admin-parallel-20261022`.
**PR B:** [#8 — Cliente + Admin WEB (DRAFT)](https://github.com/mezas3238-hue/Qore-mobile-/pull/8), base `feature/mobility-monorepo-isolated-20261016`.
**HEAD B verificado al preparar documento:** `692ffc888cf5279f23fd773f5312a07d0d91a3de`. **NO MERGED / NO LIVE**.
**Rama A exclusiva:** `feature/mobility-monorepo-isolated-20261016`.
**PR A:** [#7 — backend + Driver (DRAFT)](https://github.com/mezas3238-hue/Qore-mobile-/pull/7), base `main`.
**HEAD A observado:** `95986b58db110e4fbfd7d364c83ab61935f83c00`, distinto y en evolución. Nunca asumir que permanece fijo.
**Coordinación API y bloqueos:** [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).
**División obligatoria:** [Handoff de dos arquitectos, propiedad de rutas](https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/mobility-monorepo-isolated-20261016/docs/handoff/DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md).

> **ORDEN DEL OWNER: CONTINUAR SIN DETENERSE SALVO BLOQUEO REAL.** No pedir permiso para cada paso ordinario. Inspeccionar GitHub, implementar el siguiente cambio seguro dentro del ámbito B, ejecutar CI, reparar hasta verde, registrar SHA y seguir con otro paso independiente. Un contrato pendiente NO obliga a detener otros trabajos de UI, validadores o pruebas. No inventar respuestas, cobros, disponibilidad, autorizaciones ni afirmar LIVE.

> **LIMITACIÓN CRÍTICA:** Que una prueba unitaria, TypeScript, Expo export o Vite build esté en SUCCESS no certifica un servidor STAGING accesible, un APK/IPA instalable, RLS efectiva, dinero verdadero ni lanzamiento. Se trabajó con datos sintéticos, adaptadores desactivados y PR DRAFT.

---

# 0. DECISIONES DE PRODUCTO E INVARIANTES

1. Producto: **Movete Fácil**, movilidad y logística para Paraguay, escala por zonas. Competirá con Bolt/Uber en experiencia, seguridad y condiciones, sin declarar una ventaja no probada.
2. **DOS BINARIOS MÓVILES** y jamás mezclar roles: `apps/movete-cliente/**` (pasajero, remitente, comprador) y `apps/movete-driver/**` (conductor/repartidor, propiedad A). **ADMIN es sitio WEB INDEPENDIENTE**, `apps/movete-admin/**` (propiedad B), NO una tercera app móvil.
3. Servicios: viajes en AUTOMÓVIL; entregas particulares AUTO/MOTO y entregas comerciales (supermercado, restaurante, farmacia OTC permitida y otros). **Pasajeros en MOTO bloqueados** hasta autorización normativa y cobertura de seguros por municipio. Las zonas y la modalidad tienen habilitaciones distintas.
4. **Cobertura ≠ conductores disponibles**. No inferir ETA, aceptación, GPS, ingresos, cupos, saldos, permisos ni documentación de un resultado de UI o un mock.
5. Tarifas y comisiones **servidor-derivadas en guaraníes (Gs / PYG)**, diferenciando AUTO, MOTO entrega y modalidades comerciales. No inventar precios ni dar sizing/rules en el frontend.
6. **Ningún límite global de 50/100 registros.** Esos números son lotes de respuesta por página; pasajeros, conductores, pedidos, viajes y documentos podrán crecer según base de datos/infrastructura. Listas y navegación por cursores; capacidad backend aún necesita prueba de carga real.
7. Documentos de conductores deben almacenarse de forma central, privada y gobernada por A; el teléfono Driver solo captura/envía con Auth y permisos, el Admin WEB revisa metadata/objetos privados autorizados. Nada de PII real en QA.
8. Lovable se utilizará **solo para interfaz/experiencia** después de infraestructura y contratos certificados. Jamás responsable de SQL, Auth/RLS, pagos, despacho, tarifas ni secretos.
9. No MERGE, LIVE, despliegues/VPS, apps stores, SQL remoto, push verdadero, cobros PSP, documentos personales reales, modificaciones de cuentas financieras ni secrets en repo/bundle sin instrucción explícita del Owner.
10. Datos STAGING **sintéticos**. La existencia de un OpenAPI es un contrato versionado, no prueba de que el endpoint esté expuesto.

# 1. PROPIEDAD ABSOLUTA Y SIN PISARSE

**Arquitecto B — único editor:**
- `apps/movete-cliente/**`.
- `apps/movete-admin/**`.
- `docs/architect-b/**`.

**Arquitecto A — único editor:**
- `apps/movete-driver/**`, `apps/mobility-expo/**` (laboratorio previo, API G* y OpenAPI).
- `backend/**`, `database/**`, `packages/**` si aparecen; datos, JWT, MFA, RLS, Storage, tarifario, despacho, transacciones, integraciones y SQL.
- `.github/**`, `scripts/**`, archivos raíz, `docs/architecture/**` y `docs/handoff/**`.

No force-push, rebase ni merge de otra rama sin autorización. Si el cliente necesita una nueva ruta o DTO, documentar exactamente parámetros, esquema, rol, permisos, PII, revisión, TTL, errores y pruebas en issue #9; **A la implementa**. B puede avanzar con adapters fail-closed, mocks sintéticos y QA mientras tanto.

**Validación vigente** al corte: PR #8 tiene **84 archivos**, TODOS en B; cero archivos fuera del alcance. Los builds y tests de Driver pertenecen A; B los verifica como dependencia, **no los edita**.

# 2. FOTO REAL DE GITHUB Y QA — LEER ESTO ANTES QUE INFORMES HISTÓRICOS

## 2.1 PR y ramas
- PR B #8: **abierto DRAFT**, HEAD `692ffc888cf5279f23fd773f5312a07d0d91a3de`. Base A; 84 archivos modificados antes de este handoff, 0 ajenos. Este handoff añadirá un documento número 85 aprox.; verificar conteo actualizado tras el commit.
- PR A #7: **abierto DRAFT**, HEAD `95986b58db110e4fbfd7d364c83ab61935f83c00`, pruebas de PostgreSQL disposable, STAGING Node, Expo aislado y dos apps OK en último HEAD consultado.
- Versionado del OpenAPI A observado: `info.version = 1.0.0-g11` con **42 rutas** al corte; pueden aparecer nuevas cuando A avance. Rutas de historial y cancelación propia SÍ figuran en OpenAPI. Consultas Owner/Admin detalladas más abajo siguen sin estar certificadas.
- No existe certificación de despliegue comercial ni E2E de Android/iOS físico de Cliente/Driver.

## 2.2 Última evidencia CI B, verificada en GitHub
**Commit de código** `63158893ccf197f260167c8eb892eff8f02e18fe`:
- [CI Cliente + Driver aislados #39932010765 — SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932010765): **131 tests Cliente / 131 PASS / 0 FAIL**, TypeScript y export web Expo; Driver independiente también completó job.
- [CI Admin Web #39932010585 — SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932010585): **109 tests Admin / 109 PASS / 0 FAIL**, TypeScript estricto y Vite build.
- [CI ownership #39932010630 — SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932010630): límites de arquitecto y rutas.
**HEAD de documentación** `692ffc888cf5279f23fd773f5312a07d0d91a3de`: [ownership #39932341605 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932341605); [isolation #39932341596 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932341596); [Admin Web #39932418929 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932418929) y #39932341588 SUCCESS.
- En A, HEAD `95986b58db110e4fbfd7d364c83ab61935f83c00` tiene 4 workflows verificados SUCCESS (STAGING Node contracts, PostgreSQL disposable, Expo isolated, isolation). **No son pruebas live**.

**ATENCIÓN a documentación vieja:** B ya tiene job Admin web QA independiente gracias a A (resuelto en CI desde #39893653452). El historial `GET /v1/staging/rider/history` y cancelación propia `POST /v1/staging/rider/trips/{tripId}/cancel` también ya fueron incorporados al OpenAPI A. No volver a solicitarlos como si fueran inexistentes; lo PENDIENTE es evidencia de ejecución segura y Auth/RLS en STAGING.

## 2.3 Ejecutar localmente / CI, sin tocar raíz
- Cliente: `cd apps/movete-cliente && npm install --no-audit --no-fund --ignore-scripts && npm run check`; export QA `npx expo export --platform web --output-dir dist`.
- Admin: `cd apps/movete-admin && npm install --no-audit --no-fund --ignore-scripts && npm run check && npm run build`.
- Node >= 22.13. Cada app tiene su propio package.json y su instalación: no mezclar dependencias ni lockfile entre Cliente/Driver/Admin.
- Los flujos de Actions de A son autoridad de CI: `Movete Facil two app isolation`, `Movete Facil Admin web QA` y `Movete Facil Architect B ownership boundary`; revisar los resultados asociados al SHA actual.
- Export web es **vista QA**, no compilación Android/iOS para tienda.

---

# 3. ARQUITECTURA B YA CONSTRUIDA

`apps/movete-cliente/` — Expo 57 / React Native 0.86 / Expo Router / TS / Node .mjs de dominio, identidad independiente `com.movetefacil.cliente`. Un `ClientRuntimeProvider` mantiene estado efímero. Sin Auth/HTTP real inyectada al montaje por defecto. Un estado del navegador NO autoriza pagos ni viajes.

`apps/movete-admin/` — React 19 / TypeScript / Vite, exclusiva WEB con `AdminRuntime`, `admin-experience`, seguridad de sesión y proyecciones limitadas. Sin service_role, no usar tokens privilegiados en browser. Pantallas con placeholders o entrenamiento sintético hasta que backend certifique la lectura. No hacer KYC real desde mocks.

**Módulos de Cliente existentes (rutas y responsabilidad):**
- `src/domain/client-gateway.mjs`: gateway central de operaciones propuestas, HTTPS pinned, allowlist y validación por operación; desactivado sin contrato. Pruebas `client-gateway.test.mjs`.
- `client-session.mjs`: Passenger-only; rol, sujeto, expiración, logout, limpieza al cambio cuenta/token/vencimiento, invalidación de respuestas tardías y generaciones Auth.
- `client-mutations.mjs`: preparación idempotente, requestKey estable, bloquea doble tap ANTES del primer await, retry explícito, descarta ACK de sesión vieja.
- `client-experience.mjs` + `.d.mts`: ensamblaje de sesión, mutaciones, seguimiento, cotización, historial y cancelación; subscribe/snapshot y cleanup.
- `ClientRuntime.tsx`: Provider UI sin conexión real de fábrica; subscribe/refresh, mantiene todos los screens Cliente consistentes.
- `quote-view.mjs`: proyección de tarifa servidora Gs/TTL/identidad/routing; no calcula tarifas.
- `rider-polling.mjs` y `rider-status.mjs`: GET de estado según revisión, pasajero propietario, asignación persistida, patente/driver verificados, GPS consentido de frescura limitada, ETA condicionada; sin mapa live falso.
- `delivery-form.mjs`: validación de envíos particulares/comerciales, modalidades y restricciones; no tarifas de reparto del frontend.
- `commerce-draft.mjs`: carrito por sucursal, artículos/precios derivados del servidor, límites por línea y datos válidos, sin comprar ni inventar stock.
- `support-draft.mjs`: formulario local sintético de incidentes; **no equivale a despacho de asistencia/SOS ni denuncia enviada**.
- `history-feed.mjs`: proyección owner-only, filas estrictas, revisions, deduplicación, acumulación por páginas; 50 ítems como máximo de respuesta, **sin límite total**; cache de orden que se invalida ante página nueva.
- `client-history-gateway.mjs`: GET `/v1/staging/rider/history` HTTPS; cursor HMAC opaco recibido en cabecera `X-Qore-History-Cursor`, JWT sujeto Passenger, 401/403 de sesión nueva protegidos, JSON/size/TTL, fail closed.
- `ride-cancellation.mjs`: POST cancelación del viaje propio, contrato OpenAPI A, requestKey UUID idempotente, control de sesión y reintentos; recibo persistido verificado. **NO modifica estado visual ni declara reembolso automáticamente**.
- Todos los módulos críticos mencionados tienen `*.test.mjs` con pruebas adversariales; ver inventario íntegro sección 14.

**Pantallas Expo Cliente existentes:**
- `app/index.tsx`: home y accesos a servicios.
- `app/viaje.tsx`: formulario de viaje AUTO, origen/destino y categoría; confirmación real deshabilitada sin cotización/Auth autorizados.
- `app/envios.tsx`: preparación validada de envíos particulares.
- `app/comercios.tsx`: comercio/carrito/borrador por sucursal.
- `app/cotizacion.tsx`: visualización del presupuesto recibido del servidor, Gs y vigencia; sin precio calculado.
- `app/seguimiento.tsx`: estado/driver/patente/GPS/ETA solamente al cumplirse consentimiento, aceptación y antigüedad.
- `app/historial.tsx`: `FlatList` virtualizada; botón de consultar/cargar más con cursor firmado y reinicio manual si caduca; no carga real por defecto.
- `app/cuenta.tsx`: sesión pasajero, expiración y logout.
- `app/pagos.tsx`: solo pagos simulados/no PSP verdadero.
- `app/soporte.tsx`: incidencias de QA local sin enviar denuncias/avisos reales.
- `app/_layout.tsx`: navegación Cliente independiente, NO import de Driver.
**No hay UX final de Cancelar viaje activada en app: solo adaptador/controlador probado.** Falta UUID seguro del dispositivo, doble confirmación UX, status re-fetch y certificado STAGING A.

**Módulos de Admin Web existentes:**
- `admin-session.mjs`: Owner vs Admin y MFA sujeto, tokens efímeros, logout/rotación y bloqueo de respuesta Auth tardía, limpieza por rol.
- `admin-access.mjs`: adaptador de decisión KYC, por defecto deshabilitado; nunca aprobar documentos localmente.
- `review-draft.mjs`: ejercicio de aprobación/rechazo sintético, validación de razón, sin efectos reales.
- `kyc-queue.mjs`: lectura mínima de metadata de documentación, sin fotos/PII, TTL/roles.
- `admin-experience.mjs` y `admin-experience.d.mts`: orquesta KYC/zonas/incidentes/auditoría/finanzas + autorización y relectura sin datos optimistas.
- `AdminRuntime.tsx`: Provider web sin Auth/API por defecto.
- `owner-finance.mjs`: agregados por dueño, PYG/guaraníes, conciliación y ledgerRevision, TTL y revisión, neto puede ser negativo por pérdidas; sin datos bancarios ni PII.
- `zone-overview.mjs`: municipios por modalidad AUTO_RIDE/AUTO_DELIVERY/MOTO_DELIVERY, cobertura, política de elegibilidad y vehículos online. Frescura de recuento **60s**. Cobertura no promete oferta.
- `incidents-overview.mjs`: bandeja mínima categoría/gravedad/estado, no PII ni suspensiones/operación SOS.
- `audit-feed.mjs`: lectura mínima, no genera ni firma auditoría, protección de PII.
- `admin-read-gateway.mjs`: GET whitelist STAGING HTTPS, pinnedOrigin, MFA, JWT/rol, roles diferenciados, sin cookies/referrer/redirect/cache, timeout/tamaño JSON, 401/403 de request obsoleto NO revocan sesión nueva; desactivado por defecto.
- `page-cursor.mjs`: siguiente/anterior/reset, pila de tokens de página, rechazo de circularidad, limpieza al logout. Límite por respuesta únicamente, no de registros totales.
- `main.tsx` y `styles.css`: web Admin con resumen, Propietario, KYC, Zonas, Incidentes, Auditoría, lectura manual «Actualizar», paginación Anterior/Siguiente y feedback accesible. Sin operaciones de escritura live.

---

# 4. HISTÓRICO DE TRABAJO REALIZADO — LINEA TEMPORAL SELECCIONADA

## 4.1 Arranque y contratos Cliente
- `86f0ece6`: primer `client-gateway` fail closed con HTTPS origin, allowlist de operaciones y requestKey.
- `41597e50`: `rider-status` con revisiones privadas, GPS TTL y aceptación persistida; 9 pantallas iniciales Cliente.
- `27a64a86`: creación de `apps/movete-admin` React/TS/Vite independiente.
- `1f4fbc6c`, `8e7bdd9f`: sesión cliente y formularios de envío; tipos TS para Expo.
- `4e86a509`, `8003d226`: borradores de comercio; `d42b99cb` y `f461595b`: carrito, pruebas y arreglo real de expresión UUID.
- `aef53816`: soporte QA local.
- `4475c97c`: `client-mutations` idempotente + `quote-view`.
- `86eebd22`, `1f2a316d`: reparación de concurrencia doble toque ANTES del await en solicitudes Cliente.
- `616c0315`: formulario AUTO y ruta de viaje sin solicitar operaciones comerciales.

## 4.2 Composición Cliente y Admin
- `b5640dd5`: `client-experience` integra recursos y limpieza por actor. CI #39884794024 SUCCESS.
- `1f226178`: `ClientRuntime` y pantallas de cuenta, seguimiento, cotización e historial alimentadas por el mismo estado. CI #39885053406 SUCCESS.
- `010f2f50`: refresco visual de expiración de GPS/ETA/quote sin hacer HTTP automático; CI #39885185094 SUCCESS.
- `0f549954`: `admin-experience` con MFA, cola KYC y decisión sin UI optimista.
- `912a6cb9`, `caabeffb`: `AdminRuntime`, KYC metadata y entrenamiento; resuelta colisión variable TS.

## 4.3 Separación Owner/Admin, zonas, incidentes, audit
- `129b36de`: Owner Finance, proyección reconciliada PYG sin PII/secretos.
- `ede7c296`, `1fb2e232`: permisos owner/admin y pantalla financiera del propietario.
- `d30ad5eb`, `ace3760a`: respuesta KYC tardía descartada después de logout/cambio de cuenta.
- `5c0878c7`: beneficio neto NEGATIVO si el libro lo certifica; no falsificar pérdidas.
- `93503082`: Owner no hereda KYC automáticamente.
- `4ab0b543`: sesiones Cliente/Admin ignoran login tardío y relogin concurrente.
- `0e5d2892`: lectura de zonas por servicio, alcance Admin, Owner no heredado.
- `3e304c78`: TTL de vehículos online vence incluso sin nueva respuesta HTTP.
- `3375ea31`: incidentes administrativos solo metadata mínima.
- `1f4c08d6`: audit-feed de eventos operativos mínimos y vista dedicada.

## 4.4 CI Admin: fallo → diagnóstico → corrección
- Primer nuevo workflow Admin CI #39893192186 FALLÓ por NPM ERESOLVE tipos React DOM; `936e663a` fijó `@types/react-dom=19.2.3`, sin `--force`.
- CI #39893321515: TypeScript falló por `panels[page]` en caso JSX exhaustivo/nunca alcanzable; `b35e77b6` eliminó rama imposible.
- CI #39893440275: 32 tests Admin fallaron por regex UUID incorrecta (faltaba bloque 4 chars); `60cb01dc` reparó validadores.
- CI #39893542340: store zona usaba nombre `payload` fuera de alcance; `4b86173f` corrigió y pasó [CI Admin 79/79 SUCCESS #39893653452](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39893653452).
- `9b34e1c2`: nuevo gateway seguro de lectura Admin. `23b235e2`: conectado al runtime.
- `dd56e16c`: 401/403 antiguo no revoca login nuevo, incluso mismo sujeto/token con authRevision distinta.
- `d385ab1c`: botón «Actualizar datos» bajo contrato y rol; [CI 100/100 SUCCESS #39896092740](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39896092740).

## 4.5 Paginación, escalabilidad y modalidad de zonas
- `ab50dbac`: `page-cursor` con navegación y pruebas de 251 páginas.
- `938e06aa`: `nextCursor` en KYC/zonas/incidentes/audit, solo límites de tamaño por página.
- `65cf1850`: backend GET ?cursor propuesto de Admin y controlador anti-duplicados, prueba de 151 páginas.
- `64d00dff`: arreglado snapshot de paginación al estar sin sesión.
- `af7f0a4b`: botones Anterior / Siguiente en Admin.
- `c6f3793e`: historia Cliente `FlatList` y 5.000 registros sintéticos acumulados de 100 páginas x 50.
- `ea675b07`: misma zona puede ofertar modalidades distintas sin colisión de clave; [CI Admin 109/109 #39921965130](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39921965130).

## 4.6 Historial Cliente bajo OpenAPI real de A
- `d755dd5a`: gateway HTTP de historial propio del pasajero, fail-closed.
- `2ee4a4c2`: lectura por página desde `client-experience`, UI Cargar más, pruebas 120 páginas.
- `03ee5de4`: cachea orden del historial, invalida con páginas nuevas.
- `0cdbd0bc`: REEMPLAZÓ el inventado `?cursor=...` por la cabecera **`X-Qore-History-Cursor`** de OpenAPI A con firma de formato HMAC.
- `353d60a5`: reparó helper sintético faltante en tests.
- `c3f38ddf`: cursor revocado HTTP 400 y botón reinicio primera página.
- `0b598a6b`: nueva sesión/token de mismo usuario borra datos personales temporales, historial/quote/GPS; cursor expirado invalida snapshot.
- `80bc455c`: expiración TTL inicia cadena nueva; errores entendibles por usuario.
- Pruebas subieron 113 → 118 en Cliente sin pérdida de aislamiento.

## 4.7 Cancelación propia STAGING (último desarrollo funcional)
- `8c6a5879`: `ride-cancellation.mjs` + 10 pruebas, contrato OpenAPI `POST /v1/staging/rider/trips/{tripId}/cancel`; body EXACTO `{requestKey}`, idempotencia, actor actual, 409/conflicto y recibo persistido; NO reembolso.
- `63158893`: integrada en `client-experience` con `prepareCancelRide/submitCancelRide/retryCancelRide`, ligada a viaje activo y logout. **NO hay botón cancel real en UI, no hay UUID OS generado, no cambia estado hasta GET autoritativo**.
- `692ffc88`: documentación B actualizada, PR #8 aún DRAFT. [CI Cliente 131/131 #39932010765](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932010765) y [Admin 109/109 #39932010585](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932010585); tres checks del HEAD documentación también SUCCESS.

---

# 5. CONTRATOS REALES QUE A YA PUBLICÓ EN OPENAPI G11

**Fuente a releer siempre** en rama A:
`apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json`.

| Ruta | Uso B | Certificación |
|---|---|---|
| `POST /v1/staging/rider/trips/request` | Solicitud AUTO own-rider | Hay contrato; integrar solo con Auth/STAGING validado |
| `GET /v1/staging/rider/trips/{tripId}/status` | Seguimiento y recarga estado propio | Hay contrato RiderStatusV1, verificar pruebas de JWT/revisión/GPS servidor |
| `POST /v1/staging/rider/trips/{tripId}/cancel` | Cancelación idempotente propia | Hay contrato `cancelOwnRideIdempotent`, gateway B implementado pero bloqueado |
| `GET /v1/staging/rider/history` | Historial propio ilimitado por páginas | Hay contrato `listOwnRiderHistoryPaginated`, B implementó adaptador bloqueado |
| `POST /v1/staging/sender/deliveries/request` | Solicitud envío permitido | Contrato; sin envío real |
| `GET /v1/staging/deliveries/{deliveryId}/status` | Seguimiento envíos | Contrato; revisar seguridad propia |
| `POST /v1/staging/fares/quote` | Cotización servidor Gs | Contrato; falta respuesta DTO certificado end-to-end |
| `POST /v1/staging/buyer/orders/request` | Pedido comercio | Contrato; falta Auth/catálogo/stock comercial |
| `GET /v1/staging/orders/{orderId}/status` | Estado compra | Contrato; no habilitar sin permiso server |
| `POST /v1/staging/payments/authorize` | Pago SIMULADO | No PSP real ni retención de tarjetas |
| `POST /v1/staging/safety/incidents/report` | Denuncia al backend | No equivale a emergencias live; requiere permisos/flujo certificado |
| `POST /v1/staging/admin/vehicle-reviews` | Revisión de vehículos | Es POST; NO equivale a GET de bandeja administrativa |

**Detalles NO negociables del historial:**
- `nextCursor` devuelto por el servidor: tipo `v1.<payload>.<signature>` HMAC-SHA256, ligado al propio JWT, expiración 10 minutos según descripción A.
- En solicitud de página posterior: cabecera `X-Qore-History-Cursor`, **NO query string**. Primera página sin esa cabecera.
- `maxItems=50` por respuesta, **SIN techo global**. Continuar hasta `nextCursor=null`.
- `ownerId` debe coincidir con sujeto JWT. `RiderOwnHistoryItemV1` con `revision>=1`.
- Respuestas de error de A: 400 cursor inválido, 401/403, 429, 503. No dejar que una respuesta de sesión vieja borre una nueva.
- El frontend valida estructura, identidad y TTL; SOLO el backend puede verificar la firma HMAC y ejecutar RLS.

**Detalles de cancelación (NO devolución de dinero):**
- `POST .../{tripId}/cancel`, body EXACTAMENTE `{requestKey:UUID}`.
- `RideCancellationReceiptV1` debe declarar `mode=STAGING_DEMO_ONLY`, `commercialRidesEnabled=false`, `tripId` igual solicitado, `event=cancel`, `eventId` UUID y `serverPersisted=true`.
- 200 indica evento persistido, NO GPS/estado cliente actualizado, NO reembolso, NO comisión de cancelación. Hacer GET status luego de ACK validado.
- 409 conflicto (estado avanzado/carrera) exige relectura del servidor; no reintentar a ciegas.
- Conserva el mismo requestKey tras timeout hasta resultado definitivo; no disparar dos cancelaciones.

---

# 6. CONTRATOS SOLICITADOS A A PERO NO CERTIFICADOS

**No inferir endpoints por el nombre o una pantalla.** En issue #9 quedan solicitudes de B. El Arquitecto B tiene adaptadores deshabilitados con formatos propuestos, no puede declarar operativo el backend.

| Operación B | Ruta propuesta, NO comprobada como servicio real | Requisitos |
|---|---|---|
| Admin KYC queue | `GET /v1/staging/admin/vehicle-review-queue` | JWT admin + MFA, permiso lectura, metadatos mínimos, paginación, rev/TTL, RLS |
| Admin zonas | `GET /v1/staging/admin/zones/overview` | Por AUTO_RIDE / AUTO_DELIVERY / MOTO_DELIVERY, cobertura≠oferta, online TTL <=60s |
| Admin incidentes | `GET /v1/staging/admin/incidents/queue` | Metadatos, severidad, estado, sin PII, permiso por rol |
| Admin auditoría | `GET /v1/staging/admin/audit/events` | Eventos mínimos, integridad real y almacenamiento inmutable en backend |
| Owner financiero | `GET /v1/staging/owner/finance/summary` | JWT owner + MFA, estado RECONCILED, PYG, ledgerRevision, TTL, sin PII |
| Passenger Auth / Admin Auth | Rutas y proveedor NO confirmados por B | Rotación, revocación, roles, MFA servidor, expiración y test 401/403 |
| Catálogo/sucursal/stock/soporte/historial documental | DTO final no plenamente certificado | Autorización de actor, negocio y objeto, privacidad, idempotencia, reintentos |

**Precaución:** B Admin diseñó consultas GET por `?cursor=...` para las rutas propuestas. Cuando A publique los GET definitivos podría exigir header firmado como historial; **adaptar B al contrato REAL de A**, nunca exigir a A que cambie un contrato más seguro para comodidad de UI.

La implementación B de Admin limita cada respuesta (por ejemplo 100 KYC/incidentes/audit y 200 zonas) para proteger memoria y ancho de banda; **NO son límites de usuarios ni máximo de registros globales**.

---

# 7. LOS PROBLEMAS / RIESGOS ABIERTOS QUE EL SUCESOR DEBE RESOLVER

**P0 — Bloqueos reales para conectar datos o lanzar:**
1. Falta certificación operativa de autenticación Passenger/Admin/Owner con proveedor real, JWT verificado, MFA cuando corresponda y revocación segura.
2. RLS/grants/backend por actor/objeto no verificados de extremo a extremo para los DTO consumidos por B. UI role checks NO sustituyen permisos de servidor.
3. Falta entorno STAGING accesible para E2E sintética end-to-end; un OpenAPI o tests disposable no prueban alcance HTTP desde el móvil.
4. Faltan contratos definitivos y endpoints de lectura Admin/Owner; adaptadores B se mantendrán OFF.
5. Falta prueba de cancelación atómica G3 contra estados concurrentes, actor ajeno e idempotencia mismo requestKey, más relectura de status.
6. No autorizada conexión financiera, PSP/cobros reales ni tarifas editables. La plataforma no debe inventar un saldo «real».
7. Falta verificación legal/seguros por zona y servicio; MOTO pasajeros sigue BLOQUEADO.
8. Gestión de documentos/KYC real requiere almacenamiento privado, retención, permisos, auditoría y procedimientos de seguridad/aprobación Owner.
9. No hay autorización de despliegue, merge, LIVE, stores ni uso de PII de personas reales.

**P1 — Funciones aún incompletas aunque no bloquean continuar código/QA:**
10. Conectar `ClientRuntime` con proveedor Auth Passenger real probado en STAGING; actualmente proveedor NO configurado.
11. Montar flujos de solicitud AUTO completos: cotización, confirmación UI, solicitud idempotente y radar/aceptación, estados y cancelación.
12. Habilitar botón Cancelar SOLO con `requestKey` UUID generado mediante CSPRNG nativo/OS, confirmación UX, estado persistido y tratamiento 409. NO usar Math.random para UUID sensibles.
13. Integrar tracking real por GET autoritativo/RiderStatusV1, mapas/ETA con consentimiento y ubicación fresca; no usar GPS sintético en UI LIVE.
14. Formularios de envíos AUTO/MOTO con pesos, cargas prohibidas, datos de remitente/destinatario, pricing server-side, prueba de entrega privada.
15. Comercios reales: alta de sucursales/stock, catálogo, filtros y disponibilidad por zona, carrito atado a precios/versiones servidor, checkout y cancelación.
16. Historial grande se acumula actualmente en Map en memoria; `FlatList` virtualiza render pero **NO limita memoria acumulada** si hay cientos de miles. Definir política de páginas en memoria/cache privado y límites operativos **sin limitar registros totales del backend**.
17. Historial de servicios: faltan recibos server-ledger, comprobantes de pagos simulados, filtros por fecha/servicio y su contrato seguro.
18. Soporte QA no envía un reporte real ni es central 24/7; diseñar confirmación/seguimiento autorizado sin prometer SOS.
19. Admin KYC real: lectura metadatos, acceso documental efímero y revisión auditable por usuario/permiso, relectura tras decisión; no exponer archivos a rol Owner por defecto.
20. Admin zonas/operaciones: no existe ajuste live de zona desde UI. Exigir permisos y doble confirmación antes de cambios peligrosos.
21. Admin incidentes/suspensiones: solo cola lectura; las acciones deben ser transacciones auditadas del servidor, no optimistas.
22. Admin auditoría: proyección informativa sin garantía de cadena de integridad frontend; A define evidencia y retención.
23. Admin owner financiero: DTO propuesto, neto Gs puede ser negativo; falta autenticar Owner real y vincular al ledger reconciliado.
24. Paginación Admin propuesta usa tokens URL-safe: faltan paginación keyset firmada JWT/tenant, snapshot y protección contra cursor de otra cuenta por A.
25. Escalabilidad real: no se ha certificado capacidad PostgreSQL ni rendimiento 1k/10k+ registros con filtros, índices, RLS y miles de sesiones.
26. UI final/responsive/accesibilidad de cada pantalla en Android físico, iOS cuando aplique y navegador Admin; export web NO prueba gestures/GPS/notificaciones nativos.
27. Notificaciones de conductor/disponibilidad y geolocalización de ruta real pertenecen A, integración B futura tras contratos.
28. Gestión de secretos y configuración STAGING/PROD, CSP/CORS, rate-limit, no token en logs/analytics, certificados y observabilidad E2E.
29. Lovable final aún no sustituye infraestructura. No dar por «terminado» el producto por tener mocks funcionales.
30. El PR B tiene base A que avanza en paralelo: revisar archivos cambiados y compatibilidad OpenAPI, sin rebase/merge no autorizado.

**P2 — Calidad y sostenibilidad:**
31. Pruebas E2E automatizadas de flows UI con mocks sintéticos versionados, lectura de pantallas, error-state, navegación por voz/accessibility labels, contraste y escalado tipográfico.
32. Estado offline/reconexión con ACK duplicado: JWT expirado, rotación durante polling, conflictos de pago/cancelación, 429 backoff sin spin y retorno de servicio.
33. Prueba de fugas de PII entre Owner/Admin, Cliente A/B, documentos Driver y anotaciones en telemetry.
34. Revisar nombres y esquemas de DTO UI contra A tras cada incremento de OpenAPI.
35. Definir recibos/IVA/tributación/documentación de Paraguay con asesoría apropiada antes de operar dinero/expedientes reales.

# 8. PROBLEMAS HISTÓRICOS YA CERRADOS — NO REPETIR

- Doble toque antes del primer await enviaba peticiones duplicadas → bloqueado sincrónicamente en `client-mutations`.
- UUID malformed por ausencia del cuarto segmento de 4 dígitos en regex → corregido y testeado en Admin y commerce Cliente.
- Admin npm `ERESOLVE` entre React y tipos React DOM → `@types/react-dom=19.2.3` fijado y CI pasó.
- Admin TS JSX rama imposible `panels[page]` → eliminada y typecheck verde.
- `zone-overview` referencia `payload` fuera de alcance → corregida, tests verde.
- Race Auth login tardío posterior a logout/cambio de cuenta → epoch/generation y retorno STALE.
- Role owner↔admin con mismo sujeto retenía datos privados → limpieza al cambiar rol.
- 401/403 tardío podía invalidar sesión nueva → authRevision y verificación de sesión actual antes del callback.
- GPS/ETA expirados sin evento se quedaban visualmente viejos → actualización local de frescura y TTL.
- Recuento de vehículos sin nueva red quedaba aparentemente fresco → vencimiento 60s.
- Neto negativo no representaba pérdidas → aceptado únicamente en campo neto reconciliado.
- Paginación sin snapshot vacío tras logout → corregida.
- Una zona con tres modalidades generaba conflicto de clave → clave conjunta zona + tipo de servicio.
- Cursor HTTP Cliente inicialmente puesto en query → corregido a `X-Qore-History-Cursor` REAL del OpenAPI A.
- Helper de cursor sintético faltante en test → corregido y CI verde.
- Historial con token nuevo o TTL vencido retenía página vieja → limpieza e inicio secuencia nueva.
- **Job de CI Admin ya existe y pasa**: NO volver a pedir a A que lo cree.
- Estos son fallos cerrados en QA. No inferir de ahí que el backend real está certificado.

---

# 9. HOJA DE RUTA EJECUTABLE DEL SIGUIENTE ARQUITECTO B — ORDEN PRIORITARIO

**MODO OPERATIVO: TRABAJAR SIN DETENERSE; cada bloque produce código + pruebas + commit + CI + evidencia. No esperar preguntas del Owner para cambios seguros del área B.**

### B-P0 · Primera acción de nuevo chat: comprobar HEAD y restaurar contexto
1. Abrir este documento desde la rama B, leer PR #8, issue #9 y la división A/B. Obtener HEAD A y HEAD B actuales. No reciclar SHAs ciegamente.
2. Verificar que TODOS los archivos cambiados en PR #8 sigan en las tres rutas permitidas; sin merges. Ejecutar/verificar CI reciente y no hacer claims de éxito con jobs pendientes.
3. Leer `STATUS_Y_CONTRATOS.md`, `CANCELACION_CLIENTE_QA_SEGURIDAD_2026-10-23.md`, `HISTORIAL_CLIENTE_OPENAPI_G11_2026-10-23.md` y OpenAPI A vigente.
4. Seleccionar primer pendiente B realizable sin dependencia: **probar UX de cancelación**, simulación completa de estado o escenarios de accesibilidad; continuar con commits. No detenerse por falta de API live.

### B-P1 · Cliente: completar cancelación y seguridad de sesión
5. Implementar de forma separada dentro de Cliente un generador UUID seguro basado en CSPRNG OS / Expo verificado, sin Math.random, y tests de idempotencia/doble click. Respetar restricciones de instalación.
6. Añadir pantalla/modal «Cancelar viaje» **solo cuando** el contrato STAGING esté habilitado, con estado «solicitud enviada / pendiente de confirmar», conflicto 409, expiración, offline, reintento conservando requestKey.
7. Releer estado autoritativo `GET /rider/trips/{tripId}/status` después de recibo cancel y NO marcar viaje cancelado por voluntad del frontend.
8. Completar tests de desactivación por defecto, rol driver/owner, sesión rotada, carreras, request repetida, validación receipt, consulta obsoleta.
9. Revisar antigüedad de datos GPS/driver, limpiar ante 401/403 y reconectar sin publicar coordenadas viejas.

### B-P2 · Cliente: viaje AUTO, cotización, entregas, comercio
10. Completar wizard AUTO: cotizar Gs servidor, esperar respuesta, mostrar tarifa vigente, solicitar con requestKey, búsqueda, asignación, estado, anulación según política.
11. Envíos: peso/categoría/origen-destino, AUTO/MOTO entrega, cargas no permitidas, zonas habilitadas, proof-of-delivery privado y errores.
12. Comercios: catálogo y stock por sucursal, carrito con versión de catálogo, validación de cambios/indisponibilidad, pedido/comercio/delivery asociado.
13. Pago: solamente simulación hasta PSP/conciliación/seguridad/autorización del Owner.
14. Historial y recibos: UI filtro, rendimiento de muchas páginas, reconciliación por actor, no inferir total global por tamaño de página.
15. Soporte/seguridad: UX de incidente con mensaje claro de que NO hay emergencia en vivo ni envío hasta contrato y permiso real.

### B-P3 · Admin: completar panel privado de operaciones
16. Seguir con roles separados: Admin KYC/zonas/incidentes/audit; Owner resumen financiero conciliado. No heredar KYC con rol Owner.
17. Al recibir GET definitivos de A, adaptar rutas, cursor header/query, payload, role, MFA y RLS; mantener fail-closed y pruebas.
18. Añadir E2E de KYC sintético con aprobación/rechazo solo si A certifica escritura y auditoría. No mostrar PII ni archivos sin URLs efímeras y permiso.
19. Mejorar zonas (por modalidad, cobertura/vehículos, TTL) e incidentes (severidad/estatus, triage auditable); **ningún botón live antes de gate**.
20. Owner financiero: separación bruto/fee/payout/refund/procesamiento/neto, neto negativo, periodos y ledgerVersion, no interpretar neto como beneficio fiscal.
21. Seguridad Admin Web: CSP, validación de sesión bajo cambio de rol, no credenciales en storage, pruebas de logout en requests concurrentes, accesibilidad web.

### B-P4 · QA integrada, entrega Lovable y certificación
22. Completar harness E2E con cuentas y datos sintéticos STAGING, roles múltiples, pruebas 401/403/409/429/503, logout offline, cambio token, idempotencia, TTL.
23. Coordinar con A para test real de los dos móviles independientemente y de Admin Web; sólo A modifica CI central.
24. Pedir al Owner permiso SOLO para pruebas STAGING cuando Auth, RLS, DTO y ambiente hayan pasado; NO convertir permiso de STAGING en permiso LIVE.
25. Exportar UI aprobada para Lovable sin introducir lógica central ni claves, verificar paridad Android Cliente y web Admin.
26. Actualizar este handoff y STATUS con nuevos SHAs, CI, riesgos, contratos y tareas sin resolver tras cada bloque de construcción.

**Regla si aparece un bloqueo:** documentar dependencia puntual en issue #9 o nuevo issue delimitado; implementar otro trabajo B que NO dependa de él. Detener sólo la acción insegura o imposible, no toda la construcción.

---

# 10. CRITERIOS DE ACEPTACIÓN Y PRUEBAS QUE FALTAN

**Gate B-G1 Cliente QA local (parcialmente logrado):**
- [x] Pantallas y dominios separados de Driver.
- [x] Auth Passport simulado fail-closed; cursores/history/cancelación idempotentes en tests.
- [x] TypeScript, 131 pruebas Cliente, export web CI.
- [ ] Captura UX real y E2E en Android físico/emulador; accessibility y rutas completas.
- [ ] JWT Passport REAL con proveedor STAGING y RLS propio/ajeno.
- [ ] GPS/ETA verificados y despacho AUTO en STAGING.
- [ ] Comercios/envíos/soporte y checkout completo en STAGING.
- [ ] Cancelación UI habilitada solo con Auth válida y re-fetch status.

**Gate B-G2 Admin QA local (parcialmente logrado):**
- [x] Sitio web independiente, componentes Owner/Admin separados.
- [x] 109 tests Admin, TypeScript y Vite build CI.
- [x] Paginación y proyecciones de metadatos con TTL.
- [ ] Auth/MFA real servidor, scopes y permisos verificables.
- [ ] GET reales Admin/Owner / cursor firmado / errores/reintentos autorizados.
- [ ] KYC documental y decisiones reales con auditoría/RLS.
- [ ] Navegación/accessibility E2E en navegador con ambiente STAGING.
- [ ] Prueba de CSP/session/token/PII con herramientas de seguridad.

**Gate B-G3 Comercial (NO logrado; no declarar lanzamiento):**
- [ ] Apps Android/iOS instalables firmadas y pruebas en dispositivos.
- [ ] Infraestructura backend STAGING real con observabilidad, seguridad, resiliencia y backups.
- [ ] Tarifas legales/seguros/comisiones y medios de pago autorizados con seguridad fiscal.
- [ ] Gestión de privacidad/documentación central de conductores aprobada.
- [ ] Pruebas de alta demanda (muchos usuarios/registros simultáneos) sin falsos límites de 50.
- [ ] Permisos Owner de MERGE, LIVE, tiendas y despliegue.

---

# 11. REGLAS DE RESPUESTA Y TRAZABILIDAD PARA EL SUCESOR

En cada incremento:
1. Distinguir **implementado** vs **simulado** vs **desactivado** vs **certificado STAGING** vs **LIVE**.
2. Dar SHA completo o abreviado, ruta exacta, test ejecutado y conclusión GitHub Actions, fallos/soluciones y nuevo siguiente paso.
3. Si CI falla, abrir logs y corregir, **NUNCA deshabilitar tests o relajar validadores para fingir verde**.
4. No inventar estadísticas de uso, número de conductores, ingresos, reservas o métricas de disponibilidad.
5. No llamar «app completa» por 131/109 unit tests ni por web export; no dar porcentaje no justificable de avance.
6. No reabrir problemas solucionados: job CI Admin, regex UUID, cursor Header real de historia, roles Owner/Admin y paginación sin tope.
7. Comunicar a A cambios de contratos con issue y evidencia; no invadir rama o carpetas.
8. Ejecutar dentro del mismo turno todo trabajo que permitan herramientas; no prometer trabajo en segundo plano sin herramienta de programación.

---

# 12. ÍNDICE DE DOCUMENTACIÓN ÚTIL YA PUBLICADA (RAMA B)

- `docs/architect-b/INICIO_ARQUITECTO_B_CLIENTE_ADMIN_2026-10-22.md` — alcance B01–B13 y orden.
- `docs/architect-b/STATUS_Y_CONTRATOS.md` — cronología detallada de 11 sesiones, bugs, contrato y CI (histórico, revisar última sección).
- `docs/architect-b/QA_INTEGRACION_FRONTENDS_2026-10-22.md` — composición de Cliente y Admin, pruebas negativas.
- `docs/architect-b/OWNER_DASHBOARD_FINANCE_RBAC_2026-10-22.md` — finanzas Owner, rol/MFA, saldo neto negativo, DTO solicitado.
- `docs/architect-b/ADMIN_ZONAS_INCIDENTES_SEGURIDAD_2026-10-22.md` — cola de incidentes, zona/modalidad, cobertura ≠ disponibilidad.
- `docs/architect-b/CERTIFICACION_ADMIN_WEB_QA_2026-10-23.md` — errores ERESOLVE/TypeScript/UUID, pipeline Admin y resolución.
- `docs/architect-b/ADMIN_READ_GATEWAY_QA_2026-10-23.md` — gateway admin autenticado fail-closed, reglas de permisos y contratos GET A.
- `docs/architect-b/PAGINACION_SIN_LIMITE_REGISTROS_2026-10-23.md` — cursores, pruebas de 151 páginas Admin y 5.000 ítems Cliente.
- `docs/architect-b/HISTORIAL_CLIENTE_OPENAPI_G11_2026-10-23.md` — HMAC y `X-Qore-History-Cursor` real.
- `docs/architect-b/CANCELACION_CLIENTE_QA_SEGURIDAD_2026-10-23.md` — cancelación propia, retry idempotente, recibo server-persisted, 131/109 tests.
- En rama A `docs/handoff/DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md`, `docs/handoff/HANDOFF_MAESTRO_INTEGRAL_QORE_MOBILE_DOS_ARQUITECTOS_G0_G22_2026-10-22.md` y OpenAPI G11.

---

# 13. INSTRUCCIÓN EXACTA PARA INICIAR EL NUEVO CHAT — ARQUITECTO B

> Soy el nuevo Arquitecto B de **QORE Mobile / Movete Fácil**. Debes continuar el trabajo existente, **SIN PARAR SALVO BLOQUEO REAL**. No reconstruyas desde cero ni repitas estudios anteriores. GitHub es fuente de verdad, repo `mezas3238-hue/Qore-mobile-`. Abre la rama `feature/mobility-cliente-admin-parallel-20261022`, PR **#8 DRAFT**, con BASE en la rama A `feature/mobility-monorepo-isolated-20261016` (PR #7 DRAFT). Lee PR #8, [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9) y `docs/architect-b/HANDOFF_MAESTRO_INTEGRAL_ARQUITECTO_B_CLIENTE_ADMIN_CONTINUIDAD_2026-10-23.md`; después comprueba los HEAD y CI recientes.
>
> Tu propiedad EXCLUSIVA: `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`. A controla Driver, backend, OpenAPI, SQL, CI y documentación común. **NO MERGE, NO DEPLOY/LIVE, NO VPS/SQL remoto, NO datos/personas/pagos reales sin instrucción del Owner.**
>
> Cliente/Driver son dos apps Expo DIFERENTES; Admin es web separada. Cliente QA tuvo 131/131 tests SUCCESS; Admin QA 109/109 SUCCESS; eso **no es producción**. Hay gateways de historial/cancelación basados en OpenAPI A G11, desactivados por defecto; el resto de Admin GET y Auth/MFA real aún requiere A.
>
> COMIENZA ya desde el primer bloque viable: verifica archivos y contratos de historial/cancelación propios contra OpenAPI A ACTUAL; completa preparación segura UX de cancelación (UUID CSPRNG OS, doble toque, 409, estado después de GET, todo desactivado por defecto) y pruebas adversariales. A la par desarrolla E2E y accesibilidad Cliente/Admin, e integra los contratos que A certifique sin invadir sus archivos. Tras cada cambio publica commit en rama B, espera/verifica CI, corrige fallos y continúa. Si falta un endpoint seguro abre comentario preciso en issue #9 y cambia a otro trabajo B independiente.
>
> Mantén una sola fuente de verdad en GitHub con SHA, CI, errores, soluciones, dependencias y siguiente paso. No afirmes LIVE ni pidas confirmaciones constantes. Trabaja sin detenerte a menos que exista un bloqueo real de seguridad/legalidad/acceso o una decisión de producto imprescindible.

---

# 14. INVENTARIO COMPLETO DE LOS 84 ARCHIVOS DEL PR B AL CORTE

El índice siguiente se obtuvo **directamente** de `list_pr_changed_filenames` de GitHub en el PR #8. La creación de este documento agregará un archivo más. Confirmar la lista con el PR actualizado; es inventario de cambios, NO de cada archivo del repositorio. Ninguno está fuera de propiedad B.

### Cliente — aplicación móvil (41)
1. `apps/movete-cliente/app/_layout.tsx`
2. `apps/movete-cliente/app/comercios.tsx`
3. `apps/movete-cliente/app/cotizacion.tsx`
4. `apps/movete-cliente/app/cuenta.tsx`
5. `apps/movete-cliente/app/envios.tsx`
6. `apps/movete-cliente/app/historial.tsx`
7. `apps/movete-cliente/app/index.tsx`
8. `apps/movete-cliente/app/pagos.tsx`
9. `apps/movete-cliente/app/seguimiento.tsx`
10. `apps/movete-cliente/app/soporte.tsx`
11. `apps/movete-cliente/app/viaje.tsx`
12. `apps/movete-cliente/src/ClientRuntime.tsx`
13. `apps/movete-cliente/src/domain/client-experience.d.mts`
14. `apps/movete-cliente/src/domain/client-experience.mjs`
15. `apps/movete-cliente/src/domain/client-experience.test.mjs`
16. `apps/movete-cliente/src/domain/client-gateway.mjs`
17. `apps/movete-cliente/src/domain/client-gateway.test.mjs`
18. `apps/movete-cliente/src/domain/client-history-gateway.mjs`
19. `apps/movete-cliente/src/domain/client-history-gateway.test.mjs`
20. `apps/movete-cliente/src/domain/client-mutations.mjs`
21. `apps/movete-cliente/src/domain/client-mutations.test.mjs`
22. `apps/movete-cliente/src/domain/client-session.mjs`
23. `apps/movete-cliente/src/domain/client-session.test.mjs`
24. `apps/movete-cliente/src/domain/commerce-draft.mjs`
25. `apps/movete-cliente/src/domain/commerce-draft.test.mjs`
26. `apps/movete-cliente/src/domain/delivery-form.d.mts`
27. `apps/movete-cliente/src/domain/delivery-form.mjs`
28. `apps/movete-cliente/src/domain/delivery-form.test.mjs`
29. `apps/movete-cliente/src/domain/history-feed.mjs`
30. `apps/movete-cliente/src/domain/history-feed.test.mjs`
31. `apps/movete-cliente/src/domain/quote-view.mjs`
32. `apps/movete-cliente/src/domain/quote-view.test.mjs`
33. `apps/movete-cliente/src/domain/ride-cancellation.mjs`
34. `apps/movete-cliente/src/domain/ride-cancellation.test.mjs`
35. `apps/movete-cliente/src/domain/rider-polling.mjs`
36. `apps/movete-cliente/src/domain/rider-polling.test.mjs`
37. `apps/movete-cliente/src/domain/rider-status.mjs`
38. `apps/movete-cliente/src/domain/rider-status.test.mjs`
39. `apps/movete-cliente/src/domain/support-draft.d.mts`
40. `apps/movete-cliente/src/domain/support-draft.mjs`
41. `apps/movete-cliente/src/domain/support-draft.test.mjs`

### Admin — aplicación web (33)
1. `apps/movete-admin/README.md`
2. `apps/movete-admin/index.html`
3. `apps/movete-admin/package.json`
4. `apps/movete-admin/src/AdminRuntime.tsx`
5. `apps/movete-admin/src/admin-access.mjs`
6. `apps/movete-admin/src/admin-access.test.mjs`
7. `apps/movete-admin/src/admin-experience.d.mts`
8. `apps/movete-admin/src/admin-experience.mjs`
9. `apps/movete-admin/src/admin-experience.test.mjs`
10. `apps/movete-admin/src/admin-read-gateway.mjs`
11. `apps/movete-admin/src/admin-read-gateway.test.mjs`
12. `apps/movete-admin/src/admin-session.mjs`
13. `apps/movete-admin/src/admin-session.test.mjs`
14. `apps/movete-admin/src/audit-feed.mjs`
15. `apps/movete-admin/src/audit-feed.test.mjs`
16. `apps/movete-admin/src/incidents-overview.mjs`
17. `apps/movete-admin/src/incidents-overview.test.mjs`
18. `apps/movete-admin/src/kyc-queue.d.mts`
19. `apps/movete-admin/src/kyc-queue.mjs`
20. `apps/movete-admin/src/kyc-queue.test.mjs`
21. `apps/movete-admin/src/main.tsx`
22. `apps/movete-admin/src/owner-finance.mjs`
23. `apps/movete-admin/src/owner-finance.test.mjs`
24. `apps/movete-admin/src/page-cursor.mjs`
25. `apps/movete-admin/src/page-cursor.test.mjs`
26. `apps/movete-admin/src/review-draft.d.mts`
27. `apps/movete-admin/src/review-draft.mjs`
28. `apps/movete-admin/src/review-draft.test.mjs`
29. `apps/movete-admin/src/styles.css`
30. `apps/movete-admin/src/vite-env.d.ts`
31. `apps/movete-admin/src/zone-overview.mjs`
32. `apps/movete-admin/src/zone-overview.test.mjs`
33. `apps/movete-admin/tsconfig.json`

### Documentación exclusiva del Arquitecto B (10)
1. `docs/architect-b/ADMIN_READ_GATEWAY_QA_2026-10-23.md`
2. `docs/architect-b/ADMIN_ZONAS_INCIDENTES_SEGURIDAD_2026-10-22.md`
3. `docs/architect-b/CANCELACION_CLIENTE_QA_SEGURIDAD_2026-10-23.md`
4. `docs/architect-b/CERTIFICACION_ADMIN_WEB_QA_2026-10-23.md`
5. `docs/architect-b/HISTORIAL_CLIENTE_OPENAPI_G11_2026-10-23.md`
6. `docs/architect-b/INICIO_ARQUITECTO_B_CLIENTE_ADMIN_2026-10-22.md`
7. `docs/architect-b/OWNER_DASHBOARD_FINANCE_RBAC_2026-10-22.md`
8. `docs/architect-b/PAGINACION_SIN_LIMITE_REGISTROS_2026-10-23.md`
9. `docs/architect-b/QA_INTEGRACION_FRONTENDS_2026-10-22.md`
10. `docs/architect-b/STATUS_Y_CONTRATOS.md`

---

# 15. CIERRE DE TRANSFERENCIA

**Implementado y verificado en QA:** módulos Cliente de sesión, solicitudes idempotentes, cotización, seguimiento con privacidad, formularios de envíos/comercios/soporte, historial ilimitado mediante páginas, cancelación servidor prevista; panel Admin Web con roles Owner/Admin, KYC/zonas/incidentes/audit/finanzas proyectados de manera segura, lectura gateway y paginación; 131 tests Cliente + 109 Admin aprobados; export web/typecheck y aislamiento aprobados.

**NO completado:** Auth/STAGING real con JWT/RLS/MFA, operaciones de vehículos reales, documentación KYC/seguridad comercial, gestión de conductores/expedientes, tarifas y pagos reales, API Admin definitiva, pruebas E2E nativas y lanzamientos. Esos trabajos están enumerados y repartidos por propietario.

**Directiva última:** seguir avanzando sin detenerse salvo bloqueo auténtico; no mezclar las apps ni los propietarios; no hacer merge/LIVE. **FIN HANDOFF MAESTRO B — CONTINUIDAD ÍNTEGRA.**
