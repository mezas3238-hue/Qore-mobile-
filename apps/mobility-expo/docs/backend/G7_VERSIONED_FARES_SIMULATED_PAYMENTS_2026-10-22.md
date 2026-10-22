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
- Repositorio Supabase server-only, gateway autenticado y runtime loopback con
  contexto de ruta inyectado. El cliente no puede declarar distancia, tiempo,
  zona, peajes, monto, comisión ni identidad.

## API autenticada de staging

- `POST /v1/staging/fares/quote`
- `POST /v1/staging/payments/authorize`
- `POST /v1/staging/payments/:paymentId/transition`
- `GET /v1/staging/payments/:paymentId/status`

El endpoint de cotización recibe únicamente clave idempotente, modalidad,
tipo de sujeto e ID opaco. Las métricas se obtienen de un adaptador de ruta
con tráfico verificado y sin fallback. El runtime falla cerrado mientras ese
adaptador no esté inyectado. La autorización acepta exclusivamente
`SIMULATED_CASH` o `SIMULATED_CARD`.

La verificación local actual pasa 190/190 pruebas de servidor, 102/102 de
dominio, TypeScript y guard NO-LIVE. El workflow remoto detectó que
`SELECT ... FOR UPDATE` sobre la cotización inmutable exigía permiso UPDATE;
se reemplazó por bloqueo asesor transaccional por cotización, preservando la
inmutabilidad y serializando autorizaciones concurrentes. La ejecución
PostgreSQL 16 del commit de corrección sigue siendo el gate definitivo.

## Límites

No hay precios comerciales aprobados: las reglas del smoke son fixtures. No
existen tarjeta, token, adquirente, banco, webhook, efectivo real, factura,
impuesto ni liquidación a conductor/comercio. Para pedidos comerciales este
contrato representa únicamente el transporte; no cobra la cesta de productos.
La siguiente capa será administración, seguridad operativa y pruebas
integrales antes de cualquier integración Lovable.

