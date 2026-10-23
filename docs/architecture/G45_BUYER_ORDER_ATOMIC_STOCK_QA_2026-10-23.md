# QORE Mobile — Arquitecto A · G45 / A26: reserva atómica de pedidos y stock en QA

**Fecha:** 2026-10-23 · **Ámbito:** PR #7 DRAFT, base del Arquitecto B PR #8 · **Estatus:** código QA, NO montaje HTTPS real.

## Alcance implementado

G45 refuerza el motor G6 existente en lugar de crear una segunda lógica de precios o almacén. La compra **real sigue deshabilitada**. Sólo ejecuta una simulación duradera sobre PostgreSQL 16 desechable con usuarios/comercios/stock sintéticos.

1. **SQL `G45_BUYER_ORDER_STOCK_FENCE_POSTGRES_CI_ONLY.sql`.** La función `mobility_stage_g45_reserve_order_qa` recibe identidad de comprador, sesión G42 verificada, token iat, requestKey, branch, versión de catálogo G44, tipo AUTO y hasta 50 líneas itemId/quantity. La función exige sesión no revocada con row-lock hasta finalizar la transacción, comprador passenger exclusivo, clave de idempotencia serializada y bloqueo de sucursal antes del catálogo. Compara versión **antes** de cambiar stock; llama a G6 para bloquear ítems, calcular subtotal PYG con precios de servidor y crear pedido + líneas + reserva en una misma transacción.
2. **Recibo inmutable** `mobility_stage_g45_order_receipts` con `receiptId`, `orderId`, requestKey, buyer, branch, versión y precio del servidor. Repetir exactamente la misma solicitud no resta stock otra vez; cambiar actor/cesta/versión/branch con igual clave rechaza `G4509`. Las solicitudes compitiendo por último stock se serializan por sucursal/revisión y sólo una puede reservar.
3. **Cancelación de QA** `mobility_stage_g45_cancel_order_qa` y `mobility_stage_g45_cancel_receipts`. Usa G6 transición para reposición única de cantidades, admite el mismo `cancelKey` y bloquea repetición con otra identidad. No realiza transferencia monetaria: `NO_PSP_NO_FINANCIAL_REFUND`. SOS, entrega real, courier y PSP no están activados.
4. **Seguridad:** ambas funciones nuevas son `SECURITY DEFINER`, `search_path=''`, pero **sólo para el OWNER de BD descartable**, sin `EXECUTE` a `service_role`, `authenticated` o `anon`. G6/G9 históricos conservan grants amplios y **requieren nueva auditoría y migraciones antes de conectar HTTPS STAGING real**. Un UUID de parámetro no constituye prueba de identidad. No se permite levantar este fixture como API.
5. **Node `g45-buyer-order-reservation-qa.mjs`** contrato de transporte inyectado, totalmente deshabilitado para producción. Requiere fuente JWT genuina inyectada, prueba de sesión no revocada y rol passenger exclusivo del servidor; rechaza JSON con subtotal, precio, PSP, cliente/actor inyectados, MOTO no certificado, más de 50 líneas, cantidades inválidas y receipt con campos adicionales. Recibos están marcados `QA_RESERVED_NO_PAYMENT` y `orderEnabled:false`.
6. **OpenAPI versión `1.0.0-g45`:**
    - `POST /v1/staging/buyer/orders/reservations-g45`
    - `POST /v1/staging/buyer/orders/{orderId}/cancel-reservation-g45`
    - Ambas operaciones declaran `x-qore-runtime-wired:false` y `x-qore-qa-only:true`; son contratos futuros, **NO HTTP desplegado**.
7. **Evidencia PostgreSQL:** `G45_BUYER_ORDER_STOCK_ASSERT_POSTGRES_CI_ONLY.sql` verifica precio Gs 25.000 tomado del registro, ausencia de doble descuento por replay, actor ajeno, conflicto de revisión, agotamiento de stock, rollback sin pedido fantasma, cancelación + reposición exacta e inaccesibilidad del `service_role`. `g45-buyer-order-race-ci.py` usa dos sesiones PG reales y compara repetición concurrente del mismo requestKey y compradores rivales por la última unidad. El CI agrega ambos pasos después de G44.
8. **Evidencia Node:** `g45-buyer-order-reservation-qa.test.mjs` y `g45-buyer-openapi-contract.test.mjs`, sin pago ni red remota.

## Límites y pendientes P0

- QA en esquema PostgreSQL descartable **no certifica** la infraestructura de identidad/STAGING HTTPS, permisos del proveedor, servicio de comercio efectivo, legalidad de zonas, precios de producción, impuestos, reembolsos bancarios, conciliación ni dispositivos físicos. Los datos sintéticos no son disponibilidad de comercios.
- El cliente B debe mantener comprador/comercio/carro/checkout **OFF**, no interpretar un `QA_RESERVED_NO_PAYMENT` como compra realizada. UI B independiente de la implementación de A.
- La ejecución de G6/9 por `service_role` y escrituras DML directas al inventario/comercios **no están cerradas**; certificar autoridad exclusiva y transiciones antes de exponer APIs. G45 tiene permisos privados sólo de fixture, deliberadamente no conectado al gateway G6 existente.
- El stock creado vía G6 se descuenta de inmediato, no tiene expiry/auto-release ni PSP. Queda pendiente política comercial real: TTL, cancelación/reembolso, split de delivery, sustituciones, impuestos y tarifas calculadas por servidor, conciliación y chargebacks.
- Las sucursales G44 existen en mapeo sintético; G31 `eligible_by_policy=false`. Ningún pedido ni envío real puede activarse por tener `coverage_status=ACTIVE`.
- **Próximos A:** G46 autoridad Auth/JWKS/STAGING HTTPS real sólo con autorización Owner, trabajo en G47 KYC storage seguro, G48 auditoría de privilegios G6/G9 y transiciones. Integración B requiere E2E de usuario real sintético, sesión revocada, stock concurrente y evidencia antes de activar flags. Publicar siempre SHA único y matriz cuatro workflows.
- **Invariantes de gobierno:** PR #7 y #8 DRAFT; NO MERGE / NO LIVE / NO DEPLOY / NO VPS / NO PSP / NO secretos o PII reales.
