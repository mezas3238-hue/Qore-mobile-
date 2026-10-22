# QORE Mobile — seguridad y operaciones G8

**Fecha:** 2026-10-22

**Estado:** contrato PostgreSQL 16 desechable; NO desplegado, NO LIVE y sin
integración con centrales de emergencia.

## Implementado

- Incidentes ligados a un viaje, entrega o pedido persistido. Solo un
  participante comprobado por PostgreSQL puede reportar.
- Categorías cerradas `SOS`, `SAFETY`, `LOSS`, `DISPUTE`, `FRAUD` y `QUALITY`;
  no se guarda texto libre ni PII en la bitácora.
- `SOS` siempre es crítico y solo se admite durante un viaje o entrega activos.
  Registrar un SOS no afirma que una central externa fue notificada.
- Flujo administrativo durable `open → triaged → investigating → resolved`,
  con descarte controlado, revisión de rol admin en cada transición y eventos
  append-only.
- Suspensiones operativas por alcance `DRIVER`, `BUYER` o `MERCHANT_STAFF`,
  aplicadas y levantadas solo por admin verificado, con idempotencia y auditoría
  inmutable.
- Triggers debajo de la API bloquean nuevas asignaciones, solicitudes,
  cotizaciones y autorizaciones de pago para actores suspendidos. Una
  suspensión no impide cerrar de forma segura una custodia o viaje ya activo.
- RLS permite al reportante leer su propio incidente; eventos internos y
  suspensiones no se exponen a clientes.

## Evidencia

`scripts/sql/g8_safety_operations_smoke.sql` se ejecuta después de G7 en la
misma base PostgreSQL 16 efímera. Comprueba identidad participante, replay,
rechazo de tercero, gate de SOS, flujo administrativo, suspensión/lift,
bloqueo efectivo de una asignación y auditorías no mutables.

Las pruebas estáticas del contrato están en
`server/g8-safety-operations-sql-contract.test.mjs`. El repositorio server-only
y el gateway autenticado exponen rutas separadas para usuario y admin:

- `POST /v1/staging/safety/incidents/report`
- `GET /v1/staging/safety/incidents/:incidentId/status`
- `POST /v1/staging/admin/safety/incidents/:incidentId/transition`
- `POST /v1/staging/admin/safety/suspensions/apply`
- `POST /v1/staging/admin/safety/suspensions/:suspensionId/lift`

El runtime deriva reportante/admin de Auth, revalida el rol administrativo y
no acepta coordenadas, texto libre ni identidad del reportante en el JSON. La
suite local pasa 203/203 pruebas de servidor, 102/102 de dominio, TypeScript y
guard NO-LIVE. El primer CI SQL G8 encontró acceso a campos incompatibles en
un trigger genérico; se corrigió usando una representación JSONB de `NEW/OLD`
y el nuevo commit queda sujeto a PostgreSQL 16 efímero.

## Límites

No existen despacho 911/Policía, llamada, SMS, geolocalización de emergencia,
grabación, equipo humano 24/7 ni SLA. Tampoco se debe suspender automáticamente
a una persona por un reporte no investigado. Esas operaciones requieren
políticas, personal, proveedores y autorización del Owner antes de cualquier
uso real.
