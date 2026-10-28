# HANDOFF OPERATIVO — ARQUITECTO B
Fecha: 22 de octubre de 2026 · QORE Mobile / Movete Fácil

**Documento maestro obligatorio:** [DIVISIÓN Y HANDOFF MAESTRO](../handoff/DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md).

## Tu trabajo exclusivo

**Crear y completar Movete Fácil Cliente** en `apps/movete-cliente/**` (pasajeros y usuarios de envíos) y **panel administrativo web** en `apps/movete-admin/**`. Mantener ambos independientes de Movete Fácil Driver. No construir backend, migraciones, Auth privilegiado, pagos o GPS reales. El Arquitecto A construye todo el backend compartido y la aplicación Driver.

**Puedes modificar SOLAMENTE:** `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`. Escribir en cualquier otra carpeta está prohibido. Puedes leer el backend y OpenAPI sin editarlos. El CI bloquea cambios fuera de tu área.

Rama exclusiva: `feature/mobility-cliente-admin-parallel-20261022`.
Tu PR: DRAFT hacia `feature/mobility-monorepo-isolated-20261016`, nunca hacia main. No hacer MERGE, LIVE, despliegues, VPS, SQL remoto, pagos reales ni subidas de documentos verdaderos sin orden explícita del Owner.

## Orden de trabajo en paralelo, sin detenerse salvo bloqueo real

1. **B01 Auditoría**: leer `apps/movete-cliente` y OpenAPI `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json`; crear `docs/architect-b/STATUS_Y_CONTRATOS.md` con estado real, bloqueos, endpoints y tests. No suponer que un endpoint STAGING del esquema está desplegado.
2. **B02 Arquitectura Cliente**: navegación, componentes visuales, estados, formularios, accesibilidad, separación de sesión y datos. Sin funciones del Driver, sin panel admin dentro del móvil.
3. **B03 Auth**: adaptador tipado de autenticación pasajero, ciclo de sesión, logout, rotación/revocación, rechazo de roles driver/admin. Usar mocks que fallen cerrado hasta contrato backend seguro.
4. **B04 Viajes AUTO**: origen/destino, servicio, oferta de precio, confirmación, solicitud idempotente, búsqueda, cancelación, errores, reconexión. No habilitar transporte de pasajeros MOTO sin normativa y seguros verificados.
5. **B05 Tarifas**: UI con PYG/guaraníes y cotización G7 server-derived; no calcular comisiones ni inventar ETA/precios en frontend.
6. **B06 Seguimiento**: estado real de viaje, perfil y patente del conductor solo tras aceptación persistida, GPS consentido con frescura, ETA basado en ruta verificada, polling/resync y eventos con revisión monotónica.
7. **B07 Envíos**: particulares y comerciales; categorías documentos, paquetes, supermercados, restaurantes y farmacia OTC; AUTO/MOTO carga con límites de peso/volumen, prueba de entrega y rechazo por restricciones.
8. **B08 Comercios**: catálogo, stock por sucursal, búsqueda por zona, carrito, pedido, preparación, entrega y cancelaciones; precios/stock únicamente del servidor.
9. **B09 Pagos/historial/soporte**: flujos de pagos SIMULADOS, recibos de ledger, historial del propio cliente, calificaciones y reporte de incidentes; sin PSP real.
10. **B10 QA Cliente**: `npm run check`, `npx expo export --platform web`, tests de UI, JWT, privacidad, red caída, tokens revocados, duplicación, cancelación y accesibilidad.
11. **B11 Panel Admin WEB**: crear `apps/movete-admin/**` autónomo, con login administrador y pantallas de cola KYC, documentos seguros de conductor/vehículo, revisión aprob/rechaz, seguros, zonas, incidentes, suspensiones, auditoría y reportes. Solo UI y adapters HTTP de APIs con autorización backend. Nunca incluir service role/SQL privilegiado en browser.
12. **B12 UI/Lovable**: implementar únicamente UI Cliente y Admin, manteniendo identidad Driver independiente; Lovable jamás controla RLS, SQL o cálculos económicos.
13. **B13 Certificación**: pruebas E2E sintéticas de Cliente y Admin, registro de commits/CI y problemas en `docs/architect-b/STATUS_Y_CONTRATOS.md`, PR DRAFT sin merge.

## Protocolo de contratos

El Arquitecto A es propietario único del backend, OpenAPI, SQL, RLS, infraestructura, CI central y `apps/movete-driver`. Si falta o hay que cambiar un endpoint, abrir issue GitHub para A indicando rol, ruta, payload mínimo, respuesta, seguridad, códigos de error y criterio de test. B implementa adaptador local que falle cerrado mientras espera; NO modificar backend ni duplicar servicios.

Contratos STAGING existentes para estudiar (NO equivale a endpoint online): `POST /v1/staging/rider/trips/request`, `GET /v1/staging/rider/trips/{tripId}/status`, `POST /v1/staging/sender/deliveries/request`, `GET /v1/staging/deliveries/{deliveryId}/status`, `POST /v1/staging/fares/quote`, `POST /v1/staging/buyer/orders/request`, `GET /v1/staging/orders/{orderId}/status`, `POST /v1/staging/payments/authorize`.

## Estado comprobado al transferir

Dos apps Expo independientes creadas: `apps/movete-driver` y `apps/movete-cliente`. PR #7 DRAFT; CI de aislamiento, PostgreSQL, Node y Expo verdes sobre `6fac68e82a991fa93ae22fea3692011111bd45ee`. Sus pantallas son DEMO local, **NO** operaciones reales ni APK/IPA certificadas. `apps/mobility-expo` se mantiene como laboratorio legado mixto, NO como tercera app móvil a lanzar.

## Entregables al Arquitecto A

Cada avance debe anotar SHA, rutas tocadas, pruebas exitosas/fallidas, contrato de API y bloqueos en `docs/architect-b/STATUS_Y_CONTRATOS.md`. No tocar ramas ajenas. Continuar avanzando sobre UI, adapters mock y tests ante APIs pendientes; escalar solo bloqueos reales de seguridad, legalidad, Auth o falta de contratos.

**Sin autorización de LIVE, sin MERGE, sin claves, sin pagos, sin SQL remoto.**
