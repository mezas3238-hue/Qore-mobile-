# QORE Mobile — Arquitecto B | Estado y contratos
Fecha de inicio: 22-10-2026. Rama exclusiva `feature/mobility-cliente-admin-parallel-20261022`. PR [#8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) **DRAFT** (base PR #7). No merge, LIVE, VPS, pagos, push ni SQL remoto.

## Evidencia auditada
- `apps/movete-cliente` existe: proyecto Expo 57, identificador `com.movetefacil.cliente`; rutas `index`, `envios`, `seguimiento`, `historial`. Son demos locales sin API ni sesiones reales.
- `apps/movete-admin` no existía al primer análisis. Se debe construir WEB independiente, no otra app móvil ni función de Driver.
- `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json` declara 34 rutas, `version=1.0.0-g11`. Descripción explícita: STAGING, NO LIVE. La presencia del esquema no prueba disponibilidad en internet.
- Contratos presentes: `POST /v1/staging/rider/trips/request`, `GET /v1/staging/rider/trips/{tripId}/status`, `POST /v1/staging/sender/deliveries/request`, `GET /v1/staging/deliveries/{deliveryId}/status`, `POST /v1/staging/fares/quote`, `POST /v1/staging/buyer/orders/request`, `GET /v1/staging/orders/{orderId}/status`, `POST /v1/staging/payments/authorize`. Request JSON definido pero la respuesta genérica Success **no proporciona contrato tipado de resultados**.
- Auth Passenger y operaciones Admin necesitan contrato versionado de A; un JWT de cliente no se valida en UI; backend debe comprobar firma, rol y propiedad. `POST /v1/staging/admin/vehicle-reviews` existe como contrato de revisión pero NO habilita Admin desde browser.
- Limitación seguridad: no se puede integrar operaciones reales basándose solamente en nombres de rutas; requiere URL staging HTTPS aprobada, Auth seguro y contrato de respuestas.

## Matriz B01–B13
| Fase | Estado verificable | Próxima dependencia |
|---|---|---|
| B01 Auditoría | Completa: archivos Expo y OpenAPI leídos | Auditoría de respuestas por A |
| B02 Arquitectura Cliente | Parcial: navegación inicial aislada | Pantallas adicionales |
| B03 Auth | En proceso: adaptador HTTP fail-closed, sin login real | Auth Passenger y revocación de A |
| B04 Viaje AUTO | Borrador local disponible, POST definido pero no activo | Confirmación de asignación y cancelación |
| B05 Tarifas | Endpoint quote catalogado, no conectado | Respuesta G7 server-derived |
| B06 Seguimiento | Pantalla vacía honesta | Snapshot versionado y frescura GPS |
| B07 Envíos | Borrador AUTO/MOTO carga y validador; endpoint no activo | Respuestas y capacidad por zona |
| B08 Comercios | Sin catálogo real | Contrato stock/listas del servidor |
| B09 Pagos/historial/soporte | Sin ledger ni historia real | APIs de recibos y casos |
| B10 QA | `npm run check` / web export por ejecutar tras commits | CI de app separada |
| B11 Admin WEB | Sin proyecto al inicio | Auth admin + permisos acción backend |
| B12 Lovable | Solo UI; no se ha exportado nada | Diseño/ejecución aprobados |
| B13 Certificación | Pendiente E2E sintética/integrada | Contratos, QA, CI y dispositivos |

## Contratos y solicitudes pendientes para A
1. **AUTH-CLIENT**: login/token endpoint o proveedor, token TTL/revocación y consulta de sesión/role `passenger`; 401/403/429. Rol/identidad exclusivamente derivados de JWT en servidor. Auditoría de cambio de cuenta y timeout.
2. **RIDER-STATUS**: respuesta tipada con `tripId`, `revision` monotónica, `state`, `assigned` persistido y `locationObservedAt`; sin placa, GPS ni ETA antes de aceptación, después de expiración o cancelación.
3. **RIDER-CANCEL**: POST idempotente, autorización de propietario, estado y revisión persistidos, 409 para carreras; no aparece aún un contrato confirmado de cancelación independiente.
4. **FARES**: esquema de respuesta Gs entero, `quoteId`, `expiresAt`, `fareVersion`, `routeEvidence`; precio solo servidor; 409/410 para desactualizado.
5. **COMMERCE**: endpoints de sucursales/catálogo/stock y respuesta tipada de pedido con revisiones; no mostrar stock inventado ni medicamentos de receta.
6. **HISTORY/SUPPORT**: paginación filtrada por usuario, receipt ledger y reporte de incidentes; nunca PII ajena.
7. **ADMIN**: sesión web/MFA y permisos por acción, GET cola vehículos/doc metadatos seguros, URLs temporales de evidencia, POST decisión idempotente y auditada, zonas, incidentes y reportes; sin `service_role` en browser.

## Regla de implementación
Adaptadores clientes no verifican JWT por sí mismos ni confían en roles locales para permisos. Por defecto `enabled=false`; URL HTTPS pinned, sesión inyectada y respuestas server-authoritative son condiciones necesarias, pero no suficientes sin QA del backend. Toda prueba usa datos ficticios. El Arquitecto B modifica únicamente `apps/movete-cliente/**`, `apps/movete-admin/**` y `docs/architect-b/**`. Registro de CI, SHA y bloqueos se ampliará con cada commit.

## Avances de la primera sesión del Arquitecto B (22-10-2026)
- `86f0ece6d1559187ac215a809488692109673c3b`: auditoría B01, adaptador HTTP Cliente por defecto inactivo y pruebas de autenticación, idempotencia, rutas y pago simulado.
- `41597e503ae4d59d157e388fec11ece36c9ca33c`: reducer B06 de seguimiento privado por revisión monotónica/frescura de GPS y pruebas, páginas Cliente de comercios, tarifa, pagos, cuenta y soporte.
- `27a64a86ae8e1e79dbd0fb477ca26615dfcafa13`: `apps/movete-admin` creado como web React/TypeScript/Vite autónoma con secciones KYC, zonas, seguridad, auditoría y métricas explícitamente desconectadas; adapter con bloqueo hasta contrato certificado.
- `1f4fbc6cdf03c057f0ce21633fe6fa266fdba251`: sesión pasajero efímera (no persistencia) y borrador de envíos con categorías, restricciones, peso y dimensiones; prueba de cambio de cuenta/logout.
- `8e7bdd9f38fd660e9d882214adeb913256053c5f`: declaración TS para formulario de envíos en Expo.
- [Issue #9 para Arquitecto A](https://github.com/mezas3238-hue/Qore-mobile-/issues/9): Auth, DTO de estado/tarifa, cancelación idempotente, comercios, historia, KYC y RBAC/acciones Admin.
- CI confirmado sobre `27a64a86`: **ownership boundary SUCCESS** (run 39878038142) y **two-app isolation SUCCESS** (run 39878038052). Son pruebas CI de la rama, no pruebas E2E reales ni certificado de Admin.
- CI del HEAD `8e7bdd9f`: boundary SUCCESS (run 39878354281); two-app isolation **en ejecución al consultar**, sin conclusión anticipada.
- Pruebas `apps/movete-admin/npm run check` y `npm run build`: **pendientes de ejecución verificable**. Los workflows actuales están controlados por A; B no puede editarlos para añadir un job Admin. Se solicita a A incorporar un job aislado del panel.
- Ninguna operación LIVE, GPS real, documentos KYC reales, frontend Auth real, PSP, build de APK o instalación en móviles se ha probado ni habilitado.

### Actualización matriz
- B01: COMPLETADO (auditoría por lectura).
- B02: PARCIAL (navegación 9 rutas y pantallas QA sin información inventada).
- B03: PARCIAL (controller sesión local + gateway en espera de Auth/DTO real).
- B04/B05: PARCIAL (validadores y contrato de POST; backend no conectado).
- B06: PARCIAL (reducer monotónico, no polling/Realtime integrado).
- B07: PARCIAL (formulario con categorías/peso/dimensiones y controles).
- B08/B09: PARCIAL UI de espera, sin precios, stock, pagos ni historial inventados.
- B10: CI Expo/aislamiento observado para commit anterior; E2E sin probar.
- B11: ESTRUCTURA/UI creada, sin admin Auth ni operaciones ni certificado build.
- B12: Pendiente fase Lovable, no se ejecutó.
- B13: Abierto; faltan E2E, API staging, QA nativa y aceptación A/Owner.

> La capa B no está terminada. La disponibilidad de servicios reales depende de contratos y seguridad del backend A. Se mantendrá fail-closed.

## Segunda sesión — avance de construcción B (22-10-2026, continuación)
### Código nuevo dentro de las rutas exclusivas
- `4475c97c7c58cd55a5b08d08d7be5c3a3d85282e`: `client-mutations.mjs` con requestKey estable, reintento explícito, aislamiento al cambiar cuenta y sin datos privados en estado público; `quote-view.mjs` con validación por titular, tarifa en Gs, caducidad y evidencia de ruta. Los DTOs de quote quedan como propuesta QA, **no como contrato backend aprobado**.
- `47a4865899d7dde8296dc03b68d82ea8b2778dfa`: interfaz Admin KYC de entrenamiento, tres casos estáticos enteramente ficticios; formulario de decisión local con motivo, sin ejecutar aprobación ni exponer documentación.
- `86eebd22382e3513926079317f8ea169a6b3c1a4` y `1f2a316d41c718e36e5a1098c9e0c49613aebe11`: corrección de carrera de dos taps simultáneos mientras se obtiene sesión. Se bloquea la operación **antes del primer await** y se agregó test adversarial.
- `d42b99cb88cb0f78182d133b9212f065e26eb26f`: carrito sintético por sucursal, cantidades 1–999, hasta 50 líneas, **sin inventar precio/stock**; proyector de catálogo condicionado a revisión, caducidad y categorías no reguladas.
- `f461595bad5446eafed3e9aa586fa3353d0a4cf5`: corrección del patrón UUID estándar del carrito/catálogo que CI detectó inválido. El fallo inicial fue real y quedó reparado con re-ejecución exitosa.
- `aef538161254445fac089d638a7513d46fee650b`: formulario Cliente para borrador de incidentes QA; sin enviar avisos, contactar autoridades ni afirmar SOS activado.
- `616c031591896953d176ab9a7eae22fdf8f6c63c`: asistente de viaje AUTO: origen, destino, preferencia Económico/Confort/XL, validación de borrador, confirmación comercial deshabilitada sin cotización/identidad/GPS reales.

### Pruebas y fallos
- CI 39879402745 del módulo de mutaciones/cotización: **SUCCESS**.
- CI 39879647388 del módulo KYC sintético: **SUCCESS** en aislamiento/Cliente; NO incluye `npm run build` del Admin.
- CI 39879731927, que incorpora corrección de doble toque: **SUCCESS**.
- CI 39879929997 y 39880103552: **FAILURE detectado** en cinco pruebas del carrito por patrón UUID sin un bloque de cuatro dígitos. No ocultar estos antecedentes.
- Commit reparador `f461595bad5446eafed3e9aa586fa3353d0a4cf5`: CI boundary #39880212560 **SUCCESS** y CI Cliente/aislamiento #39880212725 **SUCCESS**.
- CI del siguiente HEAD (asistente AUTO) debe consultarse directamente por SHA; su éxito no se presupone aquí.
- Admin web posee script local `npm run check && npm run build`, pero no hay evidencia de ejecución en CI específica; issue #9 sigue abierto hasta que A agregue job. **No declarar Admin certificado**.

### Criterios B restantes
1. Integrar endpoint Auth Passenger con JWT verificado por A y revocación, roles y sesión real, sin introducir service_role en Expo.
2. Unir `client-mutations`, `quote-view`, `rider-status` y `commerce-draft` a DTOs STAGING certificados y APIs Auth propias; bloquear hasta entonces.
3. Definir URL HTTPS staging pinned, scopes/permisos, request/response exactos, estado, caducidad, re-sync/reconexión, idempotencia transversal y política de protección de datos según issue #9.
4. Certificar Admin Web con TypeScript/build propios, Auth Admin con MFA si corresponde, KYC/zonas/incidentes/reportes por backend y E2E adversarial de navegador.
5. Probar dos APK/IPA separadas en dispositivos autorizados, sin interpretar exportación web como certificación nativa.
6. Interfaz visual final (Lovable solo UI) después de infraestructura y contratos aprobados; no despliegue ni LIVE sin mandato explícito.

Reglas constantes: **solo Cliente, Admin y docs/architect-b; PR #8 DRAFT; no merge; no producción, SQL remoto, pagos reales ni datos personales.**
