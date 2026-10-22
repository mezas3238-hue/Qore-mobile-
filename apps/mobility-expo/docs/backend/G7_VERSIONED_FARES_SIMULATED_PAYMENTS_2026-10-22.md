# QORE Mobile — tarifas versionadas y pagos simulados G7

**Fecha:** 2026-10-22

**Estado:** contrato PostgreSQL 16 desechable; NO desplegado, NO PSP, NO dinero.

## Implementado

- Reglas de tarifa aprobadas y versionadas por modalidad/zona, con vigencia,
  base, distancia, tiempo, mínimo y comisión en puntos básicos.
- Cotización persistida e idempotente en PYG enteros, ligada a un viaje,
  entrega o pedido que pertenece al usuario autenticado.
- Comisión calculada sobre subtotal; peajes quedan fuera de la comisión.
- MOTO no puede cotizarse contra el contrato AUTO y permanece sin sujeto de
  viaje legal persistente.
- Métodos exclusivamente `SIMULATED_CASH` y `SIMULATED_CARD`.
- Autorización, captura solo tras servicio terminado, cancelación y reembolso.
- Ledger privado append-only de tres cuentas, con captura balanceada y
  reversión balanceada en el reembolso.
- RLS de lectura propia y todas las mutaciones reservadas al servidor.

## Límites

No hay precios comerciales aprobados: las reglas del smoke son fixtures. No
existen tarjeta, token, adquirente, banco, webhook, efectivo real, factura,
impuesto ni liquidación a conductor/comercio. Para pedidos comerciales este
contrato representa únicamente el transporte; no cobra la cesta de productos.
La siguiente capa será repositorio/API autenticada, administración y pruebas
operativas antes de cualquier integración Lovable.

