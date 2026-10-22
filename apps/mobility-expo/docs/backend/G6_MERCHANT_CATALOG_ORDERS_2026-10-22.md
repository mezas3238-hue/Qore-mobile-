# QORE Mobile — comercios, inventario y pedidos G6

**Fecha:** 2026-10-22

**Estado:** contrato PostgreSQL 16 desechable implementado; NO migrado a ningún
entorno remoto, NO LIVE.

## Funcionalidad

- Comercios tipados: supermercado, farmacia, restaurante, retail y otros.
- Sucursales, personal por comercio, aceptación de pedidos y tiempo de
  preparación.
- Catálogo con SKU, precio entero PYG, peso, stock, revisión e inventario
  reservado transaccionalmente al solicitar.
- Cesta de hasta 50 líneas, precio tomado exclusivamente del catálogo y
  subtotal máximo controlado; reintento idempotente no vuelve a descontar.
- Flujo `requested → confirmed → preparing → ready → handed_to_courier →
  delivered`, con cancelación y devolución exacta de inventario.
- Enlace verificado con G5: comprador, modalidad, pickup y categoría deben
  coincidir; el comercio entrega al courier solo cuando G5 está `picked_up` y
  el comprador completa el pedido solo después de comprobante `delivered`.
- RLS para comprador/personal del comercio, catálogo aprobado y auditoría
  append-only; mutaciones reservadas al servidor.

Farmacia admite únicamente `PHARMACY_OTC`. Prescripción y medicamentos
controlados no existen en el enum, por lo que no pueden incorporarse por una
bandera del cliente.

## Evidencia y límites

El workflow principal ejecuta `scripts/sql/g6_merchant_orders_smoke.sql` tras
G5 sobre la misma base PostgreSQL 16 efímera. La prueba cubre reserva de stock,
replay, rechazo OTC fuera de farmacia, preparación, entrega vinculada,
comprobante, cancelación/reposición y RLS.

El repositorio `server/g6-supabase-merchant-repository.mjs` y el gateway
`server/g6-merchant-order-gateway.mjs` conectan el contrato a las rutas:

- `POST /v1/staging/buyer/orders/request`
- `POST /v1/staging/merchant/orders/:orderId/transition`
- `POST /v1/staging/buyer/orders/:orderId/transition`
- `POST /v1/staging/merchant/orders/:orderId/attach-delivery`
- `GET /v1/staging/orders/:orderId/status`

El runtime loopback deriva comprador/personal del JWT y de membresía persistida;
no acepta precios, subtotal, identidad o estados declarados por el cliente. La
suite local alcanza 176/176 pruebas de servidor.

Todavía no hay administración HTTP de onboarding, catálogo o horarios.
Tampoco implementa sustituciones, carrito persistente,
impuestos, pago, reembolso, promociones, cadena de frío ni prescripciones. El
siguiente bloque amplía operaciones comerciales, siempre antes de Lovable.

