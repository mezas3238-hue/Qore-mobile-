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
